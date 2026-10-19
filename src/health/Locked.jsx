import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Loader2, FlaskConical, Send } from 'lucide-react';
import { VeeSays } from '../components/Vee.jsx';

const post = async (url, body = {}) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

// The permanent record: every sealed entry in the signed ledger, with a one-click integrity check.
export default function Locked({ onReceive }) {
  const [entries, setEntries] = useState(null);
  const [check, setCheck] = useState(null); // verify result
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tampered, setTampered] = useState(null);

  const load = async () => {
    setError('');
    try {
      setEntries((await post('/api/ledger')).entries);
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const verify = async (tamper) => {
    setBusy(true);
    setError('');
    try {
      setCheck(await post('/api/verify', tamper ? { tamper } : {}));
      setTampered(tamper?.archiveId || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const byId = Object.fromEntries((check?.records || []).map((r) => [r.archiveId, r]));
  const rows = entries ? [...entries].reverse() : [];

  const broken = check && !check.ok;
  return (
    <div>
      <section className="pv-wash border-b border-slate-200">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:py-10">
          <div>
            <div className="pv-kicker text-slate-700">Supporting evidence · Northside Hospital</div>
            <h1 className="pv-display mt-5 text-[clamp(40px,5vw,68px)]">
              Reviewed.
              <br />
              Preserved.
              <br />
              <span className="pv-mark">Reusable.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-600">
              Signed records support the Correction Library. Preserve the original review evidence while proposed checks are separately reviewed and tested.
            </p>
            <button onClick={() => verify()} disabled={busy} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check integrity
            </button>
          </div>
          {/* Seal: three linked checks — content, signature, chain */}
          <div className="flex flex-col items-center">
            <div className={`flex h-64 w-64 items-center justify-center rounded-full border-[3px] bg-white/80 shadow-[0_20px_50px_rgba(128,107,210,0.18)] backdrop-blur transition ${broken ? 'border-red-500' : 'border-[#8b7abe]'} ${busy ? 'animate-pulse' : ''}`}>
              <div className="text-center">
                <svg viewBox="0 0 160 50" className="mx-auto w-44">
                  {[25, 80, 135].map((cx, k) => {
                    const bad = broken && k === 0;
                    return (
                      <g key={cx}>
                        {k > 0 && <line x1={cx - 37} y1="25" x2={cx - 18} y2="25" stroke={broken ? '#ef4444' : '#8b7abe'} strokeWidth="3" />}
                        <circle cx={cx} cy="25" r="18" fill="#fff" stroke={broken ? '#ef4444' : '#8b7abe'} strokeWidth="3" />
                        {bad || broken ? (
                          <path d={`M${cx - 6} 19 l12 12 M${cx + 6} 19 l-12 12`} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                        ) : (
                          <path d={`M${cx - 7} 25 l5 5 l10 -10`} fill="none" stroke="#8b7abe" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div className="pv-kicker mt-3 text-[10px] text-slate-500">Content · Signature · Chain</div>
                <div className={`mt-2 text-sm font-semibold ${broken ? 'text-red-700' : 'text-slate-800'}`}>
                  {busy ? 'Checking…' : !check ? `${entries?.length ?? '—'} records sealed` : check.ok ? 'All intact' : `Broken at #${check.brokenAt}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      {check && (
        <div className="mt-5">
          {check.ok ? (
            <VeeSays mood="happy" size={56}>
              All <b>{check.length}</b> records check out — content, signatures and links are intact.
            </VeeSays>
          ) : (
            <VeeSays
              mood="alert"
              size={56}
              action={
                tampered && (
                  <button onClick={() => verify()} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
                    Run the real check again
                  </button>
                )
              }
            >
              {tampered ? 'Simulated edit detected. ' : ''}Record <b>#{check.brokenAt}</b> no longer matches what was signed, and every record after it is flagged too.
              {tampered && <span className="text-slate-500"> (Simulation only — nothing was actually changed.)</span>}
            </VeeSays>
          )}
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <ul className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {!entries && !error && (
          <li className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the ledger…
          </li>
        )}
        {rows.map((e) => {
          const r = byId[e.archiveId];
          return (
            <li key={e.archiveId} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-5 py-4 sm:gap-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${r ? (r.ok ? 'bg-cyan-100 text-cyan-800' : 'bg-red-100 text-red-700') : 'bg-slate-100 text-slate-500'}`}>
                {r && !r.ok ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{e.title}</span>
                <span className="block truncate text-xs text-slate-500">
                  #{e.index} · {e.archiveId} · {e.reviewer?.name} · {new Date(e.sealedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                {r && !r.ok && <span className="block text-xs text-red-700">{r.downstreamOfBreak ? 'Chain broken upstream' : r.reason}</span>}
              </span>
              <button
                onClick={() => verify({ archiveId: e.archiveId, text: `${e.textPreview} [edited]` })}
                title="Simulate someone editing this record, then run the check"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <FlaskConical className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Simulate edit</span>
              </button>
              {onReceive && (
                <button
                  onClick={() => onReceive(e.archiveId)}
                  title="Open this record as the clinician who receives it, and verify the copy"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Send className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Send to receiver</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}
