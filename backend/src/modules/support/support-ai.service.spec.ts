import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { AnalysisApiResponse, SupportCategory } from '@globalnews-ai/shared';
import { SUPPORT_CATEGORIES } from '@globalnews-ai/shared';
import type { AnalysisService } from '../analysis/service/analysis.service';
import {
  ANALYSIS_ELIGIBLE_CATEGORY,
  SUPPORT_AI_DEFAULT_MAX_CONCURRENT,
  SUPPORT_AI_DEFAULT_PER_USER_LIMIT,
  SUPPORT_AI_DEFAULT_TIMEOUT_MS,
  SupportAiService,
  buildAnalysisQuery,
  creationStateFor,
  newsFallbackFor,
  type SupportAiLanguage,
} from './support-ai.service';

/**
 * SUPPORT-AI-1 — the GlobalNews AI Support Agent.
 *
 * The agent writes durable messages into a support thread under its own
 * authorship, in a product whose entire contract with its readers is that
 * it does not claim more than its evidence supports. Most of this file is
 * therefore about what it must NOT do, and most of those assertions are
 * run over the real shipped copy for every category in both languages
 * rather than over one example.
 */
interface AnalysisCall {
  query: string;
  language: string;
  extra: unknown[];
}

/**
 * A recording AnalysisService double.
 *
 * Exported because the support service and loop specs construct a real
 * SupportAiService around it: a support test that stubbed the agent
 * itself would prove nothing about whether tickets survive an analysis
 * failure, which is the property that matters most.
 */
function buildAnalysisDouble(
  behaviour: {
    respond?: () => Promise<AnalysisApiResponse>;
  } = {},
): { analysis: AnalysisService; calls: AnalysisCall[] } {
  const calls: AnalysisCall[] = [];

  const analysis = {
    analyzeNews: (
      query: string,
      language: string,
      ...extra: unknown[]
    ): Promise<AnalysisApiResponse> => {
      calls.push({ query, language, extra });
      if (behaviour.respond) return behaviour.respond();
      return Promise.reject(new Error('no analysis behaviour configured'));
    },
  } as unknown as AnalysisService;

  return { analysis, calls };
}

/** A ConfigService double over a plain record. */
function buildConfigDouble(values: Record<string, string> = {}): ConfigService {
  return { get: (key: string): string | undefined => values[key] } as unknown as ConfigService;
}

function analysisSuccess(over: Partial<AnalysisApiResponse> = {}): AnalysisApiResponse {
  return {
    query: 'q',
    requestedLanguage: 'en',
    responseLanguage: 'en',
    normalizedQuery: 'q',
    analysis: {
      headline: 'Talks resumed on Tuesday',
      summary: 'Both delegations returned to the table after a two-week pause.',
      sources: [
        { articleId: 'a1', publisher: 'Reuters', title: 't', url: 'u', publishedAt: 'p' },
        { articleId: 'a2', publisher: 'AP', title: 't', url: 'u', publishedAt: 'p' },
      ],
    },
    provenance: { status: 'success' },
    ...over,
  } as unknown as AnalysisApiResponse;
}

const LANGUAGES: SupportAiLanguage[] = ['en', 'pl'];
const NON_NEWS = SUPPORT_CATEGORIES.filter((category) => category !== ANALYSIS_ELIGIBLE_CATEGORY);

const INPUT = {
  userId: 'user-1',
  category: 'NEWS_QUESTION' as SupportCategory,
  subject: 'Ceasefire talks',
  message: 'What happened in the talks this week?',
  language: 'en' as SupportAiLanguage,
};

