/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE EXPLICIT COUNTRY READ, IN THE COMPONENT THE MODERN SHELL ACTUALLY USES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ownership is proven separately, in `modernCountryOwnership.spec.ts`: the
 * modern shell returns before `CountryPanel` is reachable, and a COUNTRY
 * selection lands on `EvidenceSelectionCard`. This file guards what was built
 * on that finding.
 *
 * Main's contract is landed unchanged and is the authority for the request, the
 * refusals, the state names and the cost class. What is asserted here is that
 * the modern surface USES it — and that the four things the ruling forbids
 * cannot happen.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  countryReadRequestFor,
  countryReadState,
  loadActionIsOffered,
  COUNTRY_READ_COST_CLASS,
} from './countryReadRequest';
import { classifyCountryReadFailure } from './countryReadAction';
import { countryReadPresentationFrom } from './countryReadPresentation';
import { CountryNewsApiError } from '@/lib/api/countryApi';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { MapSelection } from '@/lib/map/state/mapState';

const SRC = join(__dirname, '..', '..', '..');
const raw = (...p: string[]): string => readFileSync(join(SRC, ...p), 'utf-8');
const executable = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CLIENT = executable(raw('components', 'map', 'MapPageClient.tsx'));
const SHELL = executable(raw('components', 'map', 'shell', 'GlobalMapShell.tsx'));
const CARD = executable(raw('components', 'map', 'shell', 'EvidenceSelectionCard.tsx'));

const country = (id: string): MapSelection => ({ kind: 'COUNTRY', id }) as MapSelection;

/* ═══ PHASE D · THE ACTIVE GATE IS MECHANICAL ════════════════════════════ */

