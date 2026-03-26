import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { RETURN_PRESETS } from "@/lib/retirement-presets";
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
  const [input, setInput] = useState<SimulationInput>(DEFAULT_INPUT);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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
      // Keep last value per year (data is sorted by date)
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

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Retirement Simulation</h1>
        <p className="mt-1 text-muted-foreground">
          Plan your retirement journey. Estimate how your savings grow and how long they last.
        </p>
      </div>

      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
        <div className="space-y-6 lg:col-span-7">{inputSections}</div>

        {baseResult && (
          <div className="lg:col-span-5">
            <div className="sticky top-8 space-y-4">
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
        <div className="space-y-6">{inputSections}</div>
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
