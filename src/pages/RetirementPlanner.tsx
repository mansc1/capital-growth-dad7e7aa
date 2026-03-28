import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInMonths } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { usePortfolioTimeSeries } from "@/hooks/use-portfolio-time-series";
import { AssumptionsPanel } from "@/components/retirement/AssumptionsPanel";
import { SavingsPlanEditor } from "@/components/retirement/SavingsPlanEditor";
import { ReturnAssumptionEditor } from "@/components/retirement/ReturnAssumptionEditor";
import { SpendingStrategyCard } from "@/components/retirement/SpendingStrategyCard";
import { RetirementChart } from "@/components/retirement/RetirementChart";
import type { ComparisonScenario } from "@/components/retirement/RetirementChart";
import { SummaryMetrics } from "@/components/retirement/SummaryMetrics";
import { YearlyDetailsTable } from "@/components/retirement/YearlyDetailsTable";
import { MiniProjectionPanel } from "@/components/retirement/MiniProjectionPanel";
import { ProjectionSheet } from "@/components/retirement/ProjectionSheet";
import { OnTrackScoreCard, OnTrackScoreEmpty } from "@/components/retirement/OnTrackScoreCard";
import { RETURN_PRESETS } from "@/lib/retirement-presets";
import { loadPersistedState, savePersistedState } from "@/lib/retirement-storage";
import {
  loadActivePlan,
  saveActivePlan,
  loadPlanHistory,
  pushPlanToHistory,
  createPlan,
  type SavedRetirementPlan,
} from "@/lib/retirement-plan-storage";
import { PlanStatusCard } from "@/components/retirement/PlanStatusCard";
import { useToast } from "@/hooks/use-toast";
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
import {
  runSimulation,
  validateInputs,
  hasErrors,
  type SimulationInput,
  type SavingsRange,
  type ReturnRange,
  type ReturnMode,
  type SpendingMode,
} from "@/lib/retirement-simulation";

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
  savingsRanges: [
    { startAge: 30, endAge: 39, monthlySavings: 5000 },
    { startAge: 40, endAge: 49, monthlySavings: 8000 },
    { startAge: 50, endAge: 59, monthlySavings: 12000 },
  ],
  returnMode: "fixed",
  returnRanges: [],
};

