import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, Clock, Database, History, Loader2 } from "lucide-react";
import { useNavSync } from "@/hooks/use-nav-sync";
import { useNavBackfill } from "@/hooks/use-nav-backfill";
import { useLastSuccessfulSync } from "@/hooks/use-sync-runs";
import { useBackfillStatus } from "@/hooks/use-backfill-status";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const { syncNav, isLoading: syncing } = useNavSync();
  const { backfillNav, isLoading: backfilling } = useNavBackfill();
  const { lastSuccess, latestRun, isLoading: syncLoading } = useLastSuccessfulSync();
  const { activeCount: backfillActiveCount } = useBackfillStatus();
  const [refreshingDirectory, setRefreshingDirectory] = useState(false);

  const handleRefreshDirectory = async () => {
    setRefreshingDirectory(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-sec-fund-directory");
      if (error) throw error;
      if (data?.success) {
        toast.success(`SEC directory refreshed: ${data.totalFunds} funds from ${data.totalAmcs} AMCs`);
      } else {
        toast.error(data?.error ?? "Failed to refresh SEC directory");
      }
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    } finally {
      setRefreshingDirectory(false);
    }
  };

  const handleSync = async () => {
    const result = await syncNav();
    if (result?.success && result.processedFunds === 0) {
      toast.info("No portfolio funds available for NAV sync yet.");
    } else if (result?.success) {
      toast.success(
        `NAV sync complete: ${result.insertedRows} inserted, ${result.updatedRows} updated, ${result.skippedFunds} skipped`
      );
    } else if (result) {
      toast.error(`Sync finished with errors: ${result.errors.join(", ")}`);
    } else {
      toast.error("NAV sync failed. Check your connection and try again.");
    }
  };

  const handleBackfill = async () => {
    const result = await backfillNav();
    if (!result) {
      toast.error("Backfill failed. Check your connection and try again.");
      return;
    }

    if (result.fundsEnqueued === 0) {
      toast.info("All funds already have sufficient NAV coverage.");
    } else {
      toast.success(
        `Backfill queued for ${result.fundsEnqueued} fund(s). Processing in the background.`
      );
    }
  };

  const statusBadge = (status: string | undefined) => {
    if (!status) return null;
    switch (status) {
      case "success":
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-destructive border-destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "running":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const backfillDisabled = backfilling || backfillActiveCount > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your portfolio preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="portfolio-name">Portfolio Name</Label>
              <Input id="portfolio-name" defaultValue="My Portfolio" className="max-w-sm" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" defaultValue="THB" disabled className="max-w-sm" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">NAV Data Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Provider</p>
                <p className="font-medium">
                  {(() => {
                    const p = latestRun?.provider;
                    if (p === "sec") return "SEC Thailand";
                    if (p === "mock") return "Mock";
                    return p ?? "Unknown";
                  })()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Last Sync Status</p>
                <div className="flex items-center gap-2">
                  {syncLoading ? (
                    <span className="text-muted-foreground">Loading…</span>
                  ) : latestRun ? (
                    statusBadge(latestRun.status)
                  ) : (
                    <span className="text-muted-foreground">No syncs yet</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Last Successful Sync</p>
                <p className="font-medium">
                  {lastSuccess
                    ? new Date(lastSuccess.completed_at!).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Latest NAV Date</p>
                <p className="font-medium">
                  {lastSuccess?.completed_at ? "See dashboard" : "—"}
                </p>
              </div>
            </div>

            {latestRun?.status === "failed" && latestRun.error_message && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {latestRun.error_message}
              </div>
            )}

            <Button onClick={handleSync} disabled={syncing} size="sm" className="mt-2">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync NAV Now"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SEC Fund Directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Refresh the cached SEC Thailand fund directory. This crawls all AMCs from the SEC API and stores the fund list locally for fast search when assigning SEC fund codes.
            </p>
            <Button onClick={handleRefreshDirectory} disabled={refreshingDirectory} size="sm">
              <Database className={`h-4 w-4 mr-2 ${refreshingDirectory ? "animate-pulse" : ""}`} />
              {refreshingDirectory ? "Refreshing…" : "Refresh SEC Directory"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historical NAV Backfill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Fetch missing historical NAV data for funds with transactions older than existing coverage. This on-demand process queries dates individually and may take several minutes depending on the number of funds and date range.
            </p>

            {backfillActiveCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating NAV history… ({backfillActiveCount} job{backfillActiveCount !== 1 ? "s" : ""} active)</span>
              </div>
            )}

            <Button onClick={handleBackfill} disabled={backfillDisabled} size="sm">
              <History className={`h-4 w-4 mr-2 ${backfilling ? "animate-spin" : ""}`} />
              {backfilling ? "Backfilling…" : backfillActiveCount > 0 ? "Backfill in Progress" : "Backfill Historical NAV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
