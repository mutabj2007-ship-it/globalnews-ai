/**
 * ════════════════════════════════════════════════════════════════════════════
 * UNIFIED INTELLIGENCE BINDING R2F — A DASHBOARD RECORD AS ASK CONTEXT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A dashboard "Ask about this record" opens the ONE Ask (/ask) with a reference to the record:
 * its module and its stable key. REFERENCES ONLY — the record's values (counts, dates, names,
 * figures) are never sent; the server resolves the record through the module's own governed
 * read and refuses one it cannot find (the draft is kept, never a silent generic Ask).
 *
 * Only modules with a governed Ask contributor are bindable. Energy, Politics, Elections and
 * Humanitarian have none yet (NOT_BINDABLE_YET): no launcher is offered for them and a crafted
 * URL naming one is ignored here (and refused by the server if sent).
 *
 * `moduleLabel` is DISPLAY ONLY (the chip text), bounded and never sent.
 *
 * DEPENDENCY-FREE BY DESIGN: dashboards import this (via AskAboutRecordLink), and their
 * network-boundary guards walk the whole import graph — so this module imports nothing.
 */
export const ASK_BINDABLE_MODULES = ['CONFLICT', 'IMIHIGO', 'ECONOMY', 'MARKET'] as const;
export type AskBindableModule = (typeof ASK_BINDABLE_MODULES)[number];

/** Mirrors the server: printable, 1..300 characters. */
const OBSERVATION_KEY_SHAPE = /^[^\u0000-\u001f\u007f]{1,300}$/;
const LABEL_MAX = 120;

/** Structurally the MODULE member of AskV2ContextRef (lib/api/askV2Api.ts). */
export interface AskModuleRef {
  readonly kind: 'MODULE';
  readonly module: AskBindableModule;
  readonly observationKey: string;
}

/** The launcher text and the chip fallback, EN / PL (any other locale renders English). */
export const ASK_RECORD_STRINGS = {
  en: {
    askAboutRecord: 'Ask about this record',
    moduleRecord: {
      CONFLICT: 'Conflict record',
      IMIHIGO: 'Imihigo district result',
      ECONOMY: 'Rwanda headline CPI',
      MARKET: 'Procurement notice',
    },
  },
  pl: {
    askAboutRecord: 'Zapytaj o ten rekord',
    moduleRecord: {
      CONFLICT: 'Rekord konfliktu',
      IMIHIGO: 'Wynik dystryktu Imihigo',
      ECONOMY: 'Inflacja CPI w Rwandzie',
      MARKET: 'Ogłoszenie o zamówieniu',
    },
  },
} as const satisfies Record<
  'en' | 'pl',
  { askAboutRecord: string; moduleRecord: Record<AskBindableModule, string> }
>;
export const askRecordStrings = (locale: string) =>
  ASK_RECORD_STRINGS[locale === 'pl' ? 'pl' : 'en'];

export function isAskBindableModule(value: unknown): value is AskBindableModule {
  return typeof value === 'string' && (ASK_BINDABLE_MODULES as readonly string[]).includes(value);
}

export function askModuleRef(module: unknown, observationKey: unknown): AskModuleRef | undefined {
  if (!isAskBindableModule(module)) return undefined;
  if (typeof observationKey !== 'string' || !OBSERVATION_KEY_SHAPE.test(observationKey)) {
    return undefined;
  }
  return { kind: 'MODULE', module, observationKey };
}

/** The /ask arrival: `module` + `observationKey` (+ a display label). Nothing is sent on arrival. */
export function dashboardModuleContext(
  params: Pick<URLSearchParams, 'get'>,
): { readonly ref: AskModuleRef; readonly label: string } | undefined {
  const ref = askModuleRef(params.get('module'), params.get('observationKey'));
  if (ref === undefined) return undefined;
  const raw = (params.get('moduleLabel') ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return { ref, label: raw.slice(0, LABEL_MAX) };
}

/** The launcher href: a draft arrival on /ask — opening it runs nothing. */
export function askModuleHref(
  module: AskBindableModule,
  observationKey: string,
  label: string,
  returnPath?: string,
): string | undefined {
  if (askModuleRef(module, observationKey) === undefined) return undefined;
  const params = new URLSearchParams({ module, observationKey });
  const shown = label
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, LABEL_MAX);
  if (shown.length > 0) params.set('moduleLabel', shown);
  if (returnPath !== undefined && returnPath.startsWith('/') && !returnPath.startsWith('//')) {
    params.set('return', returnPath);
  }
  return `/ask?${params.toString()}`;
}
