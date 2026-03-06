

## Implementation Plan: Reset Portfolio Data (Dev-Only)

### Single file change: `src/pages/Settings.tsx`

**New imports:**
- `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` from `@/components/ui/alert-dialog`
- `useNavigate` from `react-router-dom`
- `useQueryClient` from `@tanstack/react-query`
- `AlertTriangle` from `lucide-react`

**New state:** `resetConfirmText` (string), `resetting` (boolean), `resetDialogOpen` (boolean).

**New `handleReset` handler:**
1. Sequential deletes using `.delete().neq('id', '')`:
   - `portfolio_snapshots` → `sync_runs` → `transactions` → `nav_history`
2. Archive funds: `.update({ is_active: false }).eq('is_active', true)`
3. On any error: toast error, stop
4. Explicit query invalidation for: `funds`, `holdings`, `transactions`, `nav_history`, `all_nav_history`, `portfolio_snapshots`, `sync_runs`, `latest_navs`
5. Toast success
6. `setResetDialogOpen(false)`, `setResetConfirmText("")`
7. `navigate("/dashboard")`

**New UI block** after the SEC Fund Directory card, gated by `import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true'`:
- Card titled "Advanced" with destructive accent and `AlertTriangle` icon
- Warning text about irreversible dev/test action
- Button opens controlled `AlertDialog` (`resetDialogOpen` state)
- Dialog: warning description, input requiring "RESET", confirm button disabled until input matches AND `resetting` is false
- On confirm → calls `handleReset`

No database migrations, no new files, no new packages needed.

