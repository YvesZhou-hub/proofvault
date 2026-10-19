// Archive seal ledger: an append-only hash chain of sealed records, each signed with a real
// Ed25519 key held by the approving reviewer. Changing one character of any sealed record
// breaks its content hash, its signature and every link after it.
import { createHash, generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from 'node:crypto';
import { store } from './ledgerStore.js';

const GENESIS = '0'.repeat(64);

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// Deterministic JSON (sorted keys) so the same entry always hashes the same way.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

// Demo key store: one Ed25519 key pair per reviewer, created on first use.
// In production the private key lives in an HSM or the reviewer's device, never on the server.
function keyFor(reviewerId) {
  return store.getOrCreateKey(reviewerId, () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pub = publicKey.export({ type: 'spki', format: 'pem' });
    return {
      keyId: `pv-ed25519-${sha256(pub).slice(0, 12)}`,
      publicKey: pub,
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    };
  });
}

function entryBody(e) {
  const { signature, entryHash, text, ...body } = e;
  return body;
}

async function makeEntry({ docId, title, text, reviewer, metadata = {} }, prev) {
  const k = await keyFor(reviewer.id);
  const index = prev ? prev.index + 1 : 0;
  const sealedAt = new Date().toISOString();
  const contentHash = sha256(text);
  const entry = {
    index,
    archiveId: `PV-ARC-${sealedAt.slice(0, 4)}-${String(index).padStart(4, '0')}-${contentHash.slice(0, 6).toUpperCase()}`,
    docId,
    title,
    sealedAt,
    contentHash,
    prevHash: prev ? prev.entryHash : GENESIS,
    reviewer: { id: reviewer.id, name: reviewer.name, role: reviewer.role ?? null },
    keyId: k.keyId,
    publicKey: k.publicKey,
    metadata,
    text,
  };
  entry.entryHash = sha256(canonical(entryBody(entry)));
  entry.signature = sign(null, Buffer.from(entry.entryHash, 'hex'), createPrivateKey(k.privateKey)).toString('base64');
  return entry;
}

// Two historical records sealed at start-up, so the chain has a past to protect.
async function seed() {
  const archivist = { id: 'r0', name: 'ProofVault Migration', role: 'Legacy records import' };
  const a = await makeEntry({ docId: 'D21/04410', title: 'Community Engagement Policy 2021', text: 'Clause 6.2: Allocations of community funding are subject to a 28-day public consultation period.', reviewer: archivist, metadata: { origin: 'human', standard: 'ISO 15489-1' } }, null);
  const b = await makeEntry({ docId: 'D26/18842', title: 'Adopted Budget 2026–27', text: 'Line 7.3.1: Community Energy Relief Subsidy — $4.2 million for the 2026–27 financial year.', reviewer: archivist, metadata: { origin: 'human', standard: 'ISO 15489-1' } }, a);
  return [a, b];
}

async function getLedger() {
  const chain = await store.readChain();
  if (chain.length) return chain;
  await store.appendIfLength(0, await seed()); // another request may have seeded first; either way, re-read
  return store.readChain();
}

// Appends with a compare-and-set on the chain length, retrying if another seal landed first,
// so concurrent seals from different serverless instances never fork the chain.
export async function sealRecord(input) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const chain = await getLedger();
    const entry = await makeEntry(input, chain[chain.length - 1]);
    if (await store.appendIfLength(chain.length, [entry])) return entry;
  }
  throw new Error('Ledger is busy, please try again');
}

// Re-verifies every entry from scratch. `tamper` simulates an edit without touching the ledger:
// { archiveId, text } replaces that record's text for this check only.
export async function verifyChain(tamper) {
  const chain = await getLedger();
  let brokenAt = null;
  const records = chain.map((e, i) => {
    const text = tamper && tamper.archiveId === e.archiveId && typeof tamper.text === 'string' ? tamper.text : e.text;
    const contentOk = sha256(text) === e.contentHash;
    const recomputed = sha256(canonical(entryBody({ ...e, contentHash: sha256(text) })));
    const hashOk = recomputed === e.entryHash;
    const linkOk = i === 0 ? e.prevHash === GENESIS : e.prevHash === chain[i - 1].entryHash;
    let sigOk = false;
    try {
      sigOk = verify(null, Buffer.from(recomputed, 'hex'), createPublicKey(e.publicKey), Buffer.from(e.signature, 'base64'));
    } catch {
      sigOk = false;
    }
    const ok = contentOk && hashOk && linkOk && sigOk;
    if (!ok && brokenAt === null) brokenAt = i;
    const reasons = [];
    if (!contentOk) reasons.push('content no longer matches its sealed SHA-256');
    if (!sigOk) reasons.push('reviewer signature does not verify');
    if (!linkOk) reasons.push('link to previous seal is broken');
    return {
      index: e.index,
      archiveId: e.archiveId,
      title: e.title,
      ok,
      downstreamOfBreak: brokenAt !== null && i > brokenAt,
      checks: { content: contentOk, signature: sigOk, link: linkOk },
      sealedHash: e.contentHash,
      currentHash: sha256(text),
      reason: reasons.join('; ') || null,
    };
  });
  return { ok: brokenAt === null, brokenAt, length: chain.length, head: chain[chain.length - 1].entryHash, records };
}

export async function getEntry(archiveId) {
  return (await getLedger()).find((e) => e.archiveId === archiveId) ?? null;
}

export async function listLedger() {
  return (await getLedger()).map(({ text, privateKey, ...e }) => ({ ...e, textPreview: text.slice(0, 160), textLength: text.length }));
}

export async function resetLedger() {
  await store.clearChain();
  return (await getLedger()).length;
}

/* ───────────── HTTP handlers (shared by Vite middleware and Vercel functions) ───────────── */

export async function handleSeal(p) {
  if (!p?.text?.trim()) return { status: 400, body: { error: 'Provide the record text to seal' } };
  if (!p.reviewer?.id || !p.reviewer?.name) return { status: 400, body: { error: 'Provide reviewer { id, name }' } };
  const { text: _t, ...entry } = await sealRecord({ docId: p.docId ?? null, title: p.title ?? 'Untitled record', text: p.text, reviewer: p.reviewer, metadata: p.metadata ?? {} });
  return { status: 200, body: entry };
}

export async function handleVerify(p) {
  return { status: 200, body: await verifyChain(p?.tamper) };
}

export async function handleLedger(p) {
  if (p?.action === 'reset') return { status: 200, body: { reset: true, length: await resetLedger() } };
  return { status: 200, body: { entries: await listLedger() } };
}
