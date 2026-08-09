
/**
 * Country reference metadata: ISO 3166-1 alpha-2/alpha-3/numeric codes,
 * display name, and region, for a complete practical country catalogue
 * (all UN member states plus Palestine, Taiwan, and Vatican City).
 *
 * This is precise, unambiguous lookup-table data (ISO 3166-1 codes are a
 * published standard, not something approximated or invented) — separate
 * entirely from the *geographic boundary* data used to draw the map,
 * which comes from the `world-atlas` package (see frontend's map
 * documentation for source/license details).
 *
 * `isoNumeric` is the ISO 3166-1 numeric code as a string, which is also
 * the feature `id` used by the `world-atlas` TopoJSON (`countries-110m`)
 * — this is the "map feature ID mapping" that lets the frontend join
 * news/country data to map geometry without fragile name matching.
 */
export interface CountryMeta {
  iso2: string;
  iso3: string;
  isoNumeric: string;
  name: string;
  region: string;
}

export const COUNTRIES: CountryMeta[] = [
  { iso2: 'US', iso3: 'USA', isoNumeric: '840', name: 'United States', region: 'Americas' },
  { iso2: 'CA', iso3: 'CAN', isoNumeric: '124', name: 'Canada', region: 'Americas' },
  { iso2: 'MX', iso3: 'MEX', isoNumeric: '484', name: 'Mexico', region: 'Americas' },
  { iso2: 'BR', iso3: 'BRA', isoNumeric: '076', name: 'Brazil', region: 'Americas' },
  { iso2: 'AR', iso3: 'ARG', isoNumeric: '032', name: 'Argentina', region: 'Americas' },
  { iso2: 'CL', iso3: 'CHL', isoNumeric: '152', name: 'Chile', region: 'Americas' },
  { iso2: 'CO', iso3: 'COL', isoNumeric: '170', name: 'Colombia', region: 'Americas' },
  { iso2: 'PE', iso3: 'PER', isoNumeric: '604', name: 'Peru', region: 'Americas' },
  { iso2: 'VE', iso3: 'VEN', isoNumeric: '862', name: 'Venezuela', region: 'Americas' },
  { iso2: 'CU', iso3: 'CUB', isoNumeric: '192', name: 'Cuba', region: 'Americas' },
  { iso2: 'GT', iso3: 'GTM', isoNumeric: '320', name: 'Guatemala', region: 'Americas' },
  { iso2: 'BZ', iso3: 'BLZ', isoNumeric: '084', name: 'Belize', region: 'Americas' },
  { iso2: 'HN', iso3: 'HND', isoNumeric: '340', name: 'Honduras', region: 'Americas' },
  { iso2: 'SV', iso3: 'SLV', isoNumeric: '222', name: 'El Salvador', region: 'Americas' },
  { iso2: 'NI', iso3: 'NIC', isoNumeric: '558', name: 'Nicaragua', region: 'Americas' },
  { iso2: 'CR', iso3: 'CRI', isoNumeric: '188', name: 'Costa Rica', region: 'Americas' },
  { iso2: 'PA', iso3: 'PAN', isoNumeric: '591', name: 'Panama', region: 'Americas' },
  { iso2: 'BS', iso3: 'BHS', isoNumeric: '044', name: 'Bahamas', region: 'Americas' },
  { iso2: 'JM', iso3: 'JAM', isoNumeric: '388', name: 'Jamaica', region: 'Americas' },
  { iso2: 'HT', iso3: 'HTI', isoNumeric: '332', name: 'Haiti', region: 'Americas' },
  { iso2: 'DO', iso3: 'DOM', isoNumeric: '214', name: 'Dominican Republic', region: 'Americas' },
  { iso2: 'TT', iso3: 'TTO', isoNumeric: '780', name: 'Trinidad and Tobago', region: 'Americas' },
  { iso2: 'BB', iso3: 'BRB', isoNumeric: '052', name: 'Barbados', region: 'Americas' },
  { iso2: 'GD', iso3: 'GRD', isoNumeric: '308', name: 'Grenada', region: 'Americas' },
  { iso2: 'LC', iso3: 'LCA', isoNumeric: '662', name: 'Saint Lucia', region: 'Americas' },
  { iso2: 'VC', iso3: 'VCT', isoNumeric: '670', name: 'Saint Vincent and the Grenadines', region: 'Americas' },
  { iso2: 'AG', iso3: 'ATG', isoNumeric: '028', name: 'Antigua and Barbuda', region: 'Americas' },
  { iso2: 'KN', iso3: 'KNA', isoNumeric: '659', name: 'Saint Kitts and Nevis', region: 'Americas' },
  { iso2: 'DM', iso3: 'DMA', isoNumeric: '212', name: 'Dominica', region: 'Americas' },
  { iso2: 'EC', iso3: 'ECU', isoNumeric: '218', name: 'Ecuador', region: 'Americas' },
  { iso2: 'BO', iso3: 'BOL', isoNumeric: '068', name: 'Bolivia', region: 'Americas' },
  { iso2: 'PY', iso3: 'PRY', isoNumeric: '600', name: 'Paraguay', region: 'Americas' },
  { iso2: 'UY', iso3: 'URY', isoNumeric: '858', name: 'Uruguay', region: 'Americas' },
  { iso2: 'GY', iso3: 'GUY', isoNumeric: '328', name: 'Guyana', region: 'Americas' },
  { iso2: 'SR', iso3: 'SUR', isoNumeric: '740', name: 'Suriname', region: 'Americas' },

  { iso2: 'GB', iso3: 'GBR', isoNumeric: '826', name: 'United Kingdom', region: 'Europe' },
  { iso2: 'IE', iso3: 'IRL', isoNumeric: '372', name: 'Ireland', region: 'Europe' },
  { iso2: 'FR', iso3: 'FRA', isoNumeric: '250', name: 'France', region: 'Europe' },
  { iso2: 'DE', iso3: 'DEU', isoNumeric: '276', name: 'Germany', region: 'Europe' },
  { iso2: 'ES', iso3: 'ESP', isoNumeric: '724', name: 'Spain', region: 'Europe' },
  { iso2: 'PT', iso3: 'PRT', isoNumeric: '620', name: 'Portugal', region: 'Europe' },
  { iso2: 'IT', iso3: 'ITA', isoNumeric: '380', name: 'Italy', region: 'Europe' },
  { iso2: 'NL', iso3: 'NLD', isoNumeric: '528', name: 'Netherlands', region: 'Europe' },
  { iso2: 'BE', iso3: 'BEL', isoNumeric: '056', name: 'Belgium', region: 'Europe' },
  { iso2: 'CH', iso3: 'CHE', isoNumeric: '756', name: 'Switzerland', region: 'Europe' },
  { iso2: 'AT', iso3: 'AUT', isoNumeric: '040', name: 'Austria', region: 'Europe' },
  { iso2: 'SE', iso3: 'SWE', isoNumeric: '752', name: 'Sweden', region: 'Europe' },
  { iso2: 'NO', iso3: 'NOR', isoNumeric: '578', name: 'Norway', region: 'Europe' },
  { iso2: 'DK', iso3: 'DNK', isoNumeric: '208', name: 'Denmark', region: 'Europe' },
  { iso2: 'FI', iso3: 'FIN', isoNumeric: '246', name: 'Finland', region: 'Europe' },
  { iso2: 'PL', iso3: 'POL', isoNumeric: '616', name: 'Poland', region: 'Europe' },
  { iso2: 'UA', iso3: 'UKR', isoNumeric: '804', name: 'Ukraine', region: 'Europe' },
  { iso2: 'RO', iso3: 'ROU', isoNumeric: '642', name: 'Romania', region: 'Europe' },
  { iso2: 'GR', iso3: 'GRC', isoNumeric: '300', name: 'Greece', region: 'Europe' },
  { iso2: 'CZ', iso3: 'CZE', isoNumeric: '203', name: 'Czechia', region: 'Europe' },
  { iso2: 'HU', iso3: 'HUN', isoNumeric: '348', name: 'Hungary', region: 'Europe' },
  { iso2: 'RS', iso3: 'SRB', isoNumeric: '688', name: 'Serbia', region: 'Europe' },
  { iso2: 'HR', iso3: 'HRV', isoNumeric: '191', name: 'Croatia', region: 'Europe' },
  { iso2: 'RU', iso3: 'RUS', isoNumeric: '643', name: 'Russia', region: 'Europe' },
  { iso2: 'IS', iso3: 'ISL', isoNumeric: '352', name: 'Iceland', region: 'Europe' },
  { iso2: 'LU', iso3: 'LUX', isoNumeric: '442', name: 'Luxembourg', region: 'Europe' },
  { iso2: 'MT', iso3: 'MLT', isoNumeric: '470', name: 'Malta', region: 'Europe' },
  { iso2: 'CY', iso3: 'CYP', isoNumeric: '196', name: 'Cyprus', region: 'Europe' },
  { iso2: 'SK', iso3: 'SVK', isoNumeric: '703', name: 'Slovakia', region: 'Europe' },
  { iso2: 'SI', iso3: 'SVN', isoNumeric: '705', name: 'Slovenia', region: 'Europe' },
  { iso2: 'BG', iso3: 'BGR', isoNumeric: '100', name: 'Bulgaria', region: 'Europe' },
  { iso2: 'AL', iso3: 'ALB', isoNumeric: '008', name: 'Albania', region: 'Europe' },
  { iso2: 'MK', iso3: 'MKD', isoNumeric: '807', name: 'North Macedonia', region: 'Europe' },
  { iso2: 'ME', iso3: 'MNE', isoNumeric: '499', name: 'Montenegro', region: 'Europe' },
  { iso2: 'BA', iso3: 'BIH', isoNumeric: '070', name: 'Bosnia and Herzegovina', region: 'Europe' },
  { iso2: 'MD', iso3: 'MDA', isoNumeric: '498', name: 'Moldova', region: 'Europe' },
  { iso2: 'BY', iso3: 'BLR', isoNumeric: '112', name: 'Belarus', region: 'Europe' },
  { iso2: 'LT', iso3: 'LTU', isoNumeric: '440', name: 'Lithuania', region: 'Europe' },
  { iso2: 'LV', iso3: 'LVA', isoNumeric: '428', name: 'Latvia', region: 'Europe' },
  { iso2: 'EE', iso3: 'EST', isoNumeric: '233', name: 'Estonia', region: 'Europe' },
  { iso2: 'AD', iso3: 'AND', isoNumeric: '020', name: 'Andorra', region: 'Europe' },
  { iso2: 'MC', iso3: 'MCO', isoNumeric: '492', name: 'Monaco', region: 'Europe' },
  { iso2: 'SM', iso3: 'SMR', isoNumeric: '674', name: 'San Marino', region: 'Europe' },
  { iso2: 'LI', iso3: 'LIE', isoNumeric: '438', name: 'Liechtenstein', region: 'Europe' },
  { iso2: 'VA', iso3: 'VAT', isoNumeric: '336', name: 'Vatican City', region: 'Europe' },

  { iso2: 'CN', iso3: 'CHN', isoNumeric: '156', name: 'China', region: 'Asia' },
  { iso2: 'JP', iso3: 'JPN', isoNumeric: '392', name: 'Japan', region: 'Asia' },
  { iso2: 'KR', iso3: 'KOR', isoNumeric: '410', name: 'South Korea', region: 'Asia' },
  { iso2: 'KP', iso3: 'PRK', isoNumeric: '408', name: 'North Korea', region: 'Asia' },
  { iso2: 'IN', iso3: 'IND', isoNumeric: '356', name: 'India', region: 'Asia' },
  { iso2: 'PK', iso3: 'PAK', isoNumeric: '586', name: 'Pakistan', region: 'Asia' },
  { iso2: 'BD', iso3: 'BGD', isoNumeric: '050', name: 'Bangladesh', region: 'Asia' },

  { iso2: 'ID', iso3: 'IDN', isoNumeric: '360', name: 'Indonesia', region: 'Asia' },
  { iso2: 'PH', iso3: 'PHL', isoNumeric: '608', name: 'Philippines', region: 'Asia' },
  { iso2: 'VN', iso3: 'VNM', isoNumeric: '704', name: 'Vietnam', region: 'Asia' },
  { iso2: 'TH', iso3: 'THA', isoNumeric: '764', name: 'Thailand', region: 'Asia' },
  { iso2: 'MY', iso3: 'MYS', isoNumeric: '458', name: 'Malaysia', region: 'Asia' },
  { iso2: 'SG', iso3: 'SGP', isoNumeric: '702', name: 'Singapore', region: 'Asia' },
  { iso2: 'TW', iso3: 'TWN', isoNumeric: '158', name: 'Taiwan', region: 'Asia' },
  { iso2: 'AF', iso3: 'AFG', isoNumeric: '004', name: 'Afghanistan', region: 'Asia' },
  { iso2: 'IR', iso3: 'IRN', isoNumeric: '364', name: 'Iran', region: 'Asia' },
  { iso2: 'IQ', iso3: 'IRQ', isoNumeric: '368', name: 'Iraq', region: 'Asia' },
  { iso2: 'SY', iso3: 'SYR', isoNumeric: '760', name: 'Syria', region: 'Asia' },
  { iso2: 'IL', iso3: 'ISR', isoNumeric: '376', name: 'Israel', region: 'Asia' },
  { iso2: 'PS', iso3: 'PSE', isoNumeric: '275', name: 'Palestine', region: 'Asia' },
  { iso2: 'SA', iso3: 'SAU', isoNumeric: '682', name: 'Saudi Arabia', region: 'Asia' },
  { iso2: 'AE', iso3: 'ARE', isoNumeric: '784', name: 'United Arab Emirates', region: 'Asia' },
  { iso2: 'QA', iso3: 'QAT', isoNumeric: '634', name: 'Qatar', region: 'Asia' },
  { iso2: 'JO', iso3: 'JOR', isoNumeric: '400', name: 'Jordan', region: 'Asia' },
  { iso2: 'LB', iso3: 'LBN', isoNumeric: '422', name: 'Lebanon', region: 'Asia' },
  { iso2: 'YE', iso3: 'YEM', isoNumeric: '887', name: 'Yemen', region: 'Asia' },
  { iso2: 'TR', iso3: 'TUR', isoNumeric: '792', name: 'Turkey', region: 'Asia' },
  { iso2: 'GE', iso3: 'GEO', isoNumeric: '268', name: 'Georgia', region: 'Asia' },
  { iso2: 'AM', iso3: 'ARM', isoNumeric: '051', name: 'Armenia', region: 'Asia' },
  { iso2: 'AZ', iso3: 'AZE', isoNumeric: '031', name: 'Azerbaijan', region: 'Asia' },
  { iso2: 'KZ', iso3: 'KAZ', isoNumeric: '398', name: 'Kazakhstan', region: 'Asia' },
  { iso2: 'NP', iso3: 'NPL', isoNumeric: '524', name: 'Nepal', region: 'Asia' },
  { iso2: 'BT', iso3: 'BTN', isoNumeric: '064', name: 'Bhutan', region: 'Asia' },
  { iso2: 'LK', iso3: 'LKA', isoNumeric: '144', name: 'Sri Lanka', region: 'Asia' },
  { iso2: 'MM', iso3: 'MMR', isoNumeric: '104', name: 'Myanmar', region: 'Asia' },
  { iso2: 'LA', iso3: 'LAO', isoNumeric: '418', name: 'Laos', region: 'Asia' },
  { iso2: 'KH', iso3: 'KHM', isoNumeric: '116', name: 'Cambodia', region: 'Asia' },
  { iso2: 'BN', iso3: 'BRN', isoNumeric: '096', name: 'Brunei', region: 'Asia' },
  { iso2: 'TL', iso3: 'TLS', isoNumeric: '626', name: 'Timor-Leste', region: 'Asia' },
  { iso2: 'MN', iso3: 'MNG', isoNumeric: '496', name: 'Mongolia', region: 'Asia' },
  { iso2: 'UZ', iso3: 'UZB', isoNumeric: '860', name: 'Uzbekistan', region: 'Asia' },
  { iso2: 'TM', iso3: 'TKM', isoNumeric: '795', name: 'Turkmenistan', region: 'Asia' },
  { iso2: 'TJ', iso3: 'TJK', isoNumeric: '762', name: 'Tajikistan', region: 'Asia' },
  { iso2: 'KG', iso3: 'KGZ', isoNumeric: '417', name: 'Kyrgyzstan', region: 'Asia' },
  { iso2: 'KW', iso3: 'KWT', isoNumeric: '414', name: 'Kuwait', region: 'Asia' },
  { iso2: 'BH', iso3: 'BHR', isoNumeric: '048', name: 'Bahrain', region: 'Asia' },
  { iso2: 'OM', iso3: 'OMN', isoNumeric: '512', name: 'Oman', region: 'Asia' },
  { iso2: 'MV', iso3: 'MDV', isoNumeric: '462', name: 'Maldives', region: 'Asia' },

  { iso2: 'EG', iso3: 'EGY', isoNumeric: '818', name: 'Egypt', region: 'Africa' },
  { iso2: 'LY', iso3: 'LBY', isoNumeric: '434', name: 'Libya', region: 'Africa' },
  { iso2: 'MA', iso3: 'MAR', isoNumeric: '504', name: 'Morocco', region: 'Africa' },
  { iso2: 'DZ', iso3: 'DZA', isoNumeric: '012', name: 'Algeria', region: 'Africa' },
  { iso2: 'TN', iso3: 'TUN', isoNumeric: '788', name: 'Tunisia', region: 'Africa' },
  { iso2: 'SD', iso3: 'SDN', isoNumeric: '729', name: 'Sudan', region: 'Africa' },
  { iso2: 'SS', iso3: 'SSD', isoNumeric: '728', name: 'South Sudan', region: 'Africa' },
  { iso2: 'ET', iso3: 'ETH', isoNumeric: '231', name: 'Ethiopia', region: 'Africa' },
  { iso2: 'SO', iso3: 'SOM', isoNumeric: '706', name: 'Somalia', region: 'Africa' },
  { iso2: 'KE', iso3: 'KEN', isoNumeric: '404', name: 'Kenya', region: 'Africa' },
  { iso2: 'TZ', iso3: 'TZA', isoNumeric: '834', name: 'Tanzania', region: 'Africa' },
  { iso2: 'UG', iso3: 'UGA', isoNumeric: '800', name: 'Uganda', region: 'Africa' },
  { iso2: 'NG', iso3: 'NGA', isoNumeric: '566', name: 'Nigeria', region: 'Africa' },
  { iso2: 'GH', iso3: 'GHA', isoNumeric: '288', name: 'Ghana', region: 'Africa' },
  { iso2: 'CI', iso3: 'CIV', isoNumeric: '384', name: "Cote d'Ivoire", region: 'Africa' },
  { iso2: 'SN', iso3: 'SEN', isoNumeric: '686', name: 'Senegal', region: 'Africa' },
  { iso2: 'ML', iso3: 'MLI', isoNumeric: '466', name: 'Mali', region: 'Africa' },
  { iso2: 'NE', iso3: 'NER', isoNumeric: '562', name: 'Niger', region: 'Africa' },
  { iso2: 'TD', iso3: 'TCD', isoNumeric: '148', name: 'Chad', region: 'Africa' },
  { iso2: 'CM', iso3: 'CMR', isoNumeric: '120', name: 'Cameroon', region: 'Africa' },
  { iso2: 'CD', iso3: 'COD', isoNumeric: '180', name: 'DR Congo', region: 'Africa' },
  { iso2: 'AO', iso3: 'AGO', isoNumeric: '024', name: 'Angola', region: 'Africa' },
  { iso2: 'ZM', iso3: 'ZMB', isoNumeric: '894', name: 'Zambia', region: 'Africa' },
  { iso2: 'ZW', iso3: 'ZWE', isoNumeric: '716', name: 'Zimbabwe', region: 'Africa' },
  { iso2: 'MZ', iso3: 'MOZ', isoNumeric: '508', name: 'Mozambique', region: 'Africa' },
  { iso2: 'ZA', iso3: 'ZAF', isoNumeric: '710', name: 'South Africa', region: 'Africa' },
  { iso2: 'NA', iso3: 'NAM', isoNumeric: '516', name: 'Namibia', region: 'Africa' },
  { iso2: 'RW', iso3: 'RWA', isoNumeric: '646', name: 'Rwanda', region: 'Africa' },
  { iso2: 'MR', iso3: 'MRT', isoNumeric: '478', name: 'Mauritania', region: 'Africa' },
  { iso2: 'GM', iso3: 'GMB', isoNumeric: '270', name: 'Gambia', region: 'Africa' },
  { iso2: 'GW', iso3: 'GNB', isoNumeric: '624', name: 'Guinea-Bissau', region: 'Africa' },
  { iso2: 'GN', iso3: 'GIN', isoNumeric: '324', name: 'Guinea', region: 'Africa' },
  { iso2: 'SL', iso3: 'SLE', isoNumeric: '694', name: 'Sierra Leone', region: 'Africa' },
  { iso2: 'LR', iso3: 'LBR', isoNumeric: '430', name: 'Liberia', region: 'Africa' },
  { iso2: 'BF', iso3: 'BFA', isoNumeric: '854', name: 'Burkina Faso', region: 'Africa' },
  { iso2: 'TG', iso3: 'TGO', isoNumeric: '768', name: 'Togo', region: 'Africa' },
  { iso2: 'BJ', iso3: 'BEN', isoNumeric: '204', name: 'Benin', region: 'Africa' },
  { iso2: 'GA', iso3: 'GAB', isoNumeric: '266', name: 'Gabon', region: 'Africa' },
  { iso2: 'CG', iso3: 'COG', isoNumeric: '178', name: 'Congo', region: 'Africa' },
  { iso2: 'CF', iso3: 'CAF', isoNumeric: '140', name: 'Central African Republic', region: 'Africa' },
  { iso2: 'GQ', iso3: 'GNQ', isoNumeric: '226', name: 'Equatorial Guinea', region: 'Africa' },
  { iso2: 'ST', iso3: 'STP', isoNumeric: '678', name: 'Sao Tome and Principe', region: 'Africa' },
  { iso2: 'CV', iso3: 'CPV', isoNumeric: '132', name: 'Cape Verde', region: 'Africa' },
  { iso2: 'DJ', iso3: 'DJI', isoNumeric: '262', name: 'Djibouti', region: 'Africa' },
  { iso2: 'ER', iso3: 'ERI', isoNumeric: '232', name: 'Eritrea', region: 'Africa' },
  { iso2: 'BI', iso3: 'BDI', isoNumeric: '108', name: 'Burundi', region: 'Africa' },
  { iso2: 'MW', iso3: 'MWI', isoNumeric: '454', name: 'Malawi', region: 'Africa' },
  { iso2: 'BW', iso3: 'BWA', isoNumeric: '072', name: 'Botswana', region: 'Africa' },
  { iso2: 'LS', iso3: 'LSO', isoNumeric: '426', name: 'Lesotho', region: 'Africa' },
  { iso2: 'SZ', iso3: 'SWZ', isoNumeric: '748', name: 'Eswatini', region: 'Africa' },
  { iso2: 'KM', iso3: 'COM', isoNumeric: '174', name: 'Comoros', region: 'Africa' },
  { iso2: 'SC', iso3: 'SYC', isoNumeric: '690', name: 'Seychelles', region: 'Africa' },
  { iso2: 'MU', iso3: 'MUS', isoNumeric: '480', name: 'Mauritius', region: 'Africa' },

  { iso2: 'AU', iso3: 'AUS', isoNumeric: '036', name: 'Australia', region: 'Oceania' },
  { iso2: 'NZ', iso3: 'NZL', isoNumeric: '554', name: 'New Zealand', region: 'Oceania' },
  { iso2: 'PG', iso3: 'PNG', isoNumeric: '598', name: 'Papua New Guinea', region: 'Oceania' },
  { iso2: 'FJ', iso3: 'FJI', isoNumeric: '242', name: 'Fiji', region: 'Oceania' },
  { iso2: 'SB', iso3: 'SLB', isoNumeric: '090', name: 'Solomon Islands', region: 'Oceania' },
  { iso2: 'VU', iso3: 'VUT', isoNumeric: '548', name: 'Vanuatu', region: 'Oceania' },
  { iso2: 'WS', iso3: 'WSM', isoNumeric: '882', name: 'Samoa', region: 'Oceania' },
  { iso2: 'TO', iso3: 'TON', isoNumeric: '776', name: 'Tonga', region: 'Oceania' },
  { iso2: 'KI', iso3: 'KIR', isoNumeric: '296', name: 'Kiribati', region: 'Oceania' },
  { iso2: 'FM', iso3: 'FSM', isoNumeric: '583', name: 'Micronesia', region: 'Oceania' },
  { iso2: 'MH', iso3: 'MHL', isoNumeric: '584', name: 'Marshall Islands', region: 'Oceania' },
  { iso2: 'PW', iso3: 'PLW', isoNumeric: '585', name: 'Palau', region: 'Oceania' },
  { iso2: 'NR', iso3: 'NRU', isoNumeric: '520', name: 'Nauru', region: 'Oceania' },
  { iso2: 'TV', iso3: 'TUV', isoNumeric: '798', name: 'Tuvalu', region: 'Oceania' },
];

