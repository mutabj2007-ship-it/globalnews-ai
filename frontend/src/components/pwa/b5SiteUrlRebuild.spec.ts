import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5-B — `NEXT_PUBLIC_SITE_URL` REQUIRES A REBUILD. RECORDED AS A TEST.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The instruction was to RECORD that this variable requires a rebuild when
 * DOMAIN-1 eventually changes it. Recording it in a document would be a note
 * somebody has to find; recording it here makes it a thing that fails if the
 * property it depends on ever changes.
 *
 * ── WHY A REBUILD, AND NOT A RESTART ─────────────────────────────────────
 *
 * Next inlines `process.env.NEXT_PUBLIC_*` AT BUILD TIME, and only when it can
 * see the literal name — which is why `siteOrigin.ts` reads it as a static
 * property access rather than through a computed key. The value is therefore
 * baked into the emitted bundle. Changing the variable in Railway and
 * restarting the service changes nothing at all: the old origin is already
 * compiled in.
 *
 * ── WHAT SILENTLY BREAKS IF THIS IS FORGOTTEN AT BINDING ─────────────────
 *
 * Every consumer of the resolved origin is something a crawler or another
 * machine reads, not something a person would notice on screen:
 *
 *   - canonical URLs would nominate the OLD host as the indexable copy of every
 *     page served from the new one — the precise duplication the SEO foundation
 *     exists to prevent, and it points the wrong way;
 *   - the `Sitemap:` and `host` lines in robots.txt would advertise the old
 *     origin;
 *   - absolute social/OG URLs would resolve against it.
 *
 * None of these produce an error, a failed request, or a visibly wrong page.
 * They produce a correct-looking site that tells every machine it is somewhere
 * else — which is why this is written down as a deployment step rather than
 * trusted to be noticed.
 *
 * ── AND IT IS PER-ORIGIN ─────────────────────────────────────────────────
 *
 * The Railway origin remains operational as the rollback path, so it needs the
 * same generation deployed with ITS OWN correct value. One build cannot serve
 * both origins correctly, because the origin is compiled in.
 *
 * Recorded as PWA-SITE-URL-REBUILD-1.
 */
describe('B5-B · NEXT_PUBLIC_SITE_URL is build-time, so DOMAIN-1 must rebuild', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', 'lib', 'seo', 'siteOrigin.ts'),
    'utf-8',
  );

  it('is read as a STATIC property access, which is what makes it inlinable', () => {
    /*
      If this ever became a computed access, Next would stop inlining it and the
      variable would start being read at runtime — which would CHANGE the
      deployment requirement this file records. The assertion exists so that
      change cannot happen silently in either direction.
    */
    expect(source).toContain('process.env.NEXT_PUBLIC_SITE_URL');
    expect(source).not.toMatch(/process\.env\[/);
  });

  it('and the file itself states the build-time inlining it depends on', () => {
    expect(source).toContain('inlines `process.env.NEXT_PUBLIC_*` at build time');
  });

  it('the value is validated hard, so a wrong host fails closed to null rather than half-working', () => {
    /*
      Good design, and worth pinning: an origin with a path, a query, a
      fragment, credentials or a non-http protocol is rejected outright. That
      turns "somebody pasted the dashboard URL" into no canonical tag at all,
      which is recoverable, instead of a canonical tag pointing somewhere wrong,
      which is not obviously wrong to anyone looking.
    */
    for (const reason of [
      'bad-protocol',
      'has-credentials',
      'has-query',
      'has-fragment',
      'has-path',
    ]) {
      expect(source).toContain(reason);
    }
  });

  it('no build-time origin is hardcoded anywhere as a fallback', () => {
    /*
      A default would be worse than null here: it would make the
      misconfiguration invisible by producing plausible absolute URLs for a host
      nobody chose.

      ── CORRECTED IN B5.1, AND THE MISS IS RECORDED ───────────────────────

      My first version asserted `not.toMatch(/https?:\/\/[a-z]/)` over the WHOLE
      FILE, which fails on `https://host` — an ILLUSTRATIVE URL inside
      siteOrigin.ts's own doc comments, present since long before B5 and
      changed by nothing.

      So this assertion was wrong the day I wrote it. It did not surface in B5
      because the file was created AFTER that gate's frontend regression had
      already started, so the run never executed it. B5's reported "5 failing
      suites" therefore omitted this one. Recorded rather than quietly fixed.

      The rule was always about CODE, not prose: no literal origin may be
      compiled in as a fallback. Comments are stripped, and the specific
      production host is still forbidden everywhere, prose included.
    */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(source).not.toMatch(/globalnewsai\.live/);
    expect(code).not.toMatch(/https?:\/\/[a-z]/);

    /* Positive control: the stripper did not simply empty the file. */
    expect(code).toContain('NEXT_PUBLIC_SITE_URL');
  });
});
