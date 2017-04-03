/// <reference path="../../definitions/index.d.ts" />

import { Mappings } from 'etl'

/**
 * enrichment process the transformed HashMap [objectPath] => value pairs to an extended
 * HashMap of final [objectPath] => value
 */
const enrichments = [
  {
    source: ['location.country'],
    target: ['location.country'],
    fn: [{
      name: 'country_abbreviation_lookup'
    }]
  },
  {
    source: ['location.region'],
    target: ['location.region'],
    fn: [{
      name: 'state_abbreviation_lookup'
    }]
  },
  {
    source: ['cur_data.desc'],
    target: ['cur_data.desc'],
    fn: [{
      name: 'desc_redaction'
    }]
  },
  {
    source: ['agency_data.phone'],
    target: ['agency_data.phone'],
    fn: [{
      name: 'normalize_phone'
    }]
  },
  {
    source: ['location.street_number', 'location.street_direction', 'location.street_name'],
    target: ['location.address'],
    fn: [{
      name: 'concat',
      arguments: {
        separator:  ' '
      }
    }]
  },
  {
    source: ['mls_id'],
    target: ['rets.mls_id']
  },
  {
    source: ['office.id'],
    target: ['rets.oid']
  },
  {
    source: ['agent.id'],
    target: ['rets.aid']
  },
  {
    source: ['office.name'],
    target: ['rets.oname']
  },
  {
    source: ['agent.name'],
    target: ['rets.aname']
  },
  {
    source: ['images'],
    target: ['images'],
    fn: [{
      name: 'normalize_images'
    }]
  },
  {
    source: ['status'],
    target: ['deleted_at'],
    fn: [{
      name: 'set_deleted_at'
    }]
  }
] as Mappings.FieldMap[]

export = enrichments
