import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SimulationResult, SpendingMode } from "@/lib/retirement-simulation";

interface SummaryMetricsProps {
  result: SimulationResult;
  inflationRate: number;
  applyInflation: boolean;
  spendingMode: SpendingMode;
  withdrawalRate: number;
}

const fmt = (v: number) => `฿${Math.max(0, Math.round(v)).toLocaleString("th-TH")}`;

export function SummaryMetrics({ result, inflationRate, applyInflation, spendingMode, withdrawalRate }: SummaryMetricsProps) {
  const onTrack = result.lastsUntilTarget;
  const showInflationNote = applyInflation && inflationRate > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <h3 className="text-lg font-semibold text-foreground">Simulation Result</h3>
        <Badge
          className={
            onTrack
              ? "bg-green-600/15 text-green-700 border-green-600/30 hover:bg-green-600/20"
              : "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20"
          }
        >
          {onTrack ? "On Track" : "Shortfall"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <span className="text-sm text-muted-foreground">Balance at Retirement</span>
          <span className="text-sm font-semibold text-foreground">{fmt(result.balanceAtRetirement)}</span>
        </div>
        {onTrack ? (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Balance at Target Age</span>
            <span className="text-sm font-semibold text-foreground">{fmt(result.balanceAtTarget)}</span>
          </div>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Money Runs Out At</span>
            <span className="text-sm font-semibold text-destructive">Age {result.runOutAge}</span>
          </div>
        )}
        <div className="space-y-1 pt-2 border-t border-border">
          {spendingMode === "withdrawal-rate" && (
            <p className="text-xs text-muted-foreground">
              First-year spending derived from a {withdrawalRate.toFixed(1)}% withdrawal rule.
            </p>
          )}
          {spendingMode === "manual" && (
            <p className="text-xs text-muted-foreground">
              Retirement spending is manually set.
            </p>
          )}
          {showInflationNote && (
            <p className="text-xs text-muted-foreground">
              Retirement spending increases by {inflationRate.toFixed(1)}% per year.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
