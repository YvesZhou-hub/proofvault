export const RULE_ID = 'dose-source-match/v1';
// Narrow, deterministic comparison of explicitly entered dose fields. Not prescribing advice.
export function compareDose(note, source, enabled) {
  if (!enabled) return { status: 'blocked', message: 'Approve the rule before running a check.' };
  const parse = s => {
    const m = String(s).trim().match(/^(\d+(?:\.\d+)?)\s*(mg|g|mcg)$/i);
    return m && Number(m[1]) > 0 ? { value: Number(m[1]), unit: m[2].toLowerCase() } : null;
  };
  const a = parse(note), b = parse(source);
  if (!a || !b) return { status: 'unknown', message: 'Enter one positive dose and unit on each side, such as 100 mg. Missing or ambiguous evidence needs review.' };
  if (a.unit !== b.unit) return { status: 'unknown', message: 'Units differ. This demo does not convert units; request human review.' };
  return a.value === b.value
    ? { status: 'match', message: 'The entered doses match. This does not establish clinical correctness.' }
    : { status: 'flag', message: 'Dose mismatch. Review the source with a clinician; do not automatically change the dose.' };
}
