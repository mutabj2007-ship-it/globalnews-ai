import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { classifyCpiRead, probeEconomyRead, EXIT } from './probe-economy-read.mjs';
const actual = { retainedState: 'DISPLAYABLE', publishable: true, slot: { kind: 'OBSERVATION', observation: { value: 15.9, unit: 'PERCENT', periodId: '2026-08' } }, provenance: {
  institution: 'Test institution', jurisdiction: 'RW', licence: 'Test licence', retrievedAt: '2026-09-20',
  parserId: 'test', parserVersion: '1', extractorId: 'test', extractorVersion: '1', sourceLanguage: 'en',
  basePeriod: 'Test base', publicationDateStated: '2026-09-10', referencePeriod: '2026-08', contentAddress: 'a'.repeat(64) } };
test('four distinct runtime outcomes from a single internal GET', async () => {
  const requests = []; let body, status = 200;
  const server = createServer((req,res)=>{requests.push([req.method,req.url]);res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(body));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [payload, expected] of [
      [{ retainedState:'NO_CAPTURE', publishable:false, slot:{kind:'GAP'} }, 'NO_RETAINED_CPI'],
      [{ retainedState:'NOT_DISPLAYABLE', publishable:false, slot:{kind:'GAP'} }, 'RETAINED_NOT_DISPLAYABLE'],
      [actual, 'DISPLAYABLE_CPI'],
    ]) { body=payload; assert.equal((await probeEconomyRead(origin)).state,expected); }
    status=503; assert.equal((await probeEconomyRead(origin)).state,'BACKEND_UNAVAILABLE');
    assert.deepEqual(requests,Array(4).fill(['GET','/economy/observations/rw-nisr-cpi']));
  } finally { await new Promise(resolve=>server.close(resolve)); }
  assert.equal((await probeEconomyRead(origin)).state,'BACKEND_UNAVAILABLE');
  assert.equal(new Set(Object.values(EXIT)).size,5);
});
test('legacy, malformed or incomplete evidence is not reported as live CPI or no capture',()=>{
  for(const body of [{}, {...actual,retainedState:undefined}, {...actual,provenance:{}}, {...actual,publishable:false}, {...actual,provenance:{...actual.provenance,referencePeriod:'2026-07'}}]) assert.equal(classifyCpiRead(body).state,'INDETERMINATE_RESPONSE');
});
test('does not follow redirects or use citation URLs',async()=>{
  let count=0;
  const result=await probeEconomyRead('https://alpha.example',async(url,options)=>{
    count++; assert.equal(url,'https://alpha.example/economy/observations/rw-nisr-cpi');
    assert.equal(options.redirect,'error'); throw new Error('redirect denied');
  });
  assert.equal(count,1); assert.equal(result.state,'BACKEND_UNAVAILABLE');
});
