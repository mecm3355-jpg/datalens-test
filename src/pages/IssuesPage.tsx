import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { categoryById, issues } from "../data/mock";
import { formatDate, formatNumber } from "../lib/format";
import type { Issue } from "../types";

type IssueFilter = "open" | "resolved" | "all";

const FILTERS: Array<{ id: IssueFilter; label: string }> = [
  { id: "open", label: "진행" },
  { id: "resolved", label: "해소" },
  { id: "all", label: "전체" },
];

export function IssuesPage() {
  const [filter, setFilter] = useState<IssueFilter>("open");
  const rows = issues
    .filter((issue) => filter === "all" || issue.status === filter)
    .sort((a, b) => b.complaintCount - a.complaintCount);

  return (
    <div className="page">
      <PageIntro
        eyebrow="같은 장소 · 같은 문제"
        title="반복 이슈"
        lede="같은 카테고리와 장소에서 반복된 민원입니다. 건수 3건 이상이거나 재신고 표현이 있는 묶음만 올립니다."
      />
      <div className="filter-bar">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "chip-btn is-active" : "chip-btn"}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <IssueTable rows={rows} />
    </div>
  );
}

export function IssueTable({ rows }: { rows: Issue[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(issue) => issue.id}
      empty="조건에 맞는 이슈가 없습니다."
      columns={[
        {
          key: "place",
          header: "장소",
          render: (issue) => (
            <Link className="link" to={`/issues/${issue.id}`}>
              {issue.place}
            </Link>
          ),
        },
        {
          key: "category",
          header: "카테고리",
          render: (issue) => categoryById(issue.categoryId)?.name ?? issue.categoryId,
        },
        { key: "count", header: "건수", numeric: true, render: (issue) => formatNumber(issue.complaintCount) },
        { key: "urgency", header: "최고 긴급도", render: (issue) => issue.maxUrgency },
        {
          key: "period",
          header: "기간",
          render: (issue) => `${formatDate(issue.firstReceivedAt)} – ${formatDate(issue.lastReceivedAt)}`,
        },
        {
          key: "status",
          header: "상태",
          render: (issue) => <span className="pill">{issue.status === "open" ? "진행" : "해소"}</span>,
        },
      ]}
    />
  );
}
