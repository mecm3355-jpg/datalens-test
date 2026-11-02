import type {
  Category,
  Complaint,
  HealthPoint,
  Issue,
  MonthlyPoint,
  RegionCount,
  Urgency,
  UrgencyCount,
} from "../types";

export type AssignmentSummary = {
  total: number;
  auto: number;
  ambiguous: number;
  unassigned: number;
  confirmed: number;
};

export type Surge = {
  categoryId: string;
  count: number;
  baseline: number;
};

const URGENCY_RANK: Record<Urgency, number> = { 낮음: 0, 보통: 1, 높음: 2, 긴급: 3 };

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function latestPeriod(complaints: Complaint[]): string {
  const periods = complaints.map((item) => item.period).filter(Boolean).sort();
  return periods[periods.length - 1] ?? currentMonth();
}

function inPeriod(complaints: Complaint[], period: string): Complaint[] {
  return complaints.filter((item) => item.period === period);
}

export function assignmentOf(complaints: Complaint[]): AssignmentSummary {
  const summary: AssignmentSummary = { total: complaints.length, auto: 0, ambiguous: 0, unassigned: 0, confirmed: 0 };
  for (const item of complaints) summary[item.assignStatus] += 1;
  return summary;
}

export function withCategoryCounts(categories: Category[], complaints: Complaint[], period: string): Category[] {
  const previous = shiftPeriod(period, -1);
  return categories
    .map((category) => ({
      ...category,
      count: complaints.filter((item) => item.period === period && item.categoryId === category.categoryId).length,
      previousCount: complaints.filter((item) => item.period === previous && item.categoryId === category.categoryId)
        .length,
    }))
    .sort((a, b) => b.count - a.count);
}

export function monthlyTrendOf(complaints: Complaint[]): MonthlyPoint[] {
  const counts = new Map<string, number>();
  for (const item of complaints) {
    if (!item.period) continue;
    counts.set(item.period, (counts.get(item.period) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, count]) => ({ period, count }));
}

export function regionsOf(complaints: Complaint[]): RegionCount[] {
  const counts = new Map<string, number>();
  for (const item of complaints) {
    const name = item.region?.trim() || "지역 없음";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function urgencyOf(complaints: Complaint[]): UrgencyCount[] {
  const order: Urgency[] = ["긴급", "높음", "보통", "낮음"];
  return order.map((urgency) => ({
    urgency,
    count: complaints.filter((item) => item.attributes.urgency === urgency).length,
  }));
}

export function healthOf(complaints: Complaint[]): HealthPoint[] {
  const periods = [...new Set(complaints.map((item) => item.period).filter(Boolean))].sort();
  return periods.map((period) => {
    const rows = inPeriod(complaints, period);
    const total = rows.length || 1;
    const unassigned = (rows.filter((item) => item.assignStatus === "unassigned").length / total) * 100;
    const ambiguous = (rows.filter((item) => item.assignStatus === "ambiguous").length / total) * 100;
    return { period, unassigned, ambiguous };
  });
}

export function surgesOf(complaints: Complaint[], period: string): Surge[] {
  const categoryIds = [...new Set(complaints.map((item) => item.categoryId).filter((id): id is string => Boolean(id)))];
  const found: Surge[] = [];
  for (const categoryId of categoryIds) {
    const count = complaints.filter((item) => item.categoryId === categoryId && item.period === period).length;
    const earlier = [1, 2, 3]
      .map((delta) => complaints.filter((item) => item.categoryId === categoryId && item.period === shiftPeriod(period, -delta)).length)
      .filter((value) => value > 0);
    if (earlier.length === 0 || count === 0) continue;
    const baseline = earlier.reduce((sum, value) => sum + value, 0) / earlier.length;
    if (baseline > 0 && count >= baseline * 1.5) found.push({ categoryId, count, baseline });
  }
  return found.sort((a, b) => b.count / b.baseline - a.count / a.baseline).slice(0, 3);
}

export function issuesFrom(complaints: Complaint[]): { issues: Issue[]; complaints: Complaint[] } {
  const groups = new Map<string, Complaint[]>();
  for (const item of complaints) {
    const place = item.attributes.place?.trim();
    if (!place || !item.categoryId) continue;
    const key = `${item.categoryId}|${place}`;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  const issues: Issue[] = [];
  const tagged = complaints.map((item) => ({ ...item }));
  for (const [key, items] of groups) {
    const repeated = items.some((item) => item.attributes.repeat === "재신고");
    if (items.length < 3 && !repeated) continue;
    const ordered = [...items].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const urgency = items.reduce<Urgency | null>((max, item) => {
      const next = item.attributes.urgency;
      if (!next) return max;
      if (!max || URGENCY_RANK[next] > URGENCY_RANK[max]) return next;
      return max;
    }, null);
    const issueId = encodeURIComponent(key);
    issues.push({
      id: issueId,
      categoryId: items[0].categoryId ?? "",
      place: items[0].attributes.place ?? "",
      region: items.find((item) => item.region)?.region ?? "지역 없음",
      complaintCount: items.length,
      firstReceivedAt: ordered[0]?.receivedAt ?? "",
      lastReceivedAt: ordered[ordered.length - 1]?.receivedAt ?? "",
      summary: `${items[0].attributes.place}에서 같은 유형의 민원이 ${items.length}건 반복됩니다.`,
      maxUrgency: urgency ?? "보통",
      status: "open",
    });
    for (const item of tagged) {
      const place = item.attributes.place?.trim();
      if (place && item.categoryId && `${item.categoryId}|${place}` === key) item.issueId = issueId;
    }
  }
  return {
    issues: issues.sort((a, b) => b.complaintCount - a.complaintCount),
    complaints: tagged,
  };
}
