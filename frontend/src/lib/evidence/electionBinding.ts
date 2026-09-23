import type { ElectionReadResponse, ElectionRecord } from '@/lib/election/electionRead';
import { ELECTION_SUBJECT_LIST, type UnrankedSubjectList } from '@/lib/election/electionPreview';
import type { ReadResult } from './retainedReaders';

export interface ElectionBinding {
  list: UnrankedSubjectList;
  declarations: Record<string, ElectionRecord>;
  state: 'BOUND' | 'DISABLED' | 'UNAVAILABLE' | 'EMPTY' | 'WITHHELD';
  withheldKinds: string[];
}

/** Source projection only. Lexical order is prepared here, never inferred from votes. */
export function bindElection(result: ReadResult<ElectionReadResponse>): ElectionBinding {
  const empty = { list: ELECTION_SUBJECT_LIST, declarations: {}, withheldKinds: [] };
  if (result.status !== 'READ') return { ...empty, state: 'UNAVAILABLE' };
  if (result.data.state === 'COVERAGE_GAP') return { ...empty, state:
    result.data.reason === 'READER_DISABLED' ? 'DISABLED' :
    result.data.reason === 'VALIDATION_FAILED' ? 'WITHHELD' : 'EMPTY' };
  const declarations = result.data.records.filter(r => r.kind === 'OFFICIAL_DECLARATION' && r.declaredPerson);
  // The admitted reader owns state/qualification validation. Other evidence kinds
  // cannot become contestants, declared results or fabricated reportedness axes.
  const rows = declarations.map(r => ({ id: r.id, label: r.declaredPerson!.ballotName }))
    .sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
  return {
    state: rows.length ? 'BOUND' : 'WITHHELD',
    list: { headerLabel: ELECTION_SUBJECT_LIST.headerLabel, orderReason: 'LEXICAL', rows },
    declarations: Object.fromEntries(declarations.map(r => [r.id, r])),
    withheldKinds: [...new Set(result.data.records.filter(r => !declarations.includes(r)).map(r => r.kind))],
  };
}
export const electionBindingStrings = {
  en: {
    marker: 'RETAINED OFFICIAL EVIDENCE',
    note: 'Bounded retained declarations only. Each row identifies its own place and event; this is not national election coverage or a full contestant list.',
    BOUND: 'No competing readings are bound to this view.',
    DISABLED: 'The retained evidence reader is disabled. No election evidence is bound to this view.',
    UNAVAILABLE: 'The retained evidence could not be checked. This does not establish that no evidence is held.',
    EMPTY: 'No current admitted evidence was returned. This does not mean no election occurred.',
    WITHHELD: 'Evidence is withheld from this list. No declared person can be shown from the available reading.',
    evidence: 'Source and evidence', event: 'Event', place: 'Geography', authority: 'Authority',
    declared: 'Declaration date', captured: 'Captured (UTC)', publication: 'Separate publication date: not retained',
    sourceLanguage: 'Source language', limitations: 'Coverage is limited to this retained declaration. No turnout, full candidate list, reporting completeness or certification status is inferred.',
    unsupported: 'Evidence states withheld from contestant rows', mode: 'RETAINED EVIDENCE',
  },
  pl: {
    marker: 'ZACHOWANE DOWODY URZĘDOWE',
    note: 'Wyłącznie zachowane, ograniczone zakresowo ogłoszenia. Każdy wiersz wskazuje własne miejsce i wydarzenie; nie jest to pokrycie wyborów w całym kraju ani pełna lista kandydatów.',
    BOUND: 'Z tym widokiem nie są powiązane rozbieżne odczyty.',
    DISABLED: 'Czytnik zachowanych dowodów jest wyłączony. Z tym widokiem nie są powiązane dowody wyborcze.',
    UNAVAILABLE: 'Nie udało się sprawdzić zachowanych dowodów. Nie oznacza to, że żadne dowody nie są przechowywane.',
    EMPTY: 'Nie zwrócono aktualnych dopuszczonych dowodów. Nie oznacza to, że wybory się nie odbyły.',
    WITHHELD: 'Dowody są wstrzymane w tej liście. Dostępny odczyt nie pozwala wskazać osoby z oficjalnego ogłoszenia.',
    evidence: 'Źródło i dowody', event: 'Wydarzenie', place: 'Geografia', authority: 'Organ',
    declared: 'Data ogłoszenia', captured: 'Zapisano (UTC)', publication: 'Oddzielna data publikacji: nie zachowano',
    sourceLanguage: 'Język źródła', limitations: 'Zakres ogranicza się do tego zachowanego ogłoszenia. Nie wywodzi się frekwencji, pełnej listy kandydatów, kompletności raportowania ani statusu potwierdzenia.',
    unsupported: 'Stany dowodów wstrzymane w wierszach kandydatów', mode: 'ZACHOWANE DOWODY',
  },
} as const;
