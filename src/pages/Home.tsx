import { useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { differenceInMonths } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MiniScoreHistory } from "@/components/retirement/MiniScoreHistory";
import { ScoreRing } from "@/components/home/ScoreRing";
import { ScoreDrivers } from "@/components/home/ScoreDrivers";
import { computeScoreDrivers, type ScoreDriver } from "@/lib/on-track-drivers";
import { usePortfolioTimeSeries } from "@/hooks/use-portfolio-time-series";
import { loadActivePlan } from "@/lib/retirement-plan-storage";
import { runSimulation, type SimulationInput } from "@/lib/retirement-simulation";
import {
  computeProgressScore,
  computeConsistencyScore,
  computeMomentumScore,
  computeOnTrackScore,
  getScoreBand,
  getScoreRecommendation,
  type ScoreBand,
} from "@/lib/on-track-score";
import { addScorePoint, loadScoreHistory, getWeeklyDelta } from "@/lib/on-track-score-history";
import { formatCurrency } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Pencil,
  Briefcase,
  Target,
  Lightbulb,
} from "lucide-react";

const DEFAULT_INPUT: SimulationInput = {
  birthYear: 1990,
  retirementAge: 60,
  targetAge: 90,
  annualReturn: 6,
  retirementMonthlySpending: 45000,
  inflationRate: 2,
  applyInflationToRetirementSpending: true,
  spendingMode: "manual",
  withdrawalRate: 4,
  savingsRanges: [],
  returnMode: "fixed",
  returnRanges: [],
};

function normalizeInput(raw: SimulationInput): SimulationInput {
  return { ...DEFAULT_INPUT, ...raw };
}


function getTargetContext(score: number, band: ScoreBand): string {
  if (band === "Getting Started") return "Building your score history";
  if (score >= 90) return "You're at the top — keep it up";
  if (score >= 75) return `${90 - score} points to Excellent`;
  if (score >= 60) return `${75 - score} points to Strong`;
  if (score >= 45) return `${60 - score} points to On Track`;
  return `${45 - score} points to Needs Attention`;
}

function getActionSuggestions(
  band: ScoreBand,
  input: SimulationInput,
  portfolioValue: number | null,
  projectedValue: number | null,
): string[] {
  const currentAge = new Date().getFullYear() - input.birthYear;
  const currentRange = input.savingsRanges.find(
    (r) => currentAge >= r.startAge && currentAge <= r.endAge
  );
  const plannedMonthly = currentRange?.monthlySavings ?? 0;

  switch (band) {
    case "Off Pace":
    case "Needs Attention": {
      const suggestions: string[] = [];
      if (projectedValue && portfolioValue && projectedValue > 0) {
        const gap = projectedValue - portfolioValue;
        if (gap > 0) {
          const monthlyGap = Math.round(gap / 12 / 1000) * 1000;
          if (monthlyGap > 0) suggestions.push(`Increase monthly savings by ~฿${monthlyGap.toLocaleString()}`);
        }
      }
      suggestions.push("Consider delaying retirement by 1–2 years");
      return suggestions.slice(0, 2);
    }
    case "On Track":
      return [`You're saving ฿${plannedMonthly.toLocaleString()}/month — stay consistent`];
    case "Strong":
    case "Excellent": {
      if (projectedValue && portfolioValue && portfolioValue > projectedValue) {
        const ahead = Math.round((portfolioValue - projectedValue) / 1000);
        return [`You're ฿${ahead.toLocaleString()}k ahead of plan. Consider reviewing risk allocation.`];
      }
      return ["You're ahead of plan. Consider reviewing your risk allocation."];
    }
    case "Getting Started":
      return [`Start with ฿${plannedMonthly.toLocaleString()}/month to build momentum`];
  }
}

export default function Home() {
  const activePlan = useMemo(() => loadActivePlan(), []);

  return (
    <AppLayout>
      {activePlan ? (
        <HomeWithPlan input={normalizeInput(activePlan.input)} />
      ) : (
        <HomeEmpty />
      )}
    </AppLayout>
  );
}

function HomeEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Target className="h-16 w-16 mb-6 text-muted-foreground/20" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Welcome to RMFPacer
      </h1>
      <p className="mt-3 text-muted-foreground max-w-sm">
        Create your retirement plan to unlock your On Track Score and start tracking your progress.
      </p>
      <Button asChild className="mt-6">
        <Link to="/retirement-planner">Create Your Retirement Plan</Link>
      </Button>
    </div>
  );
}

function HomeWithPlan({ input }: { input: SimulationInput }) {
  const previousScoreRef = useRef<number | null>(null);
  const { data: portfolioTimeSeries } = usePortfolioTimeSeries("SINCE_START");

  const result = useMemo(() => runSimulation(input), [input]);

  const monthsSinceStart = useMemo(() => {
    const firstDate = portfolioTimeSeries?.[0]?.snapshot_date ?? null;
    if (!firstDate) return 0;
    return differenceInMonths(new Date(), new Date(firstDate));
  }, [portfolioTimeSeries]);

  const scoreData = useMemo(() => {
    if (!portfolioTimeSeries?.length || !result?.rows?.length) return null;
    const currentAge = new Date().getFullYear() - input.birthYear;
    const latestSnap = portfolioTimeSeries[portfolioTimeSeries.length - 1];
    const actualValue = latestSnap.total_value;
    const closestRow = result.rows.find((r) => r.age === currentAge)
      ?? result.rows.reduce((closest, r) =>
        Math.abs(r.age - currentAge) < Math.abs(closest.age - currentAge) ? r : closest
      );
    const MAX_AGE_DIFF = 2;
    const projectedRow = Math.abs(closestRow.age - currentAge) > MAX_AGE_DIFF ? null : closestRow;
    const projectedValue = projectedRow?.endBalance ?? null;
    if (!projectedValue || projectedValue <= 0) return null;

    const progress = computeProgressScore(actualValue, projectedValue);
    const ratioNow = actualValue / projectedValue;

    const monthMap = new Map<string, number>();
    for (const snap of portfolioTimeSeries) {
      const monthKey = snap.snapshot_date.slice(0, 7);
      const flow = Math.max(snap.net_flow ?? 0, 0);
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + flow);
    }
    const sortedMonths = Array.from(monthMap.keys()).sort();
    const monthlyContribs = sortedMonths.map((m) => monthMap.get(m)!);

    const currentRange = input.savingsRanges.find(
      (r) => currentAge >= r.startAge && currentAge <= r.endAge
    );
    const plannedMonthly = currentRange?.monthlySavings ?? 0;
    const consistency = computeConsistencyScore(monthlyContribs, plannedMonthly, sortedMonths.length);

    let ratio6mAgo: number | null = null;
    if (portfolioTimeSeries.length > 1) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const targetDate = sixMonthsAgo.toISOString().slice(0, 10);
      let closest = portfolioTimeSeries[0];
      for (const snap of portfolioTimeSeries) {
        if (snap.snapshot_date <= targetDate) closest = snap;
        else break;
      }
      if (closest.snapshot_date !== latestSnap.snapshot_date) {
        const closestAge = parseInt(closest.snapshot_date.slice(0, 4)) - input.birthYear;
        const projRow6m = result.rows.find((r) => r.age === closestAge);
        if (projRow6m && projRow6m.endBalance > 0) {
          ratio6mAgo = closest.total_value / projRow6m.endBalance;
        }
      }
    }

    const momentum = computeMomentumScore(ratioNow, ratio6mAgo);
    const score = computeOnTrackScore({
      progress,
      consistency,
      momentum,
      previousScore: previousScoreRef.current,
      monthsSinceStart,
    });
    previousScoreRef.current = score;

    const drivers = computeScoreDrivers({
      monthlyContribs,
      plannedMonthly,
      actualValue,
      projectedValue,
      ratioNow,
      ratio6mAgo,
    });

    return {
      score,
      band: getScoreBand(score, monthsSinceStart),
      recommendation: getScoreRecommendation(score, monthsSinceStart),
      projectedValue,
      drivers,
    };
  }, [portfolioTimeSeries, result, input.birthYear, input.savingsRanges, monthsSinceStart]);

  useEffect(() => {
    if (scoreData?.score != null) {
      addScorePoint(Math.round(scoreData.score));
    }
  }, [scoreData?.score]);

  const scoreHistory = useMemo(() => loadScoreHistory(), [scoreData?.score]);
  const weeklyDelta = scoreHistory ? getWeeklyDelta(scoreHistory) : null;

  // Plan summary
  const retirementRow = result.rows.find((r) => r.age === input.retirementAge);
  const balanceAtRetirement = retirementRow?.endBalance ?? 0;

  // Portfolio
  const latestSnap = portfolioTimeSeries?.[portfolioTimeSeries.length - 1];
  const portfolioValue = latestSnap?.total_value ?? null;
  const portfolioReturn = latestSnap?.total_return_percent ?? null;

  return (
    <div className="space-y-6">
      {/* Score Hero */}
      <Card>
        <CardContent className="p-6">
          {scoreData ? (
            <div className="flex flex-col items-center space-y-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                On Track Score
              </p>
              <ScoreRing score={scoreData.score} band={scoreData.band} />
              <div className="flex items-center gap-1.5 text-base font-semibold">
                {weeklyDelta !== null ? (
                  <>
                    {weeklyDelta > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : weeklyDelta < 0 ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={weeklyDelta > 0 ? "text-green-500" : weeklyDelta < 0 ? "text-red-500" : "text-muted-foreground"}>
                      {weeklyDelta > 0 ? "+" : ""}{weeklyDelta} this week
                    </span>
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">No change this week</span>
                  </>
                )}
              </div>
              {scoreHistory && scoreHistory.length >= 1 && (
                <MiniScoreHistory history={scoreHistory} />
              )}
              {scoreData.drivers && <ScoreDrivers drivers={scoreData.drivers} />}
              <p className="text-sm text-muted-foreground text-center">{scoreData.recommendation}</p>
              <p className="text-xs text-muted-foreground/50 text-center">{getTargetContext(scoreData.score, scoreData.band)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                On Track Score
              </p>
              <p className="text-sm text-muted-foreground">
                Add portfolio data to see your On Track Score.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compact Snapshot Strip */}
      <div className="flex gap-8 border-t border-border pt-4 px-1">
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium text-muted-foreground">Portfolio Value</p>
          {portfolioValue !== null ? (
            <>
              <p className="text-base font-semibold text-foreground">
                {formatCurrency(portfolioValue)}
              </p>
              {portfolioReturn !== null && (
                <p className={`text-[11px] font-medium ${
                  portfolioReturn >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {portfolioReturn >= 0 ? "+" : ""}{portfolioReturn.toFixed(2)}%
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">No data yet</p>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium text-muted-foreground">Balance at Retirement</p>
          <p className="text-base font-semibold text-foreground">
            {formatCurrency(balanceAtRetirement)}
          </p>
          <p className="text-[11px] text-muted-foreground">At age {input.retirementAge}</p>
        </div>
      </div>

      {/* What to do next */}
      {scoreData && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">What to do next</p>
                {getActionSuggestions(scoreData.band, input, portfolioValue, scoreData.projectedValue).map((s, i) => (
                  <p key={i} className="text-sm text-foreground">{s}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/my-plan">
            <FileText className="h-4 w-4 mr-1.5" />
            View My Retirement Plan
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/retirement-planner">
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit Plan
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">
            <Briefcase className="h-4 w-4 mr-1.5" />
            View Portfolio
          </Link>
        </Button>
      </div>
    </div>
  );
}
