import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  assignmentOf,
  healthOf,
  issuesFrom,
  latestPeriod,
  monthlyTrendOf,
  regionsOf,
  shiftPeriod,
  surgesOf,
  urgencyOf,
  withCategoryCounts,
  type AssignmentSummary,
  type Surge,
} from "../lib/derive";
import { ApiError, assignFileCategory, uploadFile } from "../lib/api";
import { loadServer, sendCandidateDecision, sendReview, startAnalysis, type ServerData } from "../lib/remote";
import type {
  Candidate,
  CandidateDecision,
  Category,
  Complaint,
  DataFile,
  HealthPoint,
  Issue,
  MappingField,
  MonthlyPoint,
  RegionCount,
  ReviewItem,
  UrgencyCount,
} from "../types";

type CategoryGroup = {
  group: string;
  count: number;
  previousCount: number;
  categories: Category[];
};

type CatalogValue = {
  status: "loading" | "ready" | "error";
  error: string | null;
  busy: boolean;
  truncated: boolean;
  files: DataFile[];
  complaints: Complaint[];
  categories: Category[];
  candidates: Candidate[];
  reviews: ReviewItem[];
  issues: Issue[];
  taxonomyVersion: number;
  currentPeriod: string;
  previousTotal: number;
  assignmentSummary: AssignmentSummary;
  monthlyTrend: MonthlyPoint[];
  regions: RegionCount[];
  urgencyCounts: UrgencyCount[];
  healthTrend: HealthPoint[];
  surges: Surge[];
  reload: () => Promise<void>;
  uploadFiles: (list: File[]) => Promise<string[]>;
  decideCandidate: (id: string, decision: Exclude<CandidateDecision, "pending">, mergedIntoId?: string) => Promise<void>;
  confirmReview: (id: string, categoryId: string) => Promise<void>;
  requestAnalysis: (fileId: string, mapping: Partial<Record<string, MappingField>>, splitRule?: string) => Promise<void>;
  // 파일의 민원 전체를 한 카테고리로 확정한다(관리자만, 서버에 저장)
  assignFileCategory: (fileId: string, categoryId: string) => Promise<void>;
  categoryById: (id: string | null | undefined) => Category | undefined;
  complaintById: (id: string) => Complaint | undefined;
  issueById: (id: string) => Issue | undefined;
  complaintsByFile: (fileId: string) => Complaint[];
  complaintsByIssue: (issueId: string) => Complaint[];
  groupedCategories: () => CategoryGroup[];
};

const CatalogContext = createContext<CatalogValue | null>(null);

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "요청을 처리하지 못했습니다.";
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CatalogValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState<ServerData | null>(null);

  const reload = useCallback(async () => {
    const next = await loadServer();
    setServer(next);
    setStatus("ready");
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadServer()
      .then((next) => {
        if (cancelled) return;
        setServer(next);
        setStatus("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(messageOf(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = server?.files.some((file) => file.status === "queued" || file.status === "processing") ?? false;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void reload().catch((reason: unknown) => setError(messageOf(reason)));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [active, reload]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await reload();
      } catch (reason: unknown) {
        setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const value = useMemo<CatalogValue>(() => {
    const complaints = server?.complaints ?? [];
    const period = latestPeriod(complaints);
    const current = complaints.filter((item) => item.period === period);
    const previous = complaints.filter((item) => item.period === shiftPeriod(period, -1));
    const categories = withCategoryCounts(server?.categories ?? [], complaints, period);
    const built = issuesFrom(complaints);
    const categoryById = (id: string | null | undefined) =>
      id ? categories.find((category) => category.categoryId === id) : undefined;

    return {
      status,
      error,
      busy,
      truncated: server?.truncated ?? false,
      files: server?.files ?? [],
      complaints: built.complaints,
      categories,
      candidates: server?.candidates ?? [],
      reviews: server?.reviews ?? [],
      issues: built.issues,
      taxonomyVersion: server?.taxonomyVersion ?? 0,
      currentPeriod: period,
      previousTotal: previous.length,
      assignmentSummary: current.length > 0 ? assignmentOf(current) : assignmentOf(complaints),
      monthlyTrend: monthlyTrendOf(complaints),
      regions: regionsOf(current.length > 0 ? current : complaints),
      urgencyCounts: urgencyOf(current.length > 0 ? current : complaints),
      healthTrend: healthOf(complaints),
      surges: surgesOf(complaints, period),
      reload,
      uploadFiles: (list) => {
        const ids: string[] = [];
        return run(async () => {
          const errors: string[] = [];
          for (const file of list) {
            try {
              const uploaded = await uploadFile(file);
              ids.push(uploaded.fileId);
            } catch (reason: unknown) {
              errors.push(`${file.name}: ${messageOf(reason)}`);
            }
          }
          if (errors.length > 0) throw new Error(errors.join(" "));
        }).then(() => ids);
      },
      decideCandidate: (id, decision, mergedIntoId) =>
        run(async () => {
          const candidate = server?.candidates.find((item) => item.id === id);
          if (!candidate) throw new Error("후보를 찾지 못했습니다.");
          await sendCandidateDecision(candidate, decision, mergedIntoId);
        }),
      confirmReview: (id, categoryId) => run(() => sendReview(id, categoryId)),
      requestAnalysis: (fileId, mapping, splitRule) =>
        run(() => startAnalysis(fileId, mapping, splitRule).then(() => undefined)),
      assignFileCategory: (fileId, categoryId) =>
        run(() => assignFileCategory(fileId, categoryId).then(() => undefined)),
      categoryById,
      complaintById: (id) => built.complaints.find((item) => item.id === id),
      issueById: (id) => built.issues.find((item) => item.id === id),
      complaintsByFile: (fileId) => built.complaints.filter((item) => item.fileId === fileId),
      complaintsByIssue: (issueId) => built.complaints.filter((item) => item.issueId === issueId),
      groupedCategories: () => {
        const map = new Map<string, CategoryGroup>();
        for (const category of categories) {
          const group = map.get(category.group) ?? { group: category.group, count: 0, previousCount: 0, categories: [] };
          group.count += category.count;
          group.previousCount += category.previousCount;
          group.categories.push(category);
          map.set(category.group, group);
        }
        return [...map.values()]
          .map((group) => ({ ...group, categories: [...group.categories].sort((a, b) => b.count - a.count) }))
          .sort((a, b) => b.count - a.count);
      },
    };
  }, [busy, error, reload, run, server, status]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("CatalogProvider가 필요합니다.");
  return value;
}

export function isPriority(item: Complaint): boolean {
  const affected = item.attributes.affected;
  return item.attributes.urgency === "긴급" || affected === "어린이" || affected === "노인" || affected === "장애인";
}
