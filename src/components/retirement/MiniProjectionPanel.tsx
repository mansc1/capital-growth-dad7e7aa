import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ChevronUp } from "lucide-react";
import type { SimulationResult } from "@/lib/retirement-simulation";

interface MiniProjectionPanelProps {
  result: SimulationResult;
  onClick: () => void;
}

const fmtCompact = (v: number) => {
  const val = Math.max(0, v);
  if (val >= 1e6) return `฿${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `฿${(val / 1e3).toFixed(0)}K`;
  return `฿${val.toFixed(0)}`;
};

export function MiniProjectionPanel({ result, onClick }: MiniProjectionPanelProps) {
  const onTrack = result.lastsUntilTarget;

  const sparkData = result.rows.map((r) => ({
    age: r.age,
    bal: Math.max(0, r.endBalance),
  }));

  const summaryText = onTrack
    ? `Retirement: ${fmtCompact(result.balanceAtRetirement)}`
    : `Runs out at ${result.runOutAge}`;

  return (
    <div
      className="sticky top-0 z-40 lg:hidden"
    >
      <button
        onClick={onClick}
        className="w-full border-b bg-card px-4 py-3 shadow-[0_4px_12px_-4px_hsl(var(--foreground)/0.06)] hover:bg-accent/50"
        aria-label="Expand projection details"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="bal"
                  stroke={onTrack ? "hsl(142, 71%, 45%)" : "hsl(var(--destructive))"}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-1 items-center gap-2 text-left">
            <Badge
              className={
                onTrack
                  ? "bg-green-600/15 text-green-700 border-green-600/30 hover:bg-green-600/20 shrink-0"
                  : "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20 shrink-0"
              }
            >
              {onTrack ? "On Track" : "Shortfall"}
            </Badge>
            <span className="truncate text-sm text-muted-foreground">{summaryText}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Tap to expand</span>
            <ChevronUp className="h-4 w-4" />
          </div>
        </div>
      </button>
    </div>
  );
}
