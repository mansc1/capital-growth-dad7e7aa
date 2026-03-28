import { useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { differenceInMonths } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MiniScoreHistory } from "@/components/retirement/MiniScoreHistory";
import { usePortfolioTimeSeries } from "@/hooks/use-portfolio-time-series";
import { loadActivePlan } from "@/lib/retirement-plan-storage";
import { runSimulation, type SimulationInput } from "@/lib/retirement-simulation";
import {
  computeProgressScore,
  computeConsistencyScore,
  computeMomentumScore,
  computeOnTrackScore,
  getScoreBand,
  getScoreTrend,
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

const bandColors: Record<ScoreBand, string> = {
  Excellent: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  Strong: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  "On Track": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  "Needs Attention": "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "Off Pace": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "Getting Started": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

function getTargetContext(score: number, band: ScoreBand): string {
  if (band === "Getting Started") return "Building your score history";
  if (score >= 90) return "You're at the top — keep it up";
  if (score >= 75) return `${90 - score} points to Excellent`;
  if (score >= 60) return `${75 - score} points to Strong`;
  if (score >= 45) return `${60 - score} points to On Track`;
  return `${45 - score} points to Needs Attention`;
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
    if (!portfolioTimeSeries?.length || !result) return null;
    const currentAge = new Date().getFullYear() - input.birthYear;
    const latestSnap = portfolioTimeSeries[portfolioTimeSeries.length - 1];
    const actualValue = latestSnap.total_value;
    const projectedRow = result.rows.find((r) => r.age === currentAge);
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

    return {
      score,
      band: getScoreBand(score, monthsSinceStart),
      trend: getScoreTrend(score, previousScoreRef.current),
      recommendation: getScoreRecommendation(score, monthsSinceStart),
    };
  }, [portfolioTimeSeries, result, input.birthYear, input.savingsRanges, monthsSinceStart]);

  // Record score (same rule as My Plan — active plan only)
  useEffect(() => {
    if (scoreData?.score != null) {
      addScorePoint(Math.round(scoreData.score));
    }
  }, [scoreData?.score]);

  const scoreHistory = useMemo(() => loadScoreHistory(), [scoreData?.score]);
  const weeklyDelta = scoreHistory ? getWeeklyDelta(scoreHistory) : null;

  // Plan summary values
  const retirementRow = result.rows.find((r) => r.age === input.retirementAge);
  const balanceAtRetirement = retirementRow?.endBalance ?? 0;
  const runsOutRow = result.rows.find((r) => r.endBalance <= 0 && r.age > input.retirementAge);
  const runsOutAge = runsOutRow?.age ?? null;

  // Portfolio mini card
  const latestSnap = portfolioTimeSeries?.[portfolioTimeSeries.length - 1];
  const portfolioValue = latestSnap?.total_value ?? null;
  const portfolioReturn = latestSnap?.total_return_percent ?? null;

  return (
    <div className="space-y-6">
      {/* Score Hero */}
      <Card>
        <CardContent className="p-6">
          {scoreData ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                On Track Score
              </p>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold text-foreground">{scoreData.score}</span>
                  <Badge variant="outline" className={bandColors[scoreData.band]}>
                    {scoreData.band}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground pt-2">
                  {weeklyDelta !== null ? (
                    <>
                      {weeklyDelta > 0 ? (
                        <TrendingUp className="h-4 w-4 text-primary" />
                      ) : weeklyDelta < 0 ? (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      <span className={weeklyDelta > 0 ? "text-primary" : weeklyDelta < 0 ? "text-destructive" : ""}>
                        {weeklyDelta > 0 ? "+" : ""}{weeklyDelta} this week
                      </span>
                    </>
                  ) : (
                    <>
                      <Minus className="h-4 w-4" />
                      <span>No change this week</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{scoreData.recommendation}</p>
              <p className="text-xs text-muted-foreground/50">{getTargetContext(scoreData.score, scoreData.band)}</p>
              {scoreHistory && scoreHistory.length >= 1 && (
                <MiniScoreHistory history={scoreHistory} />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                On Track Score
              </p>
              <p className="text-sm text-muted-foreground">
                Add portfolio data to see your On Track Score.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Balance at Retirement</p>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(balanceAtRetirement)}
            </p>
            <p className="text-xs text-muted-foreground">At age {input.retirementAge}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Money Runs Out</p>
            <p className="text-xl font-bold text-foreground">
              {runsOutAge ? `Age ${runsOutAge}` : "Never (within plan)"}
            </p>
            <p className="text-xs text-muted-foreground">
              {runsOutAge
                ? `${runsOutAge - input.retirementAge} years after retirement`
                : `Lasts past age ${input.targetAge}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link to="/my-plan">
            <FileText className="h-4 w-4 mr-1.5" />
            View My Plan
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/retirement-planner">
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit Plan
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/dashboard">
            <Briefcase className="h-4 w-4 mr-1.5" />
            View Portfolio
          </Link>
        </Button>
      </div>

      {/* Portfolio Mini Card */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Portfolio</p>
          {portfolioValue !== null ? (
            <div className="flex items-baseline gap-4">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(portfolioValue)}
              </span>
              {portfolioReturn !== null && (
                <span
                  className={`text-sm font-medium ${
                    portfolioReturn >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {portfolioReturn >= 0 ? "+" : ""}
                  {portfolioReturn.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
