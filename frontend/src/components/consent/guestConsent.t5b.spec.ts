import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DISPLAY_LOCALES } from '@globalnews-ai/shared';
import {
  CONSENT_KEY_STATES,
  CONSENT_STRINGS,
  GUEST_POLICY_BOUNDS,
  LEGAL_COPY_PENDING_APPROVAL,
  fillConsent,
} from '@/lib/consent/consentStrings';
import {
  GUEST_FORGET_PATH,
  GUEST_STATUS_PATH,
  createGuestPrivacyApi,
  type GuestPrivacyApi,
  type GuestPrivacyStatus,
} from '@/lib/api/guestPrivacyApi';
import { namespace } from '@/qualification/i18n/catalogueCoverage';
import { SURFACE_NAMESPACES } from '@/qualification/i18n/surfaceCoverage';
import { resolveSurfaceLocale } from '@/lib/i18n/surfaceLocale';
import { footerLinkGroups } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { GuestDataSection } from './GuestDataSection';
import { GuestForgetControl } from './GuestForgetControl';
import { guestQuotaText } from './GuestQuotaBadge';

/**
 * STAGE 2 · T5 PART B — pre-login guest-data notices, the guest privacy client, and the
 * "delete my guest data now" control (docs/convergence/stage2/T5-CONSENT-GUEST-TRIAL.md §Part B).
 */

const SRC = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

function leaves(tree: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix === '' ? k : `${prefix}.${k}`;
    if (typeof v === 'string') out.set(path, v);
    else for (const [p, s] of leaves(v, path)) out.set(p, s);
  }
  return out;
}

/* ── the catalogue ───────────────────────────────────────────────────────── */

describe('consent catalogue (en/pl drafts, PENDING_PO_LEGAL_APPROVAL)', () => {
  const en = leaves(CONSENT_STRINGS.en);
  const pl = leaves(CONSENT_STRINGS.pl);

  it('en and pl carry the same keys, every one non-empty and marked PENDING_PO_LEGAL_APPROVAL', () => {
    expect([...pl.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [, v] of [...en, ...pl]) expect(v.trim().length).toBeGreaterThan(0);
    expect(Object.keys(CONSENT_KEY_STATES).sort()).toEqual([...en.keys()].sort());
    for (const state of Object.values(CONSENT_KEY_STATES)) {
      expect(state).toBe('PENDING_PO_LEGAL_APPROVAL');
    }
  });

  it('placeholders match between en and pl, and no guest number is a literal', () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [k, v] of en) expect(names(pl.get(k)!)).toEqual(names(v));
    for (const [k, v] of [...en, ...pl]) {
      if (k.startsWith('footer.')) continue;
      /* 3 answers / 7 days / 24 h / 72 h / 168 h must come from status (or the code bounds). */
      expect(v).not.toMatch(/\b(3|7|24|72|168)\b/);
    }
  });

  it('there is no consent banner wording: no "Accept all" / "Reject all" anywhere', () => {
    for (const v of [...en.values(), ...pl.values()]) {
      expect(v).not.toMatch(/accept all|reject all|akceptuj wszystk|odrzuć wszystk/i);
    }
  });

  it('fr/de/es/pt/ar are NOT authored (no machine translation): every key is a T2 gap there', () => {
    const ns = namespace('consent');
    expect(ns.gaps('en')).toEqual([]);
    expect(ns.gaps('pl')).toEqual([]);
    for (const locale of DISPLAY_LOCALES.filter((l) => l !== 'en' && l !== 'pl')) {
      expect([...ns.gaps(locale)].sort()).toEqual([...en.keys()].sort());
    }
  });

  it('the Privacy and Cookies surfaces use `consent`, render en/pl, and fall back (declared) elsewhere', () => {
    for (const surface of ['privacy', 'cookies'] as const) {
      expect(SURFACE_NAMESPACES[surface]).toContain('consent');
      expect(resolveSurfaceLocale(surface, 'pl').effective).toBe('pl');
      for (const locale of ['fr', 'de', 'es', 'pt', 'ar'] as const) {
        expect(resolveSurfaceLocale(surface, locale).effective).toBe('en');
      }
    }
  });

  it('fillConsent fills known placeholders and leaves unknown ones visible', () => {
    expect(fillConsent('{a} of {b} {c}', { a: 1, b: 3 })).toBe('1 of 3 {c}');
  });

  it('every changed Privacy sentence is listed as PENDING_PO_LEGAL_APPROVAL and marked in source', () => {
    expect(LEGAL_COPY_PENDING_APPROVAL.length).toBeGreaterThanOrEqual(4);
    for (const entry of LEGAL_COPY_PENDING_APPROVAL) {
      expect(entry.state).toBe('PENDING_PO_LEGAL_APPROVAL');
    }
    for (const file of ['lib/i18n/dictionaries/en.ts', 'lib/i18n/dictionaries/pl.ts']) {
      expect((read(file).match(/T5 Part B — PENDING_PO_LEGAL_APPROVAL/g) ?? []).length).toBe(4);
    }
  });
});

