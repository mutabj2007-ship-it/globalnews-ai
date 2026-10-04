import { createElement, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DISPLAY_LOCALES, DISPLAY_LOCALE_META, type DisplayLocale } from '@globalnews-ai/shared';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { AskR2TurnView } from '@/components/ask-frame/AskR2TurnView';
import { fixture } from '@/components/analysis-frame/frameFixtures';
import { ASK_PRODUCT_NAME } from '../askBrand';
import { ASK_SHELL_PROPER_NOUNS } from '../shell/askShellSource';
import { askShellStrings } from '../shell/askShellCatalogue';
import { qualifiedUnchangedFor } from '../shell/askShellQualifiedUnchanged';
import { askCountryName } from '../askCountryName';

/** The countries the fixtures name: in each locale their CLDR name is DATA (a proper noun). */
export const FIXTURE_COUNTRIES = ['KEN', 'RWA', 'COD', 'COG', 'TZA', 'POL'];

/**
 * The entry-view wordmark above the composer (AskFrameScreen, data-ask="entry-brand"). H's
 * comment records it as L's qualified, untranslated eyebrow. It is a SECOND spelling of the
 * brand beside the ruled "Ask GlobalNewsAI" — accepted here as a declared proper noun and
 * flagged to the CTO in the integration report, not changed by the integrator.
 */
export const ENTRY_WORDMARK = 'GlobalNews AI';

const valueAt = (tree: unknown, path: string): unknown =>
  path
    .replace(/()$/, '')
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      tree,
    );

/**
 * Values a localized surface may legitimately share with English: the canonical brand, declared
 * proper nouns, language endonyms and codes (each language is named in its OWN language, by
 * design), and the values Claude L marked QUALIFIED_UNCHANGED for THIS locale.
 */
export function declaredUnchanged(locale: DisplayLocale): Set<string> {
  const out = new Set<string>([ASK_PRODUCT_NAME, ENTRY_WORDMARK, ...ASK_SHELL_PROPER_NOUNS]);
  for (const l of DISPLAY_LOCALES) {
    out.add(DISPLAY_LOCALE_META[l].endonym);
    out.add(l.toUpperCase());
  }
  for (const iso3 of FIXTURE_COUNTRIES) {
    const name = askCountryName(iso3, locale);
    if (name !== undefined) out.add(name);
  }
  const shell = askShellStrings(locale);
  for (const path of qualifiedUnchangedFor(locale)) {
    const v = valueAt(shell, path);
    if (typeof v === 'string') out.add(v.trim());
  }
  return out;
}

/**
 * TEST KIT (no tests here) — shared by the rendered-surface acceptance specs.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * R4 · RENDERED-SURFACE LANGUAGE ACCEPTANCE (CTO "COMPLETE R4 LOCALIZATION CONVERGENCE")
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A catalogue holding a translated string is not acceptance. Acceptance is: the selected locale →
 * the string a reader actually sees, on every reachable Ask surface. Each surface is RENDERED by
 * its real component in English and in fr / de / es / pt / ar, and every user-visible value
 * (text nodes, aria-label, title, placeholder, alt) of the localized render that is byte-equal to
 * a value of the English render is a fallback — unless it is DATA (the fixture's own question,
 * headlines, source titles, publishers, URLs), the canonical product brand, a declared proper
 * noun, or carries no words at all (numbers, dates, punctuation).
 */

export const LOCALES: readonly DisplayLocale[] = ['fr', 'de', 'es', 'pt', 'ar'];

/** Every string reachable inside a value: the fixture's own data is never "English chrome". */
export function dataStrings(...values: unknown[]): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      out.add(v.trim());
      for (const part of v.split(/\n+/)) out.add(part.trim());
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === 'object') Object.values(v).forEach(walk);
  };
  values.forEach(walk);
  return out;
}

const VISIBLE_ATTRS = ['aria-label', 'title', 'placeholder', 'alt'] as const;

/** Every value a reader can read or hear: text nodes and the accessible attributes. */
export function visibleValues(r: ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (node.trim() !== '') out.push(node.trim());
    } else if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object') {
      const n = node as { props?: Record<string, unknown>; children?: unknown };
      for (const a of VISIBLE_ATTRS) {
        const v = n.props?.[a];
        if (typeof v === 'string' && v.trim() !== '') out.push(v.trim());
      }
      walk(n.children);
    }
  };
  walk(r.toJSON());
  return out;
}

/**
 * Every visible text node with the direction it inherits: the nearest ancestor `dir`, where an
 * explicitly ISOLATED run (unicode-bidi: isolate — numbers, URLs, citation markers) is reported
 * as such. Full-surface RTL means: in Arabic, no wording sits outside an rtl scope.
 */
