import type { AskCompanionTopic } from '@/lib/api/askV2Api';
import type { AskR2Locale } from '@/lib/ask/askR2Strings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ASK SURFACE'S LAST FOUR CATALOGUES — RECOVERED FROM INSIDE COMPONENTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R4 · PHASE B · CLAUDE H.
 *
 * ── WHY THIS FILE EXISTS, AND IT IS NOT A TIDYING EXERCISE ────────────────
 *
 * Phase B measured 479 reader-visible Ask-shell keys across the NAMED catalogues and wired
 * all of them to the reader's locale. Wiring the components then surfaced copy that the
 * measurement could not have seen, because it was not in a catalogue at all — it was
 * declared inside the components that render it:
 *
 *   `AskTurnCopy.tsx:14`         const STRINGS: Record<AskR2Locale, …>   3 keys
 *   `AskRecentReporting.tsx:18`  const T: Record<AskR2Locale, …>        10 keys, 6 of them templates
 *   `AskEvidenceTable.tsx:19`    const STRINGS = { en, pl } as const     7 keys, 2 of them templates
 *   `AskFrameScreen.tsx:233,537` bare `r2Locale === 'pl' ? … : …`         2 keys, 1 of them a template
 *   `AskCompactResult.tsx:264`   bare `language === 'pl' ? … : …`         1 key
 *
 * A module-private `const` is unreachable by ANY localization mechanism. No overlay can
 * replace it, no coverage report can count it, and no missing-key test can fail on it: a
 * French reader would have been shown "Copy", "Copied", "Coverage checked" and a dated
 * reporting title in English no matter how complete the catalogues became, and nothing in the
 * build would have said so. A bare ternary is the same defect without even a locale key.
 *
 * So these are not moved for neatness. They are moved because being inside a component is
 * exactly what made them invisible, and `shellFallbacks()` can only report a key it can
 * enumerate.
 *
 * ── NOTHING HERE IS NEWLY WORDED ──────────────────────────────────────────
 *
 * Every English and Polish string below is transcribed VERBATIM from the component it came
 * from, including punctuation and the middle dot. These surfaces have shipped copy and
 * accepted specs asserting it; a transcription that "improved" a sentence would be a copy
 * change smuggled into a localization round. The accompanying spec asserts the EN and PL
 * values are byte-identical to what the components rendered before.
 */

/* ────────────────────────────────────────────────────────────────────────────
   COPY ONE ANSWER — from AskTurnCopy.tsx
   ──────────────────────────────────────────────────────────────────────────── */

export interface AskCopyStrings {
  readonly copy: string;
  readonly copied: string;
  readonly failed: string;
}

const COPY_EN: AskCopyStrings = { copy: 'Copy', copied: 'Copied', failed: 'Copy failed' };
const COPY_PL: AskCopyStrings = {
  copy: 'Kopiuj',
  copied: 'Skopiowano',
  failed: 'Nie udało się skopiować',
};

export function askCopyStrings(locale: AskR2Locale): AskCopyStrings {
  return locale === 'pl' ? COPY_PL : COPY_EN;
}

/* ────────────────────────────────────────────────────────────────────────────
   RECENT REPORTING BESIDE A BACKGROUND ANSWER — from AskRecentReporting.tsx
   ──────────────────────────────────────────────────────────────────────────── */

export interface AskRecentReportingStrings {
  readonly title: (place: string, days: number) => string;
  readonly topic: Readonly<Record<AskCompanionTopic, (place: string, days: number) => string>>;
  readonly note: string;
  readonly none: string;
  readonly unavailable: string;
}

const RECENT_EN: AskRecentReportingStrings = {
  title: (place, days) => `Recent reporting about ${place} (last ${days} days)`,
  topic: {
    TRAVEL: (place, days) => `Current travel notices · ${place} (last ${days} days)`,
    ECONOMY: (place, days) => `Recent economic reporting · ${place} (last ${days} days)`,
    SECURITY: (place, days) => `Recent security reporting · ${place} (last ${days} days)`,
    BUSINESS: (place, days) =>
      `Recent business and trade reporting · ${place} (last ${days} days)`,
    SCIENCE: (place, days) => `Recent science reporting · ${place} (last ${days} days)`,
  },
  note: 'Listed, not analysed: the answer above is general background and does not use these reports.',
  none: 'No recent reporting about this place is held right now. That is not evidence that nothing is happening.',
  unavailable: 'Recent reporting could not be checked just now.',
};