/**
 * Common names, abbreviations, and colloquialisms that don't match a
 * country's canonical `name`, `iso2`, or `iso3` exactly (those are
 * already handled directly). Keys are lowercase; values are ISO alpha-3
 * codes. This is what lets "USA", "Britain", "England", "DR Congo",
 * "Congo Kinshasa", "UAE", "Czech Republic", "Ivory Coast", "Burma",
 * "Holland", "Macedonia", "Swaziland", "East Timor", "Bosnia",
 * "Congo Brazzaville", or "Vatican" resolve correctly instead of
 * failing to match — see resolveCountryByAnyIdentifier and
 * searchCountriesByName below.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'USA',
  us: 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  uk: 'GBR',
  britain: 'GBR',
  england: 'GBR',
  'great britain': 'GBR',
  'united kingdom': 'GBR',
  'dr congo': 'COD',
  'congo kinshasa': 'COD',
  'democratic republic of the congo': 'COD',
  'south korea': 'KOR',
  'north korea': 'PRK',
  uae: 'ARE',
  'united arab emirates': 'ARE',
  'czech republic': 'CZE',
  czechia: 'CZE',
  russia: 'RUS',
  'russian federation': 'RUS',
  rwanda: 'RWA',
  'ivory coast': 'CIV',
  burma: 'MMR',
  holland: 'NLD',
  macedonia: 'MKD',
  swaziland: 'SWZ',
  'east timor': 'TLS',
  bosnia: 'BIH',
  'congo brazzaville': 'COG',
  'republic of the congo': 'COG',
  vatican: 'VAT',
  'holy see': 'VAT',
};

const BY_ISO3 = new Map(COUNTRIES.map((c) => [c.iso3, c]));
const BY_ISO2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));
const BY_NUMERIC = new Map(COUNTRIES.map((c) => [c.isoNumeric, c]));

/**
 * Curated, exact-match city -> country lookup for cities commonly asked
 * about by name without an enclosing country reference (e.g. "What's
 * happening in Kigali?"). Keys are lowercase city names; values are ISO
 * alpha-3 codes.
 *
 * This intentionally mirrors COUNTRY_ALIASES: a small, deliberately
 * bounded, exact-match table grown incrementally as confirmed cases
 * appear — not a geocoder and not a comprehensive world-city database.
 * Only cities whose country mapping is unambiguous belong here.
 */
