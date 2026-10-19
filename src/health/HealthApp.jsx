import { useEffect, useRef, useState } from 'react';
import { Inbox, ShieldCheck, Search, Bell, Plus, Info } from 'lucide-react';
import Vee from '../components/Vee.jsx';
import { IngestModal } from '../components/Modals.jsx';
import ProvenanceMapOverlay from '../components/ProvenanceMap.jsx';
import Worklist from './Worklist.jsx';
import NoteReview from './NoteReview.jsx';
import Locked from './Locked.jsx';
import Receive from './Receive.jsx';
import { readLearning, saveLearning } from './Learning.jsx';
import Workflow from './Workflow.jsx';
import { finalText } from './model.js';
import { ME, CLINICIANS } from './notes.js';
import { initialNotes, statusOf, noteText } from './model.js';
import { lockOriginalDraft } from '../lib.js';

const REPLY_DELAY_MS = 4000;

// Turns an uploaded file and its paragraph-level review into a worklist note.
function noteFromUpload({ fileName, paragraphs, analysis, model }) {
  const findingAt = new Map(analysis.findings.map((f) => [f.index, f]));
  const now = new Date().toISOString();
  return {
    id: `note-up-${Date.now()}`,
    patient: { name: 'Patient to be matched', mrn: 'Unmatched', dob: null, sex: '', ward: fileName, allergies: [] },
    type: analysis.title,
    author: 'uploaded',
    source: { file: fileName, model },
    scribe: { recordedAt: now, minutes: 0 },
    receivedAt: now,
    dueAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    segments: paragraphs.map((text, i) => {
      const seg = { id: `s${i + 1}`, section: analysis.sections[i] || `Paragraph ${i + 1}`, text };
      const f = findingAt.get(i + 1);
      if (f) {
        seg.flag = { type: f.type, severity: f.severity, title: f.title, explain: f.rationale };
        seg.revised = f.revised;
        seg.evidence = { transcript: [], records: [], note: f.evidence };
      }
      return seg;
    }),
    decisions: {},
    edits: {},
    queries: {},
    seal: null,
    audit: [{ at: now, who: 'ProofVault', text: `Imported ${fileName}; ${analysis.findings.length} issue(s) found by ${model || 'Claude'}` }],
  };
}

