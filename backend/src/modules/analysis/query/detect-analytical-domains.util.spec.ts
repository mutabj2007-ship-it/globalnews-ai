import {
  detectRequestedDomains,
  isBroadMultiDomainQuestion,
  detectRepresentedDomains,
  selectMissingDomains,
  buildSupplementalSearchTerm,
  ANALYTICAL_DOMAINS,
} from './detect-analytical-domains.util';

const RWANDA_QUESTION =
  'What is the current situation in Rwanda covering the most important recent political, economic, security, diplomatic, social, infrastructure, technological, and regional developments? Explain what has changed recently in each of these areas, why those developments matter, how they affect Rwanda and its people, what the major risks and opportunities are, how Rwanda\u2019s relationships with neighboring countries and the wider international community are evolving, and what important developments we should watch for next.';

describe('detectRequestedDomains (Milestone #63)', () => {
  it('detects all 8 analytical domains in the real long Rwanda acceptance question', () => {
    const detected = detectRequestedDomains(RWANDA_QUESTION);
    expect(detected).toHaveLength(8);
    expect(detected.map((d) => d.domain).sort()).toEqual([...ANALYTICAL_DOMAINS].sort());
  });

  it('orders detected domains by first-occurrence position in the raw question text', () => {
    const detected = detectRequestedDomains(RWANDA_QUESTION);
    // The question lists domains in exactly this order: political,
    // economic, security, diplomatic, social, infrastructure,
    // technology, regional.
    expect(detected.map((d) => d.domain)).toEqual([
      'political',
      'economic',
      'security',
      'diplomatic',
      'social',
      'infrastructure',
      'technology',
      'regional',
    ]);
  });

  it('detects zero domains in an ordinary short country question', () => {
    const detected = detectRequestedDomains("What's happening in Rwanda?");
    expect(detected).toHaveLength(0);
  });

  it('detects fewer than 3 domains in a question that mentions only one or two', () => {
    const detected = detectRequestedDomains('What is the latest political and economic news in Rwanda?');
    expect(detected.length).toBeLessThan(3);
    expect(detected.map((d) => d.domain)).toEqual(['political', 'economic']);
  });

  it('M63 live-acceptance correction — "technological" (the exact word used in the real canonical Rwanda question) maps to the technology domain, not just "technology" itself', () => {
    const detected = detectRequestedDomains('What are the technological developments in Rwanda?');
    expect(detected.map((d) => d.domain)).toEqual(['technology']);
  });

  it('is a pure, deterministic function', () => {
    expect(detectRequestedDomains(RWANDA_QUESTION)).toEqual(detectRequestedDomains(RWANDA_QUESTION));
  });
});

describe('isBroadMultiDomainQuestion (Milestone #63)', () => {
  it('the real Rwanda question (8 domains) is broad', () => {
    expect(isBroadMultiDomainQuestion(detectRequestedDomains(RWANDA_QUESTION))).toBe(true);
  });

  it('a question with exactly 3 detected domains is broad (the approved threshold)', () => {
    const detected = detectRequestedDomains(
      'What are the political, economic, and security developments in Rwanda?',
    );
    expect(detected).toHaveLength(3);
    expect(isBroadMultiDomainQuestion(detected)).toBe(true);
  });

  it('a question with only 2 detected domains is NOT broad — preserves ordinary single-retrieval behavior', () => {
    const detected = detectRequestedDomains('What is the political and economic news in Rwanda?');
    expect(detected).toHaveLength(2);
    expect(isBroadMultiDomainQuestion(detected)).toBe(false);
  });

  it('an ordinary short question (0 domains) is NOT broad', () => {
    expect(isBroadMultiDomainQuestion(detectRequestedDomains("What's happening in Rwanda?"))).toBe(false);
  });
});

