'use client';

import { useAskNavCleared } from './AskNavShell';

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the private body of a standalone Ask page (Recent,
 * Saved, Help & feedback, Settings) disappears the moment Sign out or New question is
 * pressed, before the clean document load replaces the page. It renders its children
 * unchanged otherwise, and adds no element of its own.
 */
export function AskClearedBoundary({
  children,
}: {
  readonly children: React.ReactNode;
}): JSX.Element {
  const cleared = useAskNavCleared();
  if (cleared) return <main data-ask="cleared" className="min-h-screen bg-void" />;
  return <>{children}</>;
}
