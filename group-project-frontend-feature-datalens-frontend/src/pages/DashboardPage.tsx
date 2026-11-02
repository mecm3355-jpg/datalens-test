import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { formatDate } from "../lib/format";
import { FILE_STATUS_LABEL } from "../lib/labels";
import { useCatalog } from "../state/catalog";
import type { Category, Complaint, DataFile } from "../types";

const ACCEPT = ".csv,.tsv,.xlsx,.xls,.docx,.pdf,.txt,.jpg,.jpeg,.png,.hwpx,.hwp";
const RECENT_LIMIT = 5;

/** 파일의 카테고리 상태: 민원 없음, 미분류, 하나로 정리됨, 여러 카테고리. */
type FileCategoryState =
  | { kind: "empty" }
  | { kind: "unassigned" }
  | { kind: "single"; categoryId: string }
  | { kind: "mixed"; count: number };

function byNewest(a: DataFile, b: DataFile): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * 서버에 저장된 민원 배정으로 파일의 카테고리 상태를 구합니다.
 * @param complaints 그 파일의 민원
 */
function fileCategoryOf(complaints: Complaint[]): FileCategoryState {
  if (complaints.length === 0) return { kind: "empty" };
  const ids = new Set(complaints.map((item) => item.categoryId).filter((id): id is string => id !== null));
  if (ids.size === 0) return { kind: "unassigned" };
  const assignedAll = complaints.every((item) => item.categoryId !== null);
  if (ids.size === 1 && assignedAll) return { kind: "single", categoryId: [...ids][0] };
  return { kind: "mixed", count: ids.size };
}