describe('R4 SUPPORT UX CLOSURE — creation stores the requester and nothing else', () => {
  /*
    SUPPORT-AI-1 wrote a deterministic acknowledgement for all seven
    categories at creation. R4 SUPPORT UX CLOSURE removed it. What used
    to travel with that copy -- the opening status and the analysis
    eligibility -- is all that survives, and creationStateFor carries it.

    These are not "the old tests with the copy assertions deleted". The
    old file asserted the acknowledgement was GOOD; this one asserts it
    is GONE, which is a different and stronger claim.
  */

  it('creationStateFor returns a state and NO message body', () => {
    SUPPORT_CATEGORIES.forEach((category) => {
      const state = creationStateFor(category);

      // Exactly two keys. A body reappearing here is the defect this
      // correction removed, so the shape is asserted, not just probed.
      expect(Object.keys(state).sort()).toEqual(['analysisEligible', 'status']);
      expect(state).not.toHaveProperty('body');
    });
  });

  it('EVERY category opens at AWAITING_ADMIN — failing towards the human', () => {
    // A news question moves to AWAITING_USER only once an answer exists.
    // Starting there would leave a ticket whose analysis died mid-flight
    // waiting on a user with nothing to reply to, and out of the queue.
    SUPPORT_CATEGORIES.forEach((category) => {
      expect({ category, status: creationStateFor(category).status }).toEqual({
        category,
        status: 'AWAITING_ADMIN',
      });
    });
  });

  it('NO ticket is ever created RESOLVED', () => {
    SUPPORT_CATEGORIES.forEach((category) => {
      expect(creationStateFor(category).status).not.toBe('RESOLVED');
    });
  });

  it('exactly ONE category is analysis-eligible, and it is the news question', () => {
    const eligible = SUPPORT_CATEGORIES.filter(
      (category) => creationStateFor(category).analysisEligible,
    );
    expect(eligible).toEqual([ANALYSIS_ELIGIBLE_CATEGORY]);
  });

  /*
    THE REGRESSION GUARD. The copy table is gone; these assertions are
    what stop it, or anything like it, from coming back. They read the
    shipped source rather than the exports, because a reinstated
    acknowledgement would most likely arrive as a new constant rather
    than as a resurrected `firstResponseFor`.
  */

  const AGENT_SOURCE = readFileSync(join(__dirname, 'support-ai.service.ts'), 'utf-8').replace(
    /\r\n/g,
    '\n',
  );
  const SERVICE_SOURCE = readFileSync(join(__dirname, 'support.service.ts'), 'utf-8').replace(
    /\r\n/g,
    '\n',
  );

  /** Executable source only — a doc comment must not satisfy or trip an assertion. */
  function executable(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('the per-category acknowledgement table and its accessor are gone', () => {
    const code = executable(AGENT_SOURCE);

    expect(code).not.toMatch(/FIRST_RESPONSE/);
    expect(code).not.toMatch(/firstResponseFor/);
    expect(code).not.toMatch(/SupportAiFirstResponse/);
  });

  it('no per-category copy table survives under another name', () => {
    const code = executable(AGENT_SOURCE);

    /*
      The removed table was the ONLY Record keyed by SupportCategory in
      this file. Any new one is either the acknowledgement returning, or
      a change big enough that it should be looked at deliberately.
    */
    expect(code).not.toMatch(/Record<\s*SupportCategory/);

    // And no surviving constant enumerates the six non-news categories,
    // which is what per-category copy would have to do.
    NON_NEWS.forEach((category) => {
      expect(code).not.toContain(`${category}:`);
    });
  });

  it('the creation transaction writes exactly ONE message, and it is the USER’s', () => {
    const code = executable(SERVICE_SOURCE);
    const createRow = code.slice(
      code.indexOf('createTicketRow'),
      code.indexOf('private async appendAiAnswer'),
    );

    expect(createRow).toContain("authorType: 'USER'");
    expect(createRow).not.toContain("authorType: 'SYSTEM_AI'");

    const writes = createRow.match(/tx\.supportMessage\.create\(/g) ?? [];
    expect(writes).toHaveLength(1);
  });

  it('the ONLY stored SYSTEM_AI message in the module is the post-commit answer', () => {
    const code = executable(SERVICE_SOURCE);

    const systemAiWrites = code.match(/authorType: 'SYSTEM_AI'/g) ?? [];
    expect(systemAiWrites).toHaveLength(1);

    // ...and it sits after the analysis call, in appendAiAnswer.
    expect(code.indexOf("authorType: 'SYSTEM_AI'")).toBeGreaterThan(
      code.indexOf('private async appendAiAnswer'),
    );
  });
});

describe('SUPPORT-AI-1 — the claims the stored agent copy may never make', () => {
  /*
    THE SWEEP NOW HAS LESS TO SWEEP, AND THAT IS THE POINT.

    It used to run over fourteen acknowledgement strings plus the
    fallback. Those fourteen no longer exist, so nothing they could have
    said matters. What the agent can still write into a thread is the
    honest fallback and a composed evidence-grounded answer, and both are
    swept here -- the answer through the real service, not a fixture, so
    the preamble and limits text that surrounds it is covered too.
  */

  it('the fallback answer claims nothing, in either language', () => {
    LANGUAGES.forEach((language) => {
      expect({ language, claims: claimsIn(newsFallbackFor(language)) }).toEqual({
        language,
        claims: [],
      });
    });
  });

  it('the fallback exists in both languages and is genuinely translated', () => {
    expect(newsFallbackFor('pl')).not.toBe(newsFallbackFor('en'));
    expect(newsFallbackFor('en').length).toBeGreaterThan(120);
    expect(newsFallbackFor('pl').length).toBeGreaterThan(120);
  });

  it('a COMPOSED evidence-grounded answer claims nothing either', async () => {
    for (const language of LANGUAGES) {
      const { analysis } = buildAnalysisDouble({
        respond: () => Promise.resolve(analysisSuccess()),
      });
      const agent = new SupportAiService(
        analysis,
        buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }),
      );

      const answer = await agent.answerNewsQuestion({ ...INPUT, language });

      expect({ language, claims: claimsIn(answer.body) }).toEqual({ language, claims: [] });
      expect(answer.body).not.toMatch(/GlobalNews AI Support Agent/);
    }
  });

  it('nothing the agent can store claims a repair it did not make', () => {
    // The whole shipped file, so a new string cannot slip past by not
    // being reachable from the two accessors above.
    expect(claimsIn(readFileSync(join(__dirname, 'support-ai.service.ts'), 'utf-8'))).toEqual([]);
  });

  /**
   * THE SWEEP CAUGHT THE COPY'S OWN DENIALS, AND THAT IS WHY IT LOOKS
   * LIKE THIS.
   *
   * A first draft matched `/\bhas been fixed\b/` against the whole body
   * and failed on "NOTHING HAS BEEN FIXED AND NO REPAIR HAS BEEN
   * CONFIRMED" -- the exact sentence whose job is to deny the claim. A
   * detector that cannot tell a denial from an assertion is not a
   * detector; it just forces the copy to stop saying the true thing.
   *
   * So the sweep runs in two passes that fail differently:
   *
   *   1. Sentences carrying an explicit denial are excluded, and the
   *      broad patterns run over what remains. A claim and its own
   *      denial in one sentence is incoherent copy, not a loophole.
   *   2. SUBJECT-BOUND patterns run over the WHOLE body, denials
   *      included, because "the problem has been fixed" cannot be
   *      produced by any denial and must never appear anywhere.
   */
  const DENIAL = /\b(nothing|not|no|never|cannot|neither|nie|nic|żadn\w*|bez)\b/i;

  const BROAD_CLAIMS = [
    /\bhas been fixed\b/i,
    /\bwe have removed\b/i,
    /\bhas been removed\b/i,
    /\bhas been (restored|reset|unlocked|changed)\b/i,
    /\baction has been taken\b/i,
    /\bnow resolved\b/i,
    /\bzostał\w* naprawion\w*/i,
    /\bzostał\w* usunięt\w*/i,
  ];

  const SUBJECT_BOUND_CLAIMS = [
    /\b(the|your) (bug|issue|problem|fault) (has been|was|is) (fixed|resolved)\b/i,
    /\byour account (has been|was) (restored|reset|unlocked|changed|fixed)\b/i,
    /\bthe (content|article|report) (has been|was) removed\b/i,
  ];

  function claimsIn(body: string): string[] {
    const sentences = body.split(/(?<=[.!?])\s+/).filter((sentence) => !DENIAL.test(sentence));

    const found = BROAD_CLAIMS.filter((pattern) =>
      sentences.some((sentence) => pattern.test(sentence)),
    ).map(String);

    return [...found, ...SUBJECT_BOUND_CLAIMS.filter((pattern) => pattern.test(body)).map(String)];
  }
});

