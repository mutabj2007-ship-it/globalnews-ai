import {
  buildAnalysisMessages,
  buildRelationalPromptSection,
  buildResponseLanguageInstruction,
  buildAnalysisJsonSchema,
} from './build-analysis-prompt.util';

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
    const { system } = buildAnalysisMessages(
      'How is climate change affecting agriculture?',
      articles,
      1200,
      {
        x: 'climate change',
        y: 'agriculture',
      },
    );
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

describe('Milestone #47 — response-language instruction', () => {
  // Milestone #47 correction (Blocker 3): a dedicated, minimal local
  // fixture — NOT shared with the M40 describe block above, whose own
  // `articles` const is scoped to that block only and was never
  // visible here. Same shape as that fixture (kept identical so this
  // test's behavior is unaffected), declared locally to avoid touching
  // the M40 block's existing structure at all.
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

  it('English returns an empty instruction (no-op, byte-identical prior behavior)', () => {
    expect(buildResponseLanguageInstruction('en')).toBe('');
  });

  it('Polish instruction names the language and forbids altering IDs/enums', () => {
    const instruction = buildResponseLanguageInstruction('pl');
    expect(instruction).toContain('Polish');
    expect(instruction.toLowerCase()).toContain('evidenceid');
    expect(instruction.toLowerCase()).toContain('enum');
  });

  it('every LanguageCode has a distinct, correctly-named instruction (except en, which is empty)', () => {
    expect(buildResponseLanguageInstruction('sw')).toContain('Swahili');
    expect(buildResponseLanguageInstruction('fr')).toContain('French');
    expect(buildResponseLanguageInstruction('es')).toContain('Spanish');
    expect(buildResponseLanguageInstruction('ar')).toContain('Arabic');
    expect(buildResponseLanguageInstruction('rw')).toContain('Kinyarwanda');
  });

  it('buildAnalysisMessages with no responseLanguage argument behaves exactly like "en" — full backward compatibility for every pre-Milestone-#47 caller', () => {
    const withDefault = buildAnalysisMessages('q', articles, 1200);
    const withExplicitEn = buildAnalysisMessages('q', articles, 1200, undefined, 'en');
    expect(withDefault.system).toBe(withExplicitEn.system);
  });

  it('Polish system prompt is the English base prompt with the instruction appended, never replacing or reordering existing content', () => {
    const en = buildAnalysisMessages('q', articles, 1200).system;
    const pl = buildAnalysisMessages('q', articles, 1200, undefined, 'pl').system;
    expect(pl.startsWith(en)).toBe(true);
    expect(pl).not.toBe(en);
  });

  it('the response-language instruction does not affect the user prompt (evidence/citation rendering unchanged)', () => {
    const withoutLanguage = buildAnalysisMessages('q', articles, 1200).user;
    const withLanguage = buildAnalysisMessages('q', articles, 1200, undefined, 'pl').user;
    expect(withoutLanguage).toBe(withLanguage);
  });
});

