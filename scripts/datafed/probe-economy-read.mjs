// Read-only deployment readiness probe. One internal GET; no source-document request.
import { pathToFileURL } from 'node:url';
export const EXIT = Object.freeze({ DISPLAYABLE_CPI: 0, BACKEND_UNAVAILABLE: 10, NO_RETAINED_CPI: 11, RETAINED_NOT_DISPLAYABLE: 12, INDETERMINATE_RESPONSE: 13 });
export function classifyCpiRead(body) {
  const gap = body?.publishable === false && body?.slot?.kind === 'GAP';
  if (gap && body.retainedState === 'NO_CAPTURE') return { state: 'NO_RETAINED_CPI' };
  if (body?.retainedState === 'NOT_DISPLAYABLE' && body.publishable === false) return { state: 'RETAINED_NOT_DISPLAYABLE' };
  const o = body?.slot?.observation, p = body?.provenance;
  const fields = ['institution', 'jurisdiction', 'licence', 'retrievedAt', 'parserId', 'parserVersion', 'extractorId', 'extractorVersion', 'sourceLanguage', 'basePeriod', 'publicationDateStated'];
  if (body?.retainedState === 'DISPLAYABLE' && body.publishable === true && body.slot?.kind === 'OBSERVATION'
      && Number.isFinite(o?.value) && o?.unit === 'PERCENT' && /^\d{4}-(0[1-9]|1[0-2])$/.test(o?.periodId)
      && p?.referencePeriod === o.periodId && /^[a-f0-9]{64}$/.test(p?.contentAddress)
      && fields.every(key => typeof p[key] === 'string' && p[key].trim().length > 0)) {
    return { state: 'DISPLAYABLE_CPI', observation: { value: o.value, unit: o.unit, period: o.periodId,
      institution: p.institution, publicationDate: p.publicationDateStated, sourceLanguage: p.sourceLanguage,
      contentAddress: p.contentAddress }, trend: 'NOT_ESTABLISHED' };
  }
  // Old deployments and malformed responses must not masquerade as empty retention.
  return { state: 'INDETERMINATE_RESPONSE', detail: 'Expected the converged retained-state contract and complete CPI provenance.' };
}
export async function probeEconomyRead(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Provide only the Alpha application or backend HTTP(S) origin, without credentials or a path.');
  }
  const endpoint = new URL('/economy/observations/rw-nisr-cpi', base).href;
  try {
    const response = await fetcher(endpoint, { method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { state: 'BACKEND_UNAVAILABLE', endpoint, httpStatus: response.status };
    let body;
    try { body = await response.json(); } catch { return { state: 'INDETERMINATE_RESPONSE', endpoint, detail: 'Response is not JSON.' }; }
    return { ...classifyCpiRead(body), endpoint };
  } catch { return { state: 'BACKEND_UNAVAILABLE', endpoint, detail: 'Internal read failed, timed out or attempted a redirect.' }; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] === '--base-url' ? process.argv[3] : process.env.ALPHA_BASE_URL;
  if (!base) { console.error('Usage: node scripts/datafed/probe-economy-read.mjs --base-url https://<alpha-origin>'); process.exitCode = 64; }
  else { try { const result = await probeEconomyRead(base); console.log(JSON.stringify(result, null, 2)); process.exitCode = EXIT[result.state]; }
    catch (error) { console.error(error.message); process.exitCode = 64; } }
}
