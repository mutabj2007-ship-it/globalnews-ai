import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assessBriefCompliance,
  countSynthesisParagraphs,
  MIN_CATEGORIES_FOR_STRUCTURE,
  MIN_CLUSTERS_FOR_STRUCTURE,
} from './brief-compliance.util';
import {
  buildAnalysisJsonSchema,
  buildDevelopmentBreadthSection,
} from '../prompt/build-analysis-prompt.util';
import { normalizeBriefFields } from '../providers/normalize-brief-fields.util';
import type { AnalysisDevelopmentBreadth } from '../interfaces/analysis-provider.interface';

/*
 * ---------------------------------------------------------------------------
 * C910 - EXECUTIVE BRIEF FIRST-PASS STRUCTURAL GUARANTEE
 * ---------------------------------------------------------------------------
 *
 * The Production defect this closes: query "Zambia", 6 clusters across 3 domains,
 * OpenAI succeeded on attempt 1, and the brief was still one paragraph and was
 * withheld. C909 had told the model the consequence in prose; the schema still
 * declared `summary` an unconstrained string in a `strict: true` call whose prompt
 * says the schema is the exact contract.
 *
 * No live OpenAI or GNews call is made anywhere in this file.
 */

const ZAMBIA: AnalysisDevelopmentBreadth = { clusters: 6, categories: 3, multiDevelopment: true };
const NARROW: AnalysisDevelopmentBreadth = { clusters: 1, categories: 1, multiDevelopment: false };

type Schema = {
  name: string;
  strict: boolean;
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties?: boolean;
  };
};
const schemaFor = (b?: AnalysisDevelopmentBreadth): Schema =>
  buildAnalysisJsonSchema(b) as unknown as Schema;

const BACKEND_SRC = join(__dirname, '..', '..', '..');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const code = (relative: string): string =>
  stripComments(readFileSync(join(BACKEND_SRC, relative), 'utf8'));

const SERVICE = 'modules/analysis/service/analysis.service.ts';
const PROVIDER = 'modules/analysis/providers/openai-analysis.provider.ts';
const VALIDATOR = 'modules/analysis/validation/brief-compliance.util.ts';

describe('G1 - a Zambia-like evidence set cannot produce a one-paragraph brief', () => {
  it('the schema does not offer a single `summary` field at all', () => {
    const s = schemaFor(ZAMBIA);
    expect(Object.keys(s.schema.properties)).not.toContain('summary');
    expect(s.schema.required).not.toContain('summary');
  });

  it('it requires BOTH brief fields', () => {
    const s = schemaFor(ZAMBIA);
    expect(Object.keys(s.schema.properties)).toEqual(
      expect.arrayContaining(['primaryDevelopment', 'additionalDevelopments']),
    );
    expect(s.schema.required).toEqual(
      expect.arrayContaining(['primaryDevelopment', 'additionalDevelopments']),
    );
  });

  it('the call stays strict, which is what makes `required` binding', () => {
    expect(schemaFor(ZAMBIA).strict).toBe(true);
    expect(schemaFor(ZAMBIA).schema.additionalProperties).toBe(false);
  });

  it('every declared property appears in `required` - the strict-mode invariant', () => {
    for (const b of [ZAMBIA, NARROW, undefined]) {
      const s = schemaFor(b);
      expect([...s.schema.required].sort()).toEqual(Object.keys(s.schema.properties).sort());
    }
  });

  it('no unsupported cardinality keyword is used anywhere in the schema', () => {
    const serialised = JSON.stringify(schemaFor(ZAMBIA));
    expect(serialised).not.toContain('minItems');
    expect(serialised).not.toContain('maxItems');
    expect(serialised).not.toContain('minLength');
  });

  it('both descriptions state that the fields cover DIFFERENT developments', () => {
    const p = schemaFor(ZAMBIA).schema.properties as Record<string, { description?: string }>;
    expect(p.primaryDevelopment.description).toMatch(/DIFFERENT material developments/);
    expect(p.additionalDevelopments.description).toMatch(/distinct from the one in/);
  });

  it('a schema-conformant answer normalises to a COMPLIANT brief', () => {
    const answer = {
      query: 'Zambia',
      headline: 'Recent Developments in Zambia',
      primaryDevelopment: 'Solar capacity passed 841 MW, according to the supplied reporting.',
      additionalDevelopments: 'Separately, a volunteer cycling programme was reported.',
    };
    const normalised = normalizeBriefFields(answer) as { summary: string };
    expect(countSynthesisParagraphs(normalised.summary)).toBeGreaterThanOrEqual(2);
    expect(assessBriefCompliance(normalised.summary, ZAMBIA).compliant).toBe(true);
  });

  it('the prose section no longer argues against its own requirement', () => {
    const section = buildDevelopmentBreadthSection(ZAMBIA);
    expect(section).not.toContain('There is no target count');
    expect(section).toContain('primaryDevelopment');
    expect(section).toContain('additionalDevelopments');
    expect(section).toMatch(/DIFFERENT material developments/);
    expect(section).toMatch(/DO NOT PAD/);
    expect(section).toContain('6 clusters do not mean 6 developments');
    // the C909 statements the contract did NOT ask to remove are still here
    expect(section).toContain('WITHHELD');
    expect(section).toContain('no second attempt');
    expect(section).toContain('BLANK LINE');
  });
});

