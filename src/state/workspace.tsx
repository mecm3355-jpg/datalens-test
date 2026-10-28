import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { candidates, files as seedFiles, mappings as seedMappings, reviews } from "../data/mock";
import type {
  CandidateDecision,
  CleaningDecision,
  DataFile,
  FileCategory,
  Mapping,
  ReviewItem,
} from "../types";

type ReviewState = {
  status: ReviewItem["status"];
  reviewedCategoryId: string | null;
};

type WorkspaceValue = {
  files: DataFile[];
  addFiles: (list: File[]) => string[];
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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [extraFiles, setExtraFiles] = useState<DataFile[]>([]);
  const processingTimers = useRef<number[]>([]);
  const [decisionMap, setDecisionMap] = useState<
    Record<string, { decision: CandidateDecision; mergedInto: string | null }>
  >({});
  const [reviewMap, setReviewMap] = useState<Record<string, ReviewState>>({});
  const [extraMappings, setExtraMappings] = useState<Mapping[]>([]);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [cleaningDecisions, setCleaningDecisions] = useState<Record<string, CleaningDecision>>({});

  useEffect(() => {
    const timers = processingTimers.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  const updateExtraFile = useCallback((id: string, patch: Partial<DataFile>) => {
    setExtraFiles((current) => current.map((file) => (file.id === id ? { ...file, ...patch } : file)));
  }, []);

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

        next.forEach((file, index) => {
          const startDelay = 500 + index * 180;
          processingTimers.current.push(
            window.setTimeout(() => updateExtraFile(file.id, { status: "processing", uploadProgress: 24 }), startDelay),
            window.setTimeout(() => updateExtraFile(file.id, { uploadProgress: 58 }), startDelay + 700),
            window.setTimeout(() => updateExtraFile(file.id, { uploadProgress: 86 }), startDelay + 1_400),
            window.setTimeout(
              () => updateExtraFile(file.id, {
                status: "completed",
                uploadProgress: 100,
                rowCount: file.fileCategory === "tabular" ? Math.max(1, Math.round(file.sizeBytes / 180)) : null,
                columns: file.fileCategory === "tabular" ? ["내용", "접수일", "지역"] : [],
                mapping: file.fileCategory === "tabular"
                  ? { 내용: "content", 접수일: "receivedAt", 지역: "region" }
                  : {},
              }),
              startDelay + 2_200,
            ),
          );
        });

        return next.map((file) => file.id);
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
        return {
          status: review?.status ?? "pending",
          reviewedCategoryId: null,
        };
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
    }),
    [cleaningDecisions, decisionMap, extraFiles, extraMappings, requested, reviewMap, updateExtraFile],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider가 필요합니다.");
  return value;
}
