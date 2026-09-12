'use client';

import { useState } from 'react';
import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import type { PrimaryDimensionKey } from '../search/analysisDimensions';
import { AnalysisFrame } from './AnalysisFrame';
import { CompleteRecordView } from './CompleteRecordView';
import { EvidenceLibrary } from './EvidenceLibrary';

/**
 * R4 — the frame's DESTINATION SWITCH, separated from its data source.
 *
 * `AnalysisFrameClient` already owned this switch, but it owned the
 * fetch too: it takes a query, calls `analyzeNews`, and manages loading
 * and failure. `/search` cannot use it, because `SearchPageClient` has
 * already performed exactly that request — mounting it would issue the
 * analysis a second time.
 *
 * So the switch moves here, where it is presentational: given a response
 * somebody else fetched, it decides which of the three destinations is
 * on screen. `AnalysisFrameClient` keeps its own copy rather than being
 * rewritten to use this one; R4 §8 authorises the mount, not a refactor
 * of the retained /analysis library, and that file has passing tests
 * asserting its current structure.
 *
 * Destinations, not routes (§6): the record and the library REPLACE the
 * frame in place and return to it. Neither is a navigation, so neither
 * can lose the reader's question, and the browser Back button is not
 * consumed by opening a source list.
 */
export type FrameDestination = 'frame' | 'record' | 'library';

export interface AnalysisFrameSurfaceProps {
  response: AnalysisApiResponse;
  language?: LanguageCode;
  initialDimension?: PrimaryDimensionKey;
  /** Test seam only — the destination the surface OPENS on. */
  initialDestination?: FrameDestination;
  /** Test seam only, forwarded to the frame. */
  initialViewport?: { width: number; height: number };
  /** Test seam only — the dock state the frame OPENS in (§5 state 12). */
  initialDock?: 'compact' | 'expanded';
  /** R1 ruling 7 — forwarded to the frame's page-level Back control. */
  onBack?: () => void;
}

export function AnalysisFrameSurface({
  response,
  language = 'en',
  initialDimension = 'brief',
  initialDestination = 'frame',
  initialViewport,
  initialDock,
  onBack,
}: AnalysisFrameSurfaceProps): JSX.Element {
  const [destination, setDestination] = useState<FrameDestination>(initialDestination);

  if (destination === 'record') {
    return (
      <CompleteRecordView
        response={response}
        language={language}
        onBack={() => setDestination('frame')}
      />
    );
  }

  if (destination === 'library') {
    return (
      <EvidenceLibrary
        articles={response.articles}
        language={language}
        onBack={() => setDestination('frame')}
      />
    );
  }

  return (
    <AnalysisFrame
      response={response}
      language={language}
      initialDimension={initialDimension}
      initialViewport={initialViewport}
      initialDock={initialDock}
      onOpenRecord={() => setDestination('record')}
      onBack={onBack}
    />
  );
}
