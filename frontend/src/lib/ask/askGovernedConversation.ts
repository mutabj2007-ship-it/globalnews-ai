import type { AskContribution, AskR2Payload } from '@/lib/api/askV2Api';
import type { AskR2Locale } from './askR2Strings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOVERNED ANSWER CONVERSATIONAL UX R1 — CONVERSATION FIRST, GOVERNANCE SECOND, EVIDENCE THIRD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A zero-AI governed answer (RETAINED_RECORD, or CAPABILITY_UNAVAILABLE for a governed record
 * that cannot be shown or an official source that is not approved) is still an answer in a
 * conversation. This turns the governed result into deterministic natural-language copy — no
 * model call, no new fact: every value, period and place is read from the payload (a cycle the
 * reader named is echoed back in their own words). Governance states become
 * a restrained provenance line; the evidence stays below, unchanged.
 *
 * Returns null for every other turn, which therefore renders exactly as before.
 */

export interface AskGovernedConversation {
  /** The answer, in plain language, first. */
  readonly paragraphs: readonly string[];
  /** Restrained status/provenance, e.g. "Retained record · NISR · 2024/2025 · No AI used". */
  readonly provenance: string;
  /**
   * Natural follow-ups the reader might ask next. Only ever placed in the composer as a DRAFT;
   * nothing runs until the reader presses Ask under the existing rules.
   */
  readonly followUps: readonly string[];
}

const GOVERNED_UNAVAILABLE = new Set([
  'GOVERNED_RECORD_UNAVAILABLE',
  'OFFICIAL_SOURCE_UNAVAILABLE',
]);

/** Closed list of official bodies a reader names when asking for an official figure. */
const OFFICIAL_BODIES: readonly (readonly [RegExp, string])[] = [
  [/\bNBP\b|\bNarodow\w* Bank\w* Polski\w*|\bNational Bank of Poland\b/i, 'NBP'],
  [/\bNBR\b|\bBNR\b|\bNational Bank of Rwanda\b/i, 'the National Bank of Rwanda'],
  [/\bECB\b|\bEuropean Central Bank\b/i, 'the ECB'],
  [/\bFederal Reserve\b|\bthe Fed\b/i, 'the Federal Reserve'],
  [
    /\bGUS\b|\bStatistics Poland\b|\bG[łl][óo]wn\w* Urz[ąa]d\w* Statystyczn\w*/i,
    'Statistics Poland (GUS)',
  ],
  [/\bNISR\b/i, 'NISR'],
];
const bodyNamed = (question: string): string | null =>
  OFFICIAL_BODIES.find(([pattern]) => pattern.test(question))?.[1] ?? null;
const asksReferenceRate = (question: string): boolean =>
  /reference rate|policy rate|stop\w* referencyjn/i.test(question);

const used = (payload: AskR2Payload, id: string): AskContribution | undefined =>
  payload.intelligence?.contributions.find(
    (c) => c.contributorId === id && c.status === 'USED' && c.observations.length > 0,
  );
const gap = (payload: AskR2Payload, id: string): AskContribution | undefined =>
  payload.intelligence?.contributions.find((c) => c.contributorId === id && c.status !== 'USED');
const place = (payload: AskR2Payload): string | null =>
  payload.intelligence?.contributions.find(
    (c) => c.contributorId === 'GEOGRAPHY' && c.status === 'USED',
  )?.observations[0]?.label ?? null;
const unitText = (unit: string | null): string =>
  unit === null ? '' : unit === 'PERCENT' || unit === '%' ? '%' : ` ${unit}`;

/**
 * The evaluation cycle the READER named ("2024/2025", "2024-25"), echoed back in their own terms;
 * null when they named none — the sentence then simply omits it. Nothing is looked up or assumed.
 */
function cycleNamed(question: string): string | null {
  const m = question.match(/\b(\d{4})\s*[/\-–—]\s*(\d{2}|\d{4})\b/);
  if (m === null) return null;
  const end = m[2].length === 2 ? `${m[1].slice(0, 2)}${m[2]}` : m[2];
  return `${m[1]}/${end}`;
}

