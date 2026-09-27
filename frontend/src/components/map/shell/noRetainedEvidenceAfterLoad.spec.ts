import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EvidenceSelectionCard,
  showsNoRetainedEvidenceStatement,
} from './EvidenceSelectionCard';
import type { RetainedItem } from '@/lib/map/selection/selectionIntelligence';
import type { CountryReadState } from '@/lib/map/retrieval/countryReadRequest';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * MAP / SPATIAL VISUAL CONVERGENCE R2 FINAL — the desktop rail never says
 * "No retained evidence for this area" above reporting the reader has just
 * retrieved. Every state is rendered through the real card with the real
 * dictionary, on a country with NO retained map evidence (`total` absent).
 */

const card = getDictionary('en').map.spatial.card;
const NO_RETAINED = card.noEvidenceTitle;

const ITEM: RetainedItem = {
  id: 'irq-1',
  headline: 'Parliament session on the federal budget adjourned after quorum dispute',
  category: 'politics',
  publisher: 'Fixture Wire',
  publishedAt: '2026-09-27T08:00:00Z',
  timeIsObservedOnly: false,
  precision: 'COUNTRY',
  url: 'https://example.com/irq/1',
};

function render(state: CountryReadState, items: readonly RetainedItem[] | undefined): string {
  return renderToStaticMarkup(
    createElement(EvidenceSelectionCard, {
      displayName: 'Iraq',
      identity: { iso3: 'IRQ', region: 'Asia' },
      period: '24H',
      countryReadState: state,
      onLoadCountry: () => undefined,
      items,
      labels: card,
    }),
  );
}

describe('the no-retained statement and the retrieved list never contradict', () => {
  it('not loaded + nothing retained: the truthful no-retained statement and the not-loaded line', () => {
    const html = render('SELECTED_NOT_LOADED', undefined);
    expect(html).toContain(NO_RETAINED);
    expect(html).toContain(card.countryRead.notLoaded);
    expect(html).toContain('data-gn-state="no-evidence"');
    expect(html).not.toContain('data-gn="card-retained"');
  });

  it('READY with retrieved items: the list is shown and the no-retained statement is NOT', () => {
    const html = render('READY', [ITEM]);
    expect(html).toContain('data-gn="card-retained"');
    expect(html).toContain(ITEM.headline);
    expect(html).not.toContain(NO_RETAINED);
    expect(html).not.toContain('data-gn="card-no-evidence"');
    expect(html).toContain('data-gn-state="retrieved"');
  });

  it('READY_NO_COVERAGE with zero items: the governed no-coverage line, beside the no-retained statement', () => {
    const html = render('READY_NO_COVERAGE', []);
    expect(html).toContain(card.countryRead.noCoverage);
    expect(html).toContain(NO_RETAINED);
    expect(html).not.toContain('data-gn="card-retained"');
  });

  it('FAILED: the governed failure line; nothing retrieved is claimed', () => {
    const html = render('FAILED', undefined);
    expect(html).toContain(card.countryRead.failed);
    expect(html).not.toContain('data-gn="card-retained"');
  });

  it('the rule itself: only READY with at least one item withdraws the statement', () => {
    const states: CountryReadState[] = ['UNSELECTED', 'SELECTED_NOT_LOADED', 'LOADING', 'READY', 'READY_NO_COVERAGE', 'FAILED'];
    for (const state of states) {
      expect([state, showsNoRetainedEvidenceStatement(state, 0)]).toEqual([state, true]);
      expect([state, showsNoRetainedEvidenceStatement(state, 3)]).toEqual([state, state !== 'READY']);
    }
    expect(showsNoRetainedEvidenceStatement(undefined, 3)).toBe(true);
  });

  it('whenever retrieved reporting renders, the no-retained statement is absent (EN and PL)', () => {
    for (const language of ['en', 'pl'] as const) {
      const labels = getDictionary(language).map.spatial.card;
      const html = renderToStaticMarkup(
        createElement(EvidenceSelectionCard, {
          displayName: 'Iraq', identity: { iso3: 'IRQ' }, period: '7D',
          countryReadState: 'READY', items: [ITEM, { ...ITEM, id: 'irq-2' }], labels,
        }),
      );
      expect(html).toContain('data-gn="card-retained"');
      expect(html).not.toContain(labels.noEvidenceTitle);
    }
  });
});
