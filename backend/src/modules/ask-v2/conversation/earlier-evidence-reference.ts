/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK EVIDENCE CONTINUITY R1 — A FOLLOW-UP THAT STANDS ON THE EARLIER EVIDENCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production thread 9079dd09: turn 1 (op ce732c69) searched eastern DR Congo, the provider was
 * rate-limited and NO report was obtained; turn 2 (op 9713f8ee) "Based on those reports, what can
 * we reasonably conclude about the situation for civilians…" was answered by reasoning as though
 * reports existed ("Many reports indicate…").
 *
 * This reads, deterministically, whether the reader's turn rests on the earlier turn's REPORTS —
 * a closed phrase list (EN / PL), never a classifier. It decides nothing alone: the executor acts on
 * it only when the earlier record carries no verified evidence (priorEvidenceGap).
 */

const EN_NOUN =
  '(?:reports?|reporting|sources?|articles?|findings|stories|news\\s+reports?|search\\s+results|results|coverage|evidence)';
const EN_DET = '(?:those|these|the|that|your|the\\s+earlier|the\\s+previous|the\\s+above)';

const EN: readonly RegExp[] = [
  new RegExp(`\\bbased\\s+on\\s+${EN_DET}\\s+${EN_NOUN}\\b`, 'i'),
  new RegExp(`\\baccording\\s+to\\s+${EN_DET}\\s+${EN_NOUN}\\b`, 'i'),
  new RegExp(`\\bfrom\\s+(?:those|these|the\\s+earlier|the\\s+previous)\\s+${EN_NOUN}\\b`, 'i'),
  new RegExp(`\\bgiven\\s+${EN_DET}\\s+${EN_NOUN}\\b`, 'i'),
  new RegExp(`\\bin\\s+(?:the\\s+)?light\\s+of\\s+${EN_DET}\\s+${EN_NOUN}\\b`, 'i'),
  new RegExp(`\\bwhat\\s+do\\s+${EN_DET}\\s+${EN_NOUN}\\s+(?:say|show|suggest|indicate|tell)\\b`, 'i'),
  new RegExp(`\\b(?:those|these)\\s+${EN_NOUN}\\s+(?:say|show|suggest|indicate)\\b`, 'i'),
];

/* PL — "na podstawie tych doniesień / raportów / artykułów / źródeł / ustaleń", "według tych …",
   "z tych …", "co mówią te raporty / doniesienia" */
const PL_NOUN_GEN = '(?:doniesie[ńn]|raport[óo]w|artyku[łl][óo]w|[źz]r[óo]de[łl]|ustale[ńn]|informacji|wiadomo[śs]ci|wynik[óo]w)';
const PL_DET_GEN = '(?:tych|tamtych|powy[żz]szych|wcze[śs]niejszych|poprzednich)';
const PL: readonly RegExp[] = [
  new RegExp(`na\\s+podstawie\\s+${PL_DET_GEN}\\s+${PL_NOUN_GEN}`, 'iu'),
  new RegExp(`wed[łl]ug\\s+${PL_DET_GEN}\\s+${PL_NOUN_GEN}`, 'iu'),
  new RegExp(`(?:^|\\s)z\\s+${PL_DET_GEN}\\s+${PL_NOUN_GEN}`, 'iu'),
  new RegExp(`bior[ąa]c\\s+pod\\s+uwag[ęe]\\s+te\\s+(?:doniesienia|raporty|artyku[łl]y|[źz]r[óo]d[łl]a|ustalenia)`, 'iu'),
  new RegExp(`co\\s+m[óo]wi[ąa]\\s+(?:te|tamte)\\s+(?:doniesienia|raporty|artyku[łl]y|[źz]r[óo]d[łl]a)`, 'iu'),
];

/** True when the turn rests on the earlier turn's reports / sources / findings (closed list). */
export function readsEarlierEvidence(question: string): boolean {
  const text = question.normalize('NFC');
  return [...EN, ...PL].some((pattern) => pattern.test(text));
}
