

## Fix Responsive Overflow of Chart Range Selector

**File:** `src/components/dashboard/PortfolioChart.tsx`

### Change

The header layout at line 36 uses `flex items-center justify-between` which forces title and selector onto one row, causing overflow on narrow screens.

**Fix the outer wrapper (line 36):**
- Change from `flex items-center justify-between` to `flex flex-col sm:flex-row sm:items-center justify-between gap-2`

**Fix the selector container (line 48):**
- Change from `flex gap-1` to `flex flex-wrap gap-1`

This stacks title above selector on mobile, keeps them side-by-side on sm+, and allows buttons to wrap if needed.

No changes needed to TWR or Fund Performance charts — TWR has no selector, and Fund Performance shares the Dashboard-level range from PortfolioChart.

