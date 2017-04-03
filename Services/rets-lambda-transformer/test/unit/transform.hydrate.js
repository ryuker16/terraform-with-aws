'use strict'
/* eslint-env mocha */
import hydrate_dot_notation_to_object from 'dot-object'
import { expect } from 'chai'
import { assert } from 'chai'

describe('dotHydrateNotationToObject', function () {
  it('should return a function', function () {
    expect(hydrate_dot_notation_to_object).to.be.a('function')
  })
  it('should hydrate the object', function () {
    let obj = {
      'uncur_data.acres': '0.46',
      'uncur_data.area': 'CLAJ',
      'location.locality': 'Madras',
      'location.county': 'Jefferson',
      'last_mod': '2016-05-09T09:06:14',
      'agent.full_name': 'Mike Ahern',
      'agent.id': '5953',
      'office.id': 'CBDDR',
      'office.name': 'Coldwell Banker Dick Dodson',
      'cur_data.price': '225000.00',
      'feed_id': '139834',
      'mls_id': '201100340',
      'cur_data.desc': 'Fantastic location in the heart of Madras growth area. Building could be a church or any one of several uses. Priced to sell for land value. Same seller ownes a total of 180 X 200 feet and other bare land also listed for sale. New savings & loan to the North. Busy Dairy Queen to the South. This prperty is priced to sell, act today.',
      'total_photos': '15',
      'cur_data.prop_type': 'Commercial Building',
      'location.street_direction': 'Southeast',
      'location.street_name': 'Fifth Street',
      'location.street_number': '0',
      'location.neighborhood': '',
      'location.unit': '',
      'uncur_data.virtual_tour_link': 'http://view.paradym.com/showvt.asp?sk=13&t=3810964',
      'location.postal': '97741',
      'cur_data.sqft': '3200.00',
      'cur_data.status': 'Active',
      'cur_data.year_blt': '1952'
    }
    var transformedObj = {
      'last_mod': '2016-05-09T09:06:14',
      'feed_id': '139834',
      'mls_id': '201100340',
      'total_photos': '15',
      'uncur_data': {
        'acres': '0.46',
        'area': 'CLAJ',
        'virtual_tour_link': 'http://view.paradym.com/showvt.asp?sk=13&t=3810964'
      },
      'location': {
        'locality': 'Madras',
        'county': 'Jefferson',
        'street_direction': 'Southeast',
        'street_name': 'Fifth Street',
        'street_number': '0',
        'neighborhood': '',
        'unit': '',
        'postal': '97741'
      },
      'agent': {
        'full_name': 'Mike Ahern',
        'id': '5953'
      },
      'office': {
        'id': 'CBDDR',
        'name': 'Coldwell Banker Dick Dodson'
      },
      'cur_data': {
        'price': '225000.00',
        'desc': 'Fantastic location in the heart of Madras growth area. Building could be a church or any one of several uses. Priced to sell for land value. Same seller ownes a total of 180 X 200 feet and other bare land also listed for sale. New savings & loan to the North. Busy Dairy Queen to the South. This prperty is priced to sell, act today.',
        'prop_type': 'Commercial Building',
        'sqft': '3200.00',
        'status': 'Active',
        'year_blt': '1952'
      }
    }
    let transformedValue = hydrate_dot_notation_to_object.object(obj)

    assert.deepEqual(transformedObj, transformedValue)
  })
})
