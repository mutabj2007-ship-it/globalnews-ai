import { Inject, Injectable } from '@nestjs/common';
import { accountSourceCoverage, loadSourcePacks } from '@globalnews-ai/shared';
import type { CountrySourcePack, GovernedSourceRegion } from '@globalnews-ai/shared';

export const GLOBAL_REACH_AUTHORITY = Symbol('GLOBAL_REACH_AUTHORITY');
export interface GlobalReachAuthority {
  readonly regions: readonly GovernedSourceRegion[];
  readonly packs: readonly CountrySourcePack[];
}
@Injectable()
export class GlobalReachService {
  private readonly authority: GlobalReachAuthority;
  constructor(@Inject(GLOBAL_REACH_AUTHORITY) authority: GlobalReachAuthority) {
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
  coverage() {
    return accountSourceCoverage(this.authority.regions, this.authority.packs);
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
      regions: this.authority.regions,
    };
  }
}
type SourcePackEntryOrUndefined = CountrySourcePack['entries'][number] | undefined;
