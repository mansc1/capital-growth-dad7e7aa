import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTransactions, useDeleteTransaction } from "@/hooks/use-transactions";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, ArrowLeftRight, Upload } from "lucide-react";
import { TransactionDrawer } from "@/components/transactions/TransactionDrawer";
import { DeleteConfirmDialog } from "@/components/transactions/DeleteConfirmDialog";
import { ImportCsvDialog } from "@/components/transactions/ImportCsvDialog";
import type { TransactionWithFund } from "@/types/portfolio";

const txBadgeVariant: Record<string, string> = {
  buy: "bg-gain-muted text-gain",
  sell: "bg-loss-muted text-loss",
  dividend: "bg-accent text-accent-foreground",
  switch_in: "bg-gain-muted text-gain",
  switch_out: "bg-loss-muted text-loss",
};

export default function Transactions() {
  const { data: transactions, isLoading } = useTransactions();
  const deleteMutation = useDeleteTransaction();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTx, setEditTx] = useState<TransactionWithFund | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Auto-open drawer from ?add=1
  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setEditTx(null);
      setDrawerOpen(true);
      navigate("/transactions", { replace: true });
    }
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All buy, sell, and dividend transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import CSV
            </Button>
            <Button onClick={() => { setEditTx(null); setDrawerOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Transaction
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6"><Skeleton className="h-[300px] w-full" /></div>
            ) : transactions && transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Fund</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">NAV</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="pl-6 text-sm">{formatDate(tx.trade_date)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${txBadgeVariant[tx.tx_type] || ""}`}>
                            {tx.tx_type.replace("_", " ")}
                            {tx.tx_type === "dividend" && tx.dividend_type && (
                              <span className="ml-1 opacity-70">({tx.dividend_type})</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{tx.funds?.fund_code ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{formatNumber(Number(tx.units))}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{formatCurrency(Number(tx.amount))}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {Number(tx.nav_at_trade) === 0 ? (
                            <span className="italic text-muted-foreground text-xs">Updating…</span>
                          ) : (
                            formatNumber(Number(tx.nav_at_trade))
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{formatCurrency(Number(tx.fee))}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setEditTx(tx); setDrawerOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteId(tx.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ArrowLeftRight className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">No transactions yet</p>
                <p className="text-xs mt-1 mb-4">
                  Record your first buy, sell, or dividend transaction to start tracking your portfolio.
                </p>
                <Button size="sm" onClick={() => { setEditTx(null); setDrawerOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Transaction
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TransactionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditTx(null); }}
        editTransaction={editTx}
      />

      <DeleteConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId);
            setDeleteId(null);
          }
        }}
      />
      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </AppLayout>
  );
}
