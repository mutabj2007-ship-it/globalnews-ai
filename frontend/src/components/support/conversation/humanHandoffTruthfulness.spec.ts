import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';
import { createNoTransportAdapter } from '@/lib/support/conversation/noTransportAdapter';
import { createMockConversationAdapter } from '@/lib/support/conversation/mockAdapter';
import { userTurn } from '@/lib/support/conversation/types';
import { SUPPORT_API } from '@/lib/support/supportRoutes';
import { SupportConversation } from './SupportConversation';

/**
 * R2-1 — "ASK FOR A PERSON" MUST MEAN SOMETHING, OR MUST NOT BE OFFERED.
 *
 * THE DEFECT THIS FILE EXISTS FOR. `createNoTransportAdapter().requestHandoff()`
 * resolved. It wrote no row, notified nobody and reached no queue — but
 * `requestHandoff` returns `Promise<void>`, so a resolved promise and a
 * delivered handoff are the same value, and the surface could not tell them
 * apart. It therefore appended the QUEUED turn and moved to HANDOFF_PENDING,
 * telling the reader in C-10's words that the conversation was "now with the
 * human Support team". That sentence was false, and the escalation offer that
 * invited them to ask — "say so and I will pass it on" — was false before they
 * even clicked.
 *
 * THE INVARIANT, RESTATED AS THE THING THIS FILE CHECKS:
 *
 *   A successful "ask for a person" must correspond to a measurable backend
 *   state change. A no-op promise must never transition the UI to
 *   HANDOFF_PENDING or imply a human has been notified.
 *
 * WHY THE CONTROL IS REMOVED RATHER THAN WIRED. The user-facing Support API has
 * four routes and none of them is a handoff (see the trace in
 * `supportRoutes.ts`, which states it outright: "There is deliberately NO
 * status path here"). More fundamentally, a conversation has nothing to
 * transition: there is no conversation row, no id and no reference anywhere in
 * the schema, so there is no subject for a status change. The reachable
 * transitions belong to TICKETS — creating one opens it in AWAITING_ADMIN, and
 * replying returns it there — and both are acts the reader performs, with their
 * own subject and their own category. So the conversation routes the reader to
 * that surface and does not pretend to do it for them.
 */

const LIVE = (): ReturnType<typeof createNoTransportAdapter> =>
  createNoTransportAdapter({ thinkMs: 0 });

const dict = (locale: 'en' | 'pl'): typeof supportEn => (locale === 'pl' ? supportPl : supportEn);

const QUESTIONS = {
  en: 'How does GlobalNews AI work?',
  pl: 'Jak działa GlobalNews AI?',
} as const;

function renderLive(locale: 'en' | 'pl', withRoute = true): string {
  const d = dict(locale);
  return renderToStaticMarkup(
    createElement(SupportConversation, {
      t: d,
      locale,
      adapter: LIVE(),
      ...(withRoute ? { onOpenRequestSurface: () => undefined } : {}),
    }),
  );
}

const FRONTEND_SRC = resolve(__dirname, '..', '..', '..');
const source = (...parts: string[]): string =>
  readFileSync(join(FRONTEND_SRC, ...parts), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the invariant — a handoff is offered only where one can be delivered', () => {
  it('the live adapter declares that it cannot deliver a handoff', () => {
    expect(LIVE().handoffAvailable).toBe(false);
  });

  it('its requestHandoff THROWS — it never resolves a promise it did not keep', async () => {
    await expect(LIVE().requestHandoff('H-1')).rejects.toThrow(/no Support handoff transport/i);
    await expect(LIVE().requestHandoff('H-8')).rejects.toThrow(/no Support handoff transport/i);
  });

  it('the capability is declared on the interface, so the surface asks rather than guesses', () => {
    expect(source('lib', 'support', 'conversation', 'adapter.ts')).toContain(
      'readonly handoffAvailable: boolean',
    );
  });

  it('every handoff path in the surface is gated on it — no ungated requestHandoff call', () => {
    const surface = source('components', 'support', 'conversation', 'SupportConversation.tsx');

    // Three call sites exist: H-1 (the action), H-8 (the ceiling) and the
    // trigger returned with a reply. Each must be behind the capability.
    expect(surface).toContain('if (!handoffAvailable) return;');
    expect(surface).toContain('if (handoffAvailable) {');
    expect(surface).toContain('if (reply.escalate && handoffAvailable) {');

    // And the control itself.
    expect(surface).toMatch(/const showEscalationAction\s*=\s*\n?\s*handoffAvailable\s*&&/);
  });

  it('POSITIVE CONTROL — the mock CAN deliver, and says so', () => {
    // It really does produce the operator turn it promises, so within the
    // fixture world the escalation copy is accurate. If this ever flips, the
    // assertions above stop being a meaningful distinction.
    expect(createMockConversationAdapter().handoffAvailable).toBe(true);
  });
});