export function textDirections(
  r: ReactTestRenderer,
): { text: string; dir: string; isolated: boolean }[] {
  const out: { text: string; dir: string; isolated: boolean }[] = [];
  const walk = (node: unknown, dir: string, isolated: boolean): void => {
    if (typeof node === 'string') {
      if (node.trim() !== '') out.push({ text: node.trim(), dir, isolated });
    } else if (Array.isArray(node)) node.forEach((n) => walk(n, dir, isolated));
    else if (node !== null && typeof node === 'object') {
      const n = node as { props?: Record<string, unknown>; children?: unknown };
      const own = typeof n.props?.dir === 'string' ? (n.props.dir as string) : dir;
      const style = n.props?.style as { unicodeBidi?: string } | undefined;
      walk(n.children, own, isolated || style?.unicodeBidi === 'isolate');
    }
  };
  walk(r.toJSON(), '(none)', false);
  return out;
}

export function renderTree(element: ReactElement): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(element);
  });
  return r;
}

const WORDLESS = /^[\s\d\p{P}\p{S}·•–—]*$/u;

/** Values of the localized render that are the English render's own chrome. */
export function englishLeaks(
  english: readonly string[],
  localized: readonly string[],
  data: Set<string>,
  locale: DisplayLocale,
): string[] {
  const en = new Set(english);
  const allowed = declaredUnchanged(locale);
  return [
    ...new Set(
      localized.filter(
        (v) => en.has(v) && !isData(v, data) && !allowed.has(v) && !WORDLESS.test(v) && !isUrl(v),
      ),
    ),
  ];
}
const isUrl = (v: string): boolean => /^(?:https?:\/\/|www\.)\S+$/i.test(v);
/** Authored model text is DATA: a rendered fragment of it (markdown split into nodes) is too. */
const unmark = (t: string): string =>
  t.replace(/[*_#>`]+/g, '').replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '');
function isData(raw: string, data: Set<string>): boolean {
  /* a separator the card puts before a data value ("· households") is not wording */
  const v = raw.replace(/^[s·•|,:;–—-]+/u, '').trim();
  if (v === '' || data.has(v)) return true;
  for (const d of data) if (d.length >= v.length && unmark(d).includes(v)) return true;
  return false;
}

/* ── the answer turn ──────────────────────────────────────────────────────────── */

export const QUESTION = 'What is the Paris Agreement and what are countries doing now?';
const PARIS =
  'The Paris Agreement is a legally binding treaty on climate change.\n\n' +
  '## How it works\n\n- Each party submits a **Nationally Determined Contribution**.\n- Progress is reviewed every five years.\n\n' +
  '## Steps\n\n1. Submit an NDC.\n2. Report emissions.\n\n**Bottom line:** it sets the frame for national action.';

const base = {
  schema: 'ask-r2-result/1',
  route: {
    questionClass: 'CURRENT_REPORTING',
    terminalState: 'EXECUTABLE',
    scopedBy: 'TYPED_GEOGRAPHY',
    refusals: [],
    disclosures: [],
    clarification: [],
    normalization: 'QUALIFIED',
    questionLanguage: 'en',
  },
  chips: { kind: 'NONE' },
  checkedAt: '2026-09-29T20:00:00Z',
  modelPriorCitable: false,
  intelligence: null,
};

/** The sourced card with ONE conditional branch switched on (fields only — the fixture's own data). */
function sourcedWith(over: (a: ReturnType<typeof fixture>) => ReturnType<typeof fixture>) {
  return (): { payload: AskR2Payload } => ({
    payload: {
      ...base,
      answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
      aiExecuted: true,
      analysis: over(fixture()),
      background: null,
    } as unknown as AskR2Payload,
  });
}
const ctx = (a: ReturnType<typeof fixture>, extra: Record<string, unknown>) =>
  ({ ...a, retrievalContext: { ...a.retrievalContext, ...extra } }) as ReturnType<typeof fixture>;
const coverage = (
  iso2: string,
  iso3: string,
  name: string,
  over: Record<string, unknown> = {},
) => ({
  countryName: name,
  iso2,
  iso3,
  requested: true,
  liveRetrievalAttempted: true,
  usableLiveEvidenceCount: 2,
  usableRetainedEvidenceCount: 1,
  finalQualifyingEvidenceCount: 3,
  finalLiveEvidenceCount: 2,
  finalRetainedEvidenceCount: 1,
  providers: ['gnews'],
  providerFailureKinds: [],
  retrievalState: 'LIVE_EVIDENCE',
  localSourceProvenance: 'NOT_ESTABLISHED',
  coverageGap: false,
  coverageGapReason: null,
  liveArticleIds: [],
  retainedArticleIds: [],
  ...over,
});

/** Every conditional branch of the sourced answer card, one fixture each. */
export const CARD_BRANCHES = {
  storedReporting: sourcedWith((a) =>
    ctx(a, {
      dataMode: 'cached',
      outcome: 'RETAINED_ONLY',
      newestArticlePublishedAt: '2026-09-29T12:00:00Z',
    }),
  ),
  eventAnchor: sourcedWith((a) =>
    ctx(a, {
      eventAnchor: {
        topic: 'plane crash',
        source: 'current-question',
        countryIso3: 'KEN',
        aspects: { cause: true, effect: true, crossBorder: true },
        directEventArticleIds: [],
        consequenceArticleIds: [],
        disclosures: [
          'COUNTRY_INTERPRETED_FROM_EVIDENCE',
          'CROSS_BORDER_NOT_ESTABLISHED',
          'CAUSE_NOT_ESTABLISHED',
          'CONTEXT_SEPARATED',
        ],
        contextOnlyClaimsWithheld: 2,
      },
    }),
  ),
  continuing: sourcedWith((a) =>
    ctx(a, {
      conversationSubject: {
        subject: 'EU AI regulation',
        focus: ['households'],
        focusDisplay: ['households'],
        disclosures: ['PRODUCT_APPLICABILITY_NOT_ESTABLISHED', 'FOCUS_NOT_IN_EVIDENCE'],
      },
    }),
  ),
  comparison: sourcedWith((a) =>
    ctx(a, {
      comparisonCoverage: [
        coverage('RW', 'RWA', 'Rwanda'),
        coverage('KE', 'KEN', 'Kenya', {
          finalQualifyingEvidenceCount: 0,
          retrievalState: 'PROVIDER_UNAVAILABLE',
          providerFailureKinds: ['rate-limited', 'timeout'],
        }),
      ],
    }),
  ),
  sourceDates: sourcedWith((a) => ctx(a, { datesRequested: true })),
  relational: sourcedWith(
    (a) =>
      ({
        ...a,
        analysis: {
          ...a.analysis,
          relationalComposition: { summary: 'Both sides restored the border crossing.' },
        },
      }) as ReturnType<typeof fixture>,
  ),
  briefWithheld: sourcedWith(
    (a) =>
      ({
        ...a,
        analysis: {
          ...a.analysis,
          briefState: {
            availability: 'withheld-non-compliant',
            reason: 'Uncited statement removed.',
          },
        },
      }) as ReturnType<typeof fixture>,
  ),
  noEvidence: sourcedWith((a) => ({ ...a, analysis: null }) as ReturnType<typeof fixture>),
  askedNoPriorSubject: sourcedWith(
    (a) =>
      ({
        ...ctx(a, {
          retrievalOutcome: 'CLARIFICATION_REQUIRED',
          clarificationReason: 'NO_PRIOR_SUBJECT',
          clarificationCandidates: ['KEN'],
        }),
        analysis: null,
      }) as ReturnType<typeof fixture>,
  ),
  ambiguousCountry: sourcedWith(
    (a) =>
      ({
        ...ctx(a, {
          retrievalOutcome: 'CLARIFICATION_REQUIRED',
          clarificationReason: 'AMBIGUOUS_COUNTRY',
          clarificationCandidates: ['COD', 'COG'],
        }),
        analysis: null,
      }) as ReturnType<typeof fixture>,
  ),
};

export const TURNS: Record<string, () => { payload: AskR2Payload | null; failure?: string }> = {
  ...CARD_BRANCHES,
  sourced: () => ({
    payload: {
      ...base,
      answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
      aiExecuted: true,
      analysis: fixture(),
      background: null,
    } as unknown as AskR2Payload,
  }),
  mixed: () => ({
    payload: {
      ...base,
      answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
      aiExecuted: true,
      analysis: fixture(),
      background: { text: PARIS },
      guidance: { kind: 'MIXED_REFERENCE_CURRENT', currentPart: 'SOURCED', stablePart: 'ANSWERED' },
    } as unknown as AskR2Payload,
  }),
  reasoning: () => ({
    payload: {
      ...base,
      answer: {
        state: 'REFERENCE_BACKGROUND',
        basis: 'PLAN_NO_REQUIRED_EVIDENCE',
        missingRoles: [],
      },
      aiExecuted: true,
      analysis: null,
      background: { text: PARIS },
    } as unknown as AskR2Payload,
  }),
  clarification: () => ({
    payload: {
      ...base,
      answer: {
        state: 'CLARIFICATION_REQUIRED',
        basis: 'NO_PRIOR_SUBJECT',
        missingRoles: [],
        candidates: [],
      },
      aiExecuted: false,
      analysis: null,
      background: null,
    } as unknown as AskR2Payload,
  }),
  priorUnresolved: () => ({
    payload: {
      ...base,
      answer: {
        state: 'CLARIFICATION_REQUIRED',
        basis: 'PRIOR_REFERENCE_UNRESOLVED',
        missingRoles: [],
      },
      aiExecuted: false,
      analysis: null,
      background: null,
    } as unknown as AskR2Payload,
  }),
  officialUnavailable: () => ({
    payload: {
      ...base,
      answer: {
        state: 'CAPABILITY_UNAVAILABLE',
        basis: 'OFFICIAL_SOURCE_UNAVAILABLE',
        missingRoles: ['OFFICIAL'],
      },
      aiExecuted: false,
      analysis: null,
      background: null,
    } as unknown as AskR2Payload,
  }),
  failure: () => ({ payload: null, failure: 'REQUEST_FAILED' }),
};

export function renderTurn(kind: string, locale: DisplayLocale): ReactTestRenderer {
  const t = TURNS[kind]();
  return renderTree(
    createElement(AskR2TurnView, {
      turn: {
        question: QUESTION,
        ...(t.payload === null ? {} : { payload: t.payload }),
        ...(t.failure ? { failure: t.failure } : {}),
      } as never,
      locale,
      context: undefined,
    }),
  );
}
