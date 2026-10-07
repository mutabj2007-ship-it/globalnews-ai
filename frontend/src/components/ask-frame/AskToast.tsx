'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';
import styles from './askDashboard.module.css';

/**
 * ASK DESIGN COMPLETENESS R1 — THE TOAST (Design C5 · RECONCILIATION_GUIDE §8 "Save").
 *
 * One short confirmation with an optional action, shown ABOVE the composer for 4 s
 * (`role="status"`), so it never covers the answer's toolbar or the last paragraph. It states
 * only what the server already confirmed (e.g. a bookmark the API answered `bookmarked: true`
 * for); its action is a real request (Undo = the existing unbookmark call), never a promise.
 */
export interface AskToastMessage {
  readonly text: string;
  readonly action?: { readonly label: string; readonly run: () => void };
}

type ShowToast = (message: AskToastMessage) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Null outside the Ask frame: callers then simply show no toast. */
export function useAskToast(): ShowToast | null {
  return useContext(ToastContext);
}

const TOAST_MS = 4000;

export function AskToastProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [message, setMessage] = useState<AskToastMessage | null>(null);
  const [generation, setGeneration] = useState(0);
  const show = useCallback<ShowToast>((next) => {
    setMessage(next);
    setGeneration((g) => g + 1);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      <ToastSlotContext.Provider value={{ message, generation, clear: () => setMessage(null) }}>
        {children}
      </ToastSlotContext.Provider>
    </ToastContext.Provider>
  );
}

const ToastSlotContext = createContext<{
  readonly message: AskToastMessage | null;
  readonly generation: number;
  readonly clear: () => void;
} | null>(null);

/** Where the toast renders: the frame puts this directly above the composer. */
export function AskToastSlot(): JSX.Element | null {
  const slot = useContext(ToastSlotContext);
  const clear = useRef(slot?.clear);
  clear.current = slot?.clear;
  const generation = slot?.generation ?? 0;
  useEffect(() => {
    if (generation === 0) return;
    const timer = setTimeout(() => clear.current?.(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [generation]);
  if (slot === null || slot.message === null) return null;
  const { text, action } = slot.message;
  return (
    <div data-ask="toast" role="status" className={styles.toast}>
      <span>{text}</span>
      {action !== undefined && (
        <button
          type="button"
          data-ask="toast-action"
          onClick={() => {
            action.run();
            slot.clear();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
