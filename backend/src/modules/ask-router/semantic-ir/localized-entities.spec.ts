import { COUNTRIES, findCountryByIso3 } from '@globalnews-ai/shared';
import { LOCALIZED_COUNTRY_NAMES, type LocalizedLanguage } from './localized-country-names';
import {
  foldLocalized,
  LOCALIZED_IDENTITY_DATA,
  readLocalizedEntityCandidates,
} from './localized-entities';

/**
 * CTO R4 SEVEN-LANGUAGE RULING §5 — the localized country / region registry proof. Every localized
 * form resolves DIRECTLY to the existing registry id; nothing is canonicalized via English.
 */
const ids = (text: string, lang: LocalizedLanguage) =>
  readLocalizedEntityCandidates(text, lang).map((e) => e.id);

describe('localized registry — integrity', () => {
  const LANGS: LocalizedLanguage[] = ['fr', 'de', 'es', 'pt', 'ar'];

  it.each(LANGS)(
    '%s: every generated row names an existing registry entry, and no folded form names two',
    (lang) => {
      const seen = new Map<string, string>();
      for (const [form, iso3] of LOCALIZED_COUNTRY_NAMES[lang]) {
        expect(findCountryByIso3(iso3)).toBeDefined();
        const key = foldLocalized(form);
        if (seen.has(key)) expect(seen.get(key)).toBe(iso3);
        seen.set(key, iso3);
      }
      /* every registry entry with a CLDR region code has a localized name */
      const covered = new Set(LOCALIZED_COUNTRY_NAMES[lang].map(([, iso3]) => iso3));
      const missing = COUNTRIES.filter(
        (c) => !covered.has(c.iso3) && (c as { status?: string }).status !== 'SPECIAL_MAP_AREA',
      ).map((c) => c.iso3);
      expect(missing.length).toBeLessThanOrEqual(2);
    },
  );

  it('governed aliases, regions, cities and demonyms only name existing registry entries', () => {
    for (const rows of Object.values(LOCALIZED_IDENTITY_DATA.aliases))
      for (const [, iso3] of rows) expect(findCountryByIso3(iso3)).toBeDefined();
    for (const rows of Object.values(LOCALIZED_IDENTITY_DATA.demonyms))
      for (const [iso3] of rows) expect(findCountryByIso3(iso3)).toBeDefined();
  });
});

describe('localized registry — canonical names, inflections and governed aliases', () => {
  it.each<[LocalizedLanguage, string, string[]]>([
    /* French: names, elision, articles, aliases */
    ['fr', "Que se passe-t-il entre l'Allemagne et la Pologne ?", ['COUNTRY:DEU', 'COUNTRY:POL']],
    ['fr', 'Les relations entre les États-Unis et la Chine', ['COUNTRY:USA', 'COUNTRY:CHN']],
    ['fr', "La situation dans l'est de la RDC", ['COUNTRY:COD']],
    [
      'fr',
      "Pourquoi les Emirats arabes unis investissent-ils en Côte d'Ivoire ?",
      ['COUNTRY:ARE', 'COUNTRY:CIV'],
    ],
    ['fr', 'Le couple franco-allemand est-il en crise ?', ['COUNTRY:FRA', 'COUNTRY:DEU']],
    ['fr', 'Que veut le gouvernement algérien ?', ['COUNTRY:DZA']],
    /* German: names, genitive, case forms, aliases, combined adjectives */
    ['de', 'Wie steht es um die Wirtschaft Russlands?', ['COUNTRY:RUS']],
    ['de', 'Was wollen die USA von der Türkei?', ['COUNTRY:USA', 'COUNTRY:TUR']],
    ['de', 'Die deutsch-polnischen Beziehungen seit 1990', ['COUNTRY:DEU', 'COUNTRY:POL']],
    ['de', 'Warum investieren die VAE in Ägypten?', ['COUNTRY:ARE', 'COUNTRY:EGY']],
    ['de', 'Was plant die chinesische Regierung?', ['COUNTRY:CHN']],
    /* Spanish */
    ['es', '¿Cómo están las relaciones entre EE. UU. y Venezuela?', ['COUNTRY:USA', 'COUNTRY:VEN']],
    ['es', 'El conflicto entre Marruecos y Argelia', ['COUNTRY:MAR', 'COUNTRY:DZA']],
    ['es', 'La política del gobierno colombiano', ['COUNTRY:COL']],
    /* Portuguese */
    ['pt', 'Como estão as relações do Brasil com a Argentina?', ['COUNTRY:BRA', 'COUNTRY:ARG']],
    ['pt', 'O que os EUA querem na Ucrânia?', ['COUNTRY:USA', 'COUNTRY:UKR']],
    ['pt', 'A inflação no Irão e na Polónia', ['COUNTRY:IRN', 'COUNTRY:POL']],
    /* Arabic: definite article, attached clitics, the لل contraction, aliases, nisba pairs */
    ['ar', 'ما طبيعة العلاقات بين روسيا والصين؟', ['COUNTRY:RUS', 'COUNTRY:CHN']],
    ['ar', 'ما هي سياسة الولايات المتحدة تجاه إيران؟', ['COUNTRY:USA', 'COUNTRY:IRN']],
    ['ar', 'لماذا تدعم أمريكا السعودية؟', ['COUNTRY:USA', 'COUNTRY:SAU']],
    ['ar', 'ما أهمية الصادرات للصين؟', ['COUNTRY:CHN']],
    ['ar', 'كيف تطورت العلاقات الروسية الأوكرانية؟', ['COUNTRY:RUS', 'COUNTRY:UKR']],
    ['ar', 'ماذا تريد الحكومة المصرية؟', ['COUNTRY:EGY']],
  ])('%s: %s', (lang, text, expected) => {
    expect(ids(text, lang).filter((id) => id.startsWith('COUNTRY:'))).toEqual(expected);
  });
});

