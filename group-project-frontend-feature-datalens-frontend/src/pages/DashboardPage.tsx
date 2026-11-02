import { Link } from "react-router-dom";
import { PageIntro } from "../components/PageIntro";
import { formatNumber } from "../lib/format";
import type { ComplaintStats } from "../lib/remote";
import { useCatalog } from "../state/catalog";
import type { Category } from "../types";

/** 대시보드의 카테고리 한 줄: 이름과 분석된 민원 건수. */
type CategoryRow = { categoryId: string; name: string; count: number };

/** 상위 그룹 하나와 그 안의 카테고리들. */
type GroupRows = { group: string; count: number; rows: CategoryRow[] };

/**
 * 서버 집계(카테고리 ID별 건수)를 상위 그룹별로 묶는다. 건수 많은 순, 0건 카테고리는 뒤에 둔다.
 * @param categories 현재 체계의 카테고리(이름·그룹)
 * @param stats 서버 집계
 */
export function groupRows(categories: Category[], stats: ComplaintStats): GroupRows[] {
  const counts = new Map(stats.categoriesTotal.flatMap((item) => (item.label ? [[item.label, item.count] as const] : [])));
  const groups = new Map<string, CategoryRow[]>();
  for (const category of categories) {
    const rows = groups.get(category.group) ?? [];
    rows.push({ categoryId: category.categoryId, name: category.name, count: counts.get(category.categoryId) ?? 0 });
    groups.set(category.group, rows);
  }
  return [...groups.entries()]
    .map(([group, rows]) => ({
      group,
      count: rows.reduce((sum, row) => sum + row.count, 0),
      rows: [...rows].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko")),
    }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group, "ko"));
}

/** 분석을 마친 민원을 카테고리별 건수로 보여 줍니다. */
export function DashboardPage() {
  const { categories, stats, status } = useCatalog();

  if (!stats) {
    return (
      <div className="page">
        <PageIntro title="카테고리별 민원" lede={status === "loading" ? "불러오는 중입니다." : "집계를 불러오지 못했습니다."} />
      </div>
    );
  }

  const unassigned = stats.categoriesTotal.find((item) => item.label === null)?.count ?? 0;
  const groups = groupRows(categories, stats);
  const max = Math.max(1, ...groups.flatMap((group) => group.rows.map((row) => row.count)), unassigned);

  return (
    <div className="page">
      <PageIntro
        title="카테고리별 민원"
        lede={
          stats.total > 0
            ? `분석을 마친 민원 ${formatNumber(stats.total)}건 · 카테고리 배정 ${formatNumber(stats.total - unassigned)}건 · 미분류 ${formatNumber(unassigned)}건`
            : "아직 분석된 민원이 없습니다. 파일 메뉴에서 파일을 올리면 자동으로 분석합니다."
        }
      />

      {stats.total === 0 ? (
        <Link className="link" to="/files">
          파일 올리러 가기
        </Link>
      ) : null}

      {groups.map((group) => (
        <section className="card" key={group.group} aria-label={`${group.group} ${group.count}건`}>
          <div className="card-head">
            <h2 className="title-sm">{group.group}</h2>
            <span className="num">{formatNumber(group.count)}건</span>
          </div>
          <ul className="category-counts">
            {group.rows.map((row) => (
              <CountRow key={row.categoryId} label={row.name} count={row.count} max={max} />
            ))}
          </ul>
        </section>
      ))}

      {unassigned > 0 ? (
        <section className="card" aria-label={`미분류 ${unassigned}건`}>
          <div className="card-head">
            <h2 className="title-sm">미분류</h2>
            <span className="num">{formatNumber(unassigned)}건</span>
          </div>
          <p className="caption">
            {stats.pendingCandidateCount > 0
              ? `비슷한 민원끼리 신규 후보 ${stats.pendingCandidateCount}개로 묶어 두었습니다. 후보를 승인하면 카테고리가 생기고 그 민원이 배정됩니다.`
              : "아직 어느 카테고리에도 속하지 않은 민원입니다."}
          </p>
          {stats.pendingCandidates.length > 0 ? (
            <ul className="category-counts">
              {stats.pendingCandidates.map((candidate) => (
                <CountRow
                  key={candidate.candidateId}
                  label={`${candidate.suggestedName} (후보)`}
                  count={candidate.size}
                  max={max}
                />
              ))}
            </ul>
          ) : null}
          {stats.pendingCandidateCount > 0 ? (
            <Link className="link" to="/categories/candidates">
              후보 승인하러 가기
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** 이름, 건수, 가장 많은 항목 대비 막대. */
function CountRow({ label, count, max }: { label: string; count: number; max: number }) {
  const width = (count / max) * 100;
  return (
    <li className="category-count">
      <span className="category-count-name">{label}</span>
      <span className="category-count-bar" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
      <span className="num category-count-value">{formatNumber(count)}건</span>
    </li>
  );
}