const RECENT_PL: AskRecentReportingStrings = {
  title: (place, days) => `Najnowsze doniesienia: ${place} (ostatnie ${days} dni)`,
  topic: {
    TRAVEL: (place, days) => `Bieżące komunikaty dla podróżnych · ${place} (ostatnie ${days} dni)`,
    ECONOMY: (place, days) => `Najnowsze doniesienia gospodarcze · ${place} (ostatnie ${days} dni)`,
    SECURITY: (place, days) =>
      `Najnowsze doniesienia o bezpieczeństwie · ${place} (ostatnie ${days} dni)`,
    BUSINESS: (place, days) =>
      `Najnowsze doniesienia o biznesie i handlu · ${place} (ostatnie ${days} dni)`,
    SCIENCE: (place, days) => `Najnowsze doniesienia naukowe · ${place} (ostatnie ${days} dni)`,
  },
  note: 'Lista bez analizy: powyższa odpowiedź to ogólne tło i nie korzysta z tych doniesień.',
  none: 'Nie mamy teraz najnowszych doniesień o tym miejscu. To nie dowód, że nic się nie dzieje.',
  unavailable: 'Nie udało się teraz sprawdzić najnowszych doniesień.',
};

export function askRecentReportingStrings(locale: AskR2Locale): AskRecentReportingStrings {
  return locale === 'pl' ? RECENT_PL : RECENT_EN;
}

/* ────────────────────────────────────────────────────────────────────────────
   WHAT THE REPORTS SAY, POINT BY POINT — from AskEvidenceTable.tsx
   ──────────────────────────────────────────────────────────────────────────── */

export interface AskEvidenceTableStrings {
  readonly caption: string;
  readonly point: string;
  readonly reported: string;
  readonly sources: string;
  readonly agreement: string;
  readonly citation: (n: number) => string;
  readonly omitted: (n: number) => string;
}

const EVIDENCE_EN: AskEvidenceTableStrings = {
  caption: 'What the reports say, point by point',
  point: 'Point',
  reported: 'Reported',
  sources: 'Sources',
  agreement: 'Reports agree',
  citation: (n) => `Source ${n}`,
  omitted: (n) =>
    n === 1
      ? '1 point is not shown because no listed source supports it.'
      : `${n} points are not shown because no listed source supports them.`,
};

const EVIDENCE_PL: AskEvidenceTableStrings = {
  caption: 'Co mówią źródła, punkt po punkcie',
  point: 'Kwestia',
  reported: 'Według źródeł',
  sources: 'Źródła',
  agreement: 'Źródła są zgodne',
  citation: (n) => `Źródło ${n}`,
  omitted: (n) =>
    n === 1
      ? 'Nie pokazano 1 punktu, bo żadne z wymienionych źródeł go nie potwierdza.'
      : `Nie pokazano punktów: ${n}, bo żadne z wymienionych źródeł ich nie potwierdza.`,
};

export function askEvidenceTableStrings(locale: AskR2Locale): AskEvidenceTableStrings {
  return locale === 'pl' ? EVIDENCE_PL : EVIDENCE_EN;
}

/* ────────────────────────────────────────────────────────────────────────────
   THE BARE TERNARIES — three strings that had no key at all
   ──────────────────────────────────────────────────────────────────────────── */

export interface AskContextStrings {
  /** The DRAFT question a Compare arrival stages. Never submitted on arrival. */
  readonly compareDraftQuestion: string;
  /** The Compare context chip. `{n}` is the number of staged stories. */
  readonly comparingStories: (n: number) => string;
  /** AskCompactResult's verification line. */
  readonly coverageChecked: string;
}

const CONTEXT_EN: AskContextStrings = {
  compareDraftQuestion: 'Compare these stories',
  comparingStories: (n) => `Comparing ${n} stories`,
  coverageChecked: 'Coverage checked',
};

const CONTEXT_PL: AskContextStrings = {
  compareDraftQuestion: 'Porównaj te artykuły',
  comparingStories: (n) => `Porównanie: ${n} artykułów`,
  coverageChecked: 'Sprawdzone pokrycie',
};

export function askContextStrings(locale: AskR2Locale): AskContextStrings {
  return locale === 'pl' ? CONTEXT_PL : CONTEXT_EN;
}