describe('the live surface offers no handoff action, and fabricates no consequence', () => {
  for (const locale of ['en', 'pl'] as const) {
    describe(locale, () => {
      const c = dict(locale).conversation;

      it('the "ask for a person" control is ABSENT — not present, not disabled', () => {
        const html = renderLive(locale);
        expect(html).not.toContain(c.escalation.action);
      });

      it('the promise to pass the conversation on is never rendered', () => {
        expect(renderLive(locale)).not.toContain(c.escalation.offer);
      });

      it('no QUEUED or HUMAN-ARRIVED transition text appears', () => {
        const html = renderLive(locale);
        expect(html).not.toContain(c.transition.queued);
        expect(html).not.toContain(c.transition.humanArrived);
      });

      it('no fabricated operator — the human author label appears nowhere', () => {
        const html = renderLive(locale);
        expect(html).not.toContain(dict(locale).authors.ADMIN);
        expect(html).not.toContain('fixture-operator');
      });

      it('no invented reference, queue position, waiting time or acknowledgement', () => {
        const html = renderLive(locale);
        // A ticket reference would look like GN-XXXXXX; the pattern is the
        // backend's, mirrored here so a fabricated one cannot slip in.
        expect(html).not.toMatch(/\bGN-[A-Z0-9]{4,}\b/);
        expect(html).not.toMatch(/position \d+|pozycja \d+/i);
        expect(html).not.toMatch(/within \d+\s*(hour|minute)|w ciągu \d+\s*(godzin|minut)/i);
        expect(html).not.toMatch(/\bqueue\b|\bkolejce\b/i);
        // Nothing was sent, so nothing may be acknowledged as received.
        expect(html).not.toMatch(/has been (sent|received|forwarded|passed)/i);
        expect(html).not.toMatch(/(zostało|została) (wysłan|przekazan|odebran)/i);
      });

      it('the truthful route to a person IS stated, and offers the real surface', () => {
        const html = renderLive(locale);
        expect(html).toContain(c.escalation.noHandoff);
        expect(html).toContain(c.escalation.openRequest);
      });

      it('the route is stated even where no control can be offered', () => {
        // Rendered outside the Support page, the words still have to be true.
        const html = renderLive(locale, false);
        expect(html).toContain(c.escalation.noHandoff);
        expect(html).not.toContain(c.escalation.action);
      });
    });
  }
});

describe('EN and PL copy match the behaviour, and each other', () => {
  it('the new route copy exists in both locales and neither is the other', () => {
    expect(supportEn.conversation.escalation.noHandoff.trim().length).toBeGreaterThan(0);
    expect(supportPl.conversation.escalation.noHandoff.trim().length).toBeGreaterThan(0);
    expect(supportEn.conversation.escalation.noHandoff).not.toBe(
      supportPl.conversation.escalation.noHandoff,
    );
    expect(supportEn.conversation.escalation.openRequest).not.toBe(
      supportPl.conversation.escalation.openRequest,
    );
  });

  it('it promises no delivery, no time and no acknowledgement, in either locale', () => {
    for (const value of [
      supportEn.conversation.escalation.noHandoff,
      supportPl.conversation.escalation.noHandoff,
    ]) {
      expect(value).not.toMatch(/\d/);
      expect(value).not.toMatch(/pass it on|przekazan/i);
      expect(value).not.toMatch(/will reply|odpowie w/i);
    }
  });

  it('it says the two true things: nothing is sent, and a request reaches the team', () => {
    expect(supportEn.conversation.escalation.noHandoff).toMatch(/not sent to anyone/i);
    expect(supportEn.conversation.escalation.noHandoff).toMatch(/support request/i);
    expect(supportPl.conversation.escalation.noHandoff).toMatch(/nie jest nikomu przesyłana/i);
    expect(supportPl.conversation.escalation.noHandoff).toMatch(/zgłoszenie/i);
  });

  it('F `05` §3 — the Polish stays grammatically genderless', () => {
    for (const pattern of [/mógłbym/i, /mogłabym/i, /przekazałem/i, /przekazałam/i]) {
      expect(supportPl.conversation.escalation.noHandoff).not.toMatch(pattern);
      expect(supportPl.conversation.escalation.openRequest).not.toMatch(pattern);
    }
  });
});

