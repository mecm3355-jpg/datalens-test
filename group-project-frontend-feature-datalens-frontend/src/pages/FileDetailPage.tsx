import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { ComplaintMapping } from "../api/datalens";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import {
  jobByFileId,
  qualityByFile,
  stages,
} from "../data/mock";
import { readScannedPdf } from "../lib/browserOcr";
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
    loading,
  } = useWorkspace();
  const navigate = useNavigate();
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResolvingFile, setIsResolvingFile] = useState(dataMode === "api");
  const file = files.find((item) => item.id === fileId);
  useEffect(() => {
    if (dataMode !== "api") {
      setIsResolvingFile(false);
      return;
    }

    let active = true;
    setIsResolvingFile(true);
    void ensureFileData(fileId).finally(() => {
      if (active) setIsResolvingFile(false);
    });
    return () => {
      active = false;
    };
    // fileId is the loading boundary; provider state updates must not retrigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataMode, fileId]);
  if (!file && (loading || isResolvingFile)) {
    return (
      <div className="page">
        <PageIntro title="파일 정보를 불러오는 중입니다" lede="잠시만 기다려 주세요." />
      </div>
    );
  }
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

  // 서버가 스캔본을 못 읽었으면 파일이 실패 상태여도 브라우저 OCR로 이어 갈 수 있어야 한다
  const ocrMissing = job?.error?.code === "OCR_NOT_AVAILABLE"
    || Boolean(file.processingError?.startsWith("OCR_NOT_AVAILABLE"));

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
            <Button variant="secondary" onClick={() => void removeFile()} disabled={isDeleting}>
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

      {dataMode === "api" && (file.status === "completed" || ocrMissing) && ["tabular", "text", "document"].includes(file.fileCategory)
        ? <ComplaintAnalysisCard
            file={file}
            complaintCount={preview.length}
            scanned={ocrMissing || quality.some((issue) => issue.type === "no_text_layer")}
            diagnosisReady={ocrMissing || cleaningArtifact(file.id) !== null}
          />
        : null}

      {/* 서버에 저장되지 않는 데모용 칸이다. API 모드의 열 선택은 민원 분석 칸에서 한다 */}
      {dataMode !== "api" && file.columns.length > 0 ? <MappingCard file={file} /> : null}

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

const COMPLAINT_FIELDS: Array<{ id: keyof ComplaintMapping; label: string; pattern: RegExp }> = [
  { id: "content", label: "민원 내용", pattern: /내용|본문|민원/ },
  { id: "title", label: "제목", pattern: /제목/ },
  { id: "receivedAt", label: "접수일시", pattern: /접수|일시|일자|날짜/ },
  { id: "region", label: "지역", pattern: /지역|행정동|읍면동/ },
];

/** 열 이름으로 민원 필드의 첫 추정값을 만듭니다. 사용자가 화면에서 고칠 수 있습니다. */
function guessComplaintMapping(columns: string[]): ComplaintMapping {
  const guess: ComplaintMapping = {};
  for (const field of COMPLAINT_FIELDS) {
    const column = columns.find((name) => field.pattern.test(name));
    if (column) guess[field.id] = column;
  }
  return guess;
}

/** 민원 분석을 시작하는 카드입니다. AI 없이 서버의 규칙 방식으로 분석합니다. */
function ComplaintAnalysisCard({ file, complaintCount, scanned, diagnosisReady }: {
  file: DataFile;
  complaintCount: number;
  scanned: boolean;
  diagnosisReady: boolean;
}) {
  const { requestComplaintAnalysis, analyzeOcrText } = useWorkspace();
  const navigate = useNavigate();
  const [scanSource, setScanSource] = useState<File | null>(null);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const { reload } = useComplaintData();
  const [mapping, setMapping] = useState<ComplaintMapping>(() => guessComplaintMapping(file.columns));
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTable = file.fileCategory === "tabular";
  const isDocument = file.fileCategory === "document";
  const usesSplitRule = isDocument || file.fileCategory === "text";
  // PDF는 여러 민원을 모아 인쇄한 경우가 많아, 파일 전체가 민원 1건으로 합쳐지지 않게 분리 규칙을 기본으로 둔다.
  // 브라우저 OCR로 만든 글자 파일도 내용은 PDF와 같다
  const [splitRule, setSplitRule] = useState(
    file.extension.toLowerCase() === "pdf" || file.originalName.endsWith(".ocr.txt") ? "sinmungo" : "",
  );
  // 문서는 진단 결과가 와야 스캔본인지 안다. 그 전에 시작하면 스캔본을 서버로 보내 실패한다
  const waitingDiagnosis = isDocument && !diagnosisReady;
  const canStart = !waitingDiagnosis
    && (scanned ? scanSource !== null : !isTable || Boolean(mapping.content || mapping.title));

  const start = async () => {
    setIsRunning(true);
    setError(null);
    try {
      if (scanned && scanSource) {
        // 서버는 원본을 내려주지 않으므로 같은 파일을 다시 고르게 하고, 다른 파일을 분석하지 않게 크기를 맞춰 본다
        if (scanSource.size !== file.sizeBytes) {
          throw new Error("올린 PDF와 크기가 다른 파일입니다. 같은 파일을 선택해 주세요.");
        }
        const text = await readScannedPdf(scanSource, (done, total) => {
          setOcrProgress(`글자 읽는 중 ${done}/${total}쪽`);
        });
        setOcrProgress("읽은 글자로 민원 분석 중");
        const newFileId = await analyzeOcrText(file.originalName, text, splitRule || undefined);
        await reload();
        navigate(`/files/${newFileId}`);
        return;
      }
      await requestComplaintAnalysis(file.id, isTable ? mapping : {}, usesSplitRule && splitRule ? splitRule : undefined);
      await reload();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "민원 분석을 시작하지 못했습니다.");
    } finally {
      setIsRunning(false);
      setOcrProgress(null);
    }
  };

  return (
    <article className="card">
      <div className="card-head">
        <h2 className="title-sm">민원 분석</h2>
        <Button onClick={() => void start()} disabled={isRunning || !canStart}>
          {isRunning ? "분석 중" : complaintCount > 0 ? "민원 다시 분석" : "민원 분석 시작"}
        </Button>
      </div>
      <p className="caption">
        {complaintCount > 0 ? `민원 ${formatNumber(complaintCount)}건을 분석했습니다. ` : ""}
        AI 없이 단어와 규칙으로 민원을 묶습니다. 건수가 많을수록 묶음이 정확해집니다.
      </p>
      {isTable ? (
        <div className="mapping-grid notice">
          {COMPLAINT_FIELDS.map((field) => (
            <label className="field" key={field.id}>
              <span>{field.label}</span>
              <select
                className="select"
                value={mapping[field.id] ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setMapping((current) => ({ ...current, [field.id]: value || undefined }));
                }}
              >
                <option value="">선택 안 함</option>
                {file.columns.map((column) => (
                  <option key={column} value={column}>{column}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      {usesSplitRule ? (
        <div className="mapping-grid notice">
          <label className="field">
            <span>문서 형식</span>
            <select className="select" value={splitRule} onChange={(event) => setSplitRule(event.target.value)}>
              <option value="sinmungo">국민신문고 목록 (민원별로 나눔)</option>
              <option value="">{isDocument ? "파일 전체를 민원 1건으로" : "빈 줄로 나눔"}</option>
            </select>
          </label>
          {scanned ? (
            <label className="field">
              <span>원본 PDF 선택</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setScanSource(event.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {scanned ? (
        <p className="caption">
          글자가 없는 스캔본입니다. 이 PC의 브라우저에서 글자를 읽으며 PDF 파일은 밖으로 보내지 않습니다.
          쪽수에 따라 몇 분 걸릴 수 있으니 창을 닫지 마세요.
        </p>
      ) : null}
      {waitingDiagnosis ? <p className="caption" role="status">파일 진단 결과를 불러오는 중입니다.</p> : null}
      {ocrProgress ? <p className="caption" role="status">{ocrProgress}</p> : null}
      {error ? <p className="feedback feedback-error" role="alert">{error}</p> : null}
    </article>
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
