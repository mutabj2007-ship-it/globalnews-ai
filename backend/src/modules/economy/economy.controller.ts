import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { EconomyObservationReadService, type EconomyObservationView } from './economy-observation.read';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE SMALLEST READ THE ECONOMY SURFACE NEEDS — AND NOTHING MORE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ONE ROUTE. It reads a retained artifact and returns a figure or a stated gap.
 *
 * ── WHAT IT CANNOT DO ─────────────────────────────────────────────────────
 *
 * IT ISSUES NO PROVIDER REQUEST, and that is structural rather than promised: there is
 * no transport, no driver and no URL anywhere below it. `rw-nisr` remains dormant, and
 * calling this route a thousand times contacts nobody and consumes no GNews quota.
 *
 * ── WHAT IT DELIBERATELY DOES NOT RETURN ──────────────────────────────────
 *
 * The rights grade, the rights instrument reference, the retention class and the
 * admission refusal vocabulary are governed as internal state —
 * `SNAPSHOT_EXPOSURE = 'INTERNAL_ONLY'` — and a reader has no question they answer.
 * What a reader needs to judge a figure is who published it, when, from what artifact,
 * under what licence, and for which period; that is what the view carries.
 *
 * ── AND IT IS NOT A RWANDA-ONLY DATA MODEL ────────────────────────────────
 *
 * The response is an `EconomyFigureSlot` — the accepted Economy shape, the same one every
 * other Economy figure will use. The route is named for the series it can currently
 * serve, not for a bespoke schema: the day a second series is retained, it is another
 * reader over the same slot type, not another shape.
 */
@Controller('economy')
export class EconomyController {
  constructor(private readonly reads: EconomyObservationReadService) {}

  /**
   * The retained Rwanda headline CPI observation, or a GAP with a reason.
   *
   * Throttled at the global default. It touches the database, so it is not exempt: a
   * public endpoint that reads Postgres with no limit is a pool-exhaustion lever, which
   * is the lesson `/health/ready` already records.
   */
  @Get('observations/rw-nisr-cpi')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async nisrHeadlineCpi(): Promise<EconomyObservationView> {
    return this.reads.readNisrHeadlineCpi();
  }
}