describe('the existing real Support request path is intact and reachable', () => {
  it('the four user routes are unchanged — nothing was added to the contract', () => {
    expect(SUPPORT_API.tickets).toBe('/support/tickets');
    expect(SUPPORT_API.ticket('GN-ABC123')).toBe('/support/tickets/GN-ABC123');
    expect(SUPPORT_API.messages('GN-ABC123')).toBe('/support/tickets/GN-ABC123/messages');
    expect(Object.keys(SUPPORT_API).sort()).toEqual(['messages', 'ticket', 'tickets']);
  });

  it('no handoff, escalate or status route was invented anywhere on the frontend', () => {
    const routes = source('lib', 'support', 'supportRoutes.ts');
    expect(routes).not.toMatch(/handoff|escalat|status/i);
  });

  it('the Support page opens that surface from the conversation, and submits nothing itself', () => {
    const screen = source('components', 'support', 'SupportScreen.tsx');

    // The conversation's route control opens the real request surface...
    expect(screen).toMatch(/onOpenRequestSurface=\{\(\)\s*=>\s*\{/);
    expect(screen).toContain('setShowTickets(true)');
    expect(screen).toContain('setComposing(true)');

    // ...and the form the reader then fills in is the pre-existing one.
    expect(screen).toContain('NewSupportRequestForm');
  });

  it('the conversation itself still makes no network call of any kind', () => {
    for (const file of ['SupportConversation.tsx', 'TranscriptTurn.tsx']) {
      const text = source('components', 'support', 'conversation', file);
      expect(text).not.toMatch(/\bfetch\s*\(/);
      expect(text).not.toMatch(/accountFetch|useSupportApi|SUPPORT_API/);
    }
    const adapter = source('lib', 'support', 'conversation', 'noTransportAdapter.ts');
    expect(adapter).not.toMatch(/\bfetch\s*\(/);
    expect(adapter).not.toMatch(/SUPPORT_API|\/support\//);
  });
});

describe('R2 is preserved — the fixtures are still unreachable and still unconsulted', () => {
  it('the live surface still answers the product question with WITHHELD and no provider', async () => {
    for (const locale of ['en', 'pl'] as const) {
      const reply = await LIVE().respond({
        locale,
        userTurns: [userTurn({ id: 'u1', body: QUESTIONS[locale], at: 't' })],
      });
      expect(reply.turn.outcome).toBe('WITHHELD');
      expect(reply.turn.source).toBeNull();
      expect(reply.turn.sources).toBeUndefined();
      expect(reply.escalate).toBeUndefined();
    }
  });

  it('nothing in the live surface names a fixture publisher or a provider', () => {
    for (const locale of ['en', 'pl'] as const) {
      const html = renderLive(locale);
      for (const marker of [
        'Fixture Wire Service',
        'Fixture Regional Daily',
        '/analysis/news',
        'GNews',
        'OpenAI',
        'GDELT',
        'EventRegistry',
      ]) {
        expect({ locale, marker, present: html.includes(marker) }).toEqual({
          locale,
          marker,
          present: false,
        });
      }
    }
  });

  it('the surface still imports no mock — R2 §1 holds after R2-1', () => {
    const surface = source('components', 'support', 'conversation', 'SupportConversation.tsx');
    expect(surface).not.toContain('createMockConversationAdapter');
    expect(surface).toContain('adapter: SupportConversationAdapter');
  });
});
