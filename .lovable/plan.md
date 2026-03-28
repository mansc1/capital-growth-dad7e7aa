## Fix Mini Score History Visual for Insufficient Data

### Summary

Update `MiniScoreHistory.tsx` to show a "Getting started" state when fewer than 7 data points exist, and use fixed-width bars instead of `flex-1` to prevent stretching.

### Changes — `src/components/retirement/MiniScoreHistory.tsx`

**1. Early state (history < 7 points)**

- Replace bar chart with: label "Getting started" + helper "Tracking your score over time"
- If 1–6 points exist, render them as small fixed-width bars (not stretched), left-aligned

**2. Full state (history >= 7 points)**

- Render existing "Last 4 weeks" label, full bar chart, weekly delta — unchanged logic

**3. Bar width fix (both states)**

- Replace `flex-1` on each bar with fixed width (`w-1.5`) and keep `gap-[2px]`
- Container uses `flex items-end` without stretching — bars cluster left when few

### What stays unchanged

- Storage logic, scoring, all other components
- Weekly delta calculation, highlight logic for last 7 days  


Polish Mini Score History — Early State UX Refinements

Context

Mini Score History now supports:

- "Getting started" state when history < 7

- Fixed-width bars (no stretching)

- Full chart when history >= 7

Goal

Refine early-state UX to ensure clarity and consistency.

------------------------------------------------

1) Ensure correct label usage

When history.length < 7:

- ALWAYS show label:

  "Getting started"

- NEVER show:

  "Last 4 weeks"

- Even if there are 1–6 data points with mini bars,

  the label must remain "Getting started"

Reason:

Avoid misleading users into thinking they already have full history

------------------------------------------------

2) Use safe Tailwind width class

For bar width:

- Replace `w-1.5` with a safe class:

  use `w-1` or `w-2`

Reason:

`w-1.5` may not exist in default Tailwind config and could break rendering

------------------------------------------------

3) Handle empty history cleanly

When history.length === 0:

- Show only:

  "Getting started"

  "Tracking your score over time"

- DO NOT render:

  - any bars

  - placeholders

  - empty chart container

Reason:

Avoid visual noise and keep UI clean for first-time users

------------------------------------------------

Success Criteria

1. 0 data points → text only, clean state

2. 1–6 points → "Getting started" + small bars (left-aligned, fixed width)

3. ≥7 points → full chart with "Last 4 weeks" and weekly delta

4. No misleading labels at any stage

5. No dependency on non-standard Tailwind classes

------------------------------------------------

Outcome

Mini Score History becomes:

- accurate from day 1

- visually honest

- progressively enhanced as data grows