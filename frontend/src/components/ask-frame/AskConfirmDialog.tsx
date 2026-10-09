'use client';

import { useEffect, useId, useRef, type JSX } from 'react';
import styles from './askDashboard.module.css';

/**
 * ASK R3 FULL DESIGN R1 — D12-delete: the Design's confirmation dialog, replacing the browser's
 * native `window.confirm` (which could not be themed, mirrored for RTL or labelled).
 *
 * `role="alertdialog"`, `aria-modal`, named by its title and described by its body. The SAFE
 * choice ("Keep") holds focus first, so Enter/Escape never destroy anything; the destructive
 * action is explicit. Tab is contained; focus returns to the opener on close (the caller's
 * `returnFocus`). It renders nothing itself beyond the dialog: the caller does the one request.
 */
export function AskConfirmDialog({
  title,
  body,
  note,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly body: string;
  readonly note?: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const titleId = useId();
  const bodyId = useId();
  const box = useRef<HTMLElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    keepRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || box.current === null) return;
      const nodes = Array.from(box.current.querySelectorAll<HTMLElement>('button'));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (first === undefined || last === undefined) return;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div data-ask="confirm-backdrop" className={styles.r3SheetBackdrop} onClick={onCancel}>
      <section
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-ask="confirm-dialog"
        className={styles.r3Sheet}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.r3SheetBody}>
          <h2 id={titleId} className={styles.r3NoticeTitle}>
            {title}
          </h2>
          <div id={bodyId} className="flex flex-col gap-2">
            <p className={styles.r3Quiet}>{body}</p>
            {note !== undefined && <p className={styles.r3Small}>{note}</p>}
          </div>
          <div className={styles.r3Actions}>
            <button ref={keepRef} type="button" data-ask="confirm-keep" onClick={onCancel} className={styles.r3Secondary}>
              {cancelLabel}
            </button>
            <button type="button" data-ask="confirm-destroy" onClick={onConfirm} className={styles.r3Destructive}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
