import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let mockPathname: string | null = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// eslint-disable-next-line import/first
import { AskAiDock, isAdminRoute } from './AskAiDock';

/**
 * ADMIN OPERATIONS R1 — ALPHA FINISH. The reader Ask dock does not render inside
 * the Admin console, and nowhere else changes. The positive control renders a
 * reader route and finds the launcher, so an `AskAiDock` that rendered nothing
 * anywhere could not pass.
 */
const render = (pathname: string): string => {
  mockPathname = pathname;
  return renderToStaticMarkup(createElement(AskAiDock, { language: 'en' }));
};

describe('Ask dock — Admin console', () => {
  it.each(['/admin', '/admin/operations', '/admin/analytics/geography'])(
    '%s is an Admin route and renders no dock at all',
    (pathname) => {
      expect(isAdminRoute(pathname)).toBe(true);
      expect(render(pathname)).toBe('');
    },
  );

  it.each(['/', '/search', '/map', '/administrator-notes', '/admins', null])(
    '%s is not an Admin route',
    (pathname) => {
      expect(isAdminRoute(pathname)).toBe(false);
    },
  );

  it('POSITIVE CONTROL — a reader route still renders the floating launcher', () => {
    expect(render('/search')).toContain('data-ask="launcher"');
  });
});
