import Link from 'next/link';
import { PageCanvas } from '@/components/layout/PageCanvas';

/**
 * MVP FAILURE FLOOR — THE ONE PRESENTATION FOR error.tsx AND not-found.tsx.
 *
 * ── IT REUSES THE RELEASED CANVAS RATHER THAN INVENTING A FAILURE STYLE ───
 *
 * `PageCanvas` is the Claude Design presentation foundation the homepage
 * already renders inside: the `#04060c` base, the two-layer page field and the
 * 56px technical grid. A failure page that looked like a different product
 * would tell the reader they had left GlobalNews AI, which is exactly the
 * wrong message when something has gone wrong. Every colour, face and size
 * below is a released `cd-*` token; not one hex value is invented here.
 *
 * `global-error.tsx` deliberately does NOT use this component — see its own
 * header for why a last-resort boundary cannot depend on the stylesheet.
 *
 * ── ONE HEADING, ONE PRIMARY ACTION, AND ALWAYS A WAY HOME ────────────────
 *
 * The recovery route to `/` is present on every surface and is never the only
 * thing offered where a retry is genuinely possible. Both controls are real,
 * at least 44px tall, and carry the canvas focus treatment — the same bar the
 * rest of this lane's work is held to, and the one a keyboard user needs most
 * on a page they did not choose to visit.
 *
 * ── THE DIGEST IS SHOWN, NOT SWALLOWED ───────────────────────────────────
 *
 * When Next supplies an error digest it is rendered, quietly, in the meta ink.
 * It is the ONLY handle a reader has on their own specific failure, and the
 * only thing they could usefully quote to a human. What is NOT rendered is the
 * error message or the stack: those are ours, they routinely contain internals,
 * and Next redacts them in production for that reason.
 */
interface FailureSurfaceProps {
  eyebrow: string;
  heading: string;
  body: string;
  homeLabel: string;
  /** Rendered only when the surface can genuinely retry in place. */
  retryLabel?: string;
  onRetry?: () => void;
  /** Next's error digest, when there is one. */
  reference?: string;
  referenceLabel: string;
}

const CONTROL_BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded-cd-pill px-cd-18 font-cd-mono uppercase text-cd-mono-nav transition-colors';

export function FailureSurface({
  eyebrow,
  heading,
  body,
  homeLabel,
  retryLabel,
  onRetry,
  reference,
  referenceLabel,
}: FailureSurfaceProps): JSX.Element {
  return (
    <PageCanvas>
      <section
        aria-labelledby="failure-heading"
        className="flex min-h-[60vh] flex-col justify-center py-cd-30"
      >
        {/*
          ONE ARBITRARY VALUE, AND IT IS DISCLOSED. The Claude Design system
          authors `max-w-cd-copy` (340px) for hero SUPPORTING copy, which is a
          column beside something else. Here the paragraph IS the content, and
          340px would set it as a narrow gutter on a 1500px canvas. 34rem is a
          reading measure — roughly 60 characters — and it is the only length
          on this surface that does not come from a released token.
        */}
        <div className="max-w-[34rem]">
          <p className="font-cd-mono uppercase text-cd-mono-section text-cd-ink-label">{eyebrow}</p>

          <h1
            id="failure-heading"
            className="mt-cd-12 font-cd-display text-cd-screen-title text-cd-ink-primary"
          >
            {heading}
          </h1>

          <p className="mt-cd-12 font-cd-body text-cd-hero-copy text-cd-ink-secondary">{body}</p>

          <div className="mt-cd-20 flex flex-wrap items-center gap-cd-12">
            {/*
              The retry comes first where it exists, because it is the action
              most likely to work. Where it does not exist it is ABSENT, never
              a disabled control: nothing about a wrong address can be retried.
            */}
            {onRetry !== undefined && retryLabel !== undefined && (
              <button
                type="button"
                onClick={onRetry}
                className={`${CONTROL_BASE} border border-cd-edge-control-active bg-cd-void text-cd-ink-link hover:border-cd-edge-emphasis`}
              >
                {retryLabel}
              </button>
            )}

            <Link
              href="/"
              className={`${CONTROL_BASE} border border-cd-edge-structural text-cd-ink-control hover:border-cd-edge-control hover:text-cd-ink-primary`}
            >
              {homeLabel}
            </Link>
          </div>

          {reference !== undefined && reference.length > 0 && (
            <p className="mt-cd-18 font-cd-mono uppercase text-cd-mono-meta text-cd-ink-meta">
              {referenceLabel} {reference}
            </p>
          )}
        </div>
      </section>
    </PageCanvas>
  );
}
