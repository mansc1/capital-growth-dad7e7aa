import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, gainLossColor } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import type { PortfolioSnapshot, ChartRange } from "@/types/portfolio";
import { format, parseISO } from "date-fns";
import { computeDailyReturns } from "@/analytics/returns";

const ranges: ChartRange[] = ["1M", "3M", "ALL"];

interface Props {
  snapshots: PortfolioSnapshot[];
  isLoading: boolean;
  range: ChartRange;
  onRangeChange: (r: ChartRange) => void;
  latestValue: number;
  returnPct: number;
}

export function PortfolioChart({ snapshots, isLoading, range, onRangeChange, latestValue, returnPct }: Props) {
  const dailyReturns = useMemo(() => computeDailyReturns(snapshots), [snapshots]);

  const chartData = snapshots.map((s) => ({
    date: s.snapshot_date,
    value: Number(s.total_value),
    dailyReturn: dailyReturns.get(s.snapshot_date) ?? null,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <div className="flex items-baseline gap-3">
              <CardTitle className="text-3xl font-bold tabular-nums">
                {formatCurrency(latestValue)}
              </CardTitle>
              <span className={`text-sm font-medium ${gainLossColor(returnPct)}`}>
                {formatPercent(returnPct)}
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            {ranges.map((r) => (
              <Button
                key={r}
                variant={range === r ? "default" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => onRangeChange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(parseISO(v), "d MMM")}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                hide
                domain={["dataMin - 5000", "dataMax + 5000"]}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                      <p className="text-xs text-muted-foreground">{format(parseISO(d.date), "d MMM yyyy")}</p>
                      <p className="text-sm font-semibold">{formatCurrency(d.value)}</p>
                      {d.dailyReturn !== null && (
                        <p className={`text-xs font-medium ${gainLossColor(d.dailyReturn)}`}>
                          Daily: {formatPercent(d.dailyReturn)}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#portfolioGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