const CITY_TO_ISO3: Record<string, string> = {
  kigali: 'RWA',
  nairobi: 'KEN',
  warsaw: 'POL',
  madrid: 'ESP',
  london: 'GBR',
  paris: 'FRA',
  washington: 'USA',
  'washington dc': 'USA',
  kyiv: 'UKR',
  kiev: 'UKR',
  beijing: 'CHN',
  tokyo: 'JPN',
  'new delhi': 'IND',
  delhi: 'IND',
  ottawa: 'CAN',
  canberra: 'AUS',
  brussels: 'BEL',
  berlin: 'DEU',
  rome: 'ITA',
  moscow: 'RUS',
  pretoria: 'ZAF',
  cairo: 'EGY',
  lagos: 'NGA',
  'addis ababa': 'ETH',
};

/**
 * Resolves a country from a curated, exact-match city name (e.g.
 * "Kigali" -> Rwanda). Case-insensitive, whitespace-tolerant. Returns
 * undefined for any city not in the curated list — this deliberately
 * does not attempt partial or fuzzy matching.
 */
export function resolveCountryByCity(input: string): CountryMeta | undefined {
  const lower = input.trim().toLowerCase();
  if (!lower) return undefined;

  const iso3 = CITY_TO_ISO3[lower];
  return iso3 ? BY_ISO3.get(iso3) : undefined;
}

