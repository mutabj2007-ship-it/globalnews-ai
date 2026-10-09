import type { OutputContract } from '../prompt/output-contract.util';
import type { BriefComplianceVerdict, DevelopmentBreadth } from './brief-compliance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONTENT QUALITY REPAIR (P0-B) — THE VALIDATOR JUDGES THE CONTRACT GENERATION WAS GIVEN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha gate 2 (62db729), A and B: the reader asked for an opening, a table and a closing
 * (`readOutputContract`), generation was told to write ONE summary in exactly that order — and the
 * generic broad-news validator (`assessBriefCompliance`) then withheld it as "a single paragraph",
 * because it counts paragraphs ONLY by blank lines and the model separates an opening, a Markdown
 * table and a closing with single line breaks. One schema was validated while generation was
 * instructed to produce another.
 *
 * Two pieces, both at the contract boundary:
 *
 *   1 `layoutReaderContractSummary` — WHITESPACE ONLY. Each table run, list run and prose line
 *     becomes its own block separated by a blank line, which is the separator the validator, the
 *     paragraph counter and the frontend renderer all split on. Not one character of content
 *     changes (asserted by the spec), so statement placement and citations are unaffected.
 *
 *   2 `assessReaderContractShape` — when the reader gave a structural contract, THIS is the shape
 *     check: the requested table must be a well-formed Markdown table with the requested number
 *     of columns and no more rows than the requested cap (fewer is correct when the evidence
 *     supports fewer); a long prose wall in place of a requested table is still refused; an honest
 *     short statement that nothing could be verified is accepted. Malformed output is rejected
 *     with a precise reason — validation is narrowed to the right contract, never disabled.
 */

/*
  ASK R2 A/B/C BLOCKER REPAIR R1 — the honest "nothing could be verified" opening: a negation and a
  verification verb in the brief's FIRST sentence ("No development in the past seven days could be
  verified…", "Nothing reported this week establishes…", "I could not find any report…").
*/
const NOTHING_VERIFIED =
  /\b(?:no|none|nothing|not|cannot|could not|couldn't|unable)\b[^.!?]{0,120}\b(?:verif\w*|confirm\w*|found|find|establish\w*|identif\w*|report(?:ed|s)?)\b/iu;

export function opensWithNothingVerified(summary: string): boolean {
  const first = summary.trim().split(/(?<=[.!?])\s+/u)[0] ?? '';
  return NOTHING_VERIFIED.test(first);
}

/** Words below which a single block cannot be a blended multi-development wall. */
export const SHORT_ANSWER_WORDS = 120;

type BlockKind = 'table' | 'list' | 'prose';
export interface ContractBlock {
  readonly kind: BlockKind;
  readonly lines: readonly string[];
}

const TABLE_LINE = /^\s*\|.*\|\s*$/u;
const LIST_LINE = /^\s*(?:[-*•]|\d{1,2}[.)])\s+\S/u;
const HEADING_LINE = /^\s*#{1,6}\s+\S/u;

export function contractBlocks(summary: string): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  let current: { kind: BlockKind; lines: string[] } | null = null;
  const close = (): void => {
    if (current !== null && current.lines.length > 0) blocks.push(current);
    current = null;
  };
  for (const raw of summary.replace(/\r\n?/gu, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      close();
      continue;
    }
    const kind: BlockKind = TABLE_LINE.test(line) ? 'table' : LIST_LINE.test(line) ? 'list' : 'prose';
    /* tables and lists group their consecutive lines; every prose line (or heading) is its own block */
    if (current !== null && current.kind === kind && kind !== 'prose') {
      current.lines.push(line);
      continue;
    }
    close();
    current = { kind, lines: [line] };
    if (kind === 'prose' && HEADING_LINE.test(line)) close();
  }
  close();
  return blocks;
}

/** Whitespace-only: blocks separated by exactly one blank line. Content is byte-identical otherwise. */
export function layoutReaderContractSummary(summary: string): string {
  return contractBlocks(summary)
    .map((block) => block.lines.join('\n'))
    .join('\n\n');
}

const cellsOf = (row: string): string[] =>
  row
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim());

