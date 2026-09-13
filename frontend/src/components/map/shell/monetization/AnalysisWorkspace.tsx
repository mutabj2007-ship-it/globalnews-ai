'use client';

/**
 * PART IV v1.2 R2 §16.1 STATE H2 — THE ANALYSIS WORKSPACE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A FULL TRANSITION, AND NOT A SHEET
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §16.1: "Full transition, NOT A SHEET, because the map is no longer the
 * subject. Back chevron and 'Back to map' both return to the subject at HALF
 * with sheet state intact."
 *
 * The reasoning is in the sentence. A sheet says "the map is still the thing,
 * and here is something about it". Deep analysis is not about the map — the map
 * was how the subject got chosen, and once the analysis is running the reader is
 * reading a document. Presenting that as a sheet over a map would be a claim
 * about where their attention should be that is simply wrong.
 *
 * WORKSPACE class: the map becomes a RETURN PATH rather than a backdrop. Two
 * ways back, both landing on the subject at HALF, because a reader who came from
 * a subject should return to it and not to a world view they would have to
 * navigate again.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTHING HAS RUN, AND THIS SAYS SO
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The Analysis system exists — Main is proving its live-provider activation —
 * but the MONETIZED DEEP ANALYSIS ACTIVATION AND ENTITLEMENT CONTRACT is not
 * configured, so nothing may be spent and nothing has run.
 *
 * The workspace therefore renders its own structure — the subject, the action,
 * the return paths — and an explicit statement that no result exists, rather
 * than an empty document that would look like an analysis which came back with
 * nothing.
 *
 * §10's rule that results render in ORDINARY INK is honoured by the absence of
 * sand here: sand marks a control that spends, and this surface spends nothing.
 * A finished analysis is content the user owns.
 */

export interface AnalysisWorkspaceLabels {
  readonly back: string;
  readonly backToMap: string;
  readonly subjectLine: string;
  readonly noResultTitle: string;
  readonly noResultBody: string;
}

export interface AnalysisWorkspaceProps {
  readonly actionLabel: string;
  readonly subjectLabel: string;
  readonly labels: AnalysisWorkspaceLabels;
  readonly onReturn: () => void;
}

export function AnalysisWorkspace({
  actionLabel,
  subjectLabel,
  labels,
  onReturn,
}: AnalysisWorkspaceProps): JSX.Element {
  return (
    <section
      data-gn="analysis-workspace"
      data-gn-surface-class="WORKSPACE"
      aria-label={actionLabel}
      className="flex h-full w-full flex-col bg-sp-bg"
    >
      <header className="flex shrink-0 items-center gap-[10px] border-b border-sp-line px-[12px] py-[10px]">
        {/* The back chevron. §16.1 names both return paths; this is the first. */}
        <button
          type="button"
          data-gn="workspace-back"
          aria-label={labels.back}
          onClick={onReturn}
          style={{ minHeight: 44, minWidth: 44 }}
          className="flex items-center justify-center rounded-[2px] border border-sp-line-2 text-sp-ui-idle outline-none transition-colors hover:border-sp-cyan/45 hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-sp-cyan"
        >
          <span aria-hidden="true" className="block text-[15px] leading-none">
            ‹
          </span>
        </button>

        <h1 className="min-w-0 flex-1 truncate font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-ink-2">
          {actionLabel}
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[14px] py-[14px]">
        <p
          data-gn="workspace-subject"
          className="font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ink-3"
        >
          {labels.subjectLine} <span className="text-sp-ink-2">{subjectLabel}</span>
        </p>

        {/*
          NO RESULT, STATED. An empty document here would read as an analysis
          that ran and found nothing — the single most misleading thing this
          surface could show.
        */}
        <div data-gn="workspace-no-result" className="mt-[16px]">
          <h2 className="font-gn-mono text-[10px] uppercase tracking-[0.12em] text-sp-ink-2">
            {labels.noResultTitle}
          </h2>
          <p className="mt-[7px] max-w-[62ch] text-[12.5px] leading-[1.6] text-sp-ink-3">
            {labels.noResultBody}
          </p>
        </div>
      </div>

      {/* The second return path, named in words. Both land on the subject at HALF. */}
      <footer className="shrink-0 border-t border-sp-line px-[12px] py-[10px]">
        <button
          type="button"
          data-gn="workspace-back-to-map"
          onClick={onReturn}
          className="flex min-h-[44px] w-full items-center justify-center rounded-[2px] border border-sp-line-2 px-[10px] font-gn-mono text-[10px] uppercase tracking-[0.14em] text-sp-ui-idle outline-none transition-colors hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.16] hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan"
        >
          {labels.backToMap}
        </button>
      </footer>
    </section>
  );
}
