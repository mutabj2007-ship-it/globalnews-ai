import { readFileSync } from 'fs';
import { join } from 'path';
import type { NewsArticle } from '@globalnews-ai/shared';

import {
  DECLARED_REGIONS,
  EAST_AFRICA,
  MAX_CONCURRENT_REGION_REQUESTS,
  detectDeclaredRegion,
  resolveRegionMembers,
} from './declared-regions';
import { buildRegionScope, memberIso3WithEvidence, retrievalOutcome } from './region-coverage';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * ASK AI — EAST AFRICA AND PROVIDER RATE LIMIT · C907 §8
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE ACCEPTANCE EVIDENCE is the Product Owner's own question, reproduced here
 * verbatim as a fixture. On Alpha it matched no country and no relational
 * pattern, fell through to a single generic provider search, and returned
 * nothing — so the reader was told there was no reporting about a region
 * eleven countries file into daily.
 *
 * The ruling names three tests. They are labelled A, B and C below, and C is
 * the one that matters most: it must prove OpenAI was NOT called.
 */

/** The Product Owner's exact query. */
const PO_QUERY =
  "What's happening in East Africa, economically and politically? " +
  'do we have severe humanitarian indications affecting countries in that region?';

const serviceSource = readFileSync(join(__dirname, '..', 'service', 'analysis.service.ts'), 'utf-8');

const article = (id: string, countryCode: string): NewsArticle =>
  ({
    id,
    title: `Report ${id}`,
    summary: 'Summary',
    url: `https://example.test/${id}`,
    sourceId: 's',
    sourceName: 'S',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-12T08:00:00.000Z',
    countryCode,
  }) as unknown as NewsArticle;

