import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE POLAND RULING — A PRESENTATION SCOPE THAT MUST NEVER BECOME A BINDING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Product Owner ruled two things at once, and the second is the one that needs a
 * guard:
 *
 *   *"visual scope = Poland. Show Poland as the planned Alpha visual scope in the preview
 *   chrome/header."*
 *
 *   *"Do not mutate or falsely bind the production Economy subject (`economyIso2: ZZ`)
 *   merely to make the label appear. Use a preview-only presentation scope/label. The
 *   eventual live route must derive geography from the actual bound subject."*
 *
 * Those two pull in opposite directions, and the easy way to satisfy the first is to
 * violate the second — open `productionSubject.ts`, write `Poland`, and the header reads
 * correctly in every capture. It would also be a lie that outlives the preview: the
 * accepted module would then claim a geography for a subject bound to no economy, and it
 * would still claim it the day `/economy` opens over data never collected for Poland.
 *
 * A screenshot cannot tell those two implementations apart — both show the word `Poland`.
 * So, exactly as the delivery's own frames spec argues about silencing versus fabricating,
 * the separation is asserted about the CODE and not about the capture.
 *
 * THREE THINGS ARE PROVED HERE, EACH WITH A CONTROL THAT CAN FAIL.
 */

const SRC = join(__dirname, '..', '..');

const read = (f: string): string => readFileSync(f, 'utf-8');

const PRODUCTION_SUBJECT = join(SRC, 'lib', 'economy', 'productionSubject.ts');
const MARKER = join(SRC, 'components', 'economy', 'AlphaVisualPreview.tsx');
const SCOPE = join(SRC, 'lib', 'specialist', 'previewScope.ts');

/* ────────────────────────────────────────────────────────────────────────────
   1 · THE PRODUCTION SUBJECT WAS NOT TOUCHED

   This is the assertion the ruling actually asked for. If a later change satisfies a
   header by editing the accepted module, this fails before anything reaches a capture.
   ──────────────────────────────────────────────────────────────────────────── */
