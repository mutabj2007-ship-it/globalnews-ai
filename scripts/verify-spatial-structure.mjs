#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * SPATIAL VISUAL GATE — PART A · STRUCTURAL ASSERTIONS (C907 §11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The ruling asks for a three-part gate:
 *
 *   A  structural assertions: layers, controls, token resolution, camera,
 *      rail geometry
 *   B  perceptual screenshot comparison  (scripts/compare-golden-frame.mjs)
 *   C  mandatory Product Owner visual acceptance  (docs/spatial-visual-gate.md)
 *
 * This is A. It runs in a plain `node` process with no browser and no
 * dependencies, so it can gate every commit rather than only a release.
 *
 * ── WHY STRUCTURE IS A SEPARATE PART FROM PIXELS ────────────────────────────
 *
 * Every defect the C907 audit found was invisible to a green Jest suite AND
 * would have been invisible to a perceptual threshold tuned on a frame that
 * already contained it. They are not subtle rendering differences; they are
 * MISSING THINGS — a token family that was never defined, a layer nobody
 * wrote, a registry claiming a layer that did not exist, a colour token with
 * no consumer. A structural check finds an absence directly, in milliseconds,
 * and names it. A screenshot diff can only find it if someone first captured a
 * frame that had it.
 *
 * Each check below is aimed at a failure the ruling names by name.
 *
 * Usage: node scripts/verify-spatial-structure.mjs [--worktree <abs>]
 * Exit 0 = all checks pass. Exit 1 = at least one fails.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const explicit = args.indexOf('--worktree') === -1 ? undefined : args[args.indexOf('--worktree') + 1];

function findRoot() {
  if (explicit) return resolve(explicit);
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'frontend', 'tailwind.config.ts'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.error('SPATIAL STRUCTURE GATE — FAIL: could not locate the worktree root.');
  process.exit(1);
}

const ROOT = findRoot();
/**
 * A required source file.
 *
 * A MISSING FILE IS A GATE FAILURE, NOT A CRASH. The first thing this gate is
 * for is detecting that something is not there — a module nobody wrote is the
 * single most common shape of every defect the C907 audit found — so an absent
 * path is reported as the failure it is, with the name of what is missing,
 * rather than as an ENOENT stack trace that reads like the gate is broken.
 */
const missing = [];
const read = (...parts) => {
  const full = join(ROOT, ...parts);
  if (!existsSync(full)) {
    missing.push(parts.join('/'));
    return '';
  }
  return readFileSync(full, 'utf8');
};

const canvas = read('frontend/src/components/map/shell/EvidenceMapCanvas.tsx');
const registry = read('frontend/src/lib/map/layers/layerRegistry.ts');
const tokens = read('frontend/src/lib/map/spatial/designRenderTokens.ts');
const framing = read('frontend/src/lib/map/camera/worldFraming.ts');
const shell = read('frontend/src/components/map/shell/GlobalMapShell.tsx');
const rail = read('frontend/src/components/map/shell/LayerToggleRail.tsx');

const failures = [];
const passes = [];

/** `name` must hold. `detail` is printed only on failure. */
function check(name, condition, detail) {
  if (condition) passes.push(name);
  else failures.push({ name, detail });
}

/** The index of a marker, or -1. Used for z-order assertions. */
const at = (haystack, needle) => haystack.indexOf(needle);

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE REFERENCE GEOGRAPHY EXISTS AT ALL
   ══════════════════════════════════════════════════════════════════════════
   "The automated gate must fail on: … missing coastline, missing graticule,
    missing geographic context."
   These are absences, and an absence is what a screenshot diff is worst at. */

check(
  'coastline layer is added',
  at(canvas, 'id: COASTLINE_LAYER_ID,') > -1,
  'No coastline layer. The land/water edge is the brightest reference line and v1.5 moved it furthest.',
);

check(
  'coastline is painted with the coast token, not the border token',
  /id: COASTLINE_LAYER_ID,[\s\S]{0,600}?REFERENCE_COLOURS\.coast/.test(canvas),
  'The coastline must use landEdge #55707f. Golden measurement: brightest boundary pixels (81.9, 109.4, 122.7).',
);

