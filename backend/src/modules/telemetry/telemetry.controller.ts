import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TelemetryService } from './telemetry.service';
import { RecordEventDto } from './dto/record-event.dto';

/**
 * R3/T7 — the public telemetry ingest endpoint.
 *
 * ANONYMOUS BY CONSTRUCTION, NOT BY CONFIGURATION. This controller has no
 * guard, reads no cookie and never consults a session — so there is no
 * code path here that could attach an account to an event, whatever the
 * caller sends. The three account-scoped events are emitted SERVER-SIDE
 * from the code that changes the state (a follow, a return visit), never
 * reported by a client, so a public ingest route has no legitimate need
 * for identity and does not get one.
 *
 * THE RATE LIMIT IS 20/60s, MATCHING THE PLATFORM'S PUBLIC-READ DEFAULT.
 * It was 60/60s, which made a public unauthenticated WRITE three times
 * more permissive than the default for public READS — an inversion with
 * nothing to justify it (E1 security review, Finding 3). Route budgets do
 * not share a ceiling in this throttler: the key is per
 * controller+handler+tracker, so this endpoint's budget is additional to
 * every other route's rather than carved out of a total.
 *
 * THE PER-IP LIMIT IS NOT THE PRINCIPAL CONTROL, AND SAYING SO MATTERS.
 * An attacker chooses how many source addresses to use, so no per-caller
 * number bounds the total. The bound that an attacker cannot defeat by
 * adding addresses is the GLOBAL ingest ceiling in TelemetryService, and
 * that is what actually protects the database. This number corrects a
 * direction; it does not carry the security.
 *
 * KNOWN LIMITATION, RECORDED RATHER THAN GLOSSED. The throttler keys on
 * client IP, and B1's proxy-aware resolution fails closed: with
 * TRUST_PROXY unset, every caller behind a reverse proxy presents the
 * proxy's address and shares one bucket. In that topology this limit
 * causes silent UNDERCOUNTING rather than lost function — a 429 here
 * costs a measurement, never a capability — and an invisible undercount
 * is a real cost to a metrics system. The deployment precondition is
 * recorded in the repair report: production must set TRUST_PROXY to the
 * real hop count or allowlist, AND the edge proxy must OVERWRITE
 * X-Forwarded-For rather than append to a client-supplied value. If it
 * appends, one attacker can present unlimited distinct addresses and the
 * per-IP limit becomes decorative.
 *
 * THE WRITE IS NOT AWAITED. The response returns as soon as the payload
 * has been validated and the event handed to the service. This is the
 * pattern TelemetryInterceptor already uses two files away, and the
 * public path was the inconsistent one — the one exposed to the internet.
 * It matters because this backend shares a TEN-connection PostgreSQL pool
 * with the entire product: an awaited public INSERT holds one of those ten
 * for the duration of every accepted request, so telemetry LOAD could
 * starve the pool serving news, search and OAuth. Telemetry FAILURE was
 * already handled; telemetry LOAD was not (E1 Finding 1).
 *
 * 202, not 200: the write is best-effort and its outcome is deliberately
 * not reported. A client must not be able to learn anything about the
 * telemetry store, and must never be blocked by it. Not awaiting the
 * write is consistent with that contract rather than a departure from it.
 */
@Controller('events')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post()
  @HttpCode(202)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  record(@Body() body: RecordEventDto): void {
    // FIRE-AND-FORGET, DELIBERATELY. Not awaited, and the handler is
    // synchronous so there is no promise for Nest to wait on either. The
    // explicit .catch() is what keeps a rejected write from becoming an
    // unhandled rejection; it can never reach the response, which has
    // already been sent.
    void this.telemetry
      .recordPublicEvent(body.name, {
        countryCode: body.countryCode,
        language: body.language,
        subjectId: body.subjectId,
      })
      .catch(() => {
        // TelemetryService already logs. Nothing to add, and nothing may
        // propagate: the client is told 202 regardless, by design.
      });
  }
}