/* ── the Privacy Notice text (D2 / D6 / D8) ─────────────────────────────── */

describe('Privacy Notice retention statements are truthful about RETENTION_SWEEP_ENABLED', () => {
  const body = (lang: 'en' | 'pl', index: number) =>
    getDictionary(lang).privacyPage.sections[index].body;
  const sections = getDictionary('en').privacyPage.sections;
  const idx = (heading: string) => sections.findIndex((s) => s.heading === heading);

  it('separates the always-on guest clean-up from the periods that need the scheduled clean-up', () => {
    const en = body('en', idx('How long information is kept'));
    expect(en).toMatch(/guest clean-up that always runs/);
    expect(en).toMatch(/switched off unless we turn it on/);
    expect(en).toMatch(/not deleted automatically when the period ends/);
    /* The four RETENTION_SWEEP_ENABLED categories come AFTER the qualifier. */
    const qualifier = en.indexOf('separate scheduled clean-up');
    for (const item of ['12 months', '24 months', '90 days', 'about a week']) {
      expect(en.indexOf(item)).toBeGreaterThan(qualifier);
    }
    const pl = body('pl', idx('How long information is kept'));
    expect(pl).toMatch(/wyłączone, dopóki nie włączymy/);
  });

  it('states several guest conversations, the claim/plain sign-in rule and the delete action', () => {
    const en = body('en', idx('Using Ask without an account'));
    expect(en).not.toMatch(/as one guest conversation/);
    expect(en).toMatch(/moves all guest conversations from this browser/);
    expect(en).toMatch(/signing in any other way moves none/);
    expect(body('en', idx('Your choices'))).toMatch(/delete your guest conversations/);
  });
});

/* ── the client ─────────────────────────────────────────────────────────── */

describe('guestPrivacyApi', () => {
  type Seen = { path: string; options: Record<string, unknown> };
  const make = (answer: () => Promise<Response>) => {
    const seen: Seen[] = [];
    const fetcher = jest.fn(async (path: string, options: Record<string, unknown> = {}) => {
      seen.push({ path, options });
      return answer();
    });
    return { api: createGuestPrivacyApi(fetcher as never), seen };
  };
  const res = (status: number, body: unknown) =>
    ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;

  it('status is one GET; forget is a POST with a JSON body and X-Requested-With', async () => {
    const { api, seen } = make(async () => res(200, { forgotten: true, deleted: true }));
    await api.status();
    expect(seen[0]).toEqual({ path: GUEST_STATUS_PATH, options: { method: 'GET' } });
    expect(await api.forget()).toEqual({ ok: true, value: { forgotten: true, deleted: true } });
    expect(seen[1]).toEqual({
      path: GUEST_FORGET_PATH,
      options: { method: 'POST', body: {}, headers: { 'X-Requested-With': 'globalnews-ask' } },
    });
  });

  it('404 is UNAVAILABLE, a typed refusal keeps its code, a thrown fetch is NETWORK', async () => {
    expect(await make(async () => res(404, {})).api.forget()).toMatchObject({
      ok: false,
      reason: 'UNAVAILABLE',
    });
    expect(
      await make(async () => res(409, { code: 'GUEST_ANSWER_IN_PROGRESS' })).api.forget(),
    ).toEqual({ ok: false, reason: 'REFUSED', status: 409, code: 'GUEST_ANSWER_IN_PROGRESS' });
    expect(
      await make(async () => {
        throw new Error('offline');
      }).api.status(),
    ).toEqual({ ok: false, reason: 'NETWORK' });
  });
});