check(
  'coastline uses the coast width ramp, not the border ramp',
  /id: COASTLINE_LAYER_ID,[\s\S]{0,600}?referenceLineWidth\('coast'\)/.test(canvas),
  "The prototype's own ramp is min(1.4, .7 + k * .02) — DESIGN_REFERENCE_WIDTH.coast.",
);

check(
  'internal borders are a separate layer at the border token',
  /id: OUTLINE_LAYER_ID,[\s\S]{0,400}?REFERENCE_COLOURS\.border/.test(canvas),
  'Shared admin-0 boundaries must retain the approved border treatment.',
);

check(
  'both edges come from the SAME 1:50m country basis',
  at(canvas, 'getSpatialCoastline()') > -1 && at(canvas, 'getSpatialInternalBorders()') > -1,
  'A second geometry dataset would reintroduce the C904 registration seam.',
);

check(
  'graticule layer is added',
  at(canvas, 'id: GRATICULE_LAYER_ID,') > -1,
  'Golden world measurement: 10° meridians at 33 px across the map pane.',
);

check(
  'hydrography is present',
  at(canvas, 'REFERENCE_LAYERS') > -1,
  'Lakes, rivers and sub-national lines are the geographic context the golden Rwanda frame shows.',
);

/* ══════════════════════════════════════════════════════════════════════════
   2 · LAYER ORDER
   ══════════════════════════════════════════════════════════════════════════
   "fail on: … incorrect layer order."
   The prototype's own draw loop is the authority for the reference band:
     ocean fill -> graticule -> land base -> states -> hydrography -> edges */

const iGraticule = at(canvas, 'id: GRATICULE_LAYER_ID,');
const iLand = at(canvas, 'id: LAND_LAYER_ID,');
const iReference = at(canvas, 'for (const layer of REFERENCE_LAYERS)');
const iCoast = at(canvas, 'id: COASTLINE_LAYER_ID,');
const iBorder = at(canvas, 'id: OUTLINE_LAYER_ID,');
const iEvidenceFill = at(canvas, 'id: FILL_LAYER_ID,');
const iEvidenceLine = at(canvas, 'id: EVIDENCE_LINE_LAYER_ID,');
const iSelectedFill = at(canvas, 'id: SELECTED_FILL_LAYER_ID,');
const iHalo = at(canvas, 'id: HALO_LAYER_ID,');
const iMark = at(canvas, 'id: MARK_LAYER_ID,');

check(
  'graticule is beneath the land fill',
  iGraticule > -1 && iGraticule < iLand,
  'The prototype strokes it after the ocean and before the land base, so land covers it.',
);

/*
  ── §0.1(1) FINAL RULING, ENFORCED ───────────────────────────────────────────
  "Reference geography remains BELOW intelligence … Move coastline/borders
   BELOW the evidence-state fill as well … Do not put reference geography on top
   of intelligence."
  The whole reference band is asserted below the FIRST intelligence layer, not
  merely below the last one — a halfway position is what this ruling rejected.
*/
const REFERENCE_BAND = [
  ['graticule', iGraticule],
  ['land fill', iLand],
  ['hydrography', iReference],
  ['coastline', iCoast],
  ['admin borders', iBorder],
];
const INTELLIGENCE_BAND = [
  ['evidence fill', iEvidenceFill],
  ['evidence stroke', iEvidenceLine],
  ['selected fill', iSelectedFill],
  ['evidence halo', iHalo],
  ['evidence markers', iMark],
];
const firstIntelligence = Math.min(...INTELLIGENCE_BAND.map(([, i]) => i));

for (const [name, index] of REFERENCE_BAND) {
  check(
    `reference below intelligence: ${name}`,
    index > -1 && index < firstIntelligence,
    'C907 §0.1(1): the whole reference band sits below the FIRST intelligence layer, the evidence fill included.',
  );
}

check(
  'the reference band is ordered land -> hydrography -> coast -> border',
  iLand < iReference && iReference < iCoast && iCoast < iBorder,
  'Water sits on the land it holes; the coast edges the land; the border is drawn last so it stays continuous at estuaries.',
);

check(
  'the prototype draw-loop order has NOT been restored',
  iCoast < iEvidenceFill && iBorder < iEvidenceFill,
  'The prototype strokes coast and border last, above the evidence states. C907 §0.1(1) supersedes that ordering.',
);