describe('detectRepresentedDomains (Milestone #63)', () => {
  it('detects domains represented in a realistic narrow candidate pool, matching the live M63 Phase 2 observation shape', () => {
    const narrowPool = [
      { title: 'Rwanda and DRC sign migration arrangement', summary: 'A new bilateral migration deal.' },
      { title: 'NPR: healthcare drones deliver medical supplies', summary: 'Drones deliver blood and medical supplies to the community.' },
    ];
    const represented = detectRepresentedDomains(narrowPool);
    expect(represented.has('diplomatic')).toBe(true);
    expect(represented.has('social')).toBe(true);
    expect(represented.has('political')).toBe(false);
    expect(represented.has('economic')).toBe(false);
  });

  it('never imports or depends on classifyCategory()/NewsCategory — a politics-classified article does not automatically register as the "political" analytical domain unless its text independently matches political keywords', () => {
    // This mirrors the live NPR healthcare-drone finding: an article
    // that classifyCategory() would label "politics" but whose actual
    // text is about healthcare/drones should register as "social" via
    // its own keywords, not "political" via any classifyCategory link
    // — because this module never calls classifyCategory() at all.
    const article = { title: 'Rwanda healthcare drones deliver supplies', summary: 'Community welfare and medical delivery.' };
    const represented = detectRepresentedDomains([article]);
    expect(represented.has('social')).toBe(true);
    expect(represented.has('political')).toBe(false);
  });

  it('returns an empty set for a fully unrelated candidate pool', () => {
    const pool = [{ title: 'A story with no domain keywords at all', summary: 'Nothing relevant here.' }];
    expect(detectRepresentedDomains(pool).size).toBe(0);
  });

  it('is a pure, deterministic function', () => {
    const pool = [{ title: 'Rwanda political election', summary: 'government news' }];
    expect(detectRepresentedDomains(pool)).toEqual(detectRepresentedDomains(pool));
  });
});

describe('selectMissingDomains (Milestone #63)', () => {
  it('selects zero domains when every requested domain is already represented', () => {
    const requested = detectRequestedDomains(
      'What are the political and economic developments in Rwanda?',
    );
    const represented = new Set(['political', 'economic'] as const);
    expect(selectMissingDomains(requested, represented)).toEqual([]);
  });

  it('selects exactly one missing domain when exactly one is genuinely missing', () => {
    const requested = detectRequestedDomains(
      'What are the political, economic, and security developments in Rwanda?',
    );
    const represented = new Set(['political', 'economic'] as const);
    expect(selectMissingDomains(requested, represented)).toEqual(['security']);
  });

  it('selects exactly two missing domains when exactly two are missing', () => {
    const requested = detectRequestedDomains(
      'What are the political, economic, security, and diplomatic developments in Rwanda?',
    );
    const represented = new Set(['political', 'economic'] as const);
    expect(selectMissingDomains(requested, represented)).toEqual(['security', 'diplomatic']);
  });

  it('caps at exactly two even when more than two domains are missing, using deterministic first-mentioned-in-question priority', () => {
    const requested = detectRequestedDomains(RWANDA_QUESTION);
    const represented = new Set(['diplomatic', 'social'] as const); // matches the real observed narrow pool
    const missing = selectMissingDomains(requested, represented);
    expect(missing).toHaveLength(2);
    // political and economic are the first two domains mentioned in
    // the question that are NOT in `represented`.
    expect(missing).toEqual(['political', 'economic']);
  });

  it('is a pure, deterministic function', () => {
    const requested = detectRequestedDomains(RWANDA_QUESTION);
    const represented = new Set(['diplomatic'] as const);
    expect(selectMissingDomains(requested, represented)).toEqual(selectMissingDomains(requested, represented));
  });
});

describe('buildSupplementalSearchTerm (Milestone #63)', () => {
  it('builds the exact approved "<country.name> <canonical-domain-search-term>" form', () => {
    expect(buildSupplementalSearchTerm('Rwanda', 'security')).toBe('Rwanda security');
    expect(buildSupplementalSearchTerm('Rwanda', 'diplomatic')).toBe('Rwanda diplomacy');
    expect(buildSupplementalSearchTerm('Rwanda', 'political')).toBe('Rwanda politics');
  });

  it('produces a distinct term for every one of the 8 analytical domains', () => {
    const terms = ANALYTICAL_DOMAINS.map((domain) => buildSupplementalSearchTerm('Rwanda', domain));
    expect(new Set(terms).size).toBe(ANALYTICAL_DOMAINS.length);
  });
});
