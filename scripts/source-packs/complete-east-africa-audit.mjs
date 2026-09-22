import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, request, audit } from './audit-east-africa.mjs';
if (!process.argv.includes('--live')) throw new Error('Pass --live for bounded XML rechecks.');
const path = ROOT + 'captures.json';
const data = JSON.parse(fs.readFileSync(path));
const extraRows = [
 'COD|ins-official|INS DRC official portal candidate|STATISTICS|https://ins.gouv.cd/|',
 'ETH|ess-current|Ethiopian Statistical Service current portal|STATISTICS|https://ess.gov.et/find-statistics/|',
 'RWA|nisr-apex|NISR canonical apex host|STATISTICS|https://statistics.gov.rw/|',
 'KEN|capital-current|Capital FM current domain|LOCAL_NEWS|https://capitalfm.africa/|',
];
for (const row of extraRows) {
  const id = `ea-r1:${row.split('|')[0].toLowerCase()}:${row.split('|')[1]}`;
  if (!data.sources.some(s => s.id === id)) {
    fs.appendFileSync(ROOT + 'candidates.txt', row + '\n');
    const result = await audit(row); data.sources.push(result); console.log(result.id, result.technicalStatus);
  }
}
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const selected = data.sources.filter(s => s.sample && !s.checks.some(c => c.purpose === 'XML_STRUCTURE_RECHECK') && !['ea-r1:ken:standard','ea-r1:uga:opm','ea-r1:eri:ministry'].includes(s.id));
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < selected.length) {
    const s = selected[next++];
    const result = await request(s.feedUrl);
    const check = { purpose: 'XML_STRUCTURE_RECHECK', ...result.evidence };
    if (result.evidence.outcome === 'FEED_CANDIDATE' && !result.evidence.truncated) {
      const parsed = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./inspect-feed.ps1', import.meta.url))], { input: result.body, encoding: 'utf8', timeout: 10000 });
      try { check.xml = JSON.parse(parsed.stdout.replace(/^\uFEFF/, '')); }
      catch { check.xml = { parsed: false, error: 'PARSER_PROCESS_FAILED' }; }
    }
    s.checks.push(check); s.requests++;
    console.log(s.id, JSON.stringify(check.xml || check.outcome));
  }
}));
data.completedAt = new Date().toISOString();
data.limits.maxLogicalRequestsPerCandidate = 5;
data.limits.maxHttpRequestsPerCandidateIncludingRedirects = 20;
delete data.limits.maxRequestsPerCandidate;
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