describe('G2 - the externally consumed `summary` remains a string', () => {
  it('normalisation yields a string `summary` and removes the internal field names', () => {
    const out = normalizeBriefFields({
      headline: 'h',
      primaryDevelopment: 'A.',
      additionalDevelopments: 'B.',
    }) as Record<string, unknown>;
    expect(typeof out.summary).toBe('string');
    expect(out).not.toHaveProperty('primaryDevelopment');
    expect(out).not.toHaveProperty('additionalDevelopments');
    expect(out.headline).toBe('h');
  });

  it('the two field names never leave the provider boundary', () => {
    expect(code(SERVICE)).not.toContain('primaryDevelopment');
    expect(code(SERVICE)).not.toContain('additionalDevelopments');
    expect(code(VALIDATOR)).not.toContain('primaryDevelopment');
  });

  it('the joiner is the blank line both ends already agree on', () => {
    const out = normalizeBriefFields({
      primaryDevelopment: 'A.',
      additionalDevelopments: 'B.',
    }) as { summary: string };
    expect(out.summary).toBe('A.\n\nB.');
  });
});

describe('G3 - exactly one provider call, and no repair', () => {
  it('the service makes exactly one analyzeNews call', () => {
    expect(code(SERVICE).match(/this\.provider\.analyzeNews\(/g) ?? []).toHaveLength(1);
  });

  it('the service never supplies a repairDirective', () => {
    expect(code(SERVICE)).not.toContain('repairDirective');
  });

  it('repairRequested remains pinned false', () => {
    expect(code(SERVICE)).toContain('const repairRequested = false;');
  });

  it('the provider issues exactly one fetch and one schema build', () => {
    const provider = code(PROVIDER);
    expect(provider.match(/buildAnalysisJsonSchema\(/g) ?? []).toHaveLength(1);
    expect(provider.match(/await fetch\(/g) ?? []).toHaveLength(1);
  });

  it('breadth is passed through, never re-derived in the provider', () => {
    expect(code(PROVIDER)).not.toContain('detectDevelopmentBreadth');
    expect(code(PROVIDER)).toContain('buildAnalysisJsonSchema(developmentBreadth)');
    expect(code(SERVICE).match(/detectDevelopmentBreadth\(/g) ?? []).toHaveLength(1);
  });

  it('no model or temperature change', () => {
    expect(code(PROVIDER)).toContain('temperature: 0.2');
    expect(code(PROVIDER)).not.toContain('openAiModel:');
  });
});

describe('G4 - the validator still rejects degenerate output', () => {
  it.each([
    ['empty second field', { primaryDevelopment: 'Only this.', additionalDevelopments: '' }],
    ['whitespace second field', { primaryDevelopment: 'Only this.', additionalDevelopments: '   ' }],
    ['empty first field', { primaryDevelopment: '', additionalDevelopments: 'Only this.' }],
    ['both empty', { primaryDevelopment: '', additionalDevelopments: '' }],
  ])('%s still WITHHOLDS for a multi-development set', (_label, answer) => {
    const out = normalizeBriefFields(answer) as { summary: string };
    expect(assessBriefCompliance(out.summary, ZAMBIA).compliant).toBe(false);
  });

  it('the withheld reason is unchanged and still names the measured counts', () => {
    const out = normalizeBriefFields({
      primaryDevelopment: 'One.',
      additionalDevelopments: '',
    }) as { summary: string };
    expect(assessBriefCompliance(out.summary, ZAMBIA).reason).toBe(
      'The retrieved evidence carries 6 distinct reporting clusters across 3 domains, ' +
        'and the summary is a single paragraph.',
    );
  });

  it('thresholds are unmoved and the validator module gained nothing', () => {
    expect(MIN_CLUSTERS_FOR_STRUCTURE).toBe(2);
    expect(MIN_CATEGORIES_FOR_STRUCTURE).toBe(2);
    expect(code(VALIDATOR)).toContain('export const MIN_CLUSTERS_FOR_STRUCTURE = 2;');
    expect(code(VALIDATOR)).toContain('export const MIN_CATEGORIES_FOR_STRUCTURE = 2;');
  });
});

describe('G5 - single-development and Statistics Poland behaviour unchanged', () => {
  it('the narrow schema is byte-identical to the no-breadth schema', () => {
    expect(JSON.stringify(schemaFor(NARROW))).toBe(JSON.stringify(schemaFor(undefined)));
  });

  it('the narrow schema still carries one `summary` string', () => {
    const s = schemaFor(NARROW);
    expect(s.schema.properties.summary).toEqual({ type: 'string' });
    expect(s.schema.required).toContain('summary');
    expect(Object.keys(s.schema.properties)).not.toContain('primaryDevelopment');
  });

  it('a narrow one-paragraph brief is still accepted', () => {
    expect(assessBriefCompliance('One concise paragraph.', NARROW).compliant).toBe(true);
  });

  it('normalisation is a NO-OP on every non-multi-development payload', () => {
    const narrowAnswer = { query: 'Statistics Poland', summary: 'One paragraph.' };
    expect(normalizeBriefFields(narrowAnswer)).toBe(narrowAnswer);
    expect(normalizeBriefFields({ primaryDevelopment: 'only one field' })).toEqual({
      primaryDevelopment: 'only one field',
    });
    expect(normalizeBriefFields({ primaryDevelopment: 1, additionalDevelopments: 2 })).toEqual({
      primaryDevelopment: 1,
      additionalDevelopments: 2,
    });
    expect(normalizeBriefFields(null)).toBeNull();
    expect(normalizeBriefFields('a string')).toBe('a string');
    expect(normalizeBriefFields([1, 2])).toEqual([1, 2]);
  });

  it('the narrow prose section is unchanged from C909', () => {
    const section = buildDevelopmentBreadthSection(NARROW);
    expect(section).toContain('NARROW EVIDENCE SET');
    expect(section).toMatch(/One well-written paragraph is a correct/);
    expect(section).not.toContain('primaryDevelopment');
  });

  it('absent breadth still emits no prose section', () => {
    expect(buildDevelopmentBreadthSection(undefined)).toBe('');
  });
});

describe('G6 - no frontend or public contract surface is referenced', () => {
  it('the changed backend modules import nothing from the frontend', () => {
    for (const f of [PROVIDER, 'modules/analysis/prompt/build-analysis-prompt.util.ts']) {
      expect(code(f)).not.toMatch(/from '.*frontend/);
      expect(code(f)).not.toMatch(/@\/components/);
    }
  });

  it('the shared analysis budget is not referenced by the changed provider', () => {
    expect(code(PROVIDER)).not.toContain('ANALYSIS_TOTAL_BUDGET_MS');
  });
});