describe('Milestone #62 Phase 1 — context/relevance schema and prompt instructions', () => {
  // Local fixture — mirrors the M47 block's own established pattern in
  // this file (see its doc comment above): `articles` is scoped
  // per-describe-block throughout this file, never shared at file
  // scope, so each block that needs it declares its own minimal copy.
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

  it('the structured-output schema includes context and relevance as required array properties, using the exact same shape as keyFacts', () => {
    const schema = buildAnalysisJsonSchema() as {
      schema: { properties: Record<string, unknown>; required: string[] };
    };
    const properties = schema.schema.properties;
    expect(properties.context).toEqual(properties.keyFacts);
    expect(properties.relevance).toEqual(properties.keyFacts);
    expect(schema.schema.required).toContain('context');
    expect(schema.schema.required).toContain('relevance');
  });

  it('additionalProperties remains false at the top level — no undisclosed fields introduced', () => {
    const schema = buildAnalysisJsonSchema() as { schema: { additionalProperties: boolean } };
    expect(schema.schema.additionalProperties).toBe(false);
  });

  it('does not use an unverified maxItems JSON Schema keyword anywhere in the schema (limits are enforced by prompt instruction + validator caps instead)', () => {
    expect(JSON.stringify(buildAnalysisJsonSchema())).not.toMatch(/maxItems/);
  });

  it('the prompt instructs at most 4 context entries and at most 3 relevance entries, evidence-bounded, with an explicit empty-array fallback for both', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    // The production prompt is a template literal, so the source
    // file's own line-wrapping becomes literal newline characters in
    // this string — normalizing whitespace here makes the full-sentence
    // checks below resistant to exactly where the prompt happens to
    // wrap, rather than brittle against one specific formatting.
    const normalizedSystem = system.replace(/\s+/g, ' ');
    expect(system).toMatch(/"context":.*at most 4/);
    expect(system).toMatch(/"relevance":.*at most 3/);
    expect(system).toMatch(/general knowledge beyond it/);
    expect(normalizedSystem).toContain(
      'Return an empty array if the evidence does not establish any useful background beyond the immediate facts already covered elsewhere.',
    );
    expect(normalizedSystem).toContain(
      'Return an empty array if a meaningful relevance claim cannot be grounded in the supplied evidence.',
    );
  });
});

describe('Milestone #62 Phase 2 — affectedParties/immediateImpacts/spilloverImplications schema and prompt instructions', () => {
  // Local fixture — same established per-describe-block pattern as the
  // M47 and M62 Phase 1 blocks above; `articles` is never shared at
  // file scope in this file.
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

  it('the structured-output schema includes affectedParties (dedicated shape), immediateImpacts, and spilloverImplications (both reusing the exact keyFacts/sourcedClaim shape) as required array properties', () => {
    const schema = buildAnalysisJsonSchema() as {
      schema: { properties: Record<string, unknown>; required: string[] };
    };
    const properties = schema.schema.properties;
    expect(properties.immediateImpacts).toEqual(properties.keyFacts);
    expect(properties.spilloverImplications).toEqual(properties.keyFacts);
    expect(properties.affectedParties).not.toEqual(properties.keyFacts);
    expect(schema.schema.required).toContain('affectedParties');
    expect(schema.schema.required).toContain('immediateImpacts');
    expect(schema.schema.required).toContain('spilloverImplications');
  });

  it('additionalProperties remains false at the top level', () => {
    const schema = buildAnalysisJsonSchema() as { schema: { additionalProperties: boolean } };
    expect(schema.schema.additionalProperties).toBe(false);
  });

  it('does not use an unverified maxItems JSON Schema keyword anywhere in the schema', () => {
    expect(JSON.stringify(buildAnalysisJsonSchema())).not.toMatch(/maxItems/);
  });

  it('the affectedParties schema item requires party/partyType/effect/evidenceIds/evidenceBasis and constrains partyType to the closed enum', () => {
    const schema = buildAnalysisJsonSchema() as {
      schema: { properties: { affectedParties: { items: { properties: Record<string, unknown>; required: string[] } } } };
    };
    const item = schema.schema.properties.affectedParties.items;
    expect(item.required).toEqual(
      expect.arrayContaining(['party', 'partyType', 'effect', 'evidenceIds', 'evidenceBasis']),
    );
    expect((item.properties.partyType as { enum: string[] }).enum).toEqual(
      expect.arrayContaining(['person', 'organization', 'country', 'region', 'group', 'other']),
    );
  });

  it('the prompt instructs at most 6 affectedParties, at most 4 immediateImpacts, and at most 4 spilloverImplications, all evidence-bounded with explicit empty-array fallbacks', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    const normalizedSystem = system.replace(/\s+/g, ' ');
    expect(system).toMatch(/"affectedParties":.*up to 6/);
    expect(system).toMatch(/"immediateImpacts":.*up to 4/);
    expect(system).toMatch(/"spilloverImplications":.*up to 4/);
    expect(normalizedSystem).toContain(
      'Return an empty array if the evidence does not identify specific affected parties.',
    );
    expect(normalizedSystem).toContain(
      'Return an empty array if the evidence does not state any direct effect.',
    );
    expect(normalizedSystem).toContain(
      'Return an empty array if the evidence does not discuss any wider effect.',
    );
    expect(normalizedSystem).toContain('never your own extrapolation of what might plausibly follow');
  });

  it('does not reference watchNext anywhere — it remains out of scope through this phase', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    expect(system).not.toMatch(/"watchNext"/);
    expect(JSON.stringify(buildAnalysisJsonSchema())).not.toMatch(/watchNext/);
  });
});

