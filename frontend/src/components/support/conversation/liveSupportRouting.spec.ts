import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';
import { createNoTransportAdapter } from '@/lib/support/conversation/noTransportAdapter';
import { createMockConversationAdapter } from '@/lib/support/conversation/mockAdapter';
import { userTurn } from '@/lib/support/conversation/types';
import { SupportConversation } from './SupportConversation';
import { TranscriptTurn } from './TranscriptTurn';

/**
 * THE LIVE ROUTING REGRESSION — ALPHA-VISUAL-SUPPORT-FIXTURE-ISOLATION-R2 §4.
 *
 * THE TWO QUESTIONS THAT PRODUCED THE RULING. Both are ordinary things to ask a
 * Support surface, and both were answered with an invented news story:
 *
 *     "Jak działa GlobalNews AI?"
 *     "How does GlobalNews AI work?"
 *
 * The cause is in the fixture routing table and is worth stating precisely,
 * because it is the reason this is a regression test rather than a one-off. The
 * mock's ANALYSIS route matches on the substring `news`. The product is called
 * GlobalNews AI. EVERY question naming the product by name therefore matched
 * the news-analysis route, and the reader received a fabricated finding citing
 * "Fixture Wire Service" and "Fixture Regional Daily" — two publishers that do
 * not exist — as though the product had researched their question. Nothing had
 * to fail for that to happen. It was the ordinary path.
 *
 * WHAT IS ASSERTED BELOW IS THE TEMPORARY, TRUTHFUL STATE. There is no grounded
 * Support transport, so the live surface must say so in F's one approved
 * WITHHELD text (C-4) and must not substitute anything for it: not a fixture,
 * not a news-event answer, and not product knowledge that has not been through
 * a real grounded transport. When that transport is wired, the expectations in
 * `describe('the withheld state')` are what change — deliberately, by someone
 * who has to read this file to change them.
 *
 * `MOCK_CONTROL` is the deliberate import §3 permits: a spec may reach the
 * fixtures on purpose. It is here to prove the OLD behaviour still reproduces
 * from the mock, so that a passing suite means "the live path was changed",
 * never "the fixtures were quietly edited to say something else".
 */

const QUESTIONS = {
  en: 'How does GlobalNews AI work?',
  pl: 'Jak działa GlobalNews AI?',
} as const;

const FIXTURE_PUBLISHERS = ['Fixture Wire Service', 'Fixture Regional Daily'] as const;

/** §4 — the providers a withheld turn must be proof that nothing consulted. */
const PROVIDER_MARKERS = [
  '/analysis/news',
  'analysis/news',
  'GNews',
  'gnews',
  'OpenAI',
  'openai',
  'EventRegistry',
  'GDELT',
] as const;

const dictionary = (locale: 'en' | 'pl'): typeof supportEn => (locale === 'pl' ? supportPl : supportEn);

/** Asks the LIVE adapter the question, and renders the turn it returns. */
async function askLive(locale: 'en' | 'pl'): Promise<string> {
  const at = '2026-09-18T00:00:00.000Z';
  const adapter = createNoTransportAdapter({ thinkMs: 0, now: () => at });
  const reply = await adapter.respond({
    locale,
    userTurns: [userTurn({ id: 'u1', body: QUESTIONS[locale], at })],
  });
  const d = dictionary(locale);
  return renderToStaticMarkup(
    createElement(TranscriptTurn, {
      turn: reply.turn,
      t: d.conversation,
      authors: d.authors,
      // R2-1 — rendered as the LIVE surface renders it: no handoff transport.
      handoffAvailable: adapter.handoffAvailable,
    }),
  );
}

describe('§4 — the withheld state, for both questions, in both locales', () => {
  for (const locale of ['en', 'pl'] as const) {
    describe(`${locale} — "${QUESTIONS[locale]}"`, () => {
      it('the live adapter WITHHOLDS; it does not answer', async () => {
        const adapter = createNoTransportAdapter({ thinkMs: 0 });
        const reply = await adapter.respond({
          locale,
          userTurns: [userTurn({ id: 'u1', body: QUESTIONS[locale], at: 't' })],
        });

        expect(reply.turn.outcome).toBe('WITHHELD');
        // No source, because nothing produced this turn. An ANALYSIS source is
        // the exact claim the defect made falsely.
        expect(reply.turn.source).toBeNull();
        expect(reply.turn.sources).toBeUndefined();
        // Nothing is composed by the transport: the copy key selects F's text.
        expect(reply.turn.body).toBe('');
        expect(reply.turn.copyKey).toBe('WITHHELD');
      });

      it("renders F's ONE approved withheld text, in this locale", async () => {
        const html = await askLive(locale);
        expect(html).toContain(dictionary(locale).conversation.withheld.body);
      });

      it('renders NO fixture publisher name', async () => {
        const html = await askLive(locale);
        for (const publisher of FIXTURE_PUBLISHERS) {
          expect(html).not.toContain(publisher);
        }
      });

      it('renders NO analysis framing — no preamble, no sources block, no analysis limits', async () => {
        const html = await askLive(locale);
        const d = dictionary(locale).conversation;
        expect(html).not.toContain(d.analysis.preamble);
        expect(html).not.toContain(d.analysis.sourcesLabel);
        expect(html).not.toContain(d.analysis.limits);
      });

      it('§4 ZERO-PROVIDER — no provider, route or vendor is named in what the reader sees', async () => {
        const html = await askLive(locale);
        for (const marker of PROVIDER_MARKERS) {
          expect({ marker, present: html.includes(marker) }).toEqual({ marker, present: false });
        }
      });

      it('§4 — the operator-facing skip reason is never rendered', async () => {
        const html = await askLive(locale);
        expect(html).not.toContain('no-evidence');
        expect(html).not.toContain('no-authored-match');
      });

      it('R2-1 — the withheld turn states the route to a person, TRUTHFULLY', async () => {
        const html = await askLive(locale);
        const c = dictionary(locale).conversation;

        // F `04` F-5 — the route is still always stated.
        expect(html).toContain(c.escalation.noHandoff);

        /*
          R2-1 — and it is no longer the sentence that promises delivery.
          "say so and I will pass it on" was false: nothing passed anything on.
        */
        expect(html).not.toContain(c.escalation.offer);
      });

      it('R2-1 — the "ask for a person" control is ABSENT, and the composer stays open', () => {
        const d = dictionary(locale);
        const html = renderToStaticMarkup(
          createElement(SupportConversation, {
            t: d,
            locale,
            adapter: createNoTransportAdapter({ thinkMs: 0 }),
          }),
        );
        // Absent, not disabled — a greyed-out control still claims the
        // capability exists. It does not.
        expect(html).not.toContain(d.conversation.escalation.action);
        expect(html).toContain('id="support-conversation-composer"');
        expect(html).not.toContain('disabled=""');
      });

      it('R2-1 — the real Support request route is offered instead', () => {
        const d = dictionary(locale);
        const html = renderToStaticMarkup(
          createElement(SupportConversation, {
            t: d,
            locale,
            adapter: createNoTransportAdapter({ thinkMs: 0 }),
            onOpenRequestSurface: () => undefined,
          }),
        );
        expect(html).toContain(d.conversation.escalation.noHandoff);
        expect(html).toContain(d.conversation.escalation.openRequest);
      });
    });
  }
});