describe('SUPPORT-AI-1 — six of seven categories never reach a provider', () => {
  it.each(NON_NEWS)('%s makes ZERO analysis calls', async (category) => {
    const { analysis, calls } = buildAnalysisDouble({
      respond: () => Promise.resolve(analysisSuccess()),
    });
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    const answer = await agent.answerNewsQuestion({ ...INPUT, category });

    expect(calls).toHaveLength(0);
    expect(answer.skipReason).toBe('not-eligible');
    expect(answer.status).toBe('AWAITING_ADMIN');
  });
});

describe('SUPPORT-AI-1 — the news path', () => {
  it('produces an evidence-grounded answer and moves the ticket to AWAITING_USER', async () => {
    const { analysis, calls } = buildAnalysisDouble({
      respond: () => Promise.resolve(analysisSuccess()),
    });
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    const answer = await agent.answerNewsQuestion(INPUT);

    expect(calls).toHaveLength(1);
    expect(answer.status).toBe('AWAITING_USER');
    expect(answer.skipReason).toBeUndefined();
    expect(answer.body).toContain('Talks resumed on Tuesday');
    // The source names travel with the claim, so the reader can weigh it.
    expect(answer.body).toContain('Reuters');
    expect(answer.body).toContain('AP');
    // And the limits are stated in the same message.
    expect(answer.body).toMatch(/may be incomplete or out of date/i);
    expect(answer.body).toMatch(/confirms no repair/i);
  });

  it('refuses to answer when the analysis produced NO source, however good the prose', () => {
    // A fluent summary with nothing behind it is the single most damaging
    // thing this feature could ship. It is treated as no answer at all.
    return (async () => {
      const { analysis } = buildAnalysisDouble({
        respond: () =>
          Promise.resolve(
            analysisSuccess({ analysis: { headline: 'h', summary: 's', sources: [] } } as never),
          ),
      });
      const agent = new SupportAiService(
        analysis,
        buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }),
      );

      const answer = await agent.answerNewsQuestion(INPUT);

      expect(answer.skipReason).toBe('no-evidence');
      expect(answer.status).toBe('AWAITING_ADMIN');
      expect(answer.body).toBe(newsFallbackFor('en'));
    })();
  });

  it('a non-success provenance is a fallback, even when an analysis object is present', async () => {
    const { analysis } = buildAnalysisDouble({
      respond: () =>
        Promise.resolve(
          analysisSuccess({ provenance: { status: 'validation-rejected' } } as never),
        ),
    });
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    const answer = await agent.answerNewsQuestion(INPUT);

    expect(answer.skipReason).toBe('provider-failed');
    expect(answer.status).toBe('AWAITING_ADMIN');
  });

  it('a thrown provider is a fallback, never an exception reaching the caller', async () => {
    const { analysis } = buildAnalysisDouble({ respond: () => Promise.reject(new Error('boom')) });
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    await expect(agent.answerNewsQuestion(INPUT)).resolves.toEqual(
      expect.objectContaining({ status: 'AWAITING_ADMIN', skipReason: 'provider-failed' }),
    );
  });

  it('a SYNCHRONOUS throw is also a fallback, and does not leak the concurrency slot', async () => {
    const analysis = {
      analyzeNews: (): Promise<AnalysisApiResponse> => {
        throw new Error('synchronous');
      },
    } as unknown as AnalysisService;
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    await expect(agent.answerNewsQuestion(INPUT)).resolves.toEqual(
      expect.objectContaining({ skipReason: 'provider-failed' }),
    );
    // A leaked slot would silently tighten the bound to zero forever.
    await expect(agent.answerNewsQuestion(INPUT)).resolves.toEqual(
      expect.objectContaining({ skipReason: 'provider-failed' }),
    );
  });

  it('a slow provider times out into the stored fallback', async () => {
    const { analysis } = buildAnalysisDouble({
      respond: () => new Promise<AnalysisApiResponse>(() => undefined),
    });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({ SUPPORT_AI_ENABLED: 'true', SUPPORT_AI_TIMEOUT_MS: '20' }),
    );

    const answer = await agent.answerNewsQuestion(INPUT);

    expect(answer.skipReason).toBe('timeout');
    expect(answer.status).toBe('AWAITING_ADMIN');
    expect(answer.body).toBe(newsFallbackFor('en'));
  });

  it('the fallback exists in both languages and is genuinely translated', () => {
    expect(newsFallbackFor('en').length).toBeGreaterThan(120);
    expect(newsFallbackFor('pl').length).toBeGreaterThan(120);
    expect(newsFallbackFor('pl')).not.toBe(newsFallbackFor('en'));
    // It says the answer could not be produced. It does not invent one.
    expect(newsFallbackFor('en')).toMatch(/could not produce an answer/i);
    expect(newsFallbackFor('en')).toMatch(/have not guessed/i);
  });

  it('the requested language is passed through to the analysis pipeline', async () => {
    const { analysis, calls } = buildAnalysisDouble({
      respond: () => Promise.resolve(analysisSuccess()),
    });
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    await agent.answerNewsQuestion({ ...INPUT, language: 'pl' });

    expect(calls[0].language).toBe('pl');
  });
});

