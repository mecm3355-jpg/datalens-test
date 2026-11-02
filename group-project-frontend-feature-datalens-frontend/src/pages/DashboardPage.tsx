import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { FILE_STATUS_LABEL } from "../lib/labels";
import { formatBytes, formatDate, formatNumber } from "../lib/format";
import type { ApiComplaintStats, ApiLabelCount } from "../api/datalens";
import { useComplaintData } from "../state/complaintData";
import { useWorkspace } from "../state/workspace";
import type { FileStatus } from "../types";

const STATUS_ORDER: FileStatus[] = ["completed", "processing", "queued", "failed"];
const StatusChart = lazy(() => import("../components/StatusChart").then((module) => ({ default: module.StatusChart })));

export function DashboardPage() {
  const workspace = useWorkspace();
  const { stats } = useComplaintData();
  const serverSummary = workspace.dashboardSummary;
  const statusCounts = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, workspace.files.filter((file) => file.status === status).length]),
  ) as Record<FileStatus, number>;
  const qualityRows = workspace.files.flatMap((file) => {
    const profile = workspace.cleaningArtifact(file.id)?.analysis?.quality;
    return profile ? [{ file, profile }] : [];
  });
  const localAverageQuality = qualityRows.length > 0
    ? Math.round(qualityRows.reduce((sum, row) => sum + row.profile.score, 0) / qualityRows.length)
    : null;
  const averageQuality = serverSummary?.quality.averageScore ?? localAverageQuality;
  const totalFiles = workspace.files.length;
  const recentFiles = [...workspace.files]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 6);
  const statusChartData = STATUS_ORDER.map((status) => ({ label: FILE_STATUS_LABEL[status], count: statusCounts[status] }));

  return (
    <div className="page">
      <PageIntro
        size="md"
        eyebrow="데이터 품질 작업공간"
        title="파일과 품질 상태를 한눈에"
        lede="파일 수집부터 형식 검증, 품질 진단, 규칙 승인, 정제 결과 비교와 다운로드까지 한 흐름으로 관리합니다."
        actions={
          <>
            <Button variant="pill" to="/files">파일 업로드</Button>
            <Button variant="secondary" to="/data">분석 리포트</Button>
          </>
        }
      />

      <section className="stat-row" aria-label="파일 처리 현황">
        <DashboardStat label="전체 파일" value={formatNumber(totalFiles)} foot="등록된 원본" />
        <DashboardStat label="완료" value={formatNumber(statusCounts.completed)} foot="분석 가능" />
        <DashboardStat label="처리 중" value={formatNumber(statusCounts.processing + statusCounts.queued)} foot="대기 포함" />
        <DashboardStat label="실패" value={formatNumber(statusCounts.failed)} foot="재시도 필요" />
        <DashboardStat label="평균 품질" value={averageQuality === null ? "—" : `${averageQuality}점`} foot="분석 완료 파일" />
      </section>

      {workspace.dataMode === "api" && stats ? <ComplaintOverview stats={stats} /> : null}

      <section className="split">
        <article className="card">
          <div className="card-head">
            <div><h2 className="title-sm">최근 파일</h2><p className="caption">파일별 처리 상태와 분석 지원 여부</p></div>
            <Link className="link" to="/files">전체 파일</Link>
          </div>
          <DataTable
            framed={false}
            rows={recentFiles}
            rowKey={(file) => file.id}
            empty="업로드한 파일이 없습니다."
            columns={[
              { key: "name", header: "파일", render: (file) => <Link className="link file-name-link" to={`/files/${file.id}`}>{file.originalName}</Link> },
              { key: "format", header: "형식", render: (file) => file.extension.toUpperCase() },
              { key: "size", header: "크기", numeric: true, render: (file) => formatBytes(file.sizeBytes) },
              { key: "status", header: "상태", render: (file) => <span className={`pill status-pill status-${file.status}`}>{FILE_STATUS_LABEL[file.status]}</span> },
              { key: "date", header: "등록일", numeric: true, render: (file) => formatDate(file.createdAt) },
            ]}
          />
        </article>

        <article className="card">
          <div className="card-head"><h2 className="title-sm">처리 상태 분포</h2></div>
          <Suspense fallback={<div className="chart-placeholder">차트를 불러오는 중입니다.</div>}>
            <StatusChart data={statusChartData} />
          </Suspense>
          <ul className="status-distribution">
            {STATUS_ORDER.map((status) => {
              const count = statusCounts[status];
              const percentage = totalFiles === 0 ? 0 : (count / totalFiles) * 100;
              return (
                <li key={status}>
                  <div className="status-distribution-label"><span>{FILE_STATUS_LABEL[status]}</span><span className="num">{formatNumber(count)}</span></div>
                  <div className="quality-track" aria-label={`${FILE_STATUS_LABEL[status]} ${percentage.toFixed(0)}%`}><span style={{ width: `${percentage}%` }} /></div>
                </li>
              );
            })}
          </ul>
          <div className="notice">
            <p className="caption">{workspace.dataMode === "api" ? "서버 처리 범위" : "데모 처리 범위"}</p>
            <p className="body">CSV·JSON·TXT·LOG는 내용과 기본 통계를 분석하고, JPG·PNG는 실제 형식과 해상도를 확인합니다.</p>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="card-head">
          <div><h2 className="title-sm">파일별 품질 지표</h2><p className="caption">완전성 35% · 유일성 25% · 유효성 20% · 일관성 20%</p></div>
          <Link className="link" to="/data">분석 상세</Link>
        </div>
        <DataTable
          framed={false}
          rows={qualityRows}
          rowKey={(row) => row.file.id}
          empty={workspace.dataMode === "api"
            ? "파일 상세에서 분석 결과를 열면 파일별 품질 지표가 표시됩니다. 전체 평균은 서버 집계를 사용합니다."
            : "브라우저에서 새 CSV 또는 JSON 파일을 업로드하면 품질 지표가 표시됩니다."}
          columns={[
            { key: "file", header: "파일", render: (row) => <Link className="link" to={`/files/${row.file.id}`}>{row.file.originalName}</Link> },
            { key: "score", header: "종합", numeric: true, render: (row) => `${row.profile.score}점` },
            { key: "complete", header: "완전성", numeric: true, render: (row) => `${row.profile.completeness}%` },
            { key: "unique", header: "유일성", numeric: true, render: (row) => `${row.profile.uniqueness}%` },
            { key: "valid", header: "유효성", numeric: true, render: (row) => `${row.profile.validity}%` },
            { key: "consistent", header: "일관성", numeric: true, render: (row) => `${row.profile.consistency}%` },
          ]}
        />
      </section>
    </div>
  );
}

