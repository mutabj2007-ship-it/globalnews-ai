import type { AgentRequest, AgentReply, SupportConversationAdapter } from './adapter';
import { PROJECTION_BOUNDS } from './projection';
import type { AgentSkipReason, AgentTurn, HandoffTrigger, OperatorTurn } from './types';

/**
 * THE DETERMINISTIC MOCK ADAPTER — fixtures, not a simulation of a model.
 *
 * WHAT THIS IS, STATED SO IT CANNOT BE MISTAKEN FOR SOMETHING ELSE.
 *
 * The conversational backend does not exist. This file stands in for it so the
 * surface can be built, reviewed and proven in a real browser. It makes NO
 * network call of any kind, reaches NO provider, consumes NO quota and never
 * consults `SUPPORT_AI_ENABLED`. Every word it returns is a fixture written
 * here and checked in — which is, not coincidentally, exactly the property
 * `01` requires of the real AUTHORED source.
 *
 * IT IS NOT A MODEL AND MUST NEVER GROW INTO ONE. The routing below is a
 * deterministic keyword match whose only powers are to CHOOSE a fixture or
 * choose none. It cannot compose, paraphrase, extend or interpolate — the same
 * rule `01` binds the real authored matcher with, applied here so the mock
 * cannot quietly teach the UI to expect generation.
 *
 * REACHING EVERY STATE WITHOUT A BACKEND. A reviewer needs all fifteen UI
 * states on demand, so the routing includes explicit probe phrases. They are
 * listed in MOCKED-BEHAVIOURS.md and they disappear with this file when the
 * real adapter arrives.
 */

export interface MockAdapterOptions {
  /** Deterministic think time, so AI_WORKING is observable without being slow. */
  readonly thinkMs?: number;
  /** How long HANDOFF_PENDING lasts before the operator turn fires. */
  readonly operatorMs?: number;
  /** The PROVIDER-DISABLED state (`07`, `05` C-5). Authored answers continue. */
  readonly analysisAvailable?: boolean;
  /** Injected so fixtures are reproducible frame to frame. */
  readonly now?: () => string;
  /**
   * The locale the fixture operator writes in. A real operator writes in their
   * own words and the transport has no say in it, so this is a property of the
   * MOCK and deliberately not of the adapter interface.
   */
  readonly locale?: 'en' | 'pl';
}

type Kind = 'AUTHORED' | 'ANALYSIS' | 'WITHHELD' | 'UNAVAILABLE' | 'PARTIAL' | 'ACCOUNT' | 'LOCALE';

interface Route {
  readonly kind: Kind;
  readonly match: readonly string[];
  readonly trigger?: HandoffTrigger;
  readonly skipReason?: AgentSkipReason;
  readonly body: { readonly en: string; readonly pl: string };
}

/*
  FIXTURE BODIES. Placeholder product copy for an unbuilt backend — they are
  NOT the shipped Support dictionary and are not L's approved language. The
  contract's own strings (C-1…C-16) live in supportEn.ts / supportPl.ts and
  are rendered by the surface, not by this file. What this file supplies is
  only the ANSWER text a backend would one day return.
*/
const ROUTES: readonly Route[] = [
  {
    kind: 'AUTHORED',
    match: ['language', 'polish', 'english', 'język', 'jezyk', 'polski', 'angielski'],
    body: {
      en: 'You can change the interface language from the language control in the header — it appears on every page, next to your account. The choice is remembered on this device.',
      pl: 'Język interfejsu zmienisz w przełączniku języka w nagłówku — jest on na każdej stronie, obok Twojego konta. Wybór jest zapamiętywany na tym urządzeniu.',
    },
  },
  {
    kind: 'AUTHORED',
    match: ['map', 'mapa', 'mapie', 'country', 'kraj'],
    body: {
      en: 'The world map is at World Map in the header. Selecting a country opens that country’s panel, and from the panel you can ask GlobalNews AI about what it is showing.',
      pl: 'Mapa świata znajduje się pod pozycją Mapa świata w nagłówku. Wybranie kraju otwiera panel tego kraju, a z panelu możesz zapytać GlobalNews AI o to, co jest na nim pokazane.',
    },
  },
  {
    kind: 'ACCOUNT',
    match: ['delete my account', 'billing', 'invoice', 'refund', 'usuń konto', 'usun konto', 'płatnoś', 'platnos', 'faktur'],
    trigger: 'H-2',
    body: { en: '', pl: '' },
  },
  {
    kind: 'ANALYSIS',
    match: ['news', 'story', 'reported', 'happening', 'wydarzen', 'doniesien', 'wiadomoś', 'wiadomos'],
    body: {
      en: 'Two of the stored reports touch on this, and they agree on the sequence of events while differing on the figures. Both are listed below so the difference is visible rather than averaged away.',
      pl: 'Dwa z zapisanych doniesień dotyczą tej sprawy i zgadzają się co do przebiegu zdarzeń, różniąc się co do liczb. Oba są wymienione poniżej, aby różnica była widoczna, a nie uśredniona.',
    },
  },
  {
    kind: 'PARTIAL',
    match: ['and also', 'two questions', 'i jeszcze', 'dwa pytania'],
    body: {
      en: 'On the first part: the language control in the header changes the interface language, and the choice is remembered on this device.',
      pl: 'Co do pierwszej części: przełącznik w nagłówku zmienia język interfejsu, a wybór jest zapamiętywany na tym urządzeniu.',
    },
  },
  {
    kind: 'UNAVAILABLE',
    match: ['probe:busy', 'probe:limit'],
    skipReason: 'per-user-allowance',
    trigger: 'H-4',
    body: { en: '', pl: '' },
  },
  {
    /*
      A SECOND route to the SAME user-visible outcome, deliberately. `04` F-1
      requires that a reader cannot tell allowance-spent from provider-down
      from flag-off — not by wording, not by latency, not by ordering. Having
      two fixture routes that differ ONLY in their operator-facing skip reason
      is what lets the harness prove the rendered turns are byte-identical.
    */
    kind: 'UNAVAILABLE',
    match: ['probe:timeout', 'probe:provider-off'],
    skipReason: 'provider-failed',
    trigger: 'H-5',
    body: { en: '', pl: '' },
  },
  {
    kind: 'LOCALE',
    match: ['probe:locale'],
    body: { en: '', pl: '' },
  },
  {
    kind: 'WITHHELD',
    match: ['probe:withheld'],
    skipReason: 'no-evidence',
    body: { en: '', pl: '' },
  },
];

