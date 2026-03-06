import { useMemo, useState } from "react";
import { usePortfolioSnapshots } from "@/hooks/use-portfolio-snapshots";
import { useHoldings } from "@/hooks/use-holdings";
import { useAllNavHistory } from "@/hooks/use-all-nav-history";
import { useLastSuccessfulSync } from "@/hooks/use-sync-runs";
import { AppLayout } from "@/components/AppLayout";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { PortfolioTWRChart } from "@/components/dashboard/PortfolioTWRChart";
import { FundPerformanceChart } from "@/components/dashboard/FundPerformanceChart";
import { StatCards } from "@/components/dashboard/StatCards";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsSummaryTable } from "@/components/dashboard/HoldingsSummaryTable";
import { computePortfolioTWRForRange } from "@/analytics/returns";
import type { ChartRange } from "@/types/portfolio";

export default function Dashboard() {
  const [chartRange, setChartRange] = useState<ChartRange>("ALL");
  const { data: snapshots, isLoading: snapshotsLoading } = usePortfolioSnapshots(chartRange);
  const { data: allSnapshots } = usePortfolioSnapshots("ALL");
  const { data: holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: navHistory, isLoading: navLoading } = useAllNavHistory(chartRange);
  const { lastSuccess } = useLastSuccessfulSync();

  const latestSnapshot = snapshots?.[snapshots.length - 1];
  const totalCost = holdings?.reduce((s, h) => s + h.total_cost, 0) ?? 0;
  const totalValue = holdings?.reduce((s, h) => s + h.market_value, 0) ?? 0;
  const totalGainLoss = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  const twrPct = useMemo(() => {
    if (!allSnapshots || allSnapshots.length < 2) return undefined;
    return computePortfolioTWRForRange(allSnapshots, chartRange).totalReturnPct;
  }, [allSnapshots, chartRange]);

  // Primary: portfolio_snapshots.latest_nav_date
  const latestNavDate = latestSnapshot?.latest_nav_date ?? null;
  const lastSyncTime = lastSuccess?.completed_at
    ? new Date(lastSuccess.completed_at).toLocaleString()
    : latestSnapshot
      ? new Date(latestSnapshot.created_at).toLocaleString()
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
