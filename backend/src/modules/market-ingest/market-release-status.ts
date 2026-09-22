/**
 * Explicit publisher flags only; absence/normal/forecast is not evidence of FINAL.
 * Eurostat published flag definitions: p = provisional, r = revised, f = forecast.
 * https://ec.europa.eu/eurostat/documents/3930297/5962390/KS-DZ-08-001-EN.PDF.pdf/c9248f4b-57f8-4314-baad-021d0d87fbf4
 * No governed FINAL mapping is established for either current Market adapter.
 * A future FINAL mapping must cite explicit publisher evidence and add a positive test.
 */
export class UnprovenMarketReleaseStatus extends Error {}

export function eurostatReleaseStatus(status: unknown, cell: number): 'PRELIMINARY' | 'REVISED' {
  if (
    status !== null &&
    typeof status === 'object' &&
    !Array.isArray(status) &&
    Object.prototype.hasOwnProperty.call(status, String(cell))
  ) {
    const flag = (status as Record<string, unknown>)[String(cell)];
    if (flag === 'p') return 'PRELIMINARY';
    if (flag === 'r') return 'REVISED';
  }
  throw new UnprovenMarketReleaseStatus(
    `EUROSTAT: cell ${cell} has no supported explicit release status`,
  );
}

export function tedReleaseStatus(withdrawn: unknown): 'WITHDRAWN' {
  if (withdrawn === true) return 'WITHDRAWN';
  throw new UnprovenMarketReleaseStatus('TED: absence of withdrawal does not establish FINAL');
}