const HUMAN_REQUEST = [
  'human', 'a person', 'someone', 'agent', 'operator',
  'człowiek', 'czlowiek', 'osoba', 'kogoś', 'kogos',
];

const BROKEN_REPORT = ['broken', 'not working', 'crash', 'error', 'zepsut', 'nie działa', 'nie dziala', 'błąd', 'blad'];

/*
  Team voice in both locales, not a first-person singular. In Polish a
  maintained grammatical gender across a thread reads as a persona, which `03`
  I-5 prohibits for the AGENT; this is a person and so the rule does not bind
  it, but a FIXTURE has no business inventing an operator's gender either.
*/
const OPERATOR_BODY = {
  en: 'Thanks for waiting — we have read the whole conversation above, including the part the automated agent could not answer. We are looking at it now and will reply here.',
  pl: 'Dziękujemy za cierpliwość — cała powyższa rozmowa została przeczytana, łącznie z częścią, na którą agent automatyczny nie odpowiedział. Zajmujemy się tym i odpowiemy tutaj.',
};

/**
 * `01` — MULTI-TURN, VISIBLY. The context line is derived from the PROJECTION
 * and from nothing else: it names how many of the reader's own earlier turns
 * are in play and quotes the first of them. That makes "context is retained"
 * an observable property in a screenshot rather than a claim, and it is the
 * same data the real agent would receive.
 */
function contextLine(request: AgentRequest): string | null {
  const prior = request.userTurns.slice(0, -1);
  if (prior.length === 0) return null;
  const first = prior[0].body.trim();
  const quoted = first.length > 64 ? `${first.slice(0, 64)}…` : first;
  return request.locale === 'pl'
    ? `Wcześniej w tej rozmowie napisano (${prior.length}): „${quoted}”.`
    : `Earlier in this conversation you wrote (${prior.length}): “${quoted}”.`;
}

