import type { CSSProperties, JSX } from 'react';
import { askModuleHref, askRecordStrings, type AskBindableModule } from '@/lib/ask/askModuleRef';

/**
 * UNIFIED INTELLIGENCE BINDING R2F — "Ask about this record" on a dashboard.
 *
 * A plain link to the ONE Ask (/ask) carrying the record's module and stable key. Following it
 * runs nothing: /ask opens with the record as a removable context chip and an empty composer;
 * the reader's explicit Ask is the only thing that computes. Rendered only for modules with a
 * governed Ask contributor (CONFLICT, IMIHIGO, ECONOMY, MARKET) — the type admits no other.
 */
export function AskAboutRecordLink({
  module,
  observationKey,
  label,
  locale,
  returnPath,
  className,
  style,
}: {
  readonly module: AskBindableModule;
  readonly observationKey: string;
  readonly label: string;
  readonly locale: string;
  readonly returnPath?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}): JSX.Element | null {
  const href = askModuleHref(module, observationKey, label, returnPath);
  if (href === undefined) return null;
  return (
    <a href={href} data-ask-record={module} className={className} style={style}>
      {askRecordStrings(locale).askAboutRecord} →
    </a>
  );
}
