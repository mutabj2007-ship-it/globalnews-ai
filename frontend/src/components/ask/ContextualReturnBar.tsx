import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { AskContext } from '@globalnews-ai/shared';
import { buildReturnTrail } from '@/lib/ask/askNavigationContext';

/**
 * BETA-SIMPLE-ASK-SAND-1 §4 — the contextual return controls.
 *
 * Renders the "← Rwanda / ← Energy / ← World Map" affordances §4 asks
 * for, alongside (never instead of) browser Back.
 *
 * These are ordinary <Link> elements, so Back, Forward, middle-click
 * and open-in-new-tab all behave exactly as a user expects. Nothing
 * here intercepts navigation or manipulates history — §4's "do not
 * create a new global router architecture" taken literally.
 *
 * Renders NOTHING when the context carries no return target. An
 * invented "← Home" would be worse than an absent control: it teaches
 * the user that the control does not mean what it says.
 */
export function ContextualReturnBar({ context }: { context: AskContext }): JSX.Element | null {
  const trail = buildReturnTrail(context);

  if (trail.length === 0) return null;

  return (
    <nav
      // A labelled landmark, because this is a second navigation
      // region on pages that already have the primary NavBar; without
      // distinct labels a screen-reader user hears two identical
      // "navigation" landmarks and cannot tell them apart.
      aria-label="Return to where you came from"
      className="flex flex-wrap items-center gap-2"
    >
      {trail.map((target) => (
        <Link
          key={`${target.kind}-${target.href}`}
          href={target.href}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-sm text-ink-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          {/* The label alone can be ambiguous out of context ("Energy"
              could be a heading), so the accessible name states the
              action while the visible text stays short. */}
          <span className="sr-only">Back to </span>
          <span className="truncate max-w-[12rem]">{target.label}</span>
        </Link>
      ))}
    </nav>
  );
}