/** Case-insensitive lookup by ISO alpha-3 code (e.g. "esp" -> Spain). */
export function findCountryByIso3(code: string): CountryMeta | undefined {
  return BY_ISO3.get(code.trim().toUpperCase());
}

/** Case-insensitive lookup by ISO alpha-2 code. */
export function findCountryByIso2(code: string): CountryMeta | undefined {
  return BY_ISO2.get(code.trim().toUpperCase());
}

/** Lookup by ISO 3166-1 numeric code (matches world-atlas TopoJSON feature ids). */
export function findCountryByNumeric(code: string): CountryMeta | undefined {
  return BY_NUMERIC.get(String(code).padStart(3, '0'));
}

/** Case-insensitive substring match on country name, ISO codes, or a known alias, for search/autocomplete. */
export function searchCountriesByName(query: string, limit = 8): CountryMeta[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const matches = new Map<string, CountryMeta>();

  for (const country of COUNTRIES) {
    const nameMatch = country.name.toLowerCase().includes(normalized);
    const codeMatch = country.iso2.toLowerCase() === normalized || country.iso3.toLowerCase() === normalized;
    if (nameMatch || codeMatch) matches.set(country.iso3, country);
  }

  for (const [alias, iso3] of Object.entries(COUNTRY_ALIASES)) {
    if (alias.includes(normalized)) {
      const country = BY_ISO3.get(iso3);
      if (country) matches.set(country.iso3, country);
    }
  }

  return Array.from(matches.values()).slice(0, limit);
}

/**
 * Resolves a country from any reasonable identifier a person or client
 * might send: an ISO alpha-2/alpha-3 code, the exact country name, or a
 * known alias/common name (e.g. "USA", "Britain", "DR Congo", "UAE",
 * "Czech Republic") — all case-insensitive. Returns undefined only if
 * nothing matches; callers should treat that as "no results" rather
 * than a client error, since a country naming mismatch isn't the same
 * as a malformed request.
 */
export function resolveCountryByAnyIdentifier(input: string): CountryMeta | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  return (
    BY_ISO3.get(upper) ??
    BY_ISO2.get(upper) ??
    COUNTRIES.find((country) => country.name.toLowerCase() === lower) ??
    (COUNTRY_ALIASES[lower] ? BY_ISO3.get(COUNTRY_ALIASES[lower]) : undefined)
  );
}

export const ALL_ISO3_CODES: string[] = COUNTRIES.map((c) => c.iso3);
