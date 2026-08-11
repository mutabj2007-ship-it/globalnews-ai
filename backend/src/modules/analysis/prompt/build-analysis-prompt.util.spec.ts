import { buildAnalysisMessages, buildRelationalPromptSection } from './build-analysis-prompt.util';

describe('buildRelationalPromptSection (Milestone #40 — authoritative-context correction)', () => {
  it('when relationalContext is present, encodes the EXACT x/y values verbatim', () => {
    const section = buildRelationalPromptSection({ x: 'climate change', y: 'agriculture' });
    expect(section).toContain('X = "climate change"');
    expect(section).toContain('Y = "agriculture"');
  });

  it('reversed x/y produces a reversed encoding (proves no independent re-derivation)', () => {
    const forward = buildRelationalPromptSection({ x: 'climate change', y: 'agriculture' });
    const reversed = buildRelationalPromptSection({ x: 'agriculture', y: 'climate change' });
    expect(forward).toContain('X = "climate change"');
    expect(forward).toContain('Y = "agriculture"');
    expect(reversed).toContain('X = "agriculture"');
    expect(reversed).toContain('Y = "climate change"');
    expect(forward).not.toBe(reversed);
  });

  it('defines requested-direction and reverse-direction strictly in terms of the supplied x/y', () => {
    const section = buildRelationalPromptSection({ x: 'AI', y: 'employment' });
    expect(section).toMatch(/requested-direction.*"AI".*affecting.*"employment"/s);
    expect(section).toMatch(/reverse-direction.*"employment".*affecting.*"AI"/s);
  });

  it('instructs the model never to reinterpret or substitute x/y', () => {
    const section = buildRelationalPromptSection({ x: 'AI', y: 'employment' });
    expect(section).toMatch(/do not infer, replace, or\s+reinterpret/i);
  });

  it('never claims causality is proven merely by classifying a direction', () => {
    const section = buildRelationalPromptSection({ x: 'AI', y: 'employment' });
    expect(section).toMatch(/never[\s\S]*caus(?:al|ally)/i);
  });

  it('when relationalContext is absent, explicitly disables M40 and requires an empty array', () => {
    const section = buildRelationalPromptSection(undefined);
    expect(section).toMatch(/NOT a Milestone #40 relational request/i);
    expect(section).toMatch(/relationalEvidenceAssessments.*empty array/is);
    expect(section).not.toContain('X = "');
    expect(section).not.toContain('Y = "');
  });

  it('the absent-context section never mentions requested-direction/reverse-direction at all', () => {
    const section = buildRelationalPromptSection(undefined);
    expect(section).not.toMatch(/requested-direction/);
    expect(section).not.toMatch(/reverse-direction/);
  });
});

describe('buildAnalysisMessages (Milestone #40 wiring)', () => {
  const articles = [
    {
      id: 'a1',
      title: 'Climate change reduces maize yields',
      summary: 'Farmers report declining harvests.',
      url: 'https://example.com/a1',
      imageUrl: undefined,
      sourceId: 'src',
      sourceName: 'Example',
      category: 'world' as const,
      sourcesCount: 1,
      publishedAt: new Date().toISOString(),
    },
  ];

  it('with relationalContext, the system prompt contains the exact x/y', () => {
    const { system } = buildAnalysisMessages('How is climate change affecting agriculture?', articles, 1200, {
      x: 'climate change',
      y: 'agriculture',
    });
    expect(system).toContain('X = "climate change"');
    expect(system).toContain('Y = "agriculture"');
  });

  it('without relationalContext, the system prompt disables M40 and never mentions any x/y', () => {
    const { system } = buildAnalysisMessages('What is happening in cybersecurity?', articles, 1200);
    expect(system).toMatch(/NOT a Milestone #40 relational request/i);
    expect(system).not.toContain('X = "');
    expect(system).not.toContain('Y = "');
  });

  it('the base rules (evidenceIds, evidenceBasis, output format) are present in both cases, unchanged', () => {
    const withContext = buildAnalysisMessages('q', articles, 1200, { x: 'a', y: 'b' }).system;
    const withoutContext = buildAnalysisMessages('q', articles, 1200).system;
    for (const shared of [
      'You are a careful news analyst working for GlobalNews AI.',
      'Use only the supplied articles.',
      'evidenceBasis',
      'Output must be valid JSON matching the provided schema exactly.',
    ]) {
      expect(withContext).toContain(shared);
      expect(withoutContext).toContain(shared);
    }
  });

  it('the user prompt is unaffected by relationalContext (query/evidence rendering unchanged)', () => {
    const a = buildAnalysisMessages('q', articles, 1200, { x: 'a', y: 'b' }).user;
    const b = buildAnalysisMessages('q', articles, 1200).user;
    expect(a).toBe(b);
  });
});
