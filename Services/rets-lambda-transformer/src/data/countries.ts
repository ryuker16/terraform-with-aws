import { Dictionary } from 'lodash'

const countries: Dictionary<string> = {
  'Andorra': 'ad'
  ,

  'United Arab Emirates': 'ae'
  ,

  'Afghanistan': 'af'
  ,

  'Antigua and Barbuda': 'ag'
  ,

  'Anguilla': 'ai'
  ,

  'Albania': 'al'
  ,

  'Armenia': 'am'
  ,

  'Angola': 'ao'
  ,

  'Antarctica': 'aq'
  ,

  'Argentina': 'ar'
  ,

  'American Samoa': 'as'
  ,

  'Austria': 'at'
  ,

  'Australia': 'au'
  ,

  'Aruba': 'aw'
  ,

  'Aland': 'ax'
  ,

  'Aland Islands': 'ax'
  ,

  'Azerbaijan': 'az'
  ,

  'Bosnia and Herzegovina': 'ba'
  ,

  'Barbados': 'bb'
  ,

  'Bangladesh': 'bd'
  ,

  'Belgium': 'be'
  ,

  'Burkina Faso': 'bf'
  ,

  'Bulgaria': 'bg'
  ,

  'Bahrain': 'bh'
  ,

  'Burundi': 'bi'
  ,

  'Benin': 'bj'
  ,

  'Saint Barthalemy': 'bl'
  ,

  'Bermuda': 'bm'
  ,

  'Brunei': 'bn'
  ,

  'Brunei Darussalam': 'bn'
  ,

  'Bolivia': 'bo'
  ,

  'Bonaire': 'bq'
  ,

  'Brazil': 'br'
  ,

  'Bahamas': 'bs'
  ,

  'Bhutan': 'bt'
  ,

  'Bouvet Island': 'bv'
  ,

  'Botswana': 'bw'
  ,

  'Belarus': 'by'
  ,

  'Belize': 'bz'
  ,

  'Canada': 'ca'
  ,

  'Cocos (Keeling) Islands': 'cc'
  ,

  'Democratic Republic of the Congo': 'cd'
  ,

  'Central African Republic': 'cf'
  ,

  'Republic of the Congo': 'cg'
  ,

  'Congo': 'cg'
  ,

  'Switzerland': 'ch'
  ,

  'Cote dIvoire': 'ci'
  ,

  'Cook Islands': 'ck'
  ,

  'Chile': 'cl'
  ,

  'Cameroon': 'cm'
  ,

  'China': 'cn'
  ,

  'Colombia': 'co'
  ,

  'Costa Rica': 'cr'
  ,

  'Cuba': 'cu'
  ,

  'Cape Verde': 'cv'
  ,

  'Curacao': 'cw'
  ,

  'Christmas Island': 'cx'
  ,

  'Cyprus': 'cy'
  ,

  'Czech Republic': 'cz'
  ,

  'Germany': 'de'
  ,

  'Djibouti': 'dj'
  ,

  'Denmark': 'dk'
  ,

  'Dominica': 'dm'
  ,

  'Dominican Republic': 'do'
  ,

  'Algeria': 'dz'
  ,

  'Ecuador': 'ec'
  ,

  'Estonia': 'ee'
  ,

  'Egypt': 'eg'
  ,

  'Western Sahara': 'eh'
  ,

  'Eritrea': 'er'
  ,

  'Spain': 'es'
  ,

  'Ethiopia': 'et'
  ,

  'Finland': 'fi'
  ,

  'Fiji': 'fj'
  ,

  'Falkland Islands': 'fk'
  ,

  'Federated States of Micronesia': 'fm'
  ,

  'Micronesia': 'fm'
  ,

  'Faroe Islands': 'fo'
  ,

  'France': 'fr'
  ,

  'Gabon': 'ga'
  ,

  'United Kingdom': 'gb'
  ,

  'Grenada': 'gd'
  ,

  'Georgia': 'ge'
  ,

  'French Guiana': 'gf'
  ,

  'Guernsey': 'gg'
  ,

  'Ghana': 'gh'
  ,

  'Gibraltar': 'gi'
  ,

  'Greenland': 'gl'
  ,

  'Gambia': 'gm'
  ,

  'Guinea': 'gn'
  ,

  'Guadeloupe': 'gp'
  ,

  'Equatorial Guinea': 'gq'
  ,

  'Greece': 'gr'
  ,

  'South Georgia and the South Sandwich Islands': 'gs'
  ,

  'Guatemala': 'gt'
  ,

  'Guam': 'gu'
  ,

  'Guinea-Bissau': 'gw'
  ,

  'Guyana': 'gy'
  ,

  'Hong Kong': 'hk'
  ,

  'Heard Island and McDonald Islands': 'hm'
  ,

  'Honduras': 'hn'
  ,

  'Croatia': 'hr'
  ,

  'Haiti': 'ht'
  ,

  'Hungary': 'hu'
  ,

  'Indonesia': 'id'
  ,

  'Ireland': 'ie'
  ,

  'Israel': 'il'
  ,

  'Isle of Man': 'im'
  ,

  'India': 'in'
  ,

  'British Indian Ocean Territory': 'io'
  ,

  'Iraq': 'iq'
  ,

  'Iran': 'ir'
  ,

  'Iceland': 'is'
  ,

  'Italy': 'it'
  ,

  'Jersey': 'je'
  ,

  'Jamaica': 'jm'
  ,

  'Jordan': 'jo'
  ,

  'Japan': 'jp'
  ,

  'Kenya': 'ke'
  ,

  'Kyrgyzstan': 'kg'
  ,

  'Cambodia': 'kh'
  ,

  'Kiribati': 'ki'
  ,

  'Comoros': 'km'
  ,

  'Saint Kitts and Nevis': 'kn'
  ,

  'North Korea': 'kp'
  ,

  'South Korea': 'kr'
  ,

  'Kuwait': 'kw'
  ,

  'Cayman Islands': 'ky'
  ,

  'Kazakhstan': 'kz'
  ,

  'Laos': 'la'
  ,

  'Lebanon': 'lb'
  ,

  'Saint Lucia': 'lc'
  ,

  'Liechtenstein': 'li'
  ,

  'Sri Lanka': 'lk'
  ,

  'Liberia': 'lr'
  ,

  'Lesotho': 'ls'
  ,

  'Lithuania': 'lt'
  ,

  'Luxembourg': 'lu'
  ,

  'Latvia': 'lv'
  ,

  'Libya': 'ly'
  ,

  'Morocco': 'ma'
  ,

  'Monaco': 'mc'
  ,

  'Moldova': 'md'
  ,

  'Montenegro': 'me'
  ,

  'Saint Martin': 'mf'
  ,

  'Madagascar': 'mg'
  ,

  'Marshall Islands': 'mh'
  ,

  'Macedonia': 'mk'
  ,

  'Mali': 'ml'
  ,

  'Myanmar': 'mm'
  ,

  'Mongolia': 'mn'
  ,

  'Macao': 'mo'
  ,

  'Macau': 'mo'
  ,

  'Northern Mariana Islands': 'mp'
  ,

  'Martinique': 'mq'
  ,

  'Mauritania': 'mr'
  ,

  'Montserrat': 'ms'
  ,

  'Malta': 'mt'
  ,

  'Mauritius': 'mu'
  ,

  'Maldives': 'mv'
  ,

  'Malawi': 'mw'
  ,

  'Mexico': 'mx'
  ,

  'Malaysia': 'my'
  ,

  'Mozambique': 'mz'
  ,

  'Namibia': 'na'
  ,

  'New Caledonia': 'nc'
  ,

  'Niger': 'ne'
  ,

  'Norfolk Island': 'nf'
  ,

  'Nigeria': 'ng'
  ,

  'Nicaragua': 'ni'
  ,

  'Netherlands': 'nl'
  ,

  'Norway': 'no'
  ,

  'Nepal': 'np'
  ,

  'Nauru': 'nr'
  ,

  'Niue': 'nu'
  ,

  'New Zealand': 'nz'
  ,

  'Oman': 'om'
  ,

  'Panama': 'pa'
  ,

  'Peru': 'pe'
  ,

  'French Polynesia': 'pf'
  ,

  'Papua New Guinea': 'pg'
  ,

  'Philippines': 'ph'
  ,

  'Pakistan': 'pk'
  ,

  'Poland': 'pl'
  ,

  'Saint Pierre and Miquelon': 'pm'
  ,

  'Saint-Pierre and Miquelon': 'pm'
  ,

  'Pitcairn Islands': 'pn'
  ,

  'Pitcairn': 'pn'
  ,

  'Puerto Rico': 'pr'
  ,

  'Palestine': 'ps'
  ,

  'Portugal': 'pt'
  ,

  'Palau': 'pw'
  ,

  'Paraguay': 'py'
  ,

  'Qatar': 'qa'
  ,

  'Reunion': 're'
  ,

  'Romania': 'ro'
  ,

  'Serbia': 'rs'
  ,

  'Russia': 'ru'
  ,

  'Rwanda': 'rw'
  ,

  'Saudi Arabia': 'sa'
  ,

  'Solomon Islands': 'sb'
  ,

  'Seychelles': 'sc'
  ,

  'Sudan': 'sd'
  ,

  'Sweden': 'se'
  ,

  'Singapore': 'sg'
  ,

  'Saint Helena': 'sh'
  ,

  'Slovenia': 'si'
  ,

  'Svalbard and Jan Mayen': 'sj'
  ,

  'Slovakia': 'sk'
  ,

  'Sierra Leone': 'sl'
  ,

  'San Marino': 'sm'
  ,

  'Senegal': 'sn'
  ,

  'Somalia': 'so'
  ,

  'Suriname': 'sr'
  ,

  'South Sudan': 'ss'
  ,

  'Sao Tome and Principe': 'st'
  ,

  'El Salvador': 'sv'
  ,

  'Sint Maarten': 'sx'
  ,

  'Syria': 'sy'
  ,

  'Swaziland': 'sz'
  ,

  'Turks and Caicos Islands': 'tc'
  ,

  'Chad': 'td'
  ,

  'French Southern Territories': 'tf'
  ,

  'Togo': 'tg'
  ,

  'Thailand': 'th'
  ,

  'Tajikistan': 'tj'
  ,

  'Tokelau': 'tk'
  ,

  'East Timor': 'tl'
  ,

  'Timor-Leste': 'tl'
  ,

  'Turkmenistan': 'tm'
  ,

  'Tunisia': 'tn'
  ,

  'Tonga': 'to'
  ,

  'Turkey': 'tr'
  ,

  'Trinidad and Tobago': 'tt'
  ,

  'Tuvalu': 'tv'
  ,

  'Taiwan': 'tw'
  ,

  'Tanzania': 'tz'
  ,

  'Ukraine': 'ua'
  ,

  'Uganda': 'ug'
  ,

  'United States Minor Outlying Islands': 'um'
  ,

  'United States': 'us'
  ,

  'United States of America': 'us'
  ,

  'Uruguay': 'uy'
  ,

  'Uzbekistan': 'uz'
  ,

  'Vatican City': 'va'
  ,

  'Saint Vincent and the Grenadines': 'vc'
  ,

  'Venezuela': 've'
  ,

  'British Virgin Islands': 'vg'
  ,

  'United States Virgin Islands': 'vi'
  ,

  'US Virgin Islands': 'vi'
  ,

  'Viet Nam': 'vn'
  ,

  'Vietnam': 'vn'
  ,

  'Vanuatu': 'vu'
  ,

  'Wallis and Futuna': 'wf'
  ,

  'Samoa': 'ws'
  ,

  'Yemen': 'ye'
  ,

  'Mayotte': 'yt'
  ,

  'South Africa': 'za'
  ,

  'Zambia': 'zm'
  ,

  'Zimbabwe': 'zw'
}
export = countries
