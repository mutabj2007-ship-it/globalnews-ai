import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import retained from './retained.json';
import authorities from './authorities.json';
import { admitRetained, contentHash, type CaptureAuthority } from './retainedModel';
import { readRetainedImihigo } from './retainedReader';
import { ImihigoScreen } from '@/components/delivery/ImihigoScreen';

const copy = () => JSON.parse(JSON.stringify(retained));
// Synthetic revision fixtures are trusted only inside tests, never added to production authorities.
const authorityFor = (capture: typeof retained): CaptureAuthority => ({
  sha256: capture.sha256, contentHash: contentHash(capture), sourceUrl: capture.sourceUrl,
  documentId: capture.documentId, parser: capture.parser,
});
function revision() {
  const next = copy();
  next.sha256 = 'a'.repeat(64); next.captureId = next.sha256;
  next.revisionOf = retained.captureId; next.capturedAt = '2026-09-23T12:00:00Z';
  next.revisionLabel = 'Synthetic revision fixture';
  next.records[0].result.value = '72.7';
  next.records[0].provenance.quote = '11 Bugesera 72.7';
  return next;
}

describe('Imihigo exact retained evidence', () => {
  it('verifies captured raw bytes, URL, document identity and reviewed decoder output', () => {
    const bytes = readFileSync(resolve(__dirname, '../../../../data/imihigo/nisr-imihigo-2024-2025.pdf'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(retained.sha256);
    expect(bytes.length).toBe(retained.byteLength);
    expect(readRetainedImihigo().current).toHaveLength(1);
    for (const field of ['sourceUrl', 'sha256', 'documentId', 'parser']) {
      const changed = copy(); changed[field] += '-wrong';
      expect(() => admitRetained([changed], authorities)).toThrow('exact-source identity');
    }
  });
  it('preserves every official score string without rounding, calculated percentages or ranks', () => {
    const view = readRetainedImihigo();
    expect(view.current[0].records).toHaveLength(28);
    expect(view.current[0].records.map(row => row.result)).toEqual(retained.records.map(row => row.result));
    const ngoma = view.current[0].records.find(row => row.entity === 'Ngoma')!;
    expect(ngoma.result).toEqual({ label: 'Final Score', value: '77.2', unit: null });
    expect(view.current[0].records.find(row => row.entity === 'Muhanga')!.result.value).toBe('73');
    const changed = copy(); changed.records[0].result.value = '100';
    expect(() => admitRetained([changed], authorities)).toThrow('unreviewed content');
  });
  it.each(['target', 'indicator', 'evaluationStatus'])('refuses invented or missing %s fields', field => {
    const changed = copy(); changed.records[0][field] = { value: '100%', pdfPage: 9, quote: '100%' };
    expect(() => admitRetained([changed], authorities)).toThrow();
    delete changed.records[0][field];
    expect(() => admitRetained([changed], authorities)).toThrow();
    expect(readRetainedImihigo().current[0].records[0][field as 'target']).toBeNull();
  });
  it('preserves revision history and current revision without changing old records', () => {
    const next = revision();
    const view = admitRetained([retained, next], [...authorities, authorityFor(next)]);
    expect(view.history).toHaveLength(2);
    expect(view.history[0].records[0].result.value).toBe('72.6');
    expect(view.current[0].records[0].result.value).toBe('72.7');
    expect(view.current[0].revisionOf).toBe(retained.captureId);
    expect(Object.isFrozen(view.history[0].records[0])).toBe(true);
  });
  it('deduplicates identical captures without fabricating revisions', () => {
    expect(admitRetained([retained, copy()], authorities).history).toHaveLength(1);
    const corrupt = copy(); corrupt.records[0].result.value = '0';
    expect(() => admitRetained([retained, corrupt], authorities)).toThrow();
  });
  it('refuses orphan, forked and out-of-order revisions', () => {
    const next = revision();
    expect(() => admitRetained([next], [authorityFor(next)])).toThrow('orphan');
    next.revisionOf = null;
    expect(() => admitRetained([retained, next], [...authorities, authorityFor(next)])).toThrow('lineage');
    next.revisionOf = retained.captureId; next.capturedAt = '2026-01-01T00:00:00Z';
    expect(() => admitRetained([retained, next], [...authorities, authorityFor(next)])).toThrow('chronology');
  });
  it('keeps publisher evaluation month distinct from acquisition and refuses impossible chronology', () => {
    expect(retained.evaluationDate.value).toBe('2025-08');
    expect(retained.publicationDate).toBeNull();
    const next = revision(); next.evaluationDate.value = '2027-08';
    expect(() => admitRetained([retained, next], [...authorities, authorityFor(next)])).toThrow('chronology');
  });
  it.each(['provenance', 'entityClass'])('refuses missing %s', field => {
    const changed = copy(); delete changed.records[0][field];
    expect(() => admitRetained([changed], authorities)).toThrow();
  });
  it('preserves English source language independently of Polish display and refuses substitution', () => {
    const html = renderToStaticMarkup(createElement(ImihigoScreen, { view: readRetainedImihigo(), compact: true, locale: 'pl' }));
    expect(html).toContain('lang="en"'); expect(html).toContain('Język źródła');
    const changed = copy(); changed.sourceLanguage = 'pl';
    expect(() => admitRetained([changed], authorities)).toThrow();
  });
  it('renders an honest empty state with no result rows or fictional zero', () => {
    const empty = admitRetained([], authorities);
    const html = renderToStaticMarkup(createElement(ImihigoScreen, { view: empty, compact: true, locale: 'en' }));
    expect(empty.state).toBe('empty'); expect(html).toContain('No retained evidence');
    expect(html).not.toContain('data-del="subject"'); expect(html).not.toContain('NISR · 0');
  });
  it.each([false, true])('keeps all four regions and 28 identical row treatments in compact=%s', compact => {
    const html = renderToStaticMarkup(createElement(ImihigoScreen, { view: readRetainedImihigo(), compact, locale: 'en' }));
    expect((html.match(/data-del="region"/g) ?? [])).toHaveLength(4);
    expect((html.match(/data-del="subject"/g) ?? [])).toHaveLength(28);
    const rows = [...html.matchAll(/<li[^>]+class="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(rows).size).toBe(1);
    expect(rows[0]).toContain('flex-wrap');
    expect(html).not.toMatch(/attentionRank|position-badge|aria-posinset|<ol/);
  });
  it('opening the reader performs no network acquisition', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden'); });
    try {
      renderToStaticMarkup(createElement(ImihigoScreen, { view: readRetainedImihigo(), compact: true, locale: 'en' }));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
