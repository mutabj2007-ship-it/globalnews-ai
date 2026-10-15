import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * R3.1 GOOGLE PROFILE PERSONALIZATION (PO/CTO, 2026-10-11) — the signed-in greeting and the
 * Settings identity row.
 *
 * R76 (E1_B_NAME_PRIVACY_CONDITIONAL) — the only name is the one the reader SAVED in Settings
 * (no Google / email source: `fromGoogle` / `fromEmail` are removed). C-3: the saved name is also
 * the PUBLIC author label on story comments, so the editor hint and the identity row say so.
 *
 * A signed-in reader is greeted by name with a time-appropriate, localised greeting; a reader
 * with no usable name keeps the existing neutral "Welcome back"; a signed-out reader is not
 * greeted. NO HONORIFIC is ever inferred (no Mr / Ms / Pan / Pani / Herr / Frau / Sr / Sra / سيد),
 * and no part of an email address is ever shown here. The name is wrapped in FSI/PDI so a Latin
 * name keeps its own direction inside Arabic, and an Arabic name inside a Latin sentence.
 *
 * EN is written for the PO ruling; PL / FR / DE / ES / PT / AR are integrator drafts PENDING
 * Localisation (Claude L) qualification, and none is presented as qualified.
 */
export type AskDayPart = 'morning' | 'afternoon' | 'evening';

export interface AskGreetingStrings {
  readonly greet: Record<AskDayPart, (name: string) => string>;
  /* Settings › Account identity row */
  readonly nameLabel: string;
  readonly change: string;
  readonly cancel: string;
  readonly notSet: string;
  readonly chosenByYou: string;
  /** R76 E1 C-3 — under a saved name: it is also the PUBLIC author label on comments. */
  readonly publicNote: string;
  /** R76 E1 C-3 — the editor hint: greeting use, public comment label, neutral when empty. */
  readonly editHint: string;
}

const iso = (name: string): string => `⁨${name}⁩`;

const CATALOGUE: Record<DisplayLocale, AskGreetingStrings> = {
  en: {
    greet: {
      morning: (n) => `Good morning, ${iso(n)}`,
      afternoon: (n) => `Good afternoon, ${iso(n)}`,
      evening: (n) => `Good evening, ${iso(n)}`,
    },
    nameLabel: 'Name',
    change: 'Change',
    cancel: 'Cancel',
    notSet: 'Not set',
    chosenByYou: 'Chosen by you',
    publicNote: "Also shown publicly on your comments",
    editHint: "The name Ask uses to greet you. It is also shown publicly as your author name on comments you post. Leave it empty for a neutral greeting.",
  },
  pl: {
    greet: {
      morning: (n) => `Dzień dobry, ${iso(n)}`,
      afternoon: (n) => `Dzień dobry, ${iso(n)}`,
      evening: (n) => `Dobry wieczór, ${iso(n)}`,
    },
    nameLabel: 'Imię',
    change: 'Zmień',
    cancel: 'Anuluj',
    notSet: 'Nie ustawiono',
    chosenByYou: 'Wybrane przez Ciebie',
    publicNote: "Widoczne też publicznie przy Twoich komentarzach",
    editHint: "Imię, którym Ask się do Ciebie zwraca. Jest też widoczne publicznie jako podpis komentarzy, które publikujesz. Zostaw puste, aby otrzymać neutralne powitanie.",
  },
  fr: {
    greet: {
      morning: (n) => `Bonjour, ${iso(n)}`,
      afternoon: (n) => `Bonjour, ${iso(n)}`,
      evening: (n) => `Bonsoir, ${iso(n)}`,
    },
    nameLabel: 'Nom',
    change: 'Modifier',
    cancel: 'Annuler',
    notSet: 'Non défini',
    chosenByYou: 'Choisi par vous',
    publicNote: "Également affiché publiquement sur vos commentaires",
    editHint: "Le nom qu’Ask utilise pour vous saluer. Il est aussi affiché publiquement comme nom d’auteur des commentaires que vous publiez. Laissez vide pour un accueil neutre.",
  },
  de: {
    greet: {
      morning: (n) => `Guten Morgen, ${iso(n)}`,
      afternoon: (n) => `Guten Tag, ${iso(n)}`,
      evening: (n) => `Guten Abend, ${iso(n)}`,
    },
    nameLabel: 'Ihr Name',
    change: 'Ändern',
    cancel: 'Abbrechen',
    notSet: 'Nicht festgelegt',
    chosenByYou: 'Von Ihnen gewählt',
    publicNote: "Auch öffentlich bei Ihren Kommentaren sichtbar",
    editHint: "Der Name, mit dem Ask Sie begrüßt. Er wird auch öffentlich als Autorenname Ihrer veröffentlichten Kommentare angezeigt. Leer lassen für eine neutrale Begrüßung.",
  },
  es: {
    greet: {
      morning: (n) => `Buenos días, ${iso(n)}`,
      afternoon: (n) => `Buenas tardes, ${iso(n)}`,
      evening: (n) => `Buenas noches, ${iso(n)}`,
    },
    nameLabel: 'Nombre',
    change: 'Cambiar',
    cancel: 'Cancelar',
    notSet: 'Sin definir',
    chosenByYou: 'Elegido por ti',
    publicNote: "También visible públicamente en tus comentarios",
    editHint: "El nombre con el que Ask te saluda. También se muestra públicamente como autor de los comentarios que publiques. Déjalo vacío para un saludo neutro.",
  },
  pt: {
    greet: {
      morning: (n) => `Bom dia, ${iso(n)}`,
      afternoon: (n) => `Boa tarde, ${iso(n)}`,
      evening: (n) => `Boa noite, ${iso(n)}`,
    },
    nameLabel: 'Nome',
    change: 'Alterar',
    cancel: 'Cancelar',
    notSet: 'Não definido',
    chosenByYou: 'Escolhido por você',
    publicNote: "Também visível publicamente nos seus comentários",
    editHint: "O nome que o Ask usa para cumprimentar você. Ele também aparece publicamente como autor dos comentários que você publicar. Deixe em branco para uma saudação neutra.",
  },
  ar: {
    greet: {
      morning: (n) => `صباح الخير، ${iso(n)}`,
      afternoon: (n) => `مساء الخير، ${iso(n)}`,
      evening: (n) => `مساء الخير، ${iso(n)}`,
    },
    nameLabel: 'الاسم',
    change: 'تغيير',
    cancel: 'إلغاء',
    notSet: 'غير محدد',
    chosenByYou: 'اخترته أنت',
    publicNote: "يظهر أيضًا للعموم في تعليقاتك",
    editHint: "الاسم الذي يحيّيك به Ask. ويظهر أيضًا للعموم كاسم الكاتب في التعليقات التي تنشرها. اتركه فارغًا لتحية محايدة.",
  },
};

export function askGreetingStrings(locale: DisplayLocale): AskGreetingStrings {
  return CATALOGUE[locale] ?? CATALOGUE.en;
}

/** The reader's own local hour → part of day: 05–11 morning, 12–17 afternoon, 18–04 evening. */
export function askDayPart(at: Date): AskDayPart {
  const h = at.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}
