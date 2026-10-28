import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StatusChartProps = { data: Array<{ label: string; count: number }> };

export function StatusChart({ data }: StatusChartProps) {
  return (
    <div className="status-chart" role="img" aria-label="파일 처리 상태별 개수 막대 차트">
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -24 }}>
          <XAxis dataKey="label" tick={{ fill: "#929aa5", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#929aa5", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#2b3139" }} contentStyle={{ background: "#1e2329", border: "1px solid #2b3139", borderRadius: 8 }} />
          <Bar dataKey="count" name="파일" fill="#fcd535" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
