import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignalsService } from './signals.service';
import { GdeltProvider } from './providers/gdelt.provider';
import { EventRegistryProvider, isEventRegistryEnabled, isUsableEventRegistryApiKey } from './providers/event-registry.provider';
import { ALL_SIGNAL_PROVIDERS, SIGNAL_PROVIDERS, isGdeltEnabled } from './providers/provider.tokens';
import type { SignalProvider } from './interfaces';

/**
 * M64.3 — Signals Runtime Orchestration Foundation.
 *
 * Provider selection, mirroring NewsModule's exact pattern
 * (backend/src/modules/news/news.module.ts):
 *
 * SIGNAL_PROVIDERS = providers currently ENABLED to participate in
 * retrieval. With GDELT_ENABLED=false (or unset/blank/anything other
 * than exactly "true" — see isGdeltEnabled's own doc comment),
 * SIGNAL_PROVIDERS is an empty array. GDELT never silently
 * participates in retrieval when disabled.
 *
 * ALL_SIGNAL_PROVIDERS = every REGISTERED provider, enabled or not —
 * with GDELT_ENABLED=false this is still [gdeltProvider], so its
 * health/operational status stays visible regardless of whether it's
 * currently contributing to retrieval. Exactly mirrors how
 * ALL_NEWS_PROVIDERS keeps MockNewsProvider AND GNewsProvider visible
 * regardless of which one NEWS_PROVIDERS actually selects.
 *
 * NO NETWORK CALL AT MODULE CONSTRUCTION: both factories below are
 * synchronous — they read GDELT_ENABLED from ConfigService and either
 * include or omit the already-constructed GdeltProvider instance.
 * GdeltProvider itself performs no I/O in its constructor (confirmed:
 * it only stores a ConfigService reference — see gdelt.provider.ts)
 * — constructing this module, or the whole application, makes zero
 * GDELT HTTP requests under any configuration.
 *
 * DI REPAIR — ConfigModule is now explicitly imported below. The
 * original version relied on AppModule's ConfigModule.forRoot({
 * isGlobal: true, ... }) to make ConfigService ambiently available
 * everywhere, without SignalsModule declaring that dependency itself.
 * That worked in the real running application (isGlobal:true really
 * does make ConfigService available app-wide), but it meant
 * SignalsModule was not actually self-contained — its own real
 * dependency on ConfigService was left implicit, satisfied only by a
 * side effect of how some OTHER module (AppModule) happens to be
 * configured. The real engineering-gate failure surfaced exactly
 * this: a standalone Nest testing module that imports SignalsModule
 * without also setting isGlobal:true could not resolve
 * GdeltProvider's ConfigService dependency, because nothing in
 * SignalsModule's own module graph declared it.
 *
 * The fix is the standard, documented @nestjs/config pattern for a
 * feature module that needs ConfigService: `imports: [ConfigModule]`
 * (bare — NOT calling .forRoot() again here). This does not duplicate
 * ConfigService or re-parse the environment a second time — .forRoot()
 * is still called exactly once, at the application root (AppModule).
 * The bare import here only declares, within SignalsModule's own
 * module definition, that it depends on whatever ConfigService
 * registration already exists in the graph — making SignalsModule
 * genuinely independently compilable, not reliant on a sibling
 * module's isGlobal setting to happen to be correct.
 *
 * NO STARTUP VALIDATOR: unlike NewsStartupValidator (which fails
 * production boot closed if GNEWS_API_KEY is unusable), GDELT has no
 * equivalent here and none is added — GDELT is optional, never
 * required for backend startup, at any GDELT_ENABLED value.
 *
 * M64.4 — EventRegistryProvider registered alongside GdeltProvider,
 * following the exact same pattern: SIGNAL_PROVIDERS includes it only
 * when BOTH EVENT_REGISTRY_ENABLED is exactly "true" AND a genuinely
 * usable (non-blank) EVENT_REGISTRY_API_KEY is configured — unlike
 * GDELT, Event Registry requires a real API key, so activation is a
 * two-part gate, not a single flag. ALL_SIGNAL_PROVIDERS always
 * includes it, keeping its health/operational status visible
 * regardless of activation state. No network call occurs at module
 * construction for Event Registry either — EventRegistryProvider's
 * constructor only stores a ConfigService reference, identical to
 * GdeltProvider's own established pattern. No startup validator is
 * added for Event Registry either — it remains fully optional.
 *
 * NO CONTROLLER: this module exports only SignalsService. No public
 * route exists yet in M64.3/M64.4.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    SignalsService,
    GdeltProvider,
    EventRegistryProvider,
    {
      provide: SIGNAL_PROVIDERS,
      useFactory: (
        config: ConfigService,
        gdeltProvider: GdeltProvider,
        eventRegistryProvider: EventRegistryProvider,
      ): SignalProvider[] => {
        const providers: SignalProvider[] = [];

        const gdeltEnabled = isGdeltEnabled(config.get<string>('GDELT_ENABLED'));
        if (gdeltEnabled) providers.push(gdeltProvider);

        const eventRegistryEnabled =
          isEventRegistryEnabled(config.get<string>('EVENT_REGISTRY_ENABLED')) &&
          isUsableEventRegistryApiKey(config.get<string>('EVENT_REGISTRY_API_KEY'));
        if (eventRegistryEnabled) providers.push(eventRegistryProvider);

        return providers;
      },
      inject: [ConfigService, GdeltProvider, EventRegistryProvider],
    },
    {
      provide: ALL_SIGNAL_PROVIDERS,
      useFactory: (gdeltProvider: GdeltProvider, eventRegistryProvider: EventRegistryProvider): SignalProvider[] => [
        gdeltProvider,
        eventRegistryProvider,
      ],
      inject: [GdeltProvider, EventRegistryProvider],
    },
  ],
  exports: [SignalsService],
})
export class SignalsModule {}
