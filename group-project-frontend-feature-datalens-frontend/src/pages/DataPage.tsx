import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { formatNumber } from "../lib/format";
import { useWorkspace } from "../state/workspace";

export function DataPage() {
  const workspace = useWorkspace();
  const ensureFileData = workspace.ensureFileData;
  const analyzableFiles = workspace.files.filter((file) => (
    file.status === "completed" && file.analysisSupported !== false && file.fileCategory !== "other"
  ));
  const [selectedId, setSelectedId] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const activeId = selectedId || analyzableFiles[0]?.id || "";
  const file = workspace.files.find((item) => item.id === activeId);
  const analysis = workspace.cleaningArtifact(activeId)?.analysis;
  const fallbackReport = useMemo(() => {
    if (!file || !analysis) return [];
    const lines = [`${file.originalName}은(는) ${analysis.detectedFormat} 형식으로 확인되었습니다.`];
    if (analysis.quality) {
      lines.push(`가중 품질 점수는 ${analysis.quality.score}점이며, 결측 셀 ${formatNumber(analysis.quality.missingCells)}개와 중복 행 ${formatNumber(analysis.quality.duplicateRows)}개가 확인되었습니다.`);
      const lowest = [
        ["완전성", analysis.quality.completeness],
        ["유일성", analysis.quality.uniqueness],
        ["유효성", analysis.quality.validity],
        ["일관성", analysis.quality.consistency],
      ].sort((left, right) => Number(left[1]) - Number(right[1]))[0];
      lines.push(`가장 낮은 지표는 ${lowest[0]} ${lowest[1]}%입니다. 정제 규칙의 예상 영향을 확인한 뒤 필요한 규칙만 승인하세요.`);
    } else if (analysis.imageMetadata) {
      lines.push(`이미지 해상도는 ${analysis.imageMetadata.width ?? "확인 불가"} × ${analysis.imageMetadata.height ?? "확인 불가"}입니다.`);
    } else {
      lines.push("이 형식은 기본 메타데이터만 제공하며 내용 기반 품질 분석은 지원하지 않습니다.");
    }
    return lines;
  }, [analysis, file]);
  const report = workspace.reportForFile(activeId);

  useEffect(() => {
    if (activeId) void ensureFileData(activeId);
  }, [activeId, ensureFileData]);

  const createReport = async () => {
    if (!activeId) return;
    setReportLoading(true);
    setReportError(null);
    try {
      await workspace.requestReport(activeId);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "리포트를 생성하지 못했습니다.");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow="분석 및 리포트"
        title="데이터 품질 리포트"
        lede="서버가 업로드 파일에서 계산한 통계와 규칙 기반 해석을 구분해 보여줍니다."
      />

      <section className="card">
        <div className="card-head">
          <div><h2 className="title-sm">분석 파일 선택</h2><p className="caption">처리가 끝나고 분석 결과가 있는 파일</p></div>
          <Link className="link" to="/files">파일 업로드</Link>
        </div>
        {analyzableFiles.length > 0 ? (
          <label className="field">
            <span>파일</span>
            <select className="select" value={activeId} onChange={(event) => setSelectedId(event.target.value)}>
              {analyzableFiles.map((item) => <option key={item.id} value={item.id}>{item.originalName}</option>)}
            </select>
          </label>
        ) : <p className="empty">CSV, JSON, TXT, LOG, JPG 또는 PNG 파일을 업로드하면 분석 리포트가 생성됩니다.</p>}
      </section>

      {file && analysis ? (
        <>
          {analysis.quality ? (
            <section className="stat-row" aria-label="선택 파일 품질 지표">
              <ReportStat label="종합 품질" value={`${analysis.quality.score}점`} />
              <ReportStat label="완전성" value={`${analysis.quality.completeness}%`} />
              <ReportStat label="유일성" value={`${analysis.quality.uniqueness}%`} />
              <ReportStat label="유효성" value={`${analysis.quality.validity}%`} />
              <ReportStat label="일관성" value={`${analysis.quality.consistency}%`} />
            </section>
          ) : null}

          <section className="split">
            <article className="card">
              <div className="card-head"><h2 className="title-sm">계산된 통계</h2><span className="pill">서버 계산</span></div>
              {analysis.numericSummaries.length > 0 ? (
                <DataTable
                  framed={false}
                  rows={analysis.numericSummaries}
                  rowKey={(row) => row.field}
                  empty="수치형 데이터가 없습니다."
                  columns={[
                    { key: "field", header: "열", render: (row) => row.field },
                    { key: "count", header: "값 수", numeric: true, render: (row) => formatNumber(row.count) },
                    { key: "average", header: "평균", numeric: true, render: (row) => row.average.toFixed(2) },
                    { key: "minimum", header: "최솟값", numeric: true, render: (row) => row.minimum.toLocaleString("ko-KR") },
                    { key: "maximum", header: "최댓값", numeric: true, render: (row) => row.maximum.toLocaleString("ko-KR") },
                  ]}
                />
              ) : analysis.textStats ? (
                <dl className="attr-grid">
                  <div className="attr"><dt>줄</dt><dd className="num">{formatNumber(analysis.textStats.lines)}</dd></div>
                  <div className="attr"><dt>단어</dt><dd className="num">{formatNumber(analysis.textStats.words)}</dd></div>
                  <div className="attr"><dt>문자</dt><dd className="num">{formatNumber(analysis.textStats.characters)}</dd></div>
                </dl>
              ) : <p className="empty">이 파일에서 계산할 수치형 통계가 없습니다.</p>}
            </article>

            <article className="card">
              <div className="card-head"><h2 className="title-sm">범주·텍스트 빈도</h2></div>
              {analysis.frequencies.length > 0 ? (
                <ol className="frequency-list">
                  {analysis.frequencies.map((item) => <li key={item.value}><span>{item.value}</span><span className="num">{formatNumber(item.count)}</span></li>)}
                </ol>
              ) : <p className="empty">반복되는 짧은 텍스트 값이 없습니다.</p>}
            </article>
          </section>

          <article className="card report-card">
            <div className="card-head">
              <div>
                <h2 className="title-sm">분석 요약</h2>
                <p className="caption">{workspace.dataMode === "api" ? "백엔드 생성 리포트" : "데모 규칙 기반 요약"}</p>
              </div>
              {workspace.dataMode === "api" ? (
                <Button onClick={() => void createReport()} disabled={reportLoading}>
                  {reportLoading ? "생성 중…" : report ? "리포트 다시 생성" : "리포트 생성"}
                </Button>
              ) : <span className="pill pill-pending">자동 적용 안 함</span>}
            </div>
            {reportError ? <p className="feedback feedback-error" role="alert">{reportError}</p> : null}
            {report ? (
              <>
                <p className="body report-line">{report.summary}</p>
                {report.keyFindings.map((finding) => <p className="body report-line" key={finding}>• {finding}</p>)}
                {report.qualityIssues.length > 0 ? (
                  <DataTable
                    framed={false}
                    rows={report.qualityIssues}
                    rowKey={(issue) => `${issue.issue}:${issue.impact}`}
                    empty="해석된 품질 문제가 없습니다."
                    columns={[
                      { key: "severity", header: "정도", render: (issue) => issue.severity },
                      { key: "issue", header: "문제", render: (issue) => issue.issue },
                      { key: "cause", header: "추정 원인", render: (issue) => issue.likelyCause },
                      { key: "impact", header: "영향", render: (issue) => issue.impact },
                    ]}
                  />
                ) : null}
                {report.cleaningRecommendations.map((recommendation) => (
                  <p className="body report-line" key={`${recommendation.action}:${recommendation.reason}`}>
                    <strong>{recommendation.action}</strong> — {recommendation.reason}
                  </p>
                ))}
                {report.analysisSuggestions.map((suggestion) => <p className="body report-line" key={suggestion}>분석 제안: {suggestion}</p>)}
                {report.caveats.map((caveat) => <p className="caption notice" key={caveat}>{caveat}</p>)}
              </>
            ) : workspace.dataMode === "demo" ? (
              fallbackReport.map((line) => <p className="body report-line" key={line}>{line}</p>)
            ) : <p className="empty">리포트 생성 버튼을 누르면 서버가 최신 분석 결과로 리포트를 만듭니다.</p>}
            <p className="caption notice">AI 연결 후에도 통계 수치는 백엔드 계산 결과만 인용하고, 추천 규칙은 사용자 승인 전까지 실행하지 않습니다.</p>
          </article>
        </>
      ) : null}
    </div>
  );
}

/** 리포트 화면의 단일 품질 지표를 숫자 카드로 표시합니다. */
function ReportStat({ label, value }: { label: string; value: string }) {
  return <article className="stat"><p className="stat-label">{label}</p><p className="stat-value">{value}</p></article>;
}
