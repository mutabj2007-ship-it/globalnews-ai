import type { LanguageCode } from '@globalnews-ai/shared';
import { en } from './en';
import { pl } from './pl';

export type Dictionary = typeof en;

/**
 * Milestone #47 — only 'en' and 'pl' have real dictionaries; every
 * other ACTIVE-or-planned LanguageCode falls back to English rather
 * than showing missing-string errors or empty labels. This is
 * deliberate and honest: a language without a real dictionary entry
 * here is, by construction, not yet in ACTIVE_LANGUAGES (see
 * languages.ts) and therefore not selectable in the UI at all — this
 * fallback exists only as a defensive default, never as a claim that
 * e.g. Swahili strings are actually translated.
 */
const DICTIONARIES: Partial<Record<LanguageCode, Dictionary>> = {
  en,
  pl,
};

export function getDictionary(language: LanguageCode): Dictionary {
  return DICTIONARIES[language] ?? en;
}
