import { useCallback, useEffect, useState } from "react";
import { AppError } from "../api/AppError";
import {
  datalensApi,
  type ApiDashboardSummary,
  type ApiJob,
  type ComplaintAnalysisOptions,
} from "../api/datalens";
import { cleanRuleKey, toArtifact, toDataFile } from "../features/files/apiAdapters";
import { notifyComplaintDataChanged } from "../lib/events";
import type { CleaningRule, DataFile, DataReport, DemoCleaningArtifact } from "../types";

const POLL_INTERVAL_MS = 1_500;
const MAX_POLL_ATTEMPTS = 1_200;

export type UploadResult = {
  id: string;
  originalName: string;
  success: boolean;
  unsupported?: boolean;
  message?: string;
  error?: string;
};

export type UploadLifecycleCallbacks = {
  onQueued?: (temporaryIds: string[]) => void;
  onRegistered?: (temporaryId: string, serverId: string) => void;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function messageOf(error: unknown): string {
  if (error instanceof AppError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : "서버 요청을 처리하지 못했습니다.";
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type ApiWorkspace = {
  files: DataFile[];
  artifacts: Record<string, DemoCleaningArtifact>;
  jobsByFile: Record<string, ApiJob>;
  appliedCleaning: Record<string, string[]>;
  reports: Record<string, DataReport>;
  loading: boolean;
  error: string | null;
  dashboard: ApiDashboardSummary | null;
  addFiles: (files: File[], callbacks?: UploadLifecycleCallbacks) => Promise<UploadResult[]>;
  retryFileProcessing: (fileId: string) => Promise<void>;
  requestAnalysis: (fileId: string, options?: ComplaintAnalysisOptions) => Promise<void>;
  analyzeOcrText: (originalName: string, text: string, splitRule?: string) => Promise<string>;
  requestReport: (fileId: string) => Promise<void>;
  ensureFileData: (fileId: string) => Promise<void>;
  applyCleaningRules: (fileId: string, rules: CleaningRule[]) => Promise<void>;
  downloadCleanedFile: (file: DataFile, format: "csv" | "json") => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
};

/** FastAPI 파일·작업·정제 API를 화면 상태로 연결합니다. */
export function useApiWorkspace(enabled: boolean): ApiWorkspace {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, DemoCleaningArtifact>>({});
  const [jobsByFile, setJobsByFile] = useState<Record<string, ApiJob>>({});
  const [appliedCleaning, setAppliedCleaning] = useState<Record<string, string[]>>({});
  const [reports, setReports] = useState<Record<string, DataReport>>({});
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ApiDashboardSummary | null>(null);

  const patchFile = useCallback((fileId: string, patch: Partial<DataFile>) => {
    setFiles((current) => current.map((file) => (file.id === fileId ? { ...file, ...patch } : file)));
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      setDashboard(await datalensApi.dashboard());
    } catch {
      // 파일 작업은 계속 사용할 수 있어야 하므로 보조 집계 실패는 치명 오류로 올리지 않습니다.
    }
  }, []);

  const ensureFileData = useCallback(async (fileId: string) => {
    try {
      const serverFile = await datalensApi.getFile(fileId);
      const resolvedFile = toDataFile(serverFile);
      setFiles((current) => {
        const exists = current.some((file) => file.id === fileId);
        return exists
          ? current.map((file) => (file.id === fileId ? resolvedFile : file))
          : [resolvedFile, ...current];
      });
      if (serverFile.lastJobId) {
        const latestJob = await datalensApi.job(serverFile.lastJobId);
        setJobsByFile((current) => ({ ...current, [fileId]: latestJob }));
        if (latestJob.error) {
          patchFile(fileId, {
            processingError: `${latestJob.error.code}: ${latestJob.error.message}`,
          });
        }
      }
      if (serverFile.status !== "completed" || !serverFile.processingCapabilities.qualityCheck) return;
      const [preview, analysis, suggestions, versions, report] = await Promise.all([
        datalensApi.preview(fileId),
        datalensApi.analysis(fileId),
        serverFile.processingCapabilities.cleaning
          ? datalensApi.suggestions(fileId)
          : Promise.resolve([]),
        serverFile.processingCapabilities.cleaning
          ? datalensApi.versions(fileId)
          : Promise.resolve([]),
        datalensApi.latestReport(fileId).catch(() => null),
      ]);
      const latestCleaning = versions.find((version) => version.resultType === "cleaning");
      const cleanedPreview = latestCleaning
        ? await datalensApi.cleanedPreview(fileId, latestCleaning.version)
        : null;
      const artifact = toArtifact(preview, analysis, suggestions, cleanedPreview);
      setArtifacts((current) => ({ ...current, [fileId]: artifact }));
      setReports((current) => {
        if (report) return { ...current, [fileId]: report };
        const next = { ...current };
        delete next[fileId];
        return next;
      });
      setAppliedCleaning((current) => {
        if (!latestCleaning) {
          const next = { ...current };
          delete next[fileId];
          return next;
        }
        const appliedKeys = new Set(latestCleaning.cleaning?.rules?.map(cleanRuleKey) ?? []);
        return {
          ...current,
          [fileId]: artifact.rules
            .filter((rule) => rule.backendRule && appliedKeys.has(cleanRuleKey(rule.backendRule)))
            .map((rule) => rule.id),
        };
      });
      const columns = Array.isArray(analysis.analysis.columns)
        ? analysis.analysis.columns.flatMap((column) => {
            if (!column || typeof column !== "object") return [];
            const name = (column as Record<string, unknown>).name;
            return typeof name === "string" ? [name] : [];
          })
        : preview.columns ?? Object.keys(artifact.rows[0] ?? {});
      patchFile(fileId, {
        rowCount: typeof analysis.analysis.rowCount === "number" ? analysis.analysis.rowCount : null,
        columns,
      });
    } catch (loadError) {
      patchFile(fileId, { processingError: messageOf(loadError) });
    }
  }, [patchFile]);

  const pollJob = useCallback(async (jobId: string, fileId: string): Promise<ApiJob> => {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const job = await datalensApi.job(jobId);
      setJobsByFile((current) => ({ ...current, [fileId]: job }));
      patchFile(fileId, {
        status: job.status,
        uploadProgress: job.progress,
        processingError: job.error ? `${job.error.code}: ${job.error.message}` : undefined,
      });
      if (job.status === "completed" || job.status === "failed") {
        const refreshed = await datalensApi.getFile(fileId);
        setFiles((current) => current.map((file) => (file.id === fileId ? toDataFile(refreshed) : file)));
        void refreshDashboard();
        return job;
      }
      await delay(POLL_INTERVAL_MS);
    }
    throw new AppError("JOB_TIMEOUT", "처리 시간이 길어 상태 확인을 중단했습니다. 잠시 후 다시 확인해 주세요.");
  }, [patchFile, refreshDashboard]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await datalensApi.listFiles();
        if (!active) return;
        setFiles(response.map(toDataFile));
        void refreshDashboard();
        setError(null);
        for (const file of response) {
          if ((file.status === "queued" || file.status === "processing") && file.lastJobId) {
            void pollJob(file.lastJobId, file.fileId).catch((pollError: unknown) => {
              patchFile(file.fileId, { processingError: messageOf(pollError) });
            });
          }
        }
      } catch (loadError) {
        if (active) setError(messageOf(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [enabled, patchFile, pollJob, refreshDashboard]);

  const addFiles = useCallback(async (
    selected: File[],
    callbacks?: UploadLifecycleCallbacks,
  ): Promise<UploadResult[]> => {
    const optimistic = selected.map((file) => ({
      id: crypto.randomUUID(),
      originalName: file.name,
      extension: file.name.split(".").pop()?.toLowerCase() ?? "",
      fileCategory: "other" as const,
      sizeBytes: file.size,
      status: "queued" as const,
      createdAt: new Date().toISOString(),
      mimeType: file.type || "application/octet-stream",
      rowCount: null,
      columns: [],
      mapping: {},
      uploadProgress: 0,
      isUploading: true,
    }));
    setFiles((current) => [...optimistic, ...current]);
    callbacks?.onQueued?.(optimistic.map((file) => file.id));

    const ids = await Promise.all(selected.map(async (file, index) => {
      const temporaryId = optimistic[index].id;
      try {
        patchFile(temporaryId, { status: "processing", uploadProgress: 5 });
        const uploaded = await datalensApi.upload(file);
        const serverFile = await datalensApi.getFile(uploaded.fileId);
        setFiles((current) => current.map((item) =>
          item.id === temporaryId ? toDataFile(serverFile) : item,
        ));
        callbacks?.onRegistered?.(temporaryId, serverFile.fileId);
        if (serverFile.lastJobId) {
          void pollJob(serverFile.lastJobId, serverFile.fileId)
            .then(() => ensureFileData(serverFile.fileId))
            .catch((pollError: unknown) => {
              patchFile(serverFile.fileId, { processingError: messageOf(pollError) });
            });
        }
        return {
          id: serverFile.fileId,
          originalName: serverFile.originalName,
          success: true,
          unsupported: serverFile.category === "other",
          message: uploaded.message,
        };
      } catch (uploadError) {
        patchFile(temporaryId, {
          status: "failed",
          uploadProgress: 0,
          processingError: messageOf(uploadError),
        });
        return {
          id: temporaryId,
          originalName: file.name,
          success: false,
          error: messageOf(uploadError),
        };
      }
    }));
    return ids;
  }, [ensureFileData, patchFile, pollJob]);

  const retryFileProcessing = useCallback(async (fileId: string): Promise<void> => {
    const started = await datalensApi.process(fileId);
    const job = await pollJob(started.jobId, fileId);
    if (job.status === "failed") {
      throw new AppError(job.error?.code ?? "PROCESS_FAILED", job.error?.message ?? "분석에 실패했습니다.");
    }
    await ensureFileData(fileId);
  }, [ensureFileData, pollJob]);

  const requestAnalysis = useCallback(async (
    fileId: string,
    options?: ComplaintAnalysisOptions,
  ): Promise<void> => {
    const started = await datalensApi.startComplaintAnalysis(fileId, options);
    const job = await pollJob(started.jobId, fileId);
    if (job.status === "failed") {
      throw new AppError(job.error?.code ?? "ANALYSIS_FAILED", job.error?.message ?? "민원 분석에 실패했습니다.");
    }
    await ensureFileData(fileId);
    notifyComplaintDataChanged();
  }, [ensureFileData, pollJob]);

  // 브라우저 OCR 결과를 텍스트 파일로 올려 진단이 끝나면 민원 분석까지 이어 간다. 새 파일 ID를 돌려준다.
  const analyzeOcrText = useCallback(async (originalName: string, text: string, splitRule?: string): Promise<string> => {
    const file = new File([text], `${originalName}.ocr.txt`, { type: "text/plain" });
    const uploaded = await datalensApi.upload(file);
    const serverFile = await datalensApi.getFile(uploaded.fileId);
    setFiles((current) => [toDataFile(serverFile), ...current]);
    if (serverFile.lastJobId) {
      const diagnosis = await pollJob(serverFile.lastJobId, serverFile.fileId);
      if (diagnosis.status === "failed") {
        throw new AppError(diagnosis.error?.code ?? "PROCESS_FAILED", diagnosis.error?.message ?? "글자 파일 진단에 실패했습니다.");
      }
    }
    await requestAnalysis(serverFile.fileId, { splitRule });
    return serverFile.fileId;
  }, [pollJob, requestAnalysis]);

  const requestReport = useCallback(async (fileId: string): Promise<void> => {
    const started = await datalensApi.createReport(fileId);
    const job = await pollJob(started.jobId, fileId);
    if (job.status === "failed") {
      throw new AppError(job.error?.code ?? "REPORT_FAILED", job.error?.message ?? "리포트 생성에 실패했습니다.");
    }
    const report = await datalensApi.latestReport(fileId);
    if (!report) throw new AppError("REPORT_NOT_FOUND", "생성된 리포트를 찾을 수 없습니다.");
    setReports((current) => ({ ...current, [fileId]: report }));
  }, [pollJob]);

  const applyCleaningRules = useCallback(async (fileId: string, rules: CleaningRule[]) => {
    const payloads = rules.flatMap((rule) => (rule.backendRule ? [rule.backendRule] : []));
    if (payloads.length !== rules.length) {
      throw new AppError("RULE_MAPPING_MISSING", "서버 정제 규칙 정보를 찾을 수 없습니다.");
    }
    const started = await datalensApi.clean(fileId, payloads);
    const job = await pollJob(started.jobId, fileId);
    if (job.status === "failed") {
      throw new AppError(job.error?.code ?? "CLEAN_FAILED", job.error?.message ?? "정제에 실패했습니다.");
    }
    setAppliedCleaning((current) => ({ ...current, [fileId]: rules.map((rule) => rule.id) }));
    await ensureFileData(fileId);
  }, [ensureFileData, pollJob]);

  const downloadCleanedFile = useCallback(async (file: DataFile, format: "csv" | "json") => {
    const blob = await datalensApi.export(file.id, format);
    const baseName = file.originalName.replace(/\.[^.]+$/, "");
    saveBlob(blob, `${baseName}_정제결과.${format}`);
  }, []);

  return {
    files,
    artifacts,
    jobsByFile,
    appliedCleaning,
    reports,
    loading,
    error,
    dashboard,
    addFiles,
    retryFileProcessing,
    requestAnalysis,
    analyzeOcrText,
    requestReport,
    ensureFileData,
    applyCleaningRules,
    downloadCleanedFile,
    deleteFile: async (fileId: string) => {
      await datalensApi.deleteFile(fileId);
      setFiles((current) => current.filter((file) => file.id !== fileId));
      setArtifacts((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => id !== fileId),
      ));
      setJobsByFile((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => id !== fileId),
      ));
      setReports((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => id !== fileId),
      ));
      void refreshDashboard();
    },
  };
}
