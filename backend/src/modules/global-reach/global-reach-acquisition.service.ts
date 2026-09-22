import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { evaluateSourceRights, measuredLocalSource } from '@globalnews-ai/shared';
import type {
  OfficialSourceRightsBinding,
  SourcePackEntry,
  SourceRightsRecord,
} from '@globalnews-ai/shared';
import { GlobalReachService } from './global-reach.service';

/** Implementations must use the existing governed feed/provider adapters and retained store. */
export interface GlobalReachAcquisitionPort<T> {
  readRetained(source: SourcePackEntry): Promise<readonly T[]>;
  resolveRights(binding: OfficialSourceRightsBinding): SourceRightsRecord | null;
  acquireAndRetain(source: SourcePackEntry): Promise<readonly T[]>;
}
@Injectable()
export class GlobalReachAcquisitionService {
  constructor(
    private readonly config: ConfigService,
    private readonly reach: GlobalReachService,
  ) {}

  /** Explicit worker seam only. No controller, timer or product read invokes this method. */
  async acquireForWorker<T>(
    sourceId: string,
    trigger: 'SCHEDULED_WORKER' | 'EXPLICIT_OPERATOR',
    port: GlobalReachAcquisitionPort<T>,
  ) {
    const source = this.reach.source(sourceId);
    if (!source) return { records: [] as readonly T[], origin: 'GAP', reason: 'UNKNOWN_SOURCE' };
    const retained = await port.readRetained(source);
    if (retained.length > 0) return { records: retained, origin: 'RETAINED', reason: null };
    const refuse = (reason: string) => ({ records: [] as readonly T[], origin: 'GAP', reason });
    if (!['SCHEDULED_WORKER', 'EXPLICIT_OPERATOR'].includes(trigger))
      return refuse('INVALID_TRIGGER');
    if (this.config.get<string>('GLOBAL_REACH_ACQUISITION_ACTIVE') !== 'true')
      return refuse('ACQUISITION_DISABLED');
    const allowlist = (this.config.get<string>('GLOBAL_REACH_SOURCE_ALLOWLIST') ?? '')
      .split(',')
      .map((s) => s.trim());
    if (!allowlist.includes(sourceId)) return refuse('SOURCE_NOT_ALLOWLISTED');
    if (!measuredLocalSource(source) || source.activationStatus !== 'ACTIVE')
      return refuse('SOURCE_NOT_READY');
    if (!['RSS', 'ATOM', 'API'].includes(source.transport)) return refuse('NO_NETWORK_TRANSPORT');
    const verdict = evaluateSourceRights({
      sourceId,
      registered: true,
      binding: source.rights.binding,
      resolvedRecord: source.rights.binding ? port.resolveRights(source.rights.binding) : null,
      enabled: true,
      ingestionMethod: source.transport === 'API' ? 'api' : 'rss',
    });
    if (!verdict.activatedWithRights) return refuse('RIGHTS_NOT_PERMITTED');
    return { records: await port.acquireAndRetain(source), origin: 'ACQUIRED', reason: null };
  }
}