/* ── the components ─────────────────────────────────────────────────────── */

const settle = () => new Promise((r) => setTimeout(r, 10));
const text = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());
const byConsent = (r: ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props['data-consent'] === id && typeof n.type === 'string');

const POLICY = { allowance: 3, sessionLifetimeH: 48, purgeGraceH: 6, sweepIntervalS: 900 };
const ACTIVE: GuestPrivacyStatus = {
  signedIn: false,
  available: true,
  policy: POLICY,
  session: { expiresAt: '2026-10-06T12:00:00.000Z', purgeAfter: '2026-10-06T18:00:00.000Z' },
  allowance: 3,
  remaining: 2,
  committed: 1,
  reserved: 0,
  state: 'OPEN',
  cooldownUntil: null,
};

function fakeApi(
  status: Awaited<ReturnType<GuestPrivacyApi['status']>>,
  forget: Awaited<ReturnType<GuestPrivacyApi['forget']>> = {
    ok: true,
    value: { forgotten: true, deleted: true },
  },
) {
  return { status: jest.fn(async () => status), forget: jest.fn(async () => forget) };
}

async function renderSection(
  api: ReturnType<typeof fakeApi>,
  locale: 'en' | 'pl' = 'en',
): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(createElement(GuestDataSection, { locale, api }));
    await settle();
  });
  return r;
}

describe('GuestDataSection', () => {
  it('server render / before status: the hard code bounds, worded "at most / within"', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        createElement(GuestDataSection, {
          locale: 'en',
          api: { status: () => new Promise<never>(() => undefined), forget: jest.fn() },
        }),
      );
    });
    const t = text(r);
    expect(t).toContain(`at most ${GUEST_POLICY_BOUNDS.sessionLifetimeH / 24} days`);
    expect(t).toContain(`within about ${GUEST_POLICY_BOUNDS.purgeGraceH} hours`);
    expect(t).toContain(`get ${GUEST_POLICY_BOUNDS.allowance} answers`);
    expect(byConsent(r, 'guest-panel-loading')).toHaveLength(1);
    expect(t).not.toMatch(/accept all/i);
  });

  it('a live guest: configured policy, its dates, the quota badge and the delete action — one read', async () => {
    const api = fakeApi({ ok: true, value: ACTIVE });
    const r = await renderSection(api);
    expect(api.status).toHaveBeenCalledTimes(1);
    const t = text(r);
    expect(t).toContain('at most 2 days');
    expect(t).toContain('within about 6 hours');
    expect(t).toContain('moves all guest conversations from this browser');
    expect(t).toContain('Signing in any other way moves nothing');
    expect(byConsent(r, 'guest-panel-active')).toHaveLength(1);
    expect(byConsent(r, 'guest-quota')[0].children.join('')).toBe('2 of 3 guest answers left');
    expect(byConsent(r, 'guest-forget-action')).toHaveLength(1);
    expect(api.forget).not.toHaveBeenCalled();
  });

  it('delete: confirm step, ONE forget call, then the done message and no session', async () => {
    const api = fakeApi({ ok: true, value: ACTIVE });
    const r = await renderSection(api);
    await act(async () => byConsent(r, 'guest-forget-action')[0].props.onClick());
    expect(api.forget).not.toHaveBeenCalled();
    await act(async () => {
      byConsent(r, 'guest-forget-confirm')[0].props.onClick();
      await settle();
    });
    expect(api.forget).toHaveBeenCalledTimes(1);
    expect(byConsent(r, 'guest-panel-none')).toHaveLength(1);
    expect(byConsent(r, 'guest-forget-result')[0].children.join('')).toBe(
      CONSENT_STRINGS.en.forget.done,
    );
    expect(byConsent(r, 'guest-forget-action')).toHaveLength(0);
    expect(api.status).toHaveBeenCalledTimes(1);
  });

  it('no guest session: the "none" panel, no delete action; Polish renders Polish', async () => {
    const api = fakeApi({ ok: true, value: { ...ACTIVE, session: null } });
    const r = await renderSection(api, 'pl');
    expect(byConsent(r, 'guest-panel-none')).toHaveLength(1);
    expect(byConsent(r, 'guest-forget-action')).toHaveLength(0);
    expect(text(r)).toContain('w ciągu około 6 godzin');
  });

  it('signed in: no guest data and no controls; Ask V2 off (404): unavailable, bounds kept', async () => {
    const signed = await renderSection(
      fakeApi({ ok: true, value: { signedIn: true, available: false } }),
    );
    expect(byConsent(signed, 'guest-panel-signed-in')).toHaveLength(1);
    expect(byConsent(signed, 'guest-forget-action')).toHaveLength(0);
    const off = await renderSection(fakeApi({ ok: false, reason: 'UNAVAILABLE', status: 404 }));
    expect(byConsent(off, 'guest-panel-unavailable')).toHaveLength(1);
    expect(text(off)).toContain('at most 7 days');
  });
});