/*
  THE DOM BAND SPLIT. Geographic labels are reference and must sit beneath the
  DOM-drawn intelligence; evidence captions are intelligence and sit above it.
*/
const iRefLabels = at(canvas, 'data-gn="map-labels"');
const iRipples = at(canvas, 'data-gn="map-ripples"');
const iEvLabels = at(canvas, 'data-gn="map-labels-evidence"');

check(
  'geographic labels are a separate band beneath the intelligence ripple',
  iRefLabels > -1 && iRipples > -1 && iRefLabels < iRipples,
  'C907 §0.1(1) lists geographic labels among the reference layers.',
);

check(
  'evidence captions are drawn above the ripple, in their own band',
  iEvLabels > iRipples,
  'Intelligence text must not be occluded by intelligence motion.',
);

check(
  'both label bands share ONE renderer, so the ink cannot drift between them',
  (canvas.match(/\.map\(renderLabel\)/g) ?? []).length === 2,
  'Two bands must not become two renderers.',
);

/* ══════════════════════════════════════════════════════════════════════════
   3 · EVERY CONTROL GOVERNS A REAL LAYER, AND THE REGISTRY TELLS THE TRUTH
   ══════════════════════════════════════════════════════════════════════════
   The graticule was declared runtime: 'LIVE' and available while no layer
   existed. A registry that can lie about a layer is a HUD that can lie. */

check(
  'the GRID control governs the graticule layer',
  /apply\(GRATICULE_LAYER_ID, layers\.graticule !== false\)/.test(canvas),
  'A rail control that governs nothing is a control that lies.',
);

check(
  'the LAND control governs the coastline',
  /apply\(COASTLINE_LAYER_ID, layers\.base !== false\)/.test(canvas),
  'The coastline is the edge of the land fill, not an administrative boundary.',
);

check(
  'the registry no longer points the graticule at a camera-derived layer that does not exist',
  /id: 'graticule'[\s\S]{0,900}?graticule\.ts/.test(registry),
  'runtimeEvidence must name the module that actually draws it.',
);

check(
  'the rail still declares the controls it shows',
  at(rail, "graticule: 'GRID'") > -1 && at(rail, "base: 'LAND'") > -1,
  'Rail codes and layer wiring must not drift apart.',
);

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE PALETTE IS READ, NOT RESTATED
   ══════════════════════════════════════════════════════════════════════════
   "fail on: palette/luminance drift."
   The measured cause of the label drift was four hex literals in JSX that
   could not receive the v1.5 revision the token module did receive. */

/*
  The single label renderer both bands share. §0.1(1) split the overlay in two;
  the renderer stayed one, which is what this slice reads.
*/
const LABEL_BLOCK = canvas.slice(
  at(canvas, 'const renderLabel ='),
  at(canvas, 'data-gn="map-canvas-failed"'),
);
const labelCode = LABEL_BLOCK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

check(
  'no colour literal survives in the label render block',
  !/#[0-9a-fA-F]{6}|rgba?\(/.test(labelCode),
  'Label ink must come from DESIGN_LABEL so a token revision reaches it.',
);

check(
  'the label block reads DESIGN_LABEL',
  at(labelCode, 'DESIGN_LABEL[label.kind].colour') > -1 && at(labelCode, 'DESIGN_LABEL.shadow') > -1,
  'One lookup per kind, so a new kind that forgets its entry is a type error.',
);

