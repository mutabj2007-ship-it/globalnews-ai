import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accountSignInUrl } from '@/lib/api/accountLinks';

/*
  CTO R110 §6 — the mobile map's activation panel linked to "/account/sign-in?next=%2Fmap", which is
  not a route (404). It now uses the one sign-in entry, returning to the map.
*/
const code = readFileSync(join(__dirname, 'MobileSpatialShell.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('mobile map sign-in link', () => {
  it('is the one Google sign-in entry, returning to /map', () => {
    expect(code).toContain("signInHref={accountSignInUrl('/map')}");
    expect(accountSignInUrl('/map')).toBe('/api/auth/google?returnTo=%2Fmap');
  });
  it('never links to the non-existent /account/sign-in route', () => {
    expect(code).not.toContain('/account/sign-in');
  });
});