function matches(route: Route, text: string): boolean {
  return route.match.some((needle) => needle.length > 0 && text.includes(needle));
}

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function createMockConversationAdapter(
  options: MockAdapterOptions = {},
): SupportConversationAdapter {
  const thinkMs = options.thinkMs ?? 450;
  const operatorMs = options.operatorMs ?? 1400;
  const analysisAvailable = options.analysisAvailable ?? true;
  const now = options.now ?? (() => new Date().toISOString());
  const operatorLocale = options.locale ?? 'en';
  const listeners = new Set<(turn: OperatorTurn) => void>();
  let operatorTimer: ReturnType<typeof setTimeout> | null = null;

  function agentTurn(partial: Omit<AgentTurn, 'kind' | 'id' | 'at'>): AgentTurn {
    return { kind: 'AGENT', id: nextId('agent'), at: now(), ...partial };
  }

  /**
   * The routing itself. Split from `respond` so the E1 C-8 bound signal is
   * attached in exactly ONE place and cannot be forgotten on one branch out of
   * nine — the same reason the projection has a single assembly site.
   */
  async function produce(request: AgentRequest): Promise<AgentReply> {
      /*
        `04` — THE UNIFORM NON-ANSWER LATENCY FLOOR, modelled here so the UI is
        built against the behaviour Main must implement. Every outcome waits
        the same `thinkMs`: an instant refusal for one reason and a slow one
        for another is a channel a reader can read with a stopwatch.
      */
      await new Promise((resolve) => setTimeout(resolve, thinkMs));

      const latest = request.userTurns[request.userTurns.length - 1];
      const text = (latest?.body ?? '').toLowerCase();
      const locale = request.locale;
      const context = contextLine(request);
      const withContext = (body: string): string => (context ? `${context}\n\n${body}` : body);

      // H-1 — absolute, honoured on the turn, never argued with.
      if (HUMAN_REQUEST.some((needle) => text.includes(needle))) {
        return {
          turn: agentTurn({ outcome: 'WITHHELD', source: null, body: '', skipReason: 'out-of-scope' }),
          escalate: 'H-1',
        };
      }

      // H-7 — the reader reports something is broken.
      if (BROKEN_REPORT.some((needle) => text.includes(needle))) {
        return {
          turn: agentTurn({ outcome: 'WITHHELD', source: null, body: '', skipReason: 'out-of-scope' }),
          escalate: 'H-7',
        };
      }

      const route = ROUTES.find((candidate) => matches(candidate, text));

      if (route?.kind === 'ACCOUNT') {
        // H-2 — navigation and policy yes, THIS READER'S OWN RECORD no.
        return {
          turn: agentTurn({
            outcome: 'WITHHELD',
            source: null,
            body: '',
            copyKey: 'ACCOUNT_CANNOT_SEE',
            skipReason: 'out-of-scope',
          }),
          escalate: 'H-2',
        };
      }

      if (route?.kind === 'UNAVAILABLE') {
        return {
          turn: agentTurn({
            outcome: 'UNAVAILABLE',
            source: null,
            body: '',
            skipReason: route.skipReason,
          }),
          escalate: route.trigger,
        };
      }

      if (route?.kind === 'LOCALE') {
        // `02` — a question in an unserved locale is a SCOPE answer, not an
        // escalation, so no trigger fires here.
        return {
          turn: agentTurn({
            outcome: 'WITHHELD',
            source: null,
            body: '',
            copyKey: 'LOCALE_OUT_OF_SCOPE',
            skipReason: 'out-of-scope',
          }),
        };
      }

      if (route?.kind === 'AUTHORED') {
        // `07` Q-6 / V-16 — AUTHORED answers do not consult `analysisAvailable`
        // and survive analysis exhaustion. The two sources share no resource.
        return {
          turn: agentTurn({ outcome: 'ANSWER', source: 'AUTHORED', body: withContext(route.body[locale]) }),
        };
      }

      if (route?.kind === 'PARTIAL') {
        return {
          turn: agentTurn({ outcome: 'PARTIAL', source: 'AUTHORED', body: withContext(route.body[locale]) }),
        };
      }

      if (route?.kind === 'ANALYSIS') {
        if (!analysisAvailable) {
          return {
            turn: agentTurn({ outcome: 'UNAVAILABLE', source: null, body: '', skipReason: 'disabled' }),
          };
        }
        return {
          turn: agentTurn({
            outcome: 'ANSWER',
            source: 'ANALYSIS',
            body: withContext(route.body[locale]),
            sources: [
              { id: 'fixture-1', outlet: 'Fixture Wire Service' },
              { id: 'fixture-2', outlet: 'Fixture Regional Daily' },
            ],
          }),
        };
      }

      // No route matched. `04` F-2 — a missing match is not a finding, so this
      // is WITHHELD (a statement about the agent), never "there is no such
      // thing" (a statement about the world).
      return {
        turn: agentTurn({ outcome: 'WITHHELD', source: null, body: '', skipReason: 'no-authored-match' }),
      };
  }

  return {
    id: 'mock-fixtures-v1',
    analysisAvailable,

    /*
      R2-1 — TRUE FOR THE MOCK, AND ONLY BECAUSE THE MOCK IS A SIMULATION.
      `requestHandoff` below really does produce the operator turn this adapter
      promises, so within the fixture world the escalation copy is accurate and
      the HANDOFF_PENDING -> HUMAN states stay reachable for review. Nothing
      about that is true of a live surface, which is why the live adapter
      reports false. Routing is untouched.
    */
    handoffAvailable: true,

    /*
      E1 C-8 — the bound is reported as the backend would report it: a BOOLEAN,
      never a count, because the limiter's shape is not disclosable (C-28, F
      Q-5). The request arriving here has ALREADY been bounded by the
      projection; what remains observable is whether it is sitting at the
      ceiling, which is exactly what the reader may be told and no more.
    */
    async respond(request: AgentRequest): Promise<AgentReply> {
      const reply = await produce(request);
      const truncated = request.userTurns.length >= PROJECTION_BOUNDS.MAX_PROJECTED_TURNS;
      return truncated ? { ...reply, contextTruncated: true } : reply;
    },

    async requestHandoff(): Promise<void> {
      if (operatorTimer) clearTimeout(operatorTimer);
      operatorTimer = setTimeout(() => {
        const turn: OperatorTurn = {
          kind: 'OPERATOR',
          id: nextId('operator'),
          at: now(),
          operatorId: 'fixture-operator',
          body: OPERATOR_BODY[operatorLocale],
        };
        listeners.forEach((listener) => listener(turn));
      }, operatorMs);
    },

    onOperatorTurn(listener: (turn: OperatorTurn) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && operatorTimer) {
          clearTimeout(operatorTimer);
          operatorTimer = null;
        }
      };
    },
  };
}

/** Exported so the surface can localise the fixture operator reply. */
export const MOCK_OPERATOR_BODY = OPERATOR_BODY;
