import { formatMonth, formatNumber } from "../lib/format";
import type { MonthlyPoint } from "../types";

type TrendChartProps = {
  points: MonthlyPoint[];
};

export function TrendChart({ points }: TrendChartProps) {
  const width = 720;
  const height = 240;
  const pad = { left: 52, right: 8, top: 16, bottom: 28 };
  const counts = points.map((point) => point.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const range = max - min || 1;
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const coords = points.map((point, index) => {
    const x = pad.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = pad.top + (1 - (point.count - min) / range) * innerHeight;
    return { ...point, x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const ticks = [min, Math.round((min + max) / 2), max];

  return (
    <div className="trend-scroll">
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="월별 민원 건수">
      {ticks.map((tick) => {
        const y = pad.top + (1 - (tick - min) / range) * innerHeight;
        return (
          <g key={tick}>
            <line className="trend-grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
            <text className="trend-label" x={pad.left - 8} y={y + 4} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        );
      })}
      <path className="trend-line" d={line} />
      {coords.map((point, index) => (
        <g key={point.period}>
          <circle
            className={index === coords.length - 1 ? "trend-dot is-current" : "trend-dot"}
            cx={point.x}
            cy={point.y}
            r={index === coords.length - 1 ? 4 : 2.5}
          />
          <text className="trend-label" x={point.x} y={height - 6} textAnchor="middle">
            {formatMonth(point.period)}
          </text>
        </g>
      ))}
      </svg>
    </div>
  );
}
