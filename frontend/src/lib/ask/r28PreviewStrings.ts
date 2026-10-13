import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * CTO R28 — the Alpha-only Ask DESIGN PREVIEW (`/ask/preview`).
 *
 * NEW, English only. This page exists for Product Owner review on Alpha and is a 404 on the
 * standalone (Production) root. Until Claude Design / Claude L deliver translations, every locale
 * shows the English — the same declared-fallback convention as `askShellDeclaredFallbacks` and
 * `r23PickerStrings`; `r28PreviewStringsFellBack` reports which locales do. The page still renders
 * in the reader's locale DIRECTION (RTL for Arabic).
 *
 * Every sample on this page is fictional and labelled as such. No string names a real employer,
 * publisher, source, place or person.
 */
export const R28_PREVIEW_EN = {
  title: 'Design previews',
  banner: 'Alpha design preview — not live. Sample content only; these features are not yet available.',
  badge: 'Preview: not live',
  sample: 'Sample',
  mapTitle: 'Contextual map and route',
  mapReason: 'Not live: needs a geographic-evidence contract (precision and provenance) from the backend.',
  mapSchematic: 'Schematic illustration — not a real map, not real coverage.',
  mapListTitle: 'Places in this answer',
  mapPlaceTitle: 'Sample place A',
  mapPlaceBody: 'Sample summary of why this place appears. Coverage: not checked (preview).',
  routeTitle: 'Followed route',
  routeBody: 'From Sample place A to Sample place B',
  routeEdit: 'Edit route',
  routeFollowedPlace: 'Followed place: Sample place C',
  scheduleTitle: 'Scheduled check',
  scheduleReason: 'Not live: needs an authorized scheduling service.',
  scheduleBody: 'Scheduling is not available yet: checks are started by you.',
  scheduleDaily: 'Every day',
  scheduleWeekly: 'Every week',
  scheduleToggle: 'Check this automatically',
  jobsTitle: 'Job opportunities',
  jobsReason: 'Not live: needs an admitted job-listing source with cleared rights.',
  jobsActive: 'Looking for matching opportunities…',
  jobsActiveDone: 'Sources searched.',
  jobsNext: 'Checking original listings and deadlines…',
  jobsRole: 'Sample role',
  jobsEmployer: 'Example employer',
  jobsPlace: 'Sample city',
  jobsDeadline: 'Deadline not stated',
  jobsSource: 'Source: sample source (not connected)',
  jobsChecked: 'Last checked: —',
  jobsDetails: 'View details',
  jobsSave: 'Save',
  jobsDetailTitle: 'Requirements (sample)',
  jobsDetailBody: 'Advertised requirements, eligibility constraints and missing information would appear here, separated from Ask’s explanation.',
  jobsSourceTitle: 'Source review',
  jobsSourceBody: 'Which original listing was checked, and what remains uncertain.',
  jobsHandoff: 'Open original application',
  jobsFollow: 'Follow this search',
  jobsUpdate: 'Example update: 1 new sample listing (illustration)',
  jobsChange: 'Example change: a sample deadline moved (illustration)',
  progressTitle: 'Research progress states',
  progressReason: 'Not live: needs real stage events from the backend. Ask today shows one honest status.',
  progressIllustration: 'Illustration of future progress states.',
  progressSlow: 'Still searching sources — taking longer than usual.',
  progressCancelled: 'Search cancelled. Nothing further was run.',
  progressRetry: 'Try again',
  progressRetryNote: 'A new attempt starts with no completed steps.',
  progressReduced: 'Reduced motion: a still mark with changing status text.',
  progressKeyboard: 'Compact progress above the keyboard-safe composer.',
  progressSingle: 'Working on your question…',
  progressSingleNote: 'This single status is what Ask shows today.',
} as const;

export type R28PreviewStrings = typeof R28_PREVIEW_EN;

export function r28PreviewStrings(_locale: DisplayLocale): R28PreviewStrings {
  return R28_PREVIEW_EN;
}

/** True when the strings render in English for this locale (every locale except EN today). */
export function r28PreviewStringsFellBack(locale: DisplayLocale): boolean {
  return locale !== 'en';
}
