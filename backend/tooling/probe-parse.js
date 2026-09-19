const fs=require('fs');
const { parseStrictJson } = require('@globalnews-ai/shared');
const S=process.argv[2];
for (const n of ['namq_10_gdp','prc_hicp_minr','gov_10q_ggdebt']) {
  const bytes=new Uint8Array(fs.readFileSync(S+'/econ1/bodies/'+n+'.json'));
  const doc = parseStrictJson(bytes);
  const root = (doc && doc.value && doc.value.value !== undefined) ? doc.value : doc;
  const v = root.value;
  const k = Object.keys(v);
  const raw = v[k[k.length-1]];
  console.log(n.padEnd(16),
    'literal-in-bytes=', (fs.readFileSync(S+'/econ1/bodies/'+n+'.json','utf8').match(/"value":\{"0":([^}]*)\}/)||[])[1],
    '| parsed=', JSON.stringify(raw),
    '| typeof=', typeof raw,
    '| producer accepts?', typeof raw==='number' && Number.isFinite(raw));
}
