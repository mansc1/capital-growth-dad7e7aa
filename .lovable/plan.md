

# Merge NAV Cards — Implementation Plan

## Overview
Consolidate the "NAV Data Maintenance" card and "NAV System Health" card into a single unified dashboard. Two files replaced, no other files changed.

---

## File 1: `src/pages/Settings.tsx` — Full Replacement

Remove all NAV-related imports (`Button`, `Badge`, `RefreshCw`, `CheckCircle2`, `XCircle`, `Clock`, `Loader2`, `useLastSuccessfulSync`, `useBackfillStatus`, `useUpdateNavData`, `toast`), all hook calls, `handleUpdateNavData`, `statusBadge`, and the entire NAV Data Maintenance card (lines 81-150).

Keep imports: `AppLayout`, `Card/CardContent/CardHeader/CardTitle`, `Input`, `Label`, `NavHealthDashboard`.

The page header (lines 58-63) and Portfolio card (lines 65-79) are preserved exactly as-is — full JSX, not placeholders.

Final render: page header → Portfolio card → `<NavHealthDashboard />`.

---

## File 2: `src/components/settings/NavHealthDashboard.tsx` — Full Replacement

### New imports
Add: `Button` (from ui), `RefreshCw` (lucide), `useUpdateNavData`, `toast` (sonner), `NavHealthSummary` type.  
Remove: unused `AlertCircle`.

### Health banner (defined together for maintainability)

```ts
type HealthStatus = "healthy" | "warning" | "error";

function computeHealthStatus(data: NavHealthSummary): HealthStatus {
  if (data.failedJobs > 0 || data.navUnavailableFunds > 0) return "error";
  if (data.waitingForNavFunds > 0 || data.staleFunds > 0) return "warning";
  return "healthy";
}

const STATUS_CONFIG: Record<HealthStatus, {
  bg: string; dot: string; text: string; label: string
}> = {
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
```

Rendered as a bordered rounded div with colored dot + label text.

### Update action (with null-safety)

```ts
const handleUpdateNavData = async () => {
  const result = await updateNavData();
  if (!result) {
    toast.error("NAV update failed. Check your connection and try again.");
    return;
  }
  if (!result.success) {
    toast.error(`NAV update failed: ${result.message}`);
  } else if (result?.backfillJobsEnqueued > 0) {
    toast.success("NAV data updated. Historical NAV is being updated in the background.");
  } else {
    toast.success("NAV data updated successfully.");
  }
  if ((result?.warnings?.length ?? 0) > 0) {
    console.warn("[update-nav-data] warnings:", result.warnings); // array preserved
    toast.warning(`Completed with ${result.warnings.length} warning(s).`);
  }
};
```

### Layout changes
- `CardContent`: `space-y-4` → `space-y-5`
- Grid: `gap-4` → `gap-6`
- "Fund Directory" → "SEC Directory"
- "All current" → "Up to date"
- `formatProvider` accepts `string | null | undefined`, returns "Unknown" for falsy values
- Background indicator uses `data.pendingJobs + data.processingJobs` for job count
- Update button in `<div className="pt-1">` for visual separation, disabled only when `updating`

### Loading skeleton
`min-h-[320px]` with `space-y-5` containing: banner skeleton (`h-10 w-full`), 6-cell grid skeleton (`gap-6`), button skeleton (`h-9 w-40`).

### Vertical order in card
1. Health status banner
2. Metrics grid (Coverage, Freshness, Backfill Queue, Latest Sync, SEC Directory, Alerts)
3. Background job indicator (conditional, with explicit `pendingJobs + processingJobs` count)
4. Update NAV Data button

