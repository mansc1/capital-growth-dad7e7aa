

## Fix: Filter nav_history by portfolio fund IDs in useHoldings

**File:** `src/hooks/use-holdings.ts`

**Problem:** The nav_history query fetches all funds unfiltered, hitting the server-side row cap (1000), causing some held funds to miss their latest NAV.

**Fix:** Make the fetch sequential — get transactions first, extract unique fund IDs, then query nav_history filtered by those IDs using `.in('fund_id', fundIds)`.

### Implementation

Replace the current parallel `Promise.all` with a two-phase approach:

1. **Phase 1** (parallel): Fetch `funds`, `transactions`, and `nav_backfill_queue`
2. Extract `fundIds` from transactions
3. **Phase 2**: Fetch `nav_history` filtered by `.in('fund_id', fundIds)` — skip if no fund IDs

```ts
// Phase 1
const [fundsRes, txRes, backfillRes] = await Promise.all([
  supabase.from('funds').select('*').order('fund_code'),
  supabase.from('transactions').select('*').order('trade_date'),
  supabase.from('nav_backfill_queue').select('fund_id').in('status', ['pending', 'processing']),
]);

if (fundsRes.error) throw fundsRes.error;
if (txRes.error) throw txRes.error;

// Extract relevant fund IDs
const fundIds = [...new Set((txRes.data || []).map(t => t.fund_id))];

// Phase 2 — filtered NAV query
let navData: { fund_id: string; nav_per_unit: number; nav_date: string }[] = [];
if (fundIds.length > 0) {
  const navRes = await supabase
    .from('nav_history')
    .select('fund_id, nav_per_unit, nav_date')
    .in('fund_id', fundIds)
    .order('fund_id')
    .order('nav_date', { ascending: false })
    .limit(5000);
  if (navRes.error) throw navRes.error;
  navData = navRes.data || [];
}

// Rest unchanged — build latestNavs from navData
```

Everything else (computeHoldings, UI, schema, other hooks) stays unchanged.

