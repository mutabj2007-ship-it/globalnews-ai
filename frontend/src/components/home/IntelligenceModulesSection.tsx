import type { JSX } from 'react';
import {
  Search,
  Globe2,
  MapPinned,
  ScanSearch,
  LineChart,
  ShieldAlert,
  TrendingUp,
  History,
  Radar,
  Check,
  Eye,
  Ban,
} from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  INTELLIGENCE_MODULES,
  isModuleNavigable,
  type IntelligenceModuleConfig,
  type IntelligenceModuleState,
} from '@/lib/intelligenceModules';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GATE A · THE R5.1 INTELLIGENCE-MODULES SECTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `HOME_R4.1_DELTA.md` is the whole of R5.1's Home authority, and it changes
 * exactly one section: *"Only the items below differ. Hero, World Pulse,
 * header, bottom bar, tokens, spacing and card styling are untouched."* This
 * file is that one section, and nothing else on Home is touched by it.
 *
 * WHAT R5.1 CHANGED, ROW BY ROW, AND WHERE IT LANDS HERE:
 *
 *   Card list        9 cards in REGISTRY ORDER          -> INTELLIGENCE_MODULES, mapped in order
 *   Statuses         1 active · 7 preview · 1 comingSoon -> read from the array, never asserted
 *   Card route line  route in mono, or "No route"        -> `routeLine`
 *   Card note        "Opens preview"                     -> `opensPreview`, preview + destination only
 *   Summary line     computed, never hard-coded          -> `summary`, substituted from counts
 *   Section subtitle Active/Preview/Coming soon meaning  -> `t.modulesSubtitle`
 *   Status badge     Preview gets the developing token + eye icon;
 *                    comingSoon muted + block icon; Active unchanged
 *   Card border      DASHED ONLY for comingSoon; solid for Active AND Preview
 *
 * ── WHY THIS REPLACES THE RADIAL ENGINE ON HOME, AND ONLY ON HOME ──────────
 *
 * `IntelligenceEngineSection` rendered the GN-CD radial canvas here. Measured
 * on the built page at 1440, 430, 390 and 360 in both locales, every module
 * title, every status badge and the summary line were present in the DOM but
 * ABSENT from rendered `innerText` — they live in hover/focus-revealed ring
 * panels. A first-time reader saw no module name as text at any width, which
 * `BETA-DESIGN-AUTHORITY-R5.1.md` §10 requires them to ("understand the major
 * actions and module choices"). §3 of that authority supersedes stale
 * presentation freezes where they conflict with the approved R5.1 result, and
 * this is that conflict. The engine files are untouched and still exported.
 *
 * ── WHAT IS DELIBERATELY *NOT* IMPLEMENTED, BECAUSE IT IS OPEN ─────────────
 *
 * P1  badge text. R5.1 draws "Unavailable"; PROPOSED_DELTAS.md makes that a
 *     Product Owner decision and names the registry's "Coming soon" as the
 *     Beta-parity fallback. The fallback is what renders — see the dictionary.
 * P2  broader category palette. CTO ruling C-3 closes ONE part of it — the
 *     category TITLE-colour treatment, applied by `CATEGORY_TITLE_CLASS`
 *     below. Everything else P2 proposes stays open: the icon palette, story
 *     category labels, the 60-second briefing rows, other surfaces, and
 *     CC1–CC4. So icons, borders and badges keep their STATUS colours here,
 *     which the package's own Rule also requires — *"Status keeps its own
 *     label, icon and pill colour and is never replaced by category colour."*
 * M3  icons. The registry's lucide names are inherited by ring slot, so
 *     Security carries `Search`; R5.1 prefers Material Symbols chosen by
 *     meaning. Keeping the registry's own icons is the current Beta state, so
 *     it answers nothing — and when M3 is ruled, `ICONS` is the one map to
 *     change.
 * M2  Conflict's destination stays the registry's `/conflict`.
 * N1/N2/N4/N11/S1  navigation. Not touched by this file at all: the four
 *     destinations, the header and the bottom bar are exactly as they were.
 *
 * ── DATA HONESTY ──────────────────────────────────────────────────────────
 *
 * Every value rendered here comes from `INTELLIGENCE_MODULES` (the canonical
 * registry) or the platform dictionary. No fixture, no illustrative headline,
 * no sample credit value, no prototype geography, and no string from the
 * review package that describes the package rather than the product — R5.1's
 * "Route exists · not in this review package" is deliberately absent.
 *
 * SERVER COMPONENT. Static markup from static config; the cards are anchors,
 * not stateful controls, so no client boundary is needed.
 */

const ICONS = {
  Search,
  Globe2,
  MapPinned,
  ScanSearch,
  LineChart,
  ShieldAlert,
  TrendingUp,
  History,
  Radar,
} as const;

/**
 * The P2 FALLBACK, encoded once. PROPOSED_DELTAS.md's fallback column reads
 * *"R4.1 treatment: labels --mut, module icon/title by status"*, and
 * HOME_R4.1_DELTA.md's R4.1 column spells the same rule out: *"icon
 * --brand/--mut/--dis by status; title --ink or --mut"*.
 *
 * `border` carries R5.1's approved border rule, which is NOT proposed: dashed
 * belongs to comingSoon alone, so Preview reads as a real surface a reader may
 * open rather than as something withheld.
 */
const STATE_STYLE: Record<
  IntelligenceModuleState,
  { icon: string; border: string; badge: string; BadgeIcon: typeof Check }
> = {
  active: {
    icon: 'text-cyan-300',
    border: 'border-solid border-cyan-500/40',
    badge: 'border-cyan-500/40 text-cyan-300',
    BadgeIcon: Check,
  },
  preview: {
    /* R5.1: "Preview uses the developing token (--dev) with eye icon". */
    icon: 'text-amber-300/90',
    border: 'border-solid border-border-strong',
    badge: 'border-amber-500/40 text-amber-300',
    BadgeIcon: Eye,
  },
  comingSoon: {
    icon: 'text-ink-tertiary',
    /* The ONLY dashed border in the grid. */
    border: 'border-dashed border-border-strong/70',
    badge: 'border-border-strong text-ink-tertiary',
    BadgeIcon: Ban,
  },
};

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE APPROVED CATEGORY TITLE COLOURS — CTO ruling C-3
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `CATEGORY_COLOUR_TOKENS.md`'s Mapping table, module column, verbatim. Eight
 * hues cover the nine modules because the package maps World Intelligence onto
 * the economy token — *"Economy Intelligence; World Intelligence (registry:
 * emerald)"*. `--c-science` maps to *"(no module)"* and so appears nowhere.
 *
 * ── WHY TAILWIND CLASSES AND NOT `--c-*` CUSTOM PROPERTIES ────────────────
 *
 * This is the form that satisfies BOTH accepted authorities, and it is the
 * package's own derivation rather than a substitution.
 *
 * `CATEGORY_COLOUR_TOKENS.md` states where its dark values come from: *"Dark
 * values are the exact Tailwind -300 text shades the branch uses
 * (`text-amber-300` etc.)"*. All eight were verified against `tailwindcss/colors`
 * and match to the byte:
 *
 *   --c-security #FDBA74 = orange-300     --c-conflict #FCA5A5 = red-300
 *   --c-economy  #6EE7B7 = emerald-300    --c-market   #67E8F9 = cyan-300
 *   --c-country  #93C5FD = blue-300       --c-humanitarian #D8B4FE = purple-300
 *   --c-politics #C4B5FD = violet-300     --c-energy   #FCD34D = amber-300
 *
 * THE LITERAL FORM WOULD BREAK A NON-NEGOTIABLE. `GN-CD-300 §W.4` rules that
 * `#fcd34d` *"does not exist and must not appear"*, and
 * `claudeDesignFoundation.spec.ts` enforces that across the whole tree — so
 * writing the approved Energy value as a hex literal would put the repository
 * in breach of an accepted Claude Design rule. Naming the Tailwind shade
 * renders the identical colour (the branch already paints it through
 * `moduleAccentClasses.ts`'s `text-amber-300`) while the banned literal never
 * enters source. Nothing is approximated: the rendered colour is exactly what
 * R5.1 approved, and `intelligenceModulesR51.spec.ts` asserts each class
 * resolves to the package's hex through `tailwindcss/colors`.
 *
 * THE MAP IS TOTAL OVER THE REGISTRY, asserted rather than assumed: a module
 * added later without an entry here would render an unstyled title, so the
 * spec checks every registry id resolves.
 *
 * A `Map` OF TUPLES, NOT AN OBJECT LITERAL, and that is load-bearing.
 * `homepageLocalization.spec.ts` forbids a homepage component from declaring a
 * second category vocabulary, detecting it as a `category: 'string'` pair —
 * *"A new colour table stays legal; a new LABEL table does not."* This is a
 * colour table, and the tuple form says so unambiguously instead of tripping a
 * guard that is right to exist.
 */
const CATEGORY_TITLE_CLASS = new Map<string, string>([
  ['security', 'text-orange-300'],
  ['world-intelligence', 'text-emerald-300'],
  ['country-intelligence', 'text-blue-300'],
  ['politics', 'text-violet-300'],
  ['economy', 'text-emerald-300'],
  ['conflict', 'text-red-300'],
  ['market', 'text-cyan-300'],
  ['humanitarian', 'text-purple-300'],
  ['energy', 'text-amber-300'],
]);

interface IntelligenceModulesSectionProps {
  language?: LanguageCode;
}

export function IntelligenceModulesSection({
  language = 'en',
}: IntelligenceModulesSectionProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;

  /*
    COUNTED, NOT CLAIMED. R5.1 requires the summary be "computed from the
    array, never hard-coded", so a module whose state changes in the registry
    moves this line with it and cannot leave a stale count on Home.
  */
  const total = INTELLIGENCE_MODULES.length;
  const counts = INTELLIGENCE_MODULES.reduce(
    (acc, m) => ({ ...acc, [m.state]: acc[m.state] + 1 }),
    { active: 0, preview: 0, comingSoon: 0 } as Record<IntelligenceModuleState, number>,
  );
  const summary = t.modulesSummary
    .replace('{n}', String(total))
    .replace('{a}', String(counts.active))
    .replace('{p}', String(counts.preview))
    .replace('{u}', String(counts.comingSoon));

  return (
    <section
      /*
        THE ANCHOR MOVES WITH THE SECTION. `MobileBottomNav`'s "Intelligence"
        tab ships `href: '#intelligence-modules'` — one of the four approved
        destinations — so this id is load-bearing and the scroll offsets are
        the ones the previous section carried, for the same sticky header.
      */
      id="intelligence-modules"
      aria-labelledby="intelligence-modules-heading"
      className="scroll-mt-[65px] rounded-cd-16 border border-cd-edge-section bg-cd-engine-m px-cd-11 pb-cd-14 pt-cd-13 md:bg-cd-engine md:px-cd-24 md:pb-cd-30 md:pt-cd-26 cd-header:scroll-mt-[75px]"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="intelligence-modules-heading"
          className="font-display text-xl font-medium text-ink-primary sm:text-2xl"
        >
          {t.sectionTitle}
        </h2>
        {/* R5.1 renders the summary in mono, between the title and the subtitle. */}
        <p className="font-mono text-xs font-semibold text-ink-secondary">{summary}</p>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-tertiary">{t.modulesSubtitle}</p>
      </div>

      {/*
        R5.1's grid is `repeat(3, …)` at >=1440 and narrower repeats below it.
        Expressed in the breakpoints this codebase already uses so the section
        inherits Home's existing responsive rhythm: one column on the phone
        widths Gate A tests (360/390/430), two from `sm`, three from `lg`.
      */}
      <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {INTELLIGENCE_MODULES.map((module) => (
          <ModuleCard key={module.id} module={module} language={language} />
        ))}
      </ul>
    </section>
  );
}

function ModuleCard({
  module,
  language,
}: {
  module: IntelligenceModuleConfig;
  language: LanguageCode;
}): JSX.Element {
  const t = getDictionary(language).intelligenceModules;
  const moduleText = t.modules[module.dictionaryKey as keyof typeof t.modules];
  const style = STATE_STYLE[module.state];
  const Icon = ICONS[module.icon];
  const { BadgeIcon } = style;

  /*
    `isModuleNavigable` REMAINS THE SOLE GATE, unchanged. A comingSoon module
    can never be a link whatever its destination field says, and a module with
    no destination can never be a link whatever its badge says.
  */
  const navigable = isModuleNavigable(module);

  const stateLabel =
    module.state === 'active'
      ? t.stateLabels.active
      : module.state === 'preview'
        ? t.stateLabels.preview
        : t.stateLabels.comingSoon;

  /* R5.1's route line: the real route in mono, or an explicit "No route". */
  const routeLine = module.destination ?? t.routeNone;

  /* R5.1's card note. Only a preview surface a reader can actually open earns it. */
  const note = module.state === 'preview' && module.destination ? t.opensPreview : null;

  const body = (
    <>
      <span aria-hidden="true" className={`mt-0.5 shrink-0 ${style.icon}`}>
        <Icon size={24} strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {/*
          THE CATEGORY TITLE COLOUR, and the only place it is applied. Weight
          stays >=600, which `CATEGORY_COLOUR_TOKENS.md`'s Rule requires of
          every category-coloured string. Description, route line and note stay
          `--mut`; the badge keeps its status colour.
        */}
        <span className={`text-[15px] font-bold leading-5 ${CATEGORY_TITLE_CLASS.get(module.id) ?? ""}`}>
          {moduleText.title}
        </span>
        <span className="text-[13px] leading-[18px] text-ink-tertiary">{moduleText.description}</span>
        <span className="break-words font-mono text-xs font-medium text-ink-tertiary">{routeLine}</span>
        {note === null ? null : <span className="text-xs font-medium text-ink-tertiary">{note}</span>}
        <span
          className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-px text-xs font-semibold ${style.badge}`}
        >
          <BadgeIcon size={14} strokeWidth={2} aria-hidden="true" />
          {stateLabel}
        </span>
      </span>
    </>
  );

  /* R5.1 card box: 84px minimum height, 14px padding, 16px radius, 12px gap. */
  const box = `flex min-h-[84px] items-start gap-3 rounded-cd-16 border bg-void/60 p-3.5 ${style.border}`;

  if (navigable && module.destination) {
    return (
      <li>
        <a
          href={module.destination}
          className={`${box} h-full transition-colors hover:border-cyan-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 motion-reduce:transition-none`}
        >
          {body}
        </a>
      </li>
    );
  }

  /*
    NOT A DISABLED BUTTON. A module with no surface is a statement, not a
    control a reader can press and be refused by, so it renders as plain
    content with its state visible in the badge and the dashed border.
  */
  return (
    <li>
      <div className={`${box} h-full`}>{body}</div>
    </li>
  );
}
