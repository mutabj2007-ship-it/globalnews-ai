import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisFrameSurface } from './AnalysisFrameSurface';
import { fixture } from './frameFixtures';
import { getDictionary } from '@/lib/i18n/dictionaries';

/** R4 §11 — the mounted surface in English and Polish. */
const render = (language: 'en' | 'pl', extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(AnalysisFrameSurface as never, {
      response: fixture(),
      language,
      initialViewport: { width: 1440, height: 900 },
      ...extra,
    } as never),
  );

describe('R4 — the persistent frame is fully localized', () => {
  it.each(['en', 'pl'] as const)('%s renders its own dictionary in every region', (language) => {
    const t = getDictionary(language).analysisFrame;
    const html = render(language);
    for (const [region, text] of [
      ['index', t.indexRegion],
      /* RETARGETED AT H-ALPHA-VISUAL-1 ITEM A: the sources region on the
         reading path is now SOURCES & REPORTING. `dockHeader` still names
         the forensic dock under the Complete Analysis Record, and is
         still localized — it is simply no longer this region's label. */
      ['sources', t.sourcesReporting],
      ['open source', t.openSource],
      ['record entry', t.completeRecord],
      ['skip link', t.skipToAnalysis],
    ] as const) {
      /* `&` is escaped to `&amp;` in rendered markup — correct HTML, and a
         trap this lane has paid for before. Compare the escaped form. */
      const escaped = text.replace(/&/g, '&amp;');
      expect({ language, region, present: html.includes(escaped) })
        .toEqual({ language, region, present: true });
    }
  });

  it('the two languages actually differ — no untranslated fallthrough', () => {
    expect(render('en')).not.toBe(render('pl'));
    const pl = getDictionary('pl').analysisFrame;
    const en = getDictionary('en').analysisFrame;
    expect(pl.completeRecord).not.toBe(en.completeRecord);
  });

  it('the Complete Record destination is localized too', () => {
    for (const language of ['en', 'pl'] as const) {
      const html = render(language, { initialDestination: 'record' });
      expect({ language, ok: html.includes(getDictionary(language).analysisFrame.completeRecord) })
        .toEqual({ language, ok: true });
    }
  });
});
