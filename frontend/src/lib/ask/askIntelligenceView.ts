import type { AskContribution, AskR2Payload } from '@/lib/api/askV2Api';
import type { AskR2Locale } from './askR2Strings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK INTELLIGENCE BINDING R1 — WHAT THIS ANSWER IS BASED ON
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A pure projection of the server's governed contributions into the one Ask answer. Not a
 * dashboard: one compact "Based on" line, the governed observations each USED contributor
 * returned (with source, period and a retained-not-current note), a place-context line, and a
 * single honest note for a relevant contributor that could not contribute.
 *
 * Truth rules it enforces:
 *   - "Based on" lists ONLY contributors that actually returned governed observations, plus
 *     current reports only when reporting sources were cited;
 *   - a retained observation is never shown as current; geography is context, never evidence;
 *   - a missing contribution is never a zero and never "nothing happened".
 */

export interface AskIntelligenceStrings {
  readonly basedOn: string;
  readonly currentReports: string;
  readonly contributor: Readonly<Record<string, string>>;
  readonly retainedNote: Readonly<Record<string, string>>;
  readonly placeContext: string;
  readonly notAssessed: Readonly<Record<string, string>>;
  readonly noMatch: string;
  readonly aggregateNotAssigned: string;
  readonly noRecentRecord: string;
  readonly severityNotAssessed: string;
  readonly snapshotNotSeries: string;
  readonly source: string;
}

const EN: AskIntelligenceStrings = {
  basedOn: 'Based on',
  currentReports: 'Current reports',
  contributor: {
    CONFLICT: 'Conflict Intelligence (retained UCDP event records)',
    MARKET_PROCUREMENT: 'Retained EU procurement notices (TED)',
    ECONOMY_CPI: 'Retained NISR consumer price statistics',
    IMIHIGO: 'Retained NISR Imihigo evaluation',
    HUMANITARIAN: 'Humanitarian Intelligence',
  },
  retainedNote: {
    RETAINED_EVENT_RECORD: 'Retained event records dated by the source — not current reporting.',
    RETAINED_PUBLICATION:
      'A retained snapshot of notices published on the date shown — not current.',
    RETAINED_STATISTICAL_RELEASE:
      'A retained official release for the reference period shown — not re-checked now.',
    RETAINED_EVALUATION_CYCLE:
      'A retained evaluation of the closed cycle shown — not today’s condition.',
  },
  placeContext: 'Place',
  notAssessed: {
    HUMANITARIAN:
      'Humanitarian Intelligence: not assessed — no governed humanitarian observations are available, so none were used.',
  },
  noMatch:
    'No governed record matched this question’s scope — this is not evidence that nothing happened.',
  aggregateNotAssigned:
    'No individual NISR Imihigo record exists for this district; the City of Kigali aggregate is not assigned to its districts.',
  noRecentRecord:
    'No retained record from the last 7 days; the most recent records are shown with their dates.',
  severityNotAssessed: 'Severity is not assessed from these records.',
  snapshotNotSeries: 'One retained publication day, not a series of changes.',
  source: 'Source',
};

const PL: AskIntelligenceStrings = {
  basedOn: 'Na podstawie',
  currentReports: 'Bieżące doniesienia',
  contributor: {
    CONFLICT: 'Wywiad konfliktowy (zachowane rekordy zdarzeń UCDP)',
    MARKET_PROCUREMENT: 'Zachowane ogłoszenia o zamówieniach UE (TED)',
    ECONOMY_CPI: 'Zachowane statystyki cen konsumpcyjnych NISR',
    IMIHIGO: 'Zachowana ocena Imihigo NISR',
    HUMANITARIAN: 'Wywiad humanitarny',
  },
  retainedNote: {
    RETAINED_EVENT_RECORD:
      'Zachowane rekordy zdarzeń datowane przez źródło — to nie są bieżące doniesienia.',
    RETAINED_PUBLICATION: 'Zachowana migawka ogłoszeń opublikowanych w podanym dniu — nie bieżąca.',
    RETAINED_STATISTICAL_RELEASE:
      'Zachowana publikacja oficjalna za podany okres — nie sprawdzana ponownie teraz.',
    RETAINED_EVALUATION_CYCLE: 'Zachowana ocena zamkniętego cyklu — nie stan dzisiejszy.',
  },
  placeContext: 'Miejsce',
  notAssessed: {
    HUMANITARIAN:
      'Wywiad humanitarny: nie oceniono — brak zweryfikowanych obserwacji humanitarnych, więc żadnych nie użyto.',
  },
  noMatch:
    'Żaden zweryfikowany rekord nie pasował do zakresu pytania — to nie jest dowód, że nic się nie wydarzyło.',
  aggregateNotAssigned:
    'Brak osobnego rekordu Imihigo NISR dla tego dystryktu; wynik zbiorczy Miasta Kigali nie jest przypisywany jego dystryktom.',
  noRecentRecord:
    'Brak zachowanego rekordu z ostatnich 7 dni; najnowsze rekordy pokazano z datami.',
  severityNotAssessed: 'Na podstawie tych rekordów nie oceniono powagi sytuacji.',
  snapshotNotSeries: 'Jeden zachowany dzień publikacji, a nie seria zmian.',
  source: 'Źródło',
};

