import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortfolioTimeSeries } from "@/hooks/use-portfolio-time-series";
import { useHoldings } from "@/hooks/use-holdings";
import { useAllNavHistory } from "@/hooks/use-all-nav-history";
import { useLastSuccessfulSync } from "@/hooks/use-sync-runs";
import { useTransactions } from "@/hooks/use-transactions";
import { AppLayout } from "@/components/AppLayout";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { PortfolioTWRChart } from "@/components/dashboard/PortfolioTWRChart";
import { FundPerformanceChart } from "@/components/dashboard/FundPerformanceChart";
import { StatCards } from "@/components/dashboard/StatCards";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsSummaryTable } from "@/components/dashboard/HoldingsSummaryTable";
import { Button } from "@/components/ui/button";
import { computePortfolioTWRForRange } from "@/analytics/returns";
import { Briefcase, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartRange } from "@/types/portfolio";

export default function Dashboard() {
  const [chartRange, setChartRange] = useState<ChartRange>("SINCE_START");
  const { data: snapshots, isLoading: snapshotsLoading } = usePortfolioTimeSeries(chartRange);
  const { data: allSnapshots } = usePortfolioTimeSeries("SINCE_START");
  const { data: holdings, isLoading: holdingsLoading } = useHoldings();

  const heldFundIds = useMemo(() =>
    (holdings ?? [])
      .filter(h => h.total_units > 0)
      .map(h => h.fund.id)
      .sort(),
    [holdings]
  );

  const { data: navHistory, isLoading: navLoading } = useAllNavHistory(chartRange, heldFundIds);
  const { lastSuccess } = useLastSuccessfulSync();
  const { data: txData } = useTransactions();
  const navigate = useNavigate();

  const fundFirstTxDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of txData ?? []) {
      const d = tx.trade_date;
      if (!map.has(tx.fund_id) || d < map.get(tx.fund_id)!) {
        map.set(tx.fund_id, d);
      }
    }
    return map;
  }, [txData]);

  const twrPct = useMemo(() => {
    if (!allSnapshots || allSnapshots.length < 2) return undefined;
    return computePortfolioTWRForRange(allSnapshots, chartRange).totalReturnPct;
  }, [allSnapshots, chartRange]);

  // Early return: empty state when no holdings
  if (!holdingsLoading && (!holdings || holdings.length === 0)) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Your portfolio at a glance</p>
          </div>
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Briefcase className="h-16 w-16 mb-6 opacity-20" />
            <h2 className="text-lg font-medium text-foreground">No portfolio data yet</h2>
            <p className="text-sm mt-2 max-w-sm text-center">
              Start by adding your first transaction and selecting a fund from the SEC directory.
            </p>
            <Button className="mt-6" onClick={() => navigate("/transactions?add=1")}>
              <Plus className="h-4 w-4 mr-1" /> Add Transaction
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Loading state
  if (holdingsLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Your portfolio at a glance</p>
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  const totalCost = holdings?.reduce((s, h) => s + h.total_cost, 0) ?? 0;
  const totalValue = holdings?.reduce((s, h) => s + h.market_value, 0) ?? 0;
  const totalGainLoss = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  const lastTimeSeriesPoint = snapshots?.[snapshots.length - 1];
  const latestNavDate = lastTimeSeriesPoint?.latest_nav_date ?? null;
  const lastSyncTime = lastSuccess?.completed_at
    ? new Date(lastSuccess.completed_at).toLocaleString()
    : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your portfolio at a glance
          </p>
        </div>

        <PortfolioChart
          snapshots={snapshots ?? []}
          isLoading={snapshotsLoading}
          range={chartRange}
          onRangeChange={setChartRange}
          latestValue={totalValue}
          returnPct={totalReturnPct}
        />

        <PortfolioTWRChart
          snapshots={allSnapshots ?? []}
          isLoading={snapshotsLoading}
          range={chartRange}
        />

        <FundPerformanceChart
          navHistory={navHistory ?? []}
          holdings={holdings ?? []}
          isLoading={holdingsLoading || navLoading}
          range={chartRange}
          fundFirstTxDate={fundFirstTxDate}
        />

        <StatCards
          totalCost={totalCost}
          totalValue={totalValue}
          gainLoss={totalGainLoss}
          returnPct={totalReturnPct}
          twrPct={twrPct}
          isLoading={holdingsLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AllocationChart holdings={holdings ?? []} isLoading={holdingsLoading} />
          <div className="lg:col-span-2">
            <HoldingsSummaryTable holdings={holdings ?? []} isLoading={holdingsLoading} />
          </div>
        </div>

        {(latestNavDate || lastSyncTime) && (
          <p className="text-xs text-muted-foreground text-center">
            {latestNavDate ? `Latest NAV date: ${latestNavDate}` : ""}
            {latestNavDate && lastSyncTime ? " · " : ""}
            {lastSyncTime ? `Last updated: ${lastSyncTime}` : ""}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