export function DashboardPage() {
  const { files, categories, uploadFiles, assignFileCategory, complaintsByFile, status, busy, error } = useCatalog();
  const [targetId, setTargetId] = useState<string | null>(null);
  const sorted = useMemo(() => [...files].sort(byNewest), [files]);
  const target = sorted.find((file) => file.id === targetId) ?? sorted[0] ?? null;
  const recent = sorted.slice(0, RECENT_LIMIT);
  const targetState = target ? fileCategoryOf(complaintsByFile(target.id)) : null;
  const selected = targetState?.kind === "single" ? targetState.categoryId : "";
  const groups = groupCategories(categories);
  const canChoose = target !== null && categories.length > 0 && targetState?.kind !== "empty";

  return (
    <div className="page">
      <section className="upload-hero" aria-labelledby="dash-upload">
        <div className="upload-hero-copy">
          <p className="upload-hero-kicker">데이터 수집·정제·분석</p>
          <h2 id="dash-upload">파일 품질을 진단하고 정제합니다</h2>
          <p>
            파일을 올리면 형식을 검증하고, 누락값·중복·형식 오류를 진단합니다. 승인한 규칙으로 정제한
            결과를 비교하고 AI 리포트를 확인합니다.
          </p>
        </div>
        <div className="upload-hero-actions">
          <label className="btn btn-pill upload-hero-upload">
            <input
              className="upload-input"
              type="file"
              multiple
              accept={ACCEPT}
              disabled={busy}
              onChange={(event) => {
                const picked = event.target.files;
                if (!picked || picked.length === 0) return;
                const list = [...picked];
                event.target.value = "";
                void uploadFiles(list).then((ids) => {
                  const newest = ids.at(-1);
                  if (newest) setTargetId(newest);
                });
              }}
            />
            파일 업로드
          </label>
          <Link className="btn upload-hero-report" to={target ? `/files/${target.id}` : "/files"}>
            분석 리포트
          </Link>
        </div>
      </section>

      <section className="card" aria-labelledby="dash-category">
        <div className="card-head">
          <h2 id="dash-category" className="title-sm">
            카테고리
          </h2>
        </div>
        <div className="stack">
          <p className="body">
            대상 파일 <span className="num">{target?.originalName ?? "올린 파일이 없습니다"}</span>
          </p>
          <label className="field">
            <span>DB 카테고리</span>
            <select
              className="select"
              value={selected}
              disabled={busy || !canChoose}
              onChange={(event) => {
                const categoryId = event.target.value;
                if (target && categoryId) void assignFileCategory(target.id, categoryId);
              }}
            >
              <option value="" disabled>
                {targetState?.kind === "mixed" ? `여러 카테고리 (${targetState.count}개)` : "카테고리 선택"}
              </option>
              {groups.map((group) => (
                <optgroup key={group.name} label={group.name}>
                  {group.items.map((category) => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {sorted.length > 1 ? (
            <label className="field">
              <span>다른 파일</span>
              <select className="select" value={target?.id ?? ""} onChange={(event) => setTargetId(event.target.value)}>
                {sorted.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.originalName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="caption">{categoryHint(target, targetState, categories.length)}</p>
          {categories.length === 0 ? (
            <Link className="link" to="/categories/candidates">
              신규 후보 승인하러 가기
            </Link>
          ) : null}
          {error ? (
            <p className="feedback feedback-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="card" aria-labelledby="dash-files">
        <div className="card-head">
          <h2 id="dash-files" className="title-sm">
            최근 파일
          </h2>
          <Button variant="secondary" to="/files">
            더보기
          </Button>
        </div>
        <DataTable
          framed={false}
          rows={recent}
          rowKey={(file) => file.id}
          empty={status === "loading" ? "파일 목록을 불러오는 중입니다." : "올린 파일이 없습니다."}
          columns={[
            {
              key: "name",
              header: "파일",
              render: (file) => (
                <Link className="link" to={`/files/${file.id}`}>
                  {file.originalName}
                </Link>
              ),
            },
            {
              key: "category",
              header: "카테고리",
              render: (file) => categoryLabel(categories, fileCategoryOf(complaintsByFile(file.id))),
            },
            {
              key: "status",
              header: "상태",
              render: (file) => <span className="pill">{FILE_STATUS_LABEL[file.status]}</span>,
            },
            { key: "date", header: "올린 날", numeric: true, render: (file) => formatDate(file.createdAt) },
          ]}
        />
      </section>
    </div>
  );
}

function groupCategories(categories: Category[]): Array<{ name: string; items: Category[] }> {
  const map = new Map<string, Category[]>();
  for (const category of categories) {
    const items = map.get(category.group) ?? [];
    items.push(category);
    map.set(category.group, items);
  }
  return [...map.entries()].map(([name, items]) => ({
    name,
    items: [...items].sort((a, b) => a.name.localeCompare(b.name, "ko")),
  }));
}

/**
 * 최근 파일 표의 카테고리 칸 문구입니다.
 * @param categories 현재 체계의 카테고리
 * @param state 파일의 카테고리 상태
 */
function categoryLabel(categories: Category[], state: FileCategoryState): string {
  switch (state.kind) {
    case "empty":
      return "—";
    case "unassigned":
      return "미분류";
    case "mixed":
      return `여러 카테고리 (${state.count}개)`;
    case "single":
      return categories.find((category) => category.categoryId === state.categoryId)?.name ?? "—";
  }
}

/**
 * 카테고리 선택 칸 아래 안내 문구입니다. 고를 수 없을 때는 그 이유를 알려 줍니다.
 * @param target 대상 파일
 * @param state 대상 파일의 카테고리 상태
 * @param categoryCount 현재 체계의 카테고리 수
 */
function categoryHint(target: DataFile | null, state: FileCategoryState | null, categoryCount: number): string {
  if (!target) return "파일을 올리면 민원을 자동으로 분석하고, 여기서 파일의 카테고리를 정할 수 있습니다.";
  if (categoryCount === 0) return "승인된 카테고리가 아직 없습니다. 분석으로 생긴 신규 후보를 승인하면 고를 수 있습니다.";
  if (state?.kind === "empty") return "이 파일은 아직 분석된 민원이 없습니다. 자동 분석이 끝나면 고를 수 있습니다.";
  return "고르면 이 파일의 민원 전체를 그 카테고리로 확정해 서버에 저장합니다(관리자만).";
}
