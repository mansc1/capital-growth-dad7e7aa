import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, gainLossColor } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity } from "lucide-react";

interface Props {
  totalCost: number;
  totalValue: number;
  gainLoss: number;
  returnPct: number;
  twrPct?: number;
  isLoading: boolean;
}

export function StatCards({ totalCost, totalValue, gainLoss, returnPct, twrPct, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-7 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Total Value", value: formatCurrency(totalValue), icon: BarChart3, color: "text-foreground" },
    { label: "Total Cost", value: formatCurrency(totalCost), icon: DollarSign, color: "text-muted-foreground" },
    { label: "Gain / Loss", value: formatCurrency(gainLoss), icon: gainLoss >= 0 ? TrendingUp : TrendingDown, color: gainLossColor(gainLoss) },
    { label: "Return", value: formatPercent(returnPct), icon: gainLoss >= 0 ? TrendingUp : TrendingDown, color: gainLossColor(returnPct) },
    { label: "Total Return (TWR)", value: twrPct !== undefined ? formatPercent(twrPct) : "—", icon: Activity, color: twrPct !== undefined ? gainLossColor(twrPct) : "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            </div>
            <p className={`text-lg font-semibold tabular-nums ${s.color}`}>{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
