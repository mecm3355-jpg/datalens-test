type DeltaProps = {
  current: number;
  previous: number;
};

export function Delta({ current, previous }: DeltaProps) {
  if (previous <= 0) {
    return current > 0 ? <span className="delta delta-new">신규</span> : <span className="delta">—</span>;
  }

  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) {
    return <span className="delta num">0.0%</span>;
  }

  const up = change > 0;
  const label = `전월 대비 ${change.toFixed(1)}%`;
  return (
    <span className={`delta num ${up ? "delta-up" : "delta-down"}`} aria-label={label}>
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {change.toFixed(1)}%
    </span>
  );
}
