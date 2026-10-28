import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Delta } from "../components/Delta";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { Button } from "../components/Button";
import { TrendChart } from "../components/TrendChart";
import {
  assignmentSummary,
  candidates,
  categories,
  categoryById,
  complaints,
  CURRENT_PERIOD,
  groupedCategories,
  healthTrend,
  isPriority,
  issues,
  monthlyTrend,
  PREVIOUS_TOTAL,
  regions,
  reviews,
  surges,
  TAXONOMY_VERSION,
  urgencyCounts,
} from "../data/mock";
import { formatNumber, formatPercent, formatPeriod, percentOf } from "../lib/format";
import { useWorkspace } from "../state/workspace";
import type { Urgency } from "../types";

const URGENCY_CLASS: Record<Urgency, string> = {
  긴급: "stack-urgent",
  높음: "stack-high",
  보통: "stack-normal",
  낮음: "stack-low",
};

export function DashboardPage() {
  const workspace = useWorkspace();
  const groups = groupedCategories();
  const [openGroup, setOpenGroup] = useState<string | null>(groups[0]?.group ?? null);
  const maxCount = groups[0]?.count ?? 1;
  const categorized = assignmentSummary.auto + assignmentSummary.confirmed;
  const pendingCandidates = candidates.filter((item) => workspace.candidateDecision(item.id) === "pending");
  const pendingReviews = reviews.filter((item) => workspace.reviewState(item.id).status === "pending");
  const openIssues = issues
    .filter((issue) => issue.status === "open")
    .sort((a, b) => b.complaintCount - a.complaintCount);
  const newCategory = categories.find((category) => category.previousCount === 0);
  const prioritySamples = complaints.filter(isPriority).slice(0, 3);
  const urgencyTotal = urgencyCounts.reduce((sum, item) => sum + item.count, 0);
  const latestHealth = healthTrend[healthTrend.length - 1];
  const priorAverage =
    healthTrend.slice(-4, -1).reduce((sum, point) => sum + point.unassigned, 0) / 3;
  const healthRising = latestHealth !== undefined && latestHealth.unassigned > priorAverage;

  return (
    <div className="page">
      <PageIntro
        size="md"
        eyebrow={`${formatPeriod(CURRENT_PERIOD)} · 체계 v${TAXONOMY_VERSION}`}
        title="민원 동향"
        lede="카테고리별 건수, 전월 대비 증감, 급증·신규 유형을 한 화면에서 봅니다. 집계 수치는 샘플 총량이고, 목록은 대표 민원만 담았습니다."
        actions={
          <>
            <Button variant="pill" to="/files">
              파일 올리기
            </Button>
            <Button variant="secondary" to="/reviews">
              검토 {formatNumber(pendingReviews.length)}
            </Button>
          </>
        }
      />

      <section className="stat-row" aria-label="배정 상태">
        <Stat label="전체 민원" value={assignmentSummary.total} foot={<Delta current={assignmentSummary.total} previous={PREVIOUS_TOTAL} />} />
        <Stat label="자동 배정" value={assignmentSummary.auto} foot={<Rate part={assignmentSummary.auto} />} />
        <Stat label="애매" value={assignmentSummary.ambiguous} foot={<Rate part={assignmentSummary.ambiguous} />} />
        <Stat label="미배정" value={assignmentSummary.unassigned} foot={<Rate part={assignmentSummary.unassigned} />} />
        <Stat label="사람 확정" value={assignmentSummary.confirmed} foot={<Rate part={assignmentSummary.confirmed} />} />
      </section>

      <section className="split">
        <article className="card card-scroll">
          <div className="card-head">
            <h2 className="title-sm">카테고리별 건수</h2>
            <Link className="link" to="/categories">
              체계 보기
            </Link>
          </div>
          <p className="caption">배정된 {formatNumber(categorized)}건. 애매·미배정은 빠집니다.</p>
          <div className="bar-list">
            {groups.map((group, index) => {
              const open = openGroup === group.group;
              return (
                <div key={group.group}>
                  <button
                    type="button"
                    className="bar-row"
                    aria-expanded={open}
                    onClick={() => setOpenGroup(open ? null : group.group)}
                  >
                    <span className="bar-name">{group.group}</span>
                    <span className="bar-track">
                      <span
                        className={index === 0 ? "bar-fill is-lead" : "bar-fill"}
                        style={{ width: `${(group.count / maxCount) * 100}%` }}
                      />
                    </span>
                    <span className="bar-count num">{formatNumber(group.count)}</span>
                    <Delta current={group.count} previous={group.previousCount} />
                  </button>
                  {open
                    ? group.categories.map((category) => (
                        <div className="bar-child" key={category.categoryId}>
                          <Link className="link" to={`/complaints?category=${category.categoryId}`}>
                            {category.name}
                          </Link>
                          <span className="bar-track">
                            <span className="bar-fill" style={{ width: `${(category.count / maxCount) * 100}%` }} />
                          </span>
                          <span className="bar-count num">{formatNumber(category.count)}</span>
                          <Delta current={category.count} previous={category.previousCount} />
                        </div>
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">이번 달 인사이트</h2>
          </div>
          {newCategory ? (
            <section className="insight">
              <p className="caption">이달의 신규 카테고리</p>
              <h3 className="title-sm">{newCategory.name}</h3>
              <p className="body">
                {formatNumber(newCategory.count)}건 · {newCategory.group}
              </p>
              <Link className="link" to="/categories">
                체계에서 보기
              </Link>
            </section>
          ) : null}
          <section className="insight">
            <p className="caption">승인 대기 후보</p>
            <h3 className="title-sm">{formatNumber(pendingCandidates.length)}건</h3>
            <p className="body">미배정 풀에서 최소 규모를 넘긴 군집입니다.</p>
            <Link className="link" to="/categories/candidates">
              후보 검토
            </Link>
          </section>
          {surges.map((surge) => {
            const category = categoryById(surge.categoryId);
            return (
              <section className="insight" key={surge.categoryId}>
                <p className="caption">급증</p>
                <h3 className="title-sm">{category?.name}</h3>
                <p className="body">
                  이번 달 {formatNumber(surge.count)}건 · 직전 3개월 평균 {formatNumber(surge.baseline)}건의{" "}
                  <span className="num">{(surge.count / surge.baseline).toFixed(1)}배</span>
                </p>
                <Link className="link" to={`/complaints?category=${surge.categoryId}`}>
                  대표 민원
                </Link>
              </section>
            );
          })}
          {openIssues[0] ? (
            <section className="insight">
              <p className="caption">반복 이슈</p>
              <h3 className="title-sm">{openIssues[0].place}</h3>
              <p className="body">
                {categoryById(openIssues[0].categoryId)?.name} · {formatNumber(openIssues[0].complaintCount)}건
              </p>
              <Link className="link" to={`/issues/${openIssues[0].id}`}>
                이슈 보기
              </Link>
            </section>
          ) : null}
        </article>
      </section>

      <section className="split">
        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">월별 추이</h2>
          </div>
          <TrendChart points={monthlyTrend} />
          <p className="caption notice">병합·분할된 카테고리는 최신 체계 기준으로 다시 집계합니다.</p>
        </article>
        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">긴급도</h2>
            <Link className="link" to="/complaints?focus=priority">
              우선 확인
            </Link>
          </div>
          <div className="stack-bar" aria-hidden="true">
            {urgencyCounts.map((item) => (
              <span
                key={item.urgency}
                className={`stack-seg ${URGENCY_CLASS[item.urgency]}`}
                style={{ width: `${(item.count / urgencyTotal) * 100}%` }}
              />
            ))}
          </div>
          <ul className="legend">
            {urgencyCounts.map((item) => (
              <li key={item.urgency}>
                <span className={`swatch ${URGENCY_CLASS[item.urgency]}`} />
                <span>{item.urgency}</span>
                <span className="num">
                  {formatNumber(item.count)} · {formatPercent(percentOf(item.count, urgencyTotal))}
                </span>
              </li>
            ))}
          </ul>
          <div className="notice">
            {prioritySamples.map((item) => (
              <p key={item.id}>
                <Link className="link" to={`/complaints/${item.id}`}>
                  {item.id}
                </Link>{" "}
                <span className="body">{item.attributes.urgency} · {item.attributes.affected ?? "대상 없음"}</span>
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="split">
        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">지역별 분포</h2>
          </div>
          <p className="caption">절대 건수입니다.</p>
          <DataTable
            framed={false}
            rows={regions}
            rowKey={(row) => row.name}
            empty="지역 집계가 없습니다."
            columns={[
              { key: "name", header: "행정동", render: (row) => row.name },
              { key: "count", header: "건수", numeric: true, render: (row) => formatNumber(row.count) },
              {
                key: "share",
                header: "비율",
                numeric: true,
                render: (row) => formatPercent(percentOf(row.count, assignmentSummary.total)),
              },
            ]}
          />
        </article>
        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">체계 건강도</h2>
          </div>
          <p className="body">
            {healthRising
              ? "미배정 비율이 직전 3개월 평균보다 높습니다. 신규 후보 승인과 분기 정리를 볼 차례입니다."
              : "미배정 비율이 직전 3개월 평균 안에 있습니다."}
          </p>
          <DataTable
            framed={false}
            rows={healthTrend}
            rowKey={(row) => row.period}
            empty="추이가 없습니다."
            columns={[
              { key: "period", header: "월", render: (row) => formatPeriod(row.period) },
              {
                key: "unassigned",
                header: "미배정",
                numeric: true,
                render: (row) => formatPercent(row.unassigned),
              },
              {
                key: "ambiguous",
                header: "애매",
                numeric: true,
                render: (row) => formatPercent(row.ambiguous),
              },
            ]}
          />
        </article>
      </section>
    </div>
  );
}

function Stat({ label, value, foot }: { label: string; value: number; foot: ReactNode }) {
  return (
    <article className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{formatNumber(value)}</p>
      <div className="stat-foot">{foot}</div>
    </article>
  );
}

function Rate({ part }: { part: number }) {
  return <span className="num">{formatPercent(percentOf(part, assignmentSummary.total))}</span>;
}
