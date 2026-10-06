import { Fragment, type JSX, type ReactNode } from 'react';
import { projectSummaryStatements, safeExternalHref, type DisplayLocale } from '@globalnews-ai/shared';
import type { AnalysisSourceRef, LanguageCode, SummaryStatement } from '@globalnews-ai/shared';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { parseAnswerBlocks, parseInline, type AskBlock } from '@/lib/ask/askAnswerMarkdown';
import { citationNumbers } from './AskCitedBrief';
import { AskAnswerTable, isNumericCell } from './AskAnswerTable';
import { AskCitation } from './AskCitation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 ANSWER READING EXPERIENCE R1 · PHASE A — ONE ANSWER RENDERER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Before this, an answer was drawn two different ways: the cited brief rendered plain
 * paragraphs, and a model-background answer rendered as a SINGLE `<p>` with
 * `whitespace-pre-wrap`. Neither read the markup the answer was authored in, so
 * `**Nationally Determined Contributions**` reached the reader with its asterisks.
 *
 * This is the one renderer for both. It emits the structure the ANSWER authored — headings,
 * bullets, numbered steps, emphasis — and nothing the answer did not: no invented heading, no
 * invented conclusion, no reordering, no summary of its own.
 *
 * ── CITATIONS ARE PLACED EXACTLY AS BEFORE ────────────────────────────────
 *
 * `projectSummaryStatements` matches a statement by LITERAL SUBSTRING against the text, with a
 * cursor that only moves forward. So the order of operations matters and is deliberate:
 *
 *    1 the answer is split into blocks (a statement never spans a block boundary: the backend
 *      validates sentences, and a heading or a list item is not part of the next sentence);
 *    2 each block's text is handed to `projectSummaryStatements` IN DOCUMENT ORDER, carrying
 *      the same shrinking `remaining` list the old renderer carried across paragraphs;
 *    3 inline emphasis is applied INSIDE the resulting segments.
 *
 * Step 3 last is what keeps citation placement byte-identical: the matcher still sees the raw
 * text it always saw. Nothing about which sentence carries which source number changes.
 *
 * ── SAFETY ────────────────────────────────────────────────────────────────
 *
 * Every element here is a React element built from parsed data. There is no
 * `dangerouslySetInnerHTML` anywhere in this file, and the only `href` is
 * `safeExternalHref(source.url)` for a GOVERNED citation — a markdown link in the answer's own
 * prose is reduced to its label by the parser, so a model cannot author a destination.
 */

function Inline({ text }: { readonly text: string }): JSX.Element {
  return (
    <>
      {parseInline(text).map((span, i) => {
        const key = `${i}-${span.text.slice(0, 12)}`;
        if (span.kind === 'strong')
          return (
            <strong key={key} className="font-semibold">
              {span.text}
            </strong>
          );
        if (span.kind === 'em') return <em key={key}>{span.text}</em>;
        if (span.kind === 'code') {
          return (
            <code key={key} className="rounded-[4px] px-1 font-mono text-[0.9em]">
              {span.text}
            </code>
          );
        }
        /* A plain run emits NO element. The accepted inline-citation spec pins `<em>text</em>`
           and `<span data-ask="statement">text`, and a decorative wrapper would break both
           while adding nothing. */
        return <Fragment key={key}>{span.text}</Fragment>;
      })}
    </>
  );
}