/**
 * 서버가 집계한 민원 분류 현황을 보여 줍니다. 승인된 카테고리가 없는 첫 달에도
 * 승인 대기 후보(임시 분류)로 무엇이 모였는지 보이고, 승인·검토 화면으로 이어집니다.
 */
function ComplaintOverview({ stats }: { stats: ApiComplaintStats }) {
  if (stats.total === 0) {
    return (
      <section className="card" aria-label="민원 분류 현황">
        <div className="card-head"><h2 className="title-sm">민원 분류 현황</h2></div>
        <p className="body">아직 분석된 민원이 없습니다. 민원 CSV·XLSX를 올리면 진단 뒤 자동으로 분류합니다.</p>
      </section>
    );
  }
  const { assignment } = stats;
  const assigned = assignment.auto + assignment.confirmed;
  return (
    <>
      <section className="stat-row" aria-label="민원 분류 현황">
        <DashboardStat label="전체 민원" value={formatNumber(stats.total)} foot={stats.period ?? "전체 기간"} />
        <DashboardStat label="자동 배정" value={formatNumber(assignment.auto)} foot="기존 카테고리" />
        <DashboardStat label="사람 확정" value={formatNumber(assignment.confirmed)} foot="검토 완료" />
        <DashboardStat label="애매" value={formatNumber(assignment.ambiguous)} foot="검토 필요" />
        <DashboardStat label="미배정" value={formatNumber(assignment.unassigned)} foot="후보 승인 대기" />
      </section>

      <section className="split">
        <article className="card">
          <div className="card-head">
            <div>
              <h2 className="title-sm">승인 대기 후보</h2>
              <p className="caption">
                후보 {formatNumber(stats.pendingCandidateCount)}개 · 민원 {formatNumber(stats.pendingCandidateComplaints)}건
              </p>
            </div>
            <Link className="link" to="/categories/candidates">후보 승인</Link>
          </div>
          {assigned === 0 && stats.pendingCandidateCount > 0 ? (
            <p className="body notice">아직 승인된 카테고리가 없습니다. 후보를 승인하면 묶인 민원이 그 카테고리로 배정됩니다.</p>
          ) : null}
          <DataTable
            framed={false}
            rows={stats.pendingCandidates}
            rowKey={(candidate) => candidate.candidateId}
            empty="승인을 기다리는 후보가 없습니다."
            columns={[
              { key: "name", header: "제안 이름", render: (candidate) => candidate.suggestedName },
              { key: "group", header: "그룹", render: (candidate) => candidate.suggestedGroup ?? "—" },
              { key: "size", header: "민원", numeric: true, render: (candidate) => formatNumber(candidate.size) },
              { key: "keywords", header: "핵심어", render: (candidate) => candidate.keywords.slice(0, 3).join(", ") },
            ]}
          />
        </article>

        <article className="card">
          <div className="card-head">
            <div><h2 className="title-sm">분포</h2><p className="caption">배정된 민원의 상위 그룹, 전체 민원의 긴급도·지역</p></div>
            <Link className="link" to="/reviews">검토 대기 {formatNumber(stats.pendingReviews)}건</Link>
          </div>
          <CountBars title="상위 그룹" items={stats.groups.filter((item) => item.label !== null)} total={assigned} />
          <CountBars title="긴급도" items={stats.urgency} total={stats.total} />
          <CountBars title="지역" items={stats.regions.slice(0, 5)} total={stats.total} />
        </article>
      </section>
    </>
  );
}

/** 값별 건수를 막대 목록으로 보여 줍니다. 값이 없는 항목은 "미상"으로 표시합니다. */
function CountBars({ title, items, total }: { title: string; items: ApiLabelCount[]; total: number }) {
  if (items.length === 0) return null;
  return (
    <div className="notice">
      <p className="caption">{title}</p>
      <ul className="status-distribution">
        {items.map((item) => {
          const label = item.label ?? "미상";
          const percentage = total === 0 ? 0 : (item.count / total) * 100;
          return (
            <li key={label}>
              <div className="status-distribution-label"><span>{label}</span><span className="num">{formatNumber(item.count)}</span></div>
              <div className="quality-track" aria-label={`${label} ${percentage.toFixed(0)}%`}><span style={{ width: `${percentage}%` }} /></div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 대시보드 핵심 지표의 이름, 값, 보조 설명을 표시합니다. */
function DashboardStat({ label, value, foot }: { label: string; value: string; foot: string }) {
  return <article className="stat"><p className="stat-label">{label}</p><p className="stat-value">{value}</p><p className="stat-foot">{foot}</p></article>;
}
