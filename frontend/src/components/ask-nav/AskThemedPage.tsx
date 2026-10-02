import type { ReactNode } from 'react';
import styles from '@/components/ask-frame/askDashboard.module.css';
import { ThemeScope } from '@/components/platform/ThemeControl';
import type { ThemePreference } from '@/lib/theme/theme';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — the Standalone Ask takes the platform theme (PO: the
 * Theme feature already built for the platform is offered in the standalone chatroom too).
 *
 * This IS PR #66's one viewport-high column (`styles.page`), now also the theme scope: the server
 * renders it with the reader's cookie preference so the first frame is already their theme
 * (System resolves in CSS; Scheduled through the <html> attribute set before paint). The answer
 * components are not forked: the generated adapter (askThemeAdapter.ts) and the --ask-* surface
 * variables retarget their accepted dark palette onto the --gt-* tokens only when the scope
 * resolves to Light. Dark is byte-for-byte the accepted Ask palette.
 */
export function AskThemedPage({
  theme,
  root,
  children,
}: {
  readonly theme: ThemePreference;
  /** The public root marks itself, exactly as before (`data-ask-root="standalone"`). */
  readonly root?: 'standalone';
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <ThemeScope
      initial={theme}
      className={styles.page}
      data-ask-standalone=""
      {...(root === undefined ? {} : { 'data-ask-root': root })}
    >
      {children}
    </ThemeScope>
  );
}
