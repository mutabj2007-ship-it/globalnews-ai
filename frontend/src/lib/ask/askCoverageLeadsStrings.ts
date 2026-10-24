import type { DisplayLocale } from '@globalnews-ai/shared';

/*
  CTO R168 — GDELT coverage leads. The heading and "Seen by GDELT" wording are the CTO's (EN). The
  note states the distinction R168 requires: a lead lookup is NOT publisher reporting this product
  read or verified, and nothing here is a source for the answer. PL / FR / DE / ES / PT / AR are
  Main's drafts, sent to Claude L for qualification before activation.
*/
export interface AskCoverageLeadsStrings {
  readonly heading: string;
  readonly note: string;
  readonly seenBy: (time: string) => string;
  readonly readOriginal: string;
  /** appended to the link's accessible name */
  readonly opensOutlet: string;
  readonly credit: string;
}

const STRINGS: Record<DisplayLocale, AskCoverageLeadsStrings> = {
  en: {
    heading: 'Coverage leads — not verified reports',
    note: 'Links to other outlets’ coverage found in The GDELT Project’s index. GlobalNewsAI has not read or verified these reports, and they are not sources for this answer.',
    seenBy: (time) => `Seen by GDELT ${time}`,
    readOriginal: 'Read original ↗',
    opensOutlet: 'opens the outlet’s website',
    credit: 'Leads from The GDELT Project',
  },
  pl: {
    heading: 'Tropy publikacji — niezweryfikowane doniesienia',
    note: 'Linki do publikacji innych redakcji znalezione w indeksie The GDELT Project. GlobalNewsAI nie przeczytał ani nie zweryfikował tych doniesień i nie są one źródłami tej odpowiedzi.',
    seenBy: (time) => `Odnotowane przez GDELT ${time}`,
    readOriginal: 'Czytaj oryginał ↗',
    opensOutlet: 'otwiera stronę redakcji',
    credit: 'Tropy z The GDELT Project',
  },
  fr: {
    heading: 'Pistes de couverture — articles non vérifiés',
    note: 'Liens vers la couverture d’autres médias trouvés dans l’index de The GDELT Project. GlobalNewsAI n’a ni lu ni vérifié ces articles, et ils ne sont pas des sources de cette réponse.',
    seenBy: (time) => `Repéré par GDELT ${time}`,
    readOriginal: 'Lire l’original ↗',
    opensOutlet: 'ouvre le site du média',
    credit: 'Pistes issues de The GDELT Project',
  },
  de: {
    heading: 'Berichterstattungshinweise — keine geprüften Berichte',
    note: 'Links zur Berichterstattung anderer Medien aus dem Index von The GDELT Project. GlobalNewsAI hat diese Berichte weder gelesen noch geprüft, und sie sind keine Quellen dieser Antwort.',
    seenBy: (time) => `Von GDELT erfasst ${time}`,
    readOriginal: 'Original lesen ↗',
    opensOutlet: 'öffnet die Website des Mediums',
    credit: 'Hinweise von The GDELT Project',
  },
  es: {
    heading: 'Pistas de cobertura — informaciones no verificadas',
    note: 'Enlaces a la cobertura de otros medios encontrados en el índice de The GDELT Project. GlobalNewsAI no ha leído ni verificado estas informaciones, y no son fuentes de esta respuesta.',
    seenBy: (time) => `Detectado por GDELT ${time}`,
    readOriginal: 'Leer el original ↗',
    opensOutlet: 'abre el sitio web del medio',
    credit: 'Pistas de The GDELT Project',
  },
  pt: {
    heading: 'Pistas de cobertura — reportagens não verificadas',
    note: 'Links para a cobertura de outros meios encontrados no índice do The GDELT Project. O GlobalNewsAI não leu nem verificou estas reportagens, e elas não são fontes desta resposta.',
    seenBy: (time) => `Registado pelo GDELT ${time}`,
    readOriginal: 'Ler o original ↗',
    opensOutlet: 'abre o site do meio de comunicação',
    credit: 'Pistas do The GDELT Project',
  },
  ar: {
    heading: 'مؤشرات تغطية — ليست تقارير موثّقة',
    note: 'روابط إلى تغطية وسائل إعلام أخرى عُثر عليها في فهرس The GDELT Project. لم يقرأ GlobalNewsAI هذه التقارير ولم يتحقق منها، وهي ليست مصادر لهذه الإجابة.',
    seenBy: (time) => `رصده GDELT ‏${time}`,
    readOriginal: 'اقرأ الأصل ↗',
    opensOutlet: 'يفتح موقع الوسيلة الإعلامية',
    credit: 'مؤشرات من The GDELT Project',
  },
};

export function askCoverageLeadsStrings(locale: DisplayLocale | string | undefined): AskCoverageLeadsStrings {
  return (locale !== undefined && (STRINGS as Record<string, AskCoverageLeadsStrings>)[locale]) || STRINGS.en;
}
