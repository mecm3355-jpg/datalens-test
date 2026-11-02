import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { CategoryTabs } from "../components/CategoryTabs";
import { DataTable } from "../components/DataTable";
import { Delta } from "../components/Delta";
import { PageIntro } from "../components/PageIntro";
import { formatDate, formatNumber } from "../lib/format";
import { useCatalog } from "../state/catalog";
import type { Mapping } from "../types";

export function CategoriesPage() {
  const { categories, categoryById, groupedCategories, taxonomyVersion } = useCatalog();
  const groups = groupedCategories();
  const mappings: Mapping[] = [];
  const [openGroup, setOpenGroup] = useState<string | null>(groups[0]?.group ?? null);
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
    if (!categoryById(mergeFrom) || !categoryById(mergeTo)) return;
    setMergeError("서버에 카테고리 병합 API가 아직 없습니다. 신규 후보를 기존 카테고리에 합칠 수는 있습니다.");
  }

  function onSplit(event: FormEvent) {
    event.preventDefault();
    if (!categoryById(splitFrom) || splitName.trim().length === 0) {
      setSplitError("나눌 카테고리와 새 이름이 필요합니다.");
      return;
    }
    setSplitError("서버에 카테고리 분할 API가 아직 없습니다.");
  }

  return (
    <div className="page">
      <PageIntro
        eyebrow={`체계 v${taxonomyVersion}`}
        title="카테고리"
        lede={`활성 ${formatNumber(categories.length)}개 · 상위 그룹 ${formatNumber(groups.length)}개. 분기마다 겹치는 범주는 합치고, 너무 커진 범주는 나눕니다.`}
      />
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
        <div className="stack">
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
        </div>
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

function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Array<{ categoryId: string; group: string; name: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
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
