/**
 * ════════════════════════════════════════════════════════════════════════════
 * LANE E — HOME SUGGESTION & FIRST-TURN RETRIEVAL INTEGRITY R1
 * THE ONE CANONICAL LIST OF STATIC HOME SUGGESTIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A question GlobalNewsAI itself recommends must be among the best-supported
 * questions in the product. Gate E-A measured the previous set: 4 of 6 English
 * and 5 of 6 Polish suggestions could not retrieve any evidence through our own
 * routing, and "Summarize today's central bank announcement" did not even say
 * which central bank it meant.
 *
 * EVERY ENTRY HERE MUST BE:
 *   SELF-CONTAINED  it names its subject; no hidden Home/session context.
 *   SUPPORTED       its framing reduces through the governed retrieval grammar.
 *   LOCALIZED       EN and PL each route correctly on their own; the Polish
 *                   subject is phrased in the case real Polish headlines use.
 *   ZERO-COMPUTE    tapping one stages it in the composer; nothing runs.
 *   TOPIC-ROUTED    a subject that names a country goes to the topic-agnostic
 *                   country feed ("US election polls" would answer from general
 *                   US news), so every subject here routes through the topic path.
 *
 * `backend/.../homeSuggestionIntegrity.spec.ts` runs every entry, in both
 * languages, through the real AnalysisService routing. An entry that fails it
 * does not ship. The frontend dictionaries read this list; there is no second
 * copy to drift.
 *
 * Suggestions derived from the stories actually on Home ("Summarize the ECB
 * decision reported above") are the long-term direction and a separate
 * feature; this is the safe static set.
 */
export const HOME_SUGGESTIONS = {
  en: [
    'What’s happening in the Middle East right now?',
    'Explain the new EU AI regulation in plain English',
    'Summarize the latest news on ECB interest rates',
    'Summarize the latest IPCC climate report',
    'Break down this week’s tech earnings',
    'Summarize the latest news on OPEC oil production',
  ],
  pl: [
    'Co się teraz dzieje na Bliskim Wschodzie?',
    'Wyjaśnij nowe przepisy UE o sztucznej inteligencji prostym językiem',
    'Omów stopy procentowe EBC',
    'Podsumuj najnowszy raport klimatyczny IPCC',
    'Omów wyniki finansowe firm technologicznych z tego tygodnia',
    'Omów wydobycie ropy OPEC',
  ],
} as const;
