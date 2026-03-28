import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SimulationResult, ReturnMode } from "@/lib/retirement-simulation";

export interface ComparisonScenario {
  key: string;
  label: string;
  result: SimulationResult;
}

interface RetirementChartProps {
  baseResult: SimulationResult;
  comparisonResults?: ComparisonScenario[];
  retirementAge: number;
  targetAge: number;
  comparisonMode: boolean;
  onToggleComparison: (v: boolean) => void;
  annualReturn: number;
  returnMode: ReturnMode;
  actualByAge?: Map<number, number>;
  hideComparisonToggle?: boolean;
}

const fmt = (v: number) => `฿${Math.max(0, Math.round(v)).toLocaleString("th-TH")}`;

const formatCurrency = (v: number) => {
  const val = Math.max(0, v);
  if (val >= 1e6) return `฿${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `฿${(val / 1e3).toFixed(0)}K`;
  return `฿${val.toFixed(0)}`;
};

const BASE_COLOR = "hsl(262, 83%, 58%)";
const COLORS = ["hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)"];
const ACTUAL_BAR_COLOR = "hsla(221, 83%, 53%, 0.25)";

function CustomTooltip({ active, payload, label, comparisonMode, retirementAge }: any) {
  if (!active || !payload?.length) return null;

  if (comparisonMode) {
    return (
      <div className="rounded-lg border bg-popover p-3 text-sm shadow-lg">
        <p className="mb-2 font-semibold text-foreground">Age {label} {label >= retirementAge ? "(Withdrawal)" : "(Savings)"}</p>
        {payload.map((p: any, i: number) => {
          const rawKey = `_raw_${p.dataKey}`;
          const rawValue = p.payload?.[rawKey] ?? p.value;
          const isDepleted = rawValue != null && rawValue < 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground">{p.name}:</span>
              {isDepleted ? (
                <span className="font-medium text-destructive">Depleted</span>
              ) : (
                <span className="font-medium text-foreground">{fmt(Number(p.value))}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const row = payload[0]?.payload;
  if (!row) return null;

  const isDepleted = row._rawBalance != null && row._rawBalance < 0;

  return (
    <div className="rounded-lg border bg-popover p-3 text-sm shadow-lg min-w-[200px]">
      <p className="mb-1.5 font-semibold text-foreground">Age {row.age}</p>
      <p className="text-xs text-muted-foreground mb-2">{row.phase === "pre-retirement" ? "Savings Phase" : "Withdrawal Phase"}</p>
      {isDepleted ? (
        <div className="space-y-1 text-xs">
          <Row label="End Balance" value={0} bold />
          <p className="text-destructive font-medium mt-1">⚠ Balance depleted at this age</p>
        </div>
      ) : (
        <div className="space-y-1 text-xs">
          {row.annualSavings > 0 && <Row label="Annual Savings" value={row.annualSavings} />}
          {row.annualWithdrawal > 0 && <Row label="Annual Withdrawal" value={row.annualWithdrawal} />}
          <Row label="Interest Earned" value={row.annualInterest} />
          <div className="border-t border-border my-1" />
          <Row label="Projected" value={row.endBalance} bold />
          {row.actual_balance != null && (
            <>
              <Row label="Actual" value={row.actual_balance} />
              <DiffRow projected={row.endBalance} actual={row.actual_balance} />
            </>
          )}
          {!row.isPositive && <p className="text-destructive font-medium mt-1">⚠ Balance depleted</p>}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold text-foreground" : "text-foreground"}>
        {fmt(value)}
      </span>
    </div>
  );
}

function DiffRow({ projected, actual }: { projected: number; actual: number }) {
  const diff = actual - projected;
  const sign = diff >= 0 ? "+" : "";
  const color = diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">Difference</span>
      <span className={`text-xs font-medium ${color}`}>{sign}{fmt(diff)}</span>
    </div>
  );
}

export function RetirementChart({
  baseResult,
  comparisonResults,
  retirementAge,
  targetAge,
  comparisonMode,
  onToggleComparison,
  annualReturn,
  returnMode,
  actualByAge,
  hideComparisonToggle,
}: RetirementChartProps) {
  const scenarios = useMemo(() => {
    if (!comparisonMode || !comparisonResults?.length) return [];
    return comparisonResults;
  }, [comparisonMode, comparisonResults]);

  const hasActualData = !comparisonMode && actualByAge && actualByAge.size > 0;

  const chartData = useMemo(() => {
    if (!comparisonMode || scenarios.length === 0) {
      return baseResult.rows.map((r) => {
        const actual = actualByAge?.get(r.age);
        return {
          ...r,
          _rawBalance: r.endBalance,
          endBalance: Math.max(0, r.endBalance),
          ...(actual !== undefined ? { actual_balance: actual } : {}),
        };
      });
    }

    const allScenarios = [
      { key: "base", label: returnMode === "fixed" ? `Base ${annualReturn}%` : "Your Plan", result: baseResult },
      ...scenarios,
    ];
    const ageMap = new Map<number, any>();
    allScenarios.forEach(({ key, result }) => {
      result.rows.forEach((row) => {
        const existing = ageMap.get(row.age) || { age: row.age, phase: row.phase };
        existing[`bal_${key}`] = Math.max(0, row.endBalance);
        existing[`_raw_bal_${key}`] = row.endBalance;
        ageMap.set(row.age, existing);
      });
    });
    return Array.from(ageMap.values()).sort((a, b) => a.age - b.age);
  }, [baseResult, scenarios, comparisonMode, annualReturn, actualByAge]);

  const comparisonKeys = useMemo(() => {
    if (!comparisonMode || scenarios.length === 0) return [];
    const base = { key: "base", label: returnMode === "fixed" ? `Base ${annualReturn}%` : "Your Plan" };
    return [base, ...scenarios.map((s) => ({ key: s.key, label: s.label }))];
  }, [comparisonMode, scenarios, annualReturn, returnMode]);

  const helperText = comparisonMode
    ? returnMode === "age-based"
      ? "Comparing your plan against Conservative, Balanced, and Growth return profiles."
      : "Comparing scenarios using ±1% around current annual return."
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg">Retirement Balance Projection</CardTitle>
        <div className="flex items-center gap-2">
          {!hideComparisonToggle && (
            <>
              <Label htmlFor="comparison" className="text-sm text-muted-foreground">Compare Scenarios</Label>
              <Switch id="comparison" checked={comparisonMode} onCheckedChange={onToggleComparison} />
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {helperText && (
          <p className="text-xs text-muted-foreground mb-3">{helperText}</p>
        )}
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 28, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                label={{ value: "Age", position: "insideBottom", offset: -2, style: { fill: "hsl(var(--muted-foreground))", fontSize: 12 } }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                width={60}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip comparisonMode={comparisonMode} retirementAge={retirementAge} />} />

              <ReferenceLine x={retirementAge} stroke="hsl(var(--primary))" strokeDasharray="6 3" label={{ value: "Retire", position: "top", fill: "hsl(var(--primary))", fontSize: 11 }} />
              <ReferenceLine x={targetAge} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 3" label={{ value: "Target", position: "top", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              {baseResult.runOutAge && !comparisonMode && (
                <ReferenceLine x={baseResult.runOutAge} stroke="hsl(var(--destructive))" strokeDasharray="4 2" label={{ value: "Run Out", position: "top", fill: "hsl(var(--destructive))", fontSize: 11 }} />
              )}

              {/* Actual bars rendered first so line draws on top */}
              {hasActualData && (
                <Bar
                  dataKey="actual_balance"
                  fill={ACTUAL_BAR_COLOR}
                  barSize={12}
                  name="Actual"
                />
              )}

              {!comparisonMode ? (
                <Line
                  type="monotone"
                  dataKey="endBalance"
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                  name="Projected"
                />
              ) : (
                comparisonKeys.map(({ key, label }, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={`bal_${key}`}
                    stroke={i === 0 ? BASE_COLOR : COLORS[(i - 1) % COLORS.length]}
                    strokeWidth={i === 0 ? 2.5 : 2}
                    dot={false}
                    activeDot={{ r: i === 0 ? 5 : 4, strokeWidth: 2 }}
                    name={label}
                  />
                ))
              )}

              {(comparisonMode || hasActualData) && <Legend />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