describe('D · the governed authority has a production caller — G-2', () => {
  it('EXPLICIT_RETRIEVAL_ACTION is now constructed in production code, not only in specs', () => {
    /*
      Main's §8 G-2 is a COUNT, and it was zero: *"`EXPLICIT_RETRIEVAL_ACTION`
      appears 5 times in `frontend/src` — once in the authority that defines it,
      3 times in accepted spec suites, and 0 times in production code."*

      The count is re-measured here rather than quoted, over shipped files only,
      so the gate cannot be satisfied by a test that merely mentions the token.
    */
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(join(SRC, dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(join(SRC, rel)).isDirectory()) out.push(...walk(rel));
        else if (/\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name)) out.push(rel);
      }
      return out;
    };

    const producers = walk('lib')
      .concat(walk('components'))
      .filter((rel) => rel !== 'lib/map/retrieval/countryRetrievalAuthority.ts')
      .filter((rel) => executable(raw(...rel.split('/'))).includes("'EXPLICIT_RETRIEVAL_ACTION'"));

    /*
      The request type is where the token is bound, and the contract is Main's.
      What matters for the gate is that a production module produces a request
      at all — asserted as "more than zero", and named so a reviewer can see
      which.
    */
    expect(`production modules binding the token: ${producers.length > 0}`)
      .toBe('production modules binding the token: true');
    expect(producers).toContain('lib/map/retrieval/countryReadRequest.ts');
  });

  it('the route calls the governed action, and never the client directly', () => {
    expect(CLIENT).toContain('countryReadRequestFor(');
    expect(CLIENT).toContain('performCountryRead(request)');
    /*
      PHASE D's OWN PROHIBITION: *"Do not bypass it with an ad-hoc click handler
      that merely happens to call the same function."* The handler builds the
      request and returns when it is refused; it does not reach past it.
    */
    expect(CLIENT).toContain('if (request === null) return;');
    expect(`route calls fetchCountryNews directly: ${CLIENT.includes('fetchCountryNews')}`)
      .toBe('route calls fetchCountryNews directly: false');
  });

  it('the cost class is the one Main derived, and the call site asserts it', () => {
    expect(COUNTRY_READ_COST_CLASS).toBe('API_ORIGIN_READ');
    const action = executable(raw('lib', 'map', 'retrieval', 'countryReadAction.ts'));
    expect(action).toContain("COUNTRY_READ_COST_CLASS !== 'API_ORIGIN_READ'");
    /* the browser calls OUR api and nothing else */
    const client = executable(raw('lib', 'api', 'countryApi.ts'));
    expect(client).toContain('${API_BASE_URL}/news/country/');
    for (const forbidden of ['openai', 'gnews.io', '/analysis/news']) {
      expect(`${forbidden}: ${client.toLowerCase().includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });
});

/* ═══ PHASE B · SELECTION IS SCOPE ONLY ══════════════════════════════════ */

describe('B · nothing but the reader may start a read', () => {
  it('the six ways of arriving at a country without choosing it all refuse', () => {
    const cases: ReadonlyArray<readonly [string, MapSelection | null, string | null]> = [
      ['no selection at all', null, 'KEN'],
      ['camera-derived country, no selection', null, 'CAF'],
      ['REGION selected', { kind: 'REGION', id: 'east-africa' } as MapSelection, 'KEN'],
      ['CITY selected', { kind: 'CITY', id: 'kigali' } as MapSelection, 'RWA'],
      ['selection names a different country', country('CAN'), 'KEN'],
      ['no iso3', country('KEN'), null],
    ];
    for (const [name, selection, iso3] of cases) {
      expect(`${name}: ${countryReadRequestFor(selection, iso3, null, 'en') === null}`)
        .toBe(`${name}: true`);
    }
  });

  it('and the one authorised shape builds exactly one request', () => {
    const request = countryReadRequestFor(country('KEN'), 'KEN', null, 'en');
    expect(request).toEqual({
      reason: 'EXPLICIT_RETRIEVAL_ACTION',
      iso3: 'KEN',
      category: null,
      language: 'en',
    });
  });

  it('the control is OFFERED only where a read is authorised', () => {
    /*
      The offer and the action share one predicate. `selected` at the route is
      `requestForCurrentSelection !== null` — the same function that guards the
      read — so a card can never show a control that the handler would refuse.
    */
    expect(CLIENT).toContain('selected: requestForCurrentSelection !== null');
    expect(countryReadState({ selected: false, isLoading: false, error: null, response: null }))
      .toBe('UNSELECTED');
    expect(loadActionIsOffered('UNSELECTED')).toBe(false);
    expect(loadActionIsOffered('LOADING')).toBe(false);
  });
});

/* ═══ PHASE E · THE FIVE STATES ARE NOT COLLAPSED ════════════════════════ */

describe('E · not loaded, loading, no coverage, failure and ready stay five things', () => {
  it('the state machine derives each one, in the panel’s own order', () => {
    const base = { selected: true, isLoading: false, error: null, response: null } as const;
    expect(countryReadState(base)).toBe('SELECTED_NOT_LOADED');
    expect(countryReadState({ ...base, isLoading: true })).toBe('LOADING');
    expect(countryReadState({ ...base, error: new Error('x') })).toBe('FAILED');
    expect(countryReadState({ ...base, response: { articles: [] } })).toBe('READY_NO_COVERAGE');
    expect(countryReadState({ ...base, response: { articles: [{}] } })).toBe('READY');
    /* the order is load-bearing: LOADING wins over a stale error */
    expect(countryReadState({ ...base, isLoading: true, error: new Error('x') })).toBe('LOADING');
  });

  it('EMPTY EVIDENCE IS A RESULT, NOT AN EMPTY STATE — and not "nothing happening"', () => {
    /*
      The distinction this whole round protects. `READY_NO_COVERAGE` keeps the
      provider status — which says WHO was asked — and carries no item stream,
      so the card cannot render an empty list as though it were an answer.
    */
    const presentation = countryReadPresentationFrom({
      state: 'READY_NO_COVERAGE',
      response: {
        articles: [],
        providerDisplayName: 'Test Provider',
        isStoredData: false,
      } as never,
      period: 'NOW' as never,
      language: 'en',
      now: Date.now(),
      onLoad: () => undefined,
    });
    expect(presentation.state).toBe('READY_NO_COVERAGE');
    expect(presentation.providerStatus).toBeDefined();
    expect(presentation.items).toBeUndefined();

    for (const locale of ['en', 'pl'] as const) {
      const copy = getDictionary(locale).map.spatial.card.countryRead;
      /* five distinct sentences, never one reused */
      const sentences = [copy.notLoaded, copy.loading, copy.noCoverage, copy.failed];
      expect(new Set(sentences).size).toBe(sentences.length);
      /* and the empty result never claims the world is quiet */
      for (const claim of ['nothing is happening', 'no news', 'nic się nie dzieje', 'brak wiadomości']) {
        expect(`${locale} noCoverage claims "${claim}": ${copy.noCoverage.toLowerCase().includes(claim)}`)
          .toBe(`${locale} noCoverage claims "${claim}": false`);
      }
    }
  });

  it('the card renders one statement per state, and no state falls through', () => {
    for (const state of ['SELECTED_NOT_LOADED', 'LOADING', 'READY_NO_COVERAGE', 'FAILED']) {
      expect(`${state} rendered: ${CARD.includes(state)}`).toBe(`${state} rendered: true`);
    }
    /* LOADING is announced; the failure is NOT an alert — see the card's note */
    expect(CARD).toContain("role: 'status' as const");
    expect(`the card raises role="alert": ${/role=["']alert["']/.test(CARD)}`)
      .toBe('the card raises role="alert": false');
  });
});

/* ═══ PHASE F · NO ENGINEERING TEXT CAN REACH A READER ═══════════════════ */

describe('F · raw exception, provider and backend text cannot reach the surface', () => {
  it('every failure class collapses to ONE governed sentence', () => {
    const classes = [
      classifyCountryReadFailure(new CountryNewsApiError('Backend responded with 502', 502)),
      classifyCountryReadFailure(new CountryNewsApiError('Failed to reach the GlobalNews AI backend')),
      classifyCountryReadFailure(Object.assign(new Error('aborted'), { name: 'AbortError' })),
      classifyCountryReadFailure('a thrown string'),
    ];
    expect(classes.map((c) => c.failureClass))
      .toEqual(['API_STATUS', 'UNREACHABLE', 'ABORTED', 'UNKNOWN']);

    /*
      ALL FOUR ARE ONE SENTENCE TO A READER. The classes exist for telemetry —
      §5.1: *"the distinction belongs in telemetry."*
    */
    const copy = getDictionary('en').map.spatial.card.countryRead;
    expect(copy.failed.length).toBeGreaterThan(0);
    for (const failure of classes) {
      expect(`${failure.failureClass} leaks its diagnostic into the copy: ${copy.failed.includes(failure.diagnostic)}`)
        .toBe(`${failure.failureClass} leaks its diagnostic into the copy: false`);
    }
  });

  it('THE DIAGNOSTIC HAS NO PATH TO THE CARD — structural, not a rule', () => {
    /*
      The strongest available form of this guarantee, and the reason the
      presentation type is shaped as it is: `CountryReadPresentation` carries a
      STATE and DATA BLOCKS and has no string field at all for a message. So
      there is no prop through which a diagnostic could travel, and the card
      could not render one even if a future caller wanted it to.

      This is the legacy panel's defect inverted. `CountryPanel` takes
      `error: string | null` and renders it verbatim — a pipe from whatever
      threw straight to the screen. The modern seam has no such pipe.
    */
    const presentation = executable(raw('lib', 'map', 'retrieval', 'countryReadPresentation.ts'));
    expect(`presentation carries a diagnostic: ${presentation.includes('diagnostic')}`)
      .toBe('presentation carries a diagnostic: false');
    expect(`presentation carries a message field: ${/readonly (message|error|detail)\??:/.test(presentation)}`)
      .toBe('presentation carries a message field: false');

    /* the shell forwards a state and an action, never a message */
    expect(SHELL).toContain('countryReadState={countryRead?.state}');
    expect(`shell forwards a diagnostic: ${SHELL.includes('diagnostic')}`)
      .toBe('shell forwards a diagnostic: false');

    /* and the card's failure branch reads the dictionary, nothing else */
    expect(CARD).toContain('labels.countryRead.failed');
    expect(`card reads a failure message prop: ${/failure[.\s]*(message|diagnostic)/.test(CARD)}`)
      .toBe('card reads a failure message prop: false');
  });

  it('the diagnostic IS kept — in the log, where it is useful', () => {
    /*
      Suppressing it would trade one defect for another: a reader who is told
      nothing and an engineer who can find out nothing. It goes to the console
      with its class and status, and nowhere near a prop.
    */
    expect(CLIENT).toContain("console.error('[country-read] failed'");
    expect(CLIENT).toContain('diagnostic: failure.diagnostic');
  });
});

/* ═══ PHASE H · COUNTRY AND CONFLICT DO NOT LEAK ═════════════════════════ */

describe('H · the country read is a Country action, and only that', () => {
  it('it is forwarded in the COUNTRY branch only — never to city, region or the summary panel', () => {
    /*
      The rail's chain decides this structurally: `ContextSummaryPanel` (which
      is where the Conflict D1 queue lands), `CityIdentityCard` and
      `RegionIdentityCard` are separate branches and none of them is handed the
      read. Asserted by which component names the props.
    */
    expect(CARD).toContain('onLoadCountry');
    for (const other of ['ContextSummaryPanel.tsx', 'CityIdentityCard.tsx', 'RegionIdentityCard.tsx']) {
      const source = executable(raw('components', 'map', 'shell', other));
      expect(`${other} takes a country read: ${source.includes('onLoadCountry') || source.includes('countryReadState')}`)
        .toBe(`${other} takes a country read: false`);
    }
  });

  it('the Conflict domain entry adds no country retrieval, and vice versa', () => {
    /*
      `/map?domain=conflict` binds a presentation queue and nothing else; the
      country read is authorised by the SELECTION, not by the domain. The two
      seams share no symbol, which is what keeps a Conflict reader from being
      offered a Country action as though it were one of theirs.
    */
    const bind = executable(raw('lib', 'map', 'd1', 'conflictDomainBind.ts'));
    for (const symbol of ['countryReadRequestFor', 'performCountryRead', 'fetchCountryNews']) {
      expect(`conflict bind reaches ${symbol}: ${bind.includes(symbol)}`)
        .toBe(`conflict bind reaches ${symbol}: false`);
    }
    const readAction = executable(raw('lib', 'map', 'retrieval', 'countryReadAction.ts'));
    for (const symbol of ['domain', 'CONFLICT']) {
      expect(`country read reaches ${symbol}: ${readAction.includes(symbol)}`)
        .toBe(`country read reaches ${symbol}: false`);
    }
  });
});

/* ═══ PHASE G · THE COPY SAYS WHAT THE ACTIONS DO ════════════════════════ */

describe('G · select is select, and load is load', () => {
  it('no tooltip promises that a click loads anything', () => {
    for (const locale of ['en', 'pl'] as const) {
      const t = getDictionary(locale).map;
      for (const key of ['tooltipLoadAction', 'tooltipRefreshAction'] as const) {
        const value = t[key];
        /* the false promises, both of them, in both languages */
        for (const promise of ['load live', 'refresh and explore', 'wczytać bieżące', 'odświeżyć']) {
          expect(`${locale}.${key} promises "${promise}": ${value.toLowerCase().includes(promise)}`)
            .toBe(`${locale}.${key} promises "${promise}": false`);
        }
      }
    }
  });

  it('the not-loaded slot names the selected country instead of asking for one', () => {
    /*
      Main §7.2: the legacy `!response` branch tells a reader to *"select one on
      the map"* in a slot only reachable once they have. The modern copy must
      not repeat it.
    */
    for (const locale of ['en', 'pl'] as const) {
      const { notLoaded } = getDictionary(locale).map.spatial.card.countryRead;
      for (const wrong of ['select one on the map', 'search for a country', 'wybierz kraj na mapie']) {
        expect(`${locale} notLoaded says "${wrong}": ${notLoaded.toLowerCase().includes(wrong)}`)
          .toBe(`${locale} notLoaded says "${wrong}": false`);
      }
    }
  });

  it('EN and PL both exist for every read string, and differ', () => {
    const en = getDictionary('en').map.spatial.card.countryRead;
    const pl = getDictionary('pl').map.spatial.card.countryRead;
    for (const key of ['heading', 'notLoaded', 'loading', 'noCoverage', 'failed', 'load', 'reload'] as const) {
      expect(`${key} present in both: ${en[key].length > 0 && pl[key].length > 0}`)
        .toBe(`${key} present in both: true`);
      expect(`${key} differs: ${en[key] !== pl[key]}`).toBe(`${key} differs: true`);
    }
  });
});