export default function RetirementPlanner() {
  const [input, setInput] = useState<SimulationInput>(() => {
    const saved = loadPersistedState();
    return saved ? saved.input : DEFAULT_INPUT;
  });
  const [comparisonMode, setComparisonMode] = useState(() => {
    const saved = loadPersistedState();
    return saved ? saved.comparisonMode : false;
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activePlan, setActivePlan] = useState<SavedRetirementPlan | null>(loadActivePlan);
  const [planHistory, setPlanHistory] = useState<SavedRetirementPlan[]>(loadPlanHistory);
  const { toast } = useToast();

  const navigate = useNavigate();

  const isDraftMatchingActive = useMemo(() => {
    if (!activePlan) return false;
    return JSON.stringify(input) === JSON.stringify(activePlan.input);
  }, [input, activePlan]);

  const handleConfirmPlan = () => {
    const plan = createPlan(input);
    saveActivePlan(plan);
    pushPlanToHistory(plan);
    setActivePlan(plan);
    setPlanHistory(loadPlanHistory());
    toast({
      title: "Active plan updated",
      description: "Your plan is now set.",
      action: (
        <Button variant="outline" size="sm" onClick={() => navigate("/my-plan")}>
          View My Plan
        </Button>
      ),
    });
  };

  const handleLoadPlan = (plan: SavedRetirementPlan) => {
    setInput(plan.input);
    toast({ title: "Plan loaded", description: "Restored as draft. Click 'Set as My Plan' to confirm." });
  };

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePersistedState(input, comparisonMode), 500);
    return () => clearTimeout(saveTimer.current);
  }, [input, comparisonMode]);
  const isMobile = useIsMobile();

  const handleFieldChange = (field: keyof SimulationInput, value: number) => {
    setInput((prev) => ({ ...prev, [field]: value }));
  };

  const handleRangesChange = (ranges: SavingsRange[]) => {
    setInput((prev) => ({ ...prev, savingsRanges: ranges }));
  };

  const handleReturnModeChange = (mode: ReturnMode) => {
    setInput((prev) => ({ ...prev, returnMode: mode }));
  };

  const handleReturnRangesChange = (ranges: ReturnRange[]) => {
    setInput((prev) => ({ ...prev, returnRanges: ranges }));
  };

  const handleAnnualReturnChange = (value: number) => {
    setInput((prev) => ({ ...prev, annualReturn: value }));
  };

  const handleSpendingModeChange = (mode: SpendingMode) => {
    setInput((prev) => ({ ...prev, spendingMode: mode }));
  };

  const { errors, warnings } = useMemo(() => validateInputs(input), [input]);
  const valid = !hasErrors(errors);

  const { data: portfolioTimeSeries } = usePortfolioTimeSeries('SINCE_START');

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

  const baseResult = useMemo(() => {
    if (!valid) return null;
    return runSimulation(input);
  }, [input, valid]);

  const comparisonResults = useMemo((): ComparisonScenario[] | undefined => {
    if (!valid || !comparisonMode) return undefined;

    if (input.returnMode === "age-based") {
      return Object.entries(RETURN_PRESETS).map(([presetKey, preset]) => ({
        key: presetKey,
        label: preset.label,
        result: runSimulation({ ...input, returnMode: "age-based", returnRanges: preset.ranges }),
      }));
    }

    const base = input.annualReturn;
    const rates = [Math.max(0, base - 1), base + 1];
    return rates.map((rate) => ({
      key: `fixed_${rate}`,
      label: `${rate}%`,
      result: runSimulation({ ...input, annualReturn: rate }),
    }));
  }, [input, valid, comparisonMode]);

  // --- On Track Score ---
  const previousScoreRef = useRef<number | null>(null);

  const monthsSinceStart = useMemo(() => {
    const firstDate = portfolioTimeSeries?.[0]?.snapshot_date ?? null;
    if (!firstDate) return 0;
    return differenceInMonths(new Date(), new Date(firstDate));
  }, [portfolioTimeSeries]);

  const scoreData = useMemo(() => {
    if (!portfolioTimeSeries?.length || !baseResult) return null;

    const currentAge = new Date().getFullYear() - input.birthYear;

    const latestSnap = portfolioTimeSeries[portfolioTimeSeries.length - 1];
    const actualValue = latestSnap.total_value;

    const projectedRow = baseResult.rows.find((r) => r.age === currentAge);
    const projectedValue = projectedRow?.endBalance ?? null;

    if (!projectedValue || projectedValue <= 0) return null;

    const progress = computeProgressScore(actualValue, projectedValue);
    const ratioNow = actualValue / projectedValue;

    const monthlyContribs: number[] = [];
    const monthMap = new Map<string, number>();
    for (const snap of portfolioTimeSeries) {
      const monthKey = snap.snapshot_date.slice(0, 7);
      const flow = Math.max(snap.net_flow ?? 0, 0);
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + flow);
    }
    const sortedMonths = Array.from(monthMap.keys()).sort();
    for (const m of sortedMonths) {
      monthlyContribs.push(monthMap.get(m)!);
    }

    const currentRange = input.savingsRanges.find(
      (r) => currentAge >= r.startAge && currentAge <= r.endAge
    );
    const plannedMonthly = currentRange?.monthlySavings ?? 0;

    const consistency = computeConsistencyScore(
      monthlyContribs,
      plannedMonthly,
      sortedMonths.length,
    );

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
        const projRow6m = baseResult.rows.find((r) => r.age === closestAge);
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
  }, [portfolioTimeSeries, baseResult, input.birthYear, input.savingsRanges, monthsSinceStart]);

  const chartProps = {
    baseResult: baseResult!,
    comparisonResults,
    retirementAge: input.retirementAge,
    targetAge: input.targetAge,
    comparisonMode,
    onToggleComparison: setComparisonMode,
    annualReturn: input.annualReturn,
    returnMode: input.returnMode,
    actualByAge,
  };

  const inputSections = (
    <>
      <PlanStatusCard
        input={input}
        activePlan={activePlan}
        history={planHistory}
        onConfirm={handleConfirmPlan}
        onLoadPlan={handleLoadPlan}
      />
      <div id="section-assumptions" className="scroll-mt-24">
        <AssumptionsPanel input={input} errors={errors} onChange={handleFieldChange} />
      </div>
      <div id="section-savings" className="scroll-mt-24">
        <SavingsPlanEditor ranges={input.savingsRanges} errors={errors} onUpdate={handleRangesChange} />
      </div>
      <div id="section-returns" className="scroll-mt-24">
        <ReturnAssumptionEditor
          input={input}
          errors={errors}
          warnings={warnings}
          onModeChange={handleReturnModeChange}
          onAnnualReturnChange={handleAnnualReturnChange}
          onReturnRangesChange={handleReturnRangesChange}
        />
      </div>
      <div id="section-spending" className="scroll-mt-24">
        <SpendingStrategyCard
          input={input}
          errors={errors}
          balanceAtRetirement={baseResult?.balanceAtRetirement ?? null}
          onChange={handleFieldChange}
          onSpendingModeChange={handleSpendingModeChange}
          onToggleInflation={(v) => setInput((prev) => ({ ...prev, applyInflationToRetirementSpending: v }))}
        />
      </div>
      {baseResult && <YearlyDetailsTable rows={baseResult.rows} />}
    </>
  );

  // Record score to history (active plan only — skip if draft differs)
  useEffect(() => {
    if (scoreData?.score != null && isDraftMatchingActive) {
      addScorePoint(Math.round(scoreData.score));
    }
  }, [scoreData?.score, isDraftMatchingActive]);

  const scoreHistory = useMemo(() => loadScoreHistory(), [scoreData?.score]);
  console.log("Score history:", scoreHistory);

  const scoreCard = scoreData ? (
    <OnTrackScoreCard
      score={scoreData.score}
      band={scoreData.band}
      recommendation={scoreData.recommendation}
      subtitle="Based on your draft plan"
      history={scoreHistory}
    />
  ) : portfolioTimeSeries?.length ? null : (
    <OnTrackScoreEmpty />
  );

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Retirement Simulation</h1>
        <p className="mt-1 text-muted-foreground">
          Plan your retirement journey. Estimate how your savings grow and how long they last.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">Your inputs are saved automatically on this device.</p>
      </div>

      {/* Draft vs Active status */}
      {isDraftMatchingActive ? (
        <Alert className="mb-6 bg-green-500/5 border-green-500/20">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-700 dark:text-green-300">Using your active plan</AlertDescription>
        </Alert>
      ) : activePlan ? (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            You're editing a draft plan. Your active plan will not change until you click "Set as My Plan".
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-6">
          <Sparkles className="h-4 w-4" />
          <AlertDescription>You're creating your first plan</AlertDescription>
        </Alert>
      )}

      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
        <div className="space-y-6 lg:col-span-7">{inputSections}</div>

        {baseResult && (
          <div className="lg:col-span-5">
            <div className="sticky top-8 space-y-4">
              {scoreCard}
              <RetirementChart {...chartProps} />
              <SummaryMetrics
                result={baseResult}
                inflationRate={input.inflationRate}
                applyInflation={input.applyInflationToRetirementSpending}
                spendingMode={input.spendingMode}
                withdrawalRate={input.withdrawalRate}
              />
            </div>
          </div>
        )}
      </div>

      <div className="lg:hidden">
        {baseResult && !sheetOpen && (
          <MiniProjectionPanel result={baseResult} onClick={() => setSheetOpen(true)} />
        )}
        {scoreCard}
        <div className="space-y-6 mt-4">{inputSections}</div>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        This simulation is based on assumptions and does not guarantee actual investment results.
      </p>

      {isMobile && baseResult && (
        <ProjectionSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          {...chartProps}
          inflationRate={input.inflationRate}
          applyInflation={input.applyInflationToRetirementSpending}
          spendingMode={input.spendingMode}
          withdrawalRate={input.withdrawalRate}
        />
      )}
    </AppLayout>
  );
}
