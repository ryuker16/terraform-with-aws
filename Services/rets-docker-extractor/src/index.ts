// /<reference path="../typings/index.d.ts" />
import 'reflect-metadata'
import container = require('./container')
import T from './lib/types'
import * as E from './entities'
container.get<E.ExtractProcessor>(T.ExtractProcessor).main()