export function askIntelligenceStrings(locale: AskR2Locale): AskIntelligenceStrings {
  return locale === 'pl' ? PL : EN;
}

export interface AskIntelligenceRow {
  readonly reference: string;
  readonly period: string;
  readonly label: string;
  readonly value: string | null;
  readonly sourceName: string;
  readonly sourceUrl: string | null;
}

export interface AskIntelligenceSection {
  readonly contributorId: string;
  readonly title: string;
  readonly note: string | null;
  readonly caveats: readonly string[];
  readonly rows: readonly AskIntelligenceRow[];
}

export interface AskIntelligenceView {
  /** Null when this answer carries no governed contribution at all. */
  readonly basedOn: readonly string[] | null;
  readonly place: string | null;
  readonly sections: readonly AskIntelligenceSection[];
  readonly notes: readonly string[];
}

const MAX_ROWS = 5;

export function askIntelligenceView(
  payload: AskR2Payload,
  locale: AskR2Locale,
  reportingSourceCount: number,
): AskIntelligenceView | null {
  const block = payload.intelligence;
  if (block == null || block.contributions.length === 0) return null;
  const s = askIntelligenceStrings(locale);
  const used = block.contributions.filter(
    (c) => c.status === 'USED' && c.contributorId !== 'GEOGRAPHY' && c.observations.length > 0,
  );
  const geography = block.contributions.find(
    (c) => c.contributorId === 'GEOGRAPHY' && c.status === 'USED',
  );
  const basedOn = [
    ...(reportingSourceCount > 0 ? [s.currentReports] : []),
    ...used.map((c) => s.contributor[c.contributorId] ?? c.contributorId),
  ];
  const sections = used.map((c: AskContribution): AskIntelligenceSection => ({
    contributorId: c.contributorId,
    title: s.contributor[c.contributorId] ?? c.contributorId,
    note: s.retainedNote[c.temporalBasis] ?? null,
    caveats: [
      ...(c.disclosures.includes('NO_RECENT_RETAINED_RECORD') ? [s.noRecentRecord] : []),
      ...(c.disclosures.includes('SEVERITY_NOT_ASSESSED') ? [s.severityNotAssessed] : []),
      ...(c.disclosures.includes('SNAPSHOT_NOT_CHANGE_SERIES') ? [s.snapshotNotSeries] : []),
    ],
    rows: c.observations.slice(0, MAX_ROWS).map((o) => ({
      reference: o.reference,
      period: o.period,
      label: o.label ?? o.kind,
      value: o.value === null ? null : o.unit === null ? o.value : `${o.value} ${o.unit}`,
      sourceName: o.source.name,
      sourceUrl: o.source.url,
    })),
  }));
  const notes: string[] = [];
  for (const c of block.contributions) {
    if (c.contributorId === 'GEOGRAPHY' || c.status === 'USED') continue;
    if (c.status === 'NOT_ASSESSED') {
      const note = s.notAssessed[c.contributorId];
      if (note !== undefined) notes.push(note);
    } else if (c.disclosures.includes('AGGREGATE_NOT_ASSIGNED_TO_DISTRICT')) {
      notes.push(s.aggregateNotAssigned);
    } else if (c.status === 'NO_MATCH' && c.applicability !== 'CONTEXT') {
      notes.push(`${s.contributor[c.contributorId] ?? c.contributorId}: ${s.noMatch}`);
    }
  }
  const place = geography?.observations[0]?.label ?? null;
  const placeLine =
    place === null
      ? null
      : geography?.observations[0]?.kind === 'NISR_DISTRICT'
        ? `${place} (NISR)`
        : place;
  return {
    basedOn: basedOn.length > 0 ? basedOn : null,
    place: placeLine,
    sections,
    notes,
  };
}
