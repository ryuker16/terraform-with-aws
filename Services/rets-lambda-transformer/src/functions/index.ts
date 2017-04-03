import titleize from './titleize'
import gsub from './findReplace'
import downcase from './downcase'
import split_baths from './splitBaths'
import value_map from './valueMap'
import concat from './concat'
import suffix_with from './suffixWith'
import split_sqft_range from './splitSqftRange'
import normalize_phone from './normalizePhone'
import country_abbreviation_lookup from './countryAbbreviationLookup'
import state_abbreviation_lookup from './stateAbbreviationLookup'
import desc_redaction from './descRedaction'
import true_mapper from './trueMapper'
import normalize_images from './normalizeImages'
import set_deleted_at from './setDeletedAt'
import set_status from './setStatus'
import { TransformerFactory } from '../lib/documentTransformer'

const transformers = {
  titleize,
  gsub,
  downcase,
  split_baths,
  value_map,
  concat,
  suffix_with,
  split_sqft_range,
  normalize_phone,
  country_abbreviation_lookup,
  state_abbreviation_lookup,
  desc_redaction,
  true_mapper,
  normalize_images,
  set_deleted_at,
  set_status
} as { [key: string]: TransformerFactory }

export = transformers
