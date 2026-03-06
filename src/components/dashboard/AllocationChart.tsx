import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Holding } from "@/types/portfolio";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface Props {
  holdings: Holding[];
  isLoading: boolean;
}

export function AllocationChart({ holdings, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const data = holdings.map((h) => ({
    name: h.fund.fund_code,
    value: h.market_value,
    pct: h.allocation_pct,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                      <p className="text-xs font-medium">{d.name}</p>
                      <p className="text-sm">{formatCurrency(d.value)}</p>
                      <p className="text-xs text-muted-foreground">{d.pct.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 mt-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="truncate flex-1">{d.name}</span>
              <span className="text-muted-foreground tabular-nums">{d.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
