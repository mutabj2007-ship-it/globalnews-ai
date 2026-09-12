import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECTION_BOUNDS, buildProviderQuery, project, projectAgentInput } from './projection';
import { parseTranscript, userTurn, type Turn } from './types';

/**
 * THE LOOP GUARD AND THE EXPORT — the two properties on which everything else
 * in this feature rests.
 *
 * Authorities: F-SUPPORT-AI-CONVERSATION-V1-CONTRACT-1 `01` (the typed
 * projection) and `08` V-1/V-11; E1-SUPPORT-AI-CONVERSATION-V1-SECURITY-GATE-1
 * C-1 … C-8.
 *
 * E1's §4 rule is followed literally: every negative control must FAIL before
 * the control exists and PASS after. Each guard below therefore carries a
 * positive control that is required to throw — a guard never seen to fire is
 * not known to be running.
 */

const DIR = __dirname;
const code = (name: string): string =>
  readFileSync(join(DIR, name), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const PLANT = 'GNAI-PLANTED-IDENTIFIER-7f3a';

function seededTranscript(): readonly Turn[] {
  return [
    userTurn({ id: 'u1', body: `first question ${PLANT}-user-visible`, at: 't1' }),
    {
      kind: 'AGENT',
      id: 'a1',
      at: 't2',
      outcome: 'ANSWER',
      source: 'AUTHORED',
      body: `agent text ${PLANT}-agent`,
    },
    { kind: 'OPERATOR', id: 'o1', at: 't3', body: `operator text ${PLANT}-operator`, operatorId: `${PLANT}-op-id` },
    { kind: 'SYSTEM', id: 's1', at: 't4', notice: 'QUEUED' },
    userTurn({ id: 'u2', body: 'follow-up question', at: 't5' }),
  ];
}

describe('C-1/C-2 — the projection is an allowlist over nominally distinct types', () => {
  it('returns ONLY the user turns, in order, verbatim', () => {
    const projected = projectAgentInput(seededTranscript());
    expect(projected.map((turn) => turn.id)).toEqual(['u1', 'u2']);
    expect(projected.map((turn) => turn.body)).toEqual([
      `first question ${PLANT}-user-visible`,
      'follow-up question',
    ]);
    expect(projected.every((turn) => turn.kind === 'USER')).toBe(true);
  });

  it('is written as an allowlist, never a denylist — the fail-closed direction', () => {
    const source = code('types.ts');
    expect(source).toContain("turn.kind === 'USER'");
    // The refused form. Under a denylist a turn kind added next year is
    // silently INCLUDED, and nothing makes anyone notice.
    expect(source).not.toMatch(/kind\s*!==\s*'AGENT'/);
    expect(source).not.toMatch(/kind\s*!==\s*'OPERATOR'/);
    expect(source).not.toMatch(/kind\s*!==\s*'SYSTEM'/);
  });

  it('POSITIVE CONTROL — the denylist guard fires on a denylist', () => {
    const bad = "const x = turns.filter((t) => t.kind !== 'AGENT');";
    expect(() => expect(bad).not.toMatch(/kind\s*!==\s*'AGENT'/)).toThrow();
  });

  it('a turn kind nobody has written yet is excluded rather than included', () => {
    const future = { kind: 'FUTURE_KIND', id: 'f1', at: 't6', body: 'should never be sent' };
    const parsed = parseTranscript([...seededTranscript(), future]);
    expect(buildProviderQuery(parsed)).not.toContain('should never be sent');
  });
});

describe('C-3/C-4 — parse at the boundary, never cast, never trust a client kind', () => {
  it('drops an unrecognised kind and a malformed row rather than coercing either', () => {
    const parsed = parseTranscript([
      { kind: 'USER', id: 'u1', at: 't1', body: 'kept' },
      { kind: 'USER', id: 'u2', at: 't2' }, // no body
      { kind: 'NONSENSE', id: 'x', at: 't3', body: 'dropped' },
      null,
      'not an object',
      { id: 'y', at: 't4', body: 'no kind' },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('u1');
  });

  it('no type assertion exists anywhere on the projection path', () => {
    for (const file of ['types.ts', 'projection.ts', 'adapter.ts']) {
      const source = code(file);
      expect(source).not.toMatch(/\bas\s+(UserTurn|AgentTurn|OperatorTurn|SystemTurn|Turn)\b/);
      expect(source).not.toMatch(/\bas\s+unknown\s+as\b/);
      expect(source).not.toMatch(/\bas\s+Record</);
    }
  });

  it('POSITIVE CONTROL — the cast guard fires on a cast', () => {
    expect(() =>
      expect('const t = row as UserTurn;').not.toMatch(/\bas\s+(UserTurn|Turn)\b/),
    ).toThrow();
  });

  it('the browser never claims authorship on the wire — the declared contract carries no author field', () => {
    const source = code('adapter.ts');
    const wire = source.slice(source.indexOf('interface AgentWireRequest'));
    expect(wire).toContain('userTurnIds');
    expect(wire).not.toMatch(/authorType/);
    expect(wire).not.toMatch(/\bkind\s*[?:]/);
  });
});

describe('C-5 — one projection, and it is the only way in', () => {
  it('every provider payload is assembled by buildProviderQuery, which is the only assembly site', () => {
    const source = code('projection.ts');
    expect((source.match(/export function buildProviderQuery/g) ?? []).length).toBe(1);
    // The assembly is a join over the projection and nothing else.
    const body = source.slice(source.indexOf('export function buildProviderQuery'));
    expect(body).toContain('projectAgentInput(turns)');
    expect(body).not.toMatch(/turns\.map/);
  });

  it('no other module in this feature assembles provider input', () => {
    for (const file of ['mockAdapter.ts', 'stateMachine.ts', 'types.ts']) {
      expect(code(file)).not.toContain('.join(');
    }
  });
});

describe('C-6/C-7 · V-11 — what leaves, and what cannot', () => {
  const payload = buildProviderQuery(seededTranscript());

  it('contains the reader’s own turns', () => {
    expect(payload).toContain('first question');
    expect(payload).toContain('follow-up question');
  });

  it('contains NO agent text, NO operator text and NO system turn', () => {
    expect(payload).not.toContain('agent text');
    expect(payload).not.toContain('operator text');
    expect(payload).not.toContain('QUEUED');
  });

  it('contains no planted identifier from any non-user turn — the identifier plant', () => {
    expect(payload).not.toContain(`${PLANT}-agent`);
    expect(payload).not.toContain(`${PLANT}-operator`);
    expect(payload).not.toContain(`${PLANT}-op-id`);
  });

  it('contains no conversation id, no turn id, no locale and no account field', () => {
    expect(payload).not.toContain('u1');
    expect(payload).not.toContain('o1');
    expect(payload).not.toMatch(/\ben\b|\bpl\b/);
  });

  it('POSITIVE CONTROL — the leak guards fire when agent text is present', () => {
    const leaked = `${payload}\n\nagent text`;
    expect(() => expect(leaked).not.toContain('agent text')).toThrow();
  });
});

describe('C-8 — the context bound binds, oldest-first, after the allowlist', () => {
  function longTranscript(count: number, size = 20): Turn[] {
    return Array.from({ length: count }, (_, index) =>
      userTurn({ id: `u${index}`, body: `${index}`.padEnd(size, 'x'), at: `t${index}` }),
    );
  }

  it('caps the number of projected turns', () => {
    const result = project(longTranscript(PROJECTION_BOUNDS.MAX_PROJECTED_TURNS + 6));
    expect(result.userTurns).toHaveLength(PROJECTION_BOUNDS.MAX_PROJECTED_TURNS);
    expect(result.truncated).toBe(true);
  });

  it('truncates OLDEST-FIRST — the newest turn is always the one kept', () => {
    const turns = longTranscript(PROJECTION_BOUNDS.MAX_PROJECTED_TURNS + 3);
    const result = project(turns);
    expect(result.userTurns[result.userTurns.length - 1].id).toBe(turns[turns.length - 1].id);
    expect(result.userTurns[0].id).toBe(turns[3].id);
  });

  it('caps total characters as well as turn count — a few enormous turns are bounded too', () => {
    const huge = Array.from({ length: 5 }, (_, index) =>
      userTurn({ id: `h${index}`, body: 'y'.repeat(PROJECTION_BOUNDS.MAX_PROJECTED_CHARACTERS), at: `t${index}` }),
    );
    const result = project(huge);
    const total = result.userTurns.reduce((sum, turn) => sum + turn.body.length, 0);
    expect(total).toBeLessThanOrEqual(PROJECTION_BOUNDS.MAX_PROJECTED_CHARACTERS);
    expect(result.userTurns).toHaveLength(1);
  });

  it('the payload STOPS GROWING once the bound is reached — the cost-amplification control', () => {
    const size = (count: number): number =>
      buildProviderQuery(longTranscript(count, 100)).length;
    const atBound = size(PROJECTION_BOUNDS.MAX_PROJECTED_TURNS);
    const wayPast = size(PROJECTION_BOUNDS.MAX_PROJECTED_TURNS + 25);
    expect(wayPast).toBeLessThanOrEqual(atBound);
  });

  it('the bound is applied AFTER the allowlist, never before', () => {
    // A transcript whose newest entries are all non-user must still project
    // the user turns that precede them, not an empty payload.
    const turns: Turn[] = [
      ...longTranscript(3),
      { kind: 'AGENT', id: 'a', at: 't', outcome: 'ANSWER', source: 'AUTHORED', body: 'x' },
      { kind: 'SYSTEM', id: 's', at: 't', notice: 'QUEUED' },
    ];
    expect(project(turns).userTurns).toHaveLength(3);
  });

  it('reports the conversation ceiling as a BOOLEAN — no count may reach the reader', () => {
    const result = project(longTranscript(PROJECTION_BOUNDS.MAX_TURNS_PER_CONVERSATION));
    expect(result.atConversationCeiling).toBe(true);
    expect(typeof result.atConversationCeiling).toBe('boolean');
  });
});
