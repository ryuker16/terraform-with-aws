module.exports = {
  "agent": {
    "phone": {
      "type": "string",
      "unconv_key": "DirectWorkPhone"
    },
    "email": {
      "type": "string",
      "unconv_key": "Email"
    },
    "first_name": {
      "type": "string",
      "unconv_key": "FirstName"
    },
    "last_name": {
      "type": "string",
      "unconv_key": "LastName"
    },
    "id": {
      "type": "string",
      "unconv_key": "MLSID"
    }
  },
  "listing": {
    "cur_data/lt_sz": {
      "type": "float",
      "unconv_key": "ACRES"
    },
    "uncur_data/appliances": {
      "type": "string",
      "unconv_key": "APPLIANCES",
      "gsub": {
        "match": ",",
        "replace": ", "
      }
    },
    "uncur_data/architecture": [
      {
        "type": "string",
        "unconv_key": "ARCHITECTURE"
      },
      {
        "type": "string",
        "unconv_key": "ArchitectureStyle"
      }
    ],
    "cur_data/basemnt": {
      "type": "boolean",
      "unconv_key": "BASEMENT",
      "true": "Yes"
    },
    "uncur_data/basement": [
      {
        "type": "string",
        "unconv_key": "BASEMENT_TYPE",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      },
      {
        "type": "string",
        "unconv_key": "BasementType"
      }
    ],
    "cur_data/split_baths": {
      "type": "split",
      "unconv_key": "BATHS",
      "bathroom_map": {
        "1": 1,
        "2": 2,
        "3": 3
      }
    },
    "uncur_data/bath_description": {
      "type": "string",
      "unconv_key": "BATH_DESC",
      "gsub": {
        "match": ",",
        "replace": ", "
      }
    },
    "cur_data/baths": {
      "type": "int",
      "unconv_key": "BathsFull"
    },
    "cur_data/half_baths": {
      "type": "int",
      "unconv_key": "BathsHalf"
    },
    "cur_data/beds": [
      {
        "type": "int",
        "unconv_key": "BedsTotal"
      },
      {
        "type": "int",
        "unconv_key": "NO_BEDROOMS"
      }
    ],
    "location/locality": [
      {
        "type": "string",
        "unconv_key": "CITY"
      },
      {
        "type": "string",
        "unconv_key": "City"
      }
    ],
    "uncur_data/cooling": [
      {
        "type": "string",
        "unconv_key": "COOLING"
      },
      {
        "type": "string",
        "unconv_key": "Cooling"
      }
    ],
    "location/county": [
      {
        "type": "string",
        "unconv_key": "COUNTY"
      },
      {
        "type": "string",
        "unconv_key": "CountyOrParish"
      }
    ],
    "uncur_data/exterior": {
      "type": "string",
      "unconv_key": "EXTERIOR",
      "gsub": {
        "match": ",",
        "replace": ", "
      }
    },
    "uncur_data/exterior_features": [
      {
        "type": "string",
        "unconv_key": "EXTERIOR_FEAT",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      },
      {
        "type": "string",
        "unconv_key": "ExteriorFeatures",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      }
    ],
    "cur_data/frplce": {
      "type": "boolean",
      "unconv_key": "FIREPLACE",
      "true": "Yes"
    },
    "uncur_data/fireplace": [
      {
        "type": "string",
        "unconv_key": "FIREPLACE_TYPE"
      },
      {
        "type": "boolean",
        "unconv_key": "FireplaceYN",
        "true": "1"
      }
    ],
    "uncur_data/foundation": [
      {
        "type": "string",
        "unconv_key": "FOUNDATION",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      },
      {
        "type": "string",
        "unconv_key": "FoundationDetails"
      }
    ],
    "uncur_data/fuel_type": {
      "type": "string",
      "unconv_key": "FUEL_TYPE"
    },
    "uncur_data/fireplace_location": {
      "type": "string",
      "unconv_key": "FireplaceLocations",
      "gsub": {
        "match": ",",
        "replace": ", "
      }
    },
    "uncur_data/garage": [
      {
        "type": "boolean",
        "unconv_key": "GARAGE",
        "true": "Yes"
      },
      {
        "type": "boolean",
        "unconv_key": "GarageYN",
        "true": "1"
      }
    ],
    "uncur_data/garage_features": {
      "type": "string",
      "unconv_key": "GarageFeatures"
    },
    "uncur_data/garage_spaces": {
      "type": "string",
      "unconv_key": "GarageSize"
    },
    "uncur_data/heating": [
      {
        "type": "string",
        "unconv_key": "HEATING",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      },
      {
        "type": "string",
        "unconv_key": "Heating",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      }
    ],
    "cur_data/hoa_fee": {
      "type": "float",
      "unconv_key": "HO_ASSOC_FEE"
    },
    "uncur_data/heating_fuel": {
      "type": "string",
      "unconv_key": "HeatingFuel"
    },
    "uncur_data/interior_features": [
      {
        "type": "string",
        "unconv_key": "INTERIOR_FEAT",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      },
      {
        "type": "string",
        "unconv_key": "InteriorFeatures",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      }
    ],
    "uncur_data/kitchen_appliances": {
      "type": "string",
      "unconv_key": "KitchenAppliances",
      "gsub": {
        "match": ",",
        "replace": ", "
      }
    },
    "agent/id": [
      {
        "type": "string",
        "unconv_key": "LISTAGENTCODE"
      },
      {
        "type": "string",
        "unconv_key": "ListAgentMLSID"
      }
    ],
    "cur_data/lst_dte": {
      "type": "date",
      "unconv_key": "LISTDATE"
    },
    "office/id": [
      {
        "type": "string",
        "unconv_key": "LISTOFFICECODE"
      },
      {
        "type": "string",
        "unconv_key": "ListOfficeMLSID"
      }
    ],
    "cur_data/price": [
      {
        "type": "float",
        "unconv_key": "LISTPRICE"
      },
      {
        "type": "float",
        "unconv_key": "ListPrice"
      }
    ],
    "mls_id": [
      {
        "type": "string",
        "unconv_key": "MLSNUMBER"
      },
      {
        "type": "string",
        "unconv_key": "MLSNumber"
      }
    ],
    "feed_id": {
      "type": "string",
      "unconv_key": "Matrix_Unique_ID"
    },
    "total_photos": [
      {
        "type": "int",
        "unconv_key": "PHOTOCOUNT"
      },
      {
        "type": "int",
        "unconv_key": "PhotoCount"
      }
    ],
    "photos_mod": [
      {
        "type": "string",
        "unconv_key": "PHOTOUPDATEDATE"
      },
      {
        "type": "string",
        "unconv_key": "PhotoModificationTimestamp"
      }
    ],
    "cur_data/prop_type": [
      {
        "type": "string",
        "unconv_key": "PROPTYPE"
      },
      {
        "type": "string",
        "unconv_key": "PropertyType"
      }
    ],
    "cur_data/desc": [
      {
        "type": "string",
        "unconv_key": "PUBLICREMARKS"
      },
      {
        "type": "string",
        "unconv_key": "PublicRemarks"
      }
    ],
    "uncur_data/parking_spaces": {
      "type": "int",
      "unconv_key": "ParkingTotal"
    },
    "uncur_data/pool": {
      "type": "boolean",
      "unconv_key": "PoolYN",
      "true": "1"
    },
    "uncur_data/porch": {
      "type": "string",
      "unconv_key": "PorchType"
    },
    "location/postal": [
      {
        "type": "string",
        "unconv_key": "PostalCode"
      },
      {
        "type": "string",
        "unconv_key": "ZIP5"
      }
    ],
    "uncur_data/road_frontage": [
      {
        "type": "string",
        "unconv_key": "ROAD_FRONTAGE",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      },
      {
        "type": "string",
        "unconv_key": "RoadFrontageType",
        "gsub": {
          "match": ",",
          "replace": ", "
        }
      }
    ],
    "uncur_data/number_of_rooms": {
      "type": "int",
      "unconv_key": "RoomCount"
    },
    "uncur_data/site_description": {
      "type": "string",
      "unconv_key": "SITE_DESC"
    },
    "location/region": [
      {
        "type": "string",
        "unconv_key": "STATE"
      },
      {
        "type": "string",
        "unconv_key": "StateOrProvince"
      }
    ],
    "cur_data/status": [
      {
        "type": "string",
        "unconv_key": "STATUS"
      },
      {
        "type": "string",
        "unconv_key": "Status"
      }
    ],
    "location/street_name": [
      {
        "type": "string",
        "unconv_key": "STREETNAME",
        "suffix_with": "STREET_TYPE"
      },
      {
        "type": "string",
        "unconv_key": "StreetName",
        "suffix_with": "StreetSuffix"
      }
    ],
    "location/street_number": [
      {
        "type": "string",
        "unconv_key": "STREETNUMBER"
      },
      {
        "type": "string",
        "unconv_key": "StreetNumber"
      }
    ],
    "location/street_direction": {
      "type": "string",
      "unconv_key": "STREET_DIR"
    },
    "cur_data/style": {
      "type": "string",
      "unconv_key": "STYLE"
    },
    "location/neighborhood": [
      {
        "type": "string",
        "unconv_key": "SUBDIVISIONNAME"
      },
      {
        "type": "string",
        "unconv_key": "SubdivisionName"
      }
    ],
    "uncur_data/summer_tax": [
      {
        "type": "float",
        "unconv_key": "SUMMERTAX"
      },
      {
        "type": "float",
        "unconv_key": "TaxAmountSummer"
      }
    ],
    "cur_data/sch_dist": {
      "type": "string",
      "unconv_key": "SchoolDistrict"
    },
    "uncur_data/sewer": {
      "type": "string",
      "unconv_key": "Sewer"
    },
    "cur_data/sqft": [
      {
        "type": "float",
        "unconv_key": "TOT_SQUARE_FEET"
      },
      {
        "type": "float",
        "unconv_key": "sqftTotal"
      }
    ],
    "uncur_data/winter_tax": [
      {
        "type": "float",
        "unconv_key": "TaxAmountWinter"
      },
      {
        "type": "float",
        "unconv_key": "WINTER_TAX"
      }
    ],
    "compound_type": {
      "type": "option",
      "unconv_key": "TransactionType",
      "value_map": {
        "lease": "res_rental"
      }
    },
    "location/unit": [
      {
        "type": "string",
        "unconv_key": "UNITNUMBER"
      },
      {
        "type": "string",
        "unconv_key": "UnitNumber"
      }
    ],
    "last_mod": {
      "type": "string",
      "unconv_key": "UPDATE_DATE"
    },
    "uncur_data/water_fac": {
      "type": "string",
      "unconv_key": "WATER_FAC"
    },
    "uncur_data/water_heater": [
      {
        "type": "string",
        "unconv_key": "WATER_HEATER"
      },
      {
        "type": "string",
        "unconv_key": "WaterHeaterFuel"
      }
    ],
    "uncur_data/water_name": {
      "type": "string",
      "unconv_key": "WATER_NAME"
    },
    "uncur_data/water_sewer": {
      "type": "string",
      "unconv_key": "WATER_SEWER"
    },
    "uncur_data/water": {
      "type": "string",
      "unconv_key": "WaterSource"
    },
    "cur_data/year_blt": [
      {
        "type": "int",
        "unconv_key": "YEAR_BUILT"
      },
      {
        "type": "int",
        "unconv_key": "YearBuilt"
      }
    ],
    "uncur_data/originating_mls": {
      "type": "string",
      "unconv_key": "MLS"
    },
    "agent/full_name": {
      "type": "string",
      "unconv_key": "ListAgentFullName"
    },
    "agent/email": {
      "type": "string",
      "unconv_key": "ListAgentEmail"
    },
    "agent/phone": {
      "type": "string",
      "unconv_key": "ListAgentDirectWorkPhone"
    },
    "office/name": {
      "type": "string",
      "unconv_key": "ListOfficeName"
    },
    "office/phone": {
      "type": "string",
      "unconv_key": "ListOfficePhone"
    }
  },
  "office": {
    "email": {
      "type": "string",
      "unconv_key": "Email"
    },
    "id": {
      "type": "string",
      "unconv_key": "MLSID"
    },
    "name": {
      "type": "string",
      "unconv_key": "OfficeName"
    },
    "phone": {
      "type": "string",
      "unconv_key": "Phone"
    }
  }
}