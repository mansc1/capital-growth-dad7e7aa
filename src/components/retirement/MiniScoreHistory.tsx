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

  // Early state
  if (!isFull) {
    return (
      <div className="mt-3 space-y-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Getting started
        </span>
        {sorted.length > 0 && (
          <div className="flex items-end gap-[2px] h-8">
            {sorted.map((point) => {
              const heightPct = Math.max(8, point.score);
              return (
                <div
                  key={point.date}
                  className="w-2 rounded-sm bg-primary/30"
                  style={{ height: `${heightPct}%` }}
                  title={`${point.date}: ${point.score}`}
                />
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">Tracking your score over time</p>
      </div>
    );
  }

  // Full state
  const delta = getWeeklyDelta(sorted);
  const latestDate = new Date(sorted[sorted.length - 1].date);
  const sevenDaysAgo = new Date(latestDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

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
      <div className="flex items-end gap-[2px] h-8">
        {sorted.map((point) => {
          const isRecent = point.date > cutoff;
          const heightPct = Math.max(8, point.score);
          return (
            <div
              key={point.date}
              className={`w-2 rounded-sm transition-all ${
                isRecent ? "bg-primary/60" : "bg-primary/20"
              }`}
              style={{ height: `${heightPct}%` }}
              title={`${point.date}: ${point.score}`}
            />
          );
        })}
      </div>
    </div>
  );
}
