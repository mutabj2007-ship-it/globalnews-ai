import type { AskTurn } from '@globalnews-ai/shared';
import { AnalysisResultView } from '@/components/search/AnalysisResultView';
import { SourceArticleCard } from '@/components/search/SourceArticleCard';
import { SourceEntitiesPanel } from '@/components/search/SourceEntitiesPanel';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3 — one turn in the transcript.
 *
 * REUSES AnalysisResultView FOR THE ANSWER. §3 says "do not replace
 * the accepted Ask visual system unnecessarily", and §26 protects the
 * Analysis Workspace arrangement, Executive Brief behavior/visual,
 * article/source cards, imagery, the Sources Dock and the Complete
 * Analysis Record. Every one of those lives inside
 * AnalysisResultView's tree. Re-rendering an AnalysisApiResponse with
 * a bespoke Ask-specific view would fork all of them, so a turn's
 * answer is handed to the existing component untouched — which is
 * also why AskTurn carries an AnalysisApiResponse rather than a
 * flattened summary.
 *
 * §30's "source links work" follows from this directly: the links are
 * the same AnalysisCitation/SourceArticleCard elements the search
 * surface already renders, not reimplemented ones.
 */

/** §3 — the states the UI must be able to render, each with its own honest copy. */
const STATUS_MESSAGES: Record<string, { title: string; detail: string }> = {
  'no-evidence': {
    title: 'No report available',
    detail:
      'No related articles were found for this question, so there was nothing to analyse. Try rephrasing, or widening the geography.',
  },
  'provider-failed': {
    title: 'The analysis service did not respond',
    detail: 'This is a temporary problem on our side, not a problem with your question. Please try again.',
  },
  'analysis-failed': {
    title: 'The analysis could not be completed',
    detail: 'Evidence was retrieved, but a reliable answer could not be produced from it.',
  },
  'invalid-response': {
    title: 'The response failed validation',
    detail:
      'An answer was produced but did not meet our grounding requirements, so it was discarded rather than shown. Nothing unverified is displayed.',
  },
  blocked: {
    title: 'This request is not available on your plan',
    detail: 'Reading stored intelligence remains available.',
  },
};

export function AskTurnView({ turn }: { turn: AskTurn }): JSX.Element | null {
  if (turn.role === 'user') {
    return (
      <article className="flex justify-end" aria-label="Your question">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm border border-border-strong bg-surface-raised px-4 py-3 text-sm leading-relaxed text-ink-primary sm:max-w-[75%]">
          {turn.question}
        </p>
      </article>
    );
  }

  // §9 — a quote placeholder is rendered by SandQuotePanel, not here.
  if (turn.status === 'awaiting-confirmation') return null;

  // `analysis` can be null even on an 'answered' turn is not possible
  // (deriveTurnStatus only reports 'answered' for provenance.status
  // 'success', which guarantees a validated NewsAnalysisResult) — but
  // the type is nullable, so this narrows rather than asserting.
  if (turn.status !== 'answered' || !turn.answer?.analysis) {
    const message = STATUS_MESSAGES[turn.status] ?? {
      title: 'This answer could not be produced',
      detail: 'Please try again.',
    };

    return (
      <article
        // role="status" so assistive technology announces the outcome
        // when it arrives — a silently-rendered failure is invisible
        // to a screen-reader user who is waiting for an answer.
        role="status"
        className="rounded-2xl border border-border bg-surface p-4"
      >
        <p className="font-display text-sm text-ink-primary">{message.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{message.detail}</p>
      </article>
    );
  }

  const answer = turn.answer;
  const language = answer.responseLanguage;

  return (
    <article aria-label="Answer" className="space-y-6">
      {turn.storedResultReused && (
        <p className="text-xs text-ink-tertiary">
          Reusing a stored assessment — no new analysis was run.
        </p>
      )}

      <SourceEntitiesPanel sourceEntities={answer.sourceEntities} language={language} />

      <AnalysisResultView
        analysis={answer.analysis!}
        provenance={answer.provenance}
        sourceDiversity={answer.sourceDiversity}
        language={language}
      />

      {answer.articles.length > 0 && (
        <section aria-label="Sources">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-signal-bright">
            Sources
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {answer.articles.map((article) => (
              <SourceArticleCard key={article.id} article={article} language={language} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
