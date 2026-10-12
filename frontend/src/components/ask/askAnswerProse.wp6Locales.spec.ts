import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DISPLAY_LOCALES, type DisplayLocale, type SummaryStatement } from '@globalnews-ai/shared';
import { AskAnswerProse } from './AskAnswerProse';

/**
 * RETRIEVAL R1 · WP6 — SEVEN-LOCALE PRESENTATION (CTO R4 §5).
 *
 * A WP6-structured answer (direct answer, headings, bullets, a numbered calculation, selective bold,
 * a table, governed citations) is rendered through the real AskAnswerProse in EVERY approved display
 * locale, with answer text written in that locale. Structural acceptance only: the renderer keeps
 * every structure, leaves no raw markup or citation marker, keeps the table in its own horizontal
 * scroll box (phone), and hard-codes no text direction (Arabic inherits RTL from the page). The
 * texts are SYNTHETIC; real model output and device screens are separate, PO-run gates.
 */

const L: Record<
  DisplayLocale,
  {
    lead: string;
    h1: string;
    h2: string;
    b1: string;
    b2: string;
    step: string;
    total: string;
    col: [string, string];
    row: [string, string];
  }
> = {
  en: {
    lead: 'Cargo volumes at the port rose to',
    h1: 'What the reports say',
    h2: 'Calculation',
    b1: 'The port authority published the monthly figures.',
    b2: 'Operators reported longer queues at the gate.',
    step: 'Monthly change',
    total: 'Result',
    col: ['Month', 'Containers'],
    row: ['September', '12,400'],
  },
  pl: {
    lead: 'Przeładunki w porcie wzrosły do',
    h1: 'Co podają źródła',
    h2: 'Obliczenie',
    b1: 'Zarząd portu opublikował dane miesięczne.',
    b2: 'Operatorzy zgłosili dłuższe kolejki przy bramie.',
    step: 'Zmiana miesięczna',
    total: 'Wynik',
    col: ['Miesiąc', 'Kontenery'],
    row: ['Wrzesień', '12 400'],
  },
  fr: {
    lead: 'Le volume de fret du port a atteint',
    h1: 'Ce que disent les sources',
    h2: 'Calcul',
    b1: 'L’autorité portuaire a publié les chiffres mensuels.',
    b2: 'Les opérateurs signalent des files plus longues.',
    step: 'Variation mensuelle',
    total: 'Résultat',
    col: ['Mois', 'Conteneurs'],
    row: ['Septembre', '12 400'],
  },
  de: {
    lead: 'Das Frachtvolumen im Hafen stieg auf',
    h1: 'Was die Berichte sagen',
    h2: 'Berechnung',
    b1: 'Die Hafenbehörde veröffentlichte die Monatszahlen.',
    b2: 'Betreiber meldeten längere Wartezeiten am Tor.',
    step: 'Monatliche Änderung',
    total: 'Ergebnis',
    col: ['Monat', 'Container'],
    row: ['September', '12.400'],
  },
  es: {
    lead: 'El volumen de carga del puerto subió a',
    h1: 'Qué dicen los informes',
    h2: 'Cálculo',
    b1: 'La autoridad portuaria publicó las cifras mensuales.',
    b2: 'Los operadores informaron colas más largas.',
    step: 'Cambio mensual',
    total: 'Resultado',
    col: ['Mes', 'Contenedores'],
    row: ['Septiembre', '12.400'],
  },
  pt: {
    lead: 'O volume de carga do porto subiu para',
    h1: 'O que dizem as fontes',
    h2: 'Cálculo',
    b1: 'A autoridade portuária publicou os números mensais.',
    b2: 'Os operadores relataram filas mais longas.',
    step: 'Variação mensal',
    total: 'Resultado',
    col: ['Mês', 'Contêineres'],
    row: ['Setembro', '12.400'],
  },
  ar: {
    lead: 'ارتفع حجم الشحن في الميناء إلى',
    h1: 'ما تقوله التقارير',
    h2: 'الحساب',
    b1: 'نشرت سلطة الميناء الأرقام الشهرية.',
    b2: 'أبلغ المشغلون عن طوابير أطول عند البوابة.',
    step: 'التغير الشهري',
    total: 'النتيجة',
    col: ['الشهر', 'الحاويات'],
    row: ['سبتمبر', '12,400'],
  },
};

function answerFor(locale: DisplayLocale) {
  const t = L[locale];
  const source = [
    `${t.lead} **${t.row[1]}**.`,
    '',
    `## ${t.h1}`,
    `- ${t.b1}`,
    `- ${t.b2}`,
    '',
    `## ${t.h2}`,
    `1. ${t.step}: 12,400 − 11,900 = 500`,
    `2. ${t.total}: +4.2%`,
    '',
    `| ${t.col[0]} | ${t.col[1]} |`,
    '|---|---|',
    `| ${t.row[0]} | ${t.row[1]} |`,
  ].join('\n');
  const statements: SummaryStatement[] = [
    { text: t.b1, kind: 'REPORTED_FACT', sourceArticleIds: ['ev-port-1'] },
    { text: t.b2, kind: 'REPORTED_FACT', sourceArticleIds: ['ev-port-2'] },
  ];
  const sources = ['ev-port-1', 'ev-port-2'].map((id) => ({
    articleId: id,
    publisher: 'Synthetic Publisher',
    title: `Synthetic title ${id}`,
    url: `https://synthetic.example/${id}`,
    publishedAt: '2026-10-10T08:00:00.000Z',
  }));
  return { source, statements, sources };
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('WP6 · seven-locale presentation through the real AskAnswerProse', () => {
  it('the approved locale matrix is exactly the seven display locales', () => {
    expect([...DISPLAY_LOCALES]).toEqual(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar']);
  });

  it.each(DISPLAY_LOCALES.map((l) => [l] as const))(
    '%s: every structure renders, no raw markup, citations governed',
    (locale) => {
      const props = answerFor(locale);
      const html = renderToStaticMarkup(
        createElement(AskAnswerProse, { ...props, language: locale } as never),
      );
      const t = L[locale];

      expect(count(html, /<h[2-4][ >]/g)).toBe(2);
      expect(html).toContain(t.h1);
      expect(count(html, /<ul[ >]/g)).toBeGreaterThanOrEqual(1);
      expect(count(html, /<ol[ >]/g)).toBe(1);
      expect(count(html, /<strong[ >]/g)).toBeGreaterThanOrEqual(1);
      expect(count(html, /<table[ >]/g)).toBe(1);
      /* the numbers and the calculation are carried exactly as written */
      expect(html).toContain('12,400 − 11,900 = 500');
      expect(html).toContain('+4.2%');
      /* phone: the table sits in its own horizontal scroll box */
      expect(html).toMatch(/overflow-x-auto[^>]*>(?:(?!<\/div>)[\s\S])*<table/u);
      /* governed citations only: links point at the evidence, no raw markers or markup left */
      expect(
        count(html, /href="https:\/\/synthetic\.example\/ev-port-\d"/g),
      ).toBeGreaterThanOrEqual(2);
      expect(html).not.toMatch(/\[ev-/u);
      expect(html).not.toContain('**');
      expect(html).not.toMatch(/(^|>)\s*##/u);
      /* no hard-coded direction: RTL is inherited from the page */
      expect(html).not.toMatch(/\sdir="(?:ltr|rtl)"/u);
    },
  );
});
