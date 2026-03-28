import type { ScoreHistory } from "@/lib/on-track-score-history";
import { getWeeklyDelta } from "@/lib/on-track-score-history";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MiniScoreHistoryProps {
  history: ScoreHistory;
}

export function MiniScoreHistory({ history }: MiniScoreHistoryProps) {
  if (history.length < 1) return null;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const isFull = sorted.length >= 7;

  // Early state — dots only
  if (!isFull) {
    return (
      <div className="mt-3 space-y-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Getting started
        </span>
        {sorted.length > 0 && (
          <div className="flex items-center gap-2 h-8">
            {sorted.map((point) => (
              <div
                key={point.date}
                className="w-2 h-2 rounded-full bg-primary/40"
                title={`${point.date}: ${point.score}`}
              />
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">Tracking your score over time</p>
      </div>
    );
  }

  // Full state — SVG sparkline
  const delta = getWeeklyDelta(sorted);
  const scores = sorted.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const padding = 4;
  const range = maxScore === minScore ? 10 : maxScore - minScore;
  const h = 32;
  const w = sorted.length * 12;

  const points = sorted.map((p, i) => {
    const x = (i / (sorted.length - 1)) * (w - padding * 2) + padding;
    const y = h - padding - ((p.score - minScore) / range) * (h - padding * 2);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];
  const fillPath = `M${points[0].x},${h} ${points.map((p) => `L${p.x},${p.y}`).join(" ")} L${last.x},${h} Z`;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Last 4 weeks
        </span>
        {delta !== null && (
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3 text-primary" />
            ) : delta < 0 ? (
              <TrendingDown className="h-3 w-3 text-destructive" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            <span className={delta > 0 ? "text-primary" : delta < 0 ? "text-destructive" : ""}>
              {delta > 0 ? "+" : ""}{delta} this week
            </span>
          </span>
        )}
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
        <path d={fillPath} className="fill-primary/10" />
        <polyline points={polyline} fill="none" className="stroke-primary/50" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="3" className="fill-primary" />
      </svg>
    </div>
  );
}