describe('Milestone #62 Phase 3 — significance schema and prompt instructions', () => {
  // Local fixture — same established per-describe-block pattern as
  // every prior Milestone block in this file.
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

  it('the structured-output schema uses a nullable object for significance, following the exact same strict-mode precedent as evidenceBasis', () => {
    const schema = buildAnalysisJsonSchema() as {
      schema: {
        properties: {
          significance: { type: string[]; required: string[]; additionalProperties: boolean };
        };
        required: string[];
      };
    };
    const significanceSchema = schema.schema.properties.significance;
    expect(significanceSchema.type).toEqual(expect.arrayContaining(['object', 'null']));
    expect(significanceSchema.required).toEqual(expect.arrayContaining(['level', 'rationale']));
    expect(significanceSchema.additionalProperties).toBe(false);
    expect(schema.schema.required).toContain('significance');
  });

  it('additionalProperties remains false at the top level', () => {
    const schema = buildAnalysisJsonSchema() as { schema: { additionalProperties: boolean } };
    expect(schema.schema.additionalProperties).toBe(false);
  });

  it('does not use an unverified maxItems JSON Schema keyword anywhere in the schema', () => {
    expect(JSON.stringify(buildAnalysisJsonSchema())).not.toMatch(/maxItems/);
  });

  it('the significance level enum is exactly the four approved values', () => {
    const schema = buildAnalysisJsonSchema() as {
      schema: { properties: { significance: { properties: { level: { enum: string[] } } } } };
    };
    expect(schema.schema.properties.significance.properties.level.enum).toEqual([
      'minor',
      'moderate',
      'major',
      'critical',
    ]);
  });

  it('the prompt distinguishes significance from trust/confidence/tone/topic/general-knowledge importance, and lists the allowed objective evidence signals', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    const normalizedSystem = system.replace(/\s+/g, ' ');
    expect(normalizedSystem).toContain(
      'never a proxy for source trust, your own confidence, evidence sufficiency, emotional tone, topic category, or general importance inferred from world knowledge',
    );
    expect(normalizedSystem).toContain('casualty or injury counts');
    expect(normalizedSystem).toContain('official emergency/disaster declarations');
  });

  it('the prompt explicitly prohibits inferring severity from dramatic language alone', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    const normalizedSystem = system.replace(/\s+/g, ' ');
    expect(normalizedSystem).toContain('Do NOT infer severity merely because reporting uses dramatic language');
    expect(system).toMatch(/crisis/);
    expect(system).toMatch(/catastrophic/);
  });

  it('the prompt gates "critical" behind either an explicit authoritative designation OR multiple independent high-severity indicators — never a single isolated signal', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    const normalizedSystem = system.replace(/\s+/g, ' ');
    expect(normalizedSystem).toContain('an explicit authoritative designation of exceptional severity');
    expect(normalizedSystem).toContain('multiple independent objective high-severity indicators');
    expect(normalizedSystem).toContain('one isolated signal is generally not enough to justify "critical"');
  });

  it('the prompt instructs choosing the lower defensible level when ambiguous, and returning the JSON null literal (never "minor" as a default) when unsupported', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    const normalizedSystem = system.replace(/\s+/g, ' ');
    expect(normalizedSystem).toContain('When the evidence is ambiguous between two levels, choose the lower defensible level');
    expect(normalizedSystem).toContain('Return "significance": null (the JSON null literal, not an object)');
  });

  it('the prompt limits rationale to 2 entries, enforced via prompt instruction, not an unverified schema keyword', () => {
    const { system } = buildAnalysisMessages('q', articles, 1200);
    expect(system).toMatch(/up to 2 grounded rationale entries/);
  });
});
