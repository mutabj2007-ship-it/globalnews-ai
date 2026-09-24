import type { ConflictRetainedEvidenceDetail } from '@globalnews-ai/shared';

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isConflictRetainedEvidenceDetail(
  value: unknown,
): value is ConflictRetainedEvidenceDetail {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const d = value as Record<string, unknown>;
  return (
    text(d.observationKey) &&
    d.authority === 'UCDP_GED' &&
    text(d.upstreamEventId) &&
    Array.isArray(d.sourceParties) &&
    d.sourceParties.every(text) &&
    text(d.snapshotRetrievalId) &&
    typeof d.snapshotContentAddress === 'string' &&
    /^[0-9a-f]{64}$/.test(d.snapshotContentAddress)
  );
}

export async function readConflictEvidenceDetail(
  observationKey: string,
  signal?: AbortSignal,
): Promise<ConflictRetainedEvidenceDetail | null> {
  if (!observationKey) return null;

  try {
    const response = await fetch(
      `/conflict-data/observations/${encodeURIComponent(observationKey)}/evidence`,
      {
        cache: 'no-store',
        signal,
        headers: { accept: 'application/json' },
      },
    );
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    return isConflictRetainedEvidenceDetail(payload) ? payload : null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    return null;
  }
}
