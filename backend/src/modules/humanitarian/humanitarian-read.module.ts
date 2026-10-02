import { Controller, Get, Header, Module } from '@nestjs/common';
import type { HumanitarianRetainedRead } from '@globalnews-ai/shared';
import {
  HumanitarianRetainedCorpus,
  HumanitarianRetainedCorpusModule,
} from './humanitarian-retained-corpus';
import {
  GDACS_ATTRIBUTION_VERBATIM,
  HUMANITARIAN_REQUIRED_DISCLOSURES,
  READER_CLEARED_SOURCE_IDS,
  RELAY_ATTRIBUTED_SOURCE_IDS,
} from './reader-clearance.ruling';

/** E1's reader-display constants, published by reference for the reader display gate (G R2). */
export interface HumanitarianReaderRuling {
  readonly requiredDisclosures: readonly string[];
  readonly readerClearedSourceIds: readonly string[];
  readonly relayAttributionVerbatim: string;
  readonly relayAttributedSourceIds: readonly string[];
}

/**
 * Public capability read, separate from authority boot. No producer, transport, scheduler, query
 * filters or acquisition dependency. It reads the ONE in-memory retained corpus through E1's
 * reader scope; while E1 clears no source for readers this is NOT_ASSESSED, never a zero-incident
 * finding. Provisioning the authority module alone does not change that fact.
 *
 * `reader-ruling` publishes E1's constants (required disclosures, reader-cleared sources, the
 * verbatim relay acknowledgement) so a frontend display hop can bind them without re-declaring
 * them — a frontend copy would be a second authority (G R2 handoff).
 */
@Controller('humanitarian')
export class HumanitarianReadController {
  constructor(private readonly corpus: HumanitarianRetainedCorpus) {}

  @Get('observations')
  @Header('Cache-Control', 'no-store')
  read(): HumanitarianRetainedRead {
    return this.corpus.readerRead();
  }

  @Get('reader-ruling')
  @Header('Cache-Control', 'no-store')
  readerRuling(): HumanitarianReaderRuling {
    return {
      requiredDisclosures: HUMANITARIAN_REQUIRED_DISCLOSURES,
      readerClearedSourceIds: READER_CLEARED_SOURCE_IDS,
      relayAttributionVerbatim: GDACS_ATTRIBUTION_VERBATIM,
      relayAttributedSourceIds: RELAY_ATTRIBUTED_SOURCE_IDS,
    };
  }
}

@Module({ imports: [HumanitarianRetainedCorpusModule], controllers: [HumanitarianReadController] })
export class HumanitarianReadModule {}
