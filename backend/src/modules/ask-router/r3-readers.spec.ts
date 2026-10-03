import { readDecisionSupport } from './decision-support';
import { readBilateralRelationship } from './bilateral-relationship';
import { deriveKnowledgeRequirement } from './knowledge-requirement';
import { evidencesRelationship } from '../analysis/relevance/relationship-evidence.util';
import { readConversationalTurn } from '../ask-v2/conversation/conversation-state';

/**
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — the deterministic readers behind decision support (§12),
 * the bilateral relationship (§14) and relationship evidence (§44), each with negative controls.
 */
describe('§12 decision support — a choice weighed against an objective', () => {
  it.each([
    ['Which is better for a logistics expansion, Kenya or Rwanda?', 'logistics expansion'],
    ['Which country suits a logistics expansion?', 'logistics expansion'],
    ['Which market appears stronger for market entry?', 'market entry'],
    ['Which is strongest for market expansion?', 'market expansion'],
    ['What is the best country for a regional hub in East Africa?', 'regional hub'],
    ['Which travel plan fits five days best for a safari?', 'safari'],
  ])('%s → objective "%s"', (q, objective) => {
    expect(readDecisionSupport(q, 'en')?.objective).toBe(objective);
  });

  it.each(['Which economy is best?', 'Which is better, Kenya or Rwanda?'])(
    '%s → a decision with NO objective (the reader is asked "best for what?")',
    (q) => {
      expect(readDecisionSupport(q, 'en')).toEqual({ objective: null, currentClauses: [] });
    },
  );

  it.each([
    'Which party is best for the economy?',
    'Which candidate should I vote for?',
    'What happened in Kenya today?',
    'Who won the election in Tanzania?',
    'How does photosynthesis work?',
  ])('%s → not decision support', (q) => {
    expect(readDecisionSupport(q, 'en')).toBeNull();
  });

  it('PL parity', () => {
    expect(readDecisionSupport('Który kraj jest lepszy dla ekspansji logistycznej?', 'pl')).toEqual(
      {
        objective: 'ekspansji logistycznej',
        currentClauses: [],
      },
    );
    expect(readDecisionSupport('Która gospodarka jest najlepsza?', 'pl')?.objective).toBeNull();
  });

  it('a time-anchored part is named as needing current evidence', () => {
    expect(
      readDecisionSupport(
        'Which is better for market entry, Kenya or Rwanda, and what are their growth rates this year?',
        'en',
      )?.currentClauses.join(' '),
    ).toContain('this year');
  });

  it('the knowledge requirement carries it, before advice and before news freshness', () => {
    expect(
      deriveKnowledgeRequirement(
        'Which is better for a logistics expansion, Kenya or Rwanda?',
        'en',
        true,
      ),
    ).toMatchObject({ requirement: 'DECISION_SUPPORT', objective: 'logistics expansion' });
  });
});

describe('§14 the bilateral relationship — two named countries and what passes between them', () => {
  it.each([
    [
      'What is happening commercially between Rwanda and Tanzania at the border?',
      ['BORDER', 'TRADE'],
      'COMMERCIAL',
    ],
    ['Rwanda and Tanzania border commercial services', ['BORDER', 'TRADE'], 'COMMERCIAL'],
    ['How is trade between Kenya and Uganda changing?', ['TRADE'], 'COMMERCIAL'],
    ['What is the status of the railway linking Tanzania and Rwanda?', ['TRANSPORT'], 'TRANSPORT'],
    ['Relations between Rwanda and the DRC', ['DIPLOMATIC'], 'DIPLOMATIC'],
  ])('%s', (q, relations, domain) => {
    const r = readBilateralRelationship(q, 'en');
    expect(r?.relations).toEqual(relations);
    expect(r?.domain).toBe(domain);
    expect(r?.countries).toHaveLength(2);
  });

  it.each([
    'Compare Rwanda and Tanzania',
    'Which is bigger, Kenya or Uganda?',
    'What is happening in Rwanda?',
    'News from Kenya, Uganda and Tanzania',
  ])('%s → not a relationship', (q) => {
    expect(readBilateralRelationship(q, 'en')).toBeNull();
  });

  it('a named crossing is kept as the corridor', () => {
    expect(
      readBilateralRelationship(
        'What changed at the Rusumo border between Rwanda and Tanzania?',
        'en',
      )?.corridor,
    ).toMatch(/rusumo/i);
  });

  it('PL', () => {
    expect(
      readBilateralRelationship('Handel między Rwandą a Tanzanią na granicy', 'pl'),
    ).toMatchObject({
      domain: 'COMMERCIAL',
    });
  });
});

describe('§44 TASK RELEVANCE — relationship evidence is about BOTH sides AND the relation', () => {
  const scope = { countries: ['RWA', 'TZA'], relations: ['BORDER', 'TRADE'] as const };
  it.each([
    ['Rwanda and Tanzania reopen Rusumo border to cargo trucks', true],
    ['Tanzanian traders protest new Rwanda border fees', true],
    ['Rwanda launches new tourism campaign', false],
    ['Tanzania election campaign heats up', false],
    ['Rwanda and Tanzania presidents meet at regional summit', false],
    ['Kenya and Uganda sign customs deal at the border', false],
  ])('%s → %s', (title, admitted) => {
    expect(
      evidencesRelationship({ title, summary: '' }, { ...scope, relations: [...scope.relations] }),
    ).toBe(admitted);
  });

  it('a broad relationship question admits any two-sided report', () => {
    expect(
      evidencesRelationship(
        { title: 'Rwanda and Tanzania presidents meet at regional summit', summary: '' },
        { countries: ['RWA', 'TZA'], relations: ['DIPLOMATIC'] },
      ),
    ).toBe(true);
  });
});

describe('§4 / §43 inappropriate context carry — self-contained questions never inherit a trip', () => {
  const TRIP = [
    { question: 'I have five days and prefer nature.', language: 'en' },
    { question: 'Which places can I visit in Rwanda?', language: 'en' },
  ];
  it.each([
    'What caused the First World War and how did it end?',
    'Who was Napoleon?',
    'How does photosynthesis work?',
    'What is inflation?',
    'How should we price a subscription product?',
    'What happened in Kenya today?',
    'Who is the president of France?',
    'Tell me a joke about cats.',
  ])('%s → no trip composition', (q) => {
    const turn = readConversationalTurn(q, 'en', TRIP);
    expect(turn?.composition?.kind ?? null).not.toBe('JOB_CONTEXT');
  });

  it.each([
    'What about Nyungwe instead?',
    'Which is cheaper?',
    'How much do gorilla permits cost?',
    'When is the dry season?',
    'Is there anything current I should know?',
    'Can I do both in five days?',
  ])('%s → continues the trip', (q) => {
    expect(readConversationalTurn(q, 'en', TRIP)?.composition?.kind).toBe('JOB_CONTEXT');
  });
});
