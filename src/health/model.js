// Review state for a clinical note: decisions per flagged paragraph, clinician queries and the final seal.
// decision: 'fixed' (suggestion accepted) | 'edited' (reviewer's own wording) | 'kept' (not an issue)
import { NOTES } from './notes.js';

export const RESOLVED = ['fixed', 'edited', 'kept'];

export function initialNotes() {
  return NOTES.map((n) => ({
    ...n,
    decisions: {},
    edits: {},
    queries: {},
    seal: null,
    audit: [{ at: n.receivedAt, who: 'AI scribe', text: `Draft received from ambient recording (${n.scribe.minutes} min)` }],
  }));
}

export const issuesOf = (note) => note.segments.filter((s) => s.flag);
export const isResolved = (note, segId) => RESOLVED.includes(note.decisions[segId]);
export const openIssues = (note) => issuesOf(note).filter((s) => !isResolved(note, s.id));
export const pendingQueries = (note) => Object.values(note.queries).filter((q) => !q.reply);

export function statusOf(note) {
  if (note.seal) return 'locked';
  if (pendingQueries(note).length) return 'query';
  if (!openIssues(note).length) return 'ready';
  return 'review';
}

export const STATUS = {
  review: { label: 'To review', cls: 'bg-amber-100 text-amber-800' },
  query: { label: 'Waiting on clinician', cls: 'bg-sky-100 text-sky-800' },
  ready: { label: 'Ready to save', cls: 'bg-cyan-100 text-cyan-800' },
  locked: { label: 'Saved', cls: 'bg-slate-200 text-slate-700' },
};

export function finalText(note, seg) {
  const d = note.decisions[seg.id];
  if (d === 'fixed') return seg.revised;
  if (d === 'edited') return note.edits[seg.id];
  return seg.text;
}

export const noteText = (note) => note.segments.map((s) => finalText(note, s)).join('\n');

// Highest severity among unresolved issues, for sorting and the risk dot.
const SEV = { Critical: 3, High: 2, Medium: 1, Low: 0 };
export function riskOf(note) {
  const open = openIssues(note);
  if (!open.length) return null;
  return open.reduce((a, s) => (SEV[s.flag.severity] > SEV[a] ? s.flag.severity : a), 'Low');
}
export const riskRank = (note) => (riskOf(note) ? SEV[riskOf(note)] + 1 : 0);

export function age(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export function relTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

// "Due in 3 h" / "Overdue 1 h" relative to the review SLA.
export function dueLabel(iso) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const h = Math.max(1, Math.round(Math.abs(mins) / 60));
  return mins < 0 ? { text: `Overdue ${h} h`, overdue: true } : { text: `Due in ${h} h`, overdue: false };
}
