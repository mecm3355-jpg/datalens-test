import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  candidates,
  cleaningPreviewByFile,
  cleaningRulesByFile,
  files as seedFiles,
  mappings as seedMappings,
  reviews,
} from "../data/mock";
import { inspectDemoFile } from "../lib/demoProcessing";
import { AppError } from "../api/AppError";
import type { ApiDashboardSummary } from "../api/datalens";
import { useApiWorkspace } from "../hooks/useApiWorkspace";
import type {
  CandidateDecision,
  CleaningDecision,
  CleaningPreviewRow,
  CleaningRule,
  DataFile,
  DemoCleaningArtifact,
  FileCategory,
  Mapping,
  ReviewItem,
} from "../types";

const STORAGE_KEY = "datalens-demo-workspace-v4";
const DATA_MODE = import.meta.env.VITE_DATA_MODE === "api" ? "api" : "demo";

type ReviewState = {
  status: ReviewItem["status"];
  reviewedCategoryId: string | null;
};

type StoredWorkspace = {
  extraFiles: DataFile[];
  cleaningDecisions: Record<string, CleaningDecision>;
  appliedCleaning: Record<string, string[]>;
  artifacts: Record<string, DemoCleaningArtifact>;
};

type WorkspaceValue = {
  dataMode: "demo" | "api";
  loading: boolean;
  workspaceError: string | null;
  dashboardSummary: ApiDashboardSummary | null;
  files: DataFile[];
  addFiles: (list: File[]) => Promise<string[]>;
  retryFileProcessing: (fileId: string) => Promise<boolean>;
  ensureFileData: (fileId: string) => Promise<void>;
  candidateDecision: (id: string) => CandidateDecision;
  mergedInto: (id: string) => string | null;
  decideCandidate: (id: string, decision: CandidateDecision, mergedIntoId?: string) => void;
  reviewState: (id: string) => ReviewState;
  confirmReview: (id: string, categoryId: string) => void;
  mappings: Mapping[];
  addMapping: (mapping: Omit<Mapping, "id" | "createdAt">) => void;
  analysisRequested: (fileId: string) => boolean;
  requestAnalysis: (fileId: string) => Promise<void>;
  cleaningDecision: (fileId: string, ruleId: string) => CleaningDecision;
  decideCleaningRule: (fileId: string, ruleId: string, decision: CleaningDecision) => void;
  cleaningRules: (fileId: string) => CleaningRule[];
  cleaningPreview: (fileId: string) => CleaningPreviewRow[];
  cleaningRows: (fileId: string) => Array<Record<string, string>>;
  cleaningArtifact: (fileId: string) => DemoCleaningArtifact | null;
  appliedCleaningRules: (fileId: string) => string[] | null;
  applyCleaningRules: (fileId: string, ruleIds: string[]) => Promise<void>;
  downloadCleanedFile: (file: DataFile, format: "csv" | "json") => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function inferCategory(name: string): FileCategory {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (["csv", "tsv", "json", "xlsx", "xls"].includes(extension)) return "tabular";
  if (["pdf", "docx", "hwpx", "hwp"].includes(extension)) return "document";
  if (["jpg", "jpeg", "png"].includes(extension)) return "image";
  if (["txt", "log"].includes(extension)) return "text";
  return "other";
}

function readStoredWorkspace(): StoredWorkspace {
  if (typeof window === "undefined") {
    return { extraFiles: [], cleaningDecisions: {}, appliedCleaning: {}, artifacts: {} };
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as StoredWorkspace | null;
    if (!stored) return { extraFiles: [], cleaningDecisions: {}, appliedCleaning: {}, artifacts: {} };
    return {
      extraFiles: (stored.extraFiles ?? []).map((file) =>
        file.status === "queued" || file.status === "processing"
          ? {
              ...file,
              status: "failed",
              uploadProgress: 0,
              processingError: "새로고침으로 브라우저 처리가 중단되었습니다. 원본 파일을 다시 선택해 주세요.",
            }
          : file,
      ),
      cleaningDecisions: stored.cleaningDecisions ?? {},
      appliedCleaning: stored.appliedCleaning ?? {},
      artifacts: stored.artifacts ?? {},
    };
  } catch {
    return { extraFiles: [], cleaningDecisions: {}, appliedCleaning: {}, artifacts: {} };
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const api = useApiWorkspace(DATA_MODE === "api");
  const stored = useMemo(() => readStoredWorkspace(), []);
  const [extraFiles, setExtraFiles] = useState<DataFile[]>(stored.extraFiles);
  const [artifacts, setArtifacts] = useState<Record<string, DemoCleaningArtifact>>(stored.artifacts);
  const [appliedCleaning, setAppliedCleaning] = useState<Record<string, string[]>>(stored.appliedCleaning);
  const fileHandles = useRef(new Map<string, File>());
  const [decisionMap, setDecisionMap] = useState<
    Record<string, { decision: CandidateDecision; mergedInto: string | null }>
  >({});
  const [reviewMap, setReviewMap] = useState<Record<string, ReviewState>>({});
  const [extraMappings, setExtraMappings] = useState<Mapping[]>([]);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [cleaningDecisions, setCleaningDecisions] = useState<Record<string, CleaningDecision>>(
    stored.cleaningDecisions,
  );

  useEffect(() => {
    if (DATA_MODE === "api") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ extraFiles, cleaningDecisions, appliedCleaning, artifacts } satisfies StoredWorkspace),
      );
    } catch {
      // Storage may be unavailable or full. The current session continues to work in memory.
    }
  }, [appliedCleaning, artifacts, cleaningDecisions, extraFiles]);

  const updateExtraFile = useCallback((id: string, patch: Partial<DataFile>) => {
    setExtraFiles((current) => current.map((file) => (file.id === id ? { ...file, ...patch } : file)));
  }, []);

  const processFile = useCallback(async (id: string, file: File, startDelay = 0) => {
    try {
      if (startDelay > 0) await delay(startDelay);
      updateExtraFile(id, { status: "processing", uploadProgress: 20, processingError: undefined });
      await delay(250);
      const artifact = await inspectDemoFile(file);
      updateExtraFile(id, { uploadProgress: 72 });
      await delay(350);
      setArtifacts((current) => ({ ...current, [id]: artifact }));
      const columns = artifact.rows[0] ? Object.keys(artifact.rows[0]) : [];
      updateExtraFile(id, {
        status: "completed",
        uploadProgress: 100,
        rowCount: artifact.source === "parsed" ? artifact.rows.length : null,
        columns,
        mapping: {},
        analysisSupported: artifact.analysis?.supported ?? false,
        cleaningSupported: artifact.source === "parsed" && ["csv", "json"].includes(file.name.split(".").pop()?.toLowerCase() ?? ""),
        processingError: undefined,
      });
    } catch (error) {
      updateExtraFile(id, {
        status: "failed",
        uploadProgress: 0,
        processingError: error instanceof AppError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "파일을 처리하지 못했습니다.",
      });
    }
  }, [updateExtraFile]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      dataMode: DATA_MODE,
      loading: DATA_MODE === "api" ? api.loading : false,
      workspaceError: DATA_MODE === "api" ? api.error : null,
      dashboardSummary: DATA_MODE === "api" ? api.dashboard : null,
      files: DATA_MODE === "api" ? api.files : [...extraFiles, ...seedFiles],
      addFiles: async (list) => {
        if (DATA_MODE === "api") return api.addFiles(list);
        const today = new Date().toISOString().slice(0, 10);
        const next = list.map((file) => ({
          id: crypto.randomUUID(),
          originalName: file.name,
          extension: file.name.split(".").pop()?.toLowerCase() ?? "",
          fileCategory: inferCategory(file.name),
          sizeBytes: file.size,
          status: "queued" as const,
          createdAt: today,
          mimeType: file.type || "application/octet-stream",
          storageLocation: `browser://datalens/${file.name}`,
          analysisSupported: undefined,
          cleaningSupported: inferCategory(file.name) === "tabular",
          rowCount: null,
          columns: [],
          mapping: {},
          uploadProgress: 0,
        }));
        setExtraFiles((current) => [...next, ...current]);
        next.forEach((dataFile, index) => {
          const original = list[index];
          fileHandles.current.set(dataFile.id, original);
          void processFile(dataFile.id, original, index * 120);
        });
        return next.map((file) => file.id);
      },
      retryFileProcessing: async (fileId) => {
        if (DATA_MODE === "api") return api.retryFileProcessing(fileId);
        const file = fileHandles.current.get(fileId);
        if (!file) return false;
        void processFile(fileId, file);
        return true;
      },
      ensureFileData: (fileId) => DATA_MODE === "api" ? api.ensureFileData(fileId) : Promise.resolve(),
      candidateDecision: (id) =>
        decisionMap[id]?.decision ?? candidates.find((item) => item.id === id)?.decision ?? "pending",
      mergedInto: (id) => decisionMap[id]?.mergedInto ?? null,
      decideCandidate: (id, decision, mergedIntoId) => {
        setDecisionMap((current) => ({
          ...current,
          [id]: { decision, mergedInto: mergedIntoId ?? null },
        }));
      },
      reviewState: (id) => {
        const saved = reviewMap[id];
        if (saved) return saved;
        const review = reviews.find((item) => item.id === id);
        return { status: review?.status ?? "pending", reviewedCategoryId: null };
      },
      confirmReview: (id, categoryId) => {
        setReviewMap((current) => ({
          ...current,
          [id]: { status: "done", reviewedCategoryId: categoryId },
        }));
      },
      mappings: [...extraMappings, ...seedMappings],
      addMapping: (mapping) => {
        setExtraMappings((current) => [
          {
            ...mapping,
            id: `map-local-${current.length + 1}`,
            createdAt: new Date().toISOString().slice(0, 10),
          },
          ...current,
        ]);
      },
      analysisRequested: (fileId) => Boolean(requested[fileId]),
      requestAnalysis: async (fileId) => {
        if (DATA_MODE === "api") return api.requestAnalysis(fileId);
        setRequested((current) => ({ ...current, [fileId]: true }));
      },
      cleaningDecision: (fileId, ruleId) => cleaningDecisions[`${fileId}:${ruleId}`] ?? "pending",
      decideCleaningRule: (fileId, ruleId, decision) => {
        setCleaningDecisions((current) => ({
          ...current,
          [`${fileId}:${ruleId}`]: decision,
        }));
      },
      cleaningRules: (fileId) => (DATA_MODE === "api" ? api.artifacts : artifacts)[fileId]?.rules
        ?? (DATA_MODE === "api" ? [] : cleaningRulesByFile(fileId)),
      cleaningPreview: (fileId) => (DATA_MODE === "api" ? api.artifacts : artifacts)[fileId]?.preview
        ?? (DATA_MODE === "api" ? [] : cleaningPreviewByFile[fileId] ?? []),
      cleaningRows: (fileId) => (DATA_MODE === "api" ? api.artifacts : artifacts)[fileId]?.rows ?? [],
      cleaningArtifact: (fileId) => (DATA_MODE === "api" ? api.artifacts : artifacts)[fileId] ?? null,
      appliedCleaningRules: (fileId) => (DATA_MODE === "api" ? api.appliedCleaning : appliedCleaning)[fileId] ?? null,
      applyCleaningRules: async (fileId, ruleIds) => {
        if (DATA_MODE === "api") {
          const rules = api.artifacts[fileId]?.rules.filter((rule) => ruleIds.includes(rule.id)) ?? [];
          return api.applyCleaningRules(fileId, rules);
        }
        setAppliedCleaning((current) => ({ ...current, [fileId]: [...ruleIds] }));
      },
      downloadCleanedFile: (file, format) => DATA_MODE === "api"
        ? api.downloadCleanedFile(file, format)
        : Promise.reject(new AppError("DEMO_DOWNLOAD", "데모 다운로드는 화면에서 생성합니다.")),
    }),
    [
      api,
      appliedCleaning,
      artifacts,
      cleaningDecisions,
      decisionMap,
      extraFiles,
      extraMappings,
      processFile,
      requested,
      reviewMap,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new AppError("WORKSPACE_PROVIDER_MISSING", "WorkspaceProvider가 필요합니다.");
  return value;
}
