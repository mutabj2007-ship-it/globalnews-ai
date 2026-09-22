import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { humanitarianReadAbsence, type HumanitarianRetainedRead } from '@globalnews-ai/shared';
import { DomainEvidenceStatus } from './DomainEvidenceStatus';

function render(
  domain: 'humanitarian' | 'security',
  locale: string,
  read = humanitarianReadAbsence('NOT_ASSESSED'),
) {
  const children = createElement('div', { 'data-framework-fixture': true }, 'Reference framework');
  return renderToStaticMarkup(
    createElement(
      DomainEvidenceStatus,
      domain === 'humanitarian'
        ? { domain, locale, retainedRead: read, children }
        : { domain, locale, children },
    ),
  );
}

describe('Public evidence status admission boundary', () => {
  it.each(['en', 'pl'])('keeps absence and read failure distinct in %s', (locale) => {
    const closed = render('humanitarian', locale);
    const failed = render(
      'humanitarian',
      locale,
      humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE'),
    );
    expect(closed).toContain('data-evidence-status="GATE_CLOSED"');
    expect(failed).toContain('data-evidence-status="READ_UNAVAILABLE"');
    expect(closed).not.toEqual(failed);
    expect(closed).toContain('CURRENT_PROTECTION_AUTHORITY_REQUIRED');
    expect(closed).toContain('PUBLIC_OBSERVATION_READER_REQUIRED');
    expect(closed).toContain('REVIEWED_CAPTURE_REQUIRED');
  });
  it.each(['en', 'pl'])(
    'keeps the legacy framework collapsed and renders localized status in %s',
    (locale) => {
      for (const domain of ['humanitarian', 'security'] as const) {
        const html = render(domain, locale);
        expect(html).toContain('<details');
        expect(html).not.toMatch(/<details[^>]*\bopen/);
        expect(html).toContain(
          locale === 'pl' ? 'Dowody i zakres pokrycia' : 'Evidence &amp; coverage',
        );
        expect(html).not.toMatch(/<time|<iframe|<img|<svg/);
        expect(html).toContain(locale === 'pl' ? 'wyłącznie jako kontekst' : 'context only');
      }
    },
  );
  it('rejects positive/unknown payloads at the display seam without leaking source content', () => {
    const forged = {
      kind: 'OBSERVATIONS',
      absence: 'NOT_ASSESSED',
      observations: [{ name: 'SECRET PERSON', url: 'https://private.invalid', severity: 99 }],
    } as unknown as HumanitarianRetainedRead;
    const html = render('humanitarian', 'en', forged);
    expect(html).toContain('READ_UNAVAILABLE');
    expect(html).not.toMatch(/SECRET PERSON|private.invalid|severity:99/);
  });
  it('shows the Security release gate without claiming a record was examined', () => {
    const html = render('security', 'en');
    expect(html).toContain('PUBLIC_CONTENT_NOT_AUTHORISED');
    expect(html).toContain('not an assessment of any country');
    expect(html).not.toMatch(/0 incidents|No incidents|No verified evidence/);
  });
  it('makes no network requests while rendering either domain', () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('No network'));
    try {
      render('humanitarian', 'en');
      render('security', 'pl');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