export function AskAnswerProse({
  source,
  statements,
  sources,
  language,
}: {
  /** The answer's own text — `analysis.summary` or `background.text`, verbatim. */
  readonly source: string;
  readonly statements?: readonly SummaryStatement[] | undefined;
  readonly sources: readonly AnalysisSourceRef[];
  readonly language: DisplayLocale;
}): JSX.Element {
  const shell = askShellStrings(language);
  const t = shell.dict.askAi;
  const blocks = parseAnswerBlocks(source);
  let remaining: readonly SummaryStatement[] = statements ?? [];

  /** One run of answer text: statements placed first, then emphasis inside each segment. */
  const run = (text: string, blockKey: string): ReactNode => {
    const { segments, placed } = projectSummaryStatements(text, remaining);
    remaining = remaining.filter((statement) => !placed.includes(statement));

    return segments.map((segment, index) => {
      const statement = segment.statement;
      const key = `${blockKey}-${index}-${segment.text.slice(0, 12)}`;
      if (statement === undefined) return <Inline key={key} text={segment.text} />;

      if (statement.kind === 'ANALYTICAL_INFERENCE' || statement.kind === 'UNSUPPORTED') {
        return (
          /*
            ASK READING EXPERIENCE R1 — the qualification stays DIRECTLY on the statement it
            qualifies (never in a disclosure), as an inline note in reading type: no 10px
            monospace caps, and no italic paragraph — a whole inferred paragraph set in italics
            was the "full-paragraph italics" the freeze forbids. The <em> element is kept (its
            semantics are pinned); its slant is not. The lighter ink still marks inference.
          */
          <span
            key={key}
            data-ask="statement"
            data-statement-kind={statement.kind}
            className="text-ink-secondary [&_em]:not-italic"
          >
            <span
              data-ask="statement-qualifier"
              className="me-0.5 rounded-[4px] bg-[var(--ask-read-deep-bg,rgba(217,185,138,0.12))] px-1 text-[0.8125rem] font-semibold text-[var(--ask-read-deep-ink,#d9b98a)]"
            >
              {statement.kind === 'ANALYTICAL_INFERENCE' ? t.inferenceLabel : t.unsupportedLabel}
            </span>{' '}
            <em>
              <Inline text={segment.text} />
            </em>
          </span>
        );
      }

      return (
        <span key={key} data-ask="statement" data-statement-kind={statement.kind}>
          <Inline text={segment.text} />
          {citationNumbers(statement, sources).map((n) => {
            const cited = sources[n - 1];
            return (
              <AskCitation
                key={n}
                n={n}
                href={safeExternalHref(cited.url)}
                label={t.citationLabel
                  .replace('{n}', String(n))
                  .replace('{title}', cited.title)
                  .replace('{publisher}', cited.publisher)}
                sources={sources}
              />
            );
          })}
        </span>
      );
    });
  };

  return (
    <div data-ask="brief" data-ask-prose className="flex flex-col">
      {blocks.map((block: AskBlock, index) => {
        const key = `${index}-${block.kind}`;
        if (block.kind === 'heading') {
          /* The question is the page's h1; an answer's own section title is h3/h4 under it. */
          const Tag = block.level === 2 ? 'h3' : 'h4';
          return (
            <Tag key={key} data-ask="answer-heading" data-ask-heading-level={block.level}>
              <Inline text={block.text} />
            </Tag>
          );
        }
        if (block.kind === 'bullets') {
          return (
            <ul key={key} data-ask="answer-bullets">
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`} data-ask="answer-bullet">
                  {run(item, `${key}-${i}`)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'table') {
          /* ASK RELIABILITY R1 (M) — a requested table is rendered as a real table, with the
             row/column relationships kept by <th scope>. Cells are text only (React-escaped).
             ASK READING EXPERIENCE R1 — ≤3 columns wrap in place; wider tables scroll inside
             their own labelled region (never the page) with a sticky first column, or become
             labelled stacked rows when the container is narrow or the text is enlarged. */
          return (
            <AskAnswerTable
              key={key}
              label={block.header.join(' · ')}
              headerText={block.header}
              header={block.header.map((cell, i) => (
                <Inline key={`${key}-h${i}`} text={cell} />
              ))}
              rows={block.rows.map((row, r) =>
                row.map((cell, c) => <Inline key={`${key}-r${r}c${c}`} text={cell} />),
              )}
              numeric={block.rows.map((row) => row.map((cell) => isNumericCell(cell)))}
              scrollHint={shell.askR2Strings.tableScrollHint(block.header.length)}
            />
          );
        }
        if (block.kind === 'ordered') {
          return (
            <ol key={key} data-ask="answer-steps" start={block.start === 1 ? undefined : block.start}>
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`} data-ask="answer-step">
                  {run(item, `${key}-${i}`)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={key} data-ask="brief-paragraph">
            {run(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}