for (const [role, value] of [
  ['country', "'#cfe0ea'"],
  ['capital', "'#dceaf1'"],
  ['continent', "'rgba(167,192,206,.62)'"],
  ['water', "'#5f97ab'"],
  ['river', "'#4d7d90'"],
  ['city', "'#a8bdc9'"],
]) {
  check(
    `label token ${role} is the v1.5 value`,
    new RegExp(`${role}:\\s*\\{[^}]*colour:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(tokens),
    `v1.5 replaced the pre-revision value for ${role}; the token must carry the IS column.`,
  );
}

for (const [name, value] of [
  ['ocean', '#040a10'],
  ['land', '#1e2b36'],
  ['landEdge', '#55707f'],
  ['border', '#3d5563'],
  ['water', '#0d2530'],
  ['waterEdge', '#164a5c'],
  ['river', '#154251'],
  ['graticule', 'rgba(126,166,186,.075)'],
]) {
  check(
    `reference token ${name} is unchanged`,
    tokens.includes(`${name}: '${value}'`),
    'C907 §2: preserve the approved reference values exactly. Do not redesign, harmonise or approximate.',
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5 · FRAMING
   ══════════════════════════════════════════════════════════════════════════
   "fail on: tiny-world framing." */

check(
  'the minimum zoom is viewport-derived',
  /Math\.log2\(span \/ TILE_SIZE\)/.test(framing),
  'A hardcoded floor cannot keep the world filling a pane whose width it does not know.',
);

check(
  'the engine is given that floor, on mount and on resize',
  /map\.setMinZoom\(effectiveMinZoom\(size\.w, size\.h\)\)/.test(canvas),
  'Without setMinZoom the rule is a function nobody calls.',
);

check(
  'RESET WORLD is framed for the pane',
  /isWorldCameraRequest\(target\)/.test(canvas),
  'A fixed world zoom reproduces the golden composition at exactly one viewport width.',
);

check(
  'the C906 canonical longitude correction is intact',
  at(canvas, 'transformConstrain') > -1 && /renderWorldCopies: false/.test(canvas),
  'One painted world, free horizontal pan, no runaway longitude — none of it may be traded for framing.',
);

/* ══════════════════════════════════════════════════════════════════════════
   6 · LABEL DENSITY
   ══════════════════════════════════════════════════════════════════════════
   "fail on: label explosion." The C906 structural fixes must survive. */

const labelSources = read('frontend/src/lib/map/labels/labelSources.ts');

for (const [name, marker] of [
  ['class zoom floors', 'REFERENCE_CLASS_FLOOR'],
  ['per-class caps', 'REFERENCE_CLASS_CAP'],
  ['geographic viewport guard', 'withinVisibleWorld'],
]) {
  check(`C906 ${name} preserved`, at(labelSources, marker) > -1, 'The C906 density contract must not regress.');
}

/*
  THE WORLD VIEW STAYS SPARSE, asserted on the VALUES rather than on the text.

  The floors are parsed out of the declaration and each is compared against the
  world camera's own zoom, so this survives a reformat, a reordering or a type
  annotation — and it states the actual requirement ("no class is drawn at
  world scale") instead of a literal that happens to satisfy it today.
*/
const floorBlock = labelSources.slice(
  at(labelSources, 'export const REFERENCE_CLASS_FLOOR'),
  at(labelSources, 'export const REFERENCE_CLASS_CAP'),
);
const floors = Object.fromEntries(
  [...floorBlock.matchAll(/\b(lake|city|river):\s*([0-9.]+)/g)].map((m) => [m[1], Number(m[2])]),
);
const worldZoom = Number(/zoom:\s*([0-9.]+)/.exec(read('frontend/src/lib/map/camera/cameraState.ts').slice(
  at(read('frontend/src/lib/map/camera/cameraState.ts'), 'export const WORLD_CAMERA'),
))?.[1]);

check(
  'all three reference classes declare a zoom floor',
  ['lake', 'city', 'river'].every((kind) => Number.isFinite(floors[kind])),
  'A class with no floor is a class that draws at world scale.',
);

for (const kind of ['lake', 'city', 'river']) {
  check(
    `the world view stays sparse — no ${kind} label at the world camera`,
    floors[kind] > worldZoom,
    `Floor ${floors[kind]} must sit above the world camera's ${worldZoom}. No river wall, no city wall, no lake wall.`,
  );
}

check(
  'rivers are the strictest class, because rivers are what failed',
  floors.river > floors.city && floors.city > floors.lake,
  'ANGARA · ERTIS · ALBERT NILE · BAHR EL JEBEL · LUALABA · SHIRE tiled the Alpha viewport.',
);

/* ══════════════════════════════════════════════════════════════════════════
   7 · HUD AND RAIL GEOMETRY
   ══════════════════════════════════════════════════════════════════════════
   "fail on: missing HUD, rail geometry regression."
   The prototype's own grid is 52px rail / 1fr map / 372px panel. */

check('right rail is 372px', /w-\[372px\]/.test(shell), 'Prototype `grid-template-columns: 52px 1fr 372px`.');
check('layer rail is 52px', /w-\[52px\]/.test(shell), 'Prototype `grid-template-columns: 52px 1fr 372px`.');
check(
  'the rail carries a ground and a separating border',
  /bg-sp-panel/.test(shell) && /border-sp-line/.test(shell),
  'v1.5: the rail must "sit above the map rather than beside it".',
);
check('the evidence legend HUD is mounted', at(shell, 'EvidenceLegend') > -1, 'Missing HUD.');
check('the layer toggle rail is mounted', at(shell, 'LayerToggleRail') > -1, 'Missing HUD.');

/* ══════════════════════════════════════════════════════════════════════════
   8 · THE ACCEPTANCE MECHANISM IS INSIDE FINGERPRINT GOVERNANCE
   ══════════════════════════════════════════════════════════════════════════
   C907 §0.1(5): "The acceptance mechanism itself must never be outside
   fingerprint governance." Everything that DECIDES Spatial acceptance lives
   under scripts/, which is the SC scope. */

for (const asset of [
  'scripts/spatial-visual/cases.ts',
  'scripts/spatial-visual/spatial-visual.spec.ts',
  'scripts/spatial-visual/compare-golden-frame.mjs',
  'scripts/spatial-visual/golden-authority.manifest.json',
  'scripts/verify-golden-authority.mjs',
]) {
  check(
    `visual-release asset is under SC: ${asset}`,
    existsSync(join(ROOT, asset)),
    'Moving it out of scripts/ removes it from candidate identity.',
  );
}

check(
  'no visual-release machinery is left outside SC',
  !existsSync(join(ROOT, 'frontend', 'e2e')),
  'frontend/e2e is in no fingerprint scope. The ruling rejects a fourth pile of mutable release files.',
);

if (existsSync(join(ROOT, 'scripts/spatial-visual/golden-authority.manifest.json'))) {
  const manifest = JSON.parse(read('scripts/spatial-visual/golden-authority.manifest.json'));
  const ids = manifest.frames.map((frame) => frame.id);

  for (const id of ['V1', 'V2', 'V3', 'V4']) {
    check(`golden manifest declares ${id}`, ids.includes(id), 'All four protected frames must be declared.');
  }

  check(
    'every manifest frame carries an authority description',
    manifest.frames.every((frame) => typeof frame.authority === 'string' && frame.authority.length > 0),
    'A frame must say what it is authority FOR.',
  );

  check(
    'every APPROVED frame carries a sha256 and its dimensions',
    manifest.frames
      .filter((frame) => frame.status === 'APPROVED')
      .every((frame) => frame.sha256 && frame.width && frame.height && frame.filename),
    'An approved golden without an identity is an ungoverned golden.',
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   8b · THE CAPITAL FLAG IS SOURCE-DERIVED, NEVER GUESSED
   ══════════════════════════════════════════════════════════════════════════
   C907 §0.1(6) final ruling: "`capital` may remain in the reference-place seed
   only when it is directly derived from the governed Natural Earth source
   field … no manual guessing, no inferred capitals, absent source value →
   absent/false." */

const generator = read('scripts/build-reference-geography.mjs');
const seeds = read('frontend/src/lib/map/labels/referencePlaces.ts');

check(
  'the capital flag is read from Natural Earth’s own ADM0CAP field',
  /capital:\s*Number\(f\.properties\.adm0cap \?\? 0\) === 1/.test(generator),
  'It must come from the governed source field, not from a name list or a heuristic.',
);

check(
  'an absent source value yields false, never a guess',
  /adm0cap \?\? 0/.test(generator),
  'The nullish default is what makes "absent source value -> absent/false" true.',
);

check(
  'the generator holds no hand-written capital list',
  !/(capitals?\s*[:=]\s*\[)|(CAPITAL_(NAMES|LIST))/i.test(generator),
  'No manual guessing, no inferred capitals.',
);

check(
  'the shipped seed actually carries the source-derived flag, both ways',
  /"capital":true/.test(seeds) && /"capital":false/.test(seeds),
  'A flag that is never true is a field nobody derived; a flag that is never false is a field nobody gated.',
);

check(
  'the capital marker is reference cartography and carries no evidence',
  !/capital[\s\S]{0,200}(evidence|precision|sourcesCount|reports)/i.test(
    read('frontend/src/lib/map/labels/labelSources.ts'),
  ),
  'It never creates evidence, never raises precision and never increases report counts.',
);

/* ══════════════════════════════════════════════════════════════════════════
   9 · GOVERNANCE SUPERSESSIONS ARE RECORDED WHERE THEY CAN BE FOUND
   ══════════════════════════════════════════════════════════════════════════
   Both have been lost once by an agent reading the superseded document alone. */

check(
  'the v1.7 underzoom supersession is recorded beside the code that implements it',
  /GOVERNANCE SUPERSESSION/.test(framing) && /SUPERSEDED for the protected Spatial release/.test(framing),
  'C907 §0.1(4): record it so a later agent does not restore the obsolete underzoom as a regression fix.',
);

/* ══════════════════════════════════════════════════════════════════════════
   10 · THE GATES ARE PACKAGED WHERE THEY CAN ACTUALLY RUN, AND PART B IS REAL
   ══════════════════════════════════════════════════════════════════════════
   C907 R2. Two defects, one visible and one not.

   VISIBLE: Railway frontend deployment 34cf76f9 died with

       Cannot find module '/app/scripts/verify-spatial-tokens.mjs'

   because the build script ran the gates from `../scripts/` while the image
   build stage copied only `shared` and `frontend`.

   NOT VISIBLE, AND WORSE: the first correction moved the golden-authority
   command into a release script and described the result as "full Part B runs
   for every release candidate". It did not. That command verified the golden
   BINARIES and never captured or compared a frame. The runner it was standing
   in for could not have executed at all — it imported a module that did not
   exist, waited on a DOM attribute nothing emits, read two `window` globals no
   product file sets, and asked for determinism through a `fixture=` parameter
   no product code reads.

   A gate that cannot run is not a gate, and a package that says it runs is
   worse than one that says it is missing. These checks assert the WHOLE chain
   exists — golden authority, frame execution, perceptual comparison — and that
   the runner's real dependencies are present. */

const frontendPkg = read('frontend/package.json');
const rootPkg = read('package.json');
const frontendDockerfile = read('frontend/Dockerfile');
const visualRunner = read('scripts/run-visual-gate.mjs');
const visualSpec = read('scripts/spatial-visual/spatial-visual.spec.ts');
const visualCases = read('scripts/spatial-visual/cases.ts');

/* ── Part A belongs in the image build ── */

check(
  'the frontend build still runs the Spatial token gate',
  /"build":\s*"[^"]*verify-spatial-tokens\.mjs/.test(frontendPkg),
  'Part A is source-truth and must gate every build, image builds included.',
);

check(
  'the frontend build still runs the Spatial structure gate',
  /"build":\s*"[^"]*verify-spatial-structure\.mjs/.test(frontendPkg),
  'A candidate that fails the structural assertions must not be buildable.',
);

check(
  'the frontend image build copies scripts/ into the build stage',
  /^COPY scripts \.\/scripts$/m.test(frontendDockerfile),
  'Without it the Part A gates cannot be resolved at /app/scripts and the image build dies.',
);

check(
  'the frontend build does NOT depend on the golden capture binaries',
  !/"build":\s*"[^"]*verify-golden-authority\.mjs/.test(frontendPkg) &&
    !/"build":\s*"[^"]*run-visual-gate\.mjs/.test(frontendPkg),
  'The approved goldens live outside the repository by design and are never copied into an application image, so requiring them during image construction can only be satisfied by shipping or faking them.',
);

