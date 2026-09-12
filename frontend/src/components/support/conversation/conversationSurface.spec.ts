import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';
import type { Turn } from '@/lib/support/conversation/types';
import { userTurn } from '@/lib/support/conversation/types';
import { SupportConversation } from './SupportConversation';
import { TranscriptTurn } from './TranscriptTurn';

/**
 * THE SURFACE — what a reader actually meets.
 *
 * Authorities: F `03` (identity), F `06` D-1…D-6 (disclosure placement), F
 * `08` V-5/V-13; E1 C-9 (no attachment field), C-12/C-13, C-32.
 *
 * These assert RENDERED MARKUP rather than source text wherever the property
 * is a property of what the browser produces. E1 is explicit about why:
 * `cors-credentials.e2e-spec.ts` reads a file with a regex and "asserts what
 * the file says, not what the browser does" — a source-text test is admissible
 * only where the property genuinely is a property of the source.
 */

const HERE = __dirname;
const LIB = join(HERE, '..', '..', '..', 'lib', 'support', 'conversation');

const code = (path: string): string =>
  readFileSync(path, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function renderSurface(locale: 'en' | 'pl'): string {
  return renderToStaticMarkup(
    createElement(SupportConversation, { t: locale === 'pl' ? supportPl : supportEn, locale }),
  );
}

function renderTurn(turn: Turn, locale: 'en' | 'pl' = 'en'): string {
  const dictionary = locale === 'pl' ? supportPl : supportEn;
  return renderToStaticMarkup(
    createElement(TranscriptTurn, { turn, t: dictionary.conversation, authors: dictionary.authors }),
  );
}

describe('V-13 / D-1 / D-2 — the disclosure is rendered BEFORE the first send, in the conversation', () => {
  for (const locale of ['en', 'pl'] as const) {
    it(`is present in the initial document (${locale}) before any submission is possible`, () => {
      const dictionary = locale === 'pl' ? supportPl : supportEn;
      const html = renderSurface(locale);
      expect(html).toContain(dictionary.conversation.disclosure.beforeFirstSend);
    });
  }

  it('D-6 — it informs; it is NOT a consent gate', () => {
    const html = renderSurface('en');
    expect(html).not.toContain('type="checkbox"');
    // Nothing in the composer is gated on acknowledging it.
    expect(html).toContain('id="support-conversation-composer"');
  });

  it('D-3 — the compact form exists so the statement can shrink without disappearing', () => {
    expect(code(join(HERE, 'SupportConversation.tsx'))).toContain('disclosure.compact');
  });

  it('POSITIVE CONTROL — the disclosure assertion fires when the string is absent', () => {
    expect(() => expect('<main></main>').toContain(supportEn.conversation.disclosure.beforeFirstSend)).toThrow();
  });
});

describe('E1 C-9 — V1 has no attachment field. Not disabled: ABSENT.', () => {
  it('the rendered surface offers no file input of any kind', () => {
    const html = renderSurface('en');
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('accept=');
    expect(html).not.toContain('multiple');
  });

  it('no component in this feature implements upload, drag-and-drop or paste-to-attach', () => {
    for (const file of readdirSync(HERE).filter((name) => name.endsWith('.tsx'))) {
      const source = code(join(HERE, file));
      expect(source).not.toMatch(/onDrop|onDragOver|onDragEnter|DataTransfer|FileReader|FormData/);
      expect(source).not.toMatch(/type="file"/);
    }
  });

  it('POSITIVE CONTROL — the attachment guard fires', () => {
    expect(() => expect('<input type="file" />').not.toContain('type="file"')).toThrow();
  });
});

describe('F `03` — identity is a property of the TURN, and is in its accessible name', () => {
  const user = userTurn({ id: 'u1', body: 'a question', at: 't1' });
  const agent: Turn = {
    kind: 'AGENT',
    id: 'a1',
    at: 't2',
    outcome: 'ANSWER',
    source: 'AUTHORED',
    body: 'an answer',
  };
  const operator: Turn = { kind: 'OPERATOR', id: 'o1', at: 't3', body: 'a person replies', operatorId: 'op' };
  const system: Turn = { kind: 'SYSTEM', id: 's1', at: 't4', notice: 'HUMAN_ARRIVED' };

  it('I-3 — the automated label is in the agent turn’s ACCESSIBLE NAME, not only in decoration', () => {
    const html = renderTurn(agent);
    expect(html).toContain(`aria-label="${supportEn.authors.SYSTEM_AI.replace(/·/g, '·')}"`);
    expect(html).toContain(supportEn.authors.SYSTEM_AI);
  });

  it('I-3 — the label is not truncated by the renderer; the separator and trailing word survive', () => {
    const html = renderTurn(agent);
    expect(html).toContain('· automated');
    // A label lost to truncation fails exactly as a missing one does, so the
    // agent label must not be wrapped in a truncating class.
    const labelRow = html.slice(html.indexOf('<p'), html.indexOf('</p>'));
    expect(labelRow).not.toContain('truncate');
    expect(labelRow).toContain('whitespace-normal');
  });

  it('I-1/I-2 — the three authors render DISTINCTLY, and none can render as another', () => {
    expect(renderTurn(user)).toContain(supportEn.authors.USER);
    expect(renderTurn(agent)).toContain(supportEn.authors.SYSTEM_AI);
    expect(renderTurn(operator)).toContain(supportEn.authors.ADMIN);

    expect(renderTurn(agent)).not.toContain(`>${supportEn.authors.ADMIN}<`);
    expect(renderTurn(operator)).not.toContain(supportEn.authors.SYSTEM_AI);
  });

  it('the agent turn carries no operator identifier and the operator turn is never labelled automated', () => {
    expect(renderTurn(agent)).not.toContain('op');
    expect(renderTurn(operator)).not.toContain('automated');
  });

  it('I-4 — the handoff is a VISIBLE TURN, named as a status rather than attributed to anyone', () => {
    const html = renderTurn(system);
    expect(html).toContain(supportEn.conversation.transition.humanArrived);
    /*
      The announcement SENTENCE names the support team, and must — C-11 says
      "GlobalNews AI support has joined this conversation". What a system turn
      must not have is an AUTHORSHIP attribution: its accessible name is the
      conversation's status, and it carries no author row, so nobody is being
      quoted. Asserting the words were absent would have been asserting against
      the contract's own copy.
    */
    expect(html).toContain(`aria-label="${supportEn.conversation.transcript.systemTurnLabel}"`);
    expect(html).not.toContain(`aria-label="${supportEn.authors.ADMIN}"`);
    expect(html).not.toContain(supportEn.authors.SYSTEM_AI);
    expect(html).not.toContain('uppercase tracking-wide');
  });

  it('both locales label all three authors', () => {
    expect(renderTurn(agent, 'pl')).toContain(supportPl.authors.SYSTEM_AI);
    expect(renderTurn(operator, 'pl')).toContain(supportPl.authors.ADMIN);
    expect(renderTurn(user, 'pl')).toContain(supportPl.authors.USER);
  });

  it('POSITIVE CONTROL — the identity assertion fires on an unlabelled turn', () => {
    expect(() => expect('<article><p>an answer</p></article>').toContain(supportEn.authors.SYSTEM_AI)).toThrow();
  });
});

describe('F `04` — every non-answer is written, labelled, and leaves a route to a person', () => {
  const withheld: Turn = { kind: 'AGENT', id: 'a', at: 't', outcome: 'WITHHELD', source: null, body: '' };
  const unavailable: Turn = { kind: 'AGENT', id: 'a', at: 't', outcome: 'UNAVAILABLE', source: null, body: '' };

  it('F-4 — a failed turn still renders, and still carries the automated label', () => {
    expect(renderTurn(withheld)).toContain(supportEn.authors.SYSTEM_AI);
    expect(renderTurn(unavailable)).toContain(supportEn.authors.SYSTEM_AI);
  });

  it('the two kinds render DIFFERENT texts — one sentence spanning both would be false in one case', () => {
    expect(renderTurn(withheld)).toContain(supportEn.conversation.withheld.body);
    expect(renderTurn(unavailable)).toContain(supportEn.conversation.unavailable.body);
    expect(renderTurn(withheld)).not.toContain(supportEn.conversation.unavailable.body);
  });

  it('F-5 — both end with the route to a person, stated', () => {
    expect(renderTurn(withheld)).toContain(supportEn.conversation.escalation.offer);
    expect(renderTurn(unavailable)).toContain(supportEn.conversation.escalation.offer);
  });

  it('V-7 / F-1 — the machine skip reason NEVER reaches the rendered output', () => {
    const withReason: Turn = { ...withheld, skipReason: 'per-user-allowance' };
    const html = renderTurn(withReason);
    for (const reason of [
      'per-user-allowance', 'concurrency', 'timeout', 'provider-failed',
      'no-evidence', 'disabled', 'not-eligible', 'no-authored-match', 'out-of-scope',
    ]) {
      expect(html).not.toContain(reason);
    }
  });

  it('two turns differing ONLY in skip reason render byte-identically', () => {
    const a = renderTurn({ ...unavailable, skipReason: 'per-user-allowance' });
    const b = renderTurn({ ...unavailable, skipReason: 'provider-failed' });
    expect(a).toBe(b);
  });

  it('POSITIVE CONTROL — the skip-reason guard fires', () => {
    expect(() => expect('<p>rate limited: per-user-allowance</p>').not.toContain('per-user-allowance')).toThrow();
  });
});

describe('the answer surfaces carry their own limits text, and only their own', () => {
  it('an AUTHORED answer says a person wrote it', () => {
    const html = renderTurn({
      kind: 'AGENT', id: 'a', at: 't', outcome: 'ANSWER', source: 'AUTHORED', body: 'x',
    });
    expect(html).toContain(supportEn.conversation.authored.limits);
    expect(html).not.toContain(supportEn.conversation.analysis.preamble);
  });

  it('an ANALYSIS answer carries the preamble, its sources and the analysis limits', () => {
    const html = renderTurn({
      kind: 'AGENT', id: 'a', at: 't', outcome: 'ANSWER', source: 'ANALYSIS', body: 'x',
      sources: [{ id: 's1', outlet: 'Fixture Wire Service' }],
    });
    expect(html).toContain(supportEn.conversation.analysis.preamble);
    expect(html).toContain(supportEn.conversation.analysis.sourcesLabel);
    expect(html).toContain('Fixture Wire Service');
    expect(html).toContain(supportEn.conversation.analysis.limits);
    expect(html).not.toContain(supportEn.conversation.authored.limits);
  });

  it('F-7 — a partial answer is marked as partial, not rounded up to a whole one', () => {
    const html = renderTurn({
      kind: 'AGENT', id: 'a', at: 't', outcome: 'PARTIAL', source: 'AUTHORED', body: 'half of it',
    });
    expect(html).toContain(supportEn.conversation.partial.notice);
  });
});

describe('the surface makes no network call, and reaches no flag', () => {
  const files = [
    ...readdirSync(HERE).filter((n) => n.endsWith('.tsx')).map((n) => join(HERE, n)),
    ...readdirSync(LIB).filter((n) => n.endsWith('.ts') && !n.includes('.spec.')).map((n) => join(LIB, n)),
  ];

  it('no fetch, XHR, WebSocket, EventSource or beacon anywhere in this feature', () => {
    for (const file of files) {
      const source = code(file);
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
      expect(source).not.toMatch(/accountFetch|useSupportApi|SUPPORT_API/);
    }
  });

  it('no reference to the provider activation flag exists', () => {
    for (const file of files) {
      expect(code(file)).not.toContain('SUPPORT_AI_ENABLED');
    }
  });

  it('the default adapter is the fixture adapter, named as such', () => {
    expect(code(join(HERE, 'SupportConversation.tsx'))).toContain('createMockConversationAdapter');
  });

  it('POSITIVE CONTROL — the network guard fires', () => {
    expect(() => expect('await fetch("/x");').not.toMatch(/\bfetch\s*\(/)).toThrow();
  });
});

describe('the composer is a conversation composer, not a ticket form', () => {
  const html = renderSurface('en');

  it('has one message field with a real accessible name, and no subject or category', () => {
    expect(html).toContain('for="support-conversation-composer"');
    expect(html).toContain(supportEn.conversation.composer.label);
    expect(html).not.toContain(supportEn.form.subjectLabel);
    expect(html).not.toContain(supportEn.form.categoryLabel);
  });

  it('C-16 / F-4 — the in-flight indicator is announced to assistive technology', () => {
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(supportEn.conversation.transcript.liveRegionLabel);
  });

  it('nothing in the initial surface can overflow its width', () => {
    // Horizontal scroll is a browser property and is measured in the harness;
    // what the source must not do is set a width the viewport cannot hold.
    const source = code(join(HERE, 'SupportConversation.tsx'));
    expect(source).not.toMatch(/min-w-\[\d{3,}px\]/);
    expect(source).toContain('max-w-full');
  });
});
