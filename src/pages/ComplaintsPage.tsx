import { Link, useSearchParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { categoryById, complaints, isPriority } from "../data/mock";
import { formatDate } from "../lib/format";
import { ASSIGN_LABEL } from "../lib/labels";
import type { AssignStatus, Urgency } from "../types";

const STATUSES: Array<AssignStatus | "all"> = ["all", "auto", "ambiguous", "unassigned", "confirmed"];
const URGENCIES: Array<Urgency | "all"> = ["all", "긴급", "높음", "보통", "낮음"];

export function ComplaintsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const urgency = params.get("urgency") ?? "all";
  const categoryId = params.get("category") ?? "";
  const query = params.get("q") ?? "";
  const priority = params.get("focus") === "priority";

  function update(next: Record<string, string>) {
    const updated = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === "" || value === "all") updated.delete(key);
      else updated.set(key, value);
    }
    setParams(updated);
  }

  const rows = complaints.filter((item) => {
    if (priority && !isPriority(item)) return false;
    if (status !== "all" && item.assignStatus !== status) return false;
    if (urgency !== "all" && item.attributes.urgency !== urgency) return false;
    if (categoryId && item.categoryId !== categoryId) return false;
    if (query.trim()) {
      const haystack = `${item.id} ${item.contentMasked} ${item.region ?? ""} ${categoryById(item.categoryId)?.name ?? ""}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });

  const categoryName = categoryById(categoryId)?.name;

  return (
    <div className="page">
      <PageIntro
        eyebrow={priority ? "긴급 · 취약계층" : categoryName ?? "대표 민원"}
        title="민원"
        lede="배정 상태, 긴급도, 카테고리로 대표 민원을 좁힙니다. 번호를 누르면 원문 위치와 속성 6종을 봅니다."
      />
      <div className="filter-bar">
        {categoryName ? (
          <button type="button" className="chip-btn is-active" onClick={() => update({ category: "" })}>
            {categoryName}
          </button>
        ) : null}
        <input
          className="input search"
          value={query}
          placeholder="본문, 지역, 번호"
          aria-label="민원 검색"
          onChange={(event) => update({ q: event.target.value })}
        />
        {STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            className={status === item ? "chip-btn is-active" : "chip-btn"}
            onClick={() => update({ status: item })}
          >
            {item === "all" ? "배정 전체" : ASSIGN_LABEL[item]}
          </button>
        ))}
        {URGENCIES.map((item) => (
          <button
            key={item}
            type="button"
            className={urgency === item && !priority ? "chip-btn is-active" : "chip-btn"}
            onClick={() => update({ urgency: item, focus: "" })}
          >
            {item === "all" ? "긴급도 전체" : item}
          </button>
        ))}
        <button
          type="button"
          className={priority ? "chip-btn is-active" : "chip-btn"}
          onClick={() => update({ focus: priority ? "" : "priority", urgency: "all" })}
        >
          우선 확인
        </button>
      </div>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        empty="조건에 맞는 대표 민원이 없습니다."
        columns={[
          {
            key: "id",
            header: "민원",
            render: (row) => (
              <Link className="link" to={`/complaints/${row.id}`}>
                {row.id}
              </Link>
            ),
          },
          { key: "date", header: "접수일", numeric: true, render: (row) => formatDate(row.receivedAt) },
          { key: "region", header: "지역", render: (row) => row.region ?? "—" },
          {
            key: "category",
            header: "카테고리",
            render: (row) => categoryById(row.categoryId)?.name ?? "미배정",
          },
          { key: "assign", header: "배정", render: (row) => ASSIGN_LABEL[row.assignStatus] },
          { key: "urgency", header: "긴급도", render: (row) => row.attributes.urgency ?? "—" },
          {
            key: "content",
            header: "본문",
            render: (row) => <span className="content-cell">{row.contentMasked}</span>,
          },
        ]}
      />
      <p className="caption">{rows.length}건 표시</p>
    </div>
  );
}
