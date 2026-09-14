import { readdirSync, readFileSync } from 'fs';
import { supportEn } from '@/lib/i18n/dictionaries/supportEn';
import { supportPl } from '@/lib/i18n/dictionaries/supportPl';
import { join } from 'path';
import { SUPPORT_CATEGORIES } from '@globalnews-ai/shared';
import { SUPPORT_API, SUPPORT_INPUT_BOUNDS } from '@/lib/support/supportRoutes';

/**
 * S4 — the contract of the authenticated user Support surface.
 *
 * Static source analysis, because that is what every frontend spec in this
 * repository is: jest runs under ts-jest with testEnvironment 'node', with no
 * jsdom and no React Testing Library.
 *
 * EVERY SOURCE READ NORMALISES LINE ENDINGS. An assertion that embeds a raw
 * "\n" passes on an LF checkout and fails on a CRLF one — that was a real
 * defect in this lane's F-S3 work, caught only on the CTO's native Windows
 * machine, and it is not repeating here.
 */
const FRONTEND_SRC = join(__dirname, '..', '..');
const SUPPORT_COMPONENTS = join(FRONTEND_SRC, 'components', 'support');
const SUPPORT_LIB = join(FRONTEND_SRC, 'lib', 'support');
const SUPPORT_PAGE = join(FRONTEND_SRC, 'app', 'support', 'page.tsx');
const BACKEND_DTO = join(
  FRONTEND_SRC,
  '..',
  '..',
  'backend',
  'src',
  'modules',
  'support',
  'dto',
  'support.dto.ts',
);

function read(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\r\n/g, '\n');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.spec.ts')
      ? [full]
      : [];
  });
}

const SURFACE_FILES = [
  ...sourceFiles(SUPPORT_COMPONENTS),
  ...sourceFiles(SUPPORT_LIB),
  SUPPORT_PAGE,
];

