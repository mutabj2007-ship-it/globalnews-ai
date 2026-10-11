import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * R3.1 GOOGLE PROFILE PERSONALIZATION (PO/CTO, 2026-10-11) — the signed-in greeting and the
 * Settings identity row.
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
  readonly fromGoogle: string;
  readonly fromEmail: string;
  readonly chosenByYou: string;
  /** The editor hint now that a blank name falls back to the Google / email name. */
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
    fromGoogle: 'From your Google account',
    fromEmail: 'From your email address',
    chosenByYou: 'Chosen by you',
    editHint: 'The name Ask uses to greet you. Leave it empty to use the name from your Google account.',
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
    fromGoogle: 'Z Twojego konta Google',
    fromEmail: 'Z Twojego adresu e-mail',
    chosenByYou: 'Wybrane przez Ciebie',
    editHint: 'Imię, którym Ask się do Ciebie zwraca. Zostaw puste, aby używać imienia z konta Google.',
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
    fromGoogle: 'De votre compte Google',
    fromEmail: 'De votre adresse e-mail',
    chosenByYou: 'Choisi par vous',
    editHint: 'Le nom qu’Ask utilise pour vous saluer. Laissez vide pour utiliser le nom de votre compte Google.',
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
    fromGoogle: 'Aus Ihrem Google-Konto',
    fromEmail: 'Aus Ihrer E-Mail-Adresse',
    chosenByYou: 'Von Ihnen gewählt',
    editHint: 'Der Name, mit dem Ask Sie begrüßt. Leer lassen, um den Namen aus Ihrem Google-Konto zu verwenden.',
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
    fromGoogle: 'De tu cuenta de Google',
    fromEmail: 'De tu dirección de correo',
    chosenByYou: 'Elegido por ti',
    editHint: 'El nombre con el que Ask te saluda. Déjalo vacío para usar el nombre de tu cuenta de Google.',
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
    fromGoogle: 'Da sua conta Google',
    fromEmail: 'Do seu endereço de e-mail',
    chosenByYou: 'Escolhido por você',
    editHint: 'O nome que o Ask usa para cumprimentar você. Deixe em branco para usar o nome da sua conta Google.',
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
    fromGoogle: 'من حسابك على Google',
    fromEmail: 'من عنوان بريدك الإلكتروني',
    chosenByYou: 'اخترته أنت',
    editHint: 'الاسم الذي يحيّيك به Ask. اتركه فارغًا لاستخدام الاسم من حسابك على Google.',
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
