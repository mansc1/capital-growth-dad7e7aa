const STORAGE_KEY = "on_track_score_history";

export type ScoreHistoryPoint = {
  date: string; // YYYY-MM-DD
  score: number;
};

export type ScoreHistory = ScoreHistoryPoint[];

export function loadScoreHistory(): ScoreHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as ScoreHistoryPoint).date === "string" &&
        typeof (p as ScoreHistoryPoint).score === "number"
    );
  } catch {
    return [];
  }
}

export function saveScoreHistory(history: ScoreHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // silently fail
  }
}

export function addScorePoint(score: number): void {
  const today = new Date().toISOString().slice(0, 10);
  const history = loadScoreHistory();
  const idx = history.findIndex((p) => p.date === today);
  if (idx >= 0) {
    history[idx].score = score;
  } else {
    history.push({ date: today, score });
  }
  // Sort ascending by date
  history.sort((a, b) => a.date.localeCompare(b.date));
  // Keep max 28 days
  const trimmed = history.slice(-28);
  saveScoreHistory(trimmed);
}

export function getWeeklyDelta(history: ScoreHistory): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const latestDate = new Date(latest.date);
  const targetDate = new Date(latestDate);
  targetDate.setDate(targetDate.getDate() - 7);

  // Find closest point to ~7 days ago
  let closest: ScoreHistoryPoint | null = null;
  let closestDiff = Infinity;
  for (const p of sorted) {
    if (p.date === latest.date) continue;
    const diff = Math.abs(new Date(p.date).getTime() - targetDate.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = p;
    }
  }
  if (!closest) return null;
  return latest.score - closest.score;
}
