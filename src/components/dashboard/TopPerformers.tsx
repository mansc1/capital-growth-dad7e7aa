import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent, gainLossColor, gainLossBg } from "@/lib/format";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Holding } from "@/types/portfolio";

interface Props {
  holdings: Holding[];
  isLoading: boolean;
}

export function TopPerformers({ holdings, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const sorted = [...holdings].sort((a, b) => b.return_pct - a.return_pct);
  const gainers = sorted.filter((h) => h.return_pct > 0).slice(0, 3);
  const losers = sorted.filter((h) => h.return_pct < 0).reverse().slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gain" />
            Top Gainers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gainers.length === 0 && (
            <p className="text-sm text-muted-foreground">No gainers yet</p>
          )}
          {gainers.map((h) => (
            <div key={h.fund.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{h.fund.fund_code}</p>
                <p className="text-xs text-muted-foreground">{h.fund.fund_name}</p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium px-2 py-0.5 rounded ${gainLossBg(h.return_pct)}`}>
                  {formatPercent(h.return_pct)}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(h.gain_loss)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-loss" />
            Worst Performers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {losers.length === 0 && (
            <p className="text-sm text-muted-foreground">No losers yet</p>
          )}
          {losers.map((h) => (
            <div key={h.fund.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{h.fund.fund_code}</p>
                <p className="text-xs text-muted-foreground">{h.fund.fund_name}</p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium px-2 py-0.5 rounded ${gainLossBg(h.return_pct)}`}>
                  {formatPercent(h.return_pct)}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(h.gain_loss)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
