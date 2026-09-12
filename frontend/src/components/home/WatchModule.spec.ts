import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R4 — WATCH. THE CONTRACTS THIS SURFACE IS NOT ALLOWED TO BREAK.
 *
 * Source-string assertions, the method this repository already uses for the
 * homepage lane: there is no jsdom and no React Testing Library here, and the
 * things that must never appear — a timer, a socket, a notification, a
 * truncated country code — are absences, which a source guard proves and a
 * render test cannot.
 *
 * Every negative guard runs against COMMENT-STRIPPED source, so the prose above
 * a rule can name the thing the rule forbids without defeating it.
 */
const read = (name: string): string => readFileSync(join(__dirname, name), 'utf-8');

const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const moduleSource = read('WatchModule.tsx');
const hookSource = read('useCountryFollows.ts');
const controlSource = read('CountryFollowControl.tsx');
const sectionSource = read('TodaySection.tsx');
const geoSource = read('TodayGeographicIntelligence.tsx');

const moduleCode = codeOnly(moduleSource);
const hookCode = codeOnly(hookSource);
const controlCode = codeOnly(controlSource);
const sectionCode = codeOnly(sectionSource);
const geoCode = codeOnly(geoSource);

const watchFiles = [
  ['WatchModule.tsx', moduleCode],
  ['useCountryFollows.ts', hookCode],
  ['CountryFollowControl.tsx', controlCode],
] as const;

