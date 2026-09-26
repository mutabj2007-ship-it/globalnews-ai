'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';

interface HomeAskLauncherProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> {
  question?: string;
  children: ReactNode;
}

/**
 * Home-only Ask entry. Opens the root Ask dock in place.
 * It never submits or navigates; the first analysis request still happens
 * only when the reader explicitly presses Ask/Send inside the dock.
 */
export function HomeAskLauncher({
  question,
  children,
  ...buttonProps
}: HomeAskLauncherProps): JSX.Element {
  return (
    <button
      {...buttonProps}
      type="button"
      onClick={() => openGlobalAsk(question)}
    >
      {children}
    </button>
  );
}
