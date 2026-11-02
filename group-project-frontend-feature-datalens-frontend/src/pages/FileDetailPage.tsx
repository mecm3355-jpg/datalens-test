import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { formatBytes, formatDate, formatNumber, formatRatio } from "../lib/format";
import { FILE_STATUS_LABEL, MAPPING_FIELDS, SEVERITY_LABEL } from "../lib/labels";
import { loadJob, loadMapping, loadPreview, loadQuality } from "../lib/remote";
import { useCatalog } from "../state/catalog";
import type { DataFile, Job, JobStatus, MappingField, QualityIssue } from "../types";

const STAGES: Array<{ id: string; label: string }> = [
  { id: "validating", label: "형식 검증" },
  { id: "parsing", label: "추출" },
  { id: "masking", label: "마스킹" },
  { id: "embedding", label: "임베딩" },
  { id: "assigning", label: "배정" },
  { id: "discovering", label: "발견" },
  { id: "issue_grouping", label: "이슈 묶기" },
  { id: "statistics", label: "집계" },
  { id: "ai_summary", label: "요약" },
];

const MAPPED_FIELDS: MappingField[] = ["content", "receivedAt", "region", "longitude", "latitude", "agency", "sourceId"];

export function FileDetailPage() {
  const { fileId = "" } = useParams();
  return <FileDetail key={fileId} fileId={fileId} />;
}

