import type { ScoreBand } from "@/lib/on-track-score";

const bandColorMap: Record<ScoreBand, string> = {
  "Off Pace": "#ef4444",
  "Needs Attention": "#f97316",
  "On Track": "#eab308",
  Strong: "#4ade80",
  Excellent: "#22c55e",
  "Getting Started": "#3b82f6",
};

interface ScoreRingProps {
  score: number;
  band: ScoreBand;
  size?: number;
}

export function ScoreRing({ score, band, size = 180 }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 85;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = bandColorMap[band];
  const isGettingStarted = band === "Getting Started";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="-rotate-90"
      >
        {/* Background track */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity={isGettingStarted ? 0.5 : 1}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold text-foreground">{clamped}</span>
        <span
          className="text-xs font-semibold uppercase tracking-widest mt-1"
          style={{ color }}
        >
          {band}
        </span>
      </div>
    </div>
  );
}
