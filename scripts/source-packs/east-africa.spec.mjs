import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BASELINE, CATEGORIES, build, read, technical } from './build-east-africa.mjs';
import { classify, robotsBlocks, links, ROOT, LIMITS } from './audit-east-africa.mjs';
const packs = build(); const capture = read('captures.json');
test('exact governed countries and generated manifests match evidence', () => {
  assert.deepEqual(BASELINE, ['BDI','COD','DJI','ERI','ETH','KEN','RWA','SOM','SSD','TZA','UGA']);
  assert.deepEqual(read('index.json').baseline, BASELINE);
  for(const p of packs) assert.deepEqual(read(p.country+'.json'),p);
  assert.deepEqual([...new Set(capture.sources.map(s=>s.country))].sort(),[...BASELINE].sort());
});
test('all candidates retained, unique, dormant, and independently auditable', () => {
  const rows=fs.readFileSync(ROOT+'candidates.txt','utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  assert.equal(rows.length,capture.sources.length);
  assert.equal(new Set(capture.sources.map(s=>s.id)).size,rows.length);
  for(const p of packs){
    assert.equal(p.enabled,false); assert.equal(p.alphaEnabled,false); assert.equal(p.productionHold,true);
    assert.equal(p.coverageStatus,'COVERAGE_GAP'); assert.equal(p.qualifiedIndependentLocalPublishers,0);
    assert.deepEqual(p.categoryAudit.map(c=>c.category),CATEGORIES);
    assert.ok(p.findings.length>80);
    for(const s of p.sources){
      assert.equal(s.enabled,false); assert.equal(s.alphaEnabled,false); assert.equal(s.admission,'HOLD');
      assert.equal(s.rights.reuseApproved,false); assert.ok(s.blockers.includes('RIGHTS_NOT_CLEARED'));
      assert.ok(capture.sources.some(c=>c.id===s.evidence.sourceId));
      assert.ok(!/reuters|associated press|apnews/i.test(s.name+' '+s.homepage));
      if(s.duplicateOf) assert.ok(capture.sources.some(c=>c.id===s.duplicateOf));
    }
  }
});
test('Kenya and Rwanda deepest by distinct candidate publishers, not replacement hosts',()=>{
  const counts=Object.fromEntries(packs.map(p=>[p.country,p.sources.filter(s=>!s.duplicateOf).length]));
  const others=Object.entries(counts).filter(([c])=>!['KEN','RWA'].includes(c)).map(([,n])=>n);
  assert.ok(counts.KEN>Math.max(...others)); assert.ok(counts.RWA>Math.max(...others));
});
test('bounded capture evidence and metadata only',()=>{
  for(const s of capture.sources){
    assert.ok(s.requests<=LIMITS.maxLogicalRequestsPerCandidate, s.id);
    assert.equal(s.requests,s.checks.filter(c=>c.purpose!=='SKIPPED').length);
    for(const c of s.checks){
      assert.ok(Number.isFinite(Date.parse(c.checkedAt)));
      assert.ok(c.requestedUrl.startsWith('https://'));
      if(c.bytesRead!==undefined){ assert.ok(c.bytesRead<=LIMITS.maxBytes); assert.match(c.sha256,/^[a-f0-9]{64}$/); }
      assert.ok((c.redirects?.length||0)<=LIMITS.maxRedirects+1);
      assert.equal(c.body,undefined);
    }
  }
});
test('HTML, blocks and truncation cannot be promoted into feeds',()=>{
  assert.equal(classify(200,'<html><script>"<rss>"</script></html>'),'HTML_PAGE');
  assert.equal(classify(200,'<title>Just a moment</title>'),'BOT_CHALLENGE');
  assert.equal(classify(403,'<rss/>'),'ACCESS_BLOCKED');
  assert.equal(classify(404,'<rss/>'),'DEAD_ENDPOINT');
  assert.equal(classify(200,'<rss/>',true),'TRUNCATED');
  assert.equal(classify(200,'<?xml version="1.0"?><rss/>'),'FEED_CANDIDATE');
  assert.ok(robotsBlocks('User-agent: *\nDisallow: /private','/private/feed'));
  assert.ok(!robotsBlocks('Disallow: /private','/feed'));
  assert.deepEqual(links('<link type="application/rss+xml" href="https://other.test/feed">','https://publisher.test/','feed'),[]);
});
test('latest failed recheck, invalid XML, empty feeds and future dates fail closed',()=>{
  const source={id:'test',feedUrl:'https://example.test/feed',checks:[{purpose:'XML_STRUCTURE_RECHECK',outcome:'FEED_CANDIDATE',checkedAt:'2026-09-22',xml:{parsed:true,itemCount:1,items:[{hasTitle:true,link:'https://example.test/a',date:'2026-09-21'}]}}]};
  assert.equal(technical(source),'VERIFIED_FEED_ENDPOINT');
  source.checks[0].xml.items[0].date='2030-01-01'; assert.equal(technical(source),'FUTURE_DATE_REVIEW');
  source.checks[0].xml.items[0].date='2020-01-01'; assert.equal(technical(source),'STALE_FEED');
  source.checks[0].xml.itemCount=0; assert.equal(technical(source),'EMPTY_FEED');
  source.checks[0].xml.parsed=false; assert.equal(technical(source),'INVALID_XML');
  source.checks[0].outcome='INACCESSIBLE'; assert.equal(technical(source),'RECHECK_FAILED');
});
test('real negative evidence remains visible',()=>{
  const all=packs.flatMap(p=>p.sources); const get=id=>all.find(s=>s.id===id);
  assert.equal(get('ea-r1:tza:citizen').technicalStatus,'DEAD_ENDPOINT');
  assert.equal(get('ea-r1:som:parliament').technicalStatus,'EMPTY_FEED');
  assert.equal(get('ea-r1:som:sodma').technicalStatus,'INVALID_XML');
  assert.equal(get('ea-r1:ken:standard').rights.status,'RESTRICTED');
  assert.equal(get('ea-r1:uga:opm').technicalStatus,'ACCESS_POLICY_REVIEW');
  assert.equal(packs.find(p=>p.country==='ERI').categoryAudit.find(c=>c.category==='STATISTICS').candidateIds.length,0);
});
test('XML inspector rejects malformed XML, HTML and external entities',()=>{
  const inspect=xml=>{
    const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./inspect-feed.ps1',import.meta.url))],{input:xml,encoding:'utf8',timeout:10000});
    assert.equal(r.status,0); return JSON.parse(r.stdout.replace(/^\uFEFF/,''));
  };
  assert.equal(inspect('<rss><channel/></rss>').parsed,true);
  assert.equal(inspect('<rss>').parsed,false);
  assert.equal(inspect('<html/>').parsed,false);
  assert.equal(inspect('<!DOCTYPE rss [<!ENTITY e SYSTEM "file:///C:/Windows/win.ini">]><rss>&e;</rss>').parsed,false);
});