/* ── Part B must be the WHOLE chain, not the manifest check wearing its name ── */

check(
  'the release gate runs the visual RUNNER, not merely the golden manifest check',
  /"verify:visual-authority":\s*"node scripts\/run-visual-gate\.mjs"/.test(rootPkg),
  'Pointing this at verify-golden-authority.mjs alone verifies the reference and captures nothing, while claiming Part B runs. That was the C907 R2 review finding.',
);

check(
  'a production release entry point requires every frame, so PENDING blocks Production',
  /"verify:visual-authority:production":\s*"node scripts\/run-visual-gate\.mjs --require-all"/.test(rootPkg),
  'V3 and V4 are PENDING. --require-all is what stops an unapproved frame reaching Production as a silent pass.',
);

check(
  'the runner chains golden authority BEFORE frame execution',
  /verify-golden-authority\.mjs/.test(visualRunner) && /playwright\.config\.mjs/.test(visualRunner),
  'Comparing captures against an unverified reference proves nothing, so stage 1 must gate stage 2.',
);

check(
  'a missing Playwright runner FAILS the gate rather than skipping it',
  /@playwright\/test/.test(visualRunner) && /process\.exit\(1\)/.test(visualRunner),
  'An absent measurement is not a satisfied one. A gate that goes green because its runner is missing converts a gap into a positive claim.',
);

