import { computeProgressScore, computeMomentumScore } from "@/lib/on-track-score";

export type ScoreDriver = {
  label: "Consistency" | "Progress" | "Momentum";
  value: number;
  trend: "up" | "down" | "flat";
  impact: "positive" | "negative" | "neutral";
};

function trendFromValue(value: number): Pick<ScoreDriver, "trend" | "impact"> {
  if (value >= 80) return { trend: "up", impact: "positive" };
  if (value >= 50) return { trend: "flat", impact: "neutral" };
  return { trend: "down", impact: "negative" };
}

const NEUTRAL_DRIVER = { trend: "flat" as const, impact: "neutral" as const };

export function computeConsistencyDriver(
  monthlyContribs: number[],
  plannedMonthly: number,
): ScoreDriver {
  if (plannedMonthly <= 0 || monthlyContribs.length === 0) {
    return { label: "Consistency", value: 50, ...NEUTRAL_DRIVER };
  }
  const lookback = Math.min(6, monthlyContribs.length);
  const recent = monthlyContribs.slice(-lookback);
  const total = recent.reduce((s, c) => s + Math.min(Math.max(c, 0) / plannedMonthly, 1), 0);
  const value = Math.round((total / recent.length) * 100);
  return { label: "Consistency", value, ...trendFromValue(value) };
}

export function computeProgressDriver(
  actual: number | null,
  projected: number | null,
): ScoreDriver {
  if (!actual || !projected || projected <= 0) {
    return { label: "Progress", value: 50, ...NEUTRAL_DRIVER };
  }
  const value = Math.round(computeProgressScore(actual, projected));
  return { label: "Progress", value, ...trendFromValue(value) };
}

export function computeMomentumDriver(
  ratioNow: number | null,
  ratio6mAgo: number | null,
): ScoreDriver {
  if (ratioNow == null) {
    return { label: "Momentum", value: 50, ...NEUTRAL_DRIVER };
  }
  const value = Math.round(computeMomentumScore(ratioNow, ratio6mAgo));
  return { label: "Momentum", value, ...trendFromValue(value) };
}

export interface ComputeDriversInput {
  monthlyContribs: number[];
  plannedMonthly: number;
  actualValue: number | null;
  projectedValue: number | null;
  ratioNow: number | null;
  ratio6mAgo: number | null;
}

export function computeScoreDrivers(input: ComputeDriversInput): ScoreDriver[] {
  return [
    computeConsistencyDriver(input.monthlyContribs, input.plannedMonthly),
    computeProgressDriver(input.actualValue, input.projectedValue),
    computeMomentumDriver(input.ratioNow, input.ratio6mAgo),
  ];
}
