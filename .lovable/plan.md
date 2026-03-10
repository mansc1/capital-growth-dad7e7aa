

## Fix: Filter nav_history Queries by Fund IDs to Bypass Server 1000-Row Cap

### Root Cause
PostgREST enforces a hard `max_rows=1000` server-side. The `nav_history` table has 1206+ rows, so `.limit(10000)` has no effect — the server silently truncates at 1000 rows, dropping all NAV data after ~Feb 10.

### Fix: 3 files, filter nav_history by held fund IDs (~725 rows, under the cap)

**File 1: `src/hooks/use-portfolio-time-series.ts`** (lines 10-24)

Replace the parallel fetch with sequential:
```ts
// Sequential: need fund IDs before filtering nav_history
const txRes = await supabase.from('transactions').select('*').order('trade_date');
if (txRes.error) throw txRes.error;

const txData = (txRes.data || []).map(t => ({
  ...t,
  units: Number(t.units),
  amount: Number(t.amount),
  fee: Number(t.fee),
}));

const fundIds = [...new Set(txData.map(t => t.fund_id))].sort();
if (fundIds.length === 0) return [];

const navRes = await supabase
  .from('nav_history')
  .select('*')
  .in('fund_id', fundIds)
  .order('nav_date', { ascending: true })
  .limit(10000);
if (navRes.error) throw navRes.error;
const navData = navRes.data || [];
```

**File 2: `src/hooks/use-all-nav-history.ts`** (full rewrite)

Add `fundIds` parameter, use it in query key and filter:
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NavHistory, ChartRange } from '@/types/portfolio';
import { subMonths } from 'date-fns';

export function useAllNavHistory(range: ChartRange = 'ALL', fundIds?: string[]) {
  return useQuery({
    queryKey: ['all_nav_history', range, fundIds],
    enabled: !fundIds || fundIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('nav_history')
        .select('*')
        .order('nav_date', { ascending: true });

      if (fundIds?.length) {
        query = query.in('fund_id', fundIds);
      }

      if (range !== 'ALL') {
        const months = range === '1M' ? 1 : 3;
        const from = subMonths(new Date(), months).toISOString().split('T')[0];
        query = query.gte('nav_date', from);
      }

      const { data, error } = await query.limit(10000);
      if (error) throw error;
      return data as NavHistory[];
    },
  });
}
```

**File 3: `src/pages/Dashboard.tsx`** (lines 25-26)

Add sorted `heldFundIds` memo and pass to `useAllNavHistory`:
```ts
// After holdings hook (line 25), add:
const heldFundIds = useMemo(() =>
  (holdings ?? [])
    .filter(h => h.total_units > 0)
    .map(h => h.fund.id)
    .sort(),
  [holdings]
);

// Change line 26 from:
const { data: navHistory, isLoading: navLoading } = useAllNavHistory(chartRange);
// To:
const { data: navHistory, isLoading: navLoading } = useAllNavHistory(chartRange, heldFundIds);
```

### What this fixes
All three charts (Portfolio Value, Portfolio TWR, Fund Performance) receive complete nav_history data through the latest date instead of being truncated at row 1000. No changes to analytics/returns.ts, UI components, or schema.