/* ── the runner's own dependencies must exist ── */

for (const asset of [
  'scripts/run-visual-gate.mjs',
  'scripts/spatial-visual/decodePng.mjs',
  'scripts/spatial-visual/interception.mjs',
  'scripts/spatial-visual/playwright.config.mjs',
  'scripts/spatial-visual/fixtures',
]) {
  check(
    `the Part B runner dependency exists: ${asset}`,
    existsSync(join(ROOT, asset)),
    'The first issue of this runner imported a module that was never written, so Part B could not have executed.',
  );
}

check(
  'the runner decodes captures with the in-repo decoder',
  /from '\.\/decodePng\.mjs'/.test(visualSpec),
  'It previously imported ./decodePng, which did not exist.',
);

check(
  'the runner pins evidence by harness interception',
  /from '\.\/interception\.mjs'/.test(visualSpec) && /installPinnedEvidence/.test(visualSpec),
  'Determinism must come from the harness, not from a fixture branch shipped to users.',
);

check(
  'the runner FAILS when any API endpoint went unpinned',
  /evidence\.missing/.test(visualSpec),
  'A harness that falls back to the live feed is non-deterministic exactly when a fixture is missing.',
);

check(
  'the protected cases no longer ask the product for a fixture parameter',
  !/fixture:\s*'/.test(visualCases),
  'No product code ever read fixture=golden-*, so every capture taken that way was against live evidence.',
);

