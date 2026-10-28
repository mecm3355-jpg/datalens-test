import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { cleaningPreviewByFile, cleaningRulesByFile } from "../data/mock";
import { downloadText, toCsv } from "../lib/download";
import { formatNumber } from "../lib/format";
import { useWorkspace } from "../state/workspace";
import type { CleaningDecision } from "../types";

const DECISION_LABEL: Record<CleaningDecision, string> = {
  pending: "검토 대기",
  approved: "승인",
  rejected: "제외",
};

export function FileCleaningPage() {
  const { fileId = "" } = useParams();
  const { files, cleaningDecision, decideCleaningRule } = useWorkspace();
  const file = files.find((item) => item.id === fileId);
  const [showChangedOnly, setShowChangedOnly] = useState(true);
  const [applied, setApplied] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const rules = useMemo(() => cleaningRulesByFile(fileId), [fileId]);
  const preview = cleaningPreviewByFile[fileId] ?? [];
  const approvedRuleIds = useMemo(
    () => new Set(rules.filter((rule) => cleaningDecision(fileId, rule.id) === "approved").map((rule) => rule.id)),
    [cleaningDecision, fileId, rules],
  );
  const approvedCount = approvedRuleIds.size;
  const rejectedCount = rules.filter((rule) => cleaningDecision(fileId, rule.id) === "rejected").length;
  const pendingCount = rules.length - approvedCount - rejectedCount;

  if (!file) {
    return (
      <div className="page">
        <PageIntro title="파일을 찾을 수 없습니다" />
        <Button variant="secondary" to="/files">파일 목록</Button>
      </div>
    );
  }

  if (file.status !== "completed") {
    return (
      <div className="page">
        <PageIntro
          eyebrow="정제 준비 중"
          title={file.originalName}
          lede="파일 처리가 완료된 뒤 정제 규칙을 검토할 수 있습니다."
          actions={<Button variant="secondary" to={`/files/${file.id}`}>상세로 돌아가기</Button>}
        />
        <article className="card">
          <p className="title-sm">현재 상태에서는 정제를 시작할 수 없습니다.</p>
          <p className="notice">파일 상세 화면에서 처리 상태를 확인하거나 실패한 작업을 다시 시도해 주세요.</p>
        </article>
      </div>
    );
  }

  const setDecision = (ruleId: string, decision: CleaningDecision) => {
    decideCleaningRule(fileId, ruleId, decision);
    setApplied(false);
    setDownloadError(null);
  };

  const applyRules = () => {
    if (approvedCount === 0) return;
    setApplied(true);
    setDownloadError(null);
  };

  const downloadResult = () => {
    try {
      const approvedRows = preview.filter((row) => approvedRuleIds.has(row.ruleId));
      const rows = approvedRows.map((row) => ({
        행: row.row,
        필드: row.field,
        정제전: row.before,
        정제후: row.after,
      }));
      const fallbackRows = [{
        파일명: file.originalName,
        적용규칙수: approvedCount,
        상태: "정제 완료",
      }];
      const baseName = file.originalName.replace(/\.[^.]+$/, "");
      downloadText(`${baseName}_정제결과.csv`, toCsv(rows.length > 0 ? rows : fallbackRows));
      setDownloadError(null);
    } catch {
      setDownloadError("정제 결과를 다운로드하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const comparisonRows = preview
    .map((row) => {
      const decision = cleaningDecision(fileId, row.ruleId);
      return {
        ...row,
        decision,
        effectiveAfter: decision === "rejected" ? row.before : row.after,
      };
    })
    .filter((row) => !applied || row.decision === "approved");
  const changedComparisonRows = comparisonRows.filter((row) => row.before !== row.effectiveAfter);
  const visibleRows = showChangedOnly
    ? changedComparisonRows
    : comparisonRows;

  return (
    <div className="page">
      <PageIntro
        eyebrow="정제 결과"
        title={file.originalName}
        lede="추천 규칙을 검토하고 승인한 변경만 적용한 뒤 결과 파일을 내려받으세요."
        actions={
          <>
            <Button variant="secondary" to={`/files/${file.id}`}>파일 상세</Button>
            <Button onClick={downloadResult} disabled={!applied}>결과 다운로드</Button>
          </>
        }
      />

      <div className="cleaning-summary" aria-label="정제 규칙 검토 현황">
        <article className="card summary-card">
          <p className="stat-label">전체 규칙</p>
          <p className="stat-value">{formatNumber(rules.length)}</p>
        </article>
        <article className="card summary-card">
          <p className="stat-label">승인</p>
          <p className="stat-value">{formatNumber(approvedCount)}</p>
        </article>
        <article className="card summary-card">
          <p className="stat-label">검토 대기</p>
          <p className="stat-value">{formatNumber(pendingCount)}</p>
        </article>
        <article className="card summary-card">
          <p className="stat-label">제외</p>
          <p className="stat-value">{formatNumber(rejectedCount)}</p>
        </article>
      </div>

      {applied ? (
        <div className="feedback feedback-success" role="status">
          승인한 {approvedCount}개 규칙을 적용했습니다. 정제 결과를 다운로드할 수 있습니다.
        </div>
      ) : null}
      {downloadError ? <div className="feedback feedback-error" role="alert">{downloadError}</div> : null}

      <section className="card" aria-labelledby="cleaning-rules-title">
        <div className="card-head">
          <div>
            <h2 className="title-sm" id="cleaning-rules-title">정제 규칙 검토</h2>
            <p className="caption">필수 규칙도 적용 전에 담당자의 승인이 필요합니다.</p>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={pendingCount === 0}
            onClick={() => {
              for (const rule of rules) {
                if (cleaningDecision(fileId, rule.id) === "pending") setDecision(rule.id, "approved");
              }
            }}
          >
            대기 규칙 모두 승인
          </button>
        </div>

        <ul className="cleaning-rule-list">
          {rules.map((rule) => {
            const decision = cleaningDecision(fileId, rule.id);
            return (
              <li className="cleaning-rule" key={rule.id}>
                <div className="rule-main">
                  <div className="cluster">
                    <h3 className="title-sm">{rule.name}</h3>
                    <span className={`pill ${rule.severity === "required" ? "pill-required" : ""}`}>
                      {rule.severity === "required" ? "필수 권장" : "권장"}
                    </span>
                    <span className={`pill decision-${decision}`}>{DECISION_LABEL[decision]}</span>
                  </div>
                  <p className="body">{rule.description}</p>
                  <p className="caption">영향 행 {formatNumber(rule.affectedRows)}개</p>
                </div>
                <div className="rule-actions" aria-label={`${rule.name} 결정`}>
                  <button
                    className={`chip-btn ${decision === "approved" ? "is-active" : ""}`}
                    type="button"
                    aria-pressed={decision === "approved"}
                    onClick={() => setDecision(rule.id, "approved")}
                  >
                    승인
                  </button>
                  <button
                    className={`chip-btn ${decision === "rejected" ? "is-rejected" : ""}`}
                    type="button"
                    aria-pressed={decision === "rejected"}
                    onClick={() => setDecision(rule.id, "rejected")}
                  >
                    제외
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="cleaning-apply-bar">
          <p className="body">승인한 규칙 {formatNumber(approvedCount)}개를 정제 결과에 반영합니다.</p>
          <Button onClick={applyRules} disabled={approvedCount === 0 || applied}>
            {applied ? "적용 완료" : "승인 규칙 적용"}
          </Button>
        </div>
      </section>

      <section className="card" aria-labelledby="comparison-title">
        <div className="card-head">
          <div>
            <h2 className="title-sm" id="comparison-title">정제 전·후 비교</h2>
            <p className="caption">
              {applied
                ? `적용된 변경 ${formatNumber(changedComparisonRows.length)}개 · 전체 비교 ${formatNumber(comparisonRows.length)}개`
                : `변경 예정 ${formatNumber(changedComparisonRows.length)}개 · 전체 비교 ${formatNumber(comparisonRows.length)}개`}
            </p>
          </div>
          <button
            className={`chip-btn ${showChangedOnly ? "is-active" : ""}`}
            type="button"
            aria-pressed={showChangedOnly}
            onClick={() => setShowChangedOnly((current) => !current)}
          >
            {showChangedOnly ? "전체 행 보기" : "변경된 행만 보기"}
          </button>
        </div>
        <DataTable
          framed={false}
          rows={visibleRows}
          rowKey={(row) => row.id}
          empty="표시할 정제 미리보기가 없습니다."
          columns={[
            { key: "row", header: "행", numeric: true, render: (row) => formatNumber(row.row) },
            { key: "field", header: "필드", render: (row) => row.field },
            { key: "before", header: "정제 전", render: (row) => <span className="compare-before">{row.before}</span> },
            {
              key: "after",
              header: "정제 후",
              render: (row) => {
                const unchanged = row.before === row.effectiveAfter;
                return (
                  <span className={row.decision === "rejected" || unchanged ? "compare-before" : "compare-after"}>
                    {row.effectiveAfter}
                    {row.decision === "rejected" || unchanged ? (
                      <small className="compare-note">{row.decision === "rejected" ? "원본 유지" : "변경 없음"}</small>
                    ) : null}
                  </span>
                );
              },
            },
            {
              key: "decision",
              header: "적용 여부",
              render: (row) => {
                const unchanged = row.before === row.effectiveAfter;
                return (
                  <span className={`pill ${unchanged ? "decision-pending" : `decision-${row.decision}`}`}>
                    {unchanged ? "변경 없음" : applied && row.decision === "approved" ? "적용 완료" : DECISION_LABEL[row.decision]}
                  </span>
                );
              },
            },
          ]}
        />
      </section>
    </div>
  );
}
