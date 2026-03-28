import { useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { differenceInMonths } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnTrackScoreCard, OnTrackScoreEmpty } from "@/components/retirement/OnTrackScoreCard";
import { RetirementChart } from "@/components/retirement/RetirementChart";
import { SummaryMetrics } from "@/components/retirement/SummaryMetrics";
import { YearlyDetailsTable } from "@/components/retirement/YearlyDetailsTable";
import { usePortfolioTimeSeries } from "@/hooks/use-portfolio-time-series";
import { loadActivePlan } from "@/lib/retirement-plan-storage";
import {
  runSimulation,
  type SimulationInput,
} from "@/lib/retirement-simulation";
import {
  computeProgressScore,
  computeConsistencyScore,
  computeMomentumScore,
  computeOnTrackScore,
  getScoreBand,
  getScoreTrend,
  getScoreRecommendation,
} from "@/lib/on-track-score";
import { addScorePoint, loadScoreHistory } from "@/lib/on-track-score-history";

const fmt = (v: number) => `฿${Math.max(0, Math.round(v)).toLocaleString("th-TH")}`;

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

export default function MyPlan() {
  const activePlan = useMemo(() => loadActivePlan(), []);

  if (!activePlan) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Retirement Plan</h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            No active plan yet. Go to Retirement Planner to create and confirm your plan.
          </p>
          <Button asChild className="mt-6">
            <Link to="/retirement-planner">Go to Planner</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const input = normalizeInput(activePlan.input);
  const savedDate = new Date(activePlan.savedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AppLayout>
      <MyPlanContent input={input} savedDate={savedDate} />
    </AppLayout>
  );
}

function MyPlanContent({ input, savedDate }: { input: SimulationInput; savedDate: string }) {
  const previousScoreRef = useRef<number | null>(null);
  const { data: portfolioTimeSeries } = usePortfolioTimeSeries("SINCE_START");

  const result = useMemo(() => runSimulation(input), [input]);

  const actualByAge = useMemo(() => {
    if (!portfolioTimeSeries?.length) return undefined;
    const currentAge = new Date().getFullYear() - input.birthYear;
    const byYear = new Map<number, number>();
    for (const snap of portfolioTimeSeries) {
      const year = parseInt(snap.snapshot_date.slice(0, 4));
      const age = year - input.birthYear;
      if (age > currentAge || age < 0) continue;
      byYear.set(age, snap.total_value);
    }
    return byYear.size > 0 ? byYear : undefined;
  }, [portfolioTimeSeries, input.birthYear]);

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

  // Record score to history (active plan)
  useEffect(() => {
    if (scoreData?.score != null) {
      addScorePoint(Math.round(scoreData.score));
    }
  }, [scoreData?.score]);

  const scoreHistory = useMemo(() => loadScoreHistory(), [scoreData?.score]);
  console.log("Score history:", scoreHistory);

  const scoreCard = scoreData ? (
    <OnTrackScoreCard
      score={scoreData.score}
      band={scoreData.band}
      recommendation={scoreData.recommendation}
      subtitle="Based on your active plan"
      history={scoreHistory}
    />
  ) : portfolioTimeSeries?.length ? null : (
    <OnTrackScoreEmpty />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Retirement Plan</h1>
            <Badge className="bg-green-600/15 text-green-700 border-green-600/30 hover:bg-green-600/20">
              Active Plan
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: {savedDate}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            This page shows your confirmed plan. To make changes, edit your draft in Retirement Planner.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/retirement-planner">Edit in Planner</Link>
        </Button>
      </div>

      {/* Score */}
      {scoreCard}

      {/* Chart */}
      <RetirementChart
        baseResult={result}
        retirementAge={input.retirementAge}
        targetAge={input.targetAge}
        comparisonMode={false}
        onToggleComparison={() => {}}
        annualReturn={input.annualReturn}
        returnMode={input.returnMode}
        actualByAge={actualByAge}
        hideComparisonToggle
      />

      {/* Summary Metrics */}
      <SummaryMetrics
        result={result}
        inflationRate={input.inflationRate}
        applyInflation={input.applyInflationToRetirementSpending}
        spendingMode={input.spendingMode}
        withdrawalRate={input.withdrawalRate}
      />

      {/* Read-only Assumptions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Assumptions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <ReadOnlyField label="Birth Year" value={String(input.birthYear)} />
          <ReadOnlyField label="Retirement Age" value={String(input.retirementAge)} />
          <ReadOnlyField label="Target Age" value={String(input.targetAge)} />
        </CardContent>
      </Card>

      {/* Read-only Savings Plan */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Savings Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {input.savingsRanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No savings ranges configured.</p>
          ) : (
            <div className="space-y-2">
              {input.savingsRanges.map((range, i) => (
                <div key={i} className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Age {range.startAge}–{range.endAge}</span>
                  <span className="font-medium text-foreground">{fmt(range.monthlySavings)}/mo</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Read-only Return Assumption */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Return Assumption</CardTitle>
        </CardHeader>
        <CardContent>
          {input.returnMode === "fixed" ? (
            <p className="text-sm text-foreground">Fixed return: {input.annualReturn}% per year</p>
          ) : input.returnMode === "age-based" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">Age-based returns:</p>
              {input.returnRanges.map((range, i) => (
                <div key={i} className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Age {range.startAge}–{range.endAge}</span>
                  <span className="font-medium text-foreground">{range.annualReturn}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Portfolio-based returns</p>
          )}
        </CardContent>
      </Card>

      {/* Read-only Spending Strategy */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Spending Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {input.spendingMode === "manual" ? (
            <p className="text-sm text-foreground">Monthly spending: {fmt(input.retirementMonthlySpending)}</p>
          ) : (
            <p className="text-sm text-foreground">Withdrawal rate: {input.withdrawalRate}% per year</p>
          )}
          <p className="text-sm text-muted-foreground">
            Inflation: {input.inflationRate}%{input.applyInflationToRetirementSpending ? " (applied to spending)" : " (not applied)"}
          </p>
        </CardContent>
      </Card>

      {/* Yearly Details */}
      <YearlyDetailsTable rows={result.rows} />

      <p className="text-center text-xs text-muted-foreground">
        This is based on assumptions and does not guarantee actual investment results.
      </p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
