'use client';

import { createContext, type ComponentType } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';

/**
 * UNIVERSAL BOOKMARK R1 — A SLOT, SO SHARED MAP COMPONENTS STAY ACCOUNT-FREE.
 *
 * The map shell's SourceCard is also part of the Conflict dashboard, whose
 * browser module graph is deliberately kept free of the account client and
 * its environment-origin resolver (lib/conflict/network.spec.ts). SourceCard
 * therefore does NOT import the bookmark: it renders whatever the page
 * provides here. The /map route provides StoryBookmark; Conflict provides
 * nothing, and its evidence cards render exactly as before.
 *
 * This module imports nothing but React, so reading the slot adds nothing to
 * any module graph.
 */
export interface StoryBookmarkSlotProps {
  readonly url: string;
  readonly language: LanguageCode;
  readonly size?: 'default' | 'compact';
  readonly className?: string;
}

export const StoryBookmarkSlot = createContext<ComponentType<StoryBookmarkSlotProps> | null>(null);
