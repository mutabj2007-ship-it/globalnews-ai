import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { evidenceTotals } from '@/lib/map/evidence/evidenceModel';
import { ASK_PROGRESS_LOCALES, askProgressStrings } from '@/lib/ask/askProgressStrings';
import { ContextSummaryPanel, type ContextSummaryLabels } from './ContextSummaryPanel';

/**
 * CTO #95 6376647758 §5 — the Map's empty rail said "No evidence meets the criteria of the selected mode
 * and period. Widen the period, or change mode…" on Alpha, where nothing was searched at all: it blamed
 * the filter. With the backend's typed reason on the retained feed it now says news was not searched;
 * without the field, the existing copy is kept (never inferred from an empty set).
 */
const labels = new Proxy({} as ContextSummaryLabels, {
  get: (_t, key) =>
    key === 'modes' || key === 'periods' || key === 'levels' || key === 'jumpTargets'
      ? new Proxy({}, { get: (_x, k) => `label:${String(k)}` })
      : `label:${String(key)}`,
});
const render = (emptyReason?: string) =>
  renderToStaticMarkup(
    createElement(ContextSummaryPanel, {
      mode: 'WORLD',
      period: '24H',
      totals: evidenceTotals([]),
      ranked: [],
      noEvidence: [],
      labels,
      ...(emptyReason === undefined ? {} : { emptyReason }),
    } as never),
  );
const escaped = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

describe('Map empty rail: the typed not-searched reason replaces the "widen the period" body', () => {
  it.each(ASK_PROGRESS_LOCALES)('%s: with the reason, the rail states it and drops the filter advice', (locale) => {
    const reason = askProgressStrings(locale).searchNotPermitted;
    const html = render(reason);
    expect(html).toContain('data-gn-empty-reason="not-searched"');
    expect(html).toContain(escaped(reason));
    expect(html).not.toContain('label:emptyBody');
  });

  it('without the reason, the existing empty copy is unchanged (positive control)', () => {
    const html = render();
    expect(html).toContain('label:emptyBody');
    expect(html).not.toContain('data-gn-empty-reason');
  });

  it('MapPageClient derives the reason ONLY from the typed field on the retained feed', () => {
    const src = readFileSync(join(__dirname, '..', 'MapPageClient.tsx'), 'utf8');
    expect(src).toMatch(
      /globalFeed !== null && feedNotSearchedRightsUncleared\(globalFeed\)\s*\?\s*askProgressStrings\(language\)\.searchNotPermitted\s*:\s*undefined/,
    );
    expect(src).toMatch(/emptyReason=\{emptyReason\}/);
    const shell = readFileSync(join(__dirname, 'GlobalMapShell.tsx'), 'utf8');
    expect(shell).toMatch(/emptyReason=\{emptyReason\}/);
  });
});
