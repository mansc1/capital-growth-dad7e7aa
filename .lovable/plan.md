## Upgrade On Track Score to WHOOP-style Circular UI

### Summary

Create a new `ScoreRing` SVG component and integrate it into the Home page score hero, replacing the current text-only layout with a circular progress ring centered design.

### Changes

**1. `src/components/home/ScoreRing.tsx**` — New component

SVG-based circular progress ring:

- Two `<circle>` elements: background track (muted) + colored progress arc
- Props: `score: number`, `band: ScoreBand`, `size?: number` (default 180)
- SVG with `viewBox="0 0 200 200"`, radius ~85, stroke-width 10, `stroke-linecap="round"`
- Progress: `strokeDasharray` = circumference, `strokeDashoffset` = `circumference * (1 - score/100)`
- Rotate ring -90deg so it starts from top
- Band-to-color map: Off Pace → `#ef4444`, Needs Attention → `#f97316`, On Track → `#eab308`, Strong → `#4ade80`, Excellent → `#22c55e`, Getting Started → `#3b82f6`
- Center content via absolute positioning inside a relative container:
  - Score number: `text-5xl font-bold`
  - Band label below: `text-xs uppercase tracking-widest` in band color

**2. `src/pages/Home.tsx**` — Replace score hero layout

Replace lines 248-283 (score display block) with:

- Centered layout: `flex flex-col items-center`
- `<ScoreRing>` component centered
- Weekly delta below the ring (keep existing TrendingUp/Down/Minus logic, centered)
- MiniScoreHistory below delta (centered)
- Recommendation text below (centered, muted)
- Target context below (centered, more muted)
- Remove the "ON TRACK SCORE" top label (the ring itself communicates the metric)
- Empty state (no score data) stays as-is

### What stays unchanged

- All score computation, simulation, history logic
- Snapshot strip, action card, quick actions
- Empty state (HomeEmpty)
- All other pages

Additional guard rails:

- Keep a small metric label such as "On Track Score" near the ring so first-time users still know what the number represents.

- Clamp score to 0–100 before computing the SVG arc.

- If band is "Getting Started", make sure the ring feels visually distinct from normal scored states (more muted or clearly early-phase).

- Verify center layout with 1-digit, 2-digit, and 3-digit scores (especially 100).

- Keep visual hierarchy clear after the ring: ring first, delta second, mini history third, recommendation fourth, target context fifth.

- If practical, prefer existing theme tokens over hardcoded colors for long-term consistency.