function FileDetail({ fileId }: { fileId: string }) {
  const { files, complaintsByFile, requestAnalysis, status, busy } = useCatalog();
  const file = files.find((item) => item.id === fileId);
  const [columns, setColumns] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<string, MappingField>>>({});
  const [swapped, setSwapped] = useState(false);
  const [quality, setQuality] = useState<QualityIssue[]>([]);
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPreview(fileId)
      .then((preview) => {
        if (cancelled) return;
        if (preview.columns) setColumns(preview.columns);
        setLines(preview.lines ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  useEffect(() => {
    if (file?.fileCategory !== "tabular") return;
    let cancelled = false;
    loadMapping(fileId)
      .then((suggestion) => {
        if (cancelled) return;
        if (suggestion.columns.length > 0) setColumns(suggestion.columns);
        const next: Partial<Record<string, MappingField>> = {};
        for (const field of MAPPED_FIELDS) {
          const column = suggestion.mapping[field];
          if (typeof column === "string" && column) next[column] = field;
        }
        setMapping(next);
        setSwapped(suggestion.notes.some((note) => note.includes("위도") && note.includes("경도")));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [file?.fileCategory, fileId]);

  useEffect(() => {
    const jobId = file?.lastJobId;
    if (!jobId) {
      setJob(null);
      return;
    }
    let cancelled = false;
    loadJob(jobId)
      .then((next) => {
        if (!cancelled) setJob(next);
      })
      .catch(() => {
        if (!cancelled) setJob(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file?.lastJobId, file?.status]);

  useEffect(() => {
    if (!file || (file.status !== "completed" && file.status !== "failed")) {
      setQuality([]);
      return;
    }
    let cancelled = false;
    loadQuality(file.id)
      .then((issues) => {
        if (!cancelled) setQuality(issues);
      })
      .catch(() => {
        if (!cancelled) setQuality([]);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) {
    return (
      <div className="page">
        <PageIntro title={status === "loading" ? "파일을 불러오는 중" : "파일을 찾을 수 없습니다"} />
        <Button variant="secondary" to="/files">
          파일 목록
        </Button>
      </div>
    );
  }

  const preview = complaintsByFile(file.id);

  return (
    <div className="page">
      <PageIntro
        eyebrow={`${file.extension.toUpperCase()} · ${FILE_STATUS_LABEL[file.status]}`}
        title={file.originalName}
        lede={`${formatBytes(file.sizeBytes)} · ${file.rowCount === null ? "행 수 없음" : `${formatNumber(file.rowCount)}행`} · ${formatDate(file.createdAt)}`}
        actions={
          <Button
            onClick={() => void requestAnalysis(file.id, mapping, defaultSplitRule(file))}
            // 업로드 뒤 서버가 자동 분석을 이어 가는 동안(대기 포함) 다시 누르면 409가 난다
            disabled={busy || file.status === "processing" || file.status === "queued"}
          >
            {job?.status === "completed" ? "다시 분석" : "분석 실행"}
          </Button>
        }
      />

      {job?.error ? (
        <article className="card">
          <p className="caption">실패</p>
          <p className="error-code num">{job.error.code}</p>
          <p className="body notice">{job.error.message}</p>
        </article>
      ) : null}

      <article className="card">
        <div className="card-head">
          <h2 className="title-sm">작업 단계</h2>
          {job ? <span className="num">{job.progress}%</span> : null}
        </div>
        {job ? <StageTrack status={job.status} stage={job.stage} /> : <p className="empty">아직 분석 작업이 없습니다.</p>}
        {job && job.status !== "completed" && !STAGES.some((item) => item.id === job.stage) ? (
          <p className="caption notice">현재 단계: {job.stage}</p>
        ) : null}
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

      {columns.length > 0 ? (
        <MappingCard columns={columns} mapping={mapping} swapped={swapped} onChange={setMapping} />
      ) : null}

      {file.fileCategory !== "tabular" ? (
        <p className="notice">
          이 파일은 글자만 추출됩니다. 정제 파일(CSV)은 표 형식(CSV, XLSX)만 만듭니다.
        </p>
      ) : null}

      <article className="card">
        <div className="card-head">
          <h2 className="title-sm">추출 미리보기</h2>
          <span className="caption">
            {preview.length > 0 ? `앞 ${formatNumber(preview.length)}건` : `앞 ${formatNumber(lines.length)}줄`}
          </span>
        </div>
        {preview.length === 0 && lines.length > 0 ? (
          <ol className="stack">
            {lines.map((line, index) => (
              <li key={`${index}-${line}`} className="body">
                {line}
              </li>
            ))}
          </ol>
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
  const currentIndex = STAGES.findIndex((item) => item.id === stage);
  return (
    <div className="stage-scroll">
      <ol className="stages">
        {STAGES.map((item, index) => {
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

function MappingCard({
  columns,
  mapping,
  swapped,
  onChange,
}: {
  columns: string[];
  mapping: Partial<Record<string, MappingField>>;
  swapped: boolean;
  onChange: (mapping: Partial<Record<string, MappingField>>) => void;
}) {
  const [corrected, setCorrected] = useState(false);

  return (
    <article className="card">
      <div className="card-head">
        <h2 className="title-sm">컬럼 매핑</h2>
        {swapped && !corrected ? (
          <Button
            variant="secondary"
            onClick={() => {
              onChange({ ...mapping, 경도: "latitude", 위도: "longitude" });
              setCorrected(true);
            }}
          >
            경도·위도 교정
          </Button>
        ) : null}
      </div>
      {swapped ? (
        <p className="body">
          {corrected
            ? "경도 열은 위도 값으로, 위도 열은 경도 값으로 읽습니다."
            : "경도·위도 열 이름이 서로 바뀌어 있습니다. 교정하면 열 이름과 값을 맞춰 읽습니다."}
        </p>
      ) : (
        <p className="caption">공통 필드에 맞춘 뒤 분석을 실행합니다.</p>
      )}
      <div className="mapping-grid notice">
        {columns.map((column) => (
          <label className="field" key={column}>
            <span>{column}</span>
            <select
              className="select"
              value={mapping[column] ?? "ignore"}
              onChange={(event) => {
                const value = event.target.value as MappingField;
                onChange({ ...mapping, [column]: value });
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

/**
 * 문서·텍스트를 다시 분석할 때 쓸 나누기 규칙. PDF와 브라우저 OCR 결과는 국민신문고 목록처럼
 * 여러 민원을 모은 경우가 많아, 파일 전체가 민원 1건으로 합쳐지지 않게 그 규칙을 기본으로 둔다.
 * @param file 대상 파일
 */
function defaultSplitRule(file: DataFile): string | undefined {
  if (file.fileCategory === "tabular") return undefined;
  const name = file.originalName.toLowerCase();
  return file.extension.toLowerCase() === "pdf" || name.endsWith(".ocr.txt") ? "sinmungo" : undefined;
}
