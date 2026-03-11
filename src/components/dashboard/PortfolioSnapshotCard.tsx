import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercent, gainLossColor } from "@/lib/format";
import { Info } from "lucide-react";

interface Props {
  totalValue: number;
  totalCost: number;
  unrealizedGain: number;
  mwr: number;
  twr?: number;
  isLoading: boolean;
}

export function PortfolioSnapshotCard({ totalValue, totalCost, unrealizedGain, mwr, twr, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-32" />
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Portfolio Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hero: Total Value */}
          <div>
            <p className="text-3xl font-bold tabular-nums">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Current Portfolio Value</p>
          </div>

          <Separator />

          {/* Middle: Cost + Unrealized Gain */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Cost</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Unrealized Gain</p>
              <p className={`text-sm font-semibold tabular-nums ${gainLossColor(unrealizedGain)}`}>
                {formatCurrency(unrealizedGain)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Bottom: MWR + TWR */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs text-muted-foreground font-medium">Investor Return (MWR)</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 shrink-0 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px] text-xs">Return on your invested capital based on how much you put in.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className={`text-sm font-semibold tabular-nums ${gainLossColor(mwr)}`}>
                {formatPercent(mwr)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs text-muted-foreground font-medium">Portfolio Return (TWR)</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 shrink-0 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px] text-xs">Portfolio performance excluding the impact of cash flows.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className={`text-sm font-semibold tabular-nums ${twr !== undefined ? gainLossColor(twr) : "text-muted-foreground"}`}>
                {twr !== undefined ? formatPercent(twr) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
