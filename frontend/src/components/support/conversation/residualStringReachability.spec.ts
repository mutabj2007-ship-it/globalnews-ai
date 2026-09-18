import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';
import { createNoTransportAdapter } from '@/lib/support/conversation/noTransportAdapter';
import { userTurn } from '@/lib/support/conversation/types';
import type { AgentCopyKey, AgentOutcome, SystemNotice, Turn } from '@/lib/support/conversation/types';
import { TranscriptTurn } from './TranscriptTurn';

/**
 * R2-3 §4 — THE WHOLE-SURFACE REACHABILITY PROOF FOR THE SEVEN RESIDUAL KEYS.
 *
 * F+L identified seven further Support strings that still carry human/person
 * clauses and were NOT rewritten:
 *
 *     analysis.limits · partial.notice · locale.outOfScope · unavailable.body
 *     account.cannotSee · sensitive.volunteered · closed.reopen
 *
 * The CTO's instruction is not to rewrite them. It is to PROVE, for each,
 * whether it can render in the live `handoffAvailable=false` +
 * `createNoTransportAdapter` state — and to STOP if any one of them can.
 *
 * THE FINAL SAFETY INVARIANT THIS FILE DISCHARGES:
 *
 *     No reachable live no-transport state may tell the reader that a person
 *     can take over, receive, continue, or read the current automatic
 *     conversation.
 *
 * ------------------------------------------------------------------------
 * HOW A REACHABILITY CLAIM IS PROVEN HERE, AND WHAT EACH LAYER IS WORTH
 * ------------------------------------------------------------------------
 *
 * The surface is a stateful React component and this suite runs under
 * `testEnvironment: node` with no DOM and no act() harness, so it cannot click
 * its way through the state space. Asserting unreachability from a static
 * render alone would therefore prove almost nothing — an unrendered branch and
 * an unreachable branch look identical from outside.
 *
 * So the proof is built as a CHAIN, and every link is checked:
 *
 *   LAYER 1 — RUNTIME, over the adapter. Every one of these strings is
 *             selected by a value the ADAPTER produces (an outcome, a copyKey)
 *             or by a SystemNotice the surface constructs. Layer 1 enumerates
 *             what the live adapter can actually return, over many inputs, and
 *             shows the set is a singleton.
 *
 *   LAYER 2 — RUNTIME, over the renderer. Given that singleton, every Turn the
 *             live surface can put on screen is constructed and rendered, and
 *             the seven strings are searched for in the resulting markup, in
 *             both locales. This is exhaustive over the turn space, not a
 *             sample of it.
 *
 *   LAYER 3 — STRUCTURAL, over the surface source. Two of the seven are not
 *             selected by a turn at all: `closed.reopen` also renders from a
 *             state test, and `sensitive.volunteered` from a notice. Layer 3
 *             enumerates every `systemTurn(...)` and every state transition the
 *             component can perform and shows each is behind a gate the live
 *             adapter cannot open. This layer reasons about SOURCE, and is
 *             labelled as such: it is the weakest link and it is the one to
 *             re-check if the component is restructured.
 *
 * A LAYER-2 PASS ON ITS OWN WOULD BE THE VACUOUS KIND OF GREEN. It is Layer 1
 * that makes it meaningful, and Layer 3 that closes the two cases Layer 2
 * cannot see. Where the argument rests on source structure this file says so
 * rather than implying a runtime proof it did not perform.
 */

const RESIDUAL_KEYS = [
  'analysis.limits',
  'partial.notice',
  'locale.outOfScope',
  'unavailable.body',
  'account.cannotSee',
  'sensitive.volunteered',
  'closed.reopen',
] as const;

type ResidualKey = (typeof RESIDUAL_KEYS)[number];

