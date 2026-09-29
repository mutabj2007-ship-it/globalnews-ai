import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AskV2Operation } from '@/lib/api/askV2Api';
import { AskTurnSave } from './AskTurnSave';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — the Save / Saved control, with `fetch` mocked AT THE
 * WIRE so every request is counted by method and path. Save is ONE POST, Unsave is ONE DELETE,
 * a press while in flight sends nothing, and nothing else ever leaves the page: no analysis,
 * no turn, no execute, no Sand.
 */
type Call = { method: string; path: string; body?: string };
let calls: Call[] = [];
let release: (() => void) | null = null;
let hold = false;

beforeEach(() => {
  calls = [];
  hold = false;
  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.document = { cookie: 'gna_csrf=csrf' };
  g.fetch = jest.fn(async (input: string, init?: { method?: string; body?: string }) => {
    const path = String(input).replace(/^https?:\/\/[^/]+/, '');
    calls.push({ method: init?.method ?? 'GET', path, body: init?.body });
    if (hold) await new Promise<void>((resolve) => (release = resolve));
    const bookmarked = (init?.method ?? 'GET') === 'POST';
    return {
      ok: true,
      status: 200,
      json: async () => ({ turnId: 'turn-1', bookmarked }),
    } as Response;
  });
});

const op = (over: Partial<AskV2Operation> = {}): AskV2Operation =>
  ({
    operationId: 'op-1',
    computeClass: 'FRESH_BOUNDED',
    status: 'COMPLETED',
    quotedSand: 0,
    chargingEnabled: false,
    requiresAcceptance: false,
    quoteExpiresAt: '2031-01-01T00:00:00Z',
    acceptedAt: null,
    storedResultId: 'sr-1',
    storedResultReused: false,
    failureCode: null,
    turnId: 'turn-1',
    bookmarked: false,
    result: {
      id: 'sr-1',
      payload: {
        schema: 'ask-r2-result/1',
        answer: {
          state: 'CURRENT_REPORTING',
          basis: 'REQUIRED_EVIDENCE_OBTAINED',
          missingRoles: [],
        },
      },
      evidenceRevision: 'r',
      expiresAt: '2031-01-01T00:00:00Z',
      expired: false,
      displayOnly: true,
    },
    ...over,
  }) as AskV2Operation;

async function mount(operation: AskV2Operation | undefined, locale: 'en' | 'pl' = 'en') {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(AskTurnSave, { operation, locale }));
  });
  return r;
}
const button = (r: ReactTestRenderer) =>
  r.root.find((n) => n.type === 'button' && n.props['data-ask'] === 'save');
const press = async (r: ReactTestRenderer) =>
  act(async () => {
    await button(r).props.onClick();
  });
const NON_BOOKMARK = /analysis|\/turns|execute|accept|reserve|quote|sand|ledger/i;

describe('Save / Saved — one request per press, nothing else', () => {
  it('Save is ONE POST /ask-v2/bookmarks {turnId}; the control then reads Saved (aria-pressed)', async () => {
    const r = await mount(op());
    expect(button(r).props['aria-pressed']).toBe(false);
    await press(r);
    expect(calls).toEqual([
      { method: 'POST', path: '/api/ask-v2/bookmarks', body: JSON.stringify({ turnId: 'turn-1' }) },
    ]);
    expect(button(r).props['aria-pressed']).toBe(true);
    expect(JSON.stringify(r.toJSON())).toContain('Saved');
  });

  it('Unsave is ONE DELETE /ask-v2/bookmarks/:turnId; the control then reads Save', async () => {
    const r = await mount(op({ bookmarked: true }));
    expect(button(r).props['aria-pressed']).toBe(true);
    await press(r);
    expect(calls).toEqual([
      { method: 'DELETE', path: '/api/ask-v2/bookmarks/turn-1', body: undefined },
    ]);
    expect(button(r).props['aria-pressed']).toBe(false);
  });

  it('a second press while the first is in flight sends nothing', async () => {
    hold = true;
    const r = await mount(op());
    let first!: Promise<unknown>;
    await act(async () => {
      first = Promise.resolve(button(r).props.onClick());
    });
    await act(async () => {
      await button(r).props.onClick();
    });
    expect(calls).toHaveLength(1);
    await act(async () => {
      release?.();
      await first;
    });
    expect(calls).toHaveLength(1);
  });

  it('never calls anything but the bookmark endpoint — 0 analysis, 0 turn, 0 execute, 0 Sand', async () => {
    const r = await mount(op());
    await press(r);
    await press(r);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/ask-v2/bookmarks',
      'DELETE /api/ask-v2/bookmarks/turn-1',
    ]);
    expect(calls.some((c) => NON_BOOKMARK.test(c.path))).toBe(false);
  });

  it.each<[string, AskV2Operation | undefined]>([
    ['no turnId (not the reader’s stored turn)', op({ turnId: null })],
    ['not completed', op({ status: 'QUOTED' })],
    ['no stored result', op({ result: null })],
    ['no operation at all', undefined],
    /* ALPHA VISUAL ACCEPTANCE REPAIR (M4) — no produced answer, nothing to bookmark. */
    ...(['CLARIFICATION_REQUIRED', 'INSUFFICIENT', 'CAPABILITY_UNAVAILABLE'] as const).map(
      (state) =>
        [
          `no produced answer: ${state}`,
          op({
            result: {
              id: 'sr-1',
              payload: {
                schema: 'ask-r2-result/1',
                answer: { state, basis: 'x', missingRoles: [] },
              },
              evidenceRevision: 'r',
              expiresAt: '2031-01-01T00:00:00Z',
              expired: false,
              displayOnly: true,
            },
          }),
        ] as [string, AskV2Operation],
    ),
    [
      'an unreadable payload',
      op({
        result: {
          id: 'sr-1',
          payload: {},
          evidenceRevision: 'r',
          expiresAt: '2031-01-01T00:00:00Z',
          expired: false,
          displayOnly: true,
        },
      }),
    ],
  ])('renders NOTHING when ineligible: %s', async (_label, operation) => {
    const r = await mount(operation);
    expect(r.toJSON()).toBeNull();
    expect(calls).toEqual([]);
  });

  it('EN / PL labels come from the continuity strings', async () => {
    const pl = await mount(op(), 'pl');
    expect(JSON.stringify(pl.toJSON())).toContain('Zapisz');
    await press(pl);
    expect(JSON.stringify(pl.toJSON())).toContain('Zapisano');
  });

  it('is a real <button type="button"> — keyboard operable by default', async () => {
    const r = await mount(op());
    expect(button(r).props.type).toBe('button');
  });
});
