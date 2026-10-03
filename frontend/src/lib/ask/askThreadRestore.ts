import { askR2PayloadOf, askV2Api } from '@/lib/api/askV2Api';
import type { AskR2Turn } from '@/lib/ask/useAskR2Conversation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO P0 · DEFECT F — A COMPLETED CONVERSATION DOES NOT DISAPPEAR ON REFRESH OR BACK
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Traced on live Alpha (read-only): the PO's first Rwanda turn was persisted and COMPLETED in
 * thread c607f7d3 (2 turns); the next questions landed in NEW threads 0a266c20 and f4012c92. The
 * turn was never lost — the screen stopped showing it. For a SIGNED-IN reader /ask restores a
 * conversation on open only after a guest-claim continuation; a refresh or a navigation back to
 * /ask showed an empty conversation, and the next Ask opened a new thread.
 *
 * The repair uses the existing, owner-scoped reopen address (`/ask?operation=<id>`, the same one
 * Recent and Saved use):
 *   - after each completed turn the address bar is REPLACED (no new history entry) with the
 *     latest operation, so a refresh or a Back returns to this conversation;
 *   - a reopen restores the thread's EARLIER turns too (display-only reads: no AI, no provider,
 *     nothing rerun), and the existing continueThread keeps the next Ask in the same thread;
 *   - "New question" (plain /ask) still starts a new conversation.
 */
export const EARLIER_RESTORE_LIMIT = 20;

/** The latest completed turn's reopen address, written without adding a history entry. */
export function rememberConversation(operationId: string): void {
  if (typeof window === 'undefined' || !/^[0-9a-f-]{36}$/i.test(operationId)) return;
  const url = new URL(window.location.href);
  if (url.pathname !== '/ask' || url.searchParams.get('operation') === operationId) return;
  window.history.replaceState(
    window.history.state,
    '',
    `/ask?operation=${encodeURIComponent(operationId)}`,
  );
}

/**
 * The reopened thread's turns BEFORE the reopened operation, oldest first — display-only reads
 * through the reader's own surface (account or guest). A failed read shows the question with its
 * failure; nothing is retried or rerun.
 */
export async function readEarlierTurns(
  threadId: string,
  reopenedOperationId: string,
  guest: boolean,
): Promise<AskR2Turn[]> {
  const history = guest ? await askV2Api.guestThread(threadId) : await askV2Api.thread(threadId);
  if (!history.ok) return [];
  const index = history.value.turns.findIndex((t) => t.operationId === reopenedOperationId);
  const earlier = (index < 0 ? [] : history.value.turns.slice(0, index)).slice(
    -EARLIER_RESTORE_LIMIT,
  );
  const reads = await Promise.all(
    earlier.map((t) =>
      guest ? askV2Api.guestOperation(t.operationId) : askV2Api.operation(t.operationId),
    ),
  );
  return earlier.map((t, i) => {
    const op = reads[i];
    return op.ok
      ? {
          question: t.question,
          operation: op.value,
          payload: askR2PayloadOf(op.value),
          ...(op.value.failureCode ? { failure: op.value.failureCode } : {}),
          ...(op.value.result?.expired === true ? { expired: true } : {}),
        }
      : { question: t.question, failure: op.reason };
  });
}
