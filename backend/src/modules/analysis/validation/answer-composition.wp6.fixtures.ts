import type { CompositionContext, CompositionFinding } from './answer-composition.util';

/*
  RETRIEVAL R1 · WP6 — the composition fixtures (synthetic text only), shared by the checker spec
  and the offline render probe. 8 WP6 fixtures + EA W1–W13 + P-16c / P-16d / P-17c + cargo.
*/

export interface Case {
  readonly id: string;
  readonly covers: readonly string[];
  readonly ctx: CompositionContext;
  readonly good: string;
  readonly mustContain?: readonly string[];
  readonly mustBold?: readonly string[];
  readonly bad: ReadonlyArray<{
    readonly label: string;
    readonly text: string;
    readonly code: CompositionFinding;
  }>;
}

const GOICO = {
  evidenceIds: ['ev-goico-en', 'ev-goico-rw'],
  evidenceUrls: [
    'https://rw-daily.example/goico-fire',
    'https://musanze-amakuru.example/isoko-goico',
  ],
  publishers: ['Synthetic Rwanda Daily', 'Synthetic Musanze Amakuru'],
  evidenceText: [
    'fire at GOICO Plaza, Musanze District, Rwanda, on Saturday 10 October 2026',
    "traders' stalls damaged",
    'fire said to have started on the upper floor',
    'fire at GOICO market, Musanze; fire said to have started on the ground floor',
    'the market hosts about 1,550 traders and 25,000 daily visitors',
    'the District Mayor told Synthetic Rwanda Daily that details would follow',
    'published 10 October 2026, 14:00 UTC; published 10 October 2026, 16:30 UTC',
  ],
} as const;

const KENNEDY = {
  evidenceIds: ['ev-tk-wire', 'ev-tk-regional'],
  publishers: ['Synthetic International Wire', 'Synthetic Kigali Regional Desk'],
  independentChains: 1,
  placesNotEstablished: ['Republic of the Congo', 'Brazzaville', 'Denmark'],
  allegationTerms: ['Rwandan-backed', 'Africa Corps', 'M23'],
  evidenceText: [
    'ambush on 17 September 2026 in South Kivu, eastern Democratic Republic of the Congo',
    'former UFC fighter Tim Kennedy among the wounded, according to sources',
    'Vectus Global contractors involved, according to sources',
    'about 20 dead or wounded, sources told Synthetic International Wire',
    'published 9 October 2026 (wire); published 8 October 2026 (regional desk); first seen 9 October 2026',
  ],
} as const;

