

## Refine Home to WHOOP-style Readiness Score UX

### Summary

Increase visual dominance of the score, make the delta more prominent with color, reduce snapshot cards to a compact inline strip, and strengthen coaching suggestions with specific numbers.

### Changes — `src/pages/Home.tsx`

**1. Score Hero — increase visual weight**
- Score number: `text-5xl` → `text-7xl` (largest element on page)
- Move weekly delta directly below the score number (not top-right corner) with larger text (`text-base font-semibold`) and strong color (`text-green-500` / `text-red-500`)
- Band badge stays next to score
- Move sparkline up — render immediately after delta, before recommendation
- Recommendation + target context: keep but ensure muted hierarchy

**2. Snapshot cards — reduce to compact inline strip**
- Replace two full `Card` components with a single row of two inline stat blocks (no card borders)
- Use a simple `div` with a subtle top border or separator instead of heavy cards
- Smaller text: label `text-[11px]`, value `text-base font-semibold`, subtext `text-[11px]`
- Layout: `flex gap-8` on one line, not grid of cards

**3. Coaching — strengthen suggestions**
- Update `getActionSuggestions` to include numbers derived from plan data:
  - Accept `input` and `portfolioValue` as params
  - Off Pace / Needs Attention: "Increase monthly savings by ~฿X,000" (compute gap between actual and planned monthly), "Consider delaying retirement by 1–2 years"
  - On Track: "You're saving ฿X/month — stay consistent"
  - Strong / Excellent: "You're ฿Xk ahead of plan. Consider reviewing risk allocation."
  - Getting Started: "Start with ฿X/month to build momentum" (use planned monthly)
- Pass `input` and `portfolioValue` to the function

**4. Quick actions — reduce visual weight**
- Change from `Button variant="outline"` to `variant="ghost"` with smaller size (`size="sm"`)
- More compact row

### What stays unchanged
- All score computation logic, simulation, history storage
- MiniScoreHistory component (already has sparkline)
- Empty state (HomeEmpty)
- All other pages