const SEPARATOR_CELL = /^:?-{3,}:?$/u;

interface TableShape {
  readonly ok: boolean;
  readonly reason?: string;
  readonly columns: number;
  readonly rows: number;
}

function tableShape(lines: readonly string[]): TableShape {
  if (lines.length < 2) return { ok: false, reason: 'table has no separator row', columns: 0, rows: 0 };
  const header = cellsOf(lines[0]!);
  const separator = cellsOf(lines[1]!);
  if (!separator.every((cell) => SEPARATOR_CELL.test(cell)))
    return { ok: false, reason: 'table separator row is malformed', columns: header.length, rows: 0 };
  if (separator.length !== header.length)
    return { ok: false, reason: 'table separator does not match its header', columns: header.length, rows: 0 };
  const body = lines.slice(2);
  const ragged = body.findIndex((row) => cellsOf(row).length !== header.length);
  if (ragged >= 0)
    return { ok: false, reason: `table row ${ragged + 1} has the wrong number of cells`, columns: header.length, rows: body.length };
  if (body.length === 0) return { ok: false, reason: 'table has no rows', columns: header.length, rows: 0 };
  return { ok: true, columns: header.length, rows: body.length };
}

const words = (text: string): number => text.split(/\s+/u).filter((w) => w.length > 0).length;

/**
 * The shape verdict for a brief generated under a STRUCTURAL reader contract. The breadth is
 * carried only so the verdict has the same type the withholding path already records.
 */
export function assessReaderContractShape(
  summary: string,
  contract: OutputContract,
  breadth: DevelopmentBreadth,
): BriefComplianceVerdict {
  const blocks = contractBlocks(summary);
  const paragraphs = blocks.length;
  const refuse = (reason: string): BriefComplianceVerdict => ({
    compliant: false,
    paragraphs,
    breadth,
    reason: `Reader output contract not met: ${reason}.`,
  });
  if (blocks.length === 0) return refuse('the brief is empty');

  const tables = blocks.filter((b) => b.kind === 'table');
  const pipeProse = blocks.some((b) => b.kind === 'prose' && (b.lines[0]!.match(/\|/gu) ?? []).length >= 3);
  const totalWords = words(summary);

  if (contract.table !== null) {
    if (tables.length === 0) {
      if (pipeProse) return refuse('the requested table is malformed');
      /*
        ASK R2 A/B/C BLOCKER REPAIR R1 — no table is acceptable ONLY when there was nothing to put in
        it: no report reached generation, or the brief is an honest short statement that OPENS by
        saying nothing could be verified. Short prose alone is not that. Live Alpha bb08e49: A (two
        sentences of developments) and B ("The following table summarizes…", no table) were both
        accepted because they were under 120 words.
      */
      if (breadth.clusters === 0) return { compliant: true, paragraphs, breadth };
      if (totalWords <= SHORT_ANSWER_WORDS && opensWithNothingVerified(summary) && !/\btable\b/iu.test(summary)) {
        return { compliant: true, paragraphs, breadth };
      }
      return refuse(
        totalWords <= SHORT_ANSWER_WORDS
          ? 'the requested table is missing while the evidence supports at least one row'
          : 'the requested table is missing and the brief is a long prose block',
      );
    }
    if (tables.length > 1) return refuse('the brief holds more than one table');
    const shape = tableShape(tables[0]!.lines);
    if (!shape.ok) return refuse(shape.reason ?? 'the requested table is malformed');
    const wanted = contract.table.columns.length;
    if (wanted >= 2 && shape.columns !== wanted)
      return refuse(`the table has ${shape.columns} columns, ${wanted} were requested`);
    if (contract.itemCap !== null && shape.rows > contract.itemCap)
      return refuse(`the table has ${shape.rows} rows, at most ${contract.itemCap} were requested`);
    return { compliant: true, paragraphs, breadth };
  }

  /* structure without a table (opening / closing): blocks, or one short honest block */
  if (blocks.length >= 2 || totalWords <= SHORT_ANSWER_WORDS || !breadth.multiDevelopment) {
    return { compliant: true, paragraphs, breadth };
  }
  return refuse('the brief is one long blended paragraph');
}
