## Create Score-First Home Page (VO₂ Max Style)

### Summary

Create a new Home page at `/` centered on the On Track Score hero, push existing Dashboard to `/dashboard`, and update sidebar navigation.

### Changes

**1. `src/pages/Home.tsx**` — New score-first home page

- Hero section: "ON TRACK SCORE" label, large score number (`text-5xl font-bold`), band badge, trend icon, `MiniScoreHistory`
- Recommendation text from `getScoreRecommendation()`
- Plan summary card: Balance at Retirement, Money runs out at age (from `runSimulation` on active plan)
- Quick actions: "View My Plan" → `/my-plan`, "Edit Plan" → `/retirement-planner`, "View Portfolio" → `/dashboard`
- Portfolio mini card: latest portfolio value, return %, using `usePortfolioTimeSeries`
- Empty state (no active plan): CTA "Create your retirement plan" linking to `/retirement-planner`
- Empty state (no portfolio): show score section if plan exists, portfolio card shows "No portfolio data"
- Reuses: `loadActivePlan`, `runSimulation`, `usePortfolioTimeSeries`, score computation logic from MyPlan pattern, `OnTrackScoreCard` components, `loadScoreHistory`

**2. `src/App.tsx**` — Route changes

- `"/"` → `Home` (new)
- `"/dashboard"` → `Dashboard` (existing, moved from `/`)
- Remove Index import (no longer needed)

**3. `src/components/AppSidebar.tsx**` — Navigation update

- Add "Home" as first item (`/`, icon: `Home` from lucide)
- Rename "Dashboard" to "Portfolio" (url: `/dashboard`)
- Keep all other items unchanged

**4. `src/pages/Dashboard.tsx**` — Minor text update

- Change header from "Dashboard" to "Portfolio" to match sidebar rename

### Data flow (Home page)

```text
loadActivePlan() → runSimulation(input) → result.rows
usePortfolioTimeSeries("SINCE_START") → score computation (same pattern as MyPlan)
loadScoreHistory() → MiniScoreHistory
```

Score recording on Home follows same rule as MyPlan — only records when viewing active plan data.

### What stays unchanged

- All existing pages (Dashboard/MyPlan/RetirementPlanner) — logic and layout intact
- Score computation logic, simulation engine
- All hooks, storage helpers
  &nbsp;

Additional guard rails:

- Keep role separation clear:

  Home = daily score check-in,

  My Plan = full confirmed plan details,

  Retirement Planner = edit/simulate workspace.

  Do not let Home become a duplicate of My Plan.

- Home score must use ACTIVE plan data only.

  If no active plan exists, show onboarding CTA only and do not compute score from draft inputs.

- Home should use the same active-plan score history as My Plan only.

  Do not mix in draft score history from Retirement Planner.

- Because Home becomes "/", verify all internal navigation and buttons that previously implied Dashboard now correctly point to "/dashboard".

- Make Home fail-soft:

  if active plan exists but portfolio data is unavailable, still render the score/plan section and show a graceful "No portfolio data" state for portfolio-related cards.

- After renaming Dashboard to Portfolio, ensure wording is consistent everywhere in the UI so users do not see both names mixed.