import { findCountryByIso2, findCountryByIso3 } from '@globalnews-ai/shared';
import { citiesByExonym, citiesNamed } from '../../geo/geo-gazetteer';
import { foldPlaceName } from '../../geo/geo-normalize.util';
import type { EntityCandidate } from './entities';
import { LOCALIZED_COUNTRY_NAMES, type LocalizedLanguage } from './localized-country-names';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 SEVEN-LANGUAGE RULING §2 / §4 / §5 — LOCALIZED STAGE A (identity only, never meaning)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * For FR / DE / ES / PT / AR the deterministic EN/PL readers are NOT applied (they do not
 * understand these languages, and the ruling forbids five parallel regex stacks). What IS
 * applied is the language-independent, governed part of Stage A: every place the reader wrote is
 * resolved to ONE canonical identity of the EXISTING registry — directly from its localized
 * name, never via an English translation:
 *
 *   COUNTRY / TERRITORY   a localized registry name (localized-country-names.ts, CLDR), a governed
 *                         alias ("RDC", "VAE", "EE. UU.", "أمريكا"), German genitive ("Russlands"),
 *                         Arabic attached clitics ("والصين", "للصين"), a COMBINED adjective
 *                         ("franco-allemand", "deutsch-polnisch", "الروسية الأوكرانية") or a
 *                         demonym attached to a state noun ("le gouvernement français",
 *                         "die russische Armee", "الحكومة المصرية")
 *   REGION                a governed disputed / named region in that language ("Crimée", "الجولان")
 *   CITY                  a governed localized exonym ("Genf", "Ginebra", "جنيف"), or a gazetteer
 *                         city introduced by a place preposition (Latin scripts, capitalised)
 *   PLACE                 an unknown capitalised word where an event happened ("pourparlers à
 *                         Zarvana"): unresolved — never an identity, never an actor
 *
 * Nothing here decides a job, a freshness, a role or a relation: those are the ONE bounded
 * interpreter's (semantic-interpreter.ts), constrained to the ids read here. An ambiguous form
 * (Arabic "عمان" = Oman or Amman; Spanish / Portuguese "Granada") is not read. Pure.
 */

/* ── folding: one function for the table and the text ─────────────────────────────────────── */
export function foldLocalized(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

type Hit =
  | { readonly kind: 'COUNTRY'; readonly iso3: string }
  | { readonly kind: 'REGION'; readonly key: string };

/* ── governed aliases (identity data; folded keys) ────────────────────────────────────────── */
const GOVERNED_ALIASES: Readonly<
  Record<LocalizedLanguage, ReadonlyArray<readonly [string, string]>>
> = {
  fr: [
    ['burkina', 'BFA'],
    ['république démocratique du congo', 'COD'],
    ['rd congo', 'COD'],
    ['république du congo', 'COG'],
    ['grande-bretagne', 'GBR'],
    ['angleterre', 'GBR'],
    ['hollande', 'NLD'],
    ['république tchèque', 'CZE'],
    ['palestine', 'PSE'],
    ['émirats', 'ARE'],
    ['amérique', 'USA'],
    ['états-unis d’amérique', 'USA'],
    ['birmanie', 'MMR'],
    ['biélorussie', 'BLR'],
    ['macédoine', 'MKD'],
    ['centrafrique', 'CAF'],
  ],
  de: [
    ['burkina', 'BFA'],
    ['bundesrepublik', 'DEU'],
    ['bundesrepublik deutschland', 'DEU'],
    ['demokratische republik kongo', 'COD'],
    ['dr kongo', 'COD'],
    ['republik kongo', 'COG'],
    ['großbritannien', 'GBR'],
    ['england', 'GBR'],
    ['holland', 'NLD'],
    ['tschechische republik', 'CZE'],
    ['weißrussland', 'BLR'],
    ['palästina', 'PSE'],
    ['burma', 'MMR'],
    ['birma', 'MMR'],
    ['elfenbeinküste', 'CIV'],
    ['amerika', 'USA'],
    ['vereinigte staaten von amerika', 'USA'],
    ['emirate', 'ARE'],
  ],
  es: [
    ['burkina', 'BFA'],
    ['república democrática del congo', 'COD'],
    ['rd congo', 'COD'],
    ['república del congo', 'COG'],
    ['gran bretaña', 'GBR'],
    ['inglaterra', 'GBR'],
    ['holanda', 'NLD'],
    ['república checa', 'CZE'],
    ['bielorrusia', 'BLR'],
    ['palestina', 'PSE'],
    ['birmania', 'MMR'],
    ['costa de marfil', 'CIV'],
    ['arabia saudita', 'SAU'],
    ['emiratos', 'ARE'],
    ['estados unidos de américa', 'USA'],
  ],
  pt: [
    ['burkina', 'BFA'],
    ['república democrática do congo', 'COD'],
    ['rd congo', 'COD'],
    ['grã-bretanha', 'GBR'],
    ['inglaterra', 'GBR'],
    ['holanda', 'NLD'],
    ['república checa', 'CZE'],
    ['república tcheca', 'CZE'],
    ['polónia', 'POL'],
    ['irão', 'IRN'],
    ['egipto', 'EGY'],
    ['bielorrússia', 'BLR'],
    ['palestina', 'PSE'],
    ['quénia', 'KEN'],
    ['vietname', 'VNM'],
    ['birmânia', 'MMR'],
    ['emirados', 'ARE'],
    ['estados unidos da américa', 'USA'],
  ],
  ar: [
    ['بوركينا', 'BFA'],
    ['أمريكا', 'USA'],
    ['أميركا', 'USA'],
    ['الولايات المتحدة الأمريكية', 'USA'],
    ['الولايات المتحدة الأميركية', 'USA'],
    ['بريطانيا', 'GBR'],
    ['السعودية', 'SAU'],
    ['الإمارات', 'ARE'],
    ['فلسطين', 'PSE'],
    ['جمهورية الكونغو الديمقراطية', 'COD'],
    ['الكونغو الديمقراطية', 'COD'],
    ['بورما', 'MMR'],
    ['كوت ديفوار', 'CIV'],
    ['بيلاروسيا', 'BLR'],
    ['روسيا البيضاء', 'BLR'],
    ['سلطنة عمان', 'OMN'],
    ['سوريا', 'SYR'],
    ['سورية', 'SYR'],
  ],
};
/* acronyms: case-sensitive, any of the five languages */
const ACRONYMS: Readonly<Record<string, string>> = {
  USA: 'USA',
  US: 'USA',
  UK: 'GBR',
  RDC: 'COD',
  RDCongo: 'COD',
  DRK: 'COD',
  EAU: 'ARE',
  VAE: 'ARE',
  UAE: 'ARE',
  EUA: 'USA',
  RCA: 'CAF',
  BRD: 'DEU',
};
const ACRONYM_RE =
  /(?<![\p{L}\p{N}])(?:E\.?\s?E\.?\s?U\.?\s?U\.?|E\.U\.A\.|U\.S\.A?\.?)(?![\p{L}])/gu;
/* forms that name a country only when capitalised (they are ordinary words too) */
const HOMOGRAPHS: Readonly<Record<LocalizedLanguage, ReadonlySet<string>>> = {
  fr: new Set(['maurice', 'chili', 'benin', 'grenade', 'niger', 'turquie']),
  de: new Set(['chile', 'georgien']),
  es: new Set(['chile', 'guinea', 'georgia']),
  pt: new Set(['peru', 'chile', 'malta', 'cuba', 'guine']),
  ar: new Set(),
};
/* forms that are never read (ambiguous between two identities, or a city of the same name) */
const NEVER: Readonly<Record<LocalizedLanguage, ReadonlySet<string>>> = {
  fr: new Set(),
  de: new Set(),
  es: new Set(['granada']),
  pt: new Set(['granada']),
  ar: new Set(['عمان', 'الكونغو', 'كوريا', 'غينيا']),
};

/* ── governed regions, localized (keys are the existing REGION ids) ───────────────────────── */
const LOCALIZED_REGIONS: Readonly<
  Record<string, Readonly<Record<LocalizedLanguage, readonly string[]>>>
> = {
  SENKAKU: {
    fr: ['îles senkaku', 'senkaku', 'îles diaoyu'],
    de: ['senkaku-inseln', 'senkaku', 'diaoyu-inseln'],
    es: ['islas senkaku', 'senkaku', 'islas diaoyu'],
    pt: ['ilhas senkaku', 'senkaku', 'ilhas diaoyu'],
    ar: ['جزر سينكاكو', 'سينكاكو', 'جزر دياويو'],
  },
  KASHMIR: {
    fr: ['cachemire'],
    de: ['kaschmir'],
    es: ['cachemira'],
    pt: ['caxemira'],
    ar: ['كشمير'],
  },
  CRIMEA: {
    fr: ['crimée'],
    de: ['krim'],
    es: ['crimea'],
    pt: ['crimeia', 'crimeia'],
    ar: ['القرم', 'شبه جزيرة القرم'],
  },
  KARABAKH: {
    fr: ['haut-karabakh', 'karabakh', 'nagorny-karabakh'],
    de: ['bergkarabach', 'berg-karabach', 'karabach'],
    es: ['alto karabaj', 'nagorno karabaj', 'karabaj'],
    pt: ['nagorno-karabakh', 'alto carabaque', 'karabakh'],
    ar: ['ناغورنو كاراباخ', 'ناغورني قره باغ', 'قره باغ', 'كاراباخ'],
  },
  GOLAN: {
    fr: ['golan', 'plateau du golan'],
    de: ['golanhöhen', 'golan'],
    es: ['altos del golán', 'golán'],
    pt: ['colinas de golã', 'golã', 'golan'],
    ar: ['الجولان', 'هضبة الجولان'],
  },
  KURILS: {
    fr: ['kouriles', 'îles kouriles'],
    de: ['kurilen'],
    es: ['kuriles', 'islas kuriles'],
    pt: ['curilas', 'ilhas curilas'],
    ar: ['جزر الكوريل', 'الكوريل'],
  },
  SPRATLY: {
    fr: ['spratleys', 'îles spratleys', 'spratly'],
    de: ['spratly-inseln', 'spratly'],
    es: ['islas spratly', 'spratly'],
    pt: ['ilhas spratly', 'spratly'],
    ar: ['جزر سبراتلي'],
  },
  PARACEL: {
    fr: ['paracels', 'îles paracels'],
    de: ['paracel-inseln', 'paracel'],
    es: ['islas paracel', 'paracel'],
    pt: ['ilhas paracel', 'paracel'],
    ar: ['جزر باراسيل'],
  },
  SOUTH_CHINA_SEA: {
    fr: ['mer de chine méridionale'],
    de: ['südchinesisches meer', 'südchinesischen meer', 'südchinesischen meeres'],
    es: ['mar de la china meridional', 'mar de china meridional', 'mar del sur de china'],
    pt: ['mar do sul da china', 'mar da china meridional'],
    ar: ['بحر الصين الجنوبي'],
  },
  ESSEQUIBO: {
    fr: ['essequibo'],
    de: ['essequibo'],
    es: ['esequibo', 'essequibo'],
    pt: ['essequibo'],
    ar: ['إيسيكيبو'],
  },
  ABYEI: { fr: ['abyei'], de: ['abyei'], es: ['abyei'], pt: ['abyei'], ar: ['أبيي'] },
  TRANSNISTRIA: {
    fr: ['transnistrie'],
    de: ['transnistrien'],
    es: ['transnistria'],
    pt: ['transnístria'],
    ar: ['ترانسنيستريا'],
  },
  DONBAS: {
    fr: ['donbass', 'donbas'],
    de: ['donbass', 'donbas'],
    es: ['donbás', 'donbass'],
    pt: ['donbass', 'donbas'],
    ar: ['دونباس'],
  },
  ABKHAZIA: {
    fr: ['abkhazie'],
    de: ['abchasien'],
    es: ['abjasia'],
    pt: ['abecásia', 'abcásia'],
    ar: ['أبخازيا'],
  },
  SOUTH_OSSETIA: {
    fr: ['ossétie du sud'],
    de: ['südossetien'],
    es: ['osetia del sur'],
    pt: ['ossétia do sul'],
    ar: ['أوسيتيا الجنوبية'],
  },
  CHAGOS: {
    fr: ['chagos', 'archipel des chagos'],
    de: ['chagos', 'chagos-archipel'],
    es: ['chagos', 'archipiélago de chagos'],
    pt: ['chagos', 'arquipélago de chagos'],
    ar: ['تشاغوس', 'جزر تشاغوس'],
  },
  GAZA: {
    fr: ['bande de gaza', 'gaza'],
    de: ['gazastreifen', 'gaza'],
    es: ['franja de gaza', 'gaza'],
    pt: ['faixa de gaza', 'gaza'],
    ar: ['قطاع غزة', 'غزة'],
  },
  WEST_BANK: {
    fr: ['cisjordanie'],
    de: ['westjordanland'],
    es: ['cisjordania'],
    pt: ['cisjordânia'],
    ar: ['الضفة الغربية'],
  },
  HANS_ISLAND: {
    fr: ['île hans'],
    de: ['hans-insel'],
    es: ['isla hans'],
    pt: ['ilha hans'],
    ar: ['جزيرة هانس'],
  },
  CEUTA_MELILLA: {
    fr: ['ceuta', 'melilla'],
    de: ['ceuta', 'melilla'],
    es: ['ceuta', 'melilla'],
    pt: ['ceuta', 'melilla'],
    ar: ['سبتة', 'مليلية'],
  },
};

/* ── governed localized city exonyms (closed identity data; venue / capital cities) ───────── */
const LOCALIZED_CITIES: ReadonlyArray<
  readonly [string, string, Readonly<Partial<Record<LocalizedLanguage, readonly string[]>>>]
> = [
  [
    'Geneva',
    'CH',
    { fr: ['Genève'], de: ['Genf'], es: ['Ginebra'], pt: ['Genebra'], ar: ['جنيف'] },
  ],
  ['Vienna', 'AT', { fr: ['Vienne'], de: ['Wien'], es: ['Viena'], pt: ['Viena'], ar: ['فيينا'] }],
  ['Doha', 'QA', { fr: ['Doha'], de: ['Doha'], es: ['Doha'], pt: ['Doha'], ar: ['الدوحة'] }],
  [
    'Istanbul',
    'TR',
    { de: ['Istanbul'], es: ['Estambul'], pt: ['Istambul'], ar: ['إسطنبول', 'اسطنبول'] },
  ],
  [
    'Moscow',
    'RU',
    { fr: ['Moscou'], de: ['Moskau'], es: ['Moscú'], pt: ['Moscovo', 'Moscou'], ar: ['موسكو'] },
  ],
  [
    'Washington',
    'US',
    {
      fr: ['Washington'],
      de: ['Washington'],
      es: ['Washington'],
      pt: ['Washington'],
      ar: ['واشنطن'],
    },
  ],
  ['Paris', 'FR', { fr: ['Paris'], de: ['Paris'], es: ['París'], pt: ['Paris'], ar: ['باريس'] }],
  [
    'Cairo',
    'EG',
    { fr: ['Le Caire', 'Caire'], de: ['Kairo'], es: ['El Cairo'], pt: ['Cairo'], ar: ['القاهرة'] },
  ],
  [
    'Brussels',
    'BE',
    { fr: ['Bruxelles'], de: ['Brüssel'], es: ['Bruselas'], pt: ['Bruxelas'], ar: ['بروكسل'] },
  ],
  ['Riyadh', 'SA', { fr: ['Riyad'], de: ['Riad'], es: ['Riad'], pt: ['Riade'], ar: ['الرياض'] }],
  ['Jeddah', 'SA', { fr: ['Djeddah'], de: ['Dschidda'], es: ['Yeda'], pt: ['Jidá'], ar: ['جدة'] }],
  [
    'Abu Dhabi',
    'AE',
    {
      fr: ['Abou Dabi', 'Abu Dhabi'],
      de: ['Abu Dhabi'],
      es: ['Abu Dabi'],
      pt: ['Abu Dhabi'],
      ar: ['أبوظبي', 'أبو ظبي'],
    },
  ],
  ['Dubai', 'AE', { fr: ['Dubaï'], de: ['Dubai'], es: ['Dubái'], pt: ['Dubai'], ar: ['دبي'] }],
  ['Beijing', 'CN', { fr: ['Pékin'], de: ['Peking'], es: ['Pekín'], pt: ['Pequim'], ar: ['بكين'] }],
  [
    'Tehran',
    'IR',
    { fr: ['Téhéran'], de: ['Teheran'], es: ['Teherán'], pt: ['Teerã', 'Teerão'], ar: ['طهران'] },
  ],
  [
    'Ankara',
    'TR',
    { fr: ['Ankara'], de: ['Ankara'], es: ['Ankara'], pt: ['Ancara'], ar: ['أنقرة'] },
  ],
  [
    'Kyiv',
    'UA',
    { fr: ['Kiev', 'Kyiv'], de: ['Kiew'], es: ['Kiev'], pt: ['Kiev', 'Kyiv'], ar: ['كييف'] },
  ],
  ['Minsk', 'BY', { fr: ['Minsk'], de: ['Minsk'], es: ['Minsk'], pt: ['Minsk'], ar: ['مينسك'] }],
  [
    'The Hague',
    'NL',
    { fr: ['La Haye'], de: ['Den Haag'], es: ['La Haya'], pt: ['Haia'], ar: ['لاهاي'] },
  ],
  ['Rome', 'IT', { fr: ['Rome'], de: ['Rom'], es: ['Roma'], pt: ['Roma'], ar: ['روما'] }],
  [
    'London',
    'GB',
    { fr: ['Londres'], de: ['London'], es: ['Londres'], pt: ['Londres'], ar: ['لندن'] },
  ],
  [
    'Berlin',
    'DE',
    { fr: ['Berlin'], de: ['Berlin'], es: ['Berlín'], pt: ['Berlim'], ar: ['برلين'] },
  ],
  [
    'Warsaw',
    'PL',
    { fr: ['Varsovie'], de: ['Warschau'], es: ['Varsovia'], pt: ['Varsóvia'], ar: ['وارسو'] },
  ],
  [
    'Baghdad',
    'IQ',
    { fr: ['Bagdad'], de: ['Bagdad'], es: ['Bagdad'], pt: ['Bagdá', 'Bagdade'], ar: ['بغداد'] },
  ],
  [
    'Damascus',
    'SY',
    { fr: ['Damas'], de: ['Damaskus'], es: ['Damasco'], pt: ['Damasco'], ar: ['دمشق'] },
  ],
  [
    'Beirut',
    'LB',
    { fr: ['Beyrouth'], de: ['Beirut'], es: ['Beirut'], pt: ['Beirute'], ar: ['بيروت'] },
  ],
  ['Amman', 'JO', { fr: ['Amman'], de: ['Amman'], es: ['Amán'], pt: ['Amã'] }],
  [
    'Jerusalem',
    '',
    { fr: ['Jérusalem'], de: ['Jerusalem'], es: ['Jerusalén'], pt: ['Jerusalém'], ar: ['القدس'] },
  ],
  ['Algiers', 'DZ', { fr: ['Alger'], de: ['Algier'], es: ['Argel'], pt: ['Argel'] }],
  ['Rabat', 'MA', { fr: ['Rabat'], de: ['Rabat'], es: ['Rabat'], pt: ['Rabat'], ar: ['الرباط'] }],
  [
    'Tripoli',
    '',
    { fr: ['Tripoli'], de: ['Tripolis'], es: ['Trípoli'], pt: ['Trípoli'], ar: ['طرابلس'] },
  ],
  [
    'Muscat',
    'OM',
    { fr: ['Mascate'], de: ['Maskat'], es: ['Mascate'], pt: ['Mascate'], ar: ['مسقط'] },
  ],
  [
    'Sharm El Sheikh',
    'EG',
    {
      fr: ['Charm el-Cheikh'],
      de: ['Scharm El-Scheich'],
      es: ['Sharm el-Sheij'],
      pt: ['Sharm el-Sheikh'],
      ar: ['شرم الشيخ'],
    },
  ],
  [
    'Madrid',
    'ES',
    { fr: ['Madrid'], de: ['Madrid'], es: ['Madrid'], pt: ['Madri', 'Madrid'], ar: ['مدريد'] },
  ],
  [
    'Lisbon',
    'PT',
    { fr: ['Lisbonne'], de: ['Lissabon'], es: ['Lisboa'], pt: ['Lisboa'], ar: ['لشبونة'] },
  ],
  ['Prague', 'CZ', { fr: ['Prague'], de: ['Prag'], es: ['Praga'], pt: ['Praga'], ar: ['براغ'] }],
  [
    'Athens',
    'GR',
    { fr: ['Athènes'], de: ['Athen'], es: ['Atenas'], pt: ['Atenas'], ar: ['أثينا'] },
  ],
  [
    'Copenhagen',
    'DK',
    {
      fr: ['Copenhague'],
      de: ['Kopenhagen'],
      es: ['Copenhague'],
      pt: ['Copenhaga', 'Copenhague'],
      ar: ['كوبنهاغن'],
    },
  ],
  [
    'Stockholm',
    'SE',
    {
      fr: ['Stockholm'],
      de: ['Stockholm'],
      es: ['Estocolmo'],
      pt: ['Estocolmo'],
      ar: ['ستوكهولم'],
    },
  ],
  [
    'Helsinki',
    'FI',
    {
      fr: ['Helsinki'],
      de: ['Helsinki'],
      es: ['Helsinki'],
      pt: ['Helsínquia', 'Helsinque'],
      ar: ['هلسنكي'],
    },
  ],
  ['Oslo', 'NO', { fr: ['Oslo'], de: ['Oslo'], es: ['Oslo'], pt: ['Oslo'], ar: ['أوسلو'] }],
  [
    'Munich',
    'DE',
    { fr: ['Munich'], de: ['München'], es: ['Múnich'], pt: ['Munique'], ar: ['ميونخ'] },
  ],
  ['Tokyo', 'JP', { fr: ['Tokyo'], de: ['Tokio'], es: ['Tokio'], pt: ['Tóquio'], ar: ['طوكيو'] }],
  ['Seoul', 'KR', { fr: ['Séoul'], de: ['Seoul'], es: ['Seúl'], pt: ['Seul'], ar: ['سيول'] }],
  [
    'Pyongyang',
    'KP',
    {
      fr: ['Pyongyang'],
      de: ['Pjöngjang'],
      es: ['Pionyang'],
      pt: ['Pyongyang'],
      ar: ['بيونغ يانغ'],
    },
  ],
  [
    'New Delhi',
    'IN',
    {
      fr: ['New Delhi'],
      de: ['Neu-Delhi'],
      es: ['Nueva Delhi'],
      pt: ['Nova Délhi'],
      ar: ['نيودلهي'],
    },
  ],
  [
    'Islamabad',
    'PK',
    {
      fr: ['Islamabad'],
      de: ['Islamabad'],
      es: ['Islamabad'],
      pt: ['Islamabad'],
      ar: ['إسلام آباد'],
    },
  ],
  ['Kabul', 'AF', { fr: ['Kaboul'], de: ['Kabul'], es: ['Kabul'], pt: ['Cabul'], ar: ['كابل'] }],
  [
    'Nairobi',
    'KE',
    { fr: ['Nairobi'], de: ['Nairobi'], es: ['Nairobi'], pt: ['Nairóbi'], ar: ['نيروبي'] },
  ],
  [
    'Addis Ababa',
    'ET',
    {
      fr: ['Addis-Abeba'],
      de: ['Addis Abeba'],
      es: ['Adís Abeba'],
      pt: ['Adis Abeba'],
      ar: ['أديس أبابا'],
    },
  ],
  [
    'Kigali',
    'RW',
    { fr: ['Kigali'], de: ['Kigali'], es: ['Kigali'], pt: ['Kigali'], ar: ['كيغالي'] },
  ],
  [
    'Kinshasa',
    'CD',
    { fr: ['Kinshasa'], de: ['Kinshasa'], es: ['Kinsasa'], pt: ['Kinshasa'], ar: ['كينشاسا'] },
  ],
  [
    'Luanda',
    'AO',
    { fr: ['Luanda'], de: ['Luanda'], es: ['Luanda'], pt: ['Luanda'], ar: ['لواندا'] },
  ],
  [
    'Maputo',
    'MZ',
    { fr: ['Maputo'], de: ['Maputo'], es: ['Maputo'], pt: ['Maputo'], ar: ['مابوتو'] },
  ],
  ['Dakar', 'SN', { fr: ['Dakar'], de: ['Dakar'], es: ['Dakar'], pt: ['Dacar'], ar: ['داكار'] }],
  [
    'Abidjan',
    'CI',
    { fr: ['Abidjan'], de: ['Abidjan'], es: ['Abiyán'], pt: ['Abidjan'], ar: ['أبيدجان'] },
  ],
  [
    'Havana',
    'CU',
    { fr: ['La Havane'], de: ['Havanna'], es: ['La Habana'], pt: ['Havana'], ar: ['هافانا'] },
  ],
  [
    'Brasília',
    'BR',
    { fr: ['Brasilia'], de: ['Brasília'], es: ['Brasilia'], pt: ['Brasília'], ar: ['برازيليا'] },
  ],
  [
    'Buenos Aires',
    'AR',
    {
      fr: ['Buenos Aires'],
      de: ['Buenos Aires'],
      es: ['Buenos Aires'],
      pt: ['Buenos Aires'],
      ar: ['بوينس آيرس'],
    },
  ],
  [
    'Mexico City',
    'MX',
    {
      fr: ['Mexico'],
      de: ['Mexiko-Stadt'],
      es: ['Ciudad de México'],
      pt: ['Cidade do México'],
      ar: ['مكسيكو سيتي'],
    },
  ],
  [
    'Bogotá',
    'CO',
    { fr: ['Bogota'], de: ['Bogotá'], es: ['Bogotá'], pt: ['Bogotá'], ar: ['بوغوتا'] },
  ],
  [
    'Caracas',
    'VE',
    { fr: ['Caracas'], de: ['Caracas'], es: ['Caracas'], pt: ['Caracas'], ar: ['كاراكاس'] },
  ],
  [
    'Ottawa',
    'CA',
    { fr: ['Ottawa'], de: ['Ottawa'], es: ['Ottawa'], pt: ['Otava', 'Ottawa'], ar: ['أوتاوا'] },
  ],
  [
    'Singapore',
    'SG',
    { fr: ['Singapour'], de: ['Singapur'], es: ['Singapur'], pt: ['Singapura'], ar: ['سنغافورة'] },
  ],
  ['Baku', 'AZ', { fr: ['Bakou'], de: ['Baku'], es: ['Bakú'], pt: ['Baku'], ar: ['باكو'] }],
  [
    'Yerevan',
    'AM',
    {
      fr: ['Erevan'],
      de: ['Jerewan', 'Eriwan'],
      es: ['Ereván'],
      pt: ['Erevan', 'Ierevan'],
      ar: ['يريفان'],
    },
  ],
  [
    'Tbilisi',
    'GE',
    {
      fr: ['Tbilissi'],
      de: ['Tiflis', 'Tbilissi'],
      es: ['Tiflis'],
      pt: ['Tbilisi'],
      ar: ['تبليسي'],
    },
  ],
  [
    'Astana',
    'KZ',
    { fr: ['Astana'], de: ['Astana'], es: ['Astaná'], pt: ['Astana'], ar: ['أستانا'] },
  ],
  ['Davos', 'CH', { fr: ['Davos'], de: ['Davos'], es: ['Davos'], pt: ['Davos'], ar: ['دافوس'] }],
  [
    'Lausanne',
    'CH',
    { fr: ['Lausanne'], de: ['Lausanne'], es: ['Lausana'], pt: ['Lausana'], ar: ['لوزان'] },
  ],
  [
    'Camp David',
    'US',
    {
      fr: ['Camp David'],
      de: ['Camp David'],
      es: ['Camp David'],
      pt: ['Camp David'],
      ar: ['كامب ديفيد'],
    },
  ],
  [
    'New York',
    'US',
    {
      fr: ['New York'],
      de: ['New York'],
      es: ['Nueva York'],
      pt: ['Nova Iorque', 'Nova York'],
      ar: ['نيويورك'],
    },
  ],
  [
    'Manama',
    'BH',
    { fr: ['Manama'], de: ['Manama'], es: ['Manama'], pt: ['Manama'], ar: ['المنامة'] },
  ],
  ['Kuwait City', 'KW', { ar: ['مدينة الكويت'] }],
  [
    'Khartoum',
    'SD',
    { fr: ['Khartoum'], de: ['Khartum'], es: ['Jartum'], pt: ['Cartum'], ar: ['الخرطوم'] },
  ],
  ['Tunis', 'TN', { fr: ['Tunis'], de: ['Tunis'], es: ['Túnez'], pt: ['Túnis'] }],
  ['Sanaa', 'YE', { fr: ['Sanaa'], de: ['Sanaa'], es: ['Saná'], pt: ['Saná'], ar: ['صنعاء'] }],
  ['Gaza City', 'PS', { ar: ['مدينة غزة'] }],
];

/* ── demonym adjectives (governed; only COMBINED pairs or attached to a state noun) ───────── */
const DEMONYMS: Readonly<Record<LocalizedLanguage, ReadonlyArray<readonly [string, string]>>> = {
  fr: [
    ['FRA', 'francais(?:e|es)?|franco'],
    ['DEU', 'allemand(?:e|es|s)?|germano'],
    ['RUS', 'russes?|russo'],
    ['CHN', 'chinois(?:e|es)?|sino'],
    ['USA', 'americain(?:e|es|s)?|americano|etats uniens?(?:ne|nes)?'],
    ['GBR', 'britanniques?|anglo|anglais(?:e|es)?'],
    ['POL', 'polonais(?:e|es)?|polono'],
    ['UKR', 'ukrainien(?:ne|nes|s)?|ukraino'],
    ['TUR', 'turc(?:s)?|turques?|turco'],
    ['IRN', 'iranien(?:ne|nes|s)?|irano'],
    ['ISR', 'israelien(?:ne|nes|s)?|israelo'],
    ['PSE', 'palestinien(?:ne|nes|s)?'],
    ['IND', 'indien(?:ne|nes|s)?|indo'],
    ['PAK', 'pakistanais(?:e|es)?'],
    ['JPN', 'japonais(?:e|es)?|nippo'],
    ['ITA', 'italien(?:ne|nes|s)?|italo'],
    ['ESP', 'espagnol(?:e|es|s)?|hispano'],
    ['PRT', 'portugais(?:e|es)?|luso'],
    ['BRA', 'bresilien(?:ne|nes|s)?'],
    ['MEX', 'mexicain(?:e|es|s)?'],
    ['CAN', 'canadien(?:ne|nes|s)?'],
    ['EGY', 'egyptien(?:ne|nes|s)?'],
    ['SAU', 'saoudien(?:ne|nes|s)?'],
    ['SYR', 'syrien(?:ne|nes|s)?'],
    ['IRQ', 'irakien(?:ne|nes|s)?'],
    ['GRC', 'grec(?:s)?|grecques?|greco'],
    ['ARM', 'armenien(?:ne|nes|s)?|armeno'],
    ['AZE', 'azerbaidjanais(?:e|es)?|azeri(?:e|es|s)?'],
    ['SRB', 'serbes?|serbo'],
    ['MAR', 'marocain(?:e|es|s)?'],
    ['DZA', 'algerien(?:ne|nes|s)?|algero'],
    ['TUN', 'tunisien(?:ne|nes|s)?'],
    ['SEN', 'senegalais(?:e|es)?'],
    ['CIV', 'ivoirien(?:ne|nes|s)?'],
    ['RWA', 'rwandais(?:e|es)?'],
    ['MLI', 'malien(?:ne|nes|s)?'],
    ['BEL', 'belges?|belgo'],
    ['CHE', 'suisses?|helveto'],
    ['NLD', 'neerlandais(?:e|es)?'],
    ['AUT', 'autrichien(?:ne|nes|s)?|austro'],
    ['VNM', 'vietnamien(?:ne|nes|s)?'],
    ['VEN', 'venezuelien(?:ne|nes|s)?'],
    ['ARG', 'argentin(?:e|es|s)?'],
    ['QAT', 'qatari(?:e|es|s)?'],
  ],
  de: [
    ['DEU', 'deutsch(?:e|en|er|es|em)?'],
    ['FRA', 'franzosisch(?:e|en|er|es|em)?'],
    ['RUS', 'russisch(?:e|en|er|es|em)?'],
    ['CHN', 'chinesisch(?:e|en|er|es|em)?'],
    ['USA', '(?:us )?amerikanisch(?:e|en|er|es|em)?'],
    ['GBR', 'britisch(?:e|en|er|es|em)?'],
    ['POL', 'polnisch(?:e|en|er|es|em)?'],
    ['UKR', 'ukrainisch(?:e|en|er|es|em)?'],
    ['TUR', 'turkisch(?:e|en|er|es|em)?'],
    ['IRN', 'iranisch(?:e|en|er|es|em)?'],
    ['ISR', 'israelisch(?:e|en|er|es|em)?'],
    ['PSE', 'palastinensisch(?:e|en|er|es|em)?'],
    ['IND', 'indisch(?:e|en|er|es|em)?'],
    ['PAK', 'pakistanisch(?:e|en|er|es|em)?'],
    ['JPN', 'japanisch(?:e|en|er|es|em)?'],
    ['ITA', 'italienisch(?:e|en|er|es|em)?'],
    ['ESP', 'spanisch(?:e|en|er|es|em)?'],
    ['PRT', 'portugiesisch(?:e|en|er|es|em)?'],
    ['BRA', 'brasilianisch(?:e|en|er|es|em)?'],
    ['EGY', 'agyptisch(?:e|en|er|es|em)?'],
    ['SAU', 'saudi(?:sch|arabisch)(?:e|en|er|es|em)?'],
    ['SYR', 'syrisch(?:e|en|er|es|em)?'],
    ['IRQ', 'irakisch(?:e|en|er|es|em)?'],
    ['GRC', 'griechisch(?:e|en|er|es|em)?'],
    ['ARM', 'armenisch(?:e|en|er|es|em)?'],
    ['AZE', 'aserbaidschanisch(?:e|en|er|es|em)?'],
    ['SRB', 'serbisch(?:e|en|er|es|em)?'],
    ['AUT', 'osterreichisch(?:e|en|er|es|em)?'],
    ['CHE', 'schweizerisch(?:e|en|er|es|em)?'],
    ['NLD', 'niederlandisch(?:e|en|er|es|em)?'],
    ['BEL', 'belgisch(?:e|en|er|es|em)?'],
    ['CZE', 'tschechisch(?:e|en|er|es|em)?'],
    ['HUN', 'ungarisch(?:e|en|er|es|em)?'],
    ['BLR', '(?:belarussisch|weissrussisch)(?:e|en|er|es|em)?'],
    ['LTU', 'litauisch(?:e|en|er|es|em)?'],
    ['GEO', 'georgisch(?:e|en|er|es|em)?'],
    ['PRK', 'nordkoreanisch(?:e|en|er|es|em)?'],
    ['KOR', 'sudkoreanisch(?:e|en|er|es|em)?'],
    ['MAR', 'marokkanisch(?:e|en|er|es|em)?'],
    ['VEN', 'venezolanisch(?:e|en|er|es|em)?'],
    ['NOR', 'norwegisch(?:e|en|er|es|em)?'],
    ['SWE', 'schwedisch(?:e|en|er|es|em)?'],
    ['DNK', 'danisch(?:e|en|er|es|em)?'],
  ],
  es: [
    ['FRA', 'frances(?:a|as|es)?|franco'],
    ['DEU', 'aleman(?:a|as|es)?|germano'],
    ['RUS', 'rus(?:o|a|os|as)'],
    ['CHN', 'chin(?:o|a|os|as)|sino'],
    ['USA', 'estadounidenses?|norteamerican(?:o|a|os|as)|american(?:o|a|os|as)'],
    ['GBR', 'britanic(?:o|a|os|as)|anglo'],
    ['POL', 'polac(?:o|a|os|as)'],
    ['UKR', 'ucranian(?:o|a|os|as)'],
    ['TUR', 'turc(?:o|a|os|as)'],
    ['IRN', 'iranies|irani'],
    ['ISR', 'israelies|israeli'],
    ['PSE', 'palestin(?:o|a|os|as)'],
    ['PAK', 'pakistanies|pakistani'],
    ['JPN', 'japones(?:a|as|es)?|nipon(?:a|as|es)?'],
    ['ITA', 'italian(?:o|a|os|as)|italo'],
    ['ESP', 'espanol(?:a|as|es)?|hispano'],
    ['PRT', 'portugues(?:a|as|es)?|luso'],
    ['BRA', 'brasilen(?:o|a|os|as)'],
    ['MEX', 'mexican(?:o|a|os|as)'],
    ['CAN', 'canadienses?'],
    ['EGY', 'egipci(?:o|a|os|as)'],
    ['SAU', 'saudies|saudi|sauditas?'],
    ['SYR', 'siri(?:o|a|os|as)'],
    ['IRQ', 'iraquies|iraqui'],
    ['GRC', 'grieg(?:o|a|os|as)|greco'],
    ['ARM', 'armeni(?:o|a|os|as)'],
    ['AZE', 'azerbaiyan(?:o|a|os|as)|azeri(?:es)?'],
    ['SRB', 'servi(?:o|a|os|as)|serbi(?:o|a|os|as)'],
    ['MAR', 'marroquies|marroqui'],
    ['DZA', 'argelin(?:o|a|os|as)'],
    ['VEN', 'venezolan(?:o|a|os|as)'],
    ['COL', 'colombian(?:o|a|os|as)'],
    ['ARG', 'argentin(?:o|a|os|as)'],
    ['CHL', 'chilen(?:o|a|os|as)'],
    ['PER', 'peruan(?:o|a|os|as)'],
    ['CUB', 'cuban(?:o|a|os|as)'],
    ['BOL', 'bolivian(?:o|a|os|as)'],
    ['ECU', 'ecuatorian(?:o|a|os|as)'],
    ['URY', 'uruguay(?:o|a|os|as)'],
    ['PRY', 'paraguay(?:o|a|os|as)'],
    ['NIC', 'nicaraguenses?'],
    ['GTM', 'guatemaltec(?:o|a|os|as)'],
    ['HND', 'hondurenn?(?:o|a|os|as)|hondurenos?'],
    ['SLV', 'salvadoren(?:o|a|os|as)'],
    ['DOM', 'dominican(?:o|a|os|as)'],
    ['PAN', 'panamen(?:o|a|os|as)'],
    ['CRI', 'costarricenses?'],
    ['NLD', 'neerlandes(?:a|as|es)?|holandes(?:a|as|es)?'],
    ['BEL', 'belgas?'],
    ['CHE', 'suiz(?:o|a|os|as)'],
    ['AUT', 'austriac(?:o|a|os|as)'],
  ],
  pt: [
    ['FRA', 'frances(?:a|as|es)?|franco'],
    ['DEU', 'alema(?:o|s|es)?|germano'],
    ['RUS', 'russ(?:o|a|os|as)'],
    ['CHN', 'chines(?:a|as|es)?|sino'],
    ['USA', 'estadunidenses?|norte american(?:o|a|os|as)|american(?:o|a|os|as)'],
    ['GBR', 'britanic(?:o|a|os|as)|anglo'],
    ['POL', 'polones(?:a|as|es)?|polac(?:o|a|os|as)'],
    ['UKR', 'ucranian(?:o|a|os|as)'],
    ['TUR', 'turc(?:o|a|os|as)'],
    ['IRN', 'iranian(?:o|a|os|as)'],
    ['ISR', 'israelenses?|israelitas?'],
    ['PSE', 'palestin(?:o|a|os|as)|palestinian(?:o|a|os|as)'],
    ['IND', 'indian(?:o|a|os|as)'],
    ['PAK', 'paquistanes(?:a|as|es)?'],
    ['JPN', 'japones(?:a|as|es)?|nipo'],
    ['ITA', 'italian(?:o|a|os|as)|italo'],
    ['ESP', 'espanh(?:ol|ola|ois|olas)|hispano'],
    ['PRT', 'portugues(?:a|as|es)?|luso'],
    ['BRA', 'brasileir(?:o|a|os|as)'],
    ['MEX', 'mexican(?:o|a|os|as)'],
    ['CAN', 'canadenses?|canadian(?:o|a|os|as)'],
    ['EGY', 'egipci(?:o|a|os|as)'],
    ['SAU', 'sauditas?'],
    ['SYR', 'siri(?:o|a|os|as)'],
    ['IRQ', 'iraquian(?:o|a|os|as)'],
    ['GRC', 'greg(?:o|a|os|as)|greco'],
    ['ARM', 'armeni(?:o|a|os|as)'],
    ['AZE', 'azerbaijan(?:o|a|os|as)|azeri'],
    ['SRB', 'servi(?:o|a|os|as)'],
    ['MAR', 'marroquin(?:o|a|os|as)'],
    ['DZA', 'argelin(?:o|a|os|as)'],
    ['VEN', 'venezuelan(?:o|a|os|as)'],
    ['COL', 'colombian(?:o|a|os|as)'],
    ['ARG', 'argentin(?:o|a|os|as)'],
    ['AGO', 'angolan(?:o|a|os|as)'],
    ['MOZ', 'mocambican(?:o|a|os|as)'],
    ['CPV', 'cabo verdian(?:o|a|os|as)'],
    ['GNB', 'guineenses?'],
    ['STP', 'santomenses?|sao tomenses?'],
    ['TLS', 'timorenses?'],
    ['NLD', 'holandes(?:a|as|es)?|neerlandes(?:a|as|es)?'],
    ['BEL', 'belgas?'],
    ['CHE', 'suic(?:o|a|os|as)'],
    ['AUT', 'austriac(?:o|a|os|as)'],
  ],
  ar: [
    ['FRA', 'فرنس'],
    ['DEU', 'المان'],
    ['RUS', 'روس'],
    ['CHN', 'صين'],
    ['USA', 'امريك|اميرك'],
    ['GBR', 'بريطان'],
    ['POL', 'بولند'],
    ['UKR', 'اوكران'],
    ['TUR', 'ترك'],
    ['IRN', 'ايران'],
    ['ISR', 'اسرائيل'],
    ['PSE', 'فلسطين'],
    ['IND', 'هند'],
    ['PAK', 'باكستان'],
    ['JPN', 'يابان'],
    ['ITA', 'ايطال'],
    ['ESP', 'اسبان'],
    ['BRA', 'برازيل'],
    ['EGY', 'مصر'],
    ['SAU', 'سعود'],
    ['SYR', 'سور'],
    ['IRQ', 'عراق'],
    ['JOR', 'اردن'],
    ['LBN', 'لبنان'],
    ['MAR', 'مغرب'],
    ['DZA', 'جزائر'],
    ['TUN', 'تونس'],
    ['LBY', 'ليب'],
    ['SDN', 'سودان'],
    ['YEM', 'يمن'],
    ['QAT', 'قطر'],
    ['ARE', 'امارات'],
    ['KWT', 'كويت'],
    ['OMN', 'عمان'],
    ['BHR', 'بحرين'],
    ['ETH', 'اثيوب'],
    ['AFG', 'افغان'],
    ['GRC', 'يونان'],
    ['ARM', 'ارمن'],
    ['AZE', 'اذربيجان'],
  ],
};
const STATE_NOUN: Readonly<Record<LocalizedLanguage, RegExp>> = {
  fr: /^(?:gouvernement|president|presidente|premier ministre|armee|forces|troupes|economie|marine|diplomatie|parlement|ministre|ministere|elections|banque centrale|frontiere|relations|autorites|regime|ambassade|marche|exportations|importations|industrie|politique|chef d etat|chancelier|chanceliere|nationalite|citoyennete|monnaie|dinar|dirham|peso|franc|rouble|roupie|yen|yuan)$/,
  de: /^(?:regierung|prasident|prasidentin|armee|streitkrafte|truppen|wirtschaft|marine|diplomatie|parlament|minister|ministerin|wahlen|wahl|zentralbank|grenze|behorden|regime|botschaft|markt|exporte|industrie|politik|beziehungen|kanzler|kanzlerin|staatsangehorigkeit|staatsburgerschaft|wahrung)$/,
  es: /^(?:gobierno|presidente|presidenta|ejercito|fuerzas|tropas|economia|marina|diplomacia|parlamento|ministro|ministra|elecciones|banco central|frontera|autoridades|regimen|embajada|mercado|exportaciones|industria|politica|congreso|relaciones|canciller|nacionalidad|ciudadania|moneda|peso|libra|dinar|dirham|rublo|rupia|lira|yen|yuan)$/,
  pt: /^(?:governo|presidente|exercito|forcas|tropas|economia|marinha|diplomacia|parlamento|ministro|ministra|eleicoes|banco central|fronteira|autoridades|regime|embaixada|mercado|exportacoes|industria|politica|congresso|relacoes|chanceler|nacionalidade|cidadania|moeda|libra|dinar|dirham|peso|rublo|rupia|lira|iene|yuan)$/,
  ar: /^(?:الحكومه|الرئيس|الجيش|القوات|الاقتصاد|البحريه|الدبلوماسيه|البرلمان|الوزير|وزير|الانتخابات|البنك المركزي|الحدود|السلطات|النظام|السفاره|السوق|الصادرات|الصناعه|السياسه|العلاقات|الخارجيه|الجنسيه|العمله|الجنيه|الدينار|الريال|الدرهم|الليره|الروبيه|الين)$/,
};
const AR_NISBA_END = '(?:ي|يه|يين|يون|يات|يان|يتين)';

/* ── place prepositions (Latin scripts): where an open gazetteer city may be read ─────────── */
const PLACE_PREP: Readonly<Record<Exclude<LocalizedLanguage, 'ar'>, RegExp>> = {
  fr: /(?:(?:^|\s)(?:à|a|au|aux|dans|depuis|vers|près de|pres de)\s+)$/iu,
  de: /(?:(?:^|\s)(?:in|im|nach|aus|bei)\s+)$/iu,
  es: /(?:(?:^|\s)(?:en|desde|cerca de)\s+)$/iu,
  pt: /(?:(?:^|\s)(?:em|no|na|desde|perto de)\s+)$/iu,
};
const VENUE_PREP: Readonly<Record<Exclude<LocalizedLanguage, 'ar'>, RegExp>> = {
  fr: /(?:pourparlers|négociations|negociations|sommet|réunion|reunion|rencontre|conférence|conference|accord|signé|signe|signés|signée|tenue?s?|organisée?s?|discussions)\s+(?:\S+\s+){0,8}?(?:à|a|au|de)\s+$/iu,
  de: /(?:gespräche|gesprächen|verhandlungen|gipfel|gipfeltreffen|treffen|konferenz|abkommen|unterzeichnet|abgehalten|stattgefunden)\s+(?:\S+\s+){0,8}?(?:in|im|von)\s+$/iu,
  es: /(?:conversaciones|negociaciones|cumbre|reunión|reunion|encuentro|conferencia|acuerdo|firmado|firmada|celebrad[ao]s?|diálogo|dialogo)\s+(?:\S+\s+){0,8}?(?:en|de)\s+$/iu,
  pt: /(?:conversas|negociações|negociacoes|cúpula|cupula|cimeira|reunião|reuniao|encontro|conferência|conferencia|acordo|assinado|assinada|realizad[ao]s?|diálogo|dialogo)\s+(?:\S+\s+){0,8}?(?:em|no|na|de)\s+$/iu,
};
const NOT_A_PLACE =
  /^(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Uhr|Ende|Anfang|Mitte|Jahr|Woche|Monat)$/u;
const MIN_CITY_POPULATION = 100_000;

/* ── indexes ──────────────────────────────────────────────────────────────────────────────── */
interface Indexes {
  readonly names: ReadonlyMap<string, Hit>;
  readonly cities: ReadonlyMap<string, readonly [string, string]>;
  readonly demonyms: ReadonlyArray<readonly [string, RegExp]>;
  readonly maxWords: number;
}
const INDEXES = new Map<LocalizedLanguage, Indexes>();

function indexesFor(lang: LocalizedLanguage): Indexes {
  const cached = INDEXES.get(lang);
  if (cached !== undefined) return cached;
  const names = new Map<string, Hit>();
  let maxWords = 1;
  const put = (form: string, hit: Hit) => {
    const key = foldLocalized(form);
    if (key.length < 2 || NEVER[lang].has(key)) return;
    maxWords = Math.max(maxWords, key.split(' ').length);
    names.set(key, hit);
  };
  for (const [form, iso3] of LOCALIZED_COUNTRY_NAMES[lang]) put(form, { kind: 'COUNTRY', iso3 });
  /* governed aliases outrank a generated name with the same key */
  for (const [form, iso3] of GOVERNED_ALIASES[lang]) put(form, { kind: 'COUNTRY', iso3 });
  for (const [key, forms] of Object.entries(LOCALIZED_REGIONS))
    for (const form of forms[lang]) put(form, { kind: 'REGION', key });
  const cities = new Map<string, readonly [string, string]>();
  for (const [name, iso2, forms] of LOCALIZED_CITIES)
    for (const form of forms[lang] ?? []) {
      const key = foldLocalized(form);
      maxWords = Math.max(maxWords, key.split(' ').length);
      cities.set(key, [name, iso2]);
    }
  const demonyms = DEMONYMS[lang].map(
    ([iso3, stem]) =>
      [
        iso3,
        lang === 'ar'
          ? new RegExp(`^(?:ال)?(?:${stem})${AR_NISBA_END}$`, 'u')
          : new RegExp(`^(?:${stem})$`, 'u'),
      ] as const,
  );
  const built: Indexes = { names, cities, demonyms, maxWords: Math.min(maxWords, 7) };
  INDEXES.set(lang, built);
  return built;
}

/* ── tokens ───────────────────────────────────────────────────────────────────────────────── */
interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}
function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(/[\p{L}\p{M}]+/gu))
    out.push({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  return out;
}
/* words joined by spaces, hyphens or an apostrophe form one name ("Côte d’Ivoire") */
const JOINABLE = /^[\s\-–’'.]*$/u;
const isCapitalised = (s: string): boolean => /^\p{Lu}/u.test(s);

/* Arabic attached clitics (و ف ب ل ك, one or two) and the لل contraction of ل + ال */
function arabicVariants(foldedToken: string): string[] {
  const out = [foldedToken];
  const t = foldedToken;
  const PFX = new Set(['و', 'ف', 'ب', 'ل', 'ك']);
  if (t.length > 3 && PFX.has(t[0])) {
    out.push(t.slice(1));
    if (t[0] === 'ل' && t.startsWith('لل')) out.push(`ال${t.slice(2)}`);
    if (t.length > 4 && PFX.has(t[1])) {
      out.push(t.slice(2));
      if (t[1] === 'ل' && t.slice(1).startsWith('لل')) out.push(`ال${t.slice(3)}`);
    }
  }
  return out;
}

function countryCandidate(
  iso3: string,
  surface: string,
  start: number,
  end: number,
  basis: EntityCandidate['basis'],
): EntityCandidate {
  const meta = findCountryByIso3(iso3) as { status?: string; partOf?: string } | undefined;
  const type =
    meta?.status === undefined || meta.status === 'CONTESTED_STATUS' ? 'COUNTRY' : 'TERRITORY';
  return {
    id: `${type}:${iso3}`,
    type,
    iso3,
    parentIso3: type === 'TERRITORY' ? (meta?.partOf ?? null) : null,
    surface,
    start,
    end,
    basis,
  };
}

function overlaps(spans: readonly { start: number; end: number }[], s: number, e: number): boolean {
  return spans.some((x) => s < x.end && e > x.start);
}

/** LOCALIZED STAGE A — every place a FR / DE / ES / PT / AR reader wrote, with canonical identity. */
export function readLocalizedEntityCandidates(
  text: string,
  lang: LocalizedLanguage,
): EntityCandidate[] {
  const ix = indexesFor(lang);
  const taken: EntityCandidate[] = [];
  const toks = tokens(text);
  const folded = toks.map((t) => foldLocalized(t.text));

  /* 1 · dotted acronyms ("EE. UU.", "U.S.A.") and case-sensitive acronyms ("RDC", "VAE") */
  for (const m of text.matchAll(ACRONYM_RE)) {
    const s = m.index ?? 0;
    const iso3 =
      /^E\.?\s?E/u.test(m[0]) || /^E\.U/u.test(m[0]) || /^U\.S/u.test(m[0]) ? 'USA' : null;
    if (iso3 !== null && !overlaps(taken, s, s + m[0].length))
      taken.push(countryCandidate(iso3, m[0], s, s + m[0].length, 'ALIAS'));
  }
  for (const t of toks) {
    const iso3 = ACRONYMS[t.text];
    if (iso3 !== undefined && !overlaps(taken, t.start, t.end))
      taken.push(countryCandidate(iso3, t.text, t.start, t.end, 'ALIAS'));
  }

  /* 2 · names, aliases, regions and governed cities: windows, longest first, left to right */
  for (let i = 0; i < toks.length; i++) {
    for (let k = Math.min(ix.maxWords, toks.length - i); k >= 1; k--) {
      const first = toks[i];
      const last = toks[i + k - 1];
      if (overlaps(taken, first.start, last.end)) continue;
      let joinable = true;
      for (let j = i; j < i + k - 1; j++)
        if (!JOINABLE.test(text.slice(toks[j].end, toks[j + 1].start))) joinable = false;
      if (!joinable) continue;
      const rest = folded.slice(i + 1, i + k);
      const heads = lang === 'ar' ? arabicVariants(folded[i]) : [folded[i]];
      /* German genitive ("Russlands", "Chinas"): the last word without its -s / -es */
      const tails: string[][] = [rest];
      if (lang === 'de' && k >= 1) {
        const lastWord = k === 1 ? folded[i] : rest[rest.length - 1];
        if (lastWord.length > 4 && /s$/u.test(lastWord)) {
          const strip = [lastWord.replace(/es$/u, ''), lastWord.replace(/s$/u, '')];
          for (const s of strip) tails.push(k === 1 ? [] : [...rest.slice(0, -1), s]);
          if (k === 1) heads.push(...strip);
        }
        /* German dative / adjectival -en ("den Niederlanden", "den Vereinigten Staaten") */
        const en = (w: string) => (w.length > 4 && /en$/u.test(w) ? w.slice(0, -1) : w);
        if (en(folded[i]) !== folded[i]) heads.push(en(folded[i]));
        if (k > 1) tails.push(rest.map(en));
      }
      let hit: Hit | undefined;
      let city: readonly [string, string] | undefined;
      for (const h of heads) {
        for (const tail of tails) {
          const key = [h, ...tail].join(' ');
          hit = ix.names.get(key);
          if (hit === undefined && (lang === 'ar' || isCapitalised(first.text)))
            city = ix.cities.get(key);
          if (hit !== undefined || city !== undefined) break;
        }
        if (hit !== undefined || city !== undefined) break;
      }
      const surface = text.slice(first.start, last.end);
      if (hit !== undefined) {
        if (
          hit.kind === 'COUNTRY' &&
          HOMOGRAPHS[lang].has(folded[i]) &&
          k === 1 &&
          !isCapitalised(first.text)
        )
          continue;
        taken.push(
          hit.kind === 'COUNTRY'
            ? countryCandidate(hit.iso3, surface, first.start, last.end, 'NAME')
            : {
                id: `REGION:${hit.key}`,
                type: 'REGION',
                iso3: null,
                parentIso3: null,
                surface,
                start: first.start,
                end: last.end,
                basis: 'GOVERNED_REGION',
              },
        );
        i += k - 1;
        break;
      }
      if (city !== undefined) {
        const [name, iso2] = city;
        const parent = iso2 === '' ? null : (findCountryByIso2(iso2)?.iso3 ?? null);
        taken.push({
          id: `CITY:${iso2 || 'XX'}:${name}`,
          type: 'CITY',
          iso3: null,
          parentIso3: parent,
          surface,
          start: first.start,
          end: last.end,
          basis: 'GAZETTEER_CITY',
        });
        i += k - 1;
        break;
      }
    }
  }

  /* 3 · demonyms: a COMBINED pair ("franco-allemand", "الروسية الأوكرانية"), or one attached to a
     state noun ("le gouvernement français", "die russische Armee", "الحكومة المصرية") */
  const demonymOf = (idx: number): string | null => {
    const variants = lang === 'ar' ? arabicVariants(folded[idx]) : [folded[idx]];
    for (const v of variants) for (const [iso3, re] of ix.demonyms) if (re.test(v)) return iso3;
    return null;
  };
  for (let i = 0; i < toks.length; i++) {
    if (overlaps(taken, toks[i].start, toks[i].end)) continue;
    const a = demonymOf(i);
    if (a === null) continue;
    const next = i + 1 < toks.length ? toks[i + 1] : undefined;
    const gap = next === undefined ? '' : text.slice(toks[i].end, next.start);
    const b = next === undefined ? null : demonymOf(i + 1);
    const combined =
      next !== undefined &&
      b !== null &&
      b !== a &&
      !overlaps(taken, next.start, next.end) &&
      (/^\s*-\s*$/u.test(gap) || (lang === 'ar' && /^\s+$/u.test(gap)));
    if (combined) {
      taken.push(
        countryCandidate(a, toks[i].text, toks[i].start, toks[i].end, 'COMBINED_ADJECTIVE'),
        countryCandidate(b!, next!.text, next!.start, next!.end, 'COMBINED_ADJECTIVE'),
      );
      i += 1;
      continue;
    }
    /* a single demonym names its state only beside a state noun (never a language: "en français") */
    const before2 = i >= 2 ? `${folded[i - 2]} ${folded[i - 1]}` : '';
    const before1 = i >= 1 ? folded[i - 1] : '';
    const after1 = i + 1 < toks.length ? folded[i + 1] : '';
    const after2 = i + 2 < toks.length ? `${folded[i + 1]} ${folded[i + 2]}` : '';
    const attached =
      lang === 'de'
        ? STATE_NOUN.de.test(after1) || STATE_NOUN.de.test(after2)
        : STATE_NOUN[lang].test(before1) || STATE_NOUN[lang].test(before2);
    if (attached)
      taken.push(
        countryCandidate(a, toks[i].text, toks[i].start, toks[i].end, 'COMBINED_ADJECTIVE'),
      );
  }

  /* 4 · Latin scripts: an open gazetteer city after a place preposition; an unknown capitalised word
     where an event happened is an unresolved PLACE (never an identity, never an actor) */
  if (lang !== 'ar') {
    for (let i = 0; i < toks.length; i++) {
      for (let k = Math.min(3, toks.length - i); k >= 1; k--) {
        const first = toks[i];
        const last = toks[i + k - 1];
        const surface = text.slice(first.start, last.end);
        if (k > 1 && !/^[\p{L}\p{M}'’]+(?:[\s-]+[\p{L}\p{M}'’]+)*$/u.test(surface)) continue;
        if (overlaps(taken, first.start, last.end) || !isCapitalised(surface)) continue;
        const before = text.slice(Math.max(0, first.start - 60), first.start);
        const venue = VENUE_PREP[lang].test(before);
        if (!venue && !PLACE_PREP[lang].test(before)) continue;
        const key = foldPlaceName(surface);
        const found = [...citiesNamed(key), ...citiesByExonym(key)];
        const best = [...found].sort((x, y) => (y.p ?? 0) - (x.p ?? 0))[0];
        if (
          best !== undefined &&
          ((best.p ?? 0) >= MIN_CITY_POPULATION || best.fc === 'PPLC' || venue)
        ) {
          const countries = new Set(found.map((c) => c.cc));
          const iso2 = countries.size === 1 ? best.cc : '';
          taken.push({
            id: `CITY:${iso2 || 'XX'}:${best.n}`,
            type: 'CITY',
            iso3: null,
            parentIso3: iso2 === '' ? null : (findCountryByIso2(iso2)?.iso3 ?? null),
            surface,
            start: first.start,
            end: last.end,
            basis: 'GAZETTEER_CITY',
          });
          i += k - 1;
          break;
        }
        if (k === 1 && venue && !NOT_A_PLACE.test(surface))
          taken.push({
            id: `PLACE:${first.start}`,
            type: 'PLACE',
            iso3: null,
            parentIso3: null,
            surface,
            start: first.start,
            end: last.end,
            basis: 'UNRESOLVED_PLACE',
          });
      }
    }
  }
  return taken.sort((a, b) => a.start - b.start);
}

/** The governed localized identity data, for the registry proof spec. */
export const LOCALIZED_IDENTITY_DATA = {
  aliases: GOVERNED_ALIASES,
  regions: LOCALIZED_REGIONS,
  cities: LOCALIZED_CITIES,
  demonyms: DEMONYMS,
} as const;
