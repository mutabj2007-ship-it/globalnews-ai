import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CANONICAL_COVERAGE_STATES,
  accountSourceCoverage,
  loadSourcePacks,
} from '@globalnews-ai/shared';
import {
  NO_ACTIVATION,
  internationalSourceStates,
  registryLocalCandidates,
  sourceActivationFromConfig,
} from './source-coverage.authority';
import type { CountrySourcePack, GovernedSourceRegion } from '@globalnews-ai/shared';

export const GLOBAL_REACH_AUTHORITY = Symbol('GLOBAL_REACH_AUTHORITY');
export interface GlobalReachAuthority {
  readonly regions: readonly GovernedSourceRegion[];
  readonly packs: readonly CountrySourcePack[];
}
@Injectable()
export class GlobalReachService {
  private readonly authority: GlobalReachAuthority;
  constructor(
    @Inject(GLOBAL_REACH_AUTHORITY) authority: GlobalReachAuthority,
    @Optional() private readonly config?: ConfigService,
  ) {
    const regions = authority.regions.map((r) =>
      Object.freeze({ ...r, members: Object.freeze([...r.members]) }),
    );
    this.authority = Object.freeze({
      regions: Object.freeze(regions),
      packs: loadSourcePacks(authority.packs, regions),
    });
  }
  source(sourceId: string): SourcePackEntryOrUndefined {
    return this.authority.packs.flatMap((p) => p.entries).find((e) => e.sourceId === sourceId);
  }
  /**
   * T1 — every row carries the legacy BASELINE `state` and the canonical
   * `coverageState` (+ per-domain `coverageDomains`), folding in the feed and
   * official-source registries and the process's activation facts. Reads
   * configuration only; no provider or acquisition call.
   */
  coverage() {
    const activation = this.config
      ? sourceActivationFromConfig((key) => this.config?.get<string>(key))
      : NO_ACTIVATION;
    return accountSourceCoverage(this.authority.regions, this.authority.packs, {
      extraLocalSources: registryLocalCandidates(activation),
      internationalSources: internationalSourceStates(activation),
    });
  }
  summary() {
    const rows = this.coverage();
    return {
      completenessMeaning:
        'Every governed member is accounted for by a measured local baseline or an explicit gap; this is not 100% event detection.',
      governedCountryCount: new Set(rows.map((r) => r.iso3)).size,
      governedMembershipCount: rows.length,
      states: Object.fromEntries(
        ['VALIDATED_LOCAL_BASELINE', 'PARTIAL', 'COVERAGE_GAP', 'UNVERIFIED'].map((s) => [
          s,
          rows.filter((r) => r.state === s).length,
        ]),
      ),
      /* T1 — the canonical reader-facing state: active + rights-cleared local sources. */
      coverageStates: Object.fromEntries(
        CANONICAL_COVERAGE_STATES.map((s) => [s, rows.filter((r) => r.coverageState === s).length]),
      ),
      regions: this.authority.regions,
    };
  }
}
type SourcePackEntryOrUndefined = CountrySourcePack['entries'][number] | undefined;