/** Executable source only — a doc comment must not be able to satisfy or trip an assertion. */
function executable(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('S4 — the user Support surface talks to the real API and nothing else', () => {
  it('declares exactly the three user routes the backend controller exposes', () => {
    expect(SUPPORT_API.tickets).toBe('/support/tickets');
    expect(SUPPORT_API.ticket('GN-ABCDEFGHJK')).toBe('/support/tickets/GN-ABCDEFGHJK');
    expect(SUPPORT_API.messages('GN-ABCDEFGHJK')).toBe('/support/tickets/GN-ABCDEFGHJK/messages');
  });

  it('the paths match the backend controller, read from its own source', () => {
    const controller = read(
      join(
        FRONTEND_SRC,
        '..',
        '..',
        'backend',
        'src',
        'modules',
        'support',
        'support.controller.ts',
      ),
    );
    expect(controller).toContain("@Controller('support')");
    expect(controller).toContain("@Post('tickets')");
    expect(controller).toContain("@Get('tickets')");
    expect(controller).toContain("@Get('tickets/:reference')");
    expect(controller).toContain("@Post('tickets/:reference/messages')");
  });

  it('DECLARES NO STATUS ROUTE — no user route accepts a status', () => {
    expect(Object.keys(SUPPORT_API)).toEqual(['tickets', 'ticket', 'messages']);
  });

  it('encodes the reference rather than interpolating it raw', () => {
    expect(SUPPORT_API.ticket('GN-A/B')).toBe('/support/tickets/GN-A%2FB');
  });

  it('no component spells a support path itself — supportRoutes is the only source', () => {
    for (const file of SURFACE_FILES) {
      if (file.endsWith(join('lib', 'support', 'supportRoutes.ts'))) continue;
      expect(executable(file)).not.toMatch(/['"`]\/support\/tickets/);
    }
  });

  it('every request goes through accountFetch — no bare fetch( anywhere in the surface', () => {
    for (const file of SURFACE_FILES) {
      expect(executable(file)).not.toMatch(/(?<![.\w])fetch\s*\(/);
    }
  });

  it('reaches for NO admin declaration — the user surface is not the admin surface', () => {
    for (const file of SURFACE_FILES) {
      const source = executable(file);
      expect(source).not.toMatch(/from\s+['"]@\/lib\/admin/);
      expect(source).not.toMatch(/from\s+['"]@\/components\/admin/);
      expect(source).not.toMatch(/AdminSupport/);
      expect(source).not.toMatch(/['"`]\/admin\//);
    }
  });

  it('never sends a status, a visibility, a userId or an authorId', () => {
    for (const file of SURFACE_FILES) {
      const source = executable(file);
      expect(source).not.toMatch(/status\s*:\s*['"`](OPEN|RESOLVED|AWAITING_USER|AWAITING_ADMIN)/);
      expect(source).not.toMatch(/visibility\s*:/);
      expect(source).not.toMatch(/authorId\s*:/);
      expect(source).not.toMatch(/userId\s*:/);
    }
  });

  it('the only POST bodies are the two the API accepts', () => {
    const form = executable(join(SUPPORT_COMPONENTS, 'NewSupportRequestForm.tsx'));
    const thread = executable(join(SUPPORT_COMPONENTS, 'SupportThread.tsx'));
    expect(form).toMatch(/mutation\.submit\(\{/);
    expect(form).toMatch(/category:/);
    expect(form).toMatch(/subject:/);
    expect(form).toMatch(/message:/);
    expect(thread).toMatch(/mutation\.submit\(\{\s*message:/);
  });
});

describe('S4 — the category vocabulary is the shared one, never a local list', () => {
  it('offers exactly the seven shared categories', () => {
    expect(SUPPORT_CATEGORIES).toHaveLength(7);
    expect(SUPPORT_CATEGORIES).toEqual([
      'NEWS_QUESTION',
      'BUG_REPORT',
      'CONTENT_REPORT',
      'FEEDBACK',
      'ABUSE_REPORT',
      'ACCOUNT_PROBLEM',
      'OTHER',
    ]);
  });

  it('the form maps over SUPPORT_CATEGORIES rather than hardcoding options', () => {
    const form = executable(join(SUPPORT_COMPONENTS, 'NewSupportRequestForm.tsx'));
    // The import is multi-line since SUPPORT-AI-1 added a type to it; what
    // matters is that the vocabulary comes from shared and is mapped over.
    expect(form).toMatch(
      /import \{[\s\S]{0,120}SUPPORT_CATEGORIES[\s\S]{0,200}from '@globalnews-ai\/shared'/,
    );
    expect(form).toMatch(/SUPPORT_CATEGORIES\.map\(/);
  });

  it('NO component contains a bare category string literal', () => {
    for (const file of SURFACE_FILES) {
      const source = executable(file);
      for (const member of SUPPORT_CATEGORIES) {
        expect(source).not.toContain(`'${member}'`);
        expect(source).not.toContain(`"${member}"`);
      }
    }
  });
});

describe('S4 — the client length bounds equal the backend DTO, read from its source', () => {
  const dto = read(BACKEND_DTO);

  function boundsFor(className: string): { min: number[]; max: number[] } {
    const start = dto.indexOf(`export class ${className}`);
    expect(start).toBeGreaterThan(-1);
    const rest = dto.slice(start);
    const end = rest.indexOf('export class', 1);
    const block = end === -1 ? rest : rest.slice(0, end);
    return {
      min: [...block.matchAll(/@MinLength\((\d+)\)/g)].map((match) => Number(match[1])),
      max: [...block.matchAll(/@MaxLength\((\d+)\)/g)].map((match) => Number(match[1])),
    };
  }

  it('subject and message bounds match CreateSupportTicketDto', () => {
    const bounds = boundsFor('CreateSupportTicketDto');
    // Declaration order in the DTO: subject, then message.
    expect(bounds.min).toEqual([
      SUPPORT_INPUT_BOUNDS.subject.min,
      SUPPORT_INPUT_BOUNDS.message.min,
    ]);
    expect(bounds.max).toEqual([
      SUPPORT_INPUT_BOUNDS.subject.max,
      SUPPORT_INPUT_BOUNDS.message.max,
    ]);
  });

  it('the reply bound matches CreateSupportMessageDto', () => {
    const bounds = boundsFor('CreateSupportMessageDto');
    expect(bounds.min).toEqual([SUPPORT_INPUT_BOUNDS.reply.min]);
    expect(bounds.max).toEqual([SUPPORT_INPUT_BOUNDS.reply.max]);
  });

  it('lengths are measured on the TRIMMED value, because the DTO trims before it measures', () => {
    expect(dto).toContain('value.trim()');
    const form = executable(join(SUPPORT_COMPONENTS, 'NewSupportRequestForm.tsx'));
    expect(form).toMatch(/subject\.trim\(\)/);
    expect(form).toMatch(/message\.trim\(\)/);
    expect(executable(join(SUPPORT_COMPONENTS, 'SupportThread.tsx'))).toMatch(/reply\.trim\(\)/);
  });
});

describe('S4 — an empty result and a failed load are DIFFERENT, and are shown differently', () => {
  const screen = read(join(SUPPORT_COMPONENTS, 'SupportScreen.tsx'));

  it('renders a distinct empty branch and a distinct error branch', () => {
    expect(screen).toContain('t.list.emptyTitle');
    expect(screen).toContain('t.list.errorTitle');
    expect(screen).toMatch(/tickets\.state === 'error'/);
    expect(screen).toMatch(/tickets\.state === 'real' && list\.length === 0/);
  });

  it('the empty and error copy are not the same strings', () => {
    const { supportEn } = jest.requireActual<typeof import('@/lib/i18n/dictionaries/supportEn')>(
      '@/lib/i18n/dictionaries/supportEn',
    );
    expect(supportEn.list.emptyTitle).not.toBe(supportEn.list.errorTitle);
    expect(supportEn.list.emptyBody).not.toBe(supportEn.list.errorBody);
  });

  it('the error branch renders no ticket list', () => {
    const errorBranch = screen.slice(
      screen.indexOf("tickets.state === 'error'"),
      screen.indexOf("tickets.state === 'real' && list.length === 0"),
    );
    expect(errorBranch).not.toContain('list.map(');
  });

  it('a failed read never becomes data — the hook nulls it', () => {
    const hook = read(join(SUPPORT_LIB, 'useSupportApi.ts'));
    const failureBranch = hook.slice(hook.indexOf('if (!response.ok)'));
    expect(failureBranch.slice(0, 160)).toContain("setState('error')");
    expect(failureBranch.slice(0, 160)).toContain('setData(null)');
  });

  it('not-signed-in is its own branch and is NOT an error', () => {
    expect(screen).toContain('t.signedOut.title');
    const signedOutBranch = screen.slice(
      screen.indexOf('!isAccountLoading && !user'),
      screen.indexOf('{user && ('),
    );
    expect(signedOutBranch).not.toContain('role="alert"');
  });
});

describe('S4 — a failure never becomes a success', () => {
  const hook = read(join(SUPPORT_LIB, 'useSupportApi.ts'));

  it('submit resolves true only on a 2xx', () => {
    // SUPPORT-AI-1 widened the resolution from `true` to the parsed body,
    // and from `false` to `null`. The property is unchanged and is what is
    // asserted: a non-2xx resolves to the FALSY value, never to data.
    const submitBlock = hook.slice(hook.indexOf('const submit ='));
    expect(submitBlock).toMatch(/if \(!response\.ok\) \{[\s\S]{0,200}return null;/);
    // And the parse happens only after the ok check.
    expect(submitBlock.indexOf('response.json()')).toBeGreaterThan(
      submitBlock.indexOf('if (!response.ok)'),
    );
  });

  it('an in-flight latch makes a double-clicked submit impossible', () => {
    expect(hook).toContain('const inFlight = useRef(false)');
    expect(hook).toMatch(/if \(inFlight\.current\) return null;/);
  });

  it('the create form clears ONLY after a true result', () => {
    const form = read(join(SUPPORT_COMPONENTS, 'NewSupportRequestForm.tsx'));
    expect(form).toMatch(/const created = await mutation\.submit\(/);
    const afterSubmit = form.slice(form.indexOf('const created = await mutation.submit('));
    expect(afterSubmit).toMatch(/if \(created\) \{[\s\S]*?setSubject\(''\)/);
  });

  it('the reply composer clears ONLY after a true result', () => {
    const thread = read(join(SUPPORT_COMPONENTS, 'SupportThread.tsx'));
    const afterSubmit = thread.slice(thread.indexOf('const sent = await mutation.submit('));
    expect(afterSubmit).toMatch(/if \(sent\) \{[\s\S]*?setReply\(''\)/);
  });
});

describe('S4 — the page boundary', () => {
  const page = read(SUPPORT_PAGE);

  it('asks crawlers not to index a page of private correspondence', () => {
    /*
      RETARGETED BY ALPHA-SEO-FOUNDATION-1, AND THE RETARGET IS STRICTER.

      This asserted the LITERAL `robots: { index: false, follow: false }`
      in the page source. That directive has not been relaxed — it now
      comes from the route indexability registry, which classifies
      /support as user-dependent, so the page and the sitemap read the
      same table and cannot disagree about this surface. The old form
      could not have caught the failure that actually matters: a page
      spelling `noindex` correctly while the sitemap advertised it anyway.

      So the assertion moves from the spelling to the EFFECT. It calls the
      builder the page calls and checks the directive it produces, and it
      additionally checks the surface is absent from the sitemap — which
      the string form never checked at all.
    */
    expect(page).toMatch(/buildPageMetadata\(\{\s*\n?\s*path: '\/support'/);

    const { buildPageMetadata } = require('@/lib/seo/metadata') as typeof import('@/lib/seo/metadata');
    const { sitemapRoutes } = require('@/lib/seo/routes') as typeof import('@/lib/seo/routes');

    const meta = buildPageMetadata({
      path: '/support',
      title: 'x',
      description: 'y',
      language: 'en',
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
    /* and it never acquires a public canonical */
    expect(meta.alternates?.canonical).toBeUndefined();
    expect(sitemapRoutes().some((entry) => entry.path === '/support')).toBe(false);
  });

  /**
   * RC-1 REPLACES THE ORIGINAL FORM OF THIS TEST, and the replacement is
   * stricter, not weaker.
   *
   * F's checkpoint was not permitted to edit en.ts / pl.ts, so it shipped a
   * ternary over supportEn/supportPl and this test pinned that arrangement by
   * asserting `getDictionary` did NOT appear. app/support/page.tsx recorded
   * that as temporary in its own doc comment. RC-1 performs the fold, so the
   * old assertion now pins the very defect it was written to make visible:
   * a second localization path.
   *
   * What must be true from RC-1 onward is the opposite, and that is what is
   * asserted below: the page resolves through the ONE global dictionary, and
   * no support surface file reaches around it to a language-specific module.
   */
  it('resolves its strings through the ONE global dictionary — no second localization path', () => {
    expect(page).toMatch(/from\s+['"]@\/lib\/i18n\/dictionaries['"]/);
    expect(page).toMatch(/getDictionary\(/);
    expect(page).toMatch(/getDictionary\(currentLanguage\(\)\)\.support/);
  });

  it('no support surface file SELECTS a dictionary by language — the type alias is not a second path', () => {
    for (const file of SURFACE_FILES) {
      const source = executable(file);

      // `import type { SupportDictionary } from '.../supportEn'` is a compile-time
      // reference with no runtime existence, so it cannot constitute a second
      // localization path. A VALUE import of either language module can, and is
      // what this test forbids.
      expect(source).not.toMatch(
        /^\s*import\s+(?!type\b)[^;]*from\s+['"]@\/lib\/i18n\/dictionaries\/support(En|Pl)['"]/m,
      );

      // The Polish module is the unambiguous tell: nothing here may name it at
      // all, in a type position or otherwise, because naming it means choosing.
      expect(source).not.toMatch(/supportPl/);
    }
  });

  it('adds no navigation entry — that hook is deferred to the owning lane', () => {
    for (const file of SURFACE_FILES) {
      expect(executable(file)).not.toMatch(/primaryNavLinks|NAV_MODEL/);
    }
  });
});

/**
 * SUPPORT CLOSURE — THE SIGNED-OUT SCREEN MUST NOT BE A DEAD END.
 *
 * Help is now discoverable from the public chrome, so a signed-out visitor
 * arrives here deliberately rather than by accident. Before this change the
 * screen told them to sign in and offered no way to do it.
 */
describe('SUPPORT CLOSURE — the signed-out state offers a real sign-in action', () => {
  const screen = readFileSync(join(__dirname, 'SupportScreen.tsx'), 'utf-8');

  it('uses the EXISTING Google OAuth endpoint — no second auth path is introduced', () => {
    expect(screen).toContain('/auth/google');
    /*
      M-ALPHA-AUTH — the CONTRACT changed, so this assertion was updated rather
      than deleted. It previously required this screen to build its own
      `${API_BASE_URL}/auth/google` from NEXT_PUBLIC_API_URL. That pointed at
      the BACKEND's origin and is precisely what made the session cookie
      cross-site, so /support could never show a signed-in state and — via the
      unconditional callback redirect — returned the user to Home.

      The PROPERTY this test exists to protect is unchanged and is now asserted
      more strongly: there is still exactly ONE auth path in the product, and
      this screen still shares it with AccountControl instead of inventing a
      second one. It is now the shared `accountSignInUrl` helper rather than a
      copied environment expression, so "the same resolution AccountControl
      uses" is enforced by the import rather than by two files happening to
      agree.
    */
    expect(screen).toContain("from '@/lib/api/accountBase'");
    expect(screen).toContain('accountSignInUrl(');
    expect(screen).not.toContain('process.env.NEXT_PUBLIC_API_URL');
  });

  it('renders the action ONLY in the signed-out branch', () => {
    const signedOutBlock = screen.slice(
      screen.indexOf('!isAccountLoading && !user'),
      screen.indexOf('{user && ('),
    );
    expect(signedOutBlock).toContain('/auth/google');
    expect(signedOutBlock).toContain('{t.signedOut.signIn}');
  });

  it('the label is localized in both languages and genuinely translated', () => {
    expect(supportEn.signedOut.signIn.length).toBeGreaterThan(0);
    expect(supportPl.signedOut.signIn.length).toBeGreaterThan(0);
    expect(supportPl.signedOut.signIn).not.toBe(supportEn.signedOut.signIn);
  });

  it('it is a plain navigation, not client-side auth logic', () => {
    // A link to the existing endpoint. No popup, no fetch, no token handling.
    expect(screen).not.toMatch(/signIn\s*\(|window\.open|fetch\([^)]*auth/);
  });
});

/**
 * SUPPORT CLOSURE (G4) — "RESOLVED" IS ABOUT THE REQUEST, NOT THE DEFECT.
 *
 * "Something is broken" is one of the seven categories a person can choose, so
 * a closed thread is easily read as a repair certificate. Sending a reply is
 * not a fix and neither is a status.
 */
describe('SUPPORT CLOSURE — a resolved request never claims a defect was fixed', () => {
  it('the user-facing notice separates the two, in both languages', () => {
    for (const dictionary of [supportEn, supportPl]) {
      expect(dictionary.thread.resolvedNotice.length).toBeGreaterThan(60);
    }
    const notice = supportEn.thread.resolvedNotice.toLowerCase();
    expect(notice).toContain('not confirmation');
    expect(notice).toContain('unless a reply says so');
    // The reopen guarantee is preserved, not replaced.
    expect(notice).toContain('reopen');
  });

  it('the notice never asserts a repair', () => {
    const notice = supportEn.thread.resolvedNotice.toLowerCase();
    expect(notice).not.toMatch(/has been fixed\b(?! unless)|issue resolved|problem solved/);
  });
});
