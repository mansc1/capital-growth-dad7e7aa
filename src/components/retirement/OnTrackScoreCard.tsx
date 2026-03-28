import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScoreBand, ScoreTrend } from "@/lib/on-track-score";
import type { ScoreHistory } from "@/lib/on-track-score-history";
import { MiniScoreHistory } from "./MiniScoreHistory";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface OnTrackScoreCardProps {
  score: number;
  band: ScoreBand;
  trend: ScoreTrend;
  recommendation: string;
  subtitle?: string;
  history?: ScoreHistory;
}

const bandColors: Record<ScoreBand, string> = {
  "Excellent": "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  "Strong": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  "On Track": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  "Needs Attention": "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "Off Pace": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "Getting Started": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

const trendConfig: Record<ScoreTrend, { icon: typeof TrendingUp; label: string }> = {
  improving: { icon: TrendingUp, label: "Improving" },
  stable: { icon: Minus, label: "Stable" },
  declining: { icon: TrendingDown, label: "Declining" },
};

export function OnTrackScoreCard({ score, band, trend, recommendation, subtitle, history }: OnTrackScoreCardProps) {
  const TrendIcon = trendConfig[trend].icon;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">On Track Score</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-foreground">{score}</span>
              <Badge variant="outline" className={bandColors[band]}>
                {band}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{trendConfig[trend].label}</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{recommendation}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground/60">{subtitle}</p>}
        {history && history.length >= 2 && <MiniScoreHistory history={history} />}
      </CardContent>
    </Card>
  );
}

export function OnTrackScoreEmpty() {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">On Track Score</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add portfolio data to see your On Track Score.
        </p>
      </CardContent>
    </Card>
  );
}
