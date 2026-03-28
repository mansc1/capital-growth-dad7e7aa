// On Track Score Engine for RMFPacer
// Fitness-style scoring: Progress (55%), Consistency (25%), Momentum (20%)

const PROGRESS_TABLE: [number, number][] = [
  [0, 0],
  [0.5, 30],
  [0.7, 50],
  [0.85, 68],
  [1.0, 80],
  [1.1, 88],
  [1.25, 96],
  [1.35, 100],
];

function lerp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

export function computeProgressScore(actual: number, projected: number): number {
  if (projected <= 0) return 0;
  const ratio = actual / projected;
  return lerp(PROGRESS_TABLE, ratio);
}

export function computeConsistencyScore(
  monthlyContributions: number[],
  plannedMonthly: number,
  monthsSinceStart: number,
): number {
  if (plannedMonthly <= 0) return 100;
  if (monthsSinceStart <= 0 || monthlyContributions.length === 0) return 0;

  const lookback = Math.min(12, monthsSinceStart);
  const recent = monthlyContributions.slice(-lookback);
  if (recent.length === 0) return 0;

  const totalCompletion = recent.reduce((sum, c) => {
    const clamped = Math.max(c, 0); // ignore negative flows
    return sum + Math.min(clamped / plannedMonthly, 1);
  }, 0);

  return (totalCompletion / recent.length) * 100;
}

export function computeMomentumScore(ratioNow: number, ratio6mAgo: number | null): number {
  if (ratio6mAgo === null || ratio6mAgo <= 0) return 70; // neutral default

  const change = ratioNow - ratio6mAgo;

  // Bounded scoring: map change to 50-85 range
  if (change >= 0.15) return 85;
  if (change >= 0.05) return 78;
  if (change >= -0.02) return 70;
  if (change >= -0.10) return 60;
  return 50;
}

export interface OnTrackScoreInput {
  progress: number;
  consistency: number;
  momentum: number;
  previousScore?: number | null;
}

export function computeOnTrackScore({
  progress,
  consistency,
  momentum,
  previousScore,
}: OnTrackScoreInput): number {
  const raw = Math.min(100, Math.max(0,
    0.55 * progress + 0.25 * consistency + 0.20 * momentum,
  ));

  if (previousScore == null) return Math.round(raw);

  const alpha = raw > previousScore ? 0.18 : 0.28;
  const smoothed = previousScore + alpha * (raw - previousScore);
  return Math.round(Math.min(100, Math.max(0, smoothed)));
}

export type ScoreBand = "Excellent" | "Strong" | "On Track" | "Needs Attention" | "Off Pace";

export function getScoreBand(score: number): ScoreBand {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "On Track";
  if (score >= 45) return "Needs Attention";
  return "Off Pace";
}

export type ScoreTrend = "improving" | "stable" | "declining";

export function getScoreTrend(score: number, previousScore: number | null): ScoreTrend {
  if (previousScore == null) return "stable";
  const diff = score - previousScore;
  if (diff > 2) return "improving";
  if (diff < -2) return "declining";
  return "stable";
}

export function getScoreRecommendation(score: number): string {
  if (score >= 90) {
    return "You are ahead of plan. You may consider reducing risk or reviewing your goals.";
  }
  if (score >= 75) {
    return "You are on track. Keep your current pace and stay consistent.";
  }
  if (score >= 45) {
    return "You are close to your plan. Staying consistent will improve your outlook.";
  }
  return "You may need to increase your monthly savings or adjust your retirement plan.";
}
