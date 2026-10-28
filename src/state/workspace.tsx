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

const STORAGE_KEY = "datalens-demo-workspace-v3";

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
  files: DataFile[];
  addFiles: (list: File[]) => string[];
  retryFileProcessing: (fileId: string) => boolean;
  candidateDecision: (id: string) => CandidateDecision;
  mergedInto: (id: string) => string | null;
  decideCandidate: (id: string, decision: CandidateDecision, mergedIntoId?: string) => void;
  reviewState: (id: string) => ReviewState;
  confirmReview: (id: string, categoryId: string) => void;
  mappings: Mapping[];
  addMapping: (mapping: Omit<Mapping, "id" | "createdAt">) => void;
  analysisRequested: (fileId: string) => boolean;
  requestAnalysis: (fileId: string) => void;
  cleaningDecision: (fileId: string, ruleId: string) => CleaningDecision;
  decideCleaningRule: (fileId: string, ruleId: string, decision: CleaningDecision) => void;
  cleaningRules: (fileId: string) => CleaningRule[];
  cleaningPreview: (fileId: string) => CleaningPreviewRow[];
  cleaningRows: (fileId: string) => Array<Record<string, string>>;
  cleaningArtifact: (fileId: string) => DemoCleaningArtifact | null;
  appliedCleaningRules: (fileId: string) => string[] | null;
  applyCleaningRules: (fileId: string, ruleIds: string[]) => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function inferCategory(name: string): FileCategory {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (["csv", "tsv", "xlsx", "xls"].includes(extension)) return "tabular";
  if (["pdf", "docx", "hwpx", "hwp"].includes(extension)) return "document";
  if (["jpg", "jpeg", "png"].includes(extension)) return "image";
  if (extension === "txt") return "text";
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
  const stored = useMemo(readStoredWorkspace, []);
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
        processingError: undefined,
      });
    } catch (error) {
      updateExtraFile(id, {
        status: "failed",
        uploadProgress: 0,
        processingError: error instanceof Error ? error.message : "파일을 처리하지 못했습니다.",
      });
    }
  }, [updateExtraFile]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      files: [...extraFiles, ...seedFiles],
      addFiles: (list) => {
        const today = new Date().toISOString().slice(0, 10);
        const next = list.map((file) => ({
          id: crypto.randomUUID(),
          originalName: file.name,
          extension: file.name.split(".").pop()?.toLowerCase() ?? "",
          fileCategory: inferCategory(file.name),
          sizeBytes: file.size,
          status: "queued" as const,
          createdAt: today,
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
      retryFileProcessing: (fileId) => {
        const file = fileHandles.current.get(fileId);
        if (!file) return false;
        void processFile(fileId, file);
        return true;
      },
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
      requestAnalysis: (fileId) => {
        setRequested((current) => ({ ...current, [fileId]: true }));
      },
      cleaningDecision: (fileId, ruleId) => cleaningDecisions[`${fileId}:${ruleId}`] ?? "pending",
      decideCleaningRule: (fileId, ruleId, decision) => {
        setCleaningDecisions((current) => ({
          ...current,
          [`${fileId}:${ruleId}`]: decision,
        }));
      },
      cleaningRules: (fileId) => artifacts[fileId]?.rules ?? cleaningRulesByFile(fileId),
      cleaningPreview: (fileId) => artifacts[fileId]?.preview ?? cleaningPreviewByFile[fileId] ?? [],
      cleaningRows: (fileId) => artifacts[fileId]?.rows ?? [],
      cleaningArtifact: (fileId) => artifacts[fileId] ?? null,
      appliedCleaningRules: (fileId) => appliedCleaning[fileId] ?? null,
      applyCleaningRules: (fileId, ruleIds) => {
        setAppliedCleaning((current) => ({ ...current, [fileId]: [...ruleIds] }));
      },
    }),
    [
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
  if (!value) throw new Error("WorkspaceProvider가 필요합니다.");
  return value;
}
