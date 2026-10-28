import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import {
  jobByFileId,
  qualityByFile,
  stages,
} from "../data/mock";
import { formatBytes, formatDate, formatNumber, formatRatio } from "../lib/format";
import { FILE_STATUS_LABEL, MAPPING_FIELDS, SEVERITY_LABEL } from "../lib/labels";
import { useWorkspace } from "../state/workspace";
import { useComplaintData } from "../state/complaintData";
import type { DataFile, JobStatus, MappingField } from "../types";

type UploadedPreviewRow = {
  id: string;
  values: Record<string, string>;
};

export function FileDetailPage() {
  const { fileId = "" } = useParams();
  return <FileDetail key={fileId} fileId={fileId} />;
}

function FileDetail({ fileId }: { fileId: string }) {
  const { complaints } = useComplaintData();
  const {
    files,
    analysisRequested,
    requestAnalysis,
    retryFileProcessing,
    cleaningRows,
    cleaningArtifact,
    ensureFileData,
    deleteFile,
    jobForFile,
    dataMode,
  } = useWorkspace();
  const navigate = useNavigate();
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const file = files.find((item) => item.id === fileId);
  useEffect(() => {
    if (dataMode === "api") void ensureFileData(fileId);
    // fileId is the loading boundary; provider state updates must not retrigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataMode, fileId]);
  if (!file) {
    return (
      <div className="page">
        <PageIntro title="파일을 찾을 수 없습니다" />
        <Button variant="secondary" to="/files">
          파일 목록
        </Button>
      </div>
    );
  }

  const job = dataMode === "api" ? jobForFile(file.id) : jobByFileId(file.id);
  const requested = analysisRequested(file.id);
  const preview = complaints.filter((item) => item.fileId === file.id);
  const uploadedPreview = cleaningRows(file.id).slice(0, 10).map((values, index) => ({
    id: `uploaded-${index}`,
    values,
  }));
  const analysis = cleaningArtifact(file.id)?.analysis;
  const analysisUnsupported = file.analysisSupported === false || file.fileCategory === "other";
  const quality = cleaningArtifact(file.id)?.qualityIssues ?? qualityByFile[file.id] ?? [];
  const processingError = file.processingError
    ? { code: dataMode === "api" ? "SERVER_PROCESSING_FAILED" : "DEMO_PROCESSING_FAILED", message: file.processingError }
    : job?.error;

  const retryProcessing = async () => {
    const started = await retryFileProcessing(file.id);
    if (started) {
      setRetryError(null);
      return;
    }
    setRetryError("원본 파일이 현재 브라우저 세션에 없습니다. 파일 목록에서 원본을 다시 선택해 주세요.");
  };

  const removeFile = async () => {
    if (!window.confirm(`'${file.originalName}' 파일과 관련 결과를 모두 삭제할까요?`)) return;
    setIsDeleting(true);
    try {
      await deleteFile(file.id);
      navigate("/files", { replace: true });
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "파일을 삭제하지 못했습니다.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow={`${file.extension.toUpperCase()} · ${FILE_STATUS_LABEL[file.status]}`}
        title={file.originalName}
        lede={`${formatBytes(file.sizeBytes)} · ${file.rowCount === null ? "행 수 없음" : `${formatNumber(file.rowCount)}행`} · ${formatDate(file.createdAt)}`}
        actions={
          <>
            {file.status === "completed" && (file.cleaningSupported ?? file.fileCategory === "tabular") ? (
              <Button variant="secondary" to={`/files/${file.id}/cleaning`}>정제 결과</Button>
            ) : null}
            {!analysisUnsupported ? <Button
              onClick={() => {
                if (file.status === "failed") {
                  void retryProcessing();
                } else {
                  void requestAnalysis(file.id).catch((error: unknown) => {
                    setRetryError(error instanceof Error ? error.message : "분석을 시작하지 못했습니다.");
                  });
                }
              }}
              disabled={file.status === "processing"}
            >
              {file.status === "processing" ? "처리 중" : job?.status === "completed" ? "다시 분석" : file.status === "failed" ? "다시 시도" : "분석 실행"}
            </Button> : null}
            <Button variant="secondary" onClick={() => void removeFile()} disabled={isDeleting || file.status === "processing"}>
              {isDeleting ? "삭제 중" : "파일 삭제"}
            </Button>
          </>
        }
      />

      <article className="card">
        <div className="card-head">
          <h2 className="title-sm">파일 메타데이터</h2>
          <span className={`pill ${analysisUnsupported ? "pill-pending" : ""}`}>
            {analysisUnsupported ? "내용 분석 미지원" : analysis ? "분석 가능" : "분석 결과 대기"}
          </span>
        </div>
        <dl className="attr-grid notice">
          <div className="attr"><dt>실제 형식</dt><dd>{analysis?.detectedFormat ?? file.extension.toUpperCase()}</dd></div>
          <div className="attr"><dt>MIME 유형</dt><dd>{file.mimeType ?? "등록 정보 없음"}</dd></div>
          <div className="attr"><dt>파일 크기</dt><dd className="num">{formatBytes(file.sizeBytes)}</dd></div>
          <div className="attr"><dt>등록일</dt><dd className="num">{formatDate(file.createdAt)}</dd></div>
          <div className="attr"><dt>저장 위치</dt><dd>{file.storageLocation ?? "데모 저장소"}</dd></div>
          <div className="attr"><dt>레코드</dt><dd className="num">{file.rowCount === null ? "—" : formatNumber(file.rowCount)}</dd></div>
        </dl>
      </article>

      {analysisUnsupported ? (
        <article className="card" role="status">
          <div className="card-head">
            <h2 className="title-sm">내용 분석을 지원하지 않는 형식입니다</h2>
            <span className="pill pill-pending">메타데이터만</span>
          </div>
          <p className="body notice">
            원본 파일과 기본 정보는 안전하게 등록되었습니다. 이 형식은 미리보기·품질 진단·정제·AI 리포트를 제공하지 않으므로 별도의 처리를 기다릴 필요가 없습니다.
          </p>
        </article>
      ) : null}

      {processingError ? (
        <article className="card error-card" role="alert">
          <p className="caption">실패</p>
          <p className="error-code num">{processingError.code}</p>
          <p className="body notice">{processingError.message}</p>
          <Button variant="secondary" onClick={() => void retryProcessing()}>처리 다시 시도</Button>
          {retryError ? <p className="feedback feedback-error">{retryError}</p> : null}
        </article>
      ) : null}

      {!analysisUnsupported ? <article className="card">
        <div className="card-head">
          <h2 className="title-sm">작업 단계</h2>
          {job ? <span className="num">{job.progress}%</span> : null}
        </div>
        {job ? <StageTrack status={job.status} stage={job.stage} /> : null}
        {!job && requested ? <StageTrack status="queued" stage="validating" /> : null}
        {!job && !requested ? <p className="empty">아직 분석 작업이 없습니다.</p> : null}
        {requested && job ? <p className="notice">같은 파일로 새 분석 작업을 대기열에 넣었습니다.</p> : null}
        {requested && !job ? <p className="notice">분석 작업을 대기열에 넣었습니다.</p> : null}
      </article> : null}

      {quality.length > 0 ? (
        <article className="card">
          <div className="card-head">
            <h2 className="title-sm">품질 진단</h2>
          </div>
          <DataTable
            framed={false}
            rows={quality}
            rowKey={(issue) => issue.type}
            empty="품질 문제가 없습니다."
            columns={[
              { key: "severity", header: "정도", render: (issue) => SEVERITY_LABEL[issue.severity] },
              { key: "count", header: "건수", numeric: true, render: (issue) => formatNumber(issue.count) },
              { key: "location", header: "위치", render: (issue) => issue.location ?? "—" },
              { key: "message", header: "내용", render: (issue) => issue.message },
            ]}
          />
        </article>
      ) : null}

      {analysis?.quality ? (
        <>
          <section className="stat-row" aria-label="데이터 품질 점수">
            <QualityStat label="종합 품질" value={`${analysis.quality.score}점`} />
            <QualityStat label="완전성" value={`${analysis.quality.completeness}%`} />
            <QualityStat label="유일성" value={`${analysis.quality.uniqueness}%`} />
            <QualityStat label="유효성" value={`${analysis.quality.validity}%`} />
            <QualityStat label="일관성" value={`${analysis.quality.consistency}%`} />
          </section>
          <p className="caption">종합 점수 기준: 완전성 35% · 유일성 25% · 유효성 20% · 일관성 20%</p>
        </>
      ) : null}

      {analysis && (analysis.numericSummaries.length > 0 || analysis.frequencies.length > 0 || analysis.textStats || analysis.imageMetadata) ? (
        <section className="split">
          <article className="card">
            <div className="card-head"><h2 className="title-sm">계산 통계</h2><span className="pill">서버 계산</span></div>
            {analysis.numericSummaries.length > 0 ? (
              <DataTable
                framed={false}
                rows={analysis.numericSummaries}
                rowKey={(row) => row.field}
                empty="수치형 열이 없습니다."
                columns={[
                  { key: "field", header: "열", render: (row) => row.field },
                  { key: "average", header: "평균", numeric: true, render: (row) => row.average.toFixed(2) },
                  { key: "minimum", header: "최솟값", numeric: true, render: (row) => formatNumber(row.minimum) },
                  { key: "maximum", header: "최댓값", numeric: true, render: (row) => formatNumber(row.maximum) },
                ]}
              />
            ) : analysis.textStats ? (
              <dl className="attr-grid notice">
                <div className="attr"><dt>줄</dt><dd className="num">{formatNumber(analysis.textStats.lines)}</dd></div>
                <div className="attr"><dt>단어</dt><dd className="num">{formatNumber(analysis.textStats.words)}</dd></div>
                <div className="attr"><dt>문자</dt><dd className="num">{formatNumber(analysis.textStats.characters)}</dd></div>
              </dl>
            ) : analysis.imageMetadata ? (
              <p className="body">이미지 해상도: <span className="num">{analysis.imageMetadata.width ?? "—"} × {analysis.imageMetadata.height ?? "—"}</span></p>
            ) : <p className="empty">계산 가능한 통계가 없습니다.</p>}
          </article>
          <article className="card">
            <div className="card-head"><h2 className="title-sm">값 빈도</h2></div>
            {analysis.frequencies.length > 0 ? (
              <ol className="frequency-list">
                {analysis.frequencies.map((item) => <li key={item.value}><span>{item.value}</span><span className="num">{formatNumber(item.count)}</span></li>)}
              </ol>
            ) : <p className="empty">반복되는 범주형 값이 없습니다.</p>}
          </article>
        </section>
      ) : null}

      {file.columns.length > 0 ? <MappingCard file={file} /> : null}

      {!analysisUnsupported ? <article className="card">
        <div className="card-head">
          <h2 className="title-sm">추출 미리보기</h2>
          <span className="caption">앞 {formatNumber(uploadedPreview.length || preview.length)}건</span>
        </div>
        {uploadedPreview.length > 0 ? (
          <DataTable<UploadedPreviewRow>
            framed={false}
            rows={uploadedPreview}
            rowKey={(row) => row.id}
            empty="읽을 수 있는 데이터가 없습니다."
            columns={file.columns.slice(0, 6).map((column) => ({
              key: column,
              header: column,
              render: (row) => <span className="content-cell">{row.values[column] || "—"}</span>,
            }))}
          />
        ) : (
          <DataTable
            framed={false}
            rows={preview}
            rowKey={(row) => row.id}
            empty="추출 전입니다. 미리보기는 형식 검증 뒤에 표시됩니다."
            columns={[
              {
                key: "id",
                header: "민원",
                render: (row) => (
                  <Link className="link" to={`/complaints/${row.id}`}>
                    {row.id}
                  </Link>
                ),
              },
              { key: "date", header: "접수일", numeric: true, render: (row) => formatDate(row.receivedAt) },
              { key: "region", header: "지역", render: (row) => row.region ?? "—" },
              {
                key: "locator",
                header: "위치",
                numeric: true,
                render: (row) => (row.sourceLocator.row ? `행 ${row.sourceLocator.row}` : `p.${row.sourceLocator.page}`),
              },
              {
                key: "content",
                header: "본문",
                render: (row) => <span className="content-cell">{row.contentMasked}</span>,
              },
              {
                key: "similarity",
                header: "유사도",
                numeric: true,
                render: (row) => (row.similarity === null ? "—" : formatRatio(row.similarity)),
              },
            ]}
          />
        )}
      </article> : null}
    </div>
  );
}

/** 품질 지표 이름과 백분율 값을 동일한 카드 형식으로 표시합니다. */
function QualityStat({ label, value }: { label: string; value: string }) {
  return <article className="stat"><p className="stat-label">{label}</p><p className="stat-value">{value}</p></article>;
}

function StageTrack({ status, stage }: { status: JobStatus; stage: string }) {
  const currentIndex = stages.findIndex((item) => item.id === stage);
  return (
    <div className="stage-scroll">
      <ol className="stages">
        {stages.map((item, index) => {
          const reached = status === "completed" || index < currentIndex;
          const current = status !== "completed" && index === currentIndex;
          const className = ["stage", reached ? "is-done" : "", current ? "is-current" : ""].filter(Boolean).join(" ");
          return (
            <li key={item.id} className={className}>
              <span className="stage-bar" />
              <span className="stage-label">{item.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MappingCard({ file }: { file: DataFile }) {
  const [mapping, setMapping] = useState(file.mapping);
  const [corrected, setCorrected] = useState(false);

  return (
    <article className="card">
      <div className="card-head">
        <h2 className="title-sm">컬럼 매핑</h2>
        {file.swappedAxes && !corrected ? (
          <Button
            variant="secondary"
            onClick={() => {
              setMapping((current) => ({ ...current, 경도: "latitude", 위도: "longitude" }));
              setCorrected(true);
            }}
          >
            경도·위도 교정
          </Button>
        ) : null}
      </div>
      {file.swappedAxes ? (
        <p className="body">
          {corrected
            ? "경도 열은 위도 값으로, 위도 열은 경도 값으로 읽습니다."
            : "경도·위도 열 이름이 서로 바뀌어 있습니다. 교정하면 열 이름과 값을 맞춰 읽습니다."}
        </p>
      ) : (
        <p className="caption">공통 필드에 맞춘 뒤 분석을 실행합니다.</p>
      )}
      <div className="mapping-grid notice">
        {file.columns.map((column) => (
          <label className="field" key={column}>
            <span>{column}</span>
            <select
              className="select"
              value={mapping[column] ?? "ignore"}
              onChange={(event) => {
                const value = event.target.value as MappingField;
                setMapping((current) => ({ ...current, [column]: value }));
              }}
            >
              {MAPPING_FIELDS.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </article>
  );
}
