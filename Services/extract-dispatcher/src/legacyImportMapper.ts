import { Legacy, Extraction, Models, ResoType, PurchaseType, Context, Mappings } from 'etl'
import * as _ from 'lodash'

export let ResoTypes = {
  'property': 'property',
  'member': 'member',
  'office': 'office'
} as {
  [index: string]: ResoType,
  property: ResoType,
  member: ResoType,
  office: ResoType
}

export let LegacyConfigTypes = {
  listing: 'listing',
  agent: 'agent',
  office: 'office'
}

export default class ImportMapper {
  static BASE_PROPERTIES = ['unconv_key', 'type']

  static isRetsImportConfig(config: Models.ImportConfig): config is Models.RetsImportConfig {
    return config.protocol === 'RETS'
  }

  getFieldMappings(fieldMappings: Legacy.FieldMap) {
    let transformManifest = {} as Mappings.Manifest

    const listingsMapping = fieldMappings.listing
    if (listingsMapping) {
      let mappedFields: Mappings.FieldMap[] = []
      Object.keys(listingsMapping).forEach(placesterKey => {
        mappedFields = mappedFields.concat(this.mapField(listingsMapping[placesterKey], placesterKey))
      })

      // ensure there is a feed_id mapping in the transform manifest
      let feedIdMap = _.find(mappedFields, function (fieldMap) {
        return _.includes(fieldMap.target, 'feed_id')
      })
      if (_.isNil(feedIdMap)) {
        let mlsIdMap = _.find(mappedFields, function (fieldMap) {
          return _.includes(fieldMap.target, 'mls_id')
        })
        if (!_.isNil(mlsIdMap)) {
          feedIdMap = {
            source: mlsIdMap.source,
            target: ['feed_id'],
            type: 'string'
          }
          mappedFields.push(feedIdMap)
        }
      }
      transformManifest.listing = mappedFields
    }

    const agentMapping = fieldMappings.agent
    if (agentMapping) {
      let mappedFields: Mappings.FieldMap[] = []
      Object.keys(agentMapping).forEach(placesterKey => {
        mappedFields = mappedFields.concat(this.mapField(agentMapping[placesterKey], placesterKey))
      })

      transformManifest.agent = mappedFields
    }

    const officeMapping = fieldMappings.office
    if (officeMapping) {
      let mappedFields: Mappings.FieldMap[] = []
      Object.keys(officeMapping).forEach(placesterKey => {
        mappedFields = mappedFields.concat(this.mapField(officeMapping[placesterKey], placesterKey))
      })

      transformManifest.office = mappedFields
    }
    return transformManifest
  }

  mapField(legacyFieldMapping: Legacy.BaseField | Legacy.BaseField[], placesterKey: string) {
    const mappedFields: Mappings.FieldMap[] = []

    if (Array.isArray(legacyFieldMapping)) {
      legacyFieldMapping.forEach((field: Legacy.BaseField) => {
        mappedFields.push(this.mapSingle(field, placesterKey))
      })
    } else {
      mappedFields.push(this.mapSingle(legacyFieldMapping, placesterKey))
    }
    return mappedFields
  }

  mapSingle(field: Legacy.BaseField, key: string): Mappings.FieldMap {
    const fieldMapping = {
      source: [field.unconv_key]
    } as Mappings.FieldMap

    if (key === 'cur_data/split_baths') {
      fieldMapping.target = ['cur_data.baths', 'cur_data.half_baths']
      fieldMapping.type = 'int'
      let mappingFunction = {
        name: 'split_baths'
      } as Mappings.FieldMutation
      if (field.bathroom_map) {
        mappingFunction.arguments = {
          bathroom_map: field.bathroom_map
        }
        delete field.bathroom_map
      }
      fieldMapping.fn = [mappingFunction]

    } else if (key === 'cur_data/sqft_range') {
      fieldMapping.target = ['cur_data.sqft_min', 'cur_data.sqft_max', 'cur_data.sqft']
      fieldMapping.type = 'float'
      fieldMapping.fn = [{
        name: 'split_sqft_range',
        arguments: {}
      }]
    } else if (key === 'cur_data/status') {
      // if sold_statuses exists - map to cur_data.status and status
      // if does not exist - just map to cur_data.status
      if (field.sold_statuses) {
        fieldMapping.target = ['cur_data.status', 'status']
        fieldMapping.fn = [{
          name: 'set_status',
          arguments: {
            sold_statuses: field.sold_statuses
          }
        }]
      } else {
        fieldMapping.target = ['cur_data.status']
        fieldMapping.fn = [{
          name: 'set_status'
        }]
      }
    } else if (key.indexOf('agent/') !== -1 || key.indexOf('office/') !== -1) {
      let pieces = key.split('/')

      // overrides for ruby core fuckery
      pieces[1] = pieces[1] === 'full_name' ? 'name' : pieces[1]

      fieldMapping.target = ['rets.' + pieces[0].charAt(0) + pieces[1]]
      fieldMapping.type = field.type
    } else {
      // transform to dot notation
      fieldMapping.target = [key.replace('/', '.')]
      fieldMapping.type = field.type
    }

    Object.keys(field)
      .filter(key => ImportMapper.BASE_PROPERTIES.indexOf(key) === -1)
      .forEach((property) => {
        let functionName = property
        if (!fieldMapping.fn) {
          fieldMapping.fn = []
        }
        if (property === 'true') {
          functionName = 'true_mapper'
        }
        const fieldMutation = {
          name: functionName
        } as Mappings.FieldMutation

        const fnValue = field[property]
        if (typeof fnValue !== 'object') {
          fieldMutation.arguments = {
            value: fnValue
          }
        } else {
          fieldMutation.arguments = fnValue
        }

        fieldMapping.fn.push(fieldMutation)
      })

    return fieldMapping
  }