interface Copy {
  imihigo: (entity: string, cycle: string, value: string) => string;
  imihigoProvenance: (cycle: string) => string;
  imihigoFollowUp: (value: string) => string;
  imihigoAbsent: (district: string, cycle: string | null, aggregate: boolean) => string;
  imihigoAbsentProvenance: string;
  imihigoAbsentFollowUp: (district: string) => string;
  cpi: (label: string, value: string, period: string) => string;
  cpiProvenance: (period: string) => string;
  cpiFollowUp: string;
  cpiNotDisplayable: string;
  cpiNoCapture: string;
  cpiUnavailableProvenance: string;
  cpiUnavailableFollowUp: string;
  procurement: (count: number, geography: string, day: string) => string;
  procurementProvenance: (day: string) => string;
  procurementFollowUp: string;
  recordNotDisplayable: string;
  recordNoCapture: string;
  recordUnreadable: string;
  recordUnavailableProvenance: string;
  official: (body: string | null, rate: boolean) => string;
  officialProvenance: string;
  officialFollowUp: (body: string | null) => string;
  genericRecord: string;
  genericAbsent: string;
  genericProvenance: string;
}

const EN: Copy = {
  imihigo: (entity, cycle, value) =>
    `${entity}’s final Imihigo score for the ${cycle} cycle was ${value}. This comes from the retained NISR final evaluation for that closed cycle, so it describes that evaluation period rather than the district’s current situation.`,
  imihigoProvenance: (cycle) => `Retained record · NISR · ${cycle} · No AI used`,
  imihigoFollowUp: (value) => `What does a final Imihigo score of ${value} mean?`,
  imihigoAbsent: (district, cycle, aggregate) =>
    `I don’t have an individual ${cycle === null ? '' : `${cycle} `}Imihigo score for ${district} in the retained NISR data.` +
    (aggregate
      ? ` The available result is an aggregate for the City of Kigali, and GlobalNewsAI does not assign that city-level figure to ${district} as though it were a district result.`
      : ''),
  imihigoAbsentProvenance: 'Retained NISR data · no individual record · No AI used',
  imihigoAbsentFollowUp: (district) => `Why is there no ${district} score?`,
  cpi: (label, value, period) =>
    `${label} was ${value} for ${period}, according to the retained NISR release. That is the latest figure GlobalNewsAI holds from that release, not a fresh check of today’s rate.`,
  cpiProvenance: (period) => `Retained record · NISR · ${period} · No AI used`,
  cpiFollowUp: 'What does this inflation figure mean?',
  cpiNotDisplayable:
    'I can’t safely give you Rwanda’s retained CPI figure from this source right now. GlobalNewsAI does hold the NISR release, but the stored record cannot currently be read under the verification rules used for it, so no value is shown.',
  cpiNoCapture:
    'I can’t give you Rwanda’s CPI figure from a retained NISR release, because GlobalNewsAI doesn’t currently hold one.',
  cpiUnavailableProvenance: 'NISR CPI · not shown · No AI used',
  cpiUnavailableFollowUp: 'When will the CPI figure be available?',
  procurement: (count, geography, day) =>
    `GlobalNewsAI holds one retained snapshot of EU procurement notices for ${geography}: ${count} notice${count === 1 ? '' : 's'} published on ${day}. Because it covers a single publication day, it can’t show how procurement has changed or which changes matter most — the notices themselves are listed below.`,
  procurementProvenance: (day) => `Retained record · TED · ${day} · No AI used`,
  procurementFollowUp: 'Which of these notices are the largest?',
  recordNotDisplayable:
    'I can’t safely give you this figure from its source right now. GlobalNewsAI does hold the retained record, but it cannot currently be read under the verification rules used for it, so no value is shown.',
  recordNoCapture:
    'I can’t answer this from a retained record, because GlobalNewsAI doesn’t currently hold one for it.',
  recordUnreadable:
    'I couldn’t read the retained record for this just now, so I’m not claiming anything either way.',
  recordUnavailableProvenance: 'Retained record · not shown · No AI used',
  official: (body, rate) =>
    body === null
      ? 'I can’t give you the official figure from an approved official source yet. Other reporting may provide context, but GlobalNewsAI will not present it as the official figure.'
      : `I can’t give you ${body}’s official ${rate ? 'reference rate' : 'figure'} from an approved ${body} source yet. Other reporting may provide context, but GlobalNewsAI will not present it as ${body}’s official figure.`,
  officialProvenance: 'Official source · not connected · No AI used',
  officialFollowUp: (body) =>
    body === null
      ? 'What does recent reporting say about this?'
      : `What does recent reporting say about ${body}?`,
  genericRecord: 'Here is what the retained governed record shows.',
  genericAbsent: 'I don’t have an individual retained record for this.',
  genericProvenance: 'Retained record · No AI used',
};

