import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';

/*
  ASK D0.1 PO ACCEPTANCE R1 · V-01 only — on /saved/updates/place the primary navigation marked Saved;
  it is a My updates child. (V-02, the Research draft, is held by the Master CTO until the backend
  COD/COG identity repair is demonstrated end to end; it is not in this candidate.)
*/
jest.mock('next/link', () => {
  const { createElement: h } = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: unknown; prefetch?: boolean }) => h('a', { href, ...rest }, children) };
});

// eslint-disable-next-line import/first
import { askPrimarySectionForPath } from '@/lib/askNavModel';
// eslint-disable-next-line import/first
import { AskPrimaryNav } from './AskPrimaryNav';

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
    const shell = readFileSync(join(__dirname, 'AskNavShell.tsx'), 'utf8');
    expect(shell).toContain('askPrimarySectionForPath(pathname)');
    expect(shell).not.toMatch(/pathname === '\/saved\/updates'|startsWith\('\/saved'\)/);
  });
});
