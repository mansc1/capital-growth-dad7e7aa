import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatCurrency, gainLossColor } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { computePortfolioTWRSeries } from "@/analytics/returns";
import { subMonths } from "date-fns";
import type { PortfolioSnapshot, ChartRange } from "@/types/portfolio";
import { TrendingUp } from "lucide-react";

interface Props {
  snapshots: PortfolioSnapshot[];
  isLoading: boolean;
  range: ChartRange;
}

export function PortfolioTWRChart({ snapshots, isLoading, range }: Props) {
  const series = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return [];
    const now = new Date();
    let startDate: string | undefined;
    if (range === '1M') startDate = subMonths(now, 1).toISOString().split('T')[0];
    else if (range === '3M') startDate = subMonths(now, 3).toISOString().split('T')[0];
    return computePortfolioTWRSeries(snapshots, startDate);
  }, [snapshots, range]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const latestTWR = series.length > 0 ? series[series.length - 1].twrPct : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Portfolio Total Return (TWR)
            </p>
            <CardTitle className={`text-2xl font-bold tabular-nums ${gainLossColor(latestTWR)}`}>
              {formatPercent(latestTWR)}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {series.length < 2 ? (
          <div className="h-[240px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Insufficient snapshot data for this range
            </p>
          </div>
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={series} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="twrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
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
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                        <p className="text-xs text-muted-foreground">{format(parseISO(d.date), "d MMM yyyy")}</p>
                        <p className={`text-sm font-semibold ${gainLossColor(d.twrPct)}`}>
                          TWR: {formatPercent(d.twrPct)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Value: {formatCurrency(d.value)}
                        </p>
                        <p className={`text-xs font-medium ${gainLossColor(d.dailyReturnPct)}`}>
                          Daily: {formatPercent(d.dailyReturnPct)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="twrPct"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={1.5}
                  fill="url(#twrGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
