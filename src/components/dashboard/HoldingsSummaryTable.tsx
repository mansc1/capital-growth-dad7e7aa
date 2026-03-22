import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, formatNumber, gainLossColor } from "@/lib/format";
import type { Holding } from "@/types/portfolio";

interface Props {
  holdings: Holding[];
  isLoading: boolean;
}

export function HoldingsSummaryTable({ holdings, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Holdings Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Fund</TableHead>
              <TableHead className="text-right">Market Value</TableHead>
              <TableHead className="text-right">Gain/Loss</TableHead>
              <TableHead className="text-right">Return</TableHead>
              <TableHead className="text-right pr-6">Alloc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No holdings yet
                </TableCell>
              </TableRow>
            )}
            {holdings.map((h) => {
              const isReady = h.valuation_status === 'ready';
              return (
                <TableRow key={h.fund.id}>
                  <TableCell className="pl-6">
                    <p className="font-medium text-sm">{h.fund.fund_code}</p>
                    <p className="text-xs text-muted-foreground">{h.fund.asset_class ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatCurrency(h.market_value)}
                    {!isReady && <span className="text-[10px] text-muted-foreground ml-1">(cost)</span>}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums text-sm ${isReady ? gainLossColor(h.gain_loss) : 'text-muted-foreground'}`}>
                    {isReady ? formatCurrency(h.gain_loss) : "—"}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums text-sm ${isReady ? gainLossColor(h.return_pct) : 'text-muted-foreground'}`}>
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
      </CardContent>
    </Card>
  );
}
