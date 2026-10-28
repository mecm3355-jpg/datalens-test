import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { AppError } from "../api/AppError";
import { applyDemoCleaning } from "../lib/demoProcessing";
import { downloadText, toCsv } from "../lib/download";
import { formatNumber } from "../lib/format";
import { useWorkspace } from "../state/workspace";

function sameRuleSelection(left: string[] | null, right: Set<string>): boolean {
  if (!left || left.length !== right.size) return false;
  return left.every((ruleId) => right.has(ruleId));
}

export function FileCleaningPage() {
  const { fileId = "" } = useParams();
  const {
    files,
    cleaningDecision,
    decideCleaningRule,
    cleaningRules,
    cleaningPreview,
    cleaningRows,
    cleaningArtifact,
    appliedCleaningRules,
    applyCleaningRules,
  } = useWorkspace();
  const file = files.find((item) => item.id === fileId);
  const [showChangedOnly, setShowChangedOnly] = useState(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const rules = cleaningRules(fileId);
  const preview = cleaningPreview(fileId);
  const artifact = cleaningArtifact(fileId);
  const selectedRuleIds = useMemo(
    () => new Set(
      rules
        .filter((rule) => rule.affectedRows > 0 && cleaningDecision(fileId, rule.id) === "approved")
        .map((rule) => rule.id),
    ),
    [cleaningDecision, fileId, rules],
  );
  const appliedRuleIds = appliedCleaningRules(fileId);
  const isApplied = sameRuleSelection(appliedRuleIds, selectedRuleIds);
  const selectionChanged = appliedRuleIds !== null && !isApplied;
  const selectedCount = selectedRuleIds.size;
  const notSelectedCount = rules.length - selectedCount;
  const allSelectableRulesSelected = rules.some((rule) => rule.affectedRows > 0)
    && rules.filter((rule) => rule.affectedRows > 0).every((rule) => selectedRuleIds.has(rule.id));

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
          lede="파일 처리가 완료된 뒤 정제 규칙을 선택할 수 있습니다."
          actions={<Button variant="secondary" to={`/files/${file.id}`}>상세로 돌아가기</Button>}
        />
        <article className="card">
          <p className="title-sm">현재 상태에서는 정제를 시작할 수 없습니다.</p>
          <p className="notice">파일 상세 화면에서 처리 상태를 확인하거나 원본 파일을 다시 선택해 주세요.</p>
        </article>
      </div>
    );
  }

  const selectRule = (ruleId: string, selected: boolean) => {
    decideCleaningRule(fileId, ruleId, selected ? "approved" : "rejected");
    setDownloadError(null);
  };

  const runCleaning = () => {
    if (selectedCount === 0) return;
    applyCleaningRules(fileId, [...selectedRuleIds]);
    setDownloadError(null);
  };

  const downloadResult = (format: "csv" | "json") => {
    if (!appliedRuleIds || !isApplied) return;
    try {
      const sourceRows = cleaningRows(fileId);
      const appliedSet = new Set(appliedRuleIds);
      const cleanedRows = sourceRows.length > 0
        ? applyDemoCleaning(sourceRows, appliedSet)
        : preview
            .filter((row) => appliedSet.has(row.ruleId))
            .map((row) => ({ 행: String(row.row), 필드: row.field, 정제전: row.before, 정제후: row.after }));
      if (cleanedRows.length === 0) throw new AppError("EMPTY_EXPORT", "다운로드할 정제 데이터가 없습니다.");
      const baseName = file.originalName.replace(/\.[^.]+$/, "");
      if (format === "json") {
        downloadText(`${baseName}_정제결과.json`, JSON.stringify(cleanedRows, null, 2), "application/json;charset=utf-8");
      } else {
        downloadText(`${baseName}_정제결과.csv`, toCsv(cleanedRows));
      }
      setDownloadError(null);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "정제 결과를 다운로드하지 못했습니다.");
    }
  };

  const activeRuleIds = isApplied && appliedRuleIds ? new Set(appliedRuleIds) : selectedRuleIds;
  const comparisonRows = preview.map((row) => {
    const selected = activeRuleIds.has(row.ruleId);
    return {
      ...row,
      selected,
      effectiveAfter: selected ? row.after : row.before,
    };
  });
  const changedComparisonRows = comparisonRows.filter((row) => row.before !== row.effectiveAfter);
  const visibleRows = showChangedOnly ? changedComparisonRows : comparisonRows;

  return (
    <div className="page">
      <PageIntro
        eyebrow={isApplied ? "정제 완료" : "정제 준비"}
        title={file.originalName}
        lede="적용할 규칙을 선택한 뒤 한 번만 정제를 실행하세요. 실행된 결과는 새로고침 후에도 유지됩니다."
        actions={
          <>
            <Button variant="secondary" to={`/files/${file.id}`}>파일 상세</Button>
            <Button onClick={() => downloadResult("csv")} disabled={!isApplied}>CSV 다운로드</Button>
            <Button variant="secondary" onClick={() => downloadResult("json")} disabled={!isApplied}>JSON 다운로드</Button>
          </>
        }
      />

      <div className="cleaning-summary" aria-label="정제 규칙 선택 현황">
        <article className="card summary-card">
          <p className="stat-label">전체 규칙</p>
          <p className="stat-value">{formatNumber(rules.length)}</p>
        </article>
        <article className="card summary-card">
          <p className="stat-label">적용 선택</p>
          <p className="stat-value">{formatNumber(selectedCount)}</p>
        </article>
        <article className="card summary-card">
          <p className="stat-label">미선택</p>
          <p className="stat-value">{formatNumber(notSelectedCount)}</p>
        </article>
        <article className="card summary-card">
          <p className="stat-label">적용된 규칙</p>
          <p className="stat-value">{formatNumber(isApplied ? appliedRuleIds?.length ?? 0 : 0)}</p>
        </article>
      </div>

      {isApplied ? (
        <div className="feedback feedback-success" role="status">
          선택한 {selectedCount}개 규칙으로 정제를 완료했습니다. 결과를 다운로드할 수 있습니다.
        </div>
      ) : null}
      {selectionChanged ? (
        <div className="feedback" role="status">
          규칙 선택이 변경되었습니다. 변경사항을 반영하려면 정제를 다시 실행하세요.
        </div>
      ) : null}
      {artifact?.source === "metadata" ? (
        <div className="feedback" role="note">
          이 형식은 브라우저 데모에서 내용 추출을 지원하지 않습니다. 파일 정보만 저장되며 실제 정제는 백엔드 연결 후 제공됩니다.
        </div>
      ) : null}
      {artifact?.source === "parsed" ? (
        <div className="feedback" role="note">
          현재 추천은 품질 진단 결과를 이용한 규칙 엔진 데모입니다. 백엔드 연결 후 AI 추천으로 교체되며 자동 적용되지 않습니다.
        </div>
      ) : null}
      {artifact?.truncated ? (
        <div className="feedback" role="note">브라우저 저장 용량을 위해 앞 1,000행만 데모 정제에 사용합니다.</div>
      ) : null}
      {downloadError ? <div className="feedback feedback-error" role="alert">{downloadError}</div> : null}

      <section className="card" aria-labelledby="cleaning-rules-title">
        <div className="card-head">
          <div>
            <h2 className="title-sm" id="cleaning-rules-title">정제 규칙 선택</h2>
            <p className="caption">체크한 규칙만 정제 실행 시 반영됩니다.</p>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={rules.every((rule) => rule.affectedRows === 0)}
            onClick={() => {
              for (const rule of rules) {
                if (rule.affectedRows > 0) selectRule(rule.id, !allSelectableRulesSelected);
              }
            }}
          >
            {allSelectableRulesSelected ? "전체 규칙 선택 해제" : "전체 규칙 선택"}
          </button>
        </div>

        {rules.length === 0 ? (
          <p className="empty">이 파일 형식에서 선택할 수 있는 브라우저 정제 규칙이 없습니다.</p>
        ) : (
          <ul className="cleaning-rule-list">
            {rules.map((rule) => {
              const selected = selectedRuleIds.has(rule.id);
              const unavailable = rule.affectedRows === 0;
              return (
                <li className={`cleaning-rule ${unavailable ? "is-unavailable" : ""}`} key={rule.id}>
                  <div className="rule-main">
                    <div className="cluster">
                      <h3 className="title-sm">{rule.name}</h3>
                      <span className={`pill ${rule.severity === "required" ? "pill-required" : ""}`}>
                        {rule.severity === "required" ? "필수 권장" : "권장"}
                      </span>
                      <span className={`pill ${selected ? "decision-approved" : "decision-pending"}`}>
                        {unavailable ? "대상 없음" : selected ? "적용 선택" : "미선택"}
                      </span>
                    </div>
                    <p className="body">{rule.description}</p>
                    <p className="caption">대상: {rule.target ?? "전체 데이터"} · 사유: {rule.reason ?? "품질 진단 결과에서 변경 대상을 발견했습니다."}</p>
                    <p className="caption">영향 행 {formatNumber(rule.affectedRows)}개</p>
                  </div>
                  <label className="rule-checkbox">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={unavailable}
                      onChange={(event) => selectRule(rule.id, event.target.checked)}
                    />
                    <span>{selected ? "적용함" : "적용 안 함"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="cleaning-apply-bar">
          <p className="body">선택한 규칙 {formatNumber(selectedCount)}개로 정제 결과를 생성합니다.</p>
          <Button onClick={runCleaning} disabled={selectedCount === 0 || isApplied}>
            {isApplied ? "정제 적용 완료" : `선택한 ${formatNumber(selectedCount)}개 규칙으로 정제 실행`}
          </Button>
        </div>
      </section>

      <section className="card" aria-labelledby="comparison-title">
        <div className="card-head">
          <div>
            <h2 className="title-sm" id="comparison-title">{isApplied ? "정제 전·후 결과" : "예상 정제 결과"}</h2>
            <p className="caption">
              변경 {formatNumber(changedComparisonRows.length)}개 · 전체 비교 {formatNumber(comparisonRows.length)}개
            </p>
          </div>
          <button
            className={`chip-btn ${showChangedOnly ? "is-active" : ""}`}
            type="button"
            onClick={() => setShowChangedOnly((current) => !current)}
          >
            {showChangedOnly ? "전체 행 보기" : "변경된 행만 보기"}
          </button>
        </div>
        <DataTable
          framed={false}
          rows={visibleRows}
          rowKey={(row) => row.id}
          empty={selectedCount === 0 ? "적용할 규칙을 선택하면 예상 변경사항이 표시됩니다." : "표시할 변경사항이 없습니다."}
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
                  <span className={unchanged ? "compare-before" : "compare-after"}>
                    {row.effectiveAfter}
                    {unchanged ? <small className="compare-note">변경 없음</small> : null}
                  </span>
                );
              },
            },
            {
              key: "decision",
              header: "적용 여부",
              render: (row) => (
                <span className={`pill ${row.selected ? "decision-approved" : "decision-pending"}`}>
                  {row.selected ? (isApplied ? "적용 완료" : "적용 예정") : "미적용"}
                </span>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
