export function NavSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const w = 100, h = 32, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${pad + (i / (data.length - 1)) * (w - 2 * pad)},${pad + (1 - (v - min) / range) * (h - 2 * pad)}`
  ).join(' ');
  return (
    <svg width={w} height={h} className="block">
      <polyline points={points} fill="none" stroke="hsl(var(--muted-foreground))"
        strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
