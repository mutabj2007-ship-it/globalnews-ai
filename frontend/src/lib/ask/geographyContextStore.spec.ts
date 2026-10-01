import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapGeographyChipShown } from './effectiveContext';
import { askContextRefOf } from './askContextRef';
import {
  ASK_GEOGRAPHY_KEYS,
  clearGeographyContext,
  peekGeographyContextForTest,
  publishGeographyContext,
  resetGeographyContextStoreForTest,
  type AskGeographyContext,
} from './geographyContextStore';

const SRC = join(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf-8');
const code = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const store = read('lib/ask/geographyContextStore.ts');
const dock = read('components/ask/AskAiDock.tsx');
const owner = read('components/map/MapPageClient.tsx');

const ALGERIA: AskGeographyContext = { countryCode: 'DZ', displayName: 'Algeria' };

beforeEach(() => resetGeographyContextStoreForTest());

describe('MAP R1 item 7 — the geography contract is bounded', () => {
  it('carries an ISO code and a label, and nothing else', () => {
    expect([...ASK_GEOGRAPHY_KEYS]).toEqual(['countryCode', 'displayName']);
  });

  it('a caller that over-supplies cannot widen it', () => {
    const token = Symbol('t');
    publishGeographyContext(token, {
      ...ALGERIA,
      /* every one of these is named in the ruling as forbidden */
      articleId: 'a1',
      sourceId: 's1',
      evidenceId: 'e1',
      reportId: 'r1',
      clusterId: 'c1',
      priorAnswer: 'some earlier AI output',
    } as unknown as AskGeographyContext);

    const stored = peekGeographyContextForTest();
    expect(Object.keys(stored ?? {}).sort()).toEqual(['countryCode', 'displayName']);
  });

  it('the type itself names no identifier beyond the country code', () => {
    const body = code(store);
    for (const forbidden of ['articleId', 'sourceId', 'evidenceId', 'reportId', 'clusterId']) {
      expect(`${forbidden}: ${body.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });
});

describe('MAP R1 item 7 — lifecycle, kept apart from story context', () => {
  it('publishes, replaces and clears by owner', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    publishGeographyContext(a, ALGERIA);
    expect(peekGeographyContextForTest()).toEqual(ALGERIA);

    publishGeographyContext(b, { countryCode: 'KE', displayName: 'Kenya' });
    /* a later owner takes over; clearing the earlier one must not wipe it */
    clearGeographyContext(a);
    expect(peekGeographyContextForTest()).toEqual({ countryCode: 'KE', displayName: 'Kenya' });

    clearGeographyContext(b);
    expect(peekGeographyContextForTest()).toBeUndefined();
  });

  it('is its own module — it does not import or re-export the story store', () => {
    /*
      Comments stripped: the module EXPLAINS at length why it is separate from
      `storyContextStore`, and that explanation is the record of the ruling. An
      assertion that went red for the prose would be punishing the reason.
    */
    const body = code(store);
    expect(body).not.toContain('storyContextStore');
    expect(body).not.toContain('StoryContext');
  });

  it('the server snapshot is undefined, so no selection leaks across readers', () => {
    expect(code(store)).toMatch(/function getServerSnapshot\(\)[\s\S]*?return undefined;/);
  });
});

describe('MAP R1 item 7 — the Map publishes geography, never story context', () => {
  it('/map is still NOT a story-context publisher', () => {
    expect(code(owner)).not.toContain('usePublishStoryContext');
  });

  it('it publishes the bounded geography instead', () => {
    const body = code(owner);
    expect(body).toContain('usePublishGeographyContext');
    expect(body).toContain('countryCode: selectedCountry.iso2');
    expect(body).toMatch(/selectedCountry === null\s*\?\s*undefined/);
  });

  it('publishing spends nothing', () => {
    const body = code(owner);
    const at = body.indexOf('const askGeography');
    const block = body.slice(at, at + 600);
    expect(block).not.toMatch(/fetch|analyzeNews|performCountryRead/);
  });
});

describe('MAP R1 item 7 — the dock shows the scope without calling it a story', () => {
  it('it reads the geography live, keeping no copy', () => {
    const body = code(dock);
    expect(body).toContain('const geographyContext = useAskGeographyContext();');
    expect(body).not.toMatch(/useState<AskGeographyContext|useRef<AskGeographyContext/);
  });

  it('story context is the more specific anchor and wins', () => {
    /* UNIFIED INTELLIGENCE BINDING R2C — the chip and the request now derive from ONE reference
       (askContextRefOf, story first, never both); the precedence is asserted on that builder.
       The effective-context reader remains for surfaces that read a legacy response. */
    const body = code(dock);
    expect(body).toContain('const contextRef = askContextRefOf(storyContext, geographyContext);');
    expect(body).toContain("const showGeographyLabel = contextRef?.kind === 'GEOGRAPHY';");
    expect(
      askContextRefOf({ title: 'Story', articleId: 'gnews-1' }, { countryCode: 'POL' }),
    ).toEqual({ kind: 'STORY', articleId: 'gnews-1' });
    expect(askContextRefOf(undefined, { countryCode: 'POL' })).toEqual({
      kind: 'GEOGRAPHY',
      countryCode: 'POL',
    });
    const stores = { storyContextPresent: true, geographyContextPresent: true };
    expect(mapGeographyChipShown('draft', {}, stores)).toBe(false);
  });

  it('the chip has three distinct states, not two', () => {
    const body = code(dock);
    expect(body).toMatch(/showStoryLabel \? 'anchored' : showGeographyLabel \? 'geography' : 'generic'/);
  });

  it('the geography line is not the story line', () => {
    const body = code(dock);
    expect(body).toContain('t.askingAboutGeography');
    /* and it is not smuggled into the anchored wording */
    expect(body).not.toMatch(/contextChipAnchored[\s\S]{0,80}displayName/);
  });
});

describe('MAP R1 item 7 — nothing is smuggled through the story transport', () => {
  it('the country never becomes a StoryContext title', () => {
    const body = code(owner);
    expect(body).not.toMatch(/title:\s*selectedCountry\.name/);
    expect(body).not.toMatch(/title:\s*localisedCountryName/);
  });

  it('the dock still transports only the story context it was given', () => {
    /* R2C — ONE reference per Send: never the country disguised as a story, never both. */
    const body = code(dock);
    expect(body).toMatch(/void r2\s*\.submit\(asked, contextRef,/);
    expect(body).not.toMatch(/transportableContext/);
    const story = askContextRefOf({ title: 'Story', articleId: 'gnews-1' }, { countryCode: 'POL' });
    expect(Object.keys(story ?? {}).sort()).toEqual(['articleId', 'kind']);
  });
});
