/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PLANNED ALPHA VISUAL SCOPE — PREVIEW-ONLY PRESENTATION, NOT DOMAIN DATA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Product Owner ruling: *"visual scope = Poland. Show Poland as the planned Alpha visual
 * scope in the preview chrome/header."* — with the constraint that makes it interesting:
 * *"Do not mutate or falsely bind the production Economy subject (`economyIso2: ZZ`)
 * merely to make the label appear. Use a preview-only presentation scope/label. The
 * eventual live route must derive geography from the actual bound subject."*
 *
 * ── WHY THIS LIVES IN `lib/specialist/` AND NOT IN THE ECONOMY DOMAIN ─────
 *
 * It was written in `components/economy/AlphaVisualPreview.tsx` first, and an accepted
 * guard rejected it — `ECON-UI-1 · fixtures are illustrative, never production facts`,
 * which forbids `Rwanda|Mombasa|Kigali|Poland|NISR|GUS` in every file under `lib/economy`
 * and `components/economy` outside the fixture module. `Poland` is in that list because
 * Poland is one of the DESIGN'S ILLUSTRATIVE ECONOMIES, and the guard exists so those
 * invented figures cannot leak out of `fixtures.ts` into anything a reader might take for
 * a production fact.
 *
 * That guard was not weakened, edited or suppressed, and its directory set is exactly as
 * accepted. The constant moved instead — because the guard was right about the file and
 * wrong about nothing. A planned presentation scope is not Economy domain data: it is not
 * an observation, not a subject, not a dimension value the domain reasons over, and it
 * takes no part in how a figure is chosen, compared or withheld. It is chrome for an
 * unrouted address, and `lib/specialist/` — the namespace holding the preview surfaces'
 * own guards — is where chrome for an unrouted address belongs.
 *
 * The distinction is load-bearing rather than cosmetic, and the test for it is what
 * happens next: when `/economy` opens, this module is deleted along with the preview, and
 * the live route derives its geography from the bound subject. Nothing in `lib/economy`
 * or `components/economy` has to be unwound first, because nothing there ever learned a
 * country name. Had the constant stayed in the Economy domain, that deletion would have
 * been a change to the domain rather than the removal of a preview.
 *
 * ── WHAT IT DELIBERATELY IS NOT ───────────────────────────────────────────
 *
 * Not a binding. `PRODUCTION_SHAPED_SUBJECT` still carries `economyIso2: 'ZZ'` and
 * `scopeLabel: 'No subject bound'`, and `previewScopeRuling.spec.ts` asserts both, so an
 * attempt to satisfy a header by editing the accepted module fails there first.
 *
 * Not translated. Like the preview marker that renders it, this addresses the Product
 * Owner inspecting a layout, not a reader; it carries no authored locale source and
 * disappears with the surface. `PL` is the publisher's own pinned dimension value, so the
 * plan is written in the vocabulary the eventual binding will actually use.
 */
export const ALPHA_PREVIEW_VISUAL_SCOPE = { label: 'Poland', geo: 'PL' } as const;