describe('GuestForgetControl (reusable by the Ask composer, patch P-1)', () => {
  it.each([
    [{ ok: false, reason: 'REFUSED', status: 409, code: 'GUEST_ANSWER_IN_PROGRESS' }, 'busy'],
    [{ ok: false, reason: 'NETWORK' }, 'failed'],
    [{ ok: true, value: { forgotten: true, deleted: false } }, 'nothing'],
  ] as const)('outcome %j → %s', async (outcome, phase) => {
    const api = { forget: jest.fn(async () => outcome) };
    let r!: ReactTestRenderer;
    act(() => {
      r = create(createElement(GuestForgetControl, { locale: 'en', api: api as never }));
    });
    await act(async () => byConsent(r, 'guest-forget-action')[0].props.onClick());
    await act(async () => {
      byConsent(r, 'guest-forget-confirm')[0].props.onClick();
      await settle();
    });
    expect(byConsent(r, 'guest-forget')[0].props['data-phase']).toBe(phase);
    expect(byConsent(r, 'guest-forget-result')[0].children.join('')).toBe(
      CONSENT_STRINGS.en.forget[phase],
    );
  });
});

describe('guestQuotaText', () => {
  it('mirrors status only', () => {
    expect(guestQuotaText(ACTIVE, 'en')).toBe('2 of 3 guest answers left');
    expect(guestQuotaText({ ...ACTIVE, remaining: 0, state: 'EXHAUSTED' }, 'en')).toBe(
      'All 3 guest answers used',
    );
    expect(
      guestQuotaText({ ...ACTIVE, state: 'COOLDOWN', cooldownUntil: 'X' }, 'pl', (s) => `<${s}>`),
    ).toBe('Pytania gościa są wstrzymane do <X>');
    expect(guestQuotaText({ ...ACTIVE, session: null }, 'en')).toBeNull();
    expect(guestQuotaText({ signedIn: true, available: false }, 'en')).toBeNull();
  });
});

/* ── mount points (non-protected) ───────────────────────────────────────── */

describe('mount points', () => {
  it('the Footer links /cookies, labelled from the consent catalogue (en/pl)', () => {
    const links = footerLinkGroups.flatMap((g) => g.links);
    expect(links.map((l) => l.href)).toContain('/cookies');
    expect(read('components/layout/Footer.tsx')).toMatch(
      /consentFooterLinkLabels\(language === 'pl' \? 'pl' : 'en'\)/,
    );
    expect(CONSENT_STRINGS.pl.footer.cookies).not.toBe(CONSENT_STRINGS.en.footer.cookies);
  });

  it('Privacy and Cookies read their locale through the T2 authority and mount the guest section', () => {
    const privacy = read('app/privacy/page.tsx');
    expect(privacy).toMatch(/surfaceLocale\('privacy'\)/);
    expect(privacy).toMatch(/effectiveWithin\(surface, \['en', 'pl'\]\)/);
    expect(privacy).toMatch(/<GuestDataSection locale=\{consentLocale\} \/>/);
    const cookies = read('app/cookies/page.tsx');
    expect(cookies).toMatch(/effectiveWithin\(surfaceLocale\('cookies'\), \['en', 'pl'\]\)/);
    expect(cookies).toMatch(/<GuestDataSection locale=\{language\} \/>/);
  });

  it('the guest privacy client is separate from the protected askV2Api.ts', () => {
    expect(read('lib/api/guestPrivacyApi.ts')).not.toMatch(/from '\.\/askV2Api'/);
    expect(read('lib/api/askV2Api.ts')).not.toMatch(/guest\/forget/);
  });
});
