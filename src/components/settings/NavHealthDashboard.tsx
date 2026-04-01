import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { useNavHealth, type NavHealthSummary } from "@/hooks/use-nav-health";
import { useUpdateNavData } from "@/hooks/use-update-nav-data";
import { toast } from "sonner";

// --- Health banner logic (kept together for maintainability) ---

type HealthStatus = "healthy" | "warning" | "error";

function computeHealthStatus(data: NavHealthSummary): HealthStatus {
  if (data.failedJobs > 0 || data.navUnavailableFunds > 0) return "error";
  if (data.waitingForNavFunds > 0 || data.staleFunds > 0) return "warning";
  return "healthy";
}

const STATUS_CONFIG: Record<HealthStatus, { bg: string; dot: string; text: string; label: string }> = {
  healthy: {
    bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
    label: "All NAV systems healthy",
  },
  warning: {
    bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
    dot: "bg-yellow-500",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "Attention needed",
  },
  error: {
    bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    label: "Issues detected",
  },
};

// --- Helpers ---

function formatProvider(provider: string | null | undefined): string {
  if (!provider) return "Unknown";
  if (provider === "sec") return "SEC Thailand";
  if (provider === "mock") return "Mock";
  return provider;
}

function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  switch (status) {
    case "success":
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />Success
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-destructive border-destructive">
          <XCircle className="h-3 w-3 mr-1" />Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Clock className="h-3 w-3 mr-1" />Running
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function LoadingSkeleton() {
  return (
    <div className="min-h-[320px] space-y-5">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-40" />
    </div>
  );
}

// --- Main component ---

export function NavHealthDashboard() {
  const { data, isLoading } = useNavHealth();
  const { updateNavData, isLoading: updating } = useUpdateNavData();

  const handleUpdateNavData = async () => {
    const result = await updateNavData();

    if (!result) {
      toast.error("NAV update failed. Check your connection and try again.");
      return;
    }

    // SEC-specific connectivity messaging
    if (result.secReachable === false) {
      if (result.errorCategory === "auth") {
        toast.error("SEC API authentication failed. Check your API key subscription.");
      } else {
        toast.warning(
          "SEC API could not be reached. Your existing portfolio data is unaffected — only the NAV refresh was skipped.",
          { duration: 8000 }
        );
      }
    } else if (!result.success) {
      toast.error(`NAV update failed: ${result.message}`);
    } else if (result?.backfillJobsEnqueued > 0) {
      toast.success("NAV data updated. Historical NAV is being updated in the background.");
    } else {
      toast.success("NAV data updated successfully.");
    }

    if ((result?.warnings?.length ?? 0) > 0) {
      console.warn("[update-nav-data] warnings:", result.warnings);
      if (result.secReachable !== false) {
        toast.warning(`Completed with ${result.warnings.length} warning(s).`);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">NAV System Health</CardTitle>
        <CardDescription>
          Monitor NAV coverage, freshness, backfill activity, and data pipeline health across your portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !data ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Health status banner */}
            {(() => {
              const status = computeHealthStatus(data);
              const cfg = STATUS_CONFIG[status];
              return (
                <div className={`flex items-center gap-2.5 rounded-md border px-4 py-2.5 ${cfg.bg}`}>
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
                </div>
              );
            })()}

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
              {/* Coverage */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Coverage</p>
                <p className="font-medium">{data.trackedFunds} tracked</p>
                <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                  <p>{data.readyFunds} ready</p>
                  {data.waitingForNavFunds > 0 && (
                    <p className="text-yellow-600">{data.waitingForNavFunds} waiting</p>
                  )}
                  {data.navUnavailableFunds > 0 && (
                    <p className="text-destructive">{data.navUnavailableFunds} unavailable</p>
                  )}
                </div>
              </div>

              {/* Freshness */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Freshness</p>
                <p className="font-medium">
                  {data.latestNavDate
                    ? new Date(data.latestNavDate + "T00:00:00").toLocaleDateString()
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.staleFunds > 0
                    ? `${data.staleFunds} stale`
                    : "Up to date"}
                </p>
              </div>

              {/* Backfill Queue */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Backfill Queue</p>
                <p className="font-medium">
                  {data.pendingJobs + data.processingJobs + data.failedJobs === 0
                    ? "Clear"
                    : `${data.pendingJobs + data.processingJobs + data.failedJobs} jobs`}
                </p>
                <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                  {data.pendingJobs > 0 && <p>{data.pendingJobs} pending</p>}
                  {data.processingJobs > 0 && <p>{data.processingJobs} processing</p>}
                  {data.failedJobs > 0 && (
                    <p className="text-destructive">{data.failedJobs} failed</p>
                  )}
                </div>
              </div>

              {/* Latest Sync */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Latest Sync</p>
                <div className="mb-0.5">
                  <SyncStatusBadge status={data.syncStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.syncCompletedAt
                    ? new Date(data.syncCompletedAt).toLocaleString()
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatProvider(data.syncProvider)}
                </p>
              </div>

              {/* SEC Directory */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">SEC Directory</p>
                <p className="font-medium">
                  {data.directoryCount.toLocaleString()} funds indexed
                </p>
              </div>

              {/* Alerts */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Alerts</p>
                {data.alerts.length === 0 ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">No issues detected</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data.alerts.map((alert) => (
                      <div key={alert.key} className="flex items-start gap-1.5 text-xs">
                        <span
                          className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                            alert.severity === "error"
                              ? "bg-destructive"
                              : "bg-yellow-500"
                          }`}
                        />
                        <span
                          className={
                            alert.severity === "error"
                              ? "text-destructive"
                              : "text-yellow-600"
                          }
                        >
                          {alert.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Background job indicator */}
            {data.pendingJobs + data.processingJobs > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Updating NAV history… ({data.pendingJobs + data.processingJobs} job
                  {data.pendingJobs + data.processingJobs !== 1 ? "s" : ""} active)
                </span>
              </div>
            )}

            {/* Update button */}
            <div className="pt-1">
              <Button onClick={handleUpdateNavData} disabled={updating} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${updating ? "animate-spin" : ""}`} />
                {updating ? "Updating…" : "Update NAV Data"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
