import { ChevronRight, Clock, Mic, AlertTriangle } from 'lucide-react';
import { VeeSays } from '../components/Vee.jsx';
import { CLINICIANS, ME } from './notes.js';
import { STATUS, statusOf, openIssues, riskOf, riskRank, age, relTime, dueLabel, pendingQueries } from './model.js';

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const TABS = [
  { key: 'review', label: 'To review' },
  { key: 'query', label: 'Waiting on clinician' },
  { key: 'ready', label: 'Ready to save' },
  { key: 'locked', label: 'Saved' },
];

const RISK_DOT = { Critical: 'bg-red-600', High: 'bg-orange-500', Medium: 'bg-amber-400', Low: 'bg-slate-400' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Worklist({ notes, tab, setTab, query, onOpen }) {
  const counts = Object.fromEntries(TABS.map((t) => [t.key, notes.filter((n) => statusOf(n) === t.key).length]));
  const overdue = notes.filter((n) => statusOf(n) !== 'locked' && dueLabel(n.dueAt).overdue).length;
  const q = query.trim().toLowerCase();
  const rows = notes
    .filter((n) => statusOf(n) === tab)
    .filter((n) => !q || `${n.patient.name} ${n.patient.mrn} ${n.type}`.toLowerCase().includes(q))
    .sort((a, b) => riskRank(b) - riskRank(a) || new Date(a.dueAt) - new Date(b.dueAt));
  const toReview = counts.review;

  return (
    <div>
      {/* Hero: editorial headline + photo, on the hospital wash */}
      <section className="pv-wash border-b border-slate-200">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-10">
          <div className="flex flex-col justify-center">
            <div className="pv-kicker text-slate-700">
              {greeting()}, {ME.name.split(' ')[0]} · {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <h1 className="pv-display mt-5 text-[clamp(40px,5vw,68px)]">
              {toReview ? (
                <>
                  {WORDS[toReview] || toReview} note{toReview === 1 ? '' : 's'}.
                  <br />
                  One record.
                  <br />
                  <span className="pv-mark">Learn from corrections.</span>
                </>
              ) : (
                <>
                  Queue clear.
                  <br />
                  Every record
                  <br />
                  <span className="pv-mark">reviewed.</span>
                </>
              )}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-600">
              {toReview
                ? `${toReview} AI-drafted note${toReview === 1 ? '' : 's'} need${toReview === 1 ? 's' : ''} checking against the recording and the hospital record before ${toReview === 1 ? 'it is' : 'they are'} filed.`
                : 'Nothing waiting. Every AI-drafted note has been checked and locked.'}
            </p>
            <div className="pv-track mt-7">
              {[
                ['review', 'To review', counts.review],
                ['overdue', 'Overdue', overdue],
                ['query', 'With clinician', counts.query],
                ['locked', 'Locked', counts.locked],
              ].map(([key, label, value]) => (
                <button key={key} onClick={() => setTab(key === 'overdue' ? 'review' : key)} className={`text-left ${key === 'review' ? 'now' : 'done'}`}>
                  <span className={`block text-2xl font-bold tabular-nums ${key === 'overdue' && value ? 'text-red-700' : 'text-slate-950'}`}>{value}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <figure className="relative hidden min-h-[320px] overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(20,60,37,0.18)] lg:block">
            <img src="/assets/hospital-team.jpg" alt="A clinician and a records officer reviewing a note together" className="absolute inset-0 h-full w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-6 text-white">
              <div className="pv-kicker text-white/80">Health Information Services · {ME.org}</div>
              <div className="mt-2 text-2xl font-bold leading-tight tracking-tight">Every AI note checked before it's filed.</div>
              <div className="mt-2 text-[10px] text-white/60">AI-generated image</div>
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative shrink-0 px-3 pb-2.5 pt-1 text-sm font-semibold ${tab === t.key ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${tab === t.key ? 'bg-slate-950 text-white' : 'bg-slate-200 text-slate-600'}`}>{counts[t.key]}</span>
            {tab === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-slate-950" />}
          </button>
        ))}
      </div>

      {!rows.length ? (
        <div className="py-10">
          <VeeSays mood={tab === 'review' ? 'happy' : 'idle'} size={64} className="mx-auto max-w-md">
            {q
              ? 'No notes match that search.'
              : tab === 'review'
              ? 'Nothing left to review. Everything here has been checked.'
              : tab === 'query'
              ? 'No open questions with clinicians right now.'
              : tab === 'ready'
              ? 'When every issue in a note is sorted, it shows up here, ready to lock.'
              : 'Locked notes will appear here once you sign them off.'}
          </VeeSays>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {rows.map((n) => {
            const risk = riskOf(n);
            const open = openIssues(n).length;
            const dueInfo = dueLabel(n.dueAt);
            const waiting = pendingQueries(n).length;
            const st = STATUS[statusOf(n)];
            return (
              <li key={n.id}>
                <button onClick={() => onOpen(n.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5">
                  <span className={`h-2.5 w-2.5 rounded-full ${risk ? RISK_DOT[risk] : 'bg-cyan-500'}`} title={risk ? `${risk} risk` : 'No open issues'} />
                  <span className="grid min-w-0 gap-1 md:grid-cols-[1.2fr_1.2fr_1fr] md:items-center md:gap-4">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{n.patient.name}</span>
                      <span className="block text-xs text-slate-500">
                        {n.patient.mrn}
                        {n.patient.dob && ` · ${age(n.patient.dob)} ${n.patient.sex}`}
                        {n.patient.allergies.length > 0 && <span className="ml-1.5 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-700">ALLERGY</span>}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{n.type}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-slate-500">
                        <Mic className="h-3 w-3 shrink-0" /> {n.source?.file ? `Imported · ${n.source.file}` : CLINICIANS[n.author]?.name || 'Unknown author'} · {relTime(n.receivedAt)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      {open > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          <AlertTriangle className="h-3 w-3" /> {open} issue{open === 1 ? '' : 's'}
                        </span>
                      )}
                      {waiting > 0 && <span className="text-[11px] text-sky-700">{waiting} question{waiting === 1 ? '' : 's'} out</span>}
                      {statusOf(n) !== 'locked' && (
                        <span className={`inline-flex items-center gap-1 text-[11px] ${dueInfo.overdue ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                          <Clock className="h-3 w-3" /> {dueInfo.text}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
