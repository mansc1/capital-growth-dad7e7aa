import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useFunds } from "@/hooks/use-funds";
import { useHoldings } from "@/hooks/use-holdings";
import { useArchiveFund, useRestoreFund } from "@/hooks/use-fund-mutations";
import { FundDrawer } from "@/components/funds/FundDrawer";
import { ArchiveConfirmDialog } from "@/components/funds/ArchiveConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Archive, RotateCcw, Search, FolderCog } from "lucide-react";
import type { Fund } from "@/types/portfolio";

type StatusFilter = "active" | "archived" | "all";

export default function ManageFunds() {
  const { data: funds, isLoading } = useFunds();
  const { data: holdings } = useHoldings(true);
  const archiveMutation = useArchiveFund();
  const restoreMutation = useRestoreFund();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editFund, setEditFund] = useState<Fund | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Fund | null>(null);

  const holdingsMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (holdings) {
      for (const h of holdings) {
        map[h.fund.id] = h.total_units;
      }
    }
    return map;
  }, [holdings]);

  const filtered = useMemo(() => {
    if (!funds) return [];
    let list = funds;
    if (statusFilter === "active") list = list.filter((f) => f.is_active);
    else if (statusFilter === "archived") list = list.filter((f) => !f.is_active);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.fund_code.toLowerCase().includes(q) ||
          f.fund_name.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.fund_code.localeCompare(b.fund_code));
  }, [funds, statusFilter, search]);

  function openAdd() {
    setEditFund(null);
    setDrawerOpen(true);
  }

  function openEdit(fund: Fund) {
    setEditFund(fund);
    setDrawerOpen(true);
  }

  function handleArchiveConfirm() {
    if (archiveTarget) {
      archiveMutation.mutate(archiveTarget.id);
      setArchiveTarget(null);
    }
  }

  const isEmpty = !isLoading && filtered.length === 0;
  const noFundsAtAll = !isLoading && (!funds || funds.length === 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Funds</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add, edit, or archive your mutual fund master data.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search funds…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={openAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Fund
            </Button>
          </div>
        </div>

        {/* Empty states */}
        {noFundsAtAll && (
          <div className="border rounded-lg p-12 text-center space-y-3">
            <FolderCog className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-medium text-foreground">No funds added yet</h3>
            <p className="text-sm text-muted-foreground">Add your first fund to get started.</p>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add Your First Fund
            </Button>
          </div>
        )}

        {!noFundsAtAll && isEmpty && statusFilter === "archived" && (
          <div className="border rounded-lg p-12 text-center space-y-3">
            <Archive className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-medium text-foreground">No archived funds</h3>
            <p className="text-sm text-muted-foreground">Archived funds will appear here.</p>
          </div>
        )}

        {!noFundsAtAll && isEmpty && statusFilter !== "archived" && search && (
          <div className="border rounded-lg p-12 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No funds matching "{search}"</p>
          </div>
        )}

        {/* Table */}
        {!isEmpty && filtered.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fund Code</TableHead>
                  <TableHead className="hidden md:table-cell">SEC Code</TableHead>
                  <TableHead>Fund Name</TableHead>
                  <TableHead className="hidden lg:table-cell">AMC</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead className="hidden xl:table-cell">Asset Class</TableHead>
                  <TableHead className="hidden xl:table-cell">Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((fund) => (
                  <TableRow key={fund.id}>
                    <TableCell className="font-medium">{fund.fund_code}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {fund.sec_fund_code || "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{fund.fund_name}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {fund.amc_name}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {fund.category || "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {fund.asset_class || "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {fund.risk_level ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={fund.is_active ? "default" : "secondary"}>
                        {fund.is_active ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(fund)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {fund.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setArchiveTarget(fund)}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => restoreMutation.mutate(fund.id)}
                            title="Restore"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <FundDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditFund(null); }}
        editFund={editFund}
      />

      {archiveTarget && (
        <ArchiveConfirmDialog
          open={!!archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onConfirm={handleArchiveConfirm}
          fundName={archiveTarget.fund_name}
          hasActiveHoldings={(holdingsMap[archiveTarget.id] ?? 0) > 0}
        />
      )}
    </AppLayout>
  );
}
