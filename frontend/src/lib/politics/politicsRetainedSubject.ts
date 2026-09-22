import type { PoliticsReadResponse, RetainedPoliticsObservation } from '@globalnews-ai/shared';

/** Selection only: no scores, chronology sort, Watch activation or preview fallback. */
export function selectRetainedPoliticsSubject(response: PoliticsReadResponse, subjectId: string): readonly RetainedPoliticsObservation[] {
  return response.acquisition === 'RETAINED_ONLY'
    ? response.observations.filter(o => o.subjectId === subjectId)
    : [];
}

/** Source wording remains verbatim; UI locale never rewrites provenance.language. */
export function politicsSourceLanguageNotice(sourceLanguage: string, locale: 'en' | 'pl'): string {
  return locale === 'pl'
    ? `Język źródła: ${sourceLanguage}. Zachowano oryginalne brzmienie.`
    : `Source language: ${sourceLanguage}. Original wording retained.`;
}