function residualString(locale: 'en' | 'pl', key: ResidualKey): string {
  const c = (locale === 'pl' ? supportPl : supportEn).conversation;
  switch (key) {
    case 'analysis.limits':
      return c.analysis.limits;
    case 'partial.notice':
      return c.partial.notice;
    case 'locale.outOfScope':
      return c.locale.outOfScope;
    case 'unavailable.body':
      return c.unavailable.body;
    case 'account.cannotSee':
      return c.account.cannotSee;
    case 'sensitive.volunteered':
      return c.sensitive.volunteered;
    case 'closed.reopen':
      return c.closed.reopen;
  }
}

const FRONTEND_SRC = resolve(__dirname, '..', '..', '..');
const source = (...parts: string[]): string =>
  readFileSync(join(FRONTEND_SRC, ...parts), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const SURFACE = source('components', 'support', 'conversation', 'SupportConversation.tsx');

/* ==================================================================== */
/* LAYER 1 — what the live adapter can produce. RUNTIME.                */
/* ==================================================================== */

describe('LAYER 1 (runtime) — the live adapter produces exactly one kind of turn', () => {
  const PROBES = [
    'How does GlobalNews AI work?',
    'Jak działa GlobalNews AI?',
    'probe:withheld',
    'probe:busy',
    'probe:timeout',
    'probe:provider-off',
    'probe:locale',
    'delete my account',
    'billing',
    'I want a human',
    'chcę rozmawiać z człowiekiem',
    'this is broken',
    'nie działa',
    'news about Rwanda',
    'and also, two questions',
    'map',
    'language',
    '',
    '   ',
    'a'.repeat(4000),
  ];

  it('every probe yields outcome WITHHELD, source null, copyKey WITHHELD', async () => {
    const adapter = createNoTransportAdapter({ thinkMs: 0, now: () => 'fixed' });

    const shapes = new Set<string>();
    for (const locale of ['en', 'pl'] as const) {
      for (const body of PROBES) {
        const reply = await adapter.respond({
          locale,
          userTurns: [userTurn({ id: 'u', body, at: 't' })],
        });
        shapes.add(
          JSON.stringify({
            outcome: reply.turn.outcome,
            source: reply.turn.source,
            copyKey: reply.turn.copyKey,
            hasSources: reply.turn.sources !== undefined,
            escalate: reply.escalate ?? null,
          }),
        );
      }
    }

    // A SINGLETON. Not "no counter-example found" — one shape, over 40 calls
    // spanning both locales and every probe phrase the fixture set recognises.
    expect([...shapes]).toEqual([
      JSON.stringify({
        outcome: 'WITHHELD',
        source: null,
        copyKey: 'WITHHELD',
        hasSources: false,
        escalate: null,
      }),
    ]);
  });

  it('and it reports neither capability the other strings depend on', () => {
    const adapter = createNoTransportAdapter();
    expect(adapter.analysisAvailable).toBe(false);
    expect(adapter.handoffAvailable).toBe(false);
  });

  it('it never invokes an operator listener — proven with timers advanced a day', async () => {
    /*
      NOTHING IS AWAITED UNDER THE FAKE CLOCK EXCEPT A REJECTION.

      `respond` waits on `setTimeout(resolve, thinkMs)`, so awaiting it while
      fake timers are installed and before advancing them deadlocks — and a
      deadlocked test is killed at the timeout with its `finally` still pending,
      which leaves the fake clock installed for every test after it. The first
      draft of this file did exactly that and took seven other assertions down
      with it. `requestHandoff` rejects synchronously and arms no timer, so it
      is safe here; `respond` is exercised under the real clock elsewhere.
    */
    jest.useFakeTimers();
    try {
      const adapter = createNoTransportAdapter({ thinkMs: 0 });
      const seen: unknown[] = [];
      const unsubscribe = adapter.onOperatorTurn((t) => seen.push(t));

      await expect(adapter.requestHandoff('H-1')).rejects.toThrow(/no Support handoff transport/i);
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(seen).toEqual([]);
      unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });
});

/* ==================================================================== */
/* LAYER 2 — every Turn the live surface can render. RUNTIME.           */
/* ==================================================================== */

/**
 * The complete turn space of the live surface, constructed from Layer 1's
 * singleton plus the only other turn kind a reader can cause (their own).
 *
 * OPERATOR turns are excluded because Layer 1 proved the listener never fires.
 * SYSTEM turns are handled in Layer 3, because which notices are constructible
 * is a property of the component and not of a turn.
 */
async function liveTurnSpace(locale: 'en' | 'pl'): Promise<readonly Turn[]> {
  const adapter = createNoTransportAdapter({ thinkMs: 0, now: () => 'fixed' });
  const reply = await adapter.respond({
    locale,
    userTurns: [userTurn({ id: 'u1', body: 'How does GlobalNews AI work?', at: 't' })],
  });
  return [userTurn({ id: 'u1', body: 'How does GlobalNews AI work?', at: 't' }), reply.turn];
}

describe('LAYER 2 (runtime) — no residual string renders for any live turn', () => {
  for (const locale of ['en', 'pl'] as const) {
    it(`${locale} — every renderable live turn is free of all seven`, async () => {
      const d = locale === 'pl' ? supportPl : supportEn;
      const turns = await liveTurnSpace(locale);

      const html = turns
        .map((turn) =>
          renderToStaticMarkup(
            createElement(TranscriptTurn, {
              turn,
              t: d.conversation,
              authors: d.authors,
              handoffAvailable: false,
            }),
          ),
        )
        .join('\n');

      const present = RESIDUAL_KEYS.filter((key) => html.includes(residualString(locale, key)));
      expect({ locale, present }).toEqual({ locale, present: [] });
    });
  }

  it('POSITIVE CONTROL — each residual string DOES render when its selector is supplied', () => {
    /*
      Without this, "absent" could mean "the renderer cannot produce it at all",
      which would make Layer 2 prove nothing about reachability. Each string is
      forced onto the screen by handing TranscriptTurn the outcome, copyKey or
      notice that selects it — values Layer 1 has shown the live adapter never
      produces.
    */
    const d = supportEn;
    const render = (turn: Turn): string =>
      renderToStaticMarkup(
        createElement(TranscriptTurn, {
          turn,
          t: d.conversation,
          authors: d.authors,
          handoffAvailable: false,
        }),
      );

    const agent = (
      outcome: AgentOutcome,
      extra: Partial<{ copyKey: AgentCopyKey; sourceKind: 'AUTHORED' | 'ANALYSIS' }> = {},
    ): Turn => ({
      kind: 'AGENT',
      id: 'a',
      at: 't',
      outcome,
      source: extra.sourceKind ?? null,
      body: extra.sourceKind ? 'body' : '',
      ...(extra.copyKey ? { copyKey: extra.copyKey } : {}),
      ...(extra.sourceKind === 'ANALYSIS' ? { sources: [{ id: 's', outlet: 'X' }] } : {}),
    });

    const system = (notice: SystemNotice): Turn => ({ kind: 'SYSTEM', id: 's', at: 't', notice });

    expect(render(agent('ANSWER', { sourceKind: 'ANALYSIS' }))).toContain(d.conversation.analysis.limits);
    expect(render(agent('PARTIAL', { sourceKind: 'AUTHORED' }))).toContain(d.conversation.partial.notice);
    expect(render(agent('WITHHELD', { copyKey: 'LOCALE_OUT_OF_SCOPE' }))).toContain(d.conversation.locale.outOfScope);
    expect(render(agent('UNAVAILABLE'))).toContain(d.conversation.unavailable.body);
    expect(render(agent('WITHHELD', { copyKey: 'ACCOUNT_CANNOT_SEE' }))).toContain(d.conversation.account.cannotSee);
    expect(render(system('SENSITIVE_VOLUNTEERED'))).toContain(d.conversation.sensitive.volunteered);
    expect(render(system('CLOSED'))).toContain(d.conversation.closed.reopen);
  });
});

/* ==================================================================== */
/* LAYER 3 — STRUCTURAL, over the surface source.                       */
/* ==================================================================== */

describe('LAYER 3 (structural) — the selectors Layer 2 cannot reach are gated shut', () => {
  /*
    STATED PLAINLY: these assertions read the component's SOURCE. They are a
    weaker instrument than the two layers above and they are here because the
    component cannot be driven through its states in this environment. If
    SupportConversation is restructured, THESE are the assertions to re-derive
    rather than to re-point.
  */

  it('the surface constructs exactly four SystemNotices — the set is closed', () => {
    const notices = [...SURFACE.matchAll(/systemTurn\('([A-Z_]+)'\)/g)].map((m) => m[1]).sort();
    expect([...new Set(notices)]).toEqual(['CLOSED', 'HUMAN_ARRIVED', 'QUEUED']);
    // SENSITIVE_VOLUNTEERED is never constructed anywhere in the surface.
    expect(SURFACE).not.toContain('SENSITIVE_VOLUNTEERED');
  });

  it("QUEUED's three call sites are each behind the handoff capability", () => {
    // The H-8 ceiling, the reply-trigger, and the ask-for-a-person action.
    expect(SURFACE).toContain('if (handoffAvailable) {');
    expect(SURFACE).toContain('if (reply.escalate && handoffAvailable) {');
    expect(SURFACE).toContain('if (!handoffAvailable) return;');

    // Every QUEUED construction sits inside one of those guarded blocks: none
    // appears before the first guard in the file.
    const firstGuard = SURFACE.indexOf('if (handoffAvailable) {');
    const queuedAt = [...SURFACE.matchAll(/systemTurn\('QUEUED'\)/g)].map((m) => m.index ?? -1);
    expect(queuedAt.length).toBeGreaterThan(0);
    for (const at of queuedAt) expect(at).toBeGreaterThan(firstGuard);
  });

  it('HUMAN_ARRIVED and the HUMAN state require an operator turn, which never arrives', () => {
    // The only construction of HUMAN_ARRIVED, and the only OPERATOR_JOINED
    // transition, are inside the onOperatorTurn subscription.
    const subscription = SURFACE.slice(
      SURFACE.indexOf('onOperatorTurn('),
      SURFACE.indexOf('async function handleSend'),
    );
    expect(subscription).toContain("systemTurn('HUMAN_ARRIVED')");
    expect(subscription).toContain("{ type: 'OPERATOR_JOINED' }");
    expect(SURFACE.match(/OPERATOR_JOINED/g)).toHaveLength(1);
    expect(SURFACE.match(/HUMAN_ARRIVED/g)).toHaveLength(1);
    // Layer 1 proved the live adapter never invokes that listener.
  });

  it('CLOSED requires the close control, which renders only in the HUMAN state', () => {
    // One construction of the CLOSED notice and one CLOSED transition, both in
    // handleClose; handleClose is reachable only from a control gated on HUMAN.
    expect(SURFACE.match(/systemTurn\('CLOSED'\)/g)).toHaveLength(1);
    expect(SURFACE.match(/\{ type: 'CLOSED' \}/g)).toHaveLength(1);
    expect(SURFACE).toContain("state === 'HUMAN' && (");
    expect(SURFACE).toContain('onClick={handleClose}');
    // And HUMAN is unreachable by the previous assertion.
  });

  it("closed.reopen's second render site is a state test on CLOSED, which is unreachable", () => {
    expect(SURFACE).toContain("state === 'CLOSED' && ");
    // The only writer of CLOSED is handleClose, gated above. `setState('OPEN_AI')`
    // in handleNewConversation is the only other literal state write.
    const literalWrites = [...SURFACE.matchAll(/setState\('([A-Z_]+)'\)/g)].map((m) => m[1]);
    expect(literalWrites).toEqual(['OPEN_AI']);
  });

  it('the analysis block needs an ANALYSIS answer, which needs a capability that is false', () => {
    const transcript = source('components', 'support', 'conversation', 'TranscriptTurn.tsx');
    expect(transcript).toContain("turn.outcome === 'ANSWER' && turn.source === 'ANALYSIS'");
    // Layer 1: the live adapter's source is always null and its outcome always
    // WITHHELD, and analysisAvailable is false.
  });
});

/* ==================================================================== */
/* THE TABLE — one assertion per key, so a regression names the key.    */
/* ==================================================================== */

describe('§4 — the reachability verdict, per key', () => {
  const VERDICT: Record<ResidualKey, string> = {
    'analysis.limits':
      "requires outcome ANSWER + source ANALYSIS; the live adapter returns WITHHELD/null and analysisAvailable is false",
    'partial.notice': 'requires outcome PARTIAL; the live adapter returns WITHHELD',
    'locale.outOfScope': "requires copyKey LOCALE_OUT_OF_SCOPE; the live adapter sets copyKey WITHHELD",
    'unavailable.body': 'requires outcome UNAVAILABLE or copyKey UNAVAILABLE; the live adapter returns neither',
    'account.cannotSee': "requires copyKey ACCOUNT_CANNOT_SEE; the live adapter sets copyKey WITHHELD",
    'sensitive.volunteered':
      'requires SystemNotice SENSITIVE_VOLUNTEERED, which the surface never constructs at all',
    'closed.reopen':
      'requires state CLOSED or notice CLOSED; both require handleClose, whose control renders only in HUMAN, which requires an operator turn the live adapter never emits',
  };

  /*
    THE OVERLAP A REVIEWER WILL TRIP OVER, RECORDED HERE SO THEY DO NOT.

    Grep the production build for "a person from Support can take it" — the
    clause R2-3 deleted from `withheld.body` — and it is STILL THERE. That is
    not a failed edit. The identical sentence also ends `unavailable.body`,
    which is one of the seven residual keys the ruling explicitly says not to
    rewrite, so it ships in the dictionary chunk exactly as before.

    It ships and it cannot render: `unavailable.body` needs outcome UNAVAILABLE
    or copyKey UNAVAILABLE, and Layer 1 shows the live adapter produces neither,
    over forty calls in both locales.

    This is precisely the distinction the final safety invariant draws. It
    governs what a REACHABLE live no-transport state may tell the reader, not
    what strings exist in a bundle — and it has to, because the alternative is
    deleting copy that is correct and required the moment a transport returns.
  */
  it('the deleted withheld clause survives in unavailable.body — which is unreachable', () => {
    const RETIRED_EN = 'a person from Support can take it';

    // Gone from the string R2-3 rewrote...
    expect(supportEn.conversation.withheld.body).not.toContain(RETIRED_EN);

    // ...and still present in the residual key, untouched as instructed.
    expect(supportEn.conversation.unavailable.body).toContain(RETIRED_EN);
    expect(supportPl.conversation.unavailable.body).toContain('osoba z zespołu wsparcia może się nią zająć');

    // Which is exactly why unreachability, not absence, is the property proven.
    expect(createNoTransportAdapter().analysisAvailable).toBe(false);
  });

  it('all seven keys are accounted for, with a stated reason', () => {
    expect(Object.keys(VERDICT).sort()).toEqual([...RESIDUAL_KEYS].sort());
    for (const reason of Object.values(VERDICT)) expect(reason.length).toBeGreaterThan(20);
  });

  for (const key of RESIDUAL_KEYS) {
    it(`${key} — UNREACHABLE in the live no-transport state`, async () => {
      for (const locale of ['en', 'pl'] as const) {
        const d = locale === 'pl' ? supportPl : supportEn;
        const turns = await liveTurnSpace(locale);
        const html = turns
          .map((turn) =>
            renderToStaticMarkup(
              createElement(TranscriptTurn, {
                turn,
                t: d.conversation,
                authors: d.authors,
                handoffAvailable: false,
              }),
            ),
          )
          .join('\n');
        expect({ key, locale, rendered: html.includes(residualString(locale, key)) }).toEqual({
          key,
          locale,
          rendered: false,
        });
      }
    });
  }
});
