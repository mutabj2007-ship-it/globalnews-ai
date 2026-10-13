import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';

/*
  ASK D0.1 PO ACCEPTANCE R1 — the two defects the Product Owner found on Alpha 639785e.
  V-01: on /saved/updates/place the primary navigation marked Saved; it is a My updates child.
  V-02: "Research new changes" staged "What changed this week in Congo - Kinshasa", whose "this week"
        window Ask refuses without searching. The drafts pinned here are the ones measured EXECUTABLE
        (CURRENT_REPORTING) at Alpha backend 737c42f with the real router, COD/COG kept apart
        (record: RETRIEVAL-R1/ASK-D0-1-IMPLEMENTATION/po-acceptance-r1/).
*/
jest.mock('next/link', () => {
  const { createElement: h } = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: unknown; prefetch?: boolean }) => h('a', { href, ...rest }, children) };
});
const accountFetch = jest.fn();
jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: (...args: unknown[]) => accountFetch(...args) }));
const follow = jest.fn(async () => undefined);
jest.mock('@/components/home/useCountryFollows', () => ({
  useCountryFollows: () => ({ follows: [], maxFollows: 10, isLoading: false, pendingCountry: null, failedCountry: null, follow, unfollow: jest.fn() }),
}));

// eslint-disable-next-line import/first
import { askPrimarySectionForPath } from '@/lib/askNavModel';
// eslint-disable-next-line import/first
import { AskPrimaryNav } from '../ask-nav/AskPrimaryNav';
// eslint-disable-next-line import/first
import { ChoosePlace } from './ChoosePlace';
// eslint-disable-next-line import/first
import { placeResearchDraft } from '@/lib/ask/d01PlaceDraft';
// eslint-disable-next-line import/first
import { askDiscoverStrings } from '@/lib/ask/askDiscoverStrings';

const byData = (r: ReactTestRenderer, value: string) => r.root.findAll((n) => n.props['data-ask'] === value && typeof n.type === 'string');
const textOf = (node: ReactTestInstance): string => node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const draftOf = (r: ReactTestRenderer): string =>
  decodeURIComponent(String(byData(r, 'place-research')[0].props.href).replace(/^\/ask\?q=/, ''));

beforeEach(() => {
  accountFetch.mockReset();
  follow.mockClear();
});

describe('V-01 · the primary navigation section of each Ask route', () => {
  it.each([
    ['/saved/updates/place', 'updates'],
    ['/saved/updates', 'updates'],
    ['/saved', 'saved'],
    ['/saved/briefing', 'saved'],
    ['/ask', 'ask'],
    ['/ask/recent', null],
    ['/', null],
    ['/account/settings', null],
    [null, null],
  ])('%s → %s', (path, section) => {
    expect(askPrimarySectionForPath(path)).toBe(section);
  });

  it('on Choose a place, My updates is the current item and Saved is not (rendered)', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(AskPrimaryNav, { locale: 'en' as DisplayLocale, current: askPrimarySectionForPath('/saved/updates/place') }));
    });
    const items = r.root.findAll((n) => n.type === 'a' && typeof n.props['data-ask-nav-primary'] === 'string');
    expect(items.map((a) => [a.props.href, a.props['aria-current']])).toEqual([
      ['/ask', undefined],
      ['/saved/updates', 'page'],
      ['/saved', undefined],
    ]);
  });

  it('the shell derives its section from the nav model, not from its own path literals', () => {
    const shell = readFileSync(join(__dirname, '..', 'ask-nav', 'AskNavShell.tsx'), 'utf8');
    expect(shell).toContain('askPrimarySectionForPath(pathname)');
    expect(shell).not.toMatch(/pathname === '\/saved\/updates'|startsWith\('\/saved'\)/);
  });
});

async function choose(locale: DisplayLocale, pick: { search: string; label: string } | { region: string }): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(ChoosePlace, { locale }));
  });
  if ('region' in pick) {
    await act(async () => {
      byData(r, `place-${pick.region}`)[0].props.onClick();
    });
  } else {
    await act(async () => {
      byData(r, 'place-search')[0].props.onChange({ target: { value: pick.search } });
    });
    const button = byData(r, 'place-matches')[0]
      .findAll((n) => n.type === 'button')
      /* the row is the name plus a decorative "›" chevron */
      .find((b) => textOf(b).replace('›', '').trim() === pick.label);
    if (!button) throw new Error(`no match "${pick.label}" among: ${textOf(byData(r, 'place-matches')[0])}`);
    await act(async () => {
      button.props.onClick();
    });
  }
  return r;
}

describe('V-02 · D0.1 → Ask: the staged draft is one Ask executes, for the chosen place', () => {
  it.each([
    ['en', { search: 'kinshasa', label: 'Congo - Kinshasa' }, 'What are the latest developments in Congo - Kinshasa?'],
    ['en', { search: 'brazzaville', label: 'Congo - Brazzaville' }, 'What are the latest developments in Congo - Brazzaville?'],
    ['en', { search: 'rwanda', label: 'Rwanda' }, 'What are the latest developments in Rwanda?'],
    ['en', { region: 'region:east-africa' }, 'What are the latest developments in East Africa?'],
    ['en', { region: 'region:european-union' }, 'What are the latest developments in European Union?'],
    ['en', { region: 'region:middle-east' }, 'What are the latest developments in Middle East?'],
    ['pl', { search: 'demokratyczna', label: 'Demokratyczna Republika Konga' }, 'Demokratyczna Republika Konga: jakie są najnowsze wydarzenia?'],
    ['pl', { search: 'kongo', label: 'Kongo' }, 'Kongo: jakie są najnowsze wydarzenia?'],
    ['pl', { search: 'polska', label: 'Polska' }, 'Polska: jakie są najnowsze wydarzenia?'],
    ['pl', { region: 'region:european-union' }, 'Unia Europejska: jakie są najnowsze wydarzenia?'],
  ] as const)('%s %j → %s', async (locale, pick, expected) => {
    const r = await choose(locale as DisplayLocale, pick);
    expect(draftOf(r)).toBe(expected);
    /* a draft only: nothing is sent, followed or fetched by choosing and staging */
    expect(accountFetch).not.toHaveBeenCalled();
    expect(follow).not.toHaveBeenCalled();
  });

  it('the chosen country keeps its identity: COD and COG drafts differ and name their own country', async () => {
    const cod = draftOf(await choose('en' as DisplayLocale, { search: 'kinshasa', label: 'Congo - Kinshasa' }));
    const cog = draftOf(await choose('en' as DisplayLocale, { search: 'brazzaville', label: 'Congo - Brazzaville' }));
    expect(cod).not.toBe(cog);
    expect(cod).toContain('Kinshasa');
    expect(cog).toContain('Brazzaville');
  });

  it.each(DISPLAY_LOCALES.map((l) => [l]))('%s: no draft names an unsupported window or carries a label suffix', (locale) => {
    for (const label of ['East Africa', 'European Union · 27 member states', 'Rwanda']) {
      const draft = placeResearchDraft(locale, label);
      expect(draft).not.toMatch(/this week|w tym tygodniu|cette semaine|diese Woche|esta semana|هذا الأسبوع|·|27/);
      expect(draft).toContain(label.split(' · ')[0]);
    }
  });

  it("the welcome cue's own draft (separate accepted contract) is not changed by this correction", () => {
    expect(askDiscoverStrings('en').draftRegion).toBe('What changed this week in ');
  });
});
