// Receiver check ("when it's used"): someone who receives a sealed record checks that their copy
// is exactly what was approved, by whom and when. Reuses the ledger's full re-verification, so a
// changed copy fails both the content hash and the reviewer's Ed25519 signature.
import { createHash } from 'node:crypto';
import { verifyChain, getEntry } from './ledger.js';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// valid: signature valid and content identical to the approved version
// changed: the copy differs from what was approved, so the approval no longer applies to it
// unknown: the record is missing, or the ledger itself fails verification
export async function checkReceipt({ archiveId, text }) {
  const entry = await getEntry(archiveId);
  if (!entry) return { status: 'unknown', reason: `No sealed record with ID ${archiveId}.` };
  const copy = typeof text === 'string' ? text : entry.text;
  const chain = await verifyChain({ archiveId, text: copy });
  const row = chain.records.find((r) => r.archiveId === archiveId);
  const upstreamOk = chain.brokenAt === null || chain.brokenAt >= row.index;
  let status = 'valid';
  let reason = null;
  if (!row.checks.content) {
    status = 'changed';
    reason = 'This copy is not the version that was approved. The original approval does not apply to it.';
  } else if (!row.checks.signature || !row.checks.link || !upstreamOk) {
    status = 'unknown';
    reason = 'The content matches, but the ledger itself does not verify. Check with the issuing records team.';
  }
  return {
    status,
    reason,
    archiveId: entry.archiveId,
    title: entry.title,
    sealedAt: entry.sealedAt,
    reviewer: entry.reviewer,
    keyId: entry.keyId,
    checks: { signature: row.checks.signature, content: row.checks.content, chain: row.checks.link && upstreamOk },
    sealedHash: entry.contentHash,
    copyHash: sha256(copy),
    approvedText: entry.text,
    trail: {
      originalText: entry.metadata?.originalText ?? null,
      decisions: entry.metadata?.decisions ?? null,
      clinicianQueries: entry.metadata?.clinicianQueries ?? null,
      author: entry.metadata?.author ?? null,
      mrn: entry.metadata?.mrn ?? null,
    },
  };
}

export async function handleReceipt(p) {
  if (!p?.archiveId) return { status: 400, body: { error: 'Provide the archiveId of the record you received' } };
  if (p.text !== undefined && typeof p.text !== 'string') return { status: 400, body: { error: 'text must be a string' } };
  const r = await checkReceipt({ archiveId: String(p.archiveId), text: p.text });
  return { status: r.status === 'unknown' && !r.archiveId ? 404 : 200, body: r };
}
