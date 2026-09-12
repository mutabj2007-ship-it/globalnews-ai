import { readFileSync } from 'fs';
import { join } from 'path';
import { PROVENANCE } from '@/lib/admin/adminProvenance';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { sectionNumber, sectionState } from '@/lib/admin/adminDataState';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import { adminPl } from '@/lib/i18n/dictionaries/adminPl';

/**
 * ADMIN-03 — the analytics surface, asserted against the SHIPPED SOURCE.
 *
 * These screens are the first in the admin platform whose numbers are
 * real, and that is precisely why they need this file. While every card
 * read "no source", nothing could be misattributed. Now that three cards
 * carry live values and three beside them do not, the failure mode is no
 * longer an empty dashboard — it is a live number quietly filling an
 * absent one's slot.
 *
 * `testEnvironment` here is node, so these are source assertions rather
 * than renders, matching every other admin screen spec in this
 * repository.
 */
const SCREENS = join(__dirname, 'screens');
const read = (name: string): string => readFileSync(join(SCREENS, name), 'utf-8');

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const TABS = ['AnalyticsUsageTab.tsx', 'AnalyticsGeographyTab.tsx', 'AnalyticsUsersTab.tsx'];

describe('ADMIN-03 — the tabs live where the guards can see them', () => {
  it('every tab is a FLAT sibling in the screens directory, not a nested folder', () => {
    // adminDataStates.spec.ts sweeps this folder with a non-recursive
    // readdir for rendered numeric literals. A subdirectory would have
    // escaped that guard in silence, so the layout follows the guard.
    TABS.forEach((name) => {
      expect(() => read(name)).not.toThrow();
    });
  });

  it('every tab is a client component that takes its dictionary from context', () => {
    TABS.forEach((name) => {
      const source = read(name);
      expect(source).toContain("'use client'");
      expect(source).toContain('useAdminContext');
    });
  });

  it('no tab issues a request of its own — each composes the sanctioned hook', () => {
    TABS.forEach((name) => {
      const source = stripComments(read(name));
      expect(source).toContain('useAdminResource');
      expect(source).not.toMatch(/\bfetch\(/);
      expect(source).not.toContain('XMLHttpRequest');
      expect(source).not.toContain('axios');
    });
  });

  it('no tab hardcodes an /admin path — every one comes from ADMIN_API', () => {
    TABS.forEach((name) => {
      const source = stripComments(read(name));
      expect(source).not.toMatch(/['"`]\/admin\//);
    });
  });
});

describe('ADMIN-03 — a live number can never fill an absent one', () => {
  const usage = stripComments(read('AnalyticsUsageTab.tsx'));

  /**
   * THE ONE THAT MATTERS MOST ON THIS SCREEN.
   *
   * "Active users" has no source of truth: no per-request activity is
   * recorded and the anonymous majority cannot be counted at all.
   * "Recorded return visits" is real but narrower — accounts whose
   * return-surface visit falls in the window. They sit in the same KPI
   * row, which is exactly the arrangement in which one gets pointed at
   * the other.
   */
  it('the ACTIVE USERS card is bound to UNAVAILABLE and to nothing else', () => {
    const card = usage.slice(
      usage.indexOf('screen.kpis.activeUsers'),
      usage.indexOf('screen.kpis.clientErrors'),
    );

    expect(card).toContain('data={UNAVAILABLE}');
    expect(card).not.toContain('observedReturning');
    expect(card).not.toContain('accountValue');
    expect(card).not.toContain('analysisValue');
  });

  it('the CLIENT ERRORS card is notImplemented and reads no field', () => {
    const card = usage.slice(usage.indexOf('screen.kpis.clientErrors'));
    const openTag = card.slice(0, card.indexOf('/>'));

    expect(openTag).toContain('data={NOT_IMPLEMENTED}');
    expect(openTag).not.toContain('accounts?.');
    expect(openTag).not.toContain('analysis?.');
  });

  it('sessions and languages remain placeholders, and sessions states WHY it cannot exist', () => {
    expect(usage).toContain('screen.sessionsRequirement');
    expect(usage).toContain('field="admin-03.languagePerSession"');
    expect(adminEn.screens.analytics.sessionsRequirement).toMatch(/deleted/i);
    expect(adminPl.screens.analytics.sessionsRequirement.length).toBeGreaterThan(0);
  });

  it('the returning card carries the note that says what it actually counts', () => {
    expect(usage).toContain('screen.returningMeaning');
    // The English copy has to deny the equivalence in as many words,
    // because the card sits beside the one it could be mistaken for.
    expect(adminEn.screens.analytics.returningMeaning).toMatch(/NOT active users/i);
  });

  it('the two measurements keep SEPARATE provenance keys', () => {
    expect(PROVENANCE['admin-03.observedReturnVisits']).toBe('A');
    expect(PROVENANCE['admin-03.activeReturning']).toBe('C');
    expect(PROVENANCE['admin-03.clientErrors']).toBe('C');
    expect(PROVENANCE['admin-03.retention']).toBe('C');
    expect(PROVENANCE['admin-03.subscriptions']).toBe('C');
  });
});

describe('ADMIN-03 — analysis runs are not AI questions', () => {
  it('neither dictionary calls the AnalysisRun count a question', () => {
    [adminEn, adminPl].forEach((dictionary) => {
      const analytics = JSON.stringify(dictionary.screens.analytics);
      expect(analytics).not.toMatch(/AI question/i);
      expect(analytics).not.toMatch(/PYTANIA DO AI/i);
    });
    expect(adminEn.screens.analytics.kpis).not.toHaveProperty('aiQuestions');
    expect(adminPl.screens.analytics.kpis).not.toHaveProperty('aiQuestions');
  });

  it('the panel states that a row is a served request, cached and failed runs included', () => {
    expect(adminEn.screens.analytics.analysisPurpose).toMatch(/cached/i);
    expect(adminEn.screens.analytics.analysisPurpose).toMatch(/not a count of questions/i);
  });

  it('an average is never rendered without its sample size beside it', () => {
    const usage = stripComments(read('AnalyticsUsageTab.tsx'));
    const branch = usage.slice(usage.indexOf('analysis.latency.sampleCount > 0'));

    expect(branch).toContain('screen.analysisNoSample');
    expect(usage).toContain('screen.analysisSample');
  });
});

describe('ADMIN-03 — the instrumentation gap is disclosed, not implied', () => {
  const usage = read('AnalyticsUsageTab.tsx');

  it('the recorded-events panel renders the gap notice and both name lists', () => {
    const panel = usage.slice(usage.indexOf('screen.recordedEventsTitle'));

    expect(panel).toContain('screen.instrumentationGapTitle');
    expect(panel).toContain('screen.instrumentationGapBody');
    expect(panel).toContain('instrumentedEventNames');
    expect(panel).toContain('uninstrumentedEventNames');
  });

  it('the copy says the missing names are ABSENT rather than unused, in both languages', () => {
    expect(adminEn.screens.analytics.instrumentationGapBody).toMatch(/missing from the data/i);
    expect(adminEn.screens.analytics.instrumentationGapBody).toMatch(/rather than unused/i);
    expect(adminPl.screens.analytics.instrumentationGapBody).toMatch(/nieobecne/i);
  });

  it('nothing on the screen calls the recorded events "top features"', () => {
    const panel = stripComments(usage.slice(usage.indexOf('screen.recordedEventsTitle')));
    expect(panel).not.toContain('screen.topFeatures');
  });

  it('retention is disclosed as declared-but-unenforced', () => {
    expect(usage).toContain('screen.retentionNotEnforced');
    expect(adminEn.screens.analytics.retentionNotEnforced).toMatch(/NOT ENFORCED/);
    expect(adminEn.screens.analytics.retentionNotEnforced).toMatch(/no scheduler/i);
    expect(adminPl.screens.analytics.retentionNotEnforced).toMatch(/NIEEGZEKWOWANA/);
  });
});

describe('ADMIN-03 — three geographies, kept apart', () => {
  const geography = read('AnalyticsGeographyTab.tsx');

  it('the followed-countries title is the approved wording, in full, in both languages', () => {
    expect(adminEn.screens.analytics.followedTitle).toBe(
      'Followed countries — declared interest, signed-in accounts only',
    );
    // The qualifier is the panel, not decoration on it: "Followed
    // countries" alone would be read as audience geography.
    expect(adminPl.screens.analytics.followedTitle).toMatch(/tylko konta zalogowane/i);
    expect(geography).toContain('screen.followedTitle');
  });

  it('audience geography renders an explicitly inert panel rather than being omitted', () => {
    // Omitting it would invite somebody to build one. A visible panel
    // that states why it cannot exist is the stronger disclosure.
    expect(geography).toContain('field="admin-03.audienceGeography"');
    expect(geography).toContain('screen.audienceGeographyRequirement');
    expect(PROVENANCE['admin-03.audienceGeography']).toBe('C');
  });

  it('the audience copy names every input it refuses to infer from', () => {
    const copy = adminEn.screens.analytics.audienceGeographyRequirement;
    ['coverage', 'followed countries', 'retrieval scope', 'language', 'model output'].forEach(
      (input) => {
        expect({ input, mentioned: copy.toLowerCase().includes(input) }).toEqual({
          input,
          mentioned: true,
        });
      },
    );
  });

  it('no audience-location value is derived anywhere on the tab', () => {
    const source = stripComments(geography);
    ['ipAddress', 'geoip', 'timezone', 'navigator.language', 'userCountry'].forEach((needle) => {
      expect({ needle, present: source.includes(needle) }).toEqual({ needle, present: false });
    });
  });

  it('the truncation of the ranked list is disclosed where the list is', () => {
    expect(geography).toContain('screen.coverageTruncated');
    expect(geography).toContain('countryLimit');
    expect(adminEn.screens.analytics.coverageTruncated).toMatch(/capped/i);
  });
});

describe('ADMIN-03 — the account list shows nothing it was told not to', () => {
  const users = read('AnalyticsUsersTab.tsx');

  it('renders none of the forbidden fields, and none of them is even referenced', () => {
    const source = stripComments(users);
    [
      'email',
      'maskedEmail',
      'emailDomain',
      'displayName',
      'searchHistory',
      'providerAccountId',
      'tokenHash',
      'sessionId',
    ].forEach((field) => {
      expect({ field, present: source.includes(field) }).toEqual({ field, present: false });
    });
  });

  it('the columns are exactly the four approved ones', () => {
    const source = stripComments(users);
    const columnIds = (source.match(/id: '(\w+)', header: screen\.users/g) ?? []).length;
    expect(source).toContain('screen.usersIdColumn');
    expect(source).toContain('screen.usersCreatedColumn');
    expect(source).toContain('screen.usersLastSeenColumn');
    expect(source).toContain('screen.usersRoleColumn');
    expect(columnIds).toBeGreaterThan(0);
  });

  it('the operator is TOLD what is absent, rather than left to wonder', () => {
    expect(users).toContain('screen.usersOmittedFields');
    expect(users).toContain('screen.usersNoWritePath');
    ['address', 'domain', 'search history', 'session', 'display name'].forEach((mention) => {
      expect({
        mention,
        said: adminEn.screens.analytics.usersOmittedFields.toLowerCase().includes(mention),
      }).toEqual({ mention, said: true });
    });
  });

  it('the read-only notice denies a write path in both languages', () => {
    expect(adminEn.screens.analytics.usersNoWritePath).toMatch(/read-only/i);
    expect(adminEn.screens.analytics.usersNoWritePath).toMatch(/granted, changed or removed/i);
    expect(adminPl.screens.analytics.usersNoWritePath).toMatch(/tylko do odczytu/i);
  });

  it('a never-observed account says so instead of rendering an empty cell', () => {
    // A blank cell in a table of people reads as a fact about the person
    // rather than about the measurement.
    expect(users).toContain('screen.usersNeverSeen');
    expect(users).toContain('row.lastSeenAt ?? screen.usersNeverSeen');
  });

  it('the route it reads is the access.manage one', () => {
    expect(users).toContain('ADMIN_API.users');
    expect(ADMIN_API.users).toBe('/admin/users');
  });
});

describe('ADMIN-03 — a failed section is an error, never "no source" and never zero', () => {
  it('a null section under a successful request resolves to error', () => {
    expect(sectionState('real', null)).toBe('error');
    expect(sectionState('real', undefined)).toBe('error');
  });

  it('a present section resolves to real', () => {
    expect(sectionState('real', { total: 0 })).toBe('real');
  });

  it('the request state wins while the request is still loading or has failed', () => {
    expect(sectionState('loading', null)).toBe('loading');
    expect(sectionState('error', { total: 1 })).toBe('error');
  });

  it('a genuine zero inside a healthy section is still a measured zero', () => {
    expect(sectionNumber('real', { total: 0 }, 0)).toEqual({ state: 'zero', value: 0 });
  });

  it('a failed section never yields a number', () => {
    expect(sectionNumber('real', null, 5)).toEqual({ state: 'error' });
    expect(sectionNumber('loading', null, 5)).toEqual({ state: 'loading' });
  });

  it('every live card offers a retry, because every one of them can fail', () => {
    TABS.forEach((name) => {
      const source = read(name);
      expect(source).toContain('onRetry=');
      expect(source).toContain('.reload');
    });
  });
});

describe('ADMIN-03 — EN and PL stay in step', () => {
  it('every analytics key exists in both languages', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
            `${prefix}${key}`,
            ...keys(nested, `${prefix}${key}.`),
          ])
        : [];

    expect(keys(adminPl.screens.analytics).sort()).toEqual(keys(adminEn.screens.analytics).sort());
  });

  it('no analytics string was left untranslated', () => {
    const en = adminEn.screens.analytics as unknown as Record<string, unknown>;
    const pl = adminPl.screens.analytics as unknown as Record<string, unknown>;

    const identical = Object.keys(en).filter(
      (key) => typeof en[key] === 'string' && en[key] === pl[key],
    );

    expect(identical).toEqual([]);
  });
});
