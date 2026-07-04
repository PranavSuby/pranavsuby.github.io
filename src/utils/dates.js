// Shared local-date helpers used by both apps.
//
// We key diary entries / biometrics / sessions by a local "YYYY-MM-DD" string.
// `toLocaleDateString('sv-SE')` is the simplest way to get an ISO-style local
// date (no UTC shift), so it's the single canonical formatter here.

// A Date -> "YYYY-MM-DD" in the user's local timezone.
export function toDateStr(d = new Date()) {
  return d.toLocaleDateString('sv-SE');
}

// Today as "YYYY-MM-DD" (local).
export function todayStr() {
  return toDateStr(new Date());
}

// "YYYY-MM-DD" -> Date at local midnight (avoids the UTC parsing of `new Date(s)`).
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Day before / after a "YYYY-MM-DD" string, returned as a string.
export function prevDay(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

export function nextDay(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

// "YYYY-MM-DD" for `days` ago from today.
export function daysAgoStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateStr(d);
}