describe('R4 Watch — this is NOT an alert engine, and the absences are the contract', () => {
  it('contains no timer, scheduler, socket, worker or background channel of any kind', () => {
    for (const forbidden of [
      'setInterval',
      'setTimeout',
      'requestAnimationFrame',
      'requestIdleCallback',
      'EventSource',
      'WebSocket',
      'visibilitychange',
      'addEventListener',
      'navigator.serviceWorker',
      'new Worker',
      'cron',
      'poll',
    ]) {
      for (const [name, code] of watchFiles) {
        expect([name, code.includes(forbidden)]).toEqual([name, false]);
      }
    }
  });

  it('raises no notification and asks for no permission to raise one', () => {
    for (const forbidden of ['Notification', 'requestPermission', 'showNotification', 'push']) {
      for (const [name, code] of watchFiles) {
        expect([name, code.includes(forbidden)]).toEqual([name, false]);
      }
    }
  });

  it('never calls POST /users/me/seen, so it makes no "since your last visit" claim', () => {
    for (const [name, code] of watchFiles) {
      expect([name, code.includes('/users/me/seen')]).toEqual([name, false]);
      expect([name, code.includes('lastSeen')]).toEqual([name, false]);
    }
    const strings = [...Object.values(getDictionary('en').today), ...Object.values(getDictionary('pl').today)]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(' ')
      .toLowerCase();
    expect(strings).not.toContain('since your last');
    expect(strings).not.toContain('od ostatniej');
  });

  it('mints no anonymous identifier and writes no local identity substitute', () => {
    for (const forbidden of [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'crypto.randomUUID',
      'anonymousId',
      'deviceId',
    ]) {
      for (const [name, code] of watchFiles) {
        expect([name, code.includes(forbidden)]).toEqual([name, false]);
      }
    }
  });

  it('uses none of the six information-state words and no forecast vocabulary', () => {
    const strings = [...Object.values(getDictionary('en').today), ...Object.values(getDictionary('pl').today)]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(' ')
      .toLowerCase();
    for (const word of [
      'developing',
      'new evidence',
      'contested',
      'significant change',
      'not re-analysed',
      'forecast',
      'predict',
      'alert',
      'prognoz',
    ]) {
      expect(strings).not.toContain(word);
    }
    for (const [name, code] of watchFiles) {
      expect([name, /DEVELOPING|NEW EVIDENCE|CONTESTED|SIGNIFICANT CHANGE|StateBadge/.test(code)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it('draws no chart primitive — Watch counts a retrieval, it does not plot one', () => {
    for (const primitive of ['<svg', 'Sparkline', 'TileGrid', 'chart', 'choropleth', 'topojson']) {
      expect(moduleCode).not.toContain(primitive);
    }
  });
});

describe('R4 Watch — one read on mount, one after a mutation the user performed', () => {
  it('reads the follow list through exactly one path, and mounts it with an empty dependency array', () => {
    // One declared path constant, and every request in the file built from it.
    expect(hookCode).toMatch(/const FOLLOWS_PATH = '\/follows\/countries'/);
    expect((hookCode.match(/accountFetch\(/g) ?? [])).toHaveLength(3);
    expect((hookCode.match(/async function read\(\)/g) ?? [])).toHaveLength(1);
    expect(hookCode).toMatch(/useEffect\(\(\) => \{\s*void read\(\);[\s\S]*?\}, \[\]\);/);
  });

  it('re-reads ONLY after a mutation, and never optimistically applies one that failed', () => {
    const mutate = hookCode.slice(hookCode.indexOf('async function mutate('));
    expect(mutate).toContain('await read();');
    // The failure path returns BEFORE the re-read and sets no follow state.
    expect(mutate).toMatch(/if \(!response\.ok\) \{[\s\S]*?setFailedCountry\(code\);[\s\S]*?return;/);
    expect(mutate).not.toMatch(/setFollows\(/);
  });

  it('is the ONE hook instance on the page — the surfaces that draw controls receive it', () => {
    expect((sectionCode.match(/useCountryFollows\(\)/g) ?? [])).toHaveLength(1);
    expect(moduleCode).not.toContain('useCountryFollows');
    expect(geoCode).not.toContain('useCountryFollows');
    // And neither presentational surface talks to the network itself.
    expect(moduleCode).not.toContain('accountFetch');
    expect(geoCode).not.toContain('accountFetch');
    expect(controlCode).not.toContain('accountFetch');
  });

  it('reuses the released authenticated helper rather than adding a second API client', () => {
    expect(hookCode).toMatch(/import \{ accountFetch \} from '@\/lib\/api\/accountFetch'/);
    expect(hookCode).not.toMatch(/newsApi|analysisApi|axios/);
    expect(hookCode).not.toMatch(/\bfetch\(/);
  });
});

describe('R4 Watch — four states, and every one of them is a result', () => {
  it('renders a statement while the list is still being read, never a skeleton', () => {
    expect(moduleCode).toMatch(/if \(isLoading\) \{/);
    expect(moduleCode).toContain('t.watchReading');
    expect(moduleCode).not.toMatch(/skeleton|Skeleton|placeholder|animate-pulse/);
  });

  it('keeps the module present for an anonymous visitor and offers the RELEASED sign-in path', () => {
    expect(moduleCode).toMatch(/if \(follows === null\) \{/);
    expect(moduleCode).toContain('t.watchAnonymous');
    // The same real navigation AccountControl uses: consent happens off this origin.
    /*
      M-ALPHA-AUTH — the CONTRACT changed, so this assertion was updated rather
      than deleted. It previously required `${API_BASE_URL}/auth/google`, a
      navigation to the BACKEND's own origin, which is exactly what made the
      session cookie cross-site and left every signed-in user looking signed
      out. CTO requirement 8 moves all five sign-in entry points onto the shared
      first-party helper.

      What this test protects is unchanged: this is still THE SAME real
      navigation AccountControl uses — enforced now by a shared import rather
      than by two files independently writing the same expression — and consent
      still happens off this origin.
    */
    expect(moduleCode).toMatch(/href=\{accountSignInUrl\(/);
    expect(moduleCode).not.toContain('API_BASE_URL');
    expect(moduleCode).toContain('t.watchSignIn');
  });

  it('separates "no list available" from "signed in with nothing followed"', () => {
    expect(moduleCode).toMatch(/if \(follows\.length === 0\) \{/);
    expect(moduleCode).toContain('t.watchNoFollows');
    // An invitation, not the anonymous copy — telling a signed-in reader to
    // sign in would be the one unambiguous bug in this state machine.
    expect(getDictionary('en').today.watchNoFollows).not.toContain('Sign in');
  });

  it('fabricates no default follow set and ranks nothing by popularity or address', () => {
    for (const forbidden of ['DEFAULT_FOLLOWS', 'suggested', 'popular', 'geolocation', 'ipAddress']) {
      expect(moduleCode).not.toContain(forbidden);
    }
  });
});

describe('R4 Watch — zero is DRAWN, and it says what we did', () => {
  it('renders every followed country whether or not this retrieval reached it', () => {
    // The roster is built from `follows`, never from the countries present in
    // the retrieval — so a country with no records cannot fall out of it.
    expect(moduleCode).toMatch(/const rows: WatchRow\[\] = follows/);
    expect(moduleCode).toMatch(/count: counted\?\.count \?\? 0/);
    expect(moduleCode).not.toMatch(/\.filter\(\(row\) => row\.count > 0\)/);
  });

  it('carries the EXACT approved zero wording, and never says nothing happened', () => {
    expect(getDictionary('en').today.watchZeroRecords).toBe('Nothing retrieved for this country today.');
    expect(moduleCode).toMatch(/\{row\.count === 0 && \(/);
    expect(moduleCode).toContain('t.watchZeroRecords');

    const strings = [...Object.values(getDictionary('en').today), ...Object.values(getDictionary('pl').today)]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(' ')
      .toLowerCase();
    for (const claim of ['nothing happened', 'nic się nie wydarzy', 'quiet', 'no activity', 'low activity']) {
      expect(strings).not.toContain(claim);
    }
  });

  it('draws the count itself for a zero row rather than hiding the number', () => {
    expect(moduleCode).toMatch(/\{row\.count\}/);
  });

  it('states the unresolved records instead of absorbing them into a followed country', () => {
    expect(moduleCode).toMatch(/\{unresolvedCount > 0 && \(/);
    expect(moduleCode).toContain('t.watchUnresolvedNote');
    // Unresolved records can never enter the watched set: the filter demands a
    // country code, and matching is by exact membership, never by inference.
    expect(moduleCode).toMatch(
      /record\.countryCode !== undefined && followedIso2\.has\(record\.countryCode\)/,
    );
    expect(moduleCode).not.toMatch(/sourceName\s*===|startsWith\(|includes\(record\.summary/);
  });

  it('says the retrieval reached none of your countries, as a statement about US', () => {
    expect(moduleCode).toMatch(/\{watched\.length === 0 && \(/);
    expect(getDictionary('en').today.watchNothingRetrieved).toContain('about our retrieval');
  });
});

describe('R4 Watch — ISO-3 in, ISO-2 out, through the one canonical resolver', () => {
  it('converts ONLY through findCountryByIso3 / findCountryByIso2', () => {
    expect(moduleCode).toMatch(/import \{ findCountryByIso3.*\} from '@globalnews-ai\/shared'/);
    expect(moduleCode).toMatch(/const meta = findCountryByIso3\(iso3\)/);
    expect(geoCode).toMatch(/findCountryByIso2\(row\.countryCode\)\?\.iso3/);
    expect(sectionCode).toMatch(/findCountryByIso3\(countryCode\)\?\.iso2/);
  });

  it('never truncates a code, and builds no second mapping table', () => {
    for (const [name, code] of [...watchFiles, ['TodaySection.tsx', sectionCode], ['TodayGeographicIntelligence.tsx', geoCode]] as const) {
      expect([name, /slice\(0,\s*2\)|substring\(0,\s*2\)|substr\(0,\s*2\)/.test(code)]).toEqual([name, false]);
      expect([name, /ISO3_TO_ISO2|iso3ToIso2|COUNTRY_CODE_MAP/.test(code)]).toEqual([name, false]);
    }
  });

  it('resolves display names through the ONE canonical resolver, never a second implementation', () => {
    expect(moduleCode).toMatch(/import \{ getCountryDisplayName \} from '@\/lib\/countryDisplayName'/);
    expect(moduleCode).toMatch(/getCountryDisplayName\(meta\.iso2, language, meta\.name\)/);
    expect(moduleCode).not.toContain('Intl.DisplayNames');
  });

  it('orders the roster locale-independently, so two languages see the same order', () => {
    expect(moduleCode).toMatch(/b\.count - a\.count \|\| a\.canonicalName\.localeCompare\(b\.canonicalName, 'en'\)/);
  });
});

describe('R4 Watch — one filter owner, and it is not Watch', () => {
  it('declares no selection state of its own', () => {
    expect(moduleCode).not.toMatch(/useState|useReducer|useRef/);
    expect(controlCode).not.toMatch(/useState|useReducer|useRef/);
    expect(moduleCode).toMatch(/selectedCountry: string \| null;/);
    expect(moduleCode).toMatch(/onSelectCountry: \(countryCode: string \| null\) => void;/);
  });

  it('keeps TodaySection the single owner, holding exactly one piece of state', () => {
    expect((sectionCode.match(/useState/g) ?? [])).toHaveLength(2);
    expect(sectionCode).toMatch(
      /const \[selectedCountry, setSelectedCountry\] = useState<string \| null>\(null\)/,
    );
    expect(sectionCode).not.toMatch(/useEffect|setInterval|setTimeout/);
  });

  it('lists every followed country regardless of the active filter', () => {
    const roster = moduleCode.slice(moduleCode.indexOf('const rows: WatchRow[]'), moduleCode.indexOf('</ul>'));
    expect(roster).not.toMatch(/selectedCountry === null \? follows|follows\.filter/);
  });

  it('clears the filter when the country it is pinned to is unfollowed', () => {
    expect(sectionCode).toMatch(/async function unfollowCountry\(countryCode: string\): Promise<void> \{/);
    expect(sectionCode).toMatch(
      /const wasFiltered = findCountryByIso3\(countryCode\)\?\.iso2 === selectedCountry;/,
    );
    expect(sectionCode).toMatch(/await watch\.unfollow\(countryCode\);/);
    expect(sectionCode).toMatch(/if \(wasFiltered\) setSelectedCountry\(null\);/);
    // The check is captured BEFORE the mutation, or the row would already be gone.
    expect(sectionCode.indexOf('const wasFiltered')).toBeLessThan(
      sectionCode.indexOf('await watch.unfollow(countryCode);'),
    );
  });
});

describe('R4 Watch — controls are real, reachable, and never dead', () => {
  it('is a real button with aria-pressed, a 44px target and a visible focus treatment', () => {
    expect(controlCode).toMatch(/<button\s+type="button"/);
    expect(controlCode).toMatch(/aria-pressed=\{isFollowed\}/);
    expect(controlCode).toMatch(/min-h-\[44px\]/);
    expect(controlCode).toMatch(/focus-visible:outline-gn-focus/);
  });

  it('puts nothing behind hover, because the homepage focus chain never fires on touch', () => {
    expect(controlCode).not.toMatch(/onMouseEnter|onMouseOver|onPointerEnter|group-hover:inline/);
    // The destructive word is revealed by FOCUS, and the accessible name always
    // states the action rather than the current state.
    expect(controlCode).toMatch(/hidden group-focus-visible:inline/);
    expect(controlCode).toMatch(/aria-label=\{actionLabel\}/);
    expect(controlCode).toMatch(/isFollowed[\s\S]*?t\.watchUnfollowAria[\s\S]*?t\.watchFollowAria/);
  });

  it('renders NO control at all where pressing it could not work', () => {
    expect(geoCode).toMatch(
      /const showControl =\s*followedCodes !== null && followCode !== undefined && \(isFollowed \|\| !atFollowLimit\);/,
    );
    expect(geoCode).toMatch(/\{showControl && \(/);
    // Never a disabled stand-in.
    expect(geoCode).not.toMatch(/disabled=/);
    expect(controlCode).not.toMatch(/disabled=/);
  });

  it('reports a refusal on the row that refused, and never blanks another row', () => {
    expect(controlCode).toMatch(/\{hasFailed && \(/);
    expect(controlCode).toContain('t.watchFailed');
    expect(controlCode).toMatch(/\{isPending \? \(/);
    expect(geoCode).toMatch(/isPending=\{pendingCountry === followCode\}/);
    expect(geoCode).toMatch(/hasFailed=\{failedCountry === followCode\}/);
  });
});

describe('R4 Watch — the ceiling comes from the server, never from a constant here', () => {
  it('reads maxFollows off the response and hard-codes no number', () => {
    expect(hookCode).toMatch(/setMaxFollows\(data\.maxFollows\)/);
    for (const [name, code] of [...watchFiles, ['TodaySection.tsx', sectionCode]] as const) {
      expect([name, /\b50\b/.test(code)]).toEqual([name, false]);
      expect([name, code.includes('MAX_FOLLOWED_COUNTRIES')]).toEqual([name, false]);
    }
    expect(sectionCode).toMatch(/watch\.follows\.length >= watch\.maxFollows/);
  });

  it('states the ceiling as a bound, with no tier, plan or upgrade language anywhere', () => {
    const strings = [...Object.values(getDictionary('en').today), ...Object.values(getDictionary('pl').today)]
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .join(' ')
      .toLowerCase();
    for (const word of ['upgrade', 'premium', ' pro ', 'subscription', 'plan', 'abonament']) {
      expect(strings).not.toContain(word);
    }
    expect(moduleCode).toContain('t.watchAtLimit');
  });
});

describe('R4 Watch — it reuses what R2 released and forks nothing', () => {
  it('renders the SAME TodayCard, and adds no second card or analysis link builder', () => {
    expect(moduleCode).toMatch(/import \{ TodayCard \} from '@\/components\/home\/TodayCard'/);
    expect(moduleCode).toMatch(/<TodayCard key=\{record\.url\} record=\{record\} language=\{language\} \/>/);
    expect(moduleCode).not.toMatch(/URLSearchParams|articleId|\/search\?/);
    expect(moduleCode).not.toMatch(/analysisApi|analyzeNews/);
    // Identity is the URL. `id` is a 32-bit hash and two providers carrying one
    // story produce two ids for one row.
    expect(moduleCode).not.toMatch(/key=\{record\.id\}/);
  });

  it('carries its own R-34 contract, in the fixed order, over the same retrieval', () => {
    const contract = moduleCode.slice(moduleCode.indexOf('const contract = ['), moduleCode.indexOf("].join(' · ')"));
    let last = -1;
    for (const field of [
      'contractMetricLabel',
      'contractUnitLabel',
      'contractGeographyLabel',
      'contractPeriodLabel',
      'contractBasisLabel',
      'contractUpdatedLabel',
      'contractCoverageLabel',
    ]) {
      const index = contract.indexOf(field);
      expect(index).toBeGreaterThan(last);
      last = index;
    }
    // ABSOLUTE period, and coverage stated rather than omitted.
    expect(moduleCode).toMatch(/windowStart\.slice\(0, 10\)/);
    expect(moduleCode).toMatch(/00:00–24:00 UTC/);
    expect(moduleCode).not.toMatch(/recent|Recent|last 24|past/);
    expect(getDictionary('en').today.contractCoverageValue).toBe('not assessed');
  });

  it('adds no route, no backend call and no second retrieval', () => {
    for (const [name, code] of watchFiles) {
      expect([name, /getHomeFeed|fetchTopHeadlines|fetchCountryNews/.test(code)]).toEqual([name, false]);
    }
    expect(moduleCode).not.toMatch(/\bfetch\(/);
  });
});

describe('R4 Watch — localization', () => {
  it('takes every string from the dictionary; no English chrome is hardcoded', () => {
    expect(moduleCode).toMatch(/getDictionary\(language\)\.today/);
    expect(controlCode).toMatch(/getDictionary\(language\)\.today/);
    expect(moduleCode).not.toMatch(/Nothing retrieved|Sign in|Follow a country/);
    expect(controlCode).not.toMatch(/'Follow'|'Following'|'Unfollow'/);
  });

  it('carries every Watch key in BOTH dictionaries, non-empty and distinct', () => {
    const en = getDictionary('en').today as Record<string, unknown>;
    const pl = getDictionary('pl').today as Record<string, unknown>;
    const watchKeys = Object.keys(en).filter((key) => key.startsWith('watch'));
    expect(watchKeys.length).toBeGreaterThanOrEqual(18);
    for (const key of watchKeys) {
      const enValue = en[key];
      const plValue = pl[key];
      if (typeof enValue === 'string') {
        expect(typeof plValue).toBe('string');
        expect((plValue as string).length).toBeGreaterThan(0);
        expect(plValue).not.toBe(enValue);
      }
      if (Array.isArray(enValue)) {
        expect(plValue).toHaveLength(3);
      }
    }
  });

  it('counts through the shared Polish grammar helper, not a second rule', () => {
    expect(moduleCode).toMatch(/import \{ pluralWithForms \} from '@\/lib\/i18n\/pluralize'/);
    expect(moduleCode).toMatch(/pluralWithForms\(rows\.length, language, t\.watchFollowedForms\)/);
    expect(moduleCode).not.toMatch(/count === 1 \?|endsWith\('s'\)/);
    expect(getDictionary('pl').today.watchFollowedForms).toHaveLength(3);
  });

  it('never translates provider content — the card it renders is the released one', () => {
    expect(moduleCode).not.toMatch(/translate\(record|t\[record\.title\]/);
  });
});
