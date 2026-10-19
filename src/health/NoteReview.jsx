import { useEffect, useState } from 'react';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Mic, FileText, Pencil, Send, Undo2, Network, Lock, Play, HelpCircle, ShieldCheck, History, Loader2,
} from 'lucide-react';
import Vee, { VeeSays } from '../components/Vee.jsx';
import { CLINICIANS, ME } from './notes.js';
import { STATUS, statusOf, issuesOf, openIssues, isResolved, finalText, age, relTime } from './model.js';
import { wordDiff } from '../lib.js';
import { getNode } from '../taxonomy.js';

const SEVERITY = {
  Critical: 'bg-red-600 text-white',
  High: 'bg-orange-500 text-white',
  Medium: 'bg-amber-300 text-amber-950',
  Low: 'bg-slate-300 text-slate-800',
};
const VERDICT = {
  match: { label: 'Matches', cls: 'bg-cyan-100 text-cyan-800' },
  mismatch: { label: 'Does not match', cls: 'bg-red-100 text-red-700' },
  missing: { label: 'Not on file', cls: 'bg-amber-100 text-amber-800' },
};

function Diff({ from, to }) {
  return wordDiff(from, to).map((p, i) =>
    p.type === 'same' ? (
      <span key={i}>{p.text}</span>
    ) : p.type === 'del' ? (
      <span key={i} className="bg-red-100 text-red-700 line-through">
        {p.text}
      </span>
    ) : (
      <span key={i} className="bg-cyan-100 text-cyan-900">
        {p.text}
      </span>
    )
  );
}

