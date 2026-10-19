import { useState } from 'react';
export default function RecordJourney({ notes, onReview, onLocked, onReceive }) {
  const [step, setStep] = useState(0);
  const ann = notes.find(n => /Ann Lee/i.test(n.patient.name)) || notes[0];
  const scenes = [
    { title: 'First, correct the note.', kicker: '01 · WHEN IT IS WRITTEN', text: 'In this fictional case, Ann’s AI draft says 500 mg. The sample consultation transcript says 50 mg. A clinician must resolve the discrepancy before the note is confirmed.', left: 'AI draft', value: '500 mg', right: 'Sample evidence', other: '50 mg', action: 'Open Ann’s review', run: () => onReview(ann.id) },
    { title: 'Keep the version that was confirmed.', kicker: '02 · WHEN IT IS SAVED', text: 'In the demo, the clinician confirms 50 mg. Amy, the health information manager, signs the reviewed note together with its attached draft, decisions and clinician replies. Later edits require a new signed version.', left: 'Preserved together', value: 'Reviewed note', right: 'Attached evidence', other: 'Changes + replies', action: 'Open signed records', run: onLocked },
    { title: 'Let the next person check their copy.', kicker: '03 · WHEN IT IS USED', text: 'Three months later in our story, Ann is referred to cardiology. The receiving clinician checks the signed version, recorded reviewer and signing time. Change a detail in a temporary copy and check again. The saved original stays intact.', left: 'Unchanged copy', value: 'Matches', right: 'Edited copy', other: 'Does not match', action: ann?.seal ? 'Verify Ann’s signed copy' : 'Choose a signed record to verify', run: () => ann?.seal ? onReceive(ann.seal.archiveId) : onLocked },
  ];
  const s = scenes[step];
  return <div className="mx-auto max-w-5xl px-5 py-10 sm:px-10">
    <p className="pv-kicker text-slate-500">ProofVault · Review → preserve → verify</p>
    <div className="mt-7 grid grid-cols-3 gap-2">{['Check the draft', 'Seal the version', 'Verify the copy'].map((label,i)=><button key={label} onClick={()=>setStep(i)} aria-current={step===i?'step':undefined} className={`rounded-xl border px-3 py-4 text-sm font-bold sm:text-base ${step===i?'bg-slate-950 text-white':'bg-white text-slate-600'}`}>{i+1}. {label}</button>)}</div>
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
      <p className="pv-kicker text-slate-500">{s.kicker}</p><h1 className="pv-display mt-4 text-4xl sm:text-5xl">{s.title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{s.text}</p>
      <div className="my-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-slate-100 p-6"><p className="text-sm text-slate-600">{s.left}</p><p className="mt-3 text-3xl font-bold">{s.value}</p></div><div className="rounded-2xl bg-cyan-50 p-6"><p className="text-sm text-slate-600">{s.right}</p><p className="mt-3 text-3xl font-bold">{s.other}</p></div></div>
      <button onClick={s.run} className="w-full rounded-xl bg-slate-950 px-6 py-4 text-lg font-bold text-white">{s.action} →</button>
      {step<2 && <button onClick={()=>setStep(step+1)} className="mt-5 text-base font-semibold underline">Next: {step===0?'preserve the confirmed version':'check the received copy'} →</button>}
    </section>
    <details className="mt-6 rounded-2xl bg-white p-6"><summary className="cursor-pointer font-bold">Yves’s presentation · three sentences</summary><p className="mt-4 text-lg leading-loose">Finding the error is half the job.<br/>We preserve the reviewed version, together with its attached review history.<br/>The next person can check their copy — and detect if it has changed.</p></details>
    <p className="mt-5 text-sm leading-relaxed text-slate-500">Fictional patient, sample transcript and simulated clinician replies; no live audio transcription. The three-month hand-off is a story scenario, not an actual elapsed period. The app uses real demo signatures; reviewer identity is not independently authenticated. Verification checks the signed version, not clinical accuracy or whether it is the latest version. The comparison cards above explain the workflow; use the buttons to run the actual review and verification screens.</p>
  </div>;
}