const PL: Copy = {
  imihigo: (entity, cycle, value) =>
    `Końcowy wynik Imihigo dla ${entity} w cyklu ${cycle} wyniósł ${value}. Pochodzi on z zachowanej końcowej oceny NISR dla tego zamkniętego cyklu, więc opisuje tamten okres oceny, a nie obecną sytuację dystryktu.`,
  imihigoProvenance: (cycle) => `Zachowany zapis · NISR · ${cycle} · Bez AI`,
  imihigoFollowUp: (value) => `Co oznacza końcowy wynik Imihigo ${value}?`,
  imihigoAbsent: (district, cycle, aggregate) =>
    `Nie mam osobnego wyniku Imihigo${cycle === null ? '' : ` za ${cycle}`} dla ${district} w zachowanych danych NISR.` +
    (aggregate
      ? ` Dostępny jest wynik zbiorczy dla Miasta Kigali, a GlobalNewsAI nie przypisuje tej wartości miejskiej dystryktowi ${district}, jakby był to wynik dystryktu.`
      : ''),
  imihigoAbsentProvenance: 'Zachowane dane NISR · brak osobnego zapisu · Bez AI',
  imihigoAbsentFollowUp: (district) => `Dlaczego nie ma wyniku dla ${district}?`,
  cpi: (label, value, period) =>
    `${label}: ${value} za ${period}, według zachowanej publikacji NISR. To najnowsza wartość z tej publikacji przechowywana przez GlobalNewsAI, a nie bieżące sprawdzenie dzisiejszej stopy.`,
  cpiProvenance: (period) => `Zachowany zapis · NISR · ${period} · Bez AI`,
  cpiFollowUp: 'Co oznacza ta wartość inflacji?',
  cpiNotDisplayable:
    'Nie mogę teraz bezpiecznie podać zachowanej wartości CPI dla Rwandy z tego źródła. GlobalNewsAI przechowuje publikację NISR, ale zapisanego rekordu nie można obecnie odczytać zgodnie z zasadami weryfikacji, które go obejmują, więc nie pokazuję wartości.',
  cpiNoCapture:
    'Nie mogę podać wartości CPI dla Rwandy z zachowanej publikacji NISR, bo GlobalNewsAI obecnie jej nie przechowuje.',
  cpiUnavailableProvenance: 'CPI NISR · nie pokazano · Bez AI',
  cpiUnavailableFollowUp: 'Kiedy wartość CPI będzie dostępna?',
  procurement: (count, geography, day) =>
    `GlobalNewsAI przechowuje jedną zachowaną migawkę ogłoszeń o zamówieniach UE dla ${geography}: ${count} ogłosz. opublikowanych ${day}. Ponieważ obejmuje jeden dzień publikacji, nie pokazuje, jak zmieniały się zamówienia ani które zmiany są najważniejsze — same ogłoszenia są wymienione poniżej.`,
  procurementProvenance: (day) => `Zachowany zapis · TED · ${day} · Bez AI`,
  procurementFollowUp: 'Które z tych ogłoszeń są największe?',
  recordNotDisplayable:
    'Nie mogę teraz bezpiecznie podać tej wartości z jej źródła. GlobalNewsAI przechowuje zachowany zapis, ale nie można go obecnie odczytać zgodnie z zasadami weryfikacji, więc nie pokazuję wartości.',
  recordNoCapture:
    'Nie mogę odpowiedzieć na podstawie zachowanego zapisu, bo GlobalNewsAI obecnie go nie przechowuje.',
  recordUnreadable:
    'Nie udało mi się teraz odczytać zachowanego zapisu, więc niczego nie przesądzam.',
  recordUnavailableProvenance: 'Zachowany zapis · nie pokazano · Bez AI',
  official: (body, rate) =>
    body === null
      ? 'Nie mogę jeszcze podać oficjalnej wartości z zatwierdzonego oficjalnego źródła. Inne doniesienia mogą dać kontekst, ale GlobalNewsAI nie przedstawi ich jako wartości oficjalnej.'
      : `Nie mogę jeszcze podać oficjalnej ${rate ? 'stopy referencyjnej' : 'wartości'} ${body} z zatwierdzonego źródła ${body}. Inne doniesienia mogą dać kontekst, ale GlobalNewsAI nie przedstawi ich jako oficjalnej wartości ${body}.`,
  officialProvenance: 'Oficjalne źródło · niepodłączone · Bez AI',
  officialFollowUp: (body) =>
    body === null
      ? 'Co mówią na ten temat najnowsze doniesienia?'
      : `Co mówią najnowsze doniesienia o ${body}?`,
  genericRecord: 'Oto, co pokazuje zachowany, zweryfikowany zapis.',
  genericAbsent: 'Nie mam osobnego zachowanego zapisu w tej sprawie.',
  genericProvenance: 'Zachowany zapis · Bez AI',
};