function IssuePanel({ note, seg, index, total, onDecide, onUndo, onAsk, onApplyAnswer, onTrace, onNav }) {
  const [mode, setMode] = useState(null); // 'edit' | 'ask'
  const [draft, setDraft] = useState('');
  useEffect(() => setMode(null), [seg.id]);

  const author = CLINICIANS[note.author];
  const decision = note.decisions[seg.id];
  const q = note.queries[seg.id];
  const locked = !!note.seal;
  const pattern = seg.pattern && getNode(seg.pattern);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Issue {index + 1} of {total}
        </span>
        <span className="flex gap-1">
          <button onClick={() => onNav(-1)} className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-100">
            Prev
          </button>
          <button onClick={() => onNav(1)} className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-100">
            Next
          </button>
        </span>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${SEVERITY[seg.flag.severity]}`}>{seg.flag.severity}</span>
          <span className={`text-xs font-semibold ${seg.flag.type === 'bias' ? 'text-orange-700' : 'text-red-700'}`}>
            {seg.flag.type === 'bias' ? 'Bias' : "Doesn't match the source"}
          </span>
        </div>
        <h3 className="mt-2 text-xl font-bold leading-snug">{seg.flag.title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{seg.flag.explain}</p>
      </div>

      {/* Evidence: where the claim should have come from */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Evidence</div>
        <div className="space-y-3 p-4">
          {seg.evidence?.transcript?.map((t) => (
            <div key={t.t} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Mic className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  Recording · {t.who}
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 font-mono text-[11px] text-slate-700">
                    <Play className="h-2.5 w-2.5" /> {t.t}
                  </span>
                </div>
                <div className="mt-0.5 text-[14px]">“{t.text}”</div>
              </div>
            </div>
          ))}
          {seg.evidence?.records?.map((r) => (
            <div key={r.label} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {r.label}
                  <span className={`rounded px-1.5 text-[11px] font-semibold ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].label}</span>
                </div>
                <div className="mt-0.5 text-[14px] font-medium">{r.value}</div>
              </div>
            </div>
          ))}
          {seg.evidence?.note && <p className="text-[13px] text-slate-600">{seg.evidence.note}</p>}
          {pattern && (
            <button onClick={() => onTrace(seg)} className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100">
              <Network className="h-4 w-4 shrink-0 text-cyan-700" />
              <span className="min-w-0 flex-1">
                Known pattern: <b>{pattern.label}</b>
                <span className="text-slate-500"> · seen {pattern.cases} times</span>
              </span>
              <span className="font-semibold text-cyan-800">See trace →</span>
            </button>
          )}
        </div>
      </div>

      {/* Clinician thread */}
      {q && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-[13px]">
          <div className="text-xs font-semibold text-sky-900">You asked {author.name}</div>
          <p className="mt-1 text-slate-700">{q.question}</p>
          {q.reply ? (
            <>
              <div className="mt-3 text-xs font-semibold text-sky-900">{author.name} replied · {relTime(q.replyAt)}</div>
              <p className="mt-1 text-slate-800">“{q.reply}”</p>
            </>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-sky-800">
              <Loader2 className="h-3 w-3 animate-spin" /> Waiting for a reply…
            </div>
          )}
        </div>
      )}

      {/* Decision */}
      {decision ? (
        <div className="flex items-center justify-between rounded-2xl bg-cyan-50 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-cyan-900">
            <CheckCircle2 className="h-4 w-4" />
            {decision === 'fixed' ? 'Correction applied' : decision === 'edited' ? 'Your wording applied' : 'Kept as written'}
          </span>
          {!locked && (
            <button onClick={() => onUndo(seg.id)} className="inline-flex items-center gap-1 text-xs text-cyan-900 hover:underline">
              <Undo2 className="h-3 w-3" /> Undo
            </button>
          )}
        </div>
      ) : locked ? null : mode === 'edit' ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-[14px] outline-none focus:border-slate-950" />
          <div className="flex gap-2">
            <button disabled={!draft.trim()} onClick={() => onDecide(seg.id, 'edited', draft.trim())} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              Save wording
            </button>
            <button onClick={() => setMode(null)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      ) : mode === 'ask' ? (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">To {author.name} · {author.role}</div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-[14px] outline-none focus:border-slate-950" />
          <div className="flex gap-2">
            <button
              disabled={!draft.trim()}
              onClick={() => {
                onAsk(seg.id, draft.trim());
                setMode(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" /> Send question
            </button>
            <button onClick={() => setMode(null)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Suggested correction</div>
            <p className="mt-1.5 text-[14px] leading-relaxed">
              <Diff from={seg.text} to={seg.revised} />
            </p>
          </div>
          {q?.reply && (
            <button onClick={() => onApplyAnswer(seg.id)} className="w-full rounded-xl bg-brand-yellow px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_3px_0_#d5b800]">
              Apply the doctor's answer
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onDecide(seg.id, 'fixed')} className={`col-span-2 rounded-xl px-4 py-3 text-sm font-bold ${q?.reply ? 'border border-slate-300 bg-white' : 'bg-brand-yellow text-slate-950 shadow-[0_3px_0_#d5b800]'}`}>
              Accept correction
            </button>
            <button
              onClick={() => {
                setDraft(seg.revised);
                setMode('edit');
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit wording
            </button>
            <button
              disabled={!!q && !q.reply}
              onClick={() => {
                setDraft(seg.query?.question || `Please confirm: “${seg.text}”`);
                setMode('ask');
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Ask the doctor
            </button>
          </div>
          <button onClick={() => onDecide(seg.id, 'kept')} className="w-full text-center text-xs text-slate-500 hover:text-slate-900 hover:underline">
            This is correct — keep as written
          </button>
        </div>
      )}
    </div>
  );
}

function LockDialog({ note, onClose, onLock, onDone }) {
  const [checks, setChecks] = useState([false, false, false]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seal, setSeal] = useState(note.seal);
  const fixed = Object.values(note.decisions).filter((d) => d !== 'kept').length;
  const confirmed = Object.values(note.queries).filter((q) => q.reply).length;
  const signed = name.trim().toLowerCase() === ME.name.toLowerCase();
  const ITEMS = ['The note matches the recording and the linked hospital records.', 'No unsupported assumptions about the patient remain.', 'This version is ready for the permanent medical record.'];

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setSeal(await onLock());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={seal ? undefined : onClose}>
      <div className="animate-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {seal ? (
          <div className="p-7 text-center">
            <Vee mood="happy" size={110} bob className="mx-auto" />
            <h2 className="mt-3 text-2xl font-bold">Record locked</h2>
            <p className="mt-1 text-sm text-slate-500">
              {note.patient.name} · {note.type} is now in the permanent record. Any change to it can be detected.
            </p>
            <dl className="mt-5 space-y-2 rounded-2xl bg-slate-100 p-4 text-left text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Record ID</dt>
                <dd className="font-mono font-semibold">{seal.archiveId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Fingerprint</dt>
                <dd className="truncate font-mono">{seal.hash.slice(0, 24)}…</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Signed by</dt>
                <dd className="font-semibold">{ME.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Time</dt>
                <dd>{new Date(seal.sealedAt).toLocaleString('en-AU')}</dd>
              </div>
            </dl>
            <button onClick={onDone} className="mt-5 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white">
              Back to worklist
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-yellow">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold">Sign and lock this note</h2>
                <p className="text-sm text-slate-500">
                  {note.patient.name} · {note.type}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-slate-100 p-3">
                <div className="text-2xl font-bold">{fixed}</div>
                <div className="text-xs text-slate-500">changes made</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3">
                <div className="text-2xl font-bold">{confirmed}</div>
                <div className="text-xs text-slate-500">confirmed by clinician</div>
              </div>
            </div>
            <div className="mt-5 space-y-2.5">
              {ITEMS.map((item, i) => (
                <label key={item} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((c, k) => (k === i ? !c : c)))} className="mt-0.5 h-4 w-4 accent-slate-950" />
                  {item}
                </label>
              ))}
            </div>
            <label className="mt-5 block text-xs font-semibold text-slate-600">Type your full name to sign</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={ME.name} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] outline-none focus:border-slate-950" />
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                disabled={!checks.every(Boolean) || !signed || busy}
                onClick={submit}
                className="flex-1 rounded-xl bg-brand-yellow py-3 text-sm font-bold text-slate-950 shadow-[0_3px_0_#d5b800] disabled:opacity-40 disabled:shadow-none"
              >
                {busy ? 'Locking…' : 'Sign & lock'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NoteReview({ note, onBack, onDecide, onUndo, onAsk, onApplyAnswer, onTrace, onLock }) {
  const issues = issuesOf(note);
  const [selected, setSelected] = useState(() => (openIssues(note)[0] || issues[0])?.id);
  const [lockOpen, setLockOpen] = useState(false);
  const [tab, setTab] = useState('note');
  const seg = issues.find((s) => s.id === selected);
  const open = openIssues(note).length;
  const st = statusOf(note);
  const author = CLINICIANS[note.author];
  // After a decision, move on to the next unresolved issue.
  const advanceAfter = (id, decision) => {
    const next = openIssues({ ...note, decisions: { ...note.decisions, [id]: decision } })[0];
    if (next) setTimeout(() => setSelected(next.id), 350);
  };
  const nav = (d) => {
    const i = issues.findIndex((s) => s.id === selected);
    setSelected(issues[(i + d + issues.length) % issues.length].id);
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Hero: where this note is in its journey, on the hospital wash */}
      <section className="pv-wash border-b border-slate-200">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:py-8">
          <div>
            <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" /> Worklist
            </button>
            <div className="pv-kicker mt-4 text-slate-700">
              {note.type} · {note.patient.name}
            </div>
            <h1 className="pv-display mt-3 text-[clamp(34px,4vw,54px)]">
              {note.seal ? (
                <>
                  Checked.
                  <br />
                  Signed. <span className="pv-mark">Locked.</span>
                </>
              ) : (
                <>
                  One note.
                  <br />
                  Check it. <span className="pv-mark">Lock it.</span>
                </>
              )}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-1 text-[13px] text-slate-600">
              <Mic className="h-3.5 w-3.5" />{' '}
              {note.source?.file
                ? `Imported from ${note.source.file} · reviewed by ${note.source.model || 'Claude'}`
                : `Drafted by AI scribe from a ${note.scribe.minutes}-min recording · ${author?.name || 'Unknown author'}`}{' '}
              · {relTime(note.receivedAt)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_10px_30px_rgba(20,60,37,0.08)] backdrop-blur">
            <div className="pv-track">
              {[
                ['01 Evidence', true],
                ['02 Review', st !== 'review' && st !== 'query'],
                ['03 Confirm', st === 'locked'],
                ['04 Lock', st === 'locked'],
              ].map(([label, done], i, all) => {
                const now = !done && (i === 0 || all[i - 1][1]);
                return (
                  <span key={label} className={done ? 'done' : now ? 'now' : ''}>
                    {label}
                  </span>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[st].cls}`}>{STATUS[st].label}</span>
                {issues.length > 0 && !note.seal && (
                  <span className="ml-2 text-slate-600">
                    {issues.length - open} of {issues.length} issues sorted
                  </span>
                )}
              </div>
              {note.seal ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">
                  <ShieldCheck className="h-4 w-4" /> Locked
                </span>
              ) : (
                <button
                  disabled={st !== 'ready'}
                  onClick={() => setLockOpen(true)}
                  title={st === 'query' ? 'Waiting on a clinician reply' : open ? 'Sort every issue first' : ''}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-yellow px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_3px_0_#d5b800] disabled:opacity-40 disabled:shadow-none"
                >
                  <Lock className="h-4 w-4" /> Sign & lock
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* The note */}
        <div className="min-w-0">
          <div className="mb-3 flex gap-1 text-sm">
            {[
              ['note', 'Note', FileText],
              ['history', 'History', History],
            ].map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold ${tab === k ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>
                <Icon className="h-3.5 w-3.5" /> {l}
              </button>
            ))}
          </div>
          {tab === 'note' ? (
            <article className="pv-record p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3 border-b-2 border-cyan-700 pb-3">
                <strong className="text-[13px] tracking-[0.12em] text-cyan-800">✚ NORTHSIDE HOSPITAL</strong>
                <span className="text-right text-[10px] uppercase tracking-wider text-cyan-800">Health Information Services</span>
              </div>
              <h2 className="mt-6 text-2xl font-bold tracking-tight">{note.type}</h2>
              <dl className="mt-4">
                <div>
                  <dt>Patient</dt>
                  <dd>
                    {note.patient.name} · {note.patient.mrn}
                    {note.patient.dob && ` · ${age(note.patient.dob)} ${note.patient.sex}`}
                  </dd>
                </div>
                <div>
                  <dt>Encounter</dt>
                  <dd>
                    {note.patient.ward} · {new Date(note.scribe.recordedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </dd>
                </div>
                <div>
                  <dt>Record status</dt>
                  <dd>{note.seal ? 'Signed review version' : 'Draft — verification pending'}</dd>
                </div>
                <div>
                  <dt>Allergies</dt>
                  <dd className={note.patient.allergies.length ? 'font-semibold text-red-700' : ''}>{note.patient.allergies.join(', ') || 'None recorded'}</dd>
                </div>
              </dl>
              <div className="mt-6 space-y-3">
                {note.segments.map((s, idx) => {
                  const flagged = !!s.flag;
                  const resolved = flagged && isResolved(note, s.id);
                  const active = s.id === selected;
                  const label = `${String(idx + 1).padStart(2, '0')} / ${s.section}`;
                  return (
                    <section key={s.id}>
                      {flagged ? (
                        <button
                          onClick={() => setSelected(s.id)}
                          className={`w-full border-l-[3px] px-4 py-3 text-left transition ${
                            resolved ? 'border-cyan-600 bg-cyan-50/70' : s.flag.type === 'bias' ? 'border-orange-400 bg-orange-50' : 'border-red-500 bg-red-50'
                          } ${active ? 'outline outline-2 outline-offset-2 outline-slate-950' : 'hover:bg-opacity-80'}`}
                        >
                          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            {label}
                            {resolved ? (
                              <span className="inline-flex items-center gap-1 normal-case tracking-normal text-cyan-800">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Sorted
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 normal-case tracking-normal ${s.flag.type === 'bias' ? 'text-orange-700' : 'text-red-700'}`}>
                                <AlertTriangle className="h-3.5 w-3.5" /> {s.flag.type === 'bias' ? 'Bias' : 'Check source'}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-[15px] leading-relaxed">{resolved ? finalText(note, s) : s.text}</p>
                        </button>
                      ) : (
                        <div className="px-4 py-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                          <p className="mt-1.5 text-[15px] leading-relaxed">{s.text}</p>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-xs">
                <span>
                  Clinical confirmation:{' '}
                  <b>{Object.values(note.queries).some((q) => q.reply) ? `Confirmed by ${author?.name}` : Object.keys(note.queries).length ? 'Requested' : 'Not requested'}</b>
                </span>
                <span>
                  Record integrity: <b>{note.seal ? `Signed · ${note.seal.archiveId}` : 'Not yet signed'}</b>
                </span>
              </div>
            </article>
          ) : (
            <ol className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
              {[...note.audit].reverse().map((e, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-950" />
                  <div>
                    <div className="text-xs text-slate-500">
                      {new Date(e.at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} · {e.who}
                    </div>
                    <div>{e.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Issue panel */}
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          {seg ? (
            <IssuePanel
              note={note}
              seg={seg}
              index={issues.indexOf(seg)}
              total={issues.length}
              onDecide={(id, d, text) => {
                onDecide(id, d, text);
                advanceAfter(id, d);
              }}
              onUndo={onUndo}
              onAsk={onAsk}
              onApplyAnswer={(id) => {
                onApplyAnswer(id);
                advanceAfter(id, 'fixed');
              }}
              onTrace={onTrace}
              onNav={nav}
            />
          ) : (
            <VeeSays mood="happy" size={64}>
              {note.seal ? 'This note is locked.' : 'No problems found in this note. Read it through, then sign and lock it.'}
            </VeeSays>
          )}
          {!note.seal && st === 'ready' && seg && (
            <VeeSays mood="happy" size={52} className="mt-5">
              Every issue is sorted. Hit <b>Sign & lock</b> to file it into the medical record.
            </VeeSays>
          )}
          {st === 'query' && (
            <VeeSays mood="think" size={52} className="mt-5">
              I'll let you know when {author?.name} replies. You can keep working on other notes.
            </VeeSays>
          )}
        </aside>
      </div>

      {lockOpen && <LockDialog note={note} onClose={() => setLockOpen(false)} onLock={onLock} onDone={onBack} />}
    </div>
  );
}

