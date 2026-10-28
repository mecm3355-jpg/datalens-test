import { useCallback, useEffect, useState } from "react";
import { AppError } from "../api/AppError";
import { datalensApi, type ApiDashboardSummary, type ApiJob } from "../api/datalens";
import { cleanRuleKey, toArtifact, toDataFile } from "../features/files/apiAdapters";
import type { CleaningRule, DataFile, DemoCleaningArtifact } from "../types";

const POLL_INTERVAL_MS = 800;
const MAX_POLL_ATTEMPTS = 150;

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
  appliedCleaning: Record<string, string[]>;
  loading: boolean;
  error: string | null;
  dashboard: ApiDashboardSummary | null;
  addFiles: (files: File[]) => Promise<string[]>;
  retryFileProcessing: (fileId: string) => Promise<boolean>;
  requestAnalysis: (fileId: string) => Promise<void>;
  ensureFileData: (fileId: string) => Promise<void>;
  applyCleaningRules: (fileId: string, rules: CleaningRule[]) => Promise<void>;
  downloadCleanedFile: (file: DataFile, format: "csv" | "json") => Promise<void>;
};

/** FastAPI 파일·작업·정제 API를 화면 상태로 연결합니다. */
export function useApiWorkspace(enabled: boolean): ApiWorkspace {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, DemoCleaningArtifact>>({});
  const [appliedCleaning, setAppliedCleaning] = useState<Record<string, string[]>>({});
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
      if (serverFile.status !== "completed" || !serverFile.processingCapabilities.qualityCheck) return;
      const [preview, analysis, suggestions, versions] = await Promise.all([
        datalensApi.preview(fileId),
        datalensApi.analysis(fileId),
        serverFile.category === "tabular" ? datalensApi.suggestions(fileId) : Promise.resolve([]),
        serverFile.category === "tabular" ? datalensApi.versions(fileId) : Promise.resolve([]),
      ]);
      const artifact = toArtifact(preview, analysis, suggestions);
      setArtifacts((current) => ({ ...current, [fileId]: artifact }));
      const latestCleaning = versions.find((version) => version.resultType === "cleaning");
      const appliedKeys = new Set((latestCleaning?.cleaning?.rules ?? []).map(cleanRuleKey));
      setAppliedCleaning((current) => ({
        ...current,
        [fileId]: artifact.rules
          .filter((rule) => rule.backendRule && appliedKeys.has(cleanRuleKey(rule.backendRule)))
          .map((rule) => rule.id),
      }));
      patchFile(fileId, {
        rowCount: typeof analysis.analysis.rowCount === "number" ? analysis.analysis.rowCount : null,
        columns: Array.isArray(analysis.analysis.columns)
          ? analysis.analysis.columns.flatMap((column) => {
              if (!column || typeof column !== "object") return [];
              const name = (column as Record<string, unknown>).name;
              return typeof name === "string" ? [name] : [];
            })
          : [],
      });
    } catch (loadError) {
      patchFile(fileId, { processingError: messageOf(loadError) });
    }
  }, [patchFile]);

  const pollJob = useCallback(async (jobId: string, fileId: string): Promise<ApiJob> => {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const job = await datalensApi.job(jobId);
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

  const addFiles = useCallback(async (selected: File[]): Promise<string[]> => {
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
    }));
    setFiles((current) => [...optimistic, ...current]);

    const ids = await Promise.all(selected.map(async (file, index) => {
      const temporaryId = optimistic[index].id;
      try {
        patchFile(temporaryId, { status: "processing", uploadProgress: 5 });
        const uploaded = await datalensApi.upload(file);
        const serverFile = await datalensApi.getFile(uploaded.fileId);
        setFiles((current) => current.map((item) =>
          item.id === temporaryId ? toDataFile(serverFile) : item,
        ));
        if (serverFile.lastJobId) {
          void pollJob(serverFile.lastJobId, serverFile.fileId)
            .then(() => ensureFileData(serverFile.fileId))
            .catch((pollError: unknown) => {
              patchFile(serverFile.fileId, { processingError: messageOf(pollError) });
            });
        }
        return serverFile.fileId;
      } catch (uploadError) {
        patchFile(temporaryId, {
          status: "failed",
          uploadProgress: 0,
          processingError: messageOf(uploadError),
        });
        return temporaryId;
      }
    }));
    return ids;
  }, [ensureFileData, patchFile, pollJob]);

  const requestAnalysis = useCallback(async (fileId: string): Promise<void> => {
    const started = await datalensApi.process(fileId);
    const job = await pollJob(started.jobId, fileId);
    if (job.status === "failed") {
      throw new AppError(job.error?.code ?? "PROCESS_FAILED", job.error?.message ?? "분석에 실패했습니다.");
    }
    await ensureFileData(fileId);
  }, [ensureFileData, pollJob]);

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
    appliedCleaning,
    loading,
    error,
    dashboard,
    addFiles,
    retryFileProcessing: async (fileId) => {
      try {
        await requestAnalysis(fileId);
        return true;
      } catch (retryError) {
        patchFile(fileId, { processingError: messageOf(retryError) });
        return false;
      }
    },
    requestAnalysis,
    ensureFileData,
    applyCleaningRules,
    downloadCleanedFile,
  };
}