  getImportConfig(legacyImport: Legacy.Import) {
    const serviceConfig = legacyImport.ETLServiceConfig
    if (!serviceConfig) {
      throw new TypeError('ETLServiceConfig')
    }

    let config = {
      importId: legacyImport._id,
      protocol: legacyImport.core_class,
      providerId: legacyImport.provider_id
    } as Models.ImportConfig

    // extend config with ETLServiceConfig
    config = Object.assign(config, serviceConfig)

    if (ImportMapper.isRetsImportConfig(config)) {
      config.connection = {
        url: legacyImport.url,
        username: legacyImport.username,
        password: legacyImport.password,
        retsVersion: legacyImport.rets_version,
        userAgent: legacyImport.ua_username,
        restrictedIp: legacyImport.ip_filtered,
        userAgentPassword: legacyImport.ua_password
      }
      config.resources = Object.keys(legacyImport.config)
        .map(key => {
          if (key === LegacyConfigTypes.listing) {
            return this.getListingResources(legacyImport.config.listing, serviceConfig as Models.RetsServiceConfig)
          } else if (key === LegacyConfigTypes.agent) {
            return this.getAgentResources(legacyImport.config.agent, serviceConfig)
          } else if (key === LegacyConfigTypes.office) {
            return this.getOfficeResources(legacyImport.config.office, serviceConfig)
          }
        })
        // filter out undefined values
        .filter(val => !!val && val.resoType === ResoTypes.property) as Models.RetsResource[]
    }

    return config
  }

  buildExtractionRequest(i: Legacy.Import, context: Context): Extraction.Request {
    let importId = (i._id).toString()
    context = Object.assign(context, { importId })
    let config = this.getImportConfig(i)
    let transformManifest = this.getFieldMappings(i.field_map)
    return { context, config, transformManifest }
  }

  getListingResources(listing: Legacy.ListingConfig, serviceConfig: Models.RetsServiceConfig) {
    let resourceModel = {
      resoType: ResoTypes.property,
      resourceName: listing.type,
      classes: []
    } as Models.RetsResource

    let serviceConfigResource = (serviceConfig.resources || []).find(function (resource) {
      return resource.resoType === ResoTypes.property
    })

    if (serviceConfigResource) {
      Object.assign(resourceModel, serviceConfigResource)
    }

    resourceModel.classes = this.getResourceClasses(listing, serviceConfigResource)

    return resourceModel
  }

  getResourceClasses(listing: Legacy.ListingConfig, resourceModel?: Models.RetsResource): Models.ClassResource[] {
    let classes = Object.keys(listing.classes || {})
      .map(classKey => {
        let classModel = {
          className: classKey,
          purchaseType: listing.classes[classKey] as PurchaseType
        } as Models.ClassResource
        return classModel
      })
    if (resourceModel && resourceModel.retsQueryFields) {
      // supply retsQueryFields on each class from resource
      classes.forEach(function (classModel) {
        classModel.retsQueryFields = classModel.retsQueryFields || resourceModel.retsQueryFields
      })
    }
    if (resourceModel && resourceModel.classes && resourceModel.classes.length) {
      classes.forEach(function (classModel) {
        resourceModel.classes.some(function (resourceClassModel) {
          if (resourceClassModel.className === classModel.className) {
            // extend class with properties from th ETLServiceConfig.resources
            Object.assign(classModel, resourceClassModel)
            return true
          }
          return false
        })
      })
    }
    return classes
  }

  getAgentResources(agentConfig: Legacy.AgentOfficeConfig, serviceConfig: Models.IServiceConfig) {
    return {
      resoType: ResoTypes.member,
      resourceName: agentConfig.type,
      query: agentConfig.search_all,
      classes: [{ className: agentConfig.class }]
    } as Models.RetsResource
  }

  getOfficeResources(officeConfig: Legacy.AgentOfficeConfig, serviceConfig: Models.IServiceConfig) {
    return {
      resoType: ResoTypes.office,
      resourceName: officeConfig.type,
      query: officeConfig.search_all,
      classes: [{ className: officeConfig.class }]
    } as Models.RetsResource
  }
}
