import type { DisplayLocale } from '@globalnews-ai/shared';
import { SECURITY_ABSENCE_LABELS } from '@globalnews-ai/shared';

/**
 * PART IX · SECURITY — READER COPY.
 *
 * ENGLISH ONLY, DISCLOSED. The governed-fallback rule this lane has applied on Market,
 * Humanitarian and Politics applies here with the most force it has had anywhere: the N-11
 * sentence *"Not assessed. This is not a statement that conditions are safe."* is the
 * frame's load-bearing honesty statement, and a mistranslation of its second clause would
 * invert the one thing the zone exists to prevent. L authors it; this lane does not guess.
 *
 * ── THE ABSENCE LABELS ARE NOT DUPLICATED HERE ────────────────────────────
 *
 * They come from `SECURITY_ABSENCE_LABELS` in `shared/src/security/absence.ts`. Main's
 * instruction is that the union has one home; a second copy of its labels in a frontend
 * catalogue would be a second home with extra steps, and the copy that drifted would be the
 * one a reader sees.
 */
export type SecLocale = DisplayLocale;

export interface SecStrings {
  readonly domain: string;
  readonly metaTitle: string;
  readonly metaDescription: string;

  /** Zone reader labels, keyed by Main's zone id. Structure lives in `securityZones.ts`. */
  readonly zoneLabels: Readonly<Record<
    'A1' | 'A2' | 'A5_occurrence' | 'A5_cause' | 'A5_actor' | 'A6' | 'A7'
    | 'B1' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C7' | 'C10' | 'C11' | 'C12'
    | 'D2' | 'D3' | 'D4' | 'D5', string>>;

  readonly labels: Readonly<Record<
    'changeState' | 'severity' | 'localeFallback' | 'close'
    | 'zeroMeteredAi' | 'analysisCost' | 'detent', string>>;

  /** Severity ladder rungs — structure only. No rung is ever selected at Alpha. */
  readonly severityRungs: readonly string[];

  /** Attribution's three statements — C4. They never merge into one. */
  readonly attribution: Readonly<Record<'claimed' | 'suspected' | 'unknown', string>>;

  readonly detents: Readonly<Record<'PEEK' | 'HALF' | 'FULL' | 'WORKSPACE', string>>;
}

const en: SecStrings = {
  domain: 'Security',
  metaTitle: 'Security Intelligence — GlobalNews AI',
  metaDescription: 'Security conditions, attribution and exposure, with every absence stated rather than filled.',

  zoneLabels: {
    /* A1 · domain name only. Discloses no category. */
    A1: 'Security Intelligence',
    /* A2 · fixed label. Binds nothing. */
    A2: 'No security subject bound',
    /*
      A5 · three columns that never merge. Main lists "merge the three statements into one
      sentence" among the twelve things the header must never do, so they are three keys
      rather than one template with separators.
    */
    A5_occurrence: 'Occurrence',
    A5_cause: 'Cause',
    A5_actor: 'Actor',
    A6: 'Ask',
    A7: 'Last assessed',
    B1: 'Attention',
    C1: 'Map',
    C2: 'Declared precision ceiling',
    C3: 'Incidents',
    C4: 'Attribution',
    /*
      C5 and C7 · SUBSTRATE NAME ONLY. Main's rule 4: the name is safe, the taxonomy beneath
      it is not. There is no legend key, no filter label and no column header in this
      catalogue for either, because a catalogue entry is where one would start.
    */
    C5: 'Infrastructure exposure',
    C7: 'Border and posture',
    C10: 'Source class',
    C11: 'Claimant',
    C12: 'Artifact data tier',
    D2: 'Watch',
    D3: 'Evidence',
    D4: 'Timeline',
    D5: 'Analysis',
  },

  labels: {
    changeState: 'Change state',
    severity: 'Severity',
    localeFallback: 'Security copy is not yet authored in this language. Showing English.',
    close: 'Close',
    /* Rule 5 · controls render, they do not invoke. Stated to the reader. */
    zeroMeteredAi: 'Controls render. Nothing here invokes analysis or spends AI.',
    analysisCost: 'Cost shown before it runs',
    detent: 'Detent',
  },

  /*
    THE SEVERITY LADDER — STRUCTURE, NEVER A DEFAULT.

    A4: *"Ladder structure renders with no value selected. Never defaults to LOW."* These are
    the shared `CONFLICT_SEVERITIES` members, which Part IX reuses UNMODIFIED rather than
    minting a second ladder — G measured that as the design's one already-satisfied shared
    dependency. They are spelled here as display words for the rung labels; no rung carries a
    state, and nothing selects one.
  */
  severityRungs: ['Low', 'Moderate', 'High', 'Critical'],

  /*
    C4 · THE THREE-STATEMENT STRUCTURE, EMPTY.

    *"SUSPECTED ATTRIBUTION is never shortened to an actor name. UNKNOWN ACTOR is a positive
    statement not an empty field."* The third one is the interesting one: it is a FINDING,
    so it reads as a sentence rather than as a blank, and that is why it has a label at all.
  */
  attribution: {
    claimed: 'Claimed attribution',
    suspected: 'Suspected attribution',
    unknown: 'Unknown actor',
  },

  detents: { PEEK: 'Peek', HALF: 'Half', FULL: 'Full', WORKSPACE: 'Workspace' },
};

const SEC_CATALOGUE: Partial<Record<SecLocale, SecStrings>> = { en };

export interface SecStringsResolution {
  readonly strings: SecStrings;
  readonly requested: SecLocale;
  readonly resolved: SecLocale;
  readonly fellBack: boolean;
}

export function resolveSecStrings(locale: SecLocale): SecStringsResolution {
  const found = SEC_CATALOGUE[locale];
  if (found) return { strings: found, requested: locale, resolved: locale, fellBack: false };
  return { strings: en, requested: locale, resolved: 'en', fellBack: true };
}

export function secStrings(locale: SecLocale): SecStrings {
  return resolveSecStrings(locale).strings;
}

/**
 * The N-11 label, reached through the shared home.
 *
 * A one-line re-export rather than a copy, so `securityZones.ts`'s conformance table and the
 * rendered sentence cannot disagree — and so a translator eventually changes one file.
 */
export { SECURITY_ABSENCE_LABELS };
