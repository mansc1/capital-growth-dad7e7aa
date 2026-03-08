import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useLastSuccessfulSync } from "@/hooks/use-sync-runs";
import { useBackfillStatus } from "@/hooks/use-backfill-status";
import { useUpdateNavData } from "@/hooks/use-update-nav-data";
import { NavHealthDashboard } from "@/components/settings/NavHealthDashboard";
import { toast } from "sonner";

export default function SettingsPage() {
  const { lastSuccess, latestRun, isLoading: syncLoading } = useLastSuccessfulSync();
  const { activeCount: backfillActiveCount } = useBackfillStatus();
  const { updateNavData, isLoading: updating } = useUpdateNavData();

  const handleUpdateNavData = async () => {
    const result = await updateNavData();

    if (!result) {
      toast.error("NAV update failed. Check your connection and try again.");
      return;
    }

    if (!result.success) {
      toast.error(`NAV update failed: ${result.message}`);
    } else if (result.backfillJobsEnqueued > 0) {
      toast.success("NAV data updated. Historical NAV is being updated in the background.");
    } else {
      toast.success("NAV data updated successfully.");
    }

    if (result.warnings.length > 0) {
      console.warn("[update-nav-data] warnings:", result.warnings);
      toast.warning(`Completed with ${result.warnings.length} warning(s).`);
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
            <CardTitle className="text-base">NAV Data Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Refresh the SEC fund directory, sync the latest NAV, and fill any missing historical NAV automatically.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Data Source</p>
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
                <p className="text-muted-foreground text-xs mb-1">Last Update Status</p>
                <div className="flex items-center gap-2">
                  {syncLoading ? (
                    <span className="text-muted-foreground">Loading…</span>
                  ) : latestRun ? (
                    statusBadge(latestRun.status)
                  ) : (
                    <span className="text-muted-foreground">No updates yet</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Last Successful Update</p>
                <p className="font-medium">
                  {lastSuccess
                    ? new Date(lastSuccess.completed_at!).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Background Jobs</p>
                <p className="font-medium">
                  {backfillActiveCount > 0
                    ? `${backfillActiveCount} active`
                    : "None"}
                </p>
              </div>
            </div>

            {latestRun?.status === "failed" && latestRun.error_message && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {latestRun.error_message}
              </div>
            )}

            {backfillActiveCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating NAV history… ({backfillActiveCount} job{backfillActiveCount !== 1 ? "s" : ""} active)</span>
              </div>
            )}

            <Button onClick={handleUpdateNavData} disabled={updating} size="sm" className="mt-2">
              <RefreshCw className={`h-4 w-4 mr-2 ${updating ? "animate-spin" : ""}`} />
              {updating ? "Updating…" : "Update NAV Data"}
            </Button>
          </CardContent>
        </Card>

        <NavHealthDashboard />
      </div>
    </AppLayout>
  );
}
