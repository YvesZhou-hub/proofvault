import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, FlaskConical, RotateCcw } from 'lucide-react';
import { wordDiff } from '../lib.js';
import { CLINICIANS } from './notes.js';

// "When it's used": the receiving clinician checks that the copy they were sent is exactly what
// Health Information Services approved, and sees what was checked before it was locked.
const RECEIVER = CLINICIANS.murphy;

const post = async (body) => {
  const res = await fetch('/api/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok && !json.status) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

const fmt = (iso) => new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney' });

// One small, realistic change: the dose the review corrected, or else one character.
function alter(text) {
  if (/\b50 mg\b/.test(text)) return text.replace(/\b50 mg\b/, '500 mg');
  const i = text.search(/\d/);
  if (i >= 0) return text.slice(0, i) + String((+text[i] + 1) % 10) + text.slice(i + 1);
  return `${text} `;
}

const STATUS = {
  valid: { icon: ShieldCheck, tone: 'border-cyan-300 bg-cyan-50 text-cyan-900', title: 'Signature valid. Content matches the approved version.' },
  changed: { icon: ShieldAlert, tone: 'border-red-300 bg-red-50 text-red-800', title: 'Content has changed. The original approval no longer applies to this copy.' },
  unknown: { icon: ShieldQuestion, tone: 'border-amber-300 bg-amber-50 text-amber-900', title: 'Status cannot be confirmed. Further checking is needed.' },
};

export default function Receive({ archiveId, onBack }) {
  const [record, setRecord] = useState(null); // receipt for the untouched record
  const [copy, setCopy] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    post({ archiveId })
      .then((r) => {
        if (!live) return;
        if (!r.archiveId) { setError(r.reason || 'The record could not be found.'); return; }
        setRecord(r);
        setCopy(r.approvedText || '');
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [archiveId]);

  const check = async (text) => {
    setBusy(true);
    setError('');
    try {
      setResult(await post({ archiveId, text }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const simulate = () => {
    const next = alter(copy);
    setCopy(next);
    check(next);
  };
  const restore = () => {
    setCopy(record.approvedText);
    setResult(null);
  };

  const s = result && STATUS[result.status];
  const trail = record?.trail;
  const diff = trail?.originalText && record?.approvedText ? wordDiff(trail.originalText, record.approvedText) : null;
  const replies = Object.values(trail?.clinicianQueries || {}).filter((q) => q?.reply);

  return (
    <div>
      <section className="pv-wash border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Locked records
          </button>
          <div className="pv-kicker mt-5 text-slate-700">Received record · {RECEIVER.role}</div>
          <h1 className="pv-display mt-4 text-[clamp(34px,4.4vw,56px)]">
            Is this the note
            <br />
            <span className="pv-mark">that was approved?</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600">
            You are viewing this as {RECEIVER.name}. A referral arrived with a copy of the patient’s note. Check it against the signed record before relying on it.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 space-y-4">
          {!record && !error && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the record…
            </p>
          )}
          {record && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold">{record.title}</h2>
                  <span className="font-mono text-xs text-slate-500">{record.archiveId}</span>
                </div>
                <label htmlFor="receivedCopy" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  The copy you received
                </label>
                <textarea
                  id="receivedCopy"
                  disabled={busy}
                  value={copy}
                  onChange={(e) => {
                    setCopy(e.target.value);
                    setResult(null);
                  }}
                  rows={8}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-[14.5px] leading-relaxed focus:border-slate-400 focus:outline-none"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => check(copy)} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify this copy
                  </button>
                  <button onClick={simulate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50" title="Change one detail in the copy, then verify it">
                    <FlaskConical className="h-4 w-4" /> Simulate a changed copy
                  </button>
                  {copy !== record.approvedText && (
                    <button onClick={restore} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                      <RotateCcw className="h-4 w-4" /> Restore received copy
                    </button>
                  )}
                </div>
              </div>

              {s && (
                <div className={`rounded-2xl border-2 p-5 ${s.tone}`} role="status">
                  <div className="flex items-start gap-3">
                    <s.icon className="mt-0.5 h-6 w-6 shrink-0" />
                    <div className="min-w-0 space-y-2">
                      <p className="text-base font-bold">{s.title}</p>
                      <ul className="space-y-1 text-sm">
                        <li>{result.checks?.signature ? '✓' : '✗'} Signed by {result.reviewer?.name}{result.reviewer?.role ? `, ${result.reviewer.role}` : ''} <span className="font-mono text-xs opacity-70">({result.keyId}, Ed25519)</span></li>
                        <li>{result.checks?.content ? '✓' : '✗'} {result.checks?.content ? 'Identical to the version approved' : 'Differs from the version approved'} on {fmt(result.sealedAt)}</li>
                        <li>{result.checks?.chain ? '✓' : '✗'} Record ledger intact</li>
                      </ul>
                      {result.reason && <p className="text-sm">{result.reason}</p>}
                      <p className="break-all font-mono text-[11px] opacity-70">
                        approved sha256 {result.sealedHash?.slice(0, 24)}… · this copy {result.copyHash?.slice(0, 24)}…
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500">
                This check verifies the signed version and its recorded reviewer details. Demo identities are not independently authenticated. It does not prove clinical accuracy or that this is the latest version.
              </p>
            </>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="pv-kicker text-[10px] text-slate-500">What was checked before it was locked</div>
            {!record ? (
              <p className="mt-3 text-sm text-slate-500">—</p>
            ) : (
              <div className="mt-3 space-y-4 text-sm">
                <div>
                  Approved by <b>{record.reviewer?.name}</b>
                  {record.reviewer?.role ? `, ${record.reviewer.role}` : ''}, on {fmt(record.sealedAt)}.
                  {trail?.author ? <> Note author: {trail.author}.</> : null}
                </div>
                {diff ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI draft → approved version</div>
                    <p className="mt-2 rounded-xl bg-slate-50 p-3 leading-relaxed">
                      {diff.map((d, i) =>
                        d.type === 'same' ? (
                          <span key={i}>{d.text}</span>
                        ) : d.type === 'del' ? (
                          <del key={i} className="bg-red-100 text-red-800">{d.text}</del>
                        ) : (
                          <ins key={i} className="bg-cyan-100 text-cyan-900 no-underline">{d.text}</ins>
                        )
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No AI draft was attached to this record.</p>
                )}
                {replies.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmed with the clinician</div>
                    <ul className="mt-2 space-y-2">
                      {replies.map((q, i) => (
                        <li key={i} className="rounded-xl bg-slate-50 p-3">
                          <div className="text-slate-600">{q.question}</div>
                          <div className="mt-1 font-semibold">“{q.reply}”</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-slate-500">The draft, the decisions and the replies are part of what was signed, so they cannot be edited without the check failing.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