describe('the live adapter has no routing table to get wrong', () => {
  it('answers EVERY question identically — the same turn, whatever was asked', async () => {
    const adapter = createNoTransportAdapter({ thinkMs: 0, now: () => 'fixed' });
    const bodies = [
      QUESTIONS.en,
      QUESTIONS.pl,
      'news',
      'probe:withheld',
      'map',
      'delete my account',
      'what happened in Rwanda yesterday',
    ];

    const turns = await Promise.all(
      bodies.map((body) =>
        adapter
          .respond({ locale: 'en', userTurns: [userTurn({ id: 'u', body, at: 't' })] })
          .then((reply) => ({ ...reply.turn, id: 'normalised' })),
      ),
    );

    for (const turn of turns) {
      expect(turn).toEqual(turns[0]);
    }
  });

  it('does not consult the analysis source at all', () => {
    expect(createNoTransportAdapter().analysisAvailable).toBe(false);
  });

  it('R2-1 — reports no handoff transport, and refuses to pretend otherwise', async () => {
    const adapter = createNoTransportAdapter({ thinkMs: 0 });
    expect(adapter.handoffAvailable).toBe(false);
    // It THROWS rather than resolving: a resolved promise is indistinguishable
    // from a delivered handoff, and that ambiguity is the defect R2-1 fixes.
    await expect(adapter.requestHandoff('H-1')).rejects.toThrow(/no Support handoff transport/i);
  });

  it('never escalates on its own — no conversation is announced as handed over', async () => {
    const adapter = createNoTransportAdapter({ thinkMs: 0 });
    const reply = await adapter.respond({
      locale: 'pl',
      userTurns: [userTurn({ id: 'u', body: QUESTIONS.pl, at: 't' })],
    });
    expect(reply.escalate).toBeUndefined();
  });

  it('fabricates no operator — a listener is accepted and is never called', async () => {
    jest.useFakeTimers();
    try {
      const adapter = createNoTransportAdapter({ thinkMs: 0 });
      const seen: unknown[] = [];
      const unsubscribe = adapter.onOperatorTurn((turn) => seen.push(turn));

      /*
        R2-1 — this used to be `await adapter.requestHandoff('H-1')`, and it
        used to RESOLVE. That resolution was the blocking defect: the surface
        read it as delivery. It now throws, so the attempt is made here and the
        rejection is the assertion — no timer is armed either way, and no
        operator is ever produced.
      */
      await expect(adapter.requestHandoff('H-1')).rejects.toThrow(/no Support handoff transport/i);
      jest.advanceTimersByTime(600_000);

      expect(seen).toEqual([]);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('MOCK_CONTROL — the defect still reproduces from the fixtures, deliberately imported', () => {
  /*
    §3 permits this import: a test may reach the mock on purpose. Its job here
    is to keep the regression honest. If someone "fixed" this by editing the
    fixture bodies instead of by changing what the live path uses, these two
    assertions fail and the suite says so.
  */
  for (const locale of ['en', 'pl'] as const) {
    it(`the mock still routes "${QUESTIONS[locale]}" to a fixture ANALYSIS answer`, async () => {
      const mock = createMockConversationAdapter({ locale, thinkMs: 0 });
      const reply = await mock.respond({
        locale,
        userTurns: [userTurn({ id: 'u1', body: QUESTIONS[locale], at: 't' })],
      });

      expect(reply.turn.outcome).toBe('ANSWER');
      expect(reply.turn.source).toBe('ANALYSIS');
      expect(reply.turn.sources?.map((s) => s.outlet)).toEqual([...FIXTURE_PUBLISHERS]);
    });
  }

  it('the two implementations are distinguishable by id in evidence', () => {
    expect(createNoTransportAdapter().id).toBe('no-transport-withheld-v1');
    expect(createMockConversationAdapter().id).toBe('mock-fixtures-v1');
    expect(createNoTransportAdapter().id).not.toBe(createMockConversationAdapter().id);
  });
});
