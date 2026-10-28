import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import {
  complaintsByFile,
  jobByFileId,
  qualityByFile,
  stages,
} from "../data/mock";
import { formatBytes, formatDate, formatNumber, formatRatio } from "../lib/format";
import { FILE_STATUS_LABEL, MAPPING_FIELDS, SEVERITY_LABEL } from "../lib/labels";
import { useWorkspace } from "../state/workspace";
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
  const { files, analysisRequested, requestAnalysis, retryFileProcessing, cleaningRows } = useWorkspace();
  const [retryError, setRetryError] = useState<string | null>(null);
  const file = files.find((item) => item.id === fileId);
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

  const job = jobByFileId(file.id);
  const requested = analysisRequested(file.id);
  const preview = complaintsByFile(file.id);
  const uploadedPreview = cleaningRows(file.id).slice(0, 10).map((values, index) => ({
    id: `uploaded-${index}`,
    values,
  }));
  const quality = qualityByFile[file.id] ?? [];
  const processingError = file.processingError
    ? { code: "DEMO_PROCESSING_FAILED", message: file.processingError }
    : job?.error;

  const retryProcessing = () => {
    const started = retryFileProcessing(file.id);
    if (started) {
      setRetryError(null);
      return;
    }
    setRetryError("원본 파일이 현재 브라우저 세션에 없습니다. 파일 목록에서 원본을 다시 선택해 주세요.");
  };

  return (
    <div className="page">
      <PageIntro
        eyebrow={`${file.extension.toUpperCase()} · ${FILE_STATUS_LABEL[file.status]}`}
        title={file.originalName}
        lede={`${formatBytes(file.sizeBytes)} · ${file.rowCount === null ? "행 수 없음" : `${formatNumber(file.rowCount)}행`} · ${formatDate(file.createdAt)}`}
        actions={
          <>
            {file.status === "completed" ? (
              <Button variant="secondary" to={`/files/${file.id}/cleaning`}>정제 결과</Button>
            ) : null}
            <Button
              onClick={() => {
                if (file.status === "failed") {
                  retryProcessing();
                } else {
                  requestAnalysis(file.id);
                }
              }}
              disabled={file.status === "processing"}
            >
              {file.status === "processing" ? "처리 중" : job?.status === "completed" ? "다시 분석" : file.status === "failed" ? "다시 시도" : "분석 실행"}
            </Button>
          </>
        }
      />

      {processingError ? (
        <article className="card error-card" role="alert">
          <p className="caption">실패</p>
          <p className="error-code num">{processingError.code}</p>
          <p className="body notice">{processingError.message}</p>
          <Button variant="secondary" onClick={retryProcessing}>처리 다시 시도</Button>
          {retryError ? <p className="feedback feedback-error">{retryError}</p> : null}
        </article>
      ) : null}

      <article className="card">
        <div className="card-head">
          <h2 className="title-sm">작업 단계</h2>
          {job ? <span className="num">{job.progress}%</span> : null}
        </div>
        {job ? <StageTrack status={job.status} stage={job.stage} /> : null}
        {!job && requested ? <StageTrack status="queued" stage="validating" /> : null}
        {!job && !requested ? <p className="empty">아직 분석 작업이 없습니다.</p> : null}
        {requested && job ? <p className="notice">같은 파일로 새 분석 작업을 대기열에 넣었습니다.</p> : null}
        {requested && !job ? <p className="notice">분석 작업을 대기열에 넣었습니다.</p> : null}
      </article>

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

      {file.columns.length > 0 ? <MappingCard file={file} /> : null}

      <article className="card">
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
      </article>
    </div>
  );
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
