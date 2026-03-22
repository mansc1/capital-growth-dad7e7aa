import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFund } from "@/hooks/use-funds";
import { useNavHistory } from "@/hooks/use-nav-history";
import { useTransactions } from "@/hooks/use-transactions";
import { useHoldings } from "@/hooks/use-holdings";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatNumber, formatDate, gainLossColor } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { computeFundReturnPeriods } from "@/analytics/returns";

function normalizeRiskLevel(risk: number | null | undefined): number | null {
  if (risk == null || risk < 1 || risk > 8) return null;
  return risk;
}
function getRiskDotClass(risk: number | null): string {
  if (risk === null) return "bg-gray-400";
  if (risk <= 3) return "bg-green-500";
  if (risk <= 5) return "bg-yellow-500";
  if (risk <= 7) return "bg-orange-500";
  return "bg-red-500";
}

export default function FundDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fund, isLoading: fundLoading } = useFund(id);
  const { data: navHistory, isLoading: navLoading } = useNavHistory(id);
  const { data: transactions, isLoading: txLoading } = useTransactions(id);
  const { data: allHoldings } = useHoldings(true);

  const holding = allHoldings?.find((h) => h.fund.id === id);

  // Find the earliest buy transaction date for "Since First Buy"
  const firstBuyDate = useMemo(() => {
    if (!transactions) return undefined;
    const buys = transactions.filter((t) => t.tx_type === 'buy' || t.tx_type === 'switch_in');
    if (buys.length === 0) return undefined;
    return buys.reduce((earliest, t) =>
      t.trade_date < earliest ? t.trade_date : earliest,
      buys[0].trade_date
    );
  }, [transactions]);

  // TWR-based returns using analytics module
  const returns = useMemo(() => {
    if (!navHistory || navHistory.length < 2) {
      return [
        { label: '1M', value: null },
        { label: '3M', value: null },
        { label: 'Since First Buy', value: null },
      ];
    }
    return computeFundReturnPeriods(navHistory, firstBuyDate);
  }, [navHistory, firstBuyDate]);

  const chartData = (navHistory ?? []).map((n) => ({
    date: n.nav_date,
    nav: Number(n.nav_per_unit),
  }));

  if (fundLoading) {
    return (
      <AppLayout>
        <Skeleton className="h-[500px] w-full" />
      </AppLayout>
    );
  }

  if (!fund) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-muted-foreground">Fund not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{fund.fund_code}</h1>
            <p className="text-sm text-muted-foreground">{fund.fund_name}</p>
          </div>
        </div>

        {/* Fund info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary">{fund.asset_class ?? "—"}</Badge>
              <Badge variant="outline" className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${getRiskDotClass(normalizeRiskLevel(fund.risk_level))}`} />
                {fund.risk_level != null && fund.risk_level >= 1 && fund.risk_level <= 8
                  ? `Risk ${fund.risk_level}/8`
                  : "Risk —"}
              </Badge>
              <Badge variant={fund.is_active ? "default" : "destructive"}>
                {fund.is_active ? "Active" : "Inactive"}
              </Badge>
              <span className="text-sm text-muted-foreground ml-auto">{fund.amc_name}</span>
            </div>
          </CardContent>
        </Card>

        {/* Performance row - NAV-based TWR */}
        <div className="grid grid-cols-3 gap-4">
          {returns.map((r) => (
            <Card key={r.label}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{r.label}</p>
                <p className={`text-lg font-semibold tabular-nums ${r.value !== null ? gainLossColor(r.value) : "text-muted-foreground"}`}>
                  {r.value !== null ? formatPercent(r.value) : "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Holding metrics */}
        {holding && holding.total_units > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Your Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Units", value: formatNumber(holding.total_units) },
                  { label: "Avg Cost", value: formatNumber(holding.avg_cost) },
                  { label: "Market Value", value: formatCurrency(holding.market_value) },
                  { label: "Gain/Loss", value: formatCurrency(holding.gain_loss), color: gainLossColor(holding.gain_loss) },
                  { label: "Return", value: formatPercent(holding.return_pct), color: gainLossColor(holding.return_pct) },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className={`text-sm font-semibold tabular-nums ${m.color ?? ""}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* NAV chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">NAV History</CardTitle>
          </CardHeader>
          <CardContent>
            {navLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2} />
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
                    <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                            <p className="text-xs text-muted-foreground">{format(parseISO(d.date), "d MMM yyyy")}</p>
                            <p className="text-sm font-semibold">{Number(d.nav).toFixed(4)}</p>
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="nav" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#navGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction history */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {txLoading ? (
              <div className="p-4"><Skeleton className="h-[150px] w-full" /></div>
            ) : transactions && transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right pr-6">NAV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="pl-6 text-sm">{formatDate(tx.trade_date)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          tx.tx_type === "buy" || tx.tx_type === "switch_in"
                            ? "bg-gain-muted text-gain"
                            : tx.tx_type === "sell" || tx.tx_type === "switch_out"
                            ? "bg-loss-muted text-loss"
                            : "bg-accent text-accent-foreground"
                        }`}>
                          {tx.tx_type.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatNumber(Number(tx.units))}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCurrency(Number(tx.amount))}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm pr-6">{formatNumber(Number(tx.nav_at_trade))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