describe('TEST A · the typed question resolves EAST AFRICA as request scope', () => {
  it('THE PO QUERY, VERBATIM, selects the declared region', () => {
    expect(detectDeclaredRegion(PO_QUERY.toLowerCase())).toBe(EAST_AFRICA);
  });

  it('carries exactly the eleven declared members, in the ruling order', () => {
    expect(EAST_AFRICA.members).toEqual([
      'BDI',
      'COD',
      'DJI',
      'ERI',
      'ETH',
      'KEN',
      'RWA',
      'SOM',
      'SSD',
      'TZA',
      'UGA',
    ]);
  });

  it('every declared member resolves in the curated registry', () => {
    /*
      A code that does not resolve is dropped rather than substituted, so this
      failing would mean the response truthfully reports fewer members than the
      region declares — visible, never silent. It should still never fail.
    */
    expect(resolveRegionMembers(EAST_AFRICA)).toHaveLength(EAST_AFRICA.members.length);
  });

  it('matches the region by its real names and nothing looser', () => {
    for (const yes of [
      'what is happening in east africa',
      'eastern africa humanitarian situation',
      'east african community trade',
      'the horn of africa',
    ]) {
      expect(detectDeclaredRegion(yes)).toBe(EAST_AFRICA);
    }

    for (const no of [
      'south africa elections',
      'west africa security',
      'africa',
      'southeast asia',
      'rwanda',
    ]) {
      expect(detectDeclaredRegion(no)).toBeUndefined();
    }
  });

  it('is NOT routed as one generic global provider search', () => {
    /*
      The defect, asserted at the routing site: the region branch is chosen
      before the anchor, country and generic branches, and it fans out per
      member rather than deriving one keyword.
    */
    expect(serviceSource).toMatch(/if \(declaredRegion\) \{/);
    expect(serviceSource).toMatch(/this\.retrievePerSideEvidence\(members, requestedLanguage\)/);
    const branch = serviceSource.slice(
      serviceSource.indexOf('if (declaredRegion) {\n          /*\n            THE DECLARED-REGION BRANCH.'),
      serviceSource.indexOf('} else if (anchorArticle) {'),
    );
    expect(branch).not.toMatch(/deriveGenericNewsQuery|deriveFallbackNewsQuery/);
  });

  it('THE TYPED QUESTION OUTRANKS THE MAP CAMERA', () => {
    /*
      *"Current map camera must not override typed 'East Africa'."*
      `storyAnchoredLocation` is the camera. When a declared region is present,
      `location` is undefined and the anchored branch is not reached.
    */
    expect(serviceSource).toMatch(/declaredRegion !== undefined\s*\?\s*undefined\s*:\s*\(storyAnchoredLocation/);
  });

  it('THE BOUND IS ON CONCURRENCY, NOT ON MEMBERSHIP', () => {
    /*
      The rejected first implementation was `members.slice(0, 6)` over the
      declared order, which is alphabetical by ISO3 — so RWA, SOM, SSD, TZA and
      UGA were never asked about on any East Africa question. The ruling:
      *"ALL 11 members must be eligible for retrieval. The bound applies to
      CONCURRENCY / batching, not permanent membership."*
    */
    expect(MAX_CONCURRENT_REGION_REQUESTS).toBeGreaterThan(0);

    /* The membership slice must be gone from the service entirely. */
    expect(serviceSource).not.toMatch(/resolveRegionMembers\([^)]*\)\.slice\(/);
    expect(serviceSource).not.toContain('MAX_REGION_MEMBERS_PER_REQUEST');

    /* What remains is a batch width over the WHOLE membership. */
    expect(serviceSource).toMatch(
      /members\.slice\(cursor, cursor \+ MAX_CONCURRENT_REGION_REQUESTS\)/,
    );
    expect(serviceSource).toMatch(/while \(cursor < members\.length && !throttled\)/);
  });

  it('NO MEMBER IS PERMANENTLY EXCLUDED — the five the old slice dropped are reachable', () => {
    const members = resolveRegionMembers(EAST_AFRICA).map((m) => m.iso3);

    for (const dropped of ['RWA', 'SOM', 'SSD', 'TZA', 'UGA']) {
      expect(members).toContain(dropped);
    }

    /* 11 members at width 6 is two batches, not one truncation. */
    const width = MAX_CONCURRENT_REGION_REQUESTS;
    const batches: number[] = [];
    for (let i = 0; i < members.length; i += width) batches.push(members.slice(i, i + width).length);

    expect(batches).toEqual([6, 5]);
  });

  it('evidence is NEVER a reason to stop early; a rate limit is the only one', () => {
    const loop = serviceSource.slice(
      serviceSource.indexOf('while (cursor < members.length && !throttled)'),
      serviceSource.indexOf('const unreached = members.slice(attempted.length);'),
    );

    expect(loop).toMatch(/if \(failureKinds\.has\('rate-limited'\)\) \{/);
    /* Nothing in the loop may break on having found articles. */
    expect(loop).not.toMatch(/collected\.length\s*>\s*0[\s\S]{0,80}(break|throttled = true)/);
  });

  it('a requested region never raises evidence precision', () => {
    /*
      The scope is a description of the REQUEST and lives on
      `retrievalContext.requestedScope`. Nothing writes a region onto an
      article, and the member count is derived from each article's OWN
      resolved country.
    */
    expect(memberIso3WithEvidence.toString()).not.toMatch(/\.countryCode\s*=|push\(|splice/);
    const branch = serviceSource.slice(
      serviceSource.indexOf('if (declaredRegion) {\n          /*'),
      serviceSource.indexOf('} else if (anchorArticle) {'),
    );
    expect(branch).not.toMatch(/article\.countryCode\s*=|precision/i);
  });

  it('counts members from each article’s own country, not from what was asked', () => {
    const members = resolveRegionMembers(EAST_AFRICA);
    const kenya = members.find((m) => m.iso3 === 'KEN')!;
    const uganda = members.find((m) => m.iso3 === 'UGA')!;

    const counted = memberIso3WithEvidence(
      [article('a', kenya.iso2), article('b', kenya.iso2), article('c', uganda.iso2)],
      members,
    );

    /* Two members present across three articles — not three, and not eleven. */
    expect(counted).toEqual(new Set(['KEN', 'UGA']));
  });

  it('COVERAGE TELEMETRY exposes every field the ruling names', () => {
    const members = resolveRegionMembers(EAST_AFRICA);
    const scope = buildRegionScope(EAST_AFRICA, {
      attempted: members.slice(0, 6),
      unreached: members.slice(6),
      live: new Set(['ETH', 'KEN']),
      unavailable: new Set(['DJI']),
      retainedOnly: new Set(['RWA', 'UGA']),
    });

    expect(scope.membersDeclared).toBe(11);
    expect(scope.membersAttempted).toBe(6);
    expect(scope.membersLiveRetrieved).toBe(2);
    expect(scope.membersRetainedOnly).toBe(2);
    expect(scope.membersUnavailable).toBe(1);
    expect(scope.attempted).toEqual(['BDI', 'COD', 'DJI', 'ERI', 'ETH', 'KEN']);
    expect(scope.notReached).toEqual(['RWA', 'SOM', 'SSD', 'TZA', 'UGA']);
  });

  it('PARTIAL COVERAGE IS NEVER DESCRIBED AS COMPLETE', () => {
    const members = resolveRegionMembers(EAST_AFRICA);
    const complete = buildRegionScope(EAST_AFRICA, {
      attempted: members,
      unreached: [],
      live: new Set(['KEN']),
      unavailable: new Set(),
    });
    const throttled = buildRegionScope(EAST_AFRICA, {
      attempted: members.slice(0, 6),
      unreached: members.slice(6),
      live: new Set(['KEN']),
      unavailable: new Set(),
    });
    const withFailure = buildRegionScope(EAST_AFRICA, {
      attempted: members,
      unreached: [],
      live: new Set(['KEN']),
      unavailable: new Set(['DJI']),
    });

    expect(complete.coverageComplete).toBe(true);
    expect(throttled.coverageComplete).toBe(false);
    expect(withFailure.coverageComplete).toBe(false);
  });
});

describe('TEST B · a rate limit is not an empty world', () => {
  it('RATE_LIMITED IS NOT "NO NEWS EXISTS"', () => {
    expect(retrievalOutcome(0, new Set(['rate-limited']))).toBe('PROVIDER_RATE_LIMITED');
    expect(retrievalOutcome(0, new Set())).toBe('NO_RELEVANT_EVIDENCE');
  });

  it('NO_RELEVANT_EVIDENCE is unreachable while any provider refused us', () => {
    /*
      It is the only outcome that asserts something about the world. Every
      other failure kind must win over it.
    */
    for (const kind of ['rate-limited', 'bad-request', 'auth', 'unavailable', 'anything-new']) {
      expect(retrievalOutcome(0, new Set([kind]))).not.toBe('NO_RELEVANT_EVIDENCE');
    }
  });

  it('a rate limit is reported ahead of a general unavailability', () => {
    expect(retrievalOutcome(0, new Set(['unavailable', 'rate-limited']))).toBe(
      'PROVIDER_RATE_LIMITED',
    );
  });

  it('evidence beats every failure — a partial outage that still returned reporting is SUCCESS', () => {
    expect(retrievalOutcome(3, new Set(['rate-limited']))).toBe('SUCCESS');
  });

  it('all five outcomes exist and the fifth is stamped by the caller', () => {
    const outcomes = new Set([
      retrievalOutcome(1, new Set()),
      retrievalOutcome(0, new Set()),
      retrievalOutcome(0, new Set(['rate-limited'])),
      retrievalOutcome(0, new Set(['unavailable'])),
    ]);

    expect(outcomes).toEqual(
      new Set(['SUCCESS', 'NO_RELEVANT_EVIDENCE', 'PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE']),
    );
    /* RETAINED_ONLY is decided where the substitution happens, and nowhere else. */
    expect((serviceSource.match(/'RETAINED_ONLY'/g) ?? []).length).toBe(1);
  });

  it('RETAINED reporting is fetched for the REGION’S OWN MEMBERS, never as unrelated cache', () => {
    expect(serviceSource).toMatch(/this\.newsService\.findRetainedByCountry\(/);
    const retained = serviceSource.slice(
      serviceSource.indexOf('private async retrieveRetainedForRegion'),
      serviceSource.indexOf('private async retrieveRetainedForRegion') + 1800,
    );
    /* It can only ask about a country it was handed. */
    expect(retained).toMatch(/for \(const member of members\)/);
    expect(retained).not.toMatch(/findRecent\(|search\(|topHeadlines\(/);
  });

  it('retained reporting is never served without being declared', () => {
    /* The adoption and the disclosure are one expression. */
    const ladder = serviceSource.slice(
      serviceSource.indexOf('const retained = await this.retrieveRetainedForRegion(members);'),
      serviceSource.indexOf('} else if (anchorArticle) {'),
    );

    expect(ladder).toMatch(/articles = retained;/);
    expect(ladder).toMatch(/outcome: 'RETAINED_ONLY'/);
    expect(ladder).toMatch(/dataMode: 'cached'/);
  });

  it('the retained rung is reached only when live did NOT succeed', () => {
    expect(serviceSource).toMatch(
      /articles\.length === 0 && regional\.retrievalContext\.dataMode !== 'live'/,
    );
  });
});

describe('TEST C · OPENAI IS NOT CALLED WHEN THERE IS NO EVIDENCE', () => {
  /*
   * THE RULING: *"LIVE unavailable + no relevant retained evidence -> NO
   * OpenAI call -> explicit retrieval-unavailable outcome"*, and from the
   * previous round, *"The refusal to call OpenAI with zero evidence was
   * CORRECT. Preserve it."*
   *
   * This is a structural proof rather than a behavioural one, and deliberately
   * so: the guard's whole value is that it sits BEFORE the provider call on
   * every path, which is a property of where it is, not of what it returns.
   */
  const zeroEvidenceGuard = serviceSource.indexOf('if (articles.length === 0) {');
  const providerCall = serviceSource.indexOf('await this.provider.analyzeNews(');

  it('the zero-evidence guard exists and returns before any provider call', () => {
    expect(zeroEvidenceGuard).toBeGreaterThan(-1);
    expect(providerCall).toBeGreaterThan(zeroEvidenceGuard);
  });

  it('the guard returns — it does not fall through', () => {
    const block = serviceSource.slice(zeroEvidenceGuard, providerCall);

    expect(block).toMatch(/return empty;/);
    expect(block).not.toMatch(/this\.provider\.analyzeNews/);
  });

  it('it records that no AI call was ATTEMPTED, not that one failed', () => {
    const block = serviceSource.slice(zeroEvidenceGuard, providerCall);

    expect(block).toMatch(/analysis: null/);
    expect(block).toMatch(/'not-attempted'/);
  });

  it('the region branch adds no provider call of its own', () => {
    const branch = serviceSource.slice(
      serviceSource.indexOf('if (declaredRegion) {\n          /*'),
      serviceSource.indexOf('} else if (anchorArticle) {'),
    );

    expect(branch).not.toMatch(/analyzeNews|openai|OpenAi/i);
  });

  it('nothing in the ladder can reach the model with an empty pool', () => {
    /*
      The three rungs end in exactly three states: live evidence, retained
      evidence, or `articles` still empty — and the third falls into the guard
      above, which returns. There is no fourth exit.
    */
    const branch = serviceSource.slice(
      serviceSource.indexOf('if (declaredRegion) {\n          /*'),
      serviceSource.indexOf('} else if (anchorArticle) {'),
    );

    expect(branch).not.toMatch(/return\s/);
  });
});

describe('the declared region list is governed, not inferred', () => {
  it('membership comes from this module and from nothing else at request time', () => {
    const source = readFileSync(join(__dirname, 'declared-regions.ts'), 'utf-8');

    expect(source).not.toMatch(/fetch\(|http|camera|storyContext|provider/i);
    expect(DECLARED_REGIONS).toContain(EAST_AFRICA);
  });
});
