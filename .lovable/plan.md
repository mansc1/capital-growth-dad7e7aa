

## Fix: Trim Fund Detail NAV History to Start at First Transaction Date

**Single file change:** `src/hooks/use-nav-history.ts`

### Change — `useNavHistory(fundId)` queryFn

Make the queryFn sequential:

1. First, fetch the earliest transaction date for the given fund
2. Then, filter the `nav_history` query with `.gte('nav_date', firstTradeDate)` if a transaction exists

```ts
queryFn: async () => {
  let firstTradeDate: string | undefined;
  if (fundId) {
    const { data: firstTx } = await supabase
      .from('transactions')
      .select('trade_date')
      .eq('fund_id', fundId)
      .order('trade_date', { ascending: true })
      .limit(1);
    firstTradeDate = firstTx?.[0]?.trade_date;
  }

  let query = supabase
    .from('nav_history')
    .select('*')
    .order('nav_date', { ascending: true });

  if (fundId) query = query.eq('fund_id', fundId);
  if (firstTradeDate) query = query.gte('nav_date', firstTradeDate);

  const { data, error } = await query.limit(10000);
  if (error) throw error;
  return data as NavHistory[];
},
```

### What stays unchanged
- `useLatestNavs()` — untouched
- No UI, schema, or analytics changes
- Dashboard charts unaffected (they use different hooks)