export default function HealthApp() {
  const [notes, setNotes] = useState(initialNotes);
  const [learning, setLearning] = useState(readLearning);
  const updateLearning = (next) => { saveLearning(next); setLearning(next); };
  // ?receive=<archiveId> opens the receiver's check directly (e.g. a link sent with a referral).
  const [view, setView] = useState(() => {
    const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('receive') : null;
    return id ? { name: 'receive', id } : { name: 'learning' };
  });
  const [tab, setTab] = useState('review');
  const [query, setQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [alerts, setAlerts] = useState([]); // clinician replies
  const [bellOpen, setBellOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [map, setMap] = useState(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const toast = (text, mood = 'happy') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, mood }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  const update = (id, fn) => setNotes((all) => all.map((n) => (n.id === id ? fn(n) : n)));
  const log = (n, text, who = ME.name) => [...n.audit, { at: new Date().toISOString(), who, text }];
  const segOf = (n, segId) => n.segments.find((s) => s.id === segId);

  const decide = (id, segId, decision, text) =>
    update(id, (n) => ({
      ...n,
      decisions: { ...n.decisions, [segId]: decision },
      edits: decision === 'edited' ? { ...n.edits, [segId]: text } : n.edits,
      audit: log(n, `${decision === 'fixed' ? 'Accepted correction' : decision === 'edited' ? 'Edited wording' : 'Kept as written'}: ${segOf(n, segId).section}`),
    }));

  const undo = (id, segId) =>
    update(id, (n) => {
      const decisions = { ...n.decisions };
      delete decisions[segId];
      return { ...n, decisions, audit: log(n, `Undid decision: ${segOf(n, segId).section}`) };
    });

  const ask = (id, segId, question) => {
    const note = notes.find((n) => n.id === id);
    const author = CLINICIANS[note.author];
    update(id, (n) => ({
      ...n,
      queries: { ...n.queries, [segId]: { question, sentAt: new Date().toISOString() } },
      audit: log(n, `Asked ${author.name}: ${question}`),
    }));
    toast(`Question sent to ${author.name}`, 'idle');
    // Clinician reply (simulated inbox round-trip).
    timers.current.push(
      setTimeout(() => {
        const reply = segOf(note, segId).query?.reply || 'Yes, please correct it as suggested.';
        update(id, (n) => ({
          ...n,
          queries: { ...n.queries, [segId]: { ...n.queries[segId], reply, replyAt: new Date().toISOString() } },
          audit: log(n, `Replied: ${reply}`, author.name),
        }));
        setAlerts((a) => [{ id: `${id}-${segId}`, noteId: id, text: `${author.name} replied about ${note.patient.name}`, at: new Date().toISOString() }, ...a]);
        toast(`${author.name} replied`, 'alert');
      }, REPLY_DELAY_MS)
    );
  };

  const applyAnswer = (id, segId) =>
    update(id, (n) => ({ ...n, decisions: { ...n.decisions, [segId]: 'fixed' }, audit: log(n, `Applied clinician's answer: ${segOf(n, segId).section}`) }));

  const lock = async (id) => {
    const note = notes.find((n) => n.id === id);
    const res = await fetch('/api/seal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docId: note.id,
        title: `${note.type} — ${note.patient.name}`,
        text: noteText(note),
        reviewer: { id: ME.id, name: ME.name, role: ME.role },
        metadata: {
          mrn: note.patient.mrn,
          author: CLINICIANS[note.author]?.name || null,
          originalText: note.segments.map((s) => s.text).join('\n'),
          decisions: note.decisions,
          clinicianQueries: note.queries,
        },
      }),
    });
    const entry = await res.json();
    if (!res.ok) throw new Error(entry.error || 'Could not lock the record');
    const seal = { archiveId: entry.archiveId, hash: entry.contentHash, sealedAt: entry.sealedAt };
    update(id, (n) => ({ ...n, seal, audit: log(n, `Signed and locked as ${seal.archiveId}`) }));
    const corrections = note.segments.filter(s => ['fixed','edited'].includes(note.decisions[s.id]) && finalText(note,s) !== s.text).map(s => ({ id: `${entry.archiveId}-${s.id}`, patient: note.patient.name + ' · fictional demo', original: s.text, corrected: finalText(note,s), evidence: [...(s.evidence?.transcript || []).map(x => x.text), ...(s.evidence?.records || []).map(x => x.label + ': ' + x.value)].join(' / ') || 'No linked source supplied; requires separate review', reviewer: ME.name + ' · demo reviewer', pattern: s.pattern, archiveId: entry.archiveId }));
    updateLearning({...learning,cases:[...learning.cases,...corrections]});
    toast('Review saved. Corrections added to the library.');
    return seal;
  };

  const importUpload = async (upload) => {
    const note = noteFromUpload(upload);
    const { event } = await lockOriginalDraft({ docId: note.id, title: note.type, paragraphs: upload.paragraphs, fileName: upload.fileName, model: upload.model });
    note.audit.push({ at: new Date().toISOString(), who: 'ProofVault', text: event });
    setNotes((all) => [note, ...all]);
    setImportOpen(false);
    setTab('review');
    setView({ name: 'note', id: note.id });
    toast(`${upload.fileName} imported — ${upload.analysis.findings.length} issue(s) to check`);
  };

  const open = (id) => {
    setView({ name: 'note', id });
    window.scrollTo?.(0, 0);
  };
  const current = view.name === 'note' ? notes.find((n) => n.id === view.id) : null;
  const toReview = notes.filter((n) => ['review', 'ready'].includes(statusOf(n))).length;
  const NAV = [
    { key: 'learning', label: 'Complete workflow', icon: ShieldCheck },
    { key: 'worklist', label: 'Worklist', icon: Inbox, badge: toReview },
    { key: 'locked', label: 'Evidence archive', icon: ShieldCheck },
  ];
  const activeNav = view.name === 'learning' ? 'learning' : ['locked', 'receive'].includes(view.name) ? 'locked' : 'worklist';

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Vee size={40} />
          <div>
            <div className="text-[17px] font-bold leading-none tracking-tight">ProofVault</div>
            <div className="mt-1 text-[11px] text-slate-500">for Health</div>
          </div>
        </div>
        <div className="mx-4 rounded-xl bg-slate-100 px-3 py-2 text-xs">
          <div className="font-semibold">{ME.org}</div>
          <div className="text-slate-500">{ME.unit}</div>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {NAV.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setView({ name: key })}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${activeNav === key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" /> <span className="flex-1 text-left">{label}</span>
              {badge > 0 && <span className={`rounded-full px-1.5 text-[11px] ${activeNav === key ? 'bg-brand-yellow text-slate-950' : 'bg-slate-200'}`}>{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <button onClick={() => setImportOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow py-2.5 text-sm font-bold text-slate-950 shadow-[0_3px_0_#d5b800]">
            <Plus className="h-4 w-4" /> Import AI note
          </button>
          <div className="mt-4 flex items-center gap-2.5 border-t border-slate-200 pt-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">{ME.initials}</span>
            <div className="min-w-0 text-xs">
              <div className="truncate font-semibold">{ME.name}</div>
              <div className="truncate text-slate-500">{ME.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <Vee size={32} />
            {NAV.map(({ key, label }) => (
              <button key={key} onClick={() => setView({ name: key })} className={`rounded-lg px-2 py-1 text-xs font-semibold ${activeNav === key ? 'bg-slate-950 text-white' : 'text-slate-600'}`}>
                {label.split(' ')[0]}
              </button>
            ))}
          </div>
          <label className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (view.name !== 'worklist') setView({ name: 'worklist' });
              }}
              placeholder="Search patient or MRN"
              className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-950 focus:bg-white"
            />
          </label>
          <div className="relative ml-auto">
            <button onClick={() => setBellOpen(!bellOpen)} className="relative rounded-xl p-2 hover:bg-slate-100" title="Notifications">
              <Bell className="h-5 w-5" />
              {alerts.length > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600" />}
            </button>
            {bellOpen && (
              <div className="animate-pop absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Replies from clinicians</div>
                {alerts.length ? (
                  alerts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setBellOpen(false);
                        setAlerts((all) => all.filter((x) => x.id !== a.id));
                        open(a.noteId);
                      }}
                      className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                    >
                      {a.text}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-4 text-sm text-slate-500">No new replies.</p>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setImportOpen(true)} className="rounded-xl bg-brand-yellow p-2 md:hidden" title="Import AI note">
            <Plus className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1">
          {view.name === 'learning' && <Workflow note={notes.find(n => n.id === 'note-4092')} data={learning} onChange={updateLearning} onAsk={(sid,q)=>ask('note-4092',sid,q)} onApply={(sid)=>applyAnswer('note-4092',sid)} onLock={()=>lock('note-4092')} />}
          {view.name === 'worklist' && <Worklist notes={notes} tab={tab} setTab={setTab} query={query} onOpen={open} />}
          {view.name === 'locked' && <Locked onReceive={(id) => { setView({ name: 'receive', id }); window.scrollTo?.(0, 0); }} />}
          {view.name === 'receive' && <Receive key={view.id} archiveId={view.id} onBack={() => setView({ name: 'locked' })} />}
          {current && (
            <NoteReview
              key={current.id}
              note={current}
              onBack={() => setView({ name: 'worklist' })}
              onDecide={(segId, d, text) => decide(current.id, segId, d, text)}
              onUndo={(segId) => undo(current.id, segId)}
              onAsk={(segId, q) => ask(current.id, segId, q)}
              onApplyAnswer={(segId) => applyAnswer(current.id, segId)}
              onTrace={(seg) => setMap({ claim: seg.text, lens: 'healthcare', nonce: Date.now() })}
              onLock={() => lock(current.id)}
              onSaved={() => setView({name:'learning'})}
            />
          )}
        </main>
      </div>

      {importOpen && <IngestModal fileOnly onClose={() => setImportOpen(false)} onIngest={() => setImportOpen(false)} onIngestUpload={importUpload} />}
      {map && <ProvenanceMapOverlay incoming={map} onClose={() => setMap(null)} lenses={['healthcare']} />}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="animate-pop flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-lg">
            {t.mood ? <Vee mood={t.mood} size={28} /> : <Info className="h-4 w-4" />}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