/** True for the zero-AI governed answers this module voices. */
export function isGovernedConversationTurn(payload: AskR2Payload): boolean {
  return (
    payload.answer.state === 'RETAINED_RECORD' ||
    (payload.answer.state === 'CAPABILITY_UNAVAILABLE' &&
      GOVERNED_UNAVAILABLE.has(payload.answer.basis))
  );
}

export function askGovernedConversation(
  payload: AskR2Payload,
  locale: AskR2Locale,
  question: string,
): AskGovernedConversation | null {
  if (!isGovernedConversationTurn(payload)) return null;
  const t = locale === 'pl' ? PL : EN;
  const basis = payload.answer.basis;

  if (basis === 'OFFICIAL_SOURCE_UNAVAILABLE') {
    const body = bodyNamed(question);
    return {
      paragraphs: [t.official(body, asksReferenceRate(question))],
      provenance: t.officialProvenance,
      followUps: [t.officialFollowUp(body)],
    };
  }

  if (basis === 'GOVERNED_RECORD_UNAVAILABLE') {
    const cpi = gap(payload, 'ECONOMY_CPI');
    if (cpi !== undefined) {
      const text = cpi.disclosures.includes('NO_RETAINED_CAPTURE')
        ? t.cpiNoCapture
        : cpi.disclosures.includes('RETAINED_ARTIFACT_NOT_DISPLAYABLE')
          ? t.cpiNotDisplayable
          : t.recordUnreadable;
      return {
        paragraphs: [text],
        provenance: t.cpiUnavailableProvenance,
        followUps: [t.cpiUnavailableFollowUp],
      };
    }
    const other = payload.intelligence?.contributions.find(
      (c) => c.contributorId !== 'GEOGRAPHY' && c.status !== 'USED' && c.status !== 'NO_MATCH',
    );
    const text = other?.disclosures.includes('NO_RETAINED_CAPTURE')
      ? t.recordNoCapture
      : other?.disclosures.includes('RETAINED_ARTIFACT_NOT_DISPLAYABLE')
        ? t.recordNotDisplayable
        : t.recordUnreadable;
    return { paragraphs: [text], provenance: t.recordUnavailableProvenance, followUps: [] };
  }

  /* RETAINED_RECORD */
  const imihigo = used(payload, 'IMIHIGO');
  /* A record without a stated value is never voiced as a sentence with a blank in it. */
  if (imihigo !== undefined && imihigo.observations[0].value !== null) {
    const o = imihigo.observations[0];
    const value = `${o.value ?? ''}${unitText(o.unit)}`;
    return {
      paragraphs: [t.imihigo(o.label ?? place(payload) ?? o.geography, o.period, value)],
      provenance: t.imihigoProvenance(o.period),
      followUps: [t.imihigoFollowUp(value)],
    };
  }
  const cpi = used(payload, 'ECONOMY_CPI');
  if (cpi !== undefined && cpi.observations[0].value !== null) {
    const o = cpi.observations[0];
    return {
      paragraphs: [t.cpi(o.label ?? o.geography, `${o.value ?? ''}${unitText(o.unit)}`, o.period)],
      provenance: t.cpiProvenance(o.period),
      followUps: [t.cpiFollowUp],
    };
  }
  const ted = used(payload, 'MARKET_PROCUREMENT');
  if (ted !== undefined) {
    const o = ted.observations[0];
    const day = o.period.slice(0, 10);
    return {
      paragraphs: [t.procurement(ted.observations.length, o.geography, day)],
      provenance: t.procurementProvenance(day),
      followUps: [t.procurementFollowUp],
    };
  }
  const absentImihigo = gap(payload, 'IMIHIGO');
  if (absentImihigo !== undefined && absentImihigo.status === 'NO_MATCH') {
    const district = place(payload) ?? '';
    return {
      paragraphs: [
        t.imihigoAbsent(
          district,
          cycleNamed(question),
          absentImihigo.disclosures.includes('AGGREGATE_NOT_ASSIGNED_TO_DISTRICT'),
        ),
      ],
      provenance: t.imihigoAbsentProvenance,
      followUps: district === '' ? [] : [t.imihigoAbsentFollowUp(district)],
    };
  }
  return {
    paragraphs: [basis === 'GOVERNED_NO_RECORD' ? t.genericAbsent : t.genericRecord],
    provenance: t.genericProvenance,
    followUps: [],
  };
}
