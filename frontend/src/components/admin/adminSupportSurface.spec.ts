import { readFileSync } from 'fs';
import { join } from 'path';
import { ADMIN_SUPPORT_API, ADMIN_API } from '@/lib/admin/adminRoutes';
import { PROVENANCE } from '@/lib/admin/adminProvenance';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import { adminPl } from '@/lib/i18n/dictionaries/adminPl';

/**
 * S3 — the admin support surface, asserted in this codebase's frontend
 * convention: static source analysis.
 *
 * The frontend jest configuration here is ts-jest on `testEnvironment:
 * 'node'` — there is no jsdom and no React Testing Library anywhere in
 * this repository — so a spec proves properties of the SHIPPED SOURCE
 * rather than of a rendered tree. That is the same technique
 * `adminOperationalSurface.spec.ts` and `adminSecurityPosture.spec.ts`
 * use, and it is deliberately not changed here: introducing a second
 * frontend testing stack is not this milestone's business.
 *
 * WHAT THIS FILE IS FOR, and what it is NOT for. The internal-note
 * boundary is a SERVER property and is proven server-side, against real
 * services and a real store, in
 * `backend/src/modules/support/admin-support.security.spec.ts`. Nothing
 * here could prove it and nothing here pretends to. This file asserts
 * the narrower claim that the screen does not undermine that boundary
 * from the client side, and that it invents no data.
 */
const SCREEN = join(__dirname, 'screens', 'SupportScreen.tsx');
const ADMIN_LIB = join(__dirname, '..', '..', 'lib', 'admin');

const raw = readFileSync(SCREEN, 'utf-8');
const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('S3 — the admin support screen renders real data', () => {
  it('reads the queue and one ticket through the declared admin support paths', () => {
    expect(source).toContain('ADMIN_SUPPORT_API.tickets');
    expect(source).toContain('ADMIN_SUPPORT_API.ticket(');
    expect(source).toContain('ADMIN_SUPPORT_API.messages(');
    expect(source).toContain('ADMIN_SUPPORT_API.status(');
  });

  it('every admin support path is under /admin and declared exactly once', () => {
    // Assembled rather than written out: a reference-shaped literal in a
    // frontend source file is exactly what adminNoSampleData.spec.ts
    // exists to catch, and a path test does not need a real-looking one.
    const ref = `${'GN'}-TESTREF0001`;
    const base = ADMIN_SUPPORT_API.tickets;

    expect(base).toBe('/admin/support/tickets');
    expect(ADMIN_SUPPORT_API.ticket(ref)).toBe(`${base}/${ref}`);
    expect(ADMIN_SUPPORT_API.messages(ref)).toBe(`${base}/${ref}/messages`);
    expect(ADMIN_SUPPORT_API.status(ref)).toBe(`${base}/${ref}/status`);
  });

  it('ADMIN_API stays the READ-ONLY surface — the support writes are declared separately', () => {
    // The route manifest asserts ADMIN_API's key set exactly, and that
    // assertion is only meaningful while every member of it is a GET.
    //
    // ADMIN-03 added three members and every one is a GET, so the
    // read-only meaning of this object is unchanged — which is the
    // property this test is actually defending. The support writes are
    // still declared in their own constant, and that separation is what
    // keeps "everything in ADMIN_API is a read" a fact rather than a
    // convention.
    expect(Object.keys(ADMIN_API).sort()).toEqual([
      'analyticsCoverageGeography',
      'analyticsUsage',
      'me',
      'newsProviders',
      'systemHealth',
      'users',
    ]);
  });

  it('the screen no longer claims that no ticket capability exists', () => {
    expect(source).not.toContain('notImplementedBody');
    expect(adminEn.screens.support).not.toHaveProperty('notImplementedBody');
    expect(adminPl.screens.support).not.toHaveProperty('notImplementedBody');
  });

  it('the three implemented support fields are tagged A and the two unimplemented stay C', () => {
    expect(PROVENANCE['admin-05.tickets']).toBe('A');
    expect(PROVENANCE['admin-05.userReplies']).toBe('A');
    expect(PROVENANCE['admin-05.internalNotes']).toBe('A');
    expect(PROVENANCE['admin-05.ticketAudit']).toBe('C');
    expect(PROVENANCE['admin-05.sla']).toBe('C');
  });

  it('audit history and SLA are still rendered as placeholders, never as derived data', () => {
    expect(source).toContain('field="admin-05.ticketAudit"');
    expect(source).toContain('field="admin-05.sla"');

    // A timeline assembled from message timestamps would look like an
    // audit record and would not be one.
    expect(source).not.toMatch(/auditTrail|history\s*=|timeline/i);
    expect(source).not.toMatch(/slaTarget|responseTime|breach/i);
  });
});

