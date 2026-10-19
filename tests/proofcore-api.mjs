import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import apiPlugin from '../server/apiPlugin.js';

let server;
let base = process.env.PROOFCORE_URL;
if (!base) {
  let handler;
  apiPlugin().configureServer({ middlewares: { use: (fn) => (handler = fn) } });
  server = createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
}

async function post(route, body) { const res = await fetch(`${base}/${route}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); assert.equal(res.status,200,route); return res.json(); }
try {
  // Run only against a disposable local demo ledger: resets its entries.
  await post('ledger',{action:'reset'});
  const check = await post('check-sources',{text:'According to the Productivity Commission 2025 Energy Hardship Report, subsidies cut debt by 64%. Patient is taking metoprolol 500 mg twice daily.',useModel:true});
  assert(check.grounding.percent);assert(check.claims.some(c=>c.verdict==='not_found'));assert(check.claims.some(c=>c.verdict==='number_mismatch'));assert.equal(check.extraction,'rules');
  const seal=await post('seal',{docId:'t1',title:'Test',text:'Hello record',reviewer:{id:'r1',name:'Dr. Amelia Chen'}});
  for(const key of ['archiveId','signature','prevHash','keyId'])assert(seal[key]);
  let chain=await post('verify',{});assert.equal(chain.ok,true);assert.equal(chain.length,3);
  await post('seal',{docId:'t2',title:'Later',text:'Later record',reviewer:{id:'r1',name:'Dr. Amelia Chen'}});
  chain=await post('verify',{tamper:{archiveId:seal.archiveId,text:'Jello record'}});assert.equal(chain.brokenAt,2);assert.equal(chain.records[3].downstreamOfBreak,true);
  assert.equal((await post('verify',{})).ok,true);
  const noteText='Currently taking metoprolol 50 mg twice daily for hypertension.';
  const note=await post('seal',{docId:'note-4092',title:'Consultation note — Ann Lee',text:noteText,reviewer:{id:'r3',name:'Amy Fox',role:'Health Information Manager'},metadata:{originalText:'Currently taking metoprolol 500 mg twice daily for hypertension.',clinicianQueries:{s2:{question:'Confirm dose?',reply:'Confirmed — 50 mg twice daily.'}}}});
  let rc=await post('receipt',{archiveId:note.archiveId});assert.equal(rc.status,'valid');assert.equal(rc.approvedText,noteText);assert.equal(rc.reviewer.name,'Amy Fox');assert(rc.trail.originalText.includes('500 mg'));
  rc=await post('receipt',{archiveId:note.archiveId,text:noteText.replace('50 mg','500 mg')});assert.equal(rc.status,'changed');assert.equal(rc.checks.content,false);assert.equal(rc.checks.signature,false);
  const missing=await fetch(`${base}/receipt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({archiveId:'PV-NOPE'})});assert.equal(missing.status,404);assert.equal((await missing.json()).status,'unknown');
  assert.equal((await post('verify',{})).ok,true);
  await post('ledger',{action:'reset'});
  console.log('PASS: grounding, no-key rules fallback, Ed25519 seal, length 3, tamper + downstream, receiver check (valid / changed / unknown), unchanged ledger');
} finally {
  server?.close();
}
