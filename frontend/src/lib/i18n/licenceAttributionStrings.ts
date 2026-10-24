/**
 * E1 V7 C-B1 — the strings of the licence credit line and the credited-reporting section.
 *
 * EN is written to E1's four CC BY 3.0 conditions (credit the author, link the licence, say whether
 * changes were made, imply no endorsement) plus GV's house rule (author name, link to the original).
 * PL / FR / DE / ES / PT / AR are integrator drafts PENDING Localisation (Claude L) qualification;
 * none is presented as qualified. No direction-control character anywhere (E1-BIDI-1): the author
 * name is isolated in markup (<bdi>) by the component, never in these strings.
 */
export interface LicenceAttributionStrings {
  readonly sectionTitle: string;
  readonly sectionNote: string;
  readonly writtenBy: string;
  readonly original: string;
  readonly licence: string;
  readonly unchanged: string;
}

const CATALOGUE: Readonly<Record<string, LicenceAttributionStrings>> = {
  en: {
    sectionTitle: 'Credited reporting',
    sectionNote: 'Shown under the publisher’s open licence, with its author credited. Not endorsed by the publisher or the author.',
    writtenBy: 'Written by',
    original: 'Original article',
    licence: 'Licence',
    unchanged: 'Headline shown unchanged',
  },
  pl: {
    sectionTitle: 'Materiały z podaniem autora',
    sectionNote: 'Pokazane na otwartej licencji wydawcy, z podaniem autora. Wydawca ani autor ich nie popierają.',
    writtenBy: 'Autor:',
    original: 'Oryginalny artykuł',
    licence: 'Licencja',
    unchanged: 'Tytuł bez zmian',
  },
  fr: {
    sectionTitle: 'Reportages crédités',
    sectionNote: 'Présentés sous la licence ouverte de l’éditeur, avec mention de l’auteur. Sans approbation de l’éditeur ni de l’auteur.',
    writtenBy: 'Écrit par',
    original: 'Article original',
    licence: 'Licence',
    unchanged: 'Titre reproduit sans modification',
  },
  de: {
    sectionTitle: 'Berichte mit Quellenangabe',
    sectionNote: 'Unter der offenen Lizenz des Verlags gezeigt, mit Nennung der Autorin oder des Autors. Keine Billigung durch Verlag oder Autor.',
    writtenBy: 'Geschrieben von',
    original: 'Originalartikel',
    licence: 'Lizenz',
    unchanged: 'Überschrift unverändert',
  },
  es: {
    sectionTitle: 'Reportajes con crédito',
    sectionNote: 'Mostrados bajo la licencia abierta del editor, con crédito a su autor. Sin respaldo del editor ni del autor.',
    writtenBy: 'Escrito por',
    original: 'Artículo original',
    licence: 'Licencia',
    unchanged: 'Titular sin cambios',
  },
  pt: {
    sectionTitle: 'Reportagens creditadas',
    sectionNote: 'Exibidas sob a licença aberta do editor, com crédito ao autor. Sem endosso do editor nem do autor.',
    writtenBy: 'Escrito por',
    original: 'Artigo original',
    licence: 'Licença',
    unchanged: 'Título sem alterações',
  },
  ar: {
    sectionTitle: 'تقارير منسوبة إلى أصحابها',
    sectionNote: 'تُعرض بموجب الترخيص المفتوح للناشر مع نسبتها إلى كاتبها، ولا تعني تأييد الناشر أو الكاتب.',
    writtenBy: 'كتبه',
    original: 'المقال الأصلي',
    licence: 'الترخيص',
    unchanged: 'العنوان معروض دون تغيير',
  },
};

export function licenceAttributionStrings(language: string): LicenceAttributionStrings {
  return CATALOGUE[language] ?? CATALOGUE.en!;
}

/** The licence's human name for the ids the backend can emit; unknown ids render nothing (fail closed). */
export const LICENCE_NAMES: Readonly<Record<string, string>> = { 'CC-BY-3.0': 'CC BY 3.0' };
