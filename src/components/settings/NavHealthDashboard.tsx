import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, Loader2, AlertCircle } from "lucide-react";
import { useNavHealth } from "@/hooks/use-nav-health";

function formatProvider(provider: string | null): string {
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
    <div className="min-h-[280px] grid grid-cols-2 sm:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function NavHealthDashboard() {
  const { data, isLoading } = useNavHealth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">NAV System Health</CardTitle>
        <CardDescription>
          Monitor NAV coverage, freshness, backfill activity, and data pipeline health across your portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
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
                    : "All current"}
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

              {/* Directory */}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Fund Directory</p>
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

            {/* Inline backfill indicator */}
            {data.pendingJobs + data.processingJobs > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Updating NAV history… ({data.pendingJobs + data.processingJobs} job
                  {data.pendingJobs + data.processingJobs !== 1 ? "s" : ""} active)
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
