import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "../components/Button";
import { CategoryTabs } from "../components/CategoryTabs";
import { DataTable } from "../components/DataTable";
import { Delta } from "../components/Delta";
import { PageIntro } from "../components/PageIntro";
import { formatDate, formatNumber } from "../lib/format";
import { useWorkspace } from "../state/workspace";
import { useComplaintData } from "../state/complaintData";
import type { Category } from "../types";

function groupCategories(categories: Category[]) {
  const groups = new Map<string, Category[]>();
  categories.forEach((category) => groups.set(category.group, [...(groups.get(category.group) ?? []), category]));
  return [...groups.entries()].map(([group, items]) => ({
    group,
    categories: items,
    count: items.reduce((sum, item) => sum + item.count, 0),
    previousCount: items.reduce((sum, item) => sum + item.previousCount, 0),
  }));
}

export function CategoriesPage() {
  const { categories, categoryById, taxonomyVersion, loading, error } = useComplaintData();
  const groups = groupCategories(categories);
  const [openGroup, setOpenGroup] = useState<string | null>(groups[0]?.group ?? null);
  const { mappings, addMapping, dataMode } = useWorkspace();
  const [mergeFrom, setMergeFrom] = useState(categories[0]?.categoryId ?? "");
  const [mergeTo, setMergeTo] = useState(categories[1]?.categoryId ?? "");
  const [mergeReason, setMergeReason] = useState("");
  const [mergeError, setMergeError] = useState("");
  const [splitFrom, setSplitFrom] = useState(categories[0]?.categoryId ?? "");
  const [splitName, setSplitName] = useState("");
  const [splitReason, setSplitReason] = useState("");
  const [splitError, setSplitError] = useState("");

  function onMerge(event: FormEvent) {
    event.preventDefault();
    if (mergeFrom === mergeTo) {
      setMergeError("서로 다른 카테고리를 선택하세요.");
      return;
    }
    const from = categoryById(mergeFrom);
    const to = categoryById(mergeTo);
    if (!from || !to) return;
    addMapping({
      type: "merge",
      fromCategoryId: from.categoryId,
      toCategoryId: to.categoryId,
      fromName: from.name,
      toName: to.name,
      fromVersion: taxonomyVersion,
      toVersion: taxonomyVersion + 1,
      reason: mergeReason.trim() || null,
    });
    setMergeReason("");
    setMergeError("");
  }

  function onSplit(event: FormEvent) {
    event.preventDefault();
    const from = categoryById(splitFrom);
    const name = splitName.trim();
    if (!from || name.length === 0) {
      setSplitError("나눌 카테고리와 새 이름이 필요합니다.");
      return;
    }
    addMapping({
      type: "split",
      fromCategoryId: from.categoryId,
      toCategoryId: "발급 전",
      fromName: from.name,
      toName: name,
      fromVersion: taxonomyVersion,
      toVersion: taxonomyVersion + 1,
      reason: splitReason.trim() || null,
    });
    setSplitName("");
    setSplitReason("");
    setSplitError("");
  }

  return (
    <div className="page">
      <PageIntro
        eyebrow={`체계 v${taxonomyVersion}`}
        title="카테고리"
        lede={`활성 ${formatNumber(categories.length)}개 · 상위 그룹 ${formatNumber(groups.length)}개. 분기마다 겹치는 범주는 합치고, 너무 커진 범주는 나눕니다.`}
      />
      {loading ? <p className="notice">카테고리 체계를 불러오는 중입니다.</p> : null}
      {error ? <p className="feedback feedback-error" role="alert">{error}</p> : null}
      <CategoryTabs />
      <section className="layout-main-side">
        <article className="card card-scroll">
          <div className="bar-list">
            {groups.map((group) => {
              const open = openGroup === group.group;
              return (
                <div key={group.group}>
                  <button
                    type="button"
                    className="group-row"
                    aria-expanded={open}
                    onClick={() => setOpenGroup(open ? null : group.group)}
                  >
                    <span className="bar-name">{group.group}</span>
                    <span className="cluster">
                      <span className="num">{formatNumber(group.count)}</span>
                      <Delta current={group.count} previous={group.previousCount} />
                    </span>
                  </button>
                  {open
                    ? group.categories.map((category) => (
                        <div key={category.categoryId} className="notice">
                          <div className="card-head">
                            <h2 className="title-sm">
                              <Link className="link" to={`/complaints?category=${category.categoryId}`}>
                                {category.name}
                              </Link>
                            </h2>
                            <span className="num">{formatNumber(category.count)}</span>
                          </div>
                          <p className="body">{category.definition}</p>
                          <div className="chips notice">
                            {category.keywords.map((keyword) => (
                              <span className="chip" key={keyword}>
                                {keyword}
                              </span>
                            ))}
                          </div>
                          <p className="caption">
                            {category.categoryId} · v{category.createdInVersion}에서 추가
                          </p>
                        </div>
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        </article>
        {dataMode === "demo" ? <div className="stack">
          <form className="card" onSubmit={onMerge}>
            <h2 className="title-sm">병합</h2>
            <div className="form-grid form-stack notice">
              <label className="field">
                <span>합칠 카테고리</span>
                <CategorySelect categories={categories} value={mergeFrom} onChange={setMergeFrom} />
              </label>
              <label className="field">
                <span>남길 카테고리</span>
                <CategorySelect categories={categories} value={mergeTo} onChange={setMergeTo} />
              </label>
              <label className="field">
                <span>사유</span>
                <input className="input" value={mergeReason} onChange={(event) => setMergeReason(event.target.value)} />
              </label>
            </div>
            {mergeError ? <p className="notice">{mergeError}</p> : null}
            <div className="notice">
              <Button type="submit">병합 기록</Button>
            </div>
          </form>
          <form className="card" onSubmit={onSplit}>
            <h2 className="title-sm">분할</h2>
            <div className="form-grid form-stack notice">
              <label className="field">
                <span>나눌 카테고리</span>
                <CategorySelect categories={categories} value={splitFrom} onChange={setSplitFrom} />
              </label>
              <label className="field">
                <span>새 이름</span>
                <input className="input" value={splitName} onChange={(event) => setSplitName(event.target.value)} />
              </label>
              <label className="field">
                <span>사유</span>
                <input className="input" value={splitReason} onChange={(event) => setSplitReason(event.target.value)} />
              </label>
            </div>
            {splitError ? <p className="notice">{splitError}</p> : null}
            <div className="notice">
              <Button type="submit" variant="secondary">
                분할 기록
              </Button>
            </div>
          </form>
        </div> : (
          <article className="card">
            <h2 className="title-sm">카테고리 변경</h2>
            <p className="notice">운영 API에 확정된 병합·분할 명세가 없어 변경 입력은 비활성화했습니다. 현재 체계와 승인된 신규 후보만 서버 데이터로 표시합니다.</p>
          </article>
        )}
      </section>
      <article className="card">
        <div className="card-head">
          <h2 className="title-sm">변경 이력</h2>
        </div>
        <DataTable
          framed={false}
          rows={mappings}
          rowKey={(row) => row.id}
          empty="병합·분할 이력이 없습니다."
          columns={[
            { key: "type", header: "종류", render: (row) => (row.type === "merge" ? "병합" : "분할") },
            { key: "from", header: "이전", render: (row) => `${row.fromName} (${row.fromCategoryId})` },
            { key: "to", header: "이후", render: (row) => `${row.toName} (${row.toCategoryId})` },
            {
              key: "version",
              header: "버전",
              numeric: true,
              render: (row) => `v${row.fromVersion} → v${row.toVersion}`,
            },
            { key: "reason", header: "사유", render: (row) => row.reason ?? "—" },
            { key: "date", header: "날짜", numeric: true, render: (row) => formatDate(row.createdAt) },
          ]}
        />
      </article>
    </div>
  );
}

function CategorySelect({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (value: string) => void }) {
  return (
    <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
      {categories.map((category) => (
        <option key={category.categoryId} value={category.categoryId}>
          {category.group} · {category.name}
        </option>
      ))}
    </select>
  );
}
