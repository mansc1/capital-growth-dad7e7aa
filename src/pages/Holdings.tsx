import { useHoldings } from "@/hooks/use-holdings";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatNumber, gainLossColor } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { Briefcase, Plus } from "lucide-react";

export default function Holdings() {
  const { data: holdings, isLoading } = useHoldings();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Active positions in your portfolio
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="h-[300px] w-full" />
              </div>
            ) : holdings && holdings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Fund</TableHead>
                      <TableHead>AMC</TableHead>
                      <TableHead>Asset Class</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Avg Cost</TableHead>
                      <TableHead className="text-right">Latest NAV</TableHead>
                      <TableHead className="text-right">Market Value</TableHead>
                      <TableHead className="text-right">Gain/Loss</TableHead>
                      <TableHead className="text-right">Return</TableHead>
                      <TableHead className="text-right pr-6">Alloc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((h) => {
                      const isReady = h.valuation_status === 'ready';
                      const isWaiting = h.valuation_status === 'waiting_for_nav';

                      return (
                        <TableRow
                          key={h.fund.id}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => navigate(`/funds/${h.fund.id}`)}
                        >
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium text-sm">{h.fund.fund_code}</p>
                                <p className="text-xs text-muted-foreground max-w-[180px] truncate">{h.fund.fund_name}</p>
                              </div>
                              {isWaiting && (
                                <Badge variant="secondary" className="text-xs font-normal text-amber-600 bg-amber-100 border-amber-200">
                                  Updating NAV…
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{h.fund.amc_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {h.fund.asset_class}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatNumber(h.total_units)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatNumber(h.avg_cost)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {isReady ? formatNumber(h.latest_nav) : (
                              <span className={isWaiting ? "text-amber-600" : "text-muted-foreground"}>
                                {isWaiting ? "Updating…" : "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            {formatCurrency(h.market_value)}
                            {!isReady && (
                              <p className="text-[10px] text-muted-foreground font-normal">(cost basis)</p>
                            )}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-sm font-medium ${isReady ? gainLossColor(h.gain_loss) : 'text-muted-foreground'}`}>
                            {isReady ? formatCurrency(h.gain_loss) : "—"}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums text-sm font-medium ${isReady ? gainLossColor(h.return_pct) : 'text-muted-foreground'}`}>
                            {isReady ? formatPercent(h.return_pct) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm pr-6">
                            {h.allocation_pct.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Briefcase className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">No holdings yet</p>
                <p className="text-xs mt-1 mb-4">
                  Once you add your first transaction, your holdings will appear here.
                </p>
                <Button size="sm" onClick={() => navigate("/transactions?add=1")}>
                  <Plus className="h-4 w-4 mr-1" /> Add Transaction
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
