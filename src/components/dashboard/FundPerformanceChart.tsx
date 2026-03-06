import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, gainLossColor } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { subMonths } from "date-fns";
import { computeFundReturnSeries } from "@/analytics/returns";
import type { NavHistory, Holding, ChartRange } from "@/types/portfolio";
import { BarChart3 } from "lucide-react";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface Props {
  navHistory: NavHistory[];
  holdings: Holding[];
  isLoading: boolean;
  range: ChartRange;
}

export function FundPerformanceChart({ navHistory, holdings, isLoading, range }: Props) {
  const [hiddenFunds, setHiddenFunds] = useState<Set<string>>(new Set());

  const { heldFundIds, fundIdToCode } = useMemo(() => {
    const ids = new Set<string>();
    const codeMap = new Map<string, string>();
    for (const h of holdings) {
      if (h.total_units > 0) {
        ids.add(h.fund.id);
        codeMap.set(h.fund.id, h.fund.fund_code);
      }
    }
    return { heldFundIds: ids, fundIdToCode: codeMap };
  }, [holdings]);

  const { data: chartData, fundCodes } = useMemo(() => {
    if (!navHistory.length || !heldFundIds.size) return { data: [], fundCodes: [] };
    const now = new Date();
    let startDate: string | undefined;
    if (range === '1M') startDate = subMonths(now, 1).toISOString().split('T')[0];
    else if (range === '3M') startDate = subMonths(now, 3).toISOString().split('T')[0];
    return computeFundReturnSeries(navHistory, heldFundIds, fundIdToCode, startDate);
  }, [navHistory, heldFundIds, fundIdToCode, range]);

  const toggleFund = (code: string) => {
    setHiddenFunds((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

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
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          Fund Performance (TWR)
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {fundCodes.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No funds with sufficient NAV data for this range
            </p>
          </div>
        ) : (
          <>
            {/* Custom clickable legend */}
            <div className="flex flex-wrap gap-3 mb-3">
              {fundCodes.map((code, i) => {
                const color = CHART_COLORS[i % CHART_COLORS.length];
                const isHidden = hiddenFunds.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => toggleFund(code)}
                    className={`flex items-center gap-1.5 text-xs transition-opacity ${isHidden ? "opacity-30" : "opacity-100"}`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {code}
                  </button>
                );
              })}
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                          <p className="text-xs text-muted-foreground mb-1">
                            {format(parseISO(d.date), "d MMM yyyy")}
                          </p>
                          {fundCodes
                            .filter((c) => !hiddenFunds.has(c) && d[c] !== undefined)
                            .map((code, i) => (
                              <div key={code} className="flex items-center gap-2 text-xs">
                                <span
                                  className="h-1.5 w-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: CHART_COLORS[fundCodes.indexOf(code) % CHART_COLORS.length] }}
                                />
                                <span className="text-muted-foreground">{code}</span>
                                <span className={`font-medium ml-auto tabular-nums ${gainLossColor(d[code] as number)}`}>
                                  {formatPercent(d[code] as number)}
                                </span>
                              </div>
                            ))}
                        </div>
                      );
                    }}
                  />
                  {fundCodes.map((code, i) => (
                    <Line
                      key={code}
                      type="monotone"
                      dataKey={code}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      hide={hiddenFunds.has(code)}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
