import { isEnergyObservation, type EnergyReadResult } from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from '@/lib/api/apiBase';
/** Server-only internal read. A backend outage is never reported as zero holdings. */
export async function readEnergyObservations(): Promise<EnergyReadResult> {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/energy/observations`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Energy read unavailable');
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isEnergyObservation))
      throw new Error('Invalid Energy read');
    return payload.length
      ? { kind: 'OBSERVATIONS', observations: payload }
      : { kind: 'EMPTY', observations: [] };
  } catch {
    return { kind: 'UNAVAILABLE', observations: [] };
  }
}
