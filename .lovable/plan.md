

## Implement Real Risk Badge with Colored Dot in Fund Detail

**File:** `src/pages/FundDetail.tsx`

### Changes

**1. Add risk helper functions** (top of file or inline):

```ts
function normalizeRiskLevel(risk: number | null | undefined): number | null {
  if (risk == null || risk < 1 || risk > 8) return null;
  return risk;
}

function getRiskDotClass(risk: number | null): string {
  if (risk === null) return "bg-gray-400";
  if (risk <= 3) return "bg-green-500";
  if (risk <= 5) return "bg-yellow-500";
  if (risk <= 7) return "bg-orange-500";
  return "bg-red-500";
}

function getRiskLabel(risk: number | null): string {
  return risk !== null ? `Risk ${risk}/8` : "Risk —";
}
```

**2. Replace the risk Badge** (line 91) with a dot + label badge:

```tsx
<Badge variant="outline" className="flex items-center gap-1.5">
  <span className={`inline-block h-2 w-2 rounded-full ${getRiskDotClass(normalizeRiskLevel(fund.risk_level))}`} />
  {getRiskLabel(normalizeRiskLevel(fund.risk_level))}
</Badge>
```

The `fund` object from `useFund(id)` already contains `risk_level` from the `funds` table, so no additional data fetching or SEC directory fallback is needed — the data is already there. If `risk_level` is null, the badge shows "Risk —" with a gray dot.

No other files changed. No NAV/holdings/chart changes.

