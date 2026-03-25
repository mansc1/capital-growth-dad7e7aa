

## Remove Unused Asset Class Placeholder Badge

**File:** `src/pages/FundDetail.tsx`

The element showing "—" is the asset class badge at line 112: `<Badge variant="secondary">{fund.asset_class ?? "—"}</Badge>`. When `asset_class` is null, it renders a badge with just "—", creating visual noise.

### Change

**Option A — Remove the badge entirely** (if asset class info isn't useful):
- Delete line 112

**Option B — Hide only when empty** (preserve it when data exists):
- Change to: `{fund.asset_class && <Badge variant="secondary">{fund.asset_class}</Badge>}`

I'll go with **Option B** — conditionally render the badge only when asset_class has a value. This keeps useful info when present, removes noise when absent.

### Technical detail

Line 112 in `src/pages/FundDetail.tsx`:
```tsx
// Before
<Badge variant="secondary">{fund.asset_class ?? "—"}</Badge>

// After
{fund.asset_class && <Badge variant="secondary">{fund.asset_class}</Badge>}
```

No other files affected. Risk badge, active badge, and AMC name remain unchanged.