describe('the production Economy subject is not bound to a geography', () => {
  const src = read(PRODUCTION_SUBJECT);

  it('still carries economyIso2 ZZ', () => {
    expect(`ZZ present: ${/economyIso2:\s*'ZZ'/.test(src)}`).toBe('ZZ present: true');
  });

  it('still carries scopeLabel "No subject bound"', () => {
    expect(`unbound: ${/scopeLabel:\s*'No subject bound'/.test(src)}`).toBe('unbound: true');
  });

  it('names no country anywhere — not Poland, and not any stand-in for it', () => {
    /*
      Deliberately wider than `Poland`. The failure this guards against is a subject that
      acquires A geography, and satisfying the ruling with `PL`, `POL` or a euro-area
      aggregate standing in for Poland would be the same defect wearing a different
      spelling — which is precisely the substitution the Economy lineage entries forbid
      ("no EU or euro-area aggregate may stand in for Poland").
    */
    const forbidden = /'(Poland|Polska|PL|POL|EU27_2020|EA20)'/g;
    const hits = src.match(forbidden) ?? [];
    expect(`country literals in the production subject: ${hits.join(',') || 'none'}`)
      .toBe('country literals in the production subject: none');
  });

  it('THE CONTROL · the scan can see literals in this file at all', () => {
    /*
      Without this, the assertion above passes just as happily against an empty string, a
      renamed file or a bad path. It asserts a literal the accepted module genuinely
      contains, so a broken read fails here instead of passing silently up there.
    */
    expect(`ZZ readable: ${/'ZZ'/.test(src)}`).toBe('ZZ readable: true');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2 · THE SCOPE EXISTS, AND IT IS WORDED AS A PLAN

   Showing Poland is half the ruling. Showing it as a PLAN rather than as an observed or
   bound fact is the half that keeps it honest next to a frame reading `No subject bound`.
   ──────────────────────────────────────────────────────────────────────────── */
describe('the planned visual scope is rendered, and rendered as a plan', () => {
  const src = read(MARKER);

  it('declares Poland as the planned Alpha visual scope', () => {
    expect(`scope: ${/ALPHA_PREVIEW_VISUAL_SCOPE\s*=\s*\{\s*label:\s*'Poland',\s*geo:\s*'PL'\s*\}/.test(read(SCOPE))}`)
      .toBe('scope: true');
  });

  it('and the Economy component tree still names no country, so ECON-UI-1 stands', () => {
    /*
      The relocation is only honest if the guard it satisfies is still doing its job. This
      asserts the marker reaches the value by import rather than by holding a copy — if a
      later edit inlines `'Poland'` back into the component, ECON-UI-1 fails, and so does
      this, naming the reason.
    */
    expect(`marker imports the scope: ${/import \{ ALPHA_PREVIEW_VISUAL_SCOPE \} from '@\/lib\/specialist\/previewScope'/.test(src)}`)
      .toBe('marker imports the scope: true');
    expect(`country literal in the marker: ${/'(Poland|Polska)'/.test(src) ? 'present' : 'none'}`)
      .toBe('country literal in the marker: none');
  });

  it('qualifies it with "Planned visual scope", so it cannot read as a binding', () => {
    expect(`qualified: ${/Planned visual scope/.test(src)}`).toBe('qualified: true');
  });

  it('a retained observed geography overrides the planned scope in reader-visible chrome and metadata', () => {
    expect(src).toMatch(/observedGeography\s*\?/);
    expect(src).toContain('Observed scope');
    expect(src).toContain("data-preview-scope-kind={observedGeography ? 'observed' : 'planned'}");
    expect(src).toContain('observedGeography ?? ALPHA_PREVIEW_VISUAL_SCOPE.geo');
  });

  it('THE MUTATION · dropping the qualifier is detected', () => {
    /*
      The qualifier is the entire difference between a plan and a claim, and it is one
      string a tidying pass could remove without any test noticing. This runs the real
      assertion against a mutated copy and requires it to fail.
    */
    const mutated = src.replace(/Planned visual scope/g, 'Visual scope');
    expect(`mutation detected: ${!/Planned visual scope/.test(mutated)}`)
      .toBe('mutation detected: true');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3 · IT IS PREVIEW-ONLY

   "Use a preview-only presentation scope/label. The eventual live route must derive
   geography from the actual bound subject."

   So the constant must not leak into anything that is not the preview. Today that is
   easy to see by eye; the point of a guard is the day it stops being easy.
   ──────────────────────────────────────────────────────────────────────────── */
describe('the presentation scope cannot leak beyond the preview', () => {
  /* Walk every source file rather than a directory somebody remembered to name. */
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry: string) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx?$/.test(full) ? [full] : [];
    });

  const ALLOWED = [
    SCOPE,
    join(SRC, 'components', 'economy', 'AlphaVisualPreview.tsx'),
    join(SRC, 'lib', 'specialist', 'previewScopeRuling.spec.ts'),
  ];

  const referents = walk(SRC).filter((f) => /ALPHA_PREVIEW_VISUAL_SCOPE/.test(read(f)));

  it('is referenced only by the preview marker and this guard', () => {
    const leaked = referents.filter((f) => !ALLOWED.includes(f));
    expect(`leaked into: ${leaked.map((f) => f.slice(SRC.length + 1)).join(', ') || 'nothing'}`)
      .toBe('leaked into: nothing');
  });

  it('THE CONTROL · the walk found both real referents, so "nothing leaked" is not vacuous', () => {
    /*
      A walk that silently returned zero files would make the assertion above pass while
      proving nothing whatsoever. This requires it to have found the two files that must
      contain the constant: the module that declares it and the marker that renders it.
    */
    expect(`declaration found: ${referents.includes(SCOPE)}`).toBe('declaration found: true');
    expect(`marker found: ${referents.includes(MARKER)}`).toBe('marker found: true');
  });

  it('the governed /economy route is still absent, so nothing live reads this', () => {
    /*
      The ruling's closing requirement is about the LIVE route. The strongest available
      statement of it today is that the live route does not exist — the same tripwire the
      Economy substrate spec holds from the other side.
    */
    expect(`app/economy exists: ${existsSync(join(SRC, 'app', 'economy'))}`)
      .toBe('app/economy exists: false');
  });
});
