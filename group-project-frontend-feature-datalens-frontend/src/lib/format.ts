const numberFormat = new Intl.NumberFormat("ko-KR");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatRatio(value: number): string {
  return value.toFixed(2);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${year}.${month}.${day}`;
}

export function formatMonth(period: string): string {
  const [year, month] = period.split("-");
  return `${year.slice(2)}.${month}`;
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  return `${year}년 ${Number(month)}월`;
}

export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}