export const CASES: readonly Case[] = [
  {
    id: 'P-16a',
    covers: [
      'GOICO bilingual fire',
      'W1 disputed floor',
      'W2 market size as description',
      'W3 cause not established',
      'W4 statement attributed to outlet',
      'W5 Musanze precision',
    ],
    ctx: {
      ...GOICO,
      placesNotEstablished: ['Kigali'],
      disputed: [{ variants: ['upper floor', 'ground floor'] }],
      descriptiveNumbers: ['1,550', '25,000'],
      causeUnknown: true,
      requireCitedBullets: true,
    },
    good: [
      'A fire damaged the **GOICO Plaza** market in **Musanze District, Rwanda** on **10 October 2026** [ev-goico-en].',
      '',
      '## Verified facts',
      "- Traders' stalls were damaged [ev-goico-en].",
      '- The market hosts about 1,550 traders and 25,000 daily visitors, according to Synthetic Rwanda Daily [ev-goico-en].',
      '- Reports differ on where the fire started: the upper floor [ev-goico-en] or the ground floor [ev-goico-rw].',
      '- The District Mayor told Synthetic Rwanda Daily that details would follow [ev-goico-en].',
      '',
      '## What remains unverified',
      'The cause, any casualties or losses, and the floor where the fire started are not established; reports differ (upper floor vs ground floor).',
      '',
      '## Sources',
      'Synthetic Rwanda Daily (EN) · 10 October 2026, 14:00 UTC; Synthetic Musanze Amakuru (RW) · 10 October 2026, 16:30 UTC.',
    ].join('\n'),
    mustContain: [
      '## Verified facts',
      '## What remains unverified',
      'cause',
      'casualties or losses',
      'reports differ',
    ],
    mustBold: ['GOICO Plaza', 'Musanze District, Rwanda', '10 October 2026'],
    bad: [
      {
        label: 'invented casualty count',
        text: '5 people were killed in the GOICO Plaza fire [ev-goico-en].',
        code: 'UNATTRIBUTED_CASUALTY_FIGURE',
      },
      {
        label: 'W2 market size as a loss',
        text: '1,550 traders lost their stalls in the fire [ev-goico-en].',
        code: 'DESCRIPTIVE_NUMBER_AS_IMPACT',
      },
      {
        label: 'W3 cause as fact',
        text: 'The fire was caused by an electrical fault [ev-goico-en].',
        code: 'UNVERIFIED_CAUSE_ASSERTED',
      },
      {
        label: 'W1 one floor chosen',
        text: 'The fire started on the upper floor [ev-goico-en].',
        code: 'DISPUTED_CLAIM_RESOLVED',
      },
      {
        label: 'W5 wrong place',
        text: 'A fire hit a market in Kigali [ev-goico-en].',
        code: 'GEOGRAPHY_NOT_ESTABLISHED',
      },
      {
        label: 'W4 statement without outlet',
        text: 'The District Mayor said details would follow.',
        code: 'STATEMENT_WITHOUT_OUTLET',
      },
      { label: 'uncited bullet', text: "- Traders' stalls were damaged.", code: 'UNCITED_BULLET' },
      {
        label: 'invented link',
        text: 'See https://news.example/other [ev-goico-en].',
        code: 'URL_NOT_IN_EVIDENCE',
      },
    ],
  },
  {
    id: 'P-16b',
    covers: ['coverage hold; no negative event assertion'],
    ctx: { coverageHold: true, evidenceIds: [] },
    good:
      'No verified report about a fire at **GOICO Plaza** could be checked from the sources Ask is permitted to use for Rwanda. ' +
      'This is not evidence that nothing happened: Rwanda has no enabled local source here, and the checked provider returned no matching report.',
    mustContain: ['not evidence that nothing happened', 'permitted to use for Rwanda'],
    bad: [
      {
        label: 'negative assertion',
        text: 'There was no fire at GOICO Plaza.',
        code: 'NEGATIVE_EVENT_ASSERTION',
      },
      {
        label: 'fabricated source',
        text: 'Nothing was found [ev-goico-en].',
        code: 'CITATION_NOT_IN_EVIDENCE',
      },
    ],
  },
  {
    id: 'P-16c',
    covers: ['W6 "Updated" item drives a what-changed line with both timestamps'],
    ctx: {
      evidenceIds: ['ev-goico-en', 'ev-goico-upd'],
      evidenceText: [
        'fire at GOICO Plaza, Musanze District, Rwanda, on 10 October 2026; published 10 October 2026, 14:00 UTC',
        'UPDATED: traders relocated to temporary stalls; published 11 October 2026, 09:00 UTC',
      ],
      requireCitedBullets: true,
    },
    good: [
      'Traders moved to temporary stalls after the **10 October 2026** fire at GOICO Plaza, Musanze [ev-goico-upd].',
      '',
      '## What changed since the first report',
      '- First report: published 10 October 2026, 14:00 UTC [ev-goico-en].',
      '- Update: published 11 October 2026, 09:00 UTC — traders relocated to temporary stalls [ev-goico-upd].',
    ].join('\n'),
    mustContain: ['What changed since the first report', '14:00 UTC', '09:00 UTC'],
    bad: [
      {
        label: 'update time invented',
        text: '- Update: published 12 October 2026 [ev-goico-upd].',
        code: 'NUMBER_NOT_IN_EVIDENCE',
      },
    ],
  },
  {
    id: 'P-16d',
    covers: ['W13 Kinyarwanda unsupported → language + coverage hold, never "no fire"'],
    ctx: { coverageHold: true, evidenceIds: [] },
    good:
      'Ask could not check Kinyarwanda-language reporting: the search provider does not support Kinyarwanda, and Rwanda has no enabled local source here. ' +
      'No verified report was found, which is not evidence that no fire occurred.',
    mustContain: ['does not support Kinyarwanda', 'not evidence'],
    bad: [
      {
        label: 'no fire asserted',
        text: 'There was no fire in Musanze, going by the checked sources.',
        code: 'NEGATIVE_EVENT_ASSERTION',
      },
    ],
  },
  {
    id: 'P-17a',
    covers: [
      'Kennedy COD chain/actor',
      'W7 four time facts',
      'W8 attributed casualty figure',
      'W9 allegations attributed',
      'W10 one reporting chain',
    ],
    ctx: KENNEDY,
    good: [
      'Former UFC fighter **Tim Kennedy** was among those wounded in an ambush in **South Kivu, eastern Democratic Republic of the Congo**, according to sources cited by Synthetic International Wire [ev-tk-wire].',
      '',
      '| Time fact | Value |',
      '|---|---|',
      '| Happened on | 17 September 2026, as reported [ev-tk-wire] |',
      '| First publicly mentioned | unknown |',
      '| Reported on | 9 October 2026, Synthetic International Wire [ev-tk-wire]; 8 October 2026, Synthetic Kigali Regional Desk [ev-tk-regional] |',
      '| First seen by GlobalNewsAI | 9 October 2026 |',
      '',
      '- About 20 people were dead or wounded, sources told Synthetic International Wire [ev-tk-wire].',
      '- Vectus Global contractors were involved, according to the same sources [ev-tk-wire].',
      '- Who carried out the attack is disputed: claims of Rwandan-backed involvement are allegations carried by the wire, and Rwanda has denied them [ev-tk-wire].',
      '',
      'The regional report repeats the wire account; the two are not shown to be independent.',
    ].join('\n'),
    mustContain: [
      'Happened on',
      'First publicly mentioned',
      'Reported on',
      'First seen by GlobalNewsAI',
      'not shown to be independent',
    ],
    mustBold: ['Tim Kennedy', 'South Kivu, eastern Democratic Republic of the Congo'],
    bad: [
      {
        label: 'W7 "first reported by"',
        text: 'Synthetic International Wire first reported the ambush [ev-tk-wire].',
        code: 'FIRST_REPORT_CLAIM',
      },
      {
        label: 'W8 unattributed casualties',
        text: 'About 20 people were killed in the ambush [ev-tk-wire].',
        code: 'UNATTRIBUTED_CASUALTY_FIGURE',
      },
      {
        label: 'W10 corroboration over one chain',
        text: 'Several outlets confirmed that Kennedy was wounded [ev-tk-wire].',
        code: 'CORROBORATION_OVER_SINGLE_CHAIN',
      },
      {
        label: 'W9 allegation as fact',
        text: 'Rwandan-backed fighters ambushed the convoy [ev-tk-wire].',
        code: 'ALLEGATION_AS_FACT',
      },
      {
        label: 'COG location',
        text: 'The ambush happened near Brazzaville [ev-tk-wire].',
        code: 'GEOGRAPHY_NOT_ESTABLISHED',
      },
      {
        label: 'Denmark from DRC acronym',
        text: 'The Danish Refugee Council confirmed Denmark was involved [ev-tk-wire].',
        code: 'GEOGRAPHY_NOT_ESTABLISHED',
      },
    ],
  },
  {
    id: 'P-17b',
    covers: ['W11 same person, different event: no Congo answer from the podcast item'],
    ctx: { evidenceIds: [] },
    good:
      'No permitted report about the Congo ambush was found in the checked sources. ' +
      "The one retrieved item concerns **Tim Kennedy**'s podcast appearance, a different event, and is not used here.",
    mustContain: ['different event', 'No permitted report'],
    bad: [
      {
        label: 'podcast cited as the Congo event',
        text: 'Kennedy was wounded in Congo [ev-tk-mma].',
        code: 'CITATION_NOT_IN_EVIDENCE',
      },
    ],
  },
  {
    id: 'P-17c',
    covers: ['W12 CG-tagged evidence for a COD question → geography not determined'],
    ctx: { evidenceIds: ['ev-cg'], placesNotEstablished: ['Republic of the Congo', 'Brazzaville'] },
    good: 'One report describes an ambush in "Congo" [ev-cg], but its geography is **not determined**: the report does not say which Congo, so it is not attributed to either country here.',
    mustContain: ['not determined'],
    bad: [
      {
        label: 'COG asserted',
        text: 'The ambush took place in the Republic of the Congo [ev-cg].',
        code: 'GEOGRAPHY_NOT_ESTABLISHED',
      },
    ],
  },
  {
    id: 'P-08',
    covers: ['premise check: the 24% figure is unverified', 'ports, proper figures'],
    ctx: {
      evidenceIds: ['ev-port'],
      evidenceText: [
        'share of Rwandan transit cargo via Dar es Salaam rose in 2026 (no percentage given)',
      ],
      questionText:
        'Rwanda now ships 24% of its trade through Dar es Salaam instead of Mombasa — why?',
    },
    good: [
      'The **24%** figure in the question is not supported by the evidence: the cited report says only that the share of Rwandan transit cargo through **Dar es Salaam** rose in 2026 [ev-port].',
      '',
      '## Reasons given in the evidence',
      '- The evidence does not state reasons for the shift; it reports the direction only [ev-port].',
    ].join('\n'),
    mustContain: ['not supported by the evidence'],
    bad: [
      {
        label: '24% asserted as fact',
        text: 'Rwanda ships 24% of its trade through Dar es Salaam [ev-port].',
        code: 'NUMBER_NOT_IN_EVIDENCE',
      },
    ],
  },
  {
    id: 'P-09',
    covers: ['Kigeli V source-first chronology: unsourced, labelled, no citation'],
    ctx: { evidenceIds: [] },
    good:
      "The exact chronology of **Kigeli V**'s departure from Rwanda was not verified against a cited source, so no date is given here as established. " +
      "Background (not from a cited source): he left during the country's transition to independence; the year and the reason should be checked against a primary source.",
    mustContain: ['not verified against a cited source', 'not from a cited source'],
    bad: [
      {
        label: 'invented citation',
        text: 'Kigeli V left Rwanda in 1961 [ev-history].',
        code: 'CITATION_NOT_IN_EVIDENCE',
      },
      {
        label: 'confidence score',
        text: 'Kigeli V left Rwanda in 1961 (confidence 90%).',
        code: 'SCORE_OR_CONFIDENCE_MARKER',
      },
    ],
  },
  {
    id: 'P-CALC',
    covers: ['calculation: inputs, formula, period, result equal to the engine'],
    ctx: {
      evidenceText: [
        'engine: principal 900, repaid 1,050, years 1, interest 150, rate 0.1667, result 16.67%, exact 16.6667%',
      ],
    },
    good: [
      'The simple annual rate is **16.67%** (exact 16.6667%).',
      '',
      '1. Interest: 1,050 − 900 = 150.',
      '2. Rate: 150 / 900 = 0.1667 over 1 year.',
      '3. As a percentage: 16.67%, rounded to two decimals.',
    ].join('\n'),
    mustContain: ['1,050 − 900', '150 / 900', '1 year', '16.67%'],
    bad: [
      {
        label: 'rate not equal to the engine',
        text: 'The rate is 17% per year.',
        code: 'NUMBER_NOT_IN_EVIDENCE',
      },
    ],
  },
  {
    id: 'P-CMP',
    covers: ['comparison table with units, period, source; measures labelled as different'],
    ctx: {
      evidenceIds: ['ev-cpi-rw', 'ev-cpi-ke'],
      evidenceText: [
        'urban CPI annual change 6.1%, September 2026',
        'annual inflation 4.3%, September 2026',
      ],
    },
    good: [
      "Rwanda's urban CPI rose **6.1%** and Kenya's national inflation was **4.3%** in September 2026; the two measures differ.",
      '',
      '| Country | Measure | Value | Period | Source |',
      '|---|---|---|---|---|',
      '| Rwanda | Urban CPI, annual change | 6.1% | September 2026 | Synthetic Rwanda Statistics Office [ev-cpi-rw] |',
      '| Kenya | National CPI, annual inflation | 4.3% | September 2026 | Synthetic Kenya Statistics Bureau [ev-cpi-ke] |',
      '',
      'Urban CPI and national CPI are different measures and are not directly comparable.',
    ].join('\n'),
    mustContain: ['| Country | Measure | Value | Period | Source |', 'different measures'],
    bad: [
      {
        label: 'value not in evidence',
        text: 'Kenya inflation was 5.0% in September [ev-cpi-ke].',
        code: 'NUMBER_NOT_IN_EVIDENCE',
      },
      {
        label: 'score-like marker',
        text: 'Rwanda inflation risk: 8/10 [ev-cpi-rw].',
        code: 'SCORE_OR_CONFIDENCE_MARKER',
      },
    ],
  },
  {
    id: 'P-CARGO',
    covers: ['cargo volume ≠ freight price'],
    ctx: {
      evidenceIds: ['ev-cargo'],
      volumeOnly: true,
      evidenceText: ['Dar es Salaam handled 12% more Rwandan transit cargo in 2026'],
    },
    good: 'Transit cargo volume through Dar es Salaam rose **12%** in 2026 [ev-cargo]. This is a volume change; the evidence reports no change in freight prices or transport costs.',
    mustContain: ['volume change'],
    bad: [
      {
        label: 'volume stated as price',
        text: 'Freight prices rose 12% in 2026 [ev-cargo].',
        code: 'VOLUME_STATED_AS_PRICE',
      },
    ],
  },
];
