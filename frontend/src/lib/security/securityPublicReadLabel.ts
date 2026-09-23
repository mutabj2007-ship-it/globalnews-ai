import type { SecLocale } from './securityStrings';

/** Class-level release gate only; no candidate content or per-record review status. */
export function securityPublicReadExplanation(locale: SecLocale): string {
  return locale === 'pl'
    ? 'Treść publiczna wymaga zatwierdzonego przeglądu i zgody na ocenę. Powiązane doniesienia są wyłącznie kontekstem.'
    : 'Public content requires governed review and assessment approval. Related reporting is contextual only.';
}