describe('localized registry — regions, cities, unresolved places, no invented identity', () => {
  it('a disputed region is a REGION, never a state', () => {
    expect(ids('Le différend entre le Japon et la Chine sur les îles Senkaku', 'fr')).toEqual([
      'COUNTRY:JPN',
      'COUNTRY:CHN',
      'REGION:SENKAKU',
    ]);
    expect(ids('النزاع على الجولان بين سوريا وإسرائيل', 'ar')).toEqual([
      'REGION:GOLAN',
      'COUNTRY:SYR',
      'COUNTRY:ISR',
    ]);
  });

  it('a venue city keeps its parent as a fact, never as a named country', () => {
    const e = readLocalizedEntityCandidates('Gespräche zwischen Iran und den USA in Genf', 'de');
    expect(e.map((x) => x.id)).toEqual(['COUNTRY:IRN', 'COUNTRY:USA', 'CITY:CH:Geneva']);
    expect(e[2]).toMatchObject({ type: 'CITY', iso3: null, parentIso3: 'CHE' });
    expect(ids('محادثات بين إيران والولايات المتحدة في مسقط', 'ar')).toEqual([
      'COUNTRY:IRN',
      'COUNTRY:USA',
      'CITY:OM:Muscat',
    ]);
  });

  it('an unknown place where talks happened is an unresolved PLACE with no identity', () => {
    const e = readLocalizedEntityCandidates(
      'Les pourparlers entre le Mali et le Niger à Zarvanda',
      'fr',
    );
    const place = e.find((x) => x.type === 'PLACE');
    expect(place).toMatchObject({ surface: 'Zarvanda', iso3: null, parentIso3: null });
  });

  it('ambiguous forms and ordinary words are not read as states', () => {
    expect(ids('عمان', 'ar')).toEqual([]);
    expect(
      ids('Fui a Granada el verano pasado', 'es').filter((x) => x.startsWith('COUNTRY')),
    ).toEqual([]);
    expect(ids('Comprei um peru para o Natal', 'pt')).toEqual([]);
    expect(ids('Réponds en français, s’il te plaît', 'fr')).toEqual([]);
    expect(ids('Erklär das bitte auf Deutsch', 'de')).toEqual([]);
  });

  it('surfaces are verbatim spans of the reader text', () => {
    for (const [text, lang] of [
      ['Was wollen die USA von der Türkei?', 'de'],
      ['ما طبيعة العلاقات بين روسيا والصين؟', 'ar'],
      ["La situation dans l'est de la RDC", 'fr'],
    ] as const)
      for (const e of readLocalizedEntityCandidates(text, lang))
        expect(text.slice(e.start, e.end)).toBe(e.surface);
  });
});

describe('localized registry — inflection and attachment classes found by the seven-language battery', () => {
  it.each<[LocalizedLanguage, string, string[]]>([
    ['de', 'Wie ist die Lage in den Vereinigten Arabischen Emiraten?', ['COUNTRY:ARE']],
    ['de', 'Was planen die Vereinigten Staaten in Asien?', ['COUNTRY:USA']],
    ['de', 'Die Außenpolitik der Bundesrepublik nach 1949', ['COUNTRY:DEU']],
    ['es', '¿Cómo se obtiene la ciudadanía mexicana?', ['COUNTRY:MEX']],
    ['pt', 'Quanto vale hoje o peso argentino?', ['COUNTRY:ARG']],
    ['ar', 'ما سعر الدينار الأردني اليوم؟', ['COUNTRY:JOR']],
    ['fr', 'Que se passe-t-il au Burkina depuis janvier ?', ['COUNTRY:BFA']],
  ])('%s: %s', (lang, text, expected) => {
    expect(ids(text, lang).filter((id) => id.startsWith('COUNTRY:'))).toEqual(expected);
  });
  it('a book is not a state', () => {
    expect(ids('Le livre français le plus vendu', 'fr')).toEqual([]);
  });
});
