import { Mappings, Func, Callback, CallbackOf, HashMap, HashMapOf } from 'etl'
import * as Promise from 'bluebird'
import * as async from 'async'
import * as transformers from '../functions'
import * as enrichmentManifest from '../data/enrichments'
import { object as hydrater } from 'dot-object'
import * as _ from 'lodash'
import { transformationErrorTaskGenerator, TransformationErrorCodes } from './transformationErrors'

export interface Transformer {
  (values: string[], callback: Callback): void
}

export interface TransformerOf<TSourceType, TDestType> {
  (values: TSourceType[], callback: CallbackOf<TDestType[]>): void
}

export interface TransformerFactory {
  (options?: HashMapOf<any>, doc?: HashMap): TransformerOf<any, any>
}

export interface TransformerFactoryOf<TSourceType, TDestType> extends TransformerFactory {
  (options?: HashMapOf<any>, doc?: HashMap): TransformerOf<TSourceType, TDestType>
}

type WaterfallTask = TransformerOf<any, any> | { (cb: Callback): void }

type WaterfallTaskList = WaterfallTask[]

function extendObject(dest: HashMapOf<any>, extension: HashMapOf<any>) {
  for (let attr in extension) {
    dest[attr] = extension[attr]
  }
  return dest
}

export class DocumentTransformer {

  importId: string

  attributes: HashMap

  constructor(attributes: HashMap) {
    this.attributes = attributes || {}
  }

  set(attr: string, val: any) {
    this.attributes[attr] = val
  }

  transform(mappings: Mappings.FieldMap[]) {
    return new Promise<DocumentTransformer>((resolve, reject) => {
      // Create a method for each field mapping that will morph document values
      // upon execution
      // TODO This functionality should exist in another class, FieldMapping?
      let transformations = _.map(mappings, this.createMappingTaskGenerator(this.attributes))
      // Create a callback that will accept the results of the transformations
      // and aggregate them into a single object representative of the
      // transformed document
      let wrappedCallback = (err: Error, taskResults: HashMap[]) => {
        if (err) {
          console.error(err)
          return reject(err)
        }
        let attributes = _.reduce(taskResults, extendObject, {})
        let newDoc = new DocumentTransformer(attributes)
        return resolve(newDoc)
      }

      // Execute each transformation in parallel
      async.parallel(transformations, wrappedCallback)
    })
  }

  enrich() {
    return new Promise<DocumentTransformer>((resolve, reject) => {
      // Create a method for each field mapping that will morph document values
      // upon execution
      // let transformations = _.map(enrichmentManifest, this.createMappingTaskGenerator(this.attributes))
      // Create a callback that will accept the results of the transformations
      // and aggregate them into a single object representative of the
      // transformed document
     //  let wrappedCallback = (err: Error, taskResults: HashMap[]) => {
      //   if (err) {
      //     return reject(err)
      //   }
      //   extendObject(this.attributes, taskResults.reduce(extendObject, {}))
      //   return resolve(this)
      // }

      // // Execute each transformation in parallel
      // async.parallel(transformations, wrappedCallback) // async.transform

      let transformCallback = (err: Error, result: HashMap) => {
        if (err) {
          return reject(err)
        }
        // set this DocumentTransformer to the accumulated result
        this.attributes = result
        return resolve(this)
      }
      let transformIterator = (acc: HashMapOf<any>, item: Mappings.FieldMap, index: number, iteratorCallback: CallbackOf<any>) => {
        let enrichmentTask = this.createMappingTaskGenerator(acc)(item)
        enrichmentTask(function (err: Error, enrichedAttributes: HashMapOf<any>) {
          // extend the acc attiributes with these enrichedAttributes
          extendObject(acc, enrichedAttributes)
          return iteratorCallback(err)
        })
      }
      let transformItems = enrichmentManifest as Mappings.FieldMap[]
      // in series, transformer this.attributes against each FieldMap
      // series allows one enrichment to affect the result of the next
      async.transform.call(async, transformItems, this.attributes, transformIterator, transformCallback)
    })
  }

  /**
   * uses dot-object to fulfill a full javascript object from the
   * HashMap path => value attributes collection
   */
  hydrate<T>() {
    return hydrater(this.attributes) as T
  }

  /**
   * Maps each FieldMap to an async parallel function
   */
  createMappingTaskGenerator(attributes: HashMap) {
    return (mapping: Mappings.FieldMap) => {
      return (mappingCallback: CallbackOf<HashMap>) => {
        let mapKeyToVal = (source: string): string => {
          return attributes[source]
        }

        let definedValues = (value: any): boolean => {
          // remove keys that are not present in the extracted document
          return !_.isUndefined(value)
        }

        // extracts values from the document for each source[] path
        let sourceValues = _.map(mapping.source, mapKeyToVal).filter(definedValues)

        if (!sourceValues.length) {
          return mappingCallback(null, {})
        }

        let seed = (next: CallbackOf<any[]>) => next(null, sourceValues)
        let tasks: WaterfallTaskList = [seed]

        if (_.isArray(mapping.fn)) {
          _.forEach(mapping.fn, (transformation: Mappings.FieldMutation) => {
            let transformFnFactory = transformers[transformation.name]
            if (_.isFunction(transformFnFactory)) {
              tasks.push(transformFnFactory(transformation.arguments, attributes))
            } else {
              tasks.push(transformationErrorTaskGenerator(`${transformation.name} not defined`, TransformationErrorCodes.FunctionNotDefined))
            }
          })
        }

        async.waterfall(tasks, (err: any, values: any[]) => {
          if (err) {
            return mappingCallback(err)
          }
          let attrs: HashMap = {}
          _.forEach(mapping.target, function (target, i) {
            // TODO is there risk of target at i not lining up with value at i
            let val = values[i]
            let targetValue = (values.length > i && !_.isUndefined(values[i])) ? values[i] : undefined
            if (_.isUndefined(targetValue)) { return }
            switch (mapping.type) {
              case 'float':
                val = parseFloat(val)
                break

              case 'int':
                val = parseInt(val, 10)
                break

              case 'boolean':
                val = !!val
                break
            }

            // TODO determine how hyrdate will handle multiple functions with same target?
            attrs[target] = val
          })
          return mappingCallback(null, attrs)
        })
      }
    }
  }
}