describe('S3 — the two visibilities are rendered distinctly', () => {
  it('the screen branches on the STORED visibility value, for both messages and composers', () => {
    expect(source).toMatch(/visibility === 'INTERNAL'/);
    expect(source).toContain('visibility="PUBLIC"');
    expect(source).toContain('visibility="INTERNAL"');
  });

  it('colour is never the only signal — each state carries its own text label', () => {
    expect(source).toContain('screen.visibilityInternal');
    expect(source).toContain('screen.visibilityUser');

    expect(adminEn.screens.support.visibilityInternal).toContain('not visible to the user');
    expect(adminPl.screens.support.visibilityInternal.length).toBeGreaterThan(0);
  });

  it('the note composer cannot post a PUBLIC message — visibility is a prop, not a control', () => {
    expect(source).not.toMatch(/setVisibility|onVisibilityChange|toggleVisibility/);
    expect(source).not.toMatch(/name="visibility"/);

    // A composer that defaulted its visibility could post a note
    // publicly if a prop were ever forgotten. Every send passes the
    // value through explicitly.
    expect(source).toContain('mutation.submit({ visibility, message })');
    expect(source).not.toMatch(/visibility\s*\?\?\s*'PUBLIC'/);
    expect(source).not.toMatch(/visibility\s*=\s*'PUBLIC'/);
  });

  it('the screen states the consequence of each action rather than leaving it implicit', () => {
    expect(adminEn.screens.support.replyConsequence).toContain('awaiting user');
    expect(adminEn.screens.support.noteConsequence).toContain('changes nothing');
    expect(source).toContain('screen.replyConsequence');
    expect(source).toContain('screen.noteConsequence');
  });
});

