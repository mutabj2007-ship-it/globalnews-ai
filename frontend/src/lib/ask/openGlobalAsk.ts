'use client';

export const GLOBAL_ASK_OPEN_EVENT = 'globalnews:ask-open';

export interface GlobalAskOpenDetail {
  /**
   * Optional draft to stage in the Global Ask dock.
   * Omitted means "open the dock and preserve whatever draft is already there."
   */
  question?: string;
}

/**
 * Opens the existing root-mounted Global Ask dock without navigating and
 * without submitting anything. This function has no transport side effects:
 * it only dispatches an in-document event.
 */
export function openGlobalAsk(question?: string): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<GlobalAskOpenDetail>(GLOBAL_ASK_OPEN_EVENT, {
      detail: question === undefined ? {} : { question },
    }),
  );
}
