import { Global, Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { TelemetryInterceptor } from './telemetry.interceptor';

/**
 * R3/T7 — the telemetry foundation.
 *
 * Exports TelemetryService so the two lanes that own a real state change
 * — follows and users — can emit their own events server-side rather
 * than trusting a client to report that something happened.
 *
 * PrismaModule is @Global(), so PrismaService needs no import here.
 *
 * THIS MODULE IS @Global() TOO, AND THE REASON IS WORTH STATING. Telemetry
 * is a cross-cutting concern: any module that changes state a product
 * question is asked about may need to emit one event. Requiring each of
 * them to add an import line makes the telemetry dependency a recurring
 * edit to modules that have nothing else to do with it — and would have
 * pushed this milestone past its authorized file ceiling for a single
 * import statement. PrismaModule already establishes exactly this pattern
 * in this codebase for the same reason, so this introduces no new
 * convention. The trade-off is real and accepted: @Global buys a smaller
 * blast radius at the cost of a less explicit dependency graph.
 *
 * WHAT IS DELIBERATELY ABSENT: no analytics SDK, no beacon library, no
 * advertising or attribution dependency, and no HTTP client. This module
 * adds ZERO third-party dependencies to the project. Telemetry that
 * shipped a vendor script would be a different product decision wearing
 * this one's name.
 */
@Global()
@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryInterceptor],
  exports: [TelemetryService, TelemetryInterceptor],
})
export class TelemetryModule {}
