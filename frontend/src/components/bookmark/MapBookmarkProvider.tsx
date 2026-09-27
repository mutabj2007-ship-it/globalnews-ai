'use client';

import type { ReactNode } from 'react';
import { StoryBookmark } from './StoryBookmark';
import { StoryBookmarkSlot } from './bookmarkSlot';

/** The /map route's bookmark: fills the account-free slot SourceCard reads. */
export function MapBookmarkProvider({ children }: { children: ReactNode }): JSX.Element {
  return <StoryBookmarkSlot.Provider value={StoryBookmark}>{children}</StoryBookmarkSlot.Provider>;
}