check(
  'the runner reads no test-only product globals',
  !/window\.__gn/.test(visualSpec.replace(/\/\*[\s\S]*?\*\//g, '')),
  'window.__gnGeographicOccupancy and window.__gnWorldSpanDegrees were never set by any product file, and `?? 0` hid that.',
);

/* ── PENDING IS CAPTURED, NEVER CERTIFIED ──
   C907 R2 review finding. The runner compared every frame, while the comparator
   holds measurements only for V1/V2 — so the ordinary Alpha gate could never
   pass while V3/V4 were legitimately PENDING. The repair must not be a skip:
   "nobody wrote a threshold" and "the Product Owner approved this" have to stay
   distinguishable, which is what the authority manifest is for. */

check(
  'frame status is read from the SC-owned authority manifest',
  /golden-authority\.manifest\.json/.test(visualSpec) && /statusOf/.test(visualSpec),
  'The manifest is the one artefact a Product Owner ruling moves. Deciding status anywhere else puts acceptance outside fingerprint governance.',
);

check(
  'a PENDING frame is captured but explicitly NOT CERTIFIED',
  /PENDING/.test(visualSpec) && /NOT CERTIFIED/.test(visualSpec),
  'A pending capture exists for Part C inspection. It must never read as evidence the frame is correct.',
);

check(
  'a PENDING frame is never compared against golden measurements',
  /if \(status === 'PENDING'\)[\s\S]{0,1200}?return;/.test(visualSpec),
  'Comparing a frame with no approved reference is how an absent authority becomes a satisfied one.',
);

check(
  'the Production gate fails on a PENDING frame inside the runner too',
  /SPATIAL_VISUAL_REQUIRE_ALL/.test(visualSpec) && /SPATIAL_VISUAL_REQUIRE_ALL/.test(visualRunner),
  '--require-all must be enforced in both stages, so neither entry point can certify a frame nobody approved.',
);

check(
  'an APPROVED frame with no golden measurements is a hard failure',
  /no golden measurements/.test(visualSpec),
  'An approved frame without a threshold is an uncertified frame, and must fail rather than be skipped.',
);

check(
  'a protected case absent from the manifest is a hard failure',
  /absent from golden-authority\.manifest\.json/.test(visualSpec),
  'An undeclared case is ungoverned: nothing says whether it should be certified or ignored.',
);

check(
  'the pinned validation-tooling procedure is recorded under SC',
  existsSync(join(ROOT, 'scripts/spatial-visual/VALIDATION-TOOLING.md')),
  'The Alpha validation environment needs an exact runner version; "whatever npm resolved" can move the pixels the thresholds measure.',
);

check(
  'the runner waits on measured settling, not on an attribute nothing emits',
  /captureSettledPane/.test(visualSpec) && !/data-gn-idle="true"/.test(visualSpec.replace(/\/\*[\s\S]*?\*\//g, '')),
  'The idle attribute does not exist in the product, so every run would have died on a 20-second timeout.',
);

/* ══════════════════════════════════════════════════════════════════════════
   11 · NO LINT DIRECTIVE NAMES A RULE THE FRONTEND DOES NOT HAVE
   ══════════════════════════════════════════════════════════════════════════
   C907, Railway frontend deployment 11651910. The R2 packaging correction
   worked — npm ci, COPY scripts, shared build, token gate 42/42, structure gate
   and Next compilation all passed — and the build then died in `next lint`:

       ./src/lib/map/spatial/spatialChromeTokens.spec.ts
       190:5  Error: Definition for rule
       '@typescript-eslint/no-var-requires' was not found.

   The frontend extends `next/core-web-vitals` and `prettier` and declares no
   TypeScript-ESLint plugin, so that rule does not exist here. ESLint treats a
   directive naming an undefined rule as an ERROR, not a warning — a suppression
   comment for a rule nobody loaded fails the build that the comment was
   supposed to keep quiet.

   THE COMMENT WAS ALSO SUPPRESSING NOTHING. It guarded a `require()` that had
   no reason to be lazy: `designRenderTokens.ts` is a leaf module with zero
   imports, so a static import cannot cycle. The fix removes the require and the
   directive together; no rule was disabled, because none was ever enabled.

   This check is what stops the class returning. It reads the directives rather
   than the rules, so it needs no ESLint and no node_modules, and it runs inside
   `next build` like the rest of Part A. */

const lintPluginPrefixes = new Set([
  /* supplied by eslint-config-next / next/core-web-vitals */
  '@next/next',
  'react-hooks',
  'react',
  'jsx-a11y',
  'import',
]);

const directiveFiles = [];
const collectSources = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSources(full);
    else if (/\.(ts|tsx)$/.test(entry)) directiveFiles.push(full);
  }
};
collectSources(join(ROOT, 'frontend', 'src'));

const unknownRuleDirectives = [];
for (const file of directiveFiles) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    /* Only real directive comments. A spec that merely mentions the words
       "eslint-disable" inside a string or a regex is not a directive, and two
       specs in this repository legitimately do exactly that. */
    const match = /^\s*(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?\s+([^*\n]+)/.exec(line);
    if (!match) return;
    for (const raw of match[1].split(',')) {
      const rule = raw.trim().replace(/\s*--.*$/, '');
      if (rule === '') continue;
      const slash = rule.lastIndexOf('/');
      if (slash === -1) continue; /* a core ESLint rule; always defined */
      const prefix = rule.slice(0, slash);
      if (!lintPluginPrefixes.has(prefix)) {
        unknownRuleDirectives.push(`${relative(ROOT, file)}:${index + 1} → ${rule}`);
      }
    }
  });
}

check(
  'every eslint-disable directive names a rule this frontend actually loads',
  unknownRuleDirectives.length === 0,
  'ESLint fails the build on a directive for an undefined rule, so a suppression comment for a plugin the frontend does not declare BREAKS `next lint`. Offenders: ' +
    (unknownRuleDirectives.join('; ') || 'none'),
);

/* ══════════════════════════════════════════════════════════════════════════
   REPORT
   ══════════════════════════════════════════════════════════════════════════ */

for (const path of missing) {
  failures.unshift({
    name: `required source is missing: ${path}`,
    detail: 'Every check that reads this file was skipped, so the gate cannot vouch for it.',
  });
}

if (failures.length > 0) {
  console.error('');
  console.error('SPATIAL STRUCTURE GATE — FAIL');
  for (const failure of failures) {
    console.error(`  ✗ ${failure.name}`);
    console.error(`      ${failure.detail}`);
  }
  console.error('');
  console.error(`  ${passes.length} passed, ${failures.length} failed`);
  console.error('');
  process.exit(1);
}

console.log(`SPATIAL STRUCTURE GATE — PASS · ${passes.length} checks`);