describe('SUPPORT-AI-1 — the prompt boundary', () => {
  it('the query is the subject and the message, and NOTHING else', () => {
    expect(buildAnalysisQuery('Ceasefire talks', 'What happened this week?')).toBe(
      'Ceasefire talks\n\nWhat happened this week?',
    );
  });

  it('NO identifier, address, session or ticket metadata reaches the provider', async () => {
    const { analysis, calls } = buildAnalysisDouble({
      respond: () => Promise.resolve(analysisSuccess()),
    });
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    await agent.answerNewsQuestion({
      ...INPUT,
      userId: 'user-secret-id-9f2b',
      subject: 'Ceasefire talks',
      message: 'What happened this week?',
    });

    const sent = JSON.stringify(calls);

    // The account id is the one value most likely to be threaded through
    // by accident, because the method receives it for the allowance.
    expect(sent).not.toContain('user-secret-id-9f2b');
    expect(sent).not.toMatch(/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(sent).not.toContain('GN-');
    expect(calls[0].query).toBe('Ceasefire talks\n\nWhat happened this week?');
  });

  it('the provider receives exactly two arguments — no context object is invented', async () => {
    const { analysis, calls } = buildAnalysisDouble({
      respond: () => Promise.resolve(analysisSuccess()),
    });
    const agent = new SupportAiService(analysis, buildConfigDouble({ SUPPORT_AI_ENABLED: 'true' }));

    await agent.answerNewsQuestion(INPUT);

    // Story context is passed ONLY when real context was supplied, and a
    // support ticket supplies none.
    expect(calls[0].extra).toEqual([]);
  });
});

describe('SUPPORT-AI-1 — cost, abuse and concurrency', () => {
  it('the feature flag fails CLOSED — anything but the exact string is off', async () => {
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
      const { analysis, calls } = buildAnalysisDouble({
        respond: () => Promise.resolve(analysisSuccess()),
      });
      const config = buildConfigDouble(value === undefined ? {} : { SUPPORT_AI_ENABLED: value });
      const agent = new SupportAiService(analysis, config);

      const answer = await agent.answerNewsQuestion(INPUT);

      expect({ value, calls: calls.length }).toEqual({ value, calls: 0 });
      expect(answer.skipReason).toBe('disabled');
      expect(answer.status).toBe('AWAITING_ADMIN');
    }
  });

  it('a disabled agent still returns a storable answer — never an error', async () => {
    const agent = new SupportAiService(buildAnalysisDouble().analysis, buildConfigDouble({}));
    const answer = await agent.answerNewsQuestion(INPUT);

    expect(answer.body).toBe(newsFallbackFor('en'));
  });

  it('the per-user allowance is keyed on the account and is spent, not shared', async () => {
    const { analysis, calls } = buildAnalysisDouble({
      respond: () => Promise.resolve(analysisSuccess()),
    });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({ SUPPORT_AI_ENABLED: 'true', SUPPORT_AI_PER_USER_LIMIT: '2' }),
    );

    await agent.answerNewsQuestion({ ...INPUT, userId: 'a' });
    await agent.answerNewsQuestion({ ...INPUT, userId: 'a' });
    const third = await agent.answerNewsQuestion({ ...INPUT, userId: 'a' });
    // A different account is unaffected by the first account's spending.
    const other = await agent.answerNewsQuestion({ ...INPUT, userId: 'b' });

    expect(third.skipReason).toBe('per-user-allowance');
    expect(third.status).toBe('AWAITING_ADMIN');
    expect(other.skipReason).toBeUndefined();
    expect(calls).toHaveLength(3);
  });

  /*
    R4 SUPPORT FINAL CLOSURE — BOUNDED MEMORY IN THE PER-ACCOUNT LIMITER.

    userWindows is a Map keyed on the account. Without a sweep it only ever
    grows: one entry per account that has ever asked a news question, kept
    for the lifetime of the process long after the window it describes has
    expired and can no longer refuse anything. The size of the leak is the
    size of the audience.

    These six assertions are the property, not the implementation. They say
    what must be true of the Map and of the limiter's behaviour, so a
    different sweep that preserved both would still pass -- and any sweep
    that silently handed back a spent allowance would not.

    trackedAccountCount is read here as a DIAGNOSTIC. The behavioural
    assertions below do not depend on it: 3 and 6 prove the allowance is
    unchanged through the public surface alone.
  */

  it('1. an EXPIRED account window is pruned when another window opens', async () => {
    const { analysis } = buildAnalysisDouble({ respond: () => Promise.resolve(analysisSuccess()) });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_PER_USER_LIMIT: '5',
        SUPPORT_AI_PER_USER_WINDOW: '1000',
      }),
    );

    await agent.answerNewsQuestion({ ...INPUT, userId: 'expires', now: 0 });
    expect(agent.trackedAccountCount).toBe(1);

    // A different account opens a window well after the first has expired.
    await agent.answerNewsQuestion({ ...INPUT, userId: 'later', now: 5_000 });

    // The expired entry is gone; only the live one remains.
    expect(agent.trackedAccountCount).toBe(1);
  });

  it('2. a LIVE account window is NOT pruned', async () => {
    const { analysis } = buildAnalysisDouble({ respond: () => Promise.resolve(analysisSuccess()) });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_PER_USER_LIMIT: '5',
        SUPPORT_AI_PER_USER_WINDOW: '10000',
      }),
    );

    await agent.answerNewsQuestion({ ...INPUT, userId: 'live', now: 0 });
    await agent.answerNewsQuestion({ ...INPUT, userId: 'other', now: 100 });

    // Both windows are still open, so both are still tracked.
    expect(agent.trackedAccountCount).toBe(2);
  });

  it('3. a LIVE account does NOT regain its allowance because of the sweep', async () => {
    /*
      THE ASSERTION THAT MATTERS MOST. A sweep that pruned indiscriminately
      would look like a memory fix and behave like removing the rate limit:
      the account's counter would vanish and the next request would be
      admitted as a first one. This is proven through the PUBLIC surface --
      no diagnostic getter is consulted.
    */
    const { analysis } = buildAnalysisDouble({ respond: () => Promise.resolve(analysisSuccess()) });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_PER_USER_LIMIT: '1',
        SUPPORT_AI_PER_USER_WINDOW: '10000',
      }),
    );

    await agent.answerNewsQuestion({ ...INPUT, userId: 'spent', now: 0 });

    // Many other accounts open windows, each one running the sweep.
    for (let index = 0; index < 25; index += 1) {
      await agent.answerNewsQuestion({ ...INPUT, userId: `sweeper-${index}`, now: 100 + index });
    }

    const blocked = await agent.answerNewsQuestion({ ...INPUT, userId: 'spent', now: 500 });

    expect(blocked.skipReason).toBe('per-user-allowance');
    expect(blocked.status).toBe('AWAITING_ADMIN');
  });

  it('4. hundreds of expired accounts do not grow the map indefinitely', async () => {
    const { analysis } = buildAnalysisDouble({ respond: () => Promise.resolve(analysisSuccess()) });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_PER_USER_LIMIT: '5',
        SUPPORT_AI_PER_USER_WINDOW: '1000',
      }),
    );

    // 300 accounts, each one window-width apart, so each has expired by the
    // time the next arrives.
    for (let index = 0; index < 300; index += 1) {
      await agent.answerNewsQuestion({
        ...INPUT,
        userId: `account-${index}`,
        now: index * 2_000,
      });
    }

    /*
      The bound is a CONSTANT, not a fraction of the traffic. Asserting
      "fewer than 300" would still pass a leak that grew at half the rate.
      Only the account that opened the most recent window is still live.
    */
    expect(agent.trackedAccountCount).toBe(1);
  });

  it('5. a same-account rollover replaces its entry rather than accumulating', async () => {
    const { analysis } = buildAnalysisDouble({ respond: () => Promise.resolve(analysisSuccess()) });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_PER_USER_LIMIT: '1',
        SUPPORT_AI_PER_USER_WINDOW: '1000',
      }),
    );

    for (let index = 0; index < 50; index += 1) {
      await agent.answerNewsQuestion({ ...INPUT, userId: 'returning', now: index * 2_000 });
    }

    // Fifty rollovers by one account is one entry, not fifty -- and the
    // sweep that precedes each rollover has not removed the entry the
    // rollover then writes.
    expect(agent.trackedAccountCount).toBe(1);

    // And that surviving entry is a REAL window: the allowance is spent.
    const blocked = await agent.answerNewsQuestion({ ...INPUT, userId: 'returning', now: 98_500 });
    expect(blocked.skipReason).toBe('per-user-allowance');
  });

  it('6. the per-account allowance behaves exactly as it did before the sweep', async () => {
    /*
      The regression fence. Spend, refuse, roll over, spend again, and an
      unrelated account unaffected throughout -- the whole documented
      contract of the limiter, asserted through the public surface only.
    */
    const { analysis, calls } = buildAnalysisDouble({
      respond: () => Promise.resolve(analysisSuccess()),
    });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_PER_USER_LIMIT: '2',
        SUPPORT_AI_PER_USER_WINDOW: '1000',
      }),
    );

    const first = await agent.answerNewsQuestion({ ...INPUT, userId: 'a', now: 0 });
    const second = await agent.answerNewsQuestion({ ...INPUT, userId: 'a', now: 100 });
    const third = await agent.answerNewsQuestion({ ...INPUT, userId: 'a', now: 200 });
    const otherAccount = await agent.answerNewsQuestion({ ...INPUT, userId: 'b', now: 300 });
    const afterRollover = await agent.answerNewsQuestion({ ...INPUT, userId: 'a', now: 1_500 });

    expect(first.skipReason).toBeUndefined();
    expect(second.skipReason).toBeUndefined();
    expect(third.skipReason).toBe('per-user-allowance');
    expect(otherAccount.skipReason).toBeUndefined();
    expect(afterRollover.skipReason).toBeUndefined();

    // Four admitted requests reached the provider; the refused one did not.
    expect(calls).toHaveLength(4);
  });

  it('the sweep needs no timer, no dependency and no lifecycle hook', () => {
    const code = readFileSync(join(__dirname, 'support-ai.service.ts'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(code).not.toMatch(/setInterval|setTimeout\s*\(\s*\(\)\s*=>\s*this\.prune/);
    expect(code).not.toMatch(/OnModuleDestroy|OnApplicationShutdown|onModuleInit/);
    expect(code).toMatch(/private pruneExpired\(now: number\): void/);

    // The sweep runs on the window-OPEN branch, and only there.
    const admit = code.slice(
      code.indexOf('private admitUser'),
      code.indexOf('private pruneExpired'),
    );
    expect(admit.match(/this\.pruneExpired\(/g) ?? []).toHaveLength(1);
    expect(admit.indexOf('this.pruneExpired(')).toBeLessThan(
      admit.indexOf('this.userWindows.set('),
    );
  });

  it('the diagnostic getter is exposed through NO HTTP surface', () => {
    const files = ['support.controller.ts', 'admin-support.controller.ts', 'support.service.ts'];

    files.forEach((file) => {
      const code = readFileSync(join(__dirname, file), 'utf-8');
      expect({ file, leaks: code.includes('trackedAccountCount') }).toEqual({ file, leaks: false });
    });

    const dto = readFileSync(join(__dirname, 'dto', 'support.dto.ts'), 'utf-8');
    expect(dto).not.toContain('trackedAccountCount');
  });

  it('the window rolls over, so the allowance is a rate and not a lifetime cap', async () => {
    const { analysis } = buildAnalysisDouble({ respond: () => Promise.resolve(analysisSuccess()) });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_PER_USER_LIMIT: '1',
        SUPPORT_AI_PER_USER_WINDOW: '1000',
      }),
    );

    await agent.answerNewsQuestion({ ...INPUT, now: 0 });
    const blocked = await agent.answerNewsQuestion({ ...INPUT, now: 500 });
    const allowed = await agent.answerNewsQuestion({ ...INPUT, now: 1500 });

    expect(blocked.skipReason).toBe('per-user-allowance');
    expect(allowed.skipReason).toBeUndefined();
  });

  it('a nonsense limit falls back to the documented default rather than to zero or infinity', () => {
    const agent = new SupportAiService(
      buildAnalysisDouble().analysis,
      buildConfigDouble({
        SUPPORT_AI_PER_USER_LIMIT: 'abc',
        SUPPORT_AI_TIMEOUT_MS: '-5',
        SUPPORT_AI_MAX_CONCURRENT: '0',
      }),
    );

    expect(agent.perUserLimit).toBe(SUPPORT_AI_DEFAULT_PER_USER_LIMIT);
    expect(agent.timeoutMs).toBe(SUPPORT_AI_DEFAULT_TIMEOUT_MS);
    expect(agent.maxConcurrent).toBe(SUPPORT_AI_DEFAULT_MAX_CONCURRENT);
  });

  it('the global concurrency bound REFUSES rather than queueing', async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<AnalysisApiResponse>((resolve) => {
      release = () => resolve(analysisSuccess());
    });

    const { analysis, calls } = buildAnalysisDouble({ respond: () => blocked });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({ SUPPORT_AI_ENABLED: 'true', SUPPORT_AI_MAX_CONCURRENT: '1' }),
    );

    const first = agent.answerNewsQuestion({ ...INPUT, userId: 'a' });
    const second = await agent.answerNewsQuestion({ ...INPUT, userId: 'b' });

    // An unbounded in-memory queue would have made this wait instead.
    expect(second.skipReason).toBe('concurrency');
    expect(calls).toHaveLength(1);

    release?.();
    await expect(first).resolves.toEqual(expect.objectContaining({ status: 'AWAITING_USER' }));

    // And the slot came back.
    const third = await agent.answerNewsQuestion({ ...INPUT, userId: 'c' });
    expect(third.skipReason).toBeUndefined();
  });

  it('a TIMED-OUT call keeps its slot until the provider actually settles', async () => {
    let release: (() => void) | undefined;
    const slow = new Promise<AnalysisApiResponse>((resolve) => {
      release = () => resolve(analysisSuccess());
    });

    const { analysis } = buildAnalysisDouble({ respond: () => slow });
    const agent = new SupportAiService(
      analysis,
      buildConfigDouble({
        SUPPORT_AI_ENABLED: 'true',
        SUPPORT_AI_MAX_CONCURRENT: '1',
        SUPPORT_AI_TIMEOUT_MS: '20',
      }),
    );

    const timedOut = await agent.answerNewsQuestion({ ...INPUT, userId: 'a' });
    expect(timedOut.skipReason).toBe('timeout');

    // THE POINT: the provider call is still running. Releasing the slot
    // when the RACE resolved would let a burst of timeouts start
    // unlimited real provider calls, and the bound would describe nothing.
    const whileStillRunning = await agent.answerNewsQuestion({ ...INPUT, userId: 'b' });
    expect(whileStillRunning.skipReason).toBe('concurrency');

    release?.();
    await new Promise((resolve) => setTimeout(resolve, 5));

    const afterSettled = await agent.answerNewsQuestion({ ...INPUT, userId: 'c' });
    expect(afterSettled.skipReason).toBeUndefined();
  });
});
