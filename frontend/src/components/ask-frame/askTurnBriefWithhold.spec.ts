import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AskV2Operation } from '@/lib/api/askV2Api';
import { briefingStrings } from '@/lib/ask/briefingStrings';
import { briefingWithheldForEvidence } from './AskTurnBrief';

/**
 * CTO Politics ruling (briefings) — Save as briefing is truthfully unavailable when the briefing path cannot
 * preserve the answer's evidence. The decision is the SHARED `briefingPreservesEvidence` (the server enforces the
 * same check), taken from the payload the answer already carries; never a request, never a per-module rule.
 */
const obs = { reference: 'r1', kind: 'K', label: null, value: null, unit: null, period: '2026-09-18', geography: 'POL', source: { name: 'S', url: null, licence: null }, retainedAt: null };
const op = (contributions: { contributorId: string; status: string; observations?: unknown[] }[] | null): AskV2Operation =>
  ({
    turnId: 't1',
    status: 'COMPLETED',
    result: {
      payload: {
        schema: 'ask-r2-result/1',
        answer: { state: 'CURRENT_REPORTING' },
        intelligence:
          contributions === null
            ? null
            : {
                considered: contributions.map((c) => c.contributorId),
                contributions: contributions.map((c) => ({ domain: 'x', applicability: 'SUPPLEMENTARY', temporalBasis: 'NONE', geographyBasis: null, disclosures: [], degradationReason: null, observations: [obs], ...c })),
              },
      },
    },
  }) as unknown as AskV2Operation;

describe('Save as briefing reflects whether the briefing path can preserve the evidence', () => {
  it.each(['POLITICS', 'CONFLICT', 'ECONOMY_CPI'])('withheld when %s evidence was USED', (id) => {
    expect(briefingWithheldForEvidence(op([{ contributorId: id, status: 'USED' }]))).toBe(true);
  });
  it('offered as before when the answer rests on no specialist evidence', () => {
    expect(briefingWithheldForEvidence(op(null))).toBe(false);
    expect(briefingWithheldForEvidence(op([{ contributorId: 'GEOGRAPHY', status: 'USED' }]))).toBe(false);
    expect(briefingWithheldForEvidence(op([{ contributorId: 'POLITICS', status: 'NO_MATCH', observations: [] }]))).toBe(false);
    expect(briefingWithheldForEvidence(undefined)).toBe(false);
  });

  it('uses the shared check, renders from the shared catalogue after the availability gate, and makes no request', () => {
    const src = readFileSync(join(__dirname, 'AskTurnBrief.tsx'), 'utf8');
    expect(src).toContain(`import { briefingPreservesEvidence } from '@globalnews-ai/shared';`);
    expect(src).not.toMatch(/'POLITICS'/);
    const gate = src.indexOf('if (!eligible || !available) return null;');
    const withheld = src.indexOf('if (briefingWithheldForEvidence(operation)) {');
    expect(gate).toBeGreaterThan(-1);
    expect(withheld).toBeGreaterThan(gate);
    const branch = src.slice(withheld, src.indexOf('async function toggleMenu', withheld));
    expect(branch).toContain('data-ask="brief-unavailable"');
    expect(branch).toContain('{t.unavailableForEvidence}');
    expect(branch).not.toMatch(/askV2Api|fetch\(|onClick/);
  });

  it('the shared catalogue carries the key for every locale it serves (EN, PL)', () => {
    expect(briefingStrings('en').unavailableForEvidence).toBe('Briefing unavailable for this evidence-backed answer');
    expect(briefingStrings('pl').unavailableForEvidence).toBe('Briefing niedostępny dla tej odpowiedzi opartej na dowodach');
  });
});
