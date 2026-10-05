import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { en } from './en';
import { pl } from './pl';
import { QUALIFIED_DICTIONARY_OVERLAYS, type DictionaryOverlay } from '../qualifiedDictionaryOverlays';

export type Dictionary = typeof en;

/**
 * Milestone #47 — 'en' and 'pl' are authored dictionaries; every other code falls back to
 * English rather than showing missing-string errors or empty labels.
 *
 * T2 · GLOBAL LANGUAGE FOUNDATION. The parameter accepts any display locale or LanguageCode.
 * For fr / de / es / pt / ar the dictionary is English with Claude L's QUALIFIED overlay merged
 * over it (`qualifiedDictionaryOverlays.ts` — empty today, so the result is English). That merge
 * can never put a half-translated namespace in front of a reader: a surface only RENDERS a locale
 * when every namespace it uses is complete for it (the effective-locale rule, surfaceLocale.ts),
 * and otherwise renders English with a declared notice. A locale with no overlay is English — a
 * defensive default, never a claim that it is translated.
 */
const AUTHORED: Partial<Record<LanguageCode | DisplayLocale, Dictionary>> = { en, pl };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function overlay(base: unknown, top: unknown): unknown {
  if (!isRecord(base) || !isRecord(top)) return top === undefined ? base : top;
  /* A plural record is a leaf: replace it whole. */
  if ('other' in base) return top;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(top)) merged[key] = overlay(base[key], value);
  return merged;
}

const merged = new Map<string, Dictionary>();

export function getDictionary(language: LanguageCode | DisplayLocale): Dictionary {
  const authored = AUTHORED[language];
  if (authored !== undefined) return authored;
  const top = (QUALIFIED_DICTIONARY_OVERLAYS as Partial<Record<string, DictionaryOverlay>>)[language];
  if (top === undefined || Object.keys(top).length === 0) return en;
  let hit = merged.get(language);
  if (hit === undefined) {
    hit = overlay(en, top) as Dictionary;
    merged.set(language, hit);
  }
  return hit;
}
