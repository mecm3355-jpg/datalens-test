import { useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router";
import { DataTable } from "../components/DataTable";
import { PageIntro } from "../components/PageIntro";
import { FILE_CATEGORY_LABEL, FILE_STATUS_LABEL } from "../lib/labels";
import { formatBytes, formatDate, formatNumber } from "../lib/format";
import { useWorkspace } from "../state/workspace";
import type { DataFile, FileCategory, FileStatus } from "../types";

const API_SUPPORTED_EXTENSIONS = new Set([
  "csv", "tsv", "json", "xlsx", "xls", "txt", "log", "docx", "pdf", "jpg", "jpeg", "png",
]);
const DEMO_SUPPORTED_EXTENSIONS = new Set(["csv", "json", "txt", "log", "jpg", "jpeg", "png"]);
const configuredMaxFileSizeMb = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB ?? "100");
const MAX_FILE_SIZE_MB = Number.isFinite(configuredMaxFileSizeMb) && configuredMaxFileSizeMb > 0
  ? configuredMaxFileSizeMb
  : 100;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

type StatusFilter = "all" | FileStatus;
type CategoryFilter = "all" | FileCategory;
type UploadFeedback = { tone: "success" | "error"; message: string } | null;

/** 파일명에서 마지막 확장자를 소문자로 꺼내 지원 여부 안내에 사용합니다. */
function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function FilesPage() {
  const { files, addFiles, deleteFile, dataMode, loading, workspaceError } = useWorkspace();
  const supportedExtensions = dataMode === "api" ? API_SUPPORTED_EXTENSIONS : DEMO_SUPPORTED_EXTENSIONS;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [recentUploadIds, setRecentUploadIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return files.filter((file) => {
      const matchesQuery = !normalizedQuery || file.originalName.toLocaleLowerCase("ko-KR").includes(normalizedQuery);
      const matchesStatus = status === "all" || file.status === status;
      const matchesCategory = category === "all" || file.fileCategory === category;
      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [category, files, query, status]);

  const recentUploadBatch = useMemo(() => {
    const filesById = new Map(files.map((file) => [file.id, file]));
    return recentUploadIds.flatMap((id) => {
      const file = filesById.get(id);
      return file ? [file] : [];
    });
  }, [files, recentUploadIds]);

  const handleFiles = async (pickedFiles: File[]) => {
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of pickedFiles) {
      if (file.size === 0) {
        rejected.push(`${file.name}: 빈 파일`);
      } else if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: ${MAX_FILE_SIZE_MB}MB 용량 초과`);
      } else {
        accepted.push(file);
      }
    }

    if (accepted.length > 0) {
      const expectedUnsupported = accepted.filter(
        (file) => !supportedExtensions.has(fileExtension(file.name)),
      );
      if (expectedUnsupported.length > 0) {
        setUploadFeedback({
          tone: "success",
          message: `${expectedUnsupported.map((file) => file.name).join(", ")}: 내용 분석을 지원하지 않는 형식입니다. 원본과 기본 정보만 등록합니다.`,
        });
      }
      const results = await addFiles(accepted);
      setRecentUploadIds(results.map((result) => result.id));
      const failed = results.filter((result) => !result.success);
      const unsupported = results.filter((result) => result.success && result.unsupported);
      const registered = results.length - failed.length;
      const messages = [`${registered}개 파일 등록 완료`];
      if (unsupported.length > 0) {
        messages.push(
          `${unsupported.length}개는 내용 분석 미지원(메타데이터만 저장): ${unsupported
            .map((result) => result.originalName)
            .join(", ")}`,
        );
      }
      if (failed.length > 0) {
        messages.push(
          `${failed.length}개 실패: ${failed
            .map((result) => `${result.originalName} - ${result.error ?? "알 수 없는 오류"}`)
            .join(" · ")}`,
        );
      }
      if (rejected.length > 0) {
        messages.push(`${rejected.length}개 제외: ${rejected.join(" · ")}`);
      }
      setUploadFeedback({
        tone: failed.length > 0 || rejected.length > 0 ? "error" : "success",
        message: messages.join(" · "),
      });
      return;
    }
    if (rejected.length > 0) {
      setUploadFeedback({ tone: "error", message: `${rejected.length}개 파일을 제외했습니다. ${rejected.join(" · ")}` });
      return;
    }
    setUploadFeedback({
      tone: "success",
      message: "선택한 파일이 없습니다.",
    });
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles([...event.dataTransfer.files]);
  };

  const handleDelete = async (file: DataFile) => {
    if (file.isUploading || deletingIds.has(file.id)) return;
    if (!window.confirm(`'${file.originalName}' 파일과 관련 처리 결과를 모두 삭제할까요?`)) return;

    setDeletingIds((current) => new Set(current).add(file.id));
    try {
      await deleteFile(file.id);
      setRecentUploadIds((current) => current.filter((id) => id !== file.id));
      setUploadFeedback({ tone: "success", message: `${file.originalName} 파일을 삭제했습니다.` });
    } catch (error) {
      setUploadFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : `${file.originalName} 파일을 삭제하지 못했습니다.`,
      });
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(file.id);
        return next;
      });
    }
  };

  const hasFilters = query.trim() !== "" || status !== "all" || category !== "all";

  return (
    <div className="page">
      <PageIntro
        eyebrow="입력"
        title="파일"
        lede="원본 파일을 업로드하고 처리 상태, 정제 규칙, 분석 결과를 한곳에서 관리합니다."
      />

      <label
        className={["upload-zone", isDragging ? "is-dragging" : ""].filter(Boolean).join(" ")}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          className="upload-input"
          type="file"
          multiple
          onChange={(event) => {
            const picked = event.target.files;
            if (picked && picked.length > 0) void handleFiles([...picked]);
            event.target.value = "";
          }}
        />
        <span className="upload-kicker">파일 업로드</span>
        <span className="title-sm">파일 여러 개를 여기로 끌어오거나 직접 선택하세요</span>
        <span className="caption">
          내용 분석: {dataMode === "api"
            ? "CSV, TSV, JSON, XLSX, XLS, TXT, LOG, DOCX, PDF, JPG, PNG"
            : "CSV, JSON, TXT, LOG, JPG, PNG"} · 기타 형식은 메타데이터 등록 · 파일당 최대 {MAX_FILE_SIZE_MB}MB
        </span>
        <span className="btn btn-primary">파일 선택</span>
      </label>

      <aside className="upload-guide" aria-labelledby="upload-guide-title">
        <div className="upload-guide-copy">
          <span className="upload-guide-icon" aria-hidden="true">+</span>
          <div>
            <h2 className="title-sm" id="upload-guide-title">여러 파일을 한 번에 업로드할 수 있어요</h2>
            <p className="body">파일 선택 창에서 Ctrl 또는 Shift를 누른 채 선택하거나, 여러 파일을 업로드 영역에 함께 끌어다 놓으세요.</p>
          </div>
        </div>
        <ol className="upload-guide-steps" aria-label="다중 파일 업로드 방법">
          <li><span>1</span>여러 파일 선택</li>
          <li><span>2</span>파일별 처리 상태 확인</li>
          <li><span>3</span>완료 후 상세·정제 확인</li>
        </ol>
      </aside>

      {dataMode === "api" ? (
        <div className="feedback" role="status">
          {loading ? "백엔드 파일 목록을 불러오는 중입니다." : "백엔드 연결 모드입니다. 업로드한 원본과 처리 결과가 서버에 저장됩니다."}
        </div>
      ) : null}
      {workspaceError ? <div className="feedback feedback-error" role="alert">{workspaceError}</div> : null}

      {uploadFeedback ? (
        <div
          className={`feedback feedback-${uploadFeedback.tone}`}
          role={uploadFeedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <span>{uploadFeedback.message}</span>
          <button type="button" onClick={() => setUploadFeedback(null)} aria-label="알림 닫기">
            닫기
          </button>
        </div>
      ) : null}

      {recentUploadBatch.length > 0 ? (
        <section className="card upload-batch" aria-labelledby="upload-batch-title">
          <div className="card-head">
            <div>
              <h2 className="title-sm" id="upload-batch-title">이번 업로드</h2>
              <p className="caption">선택한 {formatNumber(recentUploadBatch.length)}개 파일을 각각 처리하고 있습니다.</p>
            </div>
            <button className="btn btn-text" type="button" onClick={() => setRecentUploadIds([])}>목록 닫기</button>
          </div>
          <ul className="upload-batch-list">
            {recentUploadBatch.map((file) => {
              const progress = file.uploadProgress ?? (file.status === "completed" ? 100 : 0);
              return (
                <li className="upload-batch-item" key={file.id}>
                  <div className="upload-batch-meta">
                    <span className="file-name-link">{file.originalName}</span>
                    <span className={`pill status-pill status-${file.status}`}>{FILE_STATUS_LABEL[file.status]}</span>
                    <span className="caption num">{progress}%</span>
                  </div>
                  {file.analysisSupported === false ? (
                    <p className="caption">내용 분석 미지원 · 원본과 메타데이터만 등록됨</p>
                  ) : null}
                  <div
                    className="upload-progress"
                    role="progressbar"
                    aria-label={`${file.originalName} 처리 진행률`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="card" aria-labelledby="file-list-title">
        <div className="card-head file-list-head">
          <div>
            <h2 className="title-sm" id="file-list-title">파일 목록</h2>
            <p className="caption">전체 {formatNumber(files.length)}개 중 {formatNumber(filteredFiles.length)}개 표시</p>
          </div>
          {hasFilters ? (
            <button
              className="btn btn-text"
              type="button"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setCategory("all");
              }}
            >
              필터 초기화
            </button>
          ) : null}
        </div>

        <div className="filter-bar file-filters">
          <label className="field search">
            <span>파일명 검색</span>
            <input
              className="input"
              type="search"
              value={query}
              placeholder="파일명을 입력하세요"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="field filter-select">
            <span>처리 상태</span>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">전체 상태</option>
              <option value="queued">대기</option>
              <option value="processing">처리 중</option>
              <option value="completed">완료</option>
              <option value="failed">실패</option>
            </select>
          </label>
          <label className="field filter-select">
            <span>파일 형식</span>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}>
              <option value="all">전체 형식</option>
              <option value="tabular">표 형식</option>
              <option value="document">문서</option>
              <option value="text">텍스트</option>
              <option value="image">이미지</option>
              <option value="other">기타</option>
            </select>
          </label>
        </div>

        <DataTable
          framed={false}
          rows={filteredFiles}
          rowKey={(file) => file.id}
          empty="조건에 맞는 파일이 없습니다. 검색어나 필터를 변경해 보세요."
          columns={[
            {
              key: "name",
              header: "파일",
              render: (file) => (
                file.isUploading ? (
                  <span className="file-name-link" aria-label={`${file.originalName} 업로드 중`}>
                    {file.originalName}
                  </span>
                ) : (
                  <Link className="link file-name-link" to={`/files/${file.id}`}>
                    {file.originalName}
                  </Link>
                )
              ),
            },
            {
              key: "kind",
              header: "형식",
              render: (file) => (
                <span>
                  {file.extension.toUpperCase() || "UNKNOWN"} · {FILE_CATEGORY_LABEL[file.fileCategory]}
                  {file.analysisSupported === false ? <small className="support-note">분석 미지원 · 메타데이터만</small> : null}
                </span>
              ),
            },
            { key: "size", header: "크기", numeric: true, render: (file) => formatBytes(file.sizeBytes) },
            {
              key: "rows",
              header: "행",
              numeric: true,
              render: (file) => (file.rowCount === null ? "—" : formatNumber(file.rowCount)),
            },
            {
              key: "status",
              header: "상태",
              render: (file) => (
                <div className="status-cell">
                  <span className={`pill status-pill status-${file.status}`}>{FILE_STATUS_LABEL[file.status]}</span>
                  {file.status === "processing" && file.uploadProgress !== undefined ? (
                    <span className="caption num">{file.uploadProgress}%</span>
                  ) : null}
                </div>
              ),
            },
            { key: "date", header: "업로드일", numeric: true, render: (file) => formatDate(file.createdAt) },
            {
              key: "action",
              header: "관리",
              render: (file) => {
                const isDeleting = deletingIds.has(file.id);
                return (
                  <div className="cluster">
                    {file.isUploading ? <span className="caption">업로드 중</span> : <Link className="link" to={`/files/${file.id}`}>상세</Link>}
                    {!file.isUploading && file.status === "completed" && (file.cleaningSupported ?? file.fileCategory === "tabular") ? <Link className="link" to={`/files/${file.id}/cleaning`}>정제</Link> : null}
                    {!file.isUploading ? (
                      <button
                        className="btn btn-text btn-text-danger"
                        type="button"
                        disabled={isDeleting}
                        aria-label={`${file.originalName} 삭제`}
                        onClick={() => void handleDelete(file)}
                      >
                        {isDeleting ? "삭제 중" : "삭제"}
                      </button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
        />
      </section>
    </div>
  );
}
