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
import { useSession } from "../state/session";
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
  const {
    categories,
    categoryById,
    complaints,
    insights,
    mappings: apiMappings,
    mergeCategories,
    splitCategory,
    taxonomyVersion,
    loading,
    error,
  } = useComplaintData();
  const { user } = useSession();
  const groups = groupCategories(categories);
  const [openGroup, setOpenGroup] = useState<string | null>(groups[0]?.group ?? null);
  const { mappings: demoMappings, addMapping, dataMode } = useWorkspace();
  const mappings = dataMode === "api" ? apiMappings : demoMappings;
  const canManage = user?.role === "admin" || user === null;
  const [mergeFrom, setMergeFrom] = useState(categories[0]?.categoryId ?? "");
  const [mergeTo, setMergeTo] = useState(categories[1]?.categoryId ?? "");
  const [mergeReason, setMergeReason] = useState("");
  const [mergeError, setMergeError] = useState("");
  const [splitFrom, setSplitFrom] = useState(categories[0]?.categoryId ?? "");
  const [splitName, setSplitName] = useState("");
  const [splitReason, setSplitReason] = useState("");
  const [splitError, setSplitError] = useState("");
  const [splitComplaintIds, setSplitComplaintIds] = useState<string[]>([]);
  const resolvedOpenGroup = openGroup ?? groups[0]?.group ?? null;
  const resolvedMergeFrom = categories.some((item) => item.categoryId === mergeFrom)
    ? mergeFrom
    : categories[0]?.categoryId ?? "";
  const resolvedMergeTo = categories.some((item) => item.categoryId === mergeTo)
    ? mergeTo
    : categories[1]?.categoryId ?? categories[0]?.categoryId ?? "";
  const resolvedSplitFrom = categories.some((item) => item.categoryId === splitFrom)
    ? splitFrom
    : categories[0]?.categoryId ?? "";
  const splitComplaints = complaints.filter(
    (item) => item.categoryId === resolvedSplitFrom,
  );

  async function onMerge(event: FormEvent) {
    event.preventDefault();
    if (resolvedMergeFrom === resolvedMergeTo) {
      setMergeError("서로 다른 카테고리를 선택하세요.");
      return;
    }
    const from = categoryById(resolvedMergeFrom);
    const to = categoryById(resolvedMergeTo);
    if (!from || !to) return;
    try {
      if (dataMode === "api") {
        await mergeCategories(from.categoryId, to.categoryId, mergeReason.trim());
      } else {
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
      }
      setMergeReason("");
      setMergeError("");
    } catch (actionError) {
      setMergeError(actionError instanceof Error ? actionError.message : "카테고리를 병합하지 못했습니다.");
    }
  }

  async function onSplit(event: FormEvent) {
    event.preventDefault();
    const from = categoryById(resolvedSplitFrom);
    const name = splitName.trim();
    if (!from || name.length === 0) {
      setSplitError("나눌 카테고리와 새 이름이 필요합니다.");
      return;
    }
    if (dataMode === "api" && (splitComplaintIds.length === 0 || splitComplaintIds.length >= splitComplaints.length)) {
      setSplitError("분할할 민원을 한 건 이상 선택하고, 원본 카테고리에 한 건 이상 남겨야 합니다.");
      return;
    }
    try {
      if (dataMode === "api") {
        await splitCategory({
          sourceCategoryId: from.categoryId,
          name,
          group: from.group,
          definition: from.definition,
          complaintIds: splitComplaintIds,
          reason: splitReason.trim(),
        });
      } else {
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
      }
      setSplitName("");
      setSplitReason("");
      setSplitComplaintIds([]);
      setSplitError("");
    } catch (actionError) {
      setSplitError(actionError instanceof Error ? actionError.message : "카테고리를 분할하지 못했습니다.");
    }
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
      {dataMode === "api" && insights.length > 0 ? (
        <section className="stat-row" aria-label="민원 인사이트">
          {insights.map((insight) => (
            <article className="stat" key={insight.type}>
              <p className="stat-label">{insight.title}</p>
              <p className="stat-value">{formatNumber(insight.count)}건</p>
              <p className="caption">{insight.description}</p>
            </article>
          ))}
        </section>
      ) : null}
      <section className="layout-main-side">
        <article className="card card-scroll">
          <div className="bar-list">
            {groups.map((group) => {
              const open = resolvedOpenGroup === group.group;
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
        {canManage ? <div className="stack">
          <form className="card" onSubmit={onMerge}>
            <h2 className="title-sm">병합</h2>
            <div className="form-grid form-stack notice">
              <label className="field">
                <span>합칠 카테고리</span>
                <CategorySelect categories={categories} value={resolvedMergeFrom} onChange={setMergeFrom} />
              </label>
              <label className="field">
                <span>남길 카테고리</span>
                <CategorySelect categories={categories} value={resolvedMergeTo} onChange={setMergeTo} />
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
                <CategorySelect categories={categories} value={resolvedSplitFrom} onChange={(value) => {
                  setSplitFrom(value);
                  setSplitComplaintIds([]);
                }} />
              </label>
              <label className="field">
                <span>새 이름</span>
                <input className="input" value={splitName} onChange={(event) => setSplitName(event.target.value)} />
              </label>
              {dataMode === "api" ? (
                <fieldset className="field">
                  <legend>새 카테고리로 이동할 민원</legend>
                  <div className="stack notice">
                    {splitComplaints.map((complaint) => (
                      <label className="cluster" key={complaint.id}>
                        <input
                          type="checkbox"
                          checked={splitComplaintIds.includes(complaint.id)}
                          onChange={(event) => setSplitComplaintIds((current) => event.target.checked
                            ? [...current, complaint.id]
                            : current.filter((id) => id !== complaint.id))}
                        />
                        <span className="content-cell">{complaint.contentMasked}</span>
                      </label>
                    ))}
                    {splitComplaints.length < 2 ? <span className="caption">분할하려면 이 카테고리에 민원이 두 건 이상 있어야 합니다.</span> : null}
                  </div>
                </fieldset>
              ) : null}
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
            <p className="notice">관리자만 카테고리를 병합하거나 분할할 수 있습니다.</p>
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
