import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FRAME_DIR = __dirname;
const FRONTEND_SRC = join(__dirname, '..', '..');
const REPO = join(FRONTEND_SRC, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* PAF acceptance test 25 — the diff is presentation-layer only */
describe('PAF-25 — no route, contract, pipeline or evidence-grounding change', () => {
  // SHIPPED code only. Specs are excluded: a spec's own assertion text
  // necessarily names the things it forbids, which would make every
  // guard below self-triggering.
  const frameFiles = readdirSync(FRAME_DIR).filter(
    (f) => /\.tsx?$/.test(f) && !f.endsWith('.spec.ts') && !f.endsWith('.spec.tsx') && f !== 'frameFixtures.ts',
  );

  it('no frame file imports anything from backend, prisma or a shared source file', () => {
    for (const file of frameFiles) {
      const source = readFileSync(join(FRAME_DIR, file), 'utf8');
      expect(`${file}: ${/from '.*\/backend\//.test(source)}`).toBe(`${file}: false`);
      expect(`${file}: ${/prisma/i.test(source)}`).toBe(`${file}: false`);
      // The shared package is imported as a PACKAGE (types only, plus
      // whatever the existing workspace already imports) — never by
      // reaching into shared/src to change or re-derive a contract.
      expect(`${file}: ${/from '.*shared\/src/.test(source)}`).toBe(`${file}: false`);
    }
  });

  it('the frame declares no API route and calls no endpoint of its own', () => {
    for (const file of frameFiles) {
      const source = readFileSync(join(FRAME_DIR, file), 'utf8');
      expect(`${file}: ${/fetch\(|axios|XMLHttpRequest/.test(source)}`).toBe(`${file}: false`);
      // An endpoint STRING, not the existing client module's import path.
      expect(`${file}: ${/['"`]\/api\//.test(source)}`).toBe(`${file}: false`);
      expect(`${file}: ${/https?:\/\/(?!example)/.test(source)}`).toBe(`${file}: false`);
    }
  });

  it('retrieval goes through the SAME analyzeNews() the existing client uses', () => {
    const client = readFileSync(join(FRAME_DIR, 'AnalysisFrameClient.tsx'), 'utf8');
    const existing = readFileSync(join(FRONTEND_SRC, 'components', 'search', 'SearchPageClient.tsx'), 'utf8');
    expect(client).toMatch(/from '@\/lib\/api\/analysisApi'/);
    expect(existing).toMatch(/from '@\/lib\/api\/analysisApi'/);
  });

  it('the frame never mutates the response or re-derives a grounded value', () => {
    for (const file of frameFiles) {
      const source = readFileSync(join(FRAME_DIR, file), 'utf8');
      expect(`${file}: ${/response\.[a-zA-Z]+ =[^=]/.test(source)}`).toBe(`${file}: false`);
      expect(`${file}: ${/sourceArticleIds\s*=[^=]/.test(source)}`).toBe(`${file}: false`);
      expect(`${file}: ${/evidenceBasis\s*=[^=]/.test(source)}`).toBe(`${file}: false`);
    }
  });

  it('claim text and evidence excerpts are rendered verbatim — no transform anywhere', () => {
    const row = readFileSync(join(FRAME_DIR, 'ClaimRow.tsx'), 'utf8');
    expect(row).toContain('{entry.text}');
    expect(row).toContain('{entry.evidenceBasis.excerpt}');
    expect(row).not.toMatch(/entry\.text\.(slice|substring|replace|split|toUpperCase|toLowerCase)/);
    expect(row).not.toMatch(/excerpt\.(slice|substring|replace|split)/);
  });

  /*
   * ── RETARGETED IN R4 ─────────────────────────────────────────────────
   *
   * OLD ASSERTION: `/search` and `SearchPageClient.tsx` must not mention
   * `analysis-frame` at all.
   *
   * WHY IT NO LONGER HOLDS: it was written under PAF-R1, when the frame
   * shipped at its own `/analysis` route and reaching into `/search`
   * would have been scope creep. Both halves of that premise are gone.
   * `/analysis` was retired by CTO ruling H-1, and R4 §1 makes `/search`
   * the canonical Analysis Workspace while §8 explicitly authorises
   * `frontend/src/components/search/**` for the mount. The assertion now
   * forbids precisely what the CTO ordered.
   *
   * WHAT REPLACES IT: the mount is permitted, but it must stay a MOUNT.
   * The point the old test really protected — that the frame does not
   * quietly acquire a second request path or a second analysis contract
   * on the way in — is asserted directly instead, and is strictly
   * stronger than a substring ban that any import would have tripped.
   */
  it('the /search mount passes the fetched response down and adds no second request path', () => {
    const client = readFileSync(join(FRONTEND_SRC, 'components', 'search', 'SearchPageClient.tsx'), 'utf8');

    // Mounted, as R4 §8 authorises.
    expect(client).toMatch(/AnalysisFrameSurface/);

    // Exactly one analysis request on this surface, and it is the
    // pre-existing one: the frame is handed `response`, never a query.
    expect((client.match(/analyzeNews\(/g) ?? []).length).toBe(1);
    expect(client).toMatch(/<AnalysisFrameSurface[\s\S]*?response=\{response\}/);

    // The retired route stays retired (R4 §1, §8).
    expect(existsSync(join(FRONTEND_SRC, 'app', 'analysis', 'page.tsx'))).toBe(false);

    // The surface itself is presentational — it accepts a response and
    // issues nothing of its own.
    const surface = readFileSync(join(FRAME_DIR, 'AnalysisFrameSurface.tsx'), 'utf8');
    // A CALL, not a mention: the file's own header explains why it does
    // not fetch, and naming the function it avoids must not fail this.
    expect(surface).not.toMatch(/analyzeNews\(|fetch\(|useEffect/);
  });

  it('the only dictionary change is the additive analysisFrame section', () => {
    const en = readFileSync(join(FRONTEND_SRC, 'lib', 'i18n', 'dictionaries', 'en.ts'), 'utf8');
    /*
       CONVERGENCE REPAIR — the accepted GEO-PRECISION vocabulary.

       This guard's job has never changed: prove the frame's additive
       dictionary section did not disturb the geography precision blocks.
       It measured that by counting the `city` entry, which is 2 because
       there are two precision blocks in en.ts.

       The tag itself is now `RETRIEVED FOR`, and BOTH `city` and
       `country` carry it — the geography convergence collapsed the two
       tiers to one tag on purpose, because the tag states how we looked,
       not how precisely we know, and granularity is carried by the place
       name beside it. So the bare tag occurs FOUR times, and counting it
       alone would silently turn a `2` guard into a `4` guard.

       Counting `city: 'RETRIEVED FOR'` keeps the count at exactly 2 and
       keeps measuring the same structural fact the original measured.
       This is narrower than the original pattern, not broader.
    */
    expect((en.match(/city: 'RETRIEVED FOR'/g) ?? []).length).toBe(2);
    expect(en).toContain('No subnational precision in evidence');
    expect(en).toContain('analysisFrame: {');
  });

  it('no file outside frontend/src is reachable from the frame', () => {
    for (const file of frameFiles) {
      const source = readFileSync(join(FRAME_DIR, file), 'utf8');
      const upwards = source.match(/from '(\.\.\/){3,}/g) ?? [];
      expect(`${file}: ${upwards.length}`).toBe(`${file}: 0`);
    }
  });

  it('the frame adds no dependency — every import resolves to the repo or React', () => {
    const allowed = /^(react|react-dom|next\/|@\/|\.\/|\.\.\/|@globalnews-ai\/shared|node:)/;
    const offenders: string[] = [];
    for (const file of frameFiles) {
      const source = readFileSync(join(FRAME_DIR, file), 'utf8');
      for (const match of source.matchAll(/from '([^']+)'/g)) {
        if (!allowed.test(match[1])) offenders.push(`${file}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /*
     H-1 RULING — THE /analysis ROUTE IS RETIRED.

     THE OLD ASSERTION walked `frontend/src/app/analysis` and required every
     file under it to be `page.tsx` — a guard that the frame added exactly one
     route file and nothing else. `/search` is now the canonical Analysis
     Workspace and that route no longer ships, so the directory is gone and
     the walk throws ENOENT. The assertion is not weakened; its subject was
     deleted by CTO decision.

     THE REPLACEMENT IS STRICTLY STRONGER. The old test permitted the route to
     exist as long as it held one file. This one asserts it does not exist at
     all, and that no shipped file re-creates a reference to it. The component
     library is deliberately retained (H-1: "do not delete the underlying
     analysis-frame component library merely because the route is retired"),
     so `frameRequest.ts` may still BUILD an /analysis href for a future
     caller — what must not come back is an app route or a link from the
     canonical surface.
  */
  it('H-1: the /analysis route no longer ships', () => {
    /*
       Asserted as "no FILE under the route path", not "no directory".
       Git tracks files, never directories: on a machine where the route
       file was moved out rather than unlinked, an empty `app/analysis/`
       can survive locally while the repository correctly records the
       deletion. Testing the directory's existence would pass on a fresh
       clone and fail on that machine for a difference git cannot even
       express. Testing for files is true in both.
    */
    const routeDir = join(FRONTEND_SRC, 'app', 'analysis');
    expect(existsSync(routeDir) ? walk(routeDir) : []).toEqual([]);
  });

  it('H-1: no shipped app route and no /search file links to the retired route', () => {
    const appRoutes = walk(join(FRONTEND_SRC, 'app')).filter((f) => /\.tsx?$/.test(f));
    for (const file of appRoutes) {
      expect(`${file}: ${/analysis-frame|\/analysis\?q=/.test(readFileSync(file, 'utf8'))}`).toBe(`${file}: false`);
    }
    const searchClient = readFileSync(join(FRONTEND_SRC, 'components', 'search', 'SearchPageClient.tsx'), 'utf8');
    expect(searchClient).not.toMatch(/\/analysis\?q=/);
    expect(REPO).toBeTruthy();
  });
});