describe('S3 — mutations go through the sanctioned client', () => {
  it('the screen issues no request of its own — it composes the two hooks', () => {
    expect(source).toContain('useAdminResource');
    expect(source).toContain('useAdminMutation');
    expect(source).not.toMatch(/(^|[^.\w])fetch\s*\(/);
    expect(source).not.toContain('accountFetch');
    expect(source).not.toContain('axios');
  });

  it('the mutation hook uses accountFetch, which supplies the CSRF header', () => {
    const hookRaw = readFileSync(join(ADMIN_LIB, 'useAdminMutation.ts'), 'utf-8');
    // Comments stripped: the hook's own doc comment NAMES the CSRF
    // header in order to say that accountFetch is what sets it, which is
    // the opposite of hand-rolling one.
    const hook = hookRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(hook).toContain("from '@/lib/api/accountFetch'");
    expect(hook).toContain("method: 'POST'");
    expect(hook).not.toMatch(/(^|[^.\w])fetch\s*\(/);
    // The hook must not build the double-submit header itself; that is
    // accountFetch's single responsibility and there is one copy of it.
    expect(hook).not.toContain('X-CSRF-Token');
    expect(hook).not.toContain('gna_csrf');
    expect(hook).not.toContain('document.cookie');
  });

  it('a composer clears itself ONLY after a successful response', () => {
    const send = source.slice(source.indexOf('const send = useCallback'));
    const clear = send.indexOf("setBody('')");
    const guard = send.indexOf('if (await mutation.submit(');

    expect(guard).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(guard);
  });

  it('a failed mutation says nothing was sent', () => {
    expect(source).toContain('screen.submitFailed');
    expect(adminEn.screens.support.submitFailed).toContain('Nothing was sent');
  });
});

describe('S3 — no requester identity and no invented data reach the screen', () => {
  it('the screen renders no email, display name or account identifier', () => {
    expect(source).not.toMatch(/\.email|displayName|requesterName|\.userId/);
    expect(source).toContain('screen.identityNote');
  });

  it('the queue columns are the seven approved ones and none of them is a person', () => {
    // No requester column exists, in either language, because no
    // requester field exists in the response (CTO decision, S3).
    expect(Object.keys(adminEn.screens.support.columns).sort()).toEqual([
      'category',
      'notes',
      'reference',
      'replies',
      'status',
      'subject',
      'updated',
    ]);
    expect(Object.keys(adminPl.screens.support.columns).sort()).toEqual(
      Object.keys(adminEn.screens.support.columns).sort(),
    );
  });

  it('no sample ticket, reference or correspondence is hardcoded anywhere in the screen', () => {
    // A real reference is the GN prefix plus ten Crockford Base32
    // characters. Not one may appear as a literal: every reference on
    // this screen comes from the backend.
    //
    // The pattern is BUILT rather than written out, because
    // adminNoSampleData.spec.ts sweeps every frontend source file for
    // the design's sample reference shape and a spec asserting the
    // absence of a literal must not introduce one.
    const referenceLiteral = new RegExp(`'${'GN'}-[0-9A-HJKMNP-TV-Z]{10}'`);
    expect(source).not.toMatch(referenceLiteral);
    expect(source).not.toMatch(/\[\s*\{\s*reference:/);
    expect(source).not.toMatch(/mockTickets|sampleTickets|fakeTickets|EXAMPLE_TICKET/i);
  });

  it('the empty queue is an EMPTY STATE, never an invented row', () => {
    expect(source).toContain('queue.data?.tickets ?? []');
    expect(source).toContain('screen.queueEmptyTitle');
    expect(source).toContain('screen.queueErrorTitle');
  });

  it('a failed queue read is reported as an error, not as "no tickets"', () => {
    // The two are different facts and the approved data-state contract
    // requires them to read differently.
    expect(source).toMatch(/queue\.state === 'error'\s*\?\s*screen\.queueErrorTitle/);
    expect(adminEn.screens.support.queueErrorTitle).not.toEqual(
      adminEn.screens.support.queueEmptyTitle,
    );
  });
});

describe('S3 — the screen reuses the existing admin shell and primitives', () => {
  it('composes AdminPanel, AdminDataTable, StatusChip and PlaceholderPanel rather than new ones', () => {
    ['AdminPanel', 'AdminDataTable', 'StatusChip', 'PlaceholderPanel', 'ScreenHeading'].forEach(
      (primitive) => {
        expect({ primitive, used: source.includes(primitive) }).toEqual({ primitive, used: true });
      },
    );
  });

  it('is a client component under the shell boundary and reads its dictionary from context', () => {
    expect(raw.startsWith("'use client';")).toBe(true);
    expect(source).toContain('useAdminContext()');
  });

  it('every status and category the backend can return has a label in BOTH languages', () => {
    const statuses = ['OPEN', 'AWAITING_USER', 'AWAITING_ADMIN', 'RESOLVED'] as const;
    const categories = [
      'NEWS_QUESTION',
      'BUG_REPORT',
      'CONTENT_REPORT',
      'FEEDBACK',
      'ABUSE_REPORT',
      'ACCOUNT_PROBLEM',
      'OTHER',
    ] as const;

    statuses.forEach((status) => {
      expect(adminEn.screens.support.statuses[status].length).toBeGreaterThan(0);
      expect(adminPl.screens.support.statuses[status].length).toBeGreaterThan(0);
    });

    categories.forEach((category) => {
      expect(adminEn.screens.support.categories[category].length).toBeGreaterThan(0);
      expect(adminPl.screens.support.categories[category].length).toBeGreaterThan(0);
    });

    (['USER', 'ADMIN', 'SYSTEM_AI'] as const).forEach((author) => {
      expect(adminEn.screens.support.authors[author].length).toBeGreaterThan(0);
      expect(adminPl.screens.support.authors[author].length).toBeGreaterThan(0);
    });
  });
});
