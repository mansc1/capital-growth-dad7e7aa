import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ScoreDriver } from "@/lib/on-track-drivers";

const trendIcon = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

const impactColor = {
  positive: "text-green-500",
  negative: "text-red-500",
  neutral: "text-muted-foreground",
} as const;

export function ScoreDrivers({ drivers }: { drivers: ScoreDriver[] }) {
  if (!drivers.length) return null;

  return (
    <div className="w-full space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Why your score
      </p>
      <div className="space-y-1">
        {drivers.map((d) => {
          const Icon = trendIcon[d.trend];
          const color = impactColor[d.impact];
          return (
            <div key={d.label} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{d.label}</span>
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                <Icon className="h-3.5 w-3.5" />
                {d.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
