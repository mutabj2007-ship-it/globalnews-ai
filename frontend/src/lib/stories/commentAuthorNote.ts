/**
 * R76 / R77 (E1_B_NAME_PRIVACY_CONDITIONAL C-3; CTO R77 "complete the public-name comment disclosure
 * across all seven languages") — said beside the comment composer BEFORE a signed-in reader posts:
 * the name saved in Settings is the PUBLIC author label (backend `authorLabelOf`), and with no saved
 * name the comment shows as "Reader". A privacy disclosure, so it is given in the reader's own
 * language even where the surrounding panel falls back to English.
 *
 * EN is Main's wording; PL / FR / DE / ES / PT / AR are integrator drafts PENDING Localisation
 * (Claude L) qualification.
 */
const NOTE: Readonly<Record<'en' | 'pl' | 'fr' | 'de' | 'es' | 'pt' | 'ar', string>> = {
  en: 'Others see your comment under the name you saved in Settings, or as “Reader” if you saved none.',
  pl: 'Inni widzą Twój komentarz pod imieniem zapisanym w Ustawieniach, a jeśli go nie zapisano — jako „Czytelnik”.',
  fr: 'Les autres voient votre commentaire sous le nom enregistré dans les Paramètres, ou sous « Lecteur » si vous n’en avez enregistré aucun.',
  de: 'Andere sehen Ihren Kommentar unter dem in den Einstellungen gespeicherten Namen, oder als „Leser“, wenn Sie keinen gespeichert haben.',
  es: 'Los demás ven tu comentario con el nombre guardado en Ajustes, o como «Lector» si no guardaste ninguno.',
  pt: 'Os outros veem o seu comentário com o nome guardado nas Definições, ou como «Leitor» se não guardou nenhum.',
  ar: 'يرى الآخرون تعليقك باسمك المحفوظ في الإعدادات، أو باسم «قارئ» إن لم تحفظ اسمًا.',
};

export const COMMENT_AUTHOR_NOTE_LOCALES = Object.keys(NOTE) as readonly (keyof typeof NOTE)[];

export function commentAuthorNote(language: string): { readonly text: string; readonly dir: 'rtl' | 'ltr'; readonly lang: string } {
  const key = (language in NOTE ? language : 'en') as keyof typeof NOTE;
  return { text: NOTE[key], dir: key === 'ar' ? 'rtl' : 'ltr', lang: key };
}
