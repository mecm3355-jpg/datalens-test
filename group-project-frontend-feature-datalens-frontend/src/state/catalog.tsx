import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { ApiError, assignFileCategory, deleteFile, uploadFile } from "../lib/api";
import { loadServer, sendCandidateDecision, sendReview, startAnalysis, type ServerData } from "../lib/remote";
import type { StageNotice } from "../lib/stages";
import { useNotices } from "./notices";
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
  // 파일과 관련 결과를 삭제한다. 성공하면 true, 실패하면 오류를 화면에 띄우고 false
  deleteFile: (fileId: string) => Promise<boolean>;
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

// 처리가 끝난 뒤에도 새로고침을 이어 가는 시간(자동 민원 분석이 등록되기를 기다림)
const GRACE_POLL_MS = 20_000;

/**
 * 후보 결정 뒤 띄울 안내.
 * @param name 후보 제안 이름
 * @param size 후보에 묶인 민원 수
 * @param decision 결정(approved, held, merged)
 */
function decisionNotice(name: string, size: number, decision: CandidateDecision): StageNotice {
  if (decision === "approved") {
    return {
      tone: "success",
      title: "후보 승인 · 카테고리 생성",
      message: `'${name}' 카테고리를 만들었습니다. 묶여 있던 민원 ${size}건이 이 카테고리로 배정되고, 다음 파일부터는 비슷한 민원이 자동으로 배정됩니다.`,
      link: { to: "/categories", label: "카테고리 보기" },
    };
  }
  if (decision === "merged") {
    return {
      tone: "success",
      title: "기존 카테고리에 합침",
      message: `'${name}' 후보의 민원 ${size}건을 고른 카테고리에 합쳤습니다.`,
    };
  }
  return {
    tone: "info",
    title: "후보 보류",
    message: `'${name}' 후보를 보류했습니다. 민원은 미분류로 남고 다음 분석 때 다시 후보로 나올 수 있습니다.`,
  };
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
  // 진단이 끝난 직후에는 서버가 민원 분석을 이어서 등록하기 전이라 잠깐 처리 중인 파일이 없다.
  // 그때 새로고침을 멈추면 자동 분석이 화면에 안 보이므로, 처리가 끝난 뒤에도 잠시 더 확인한다
  const [grace, setGrace] = useState(false);
  const wasActive = useRef(false);
  useEffect(() => {
    const ended = wasActive.current && !active;
    wasActive.current = active;
    if (!ended) return;
    setGrace(true);
    const timer = window.setTimeout(() => setGrace(false), GRACE_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [active]);
  const polling = active || grace;
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      void reload().catch((reason: unknown) => setError(messageOf(reason)));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [polling, reload]);

  const { notify } = useNotices();
  // 사람이 한 일을 실행하고 다시 불러온다. 성공하면 true(완료 안내를 띄울지 정하는 데 쓴다)
  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await reload();
        return true;
      } catch (reason: unknown) {
        setError(messageOf(reason));
        return false;
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
      decideCandidate: async (id, decision, mergedIntoId) => {
        const candidate = server?.candidates.find((item) => item.id === id);
        const ok = await run(async () => {
          if (!candidate) throw new Error("후보를 찾지 못했습니다.");
          await sendCandidateDecision(candidate, decision, mergedIntoId);
        });
        if (ok && candidate) notify(decisionNotice(candidate.suggestedName, candidate.size, decision));
      },
      confirmReview: async (id, categoryId) => {
        const ok = await run(() => sendReview(id, categoryId));
        if (ok) {
          notify({
            tone: "success",
            title: "검토 확정",
            message: `민원을 '${categoryById(categoryId)?.name ?? categoryId}' 카테고리로 확정했습니다. 사람 확정 건수에 반영됩니다.`,
          });
        }
      },
      requestAnalysis: (fileId, mapping, splitRule) =>
        run(() => startAnalysis(fileId, mapping, splitRule).then(() => undefined)).then(() => undefined),
      deleteFile: async (fileId) => {
        // 삭제 뒤 화면을 옮길지 정해야 하므로 run과 달리 성공 여부를 돌려준다
        setBusy(true);
        setError(null);
        try {
          const name = server?.files.find((file) => file.id === fileId)?.originalName ?? "파일";
          await deleteFile(fileId);
          await reload();
          notify({
            tone: "success",
            title: "파일 삭제",
            message: `'${name}'과(와) 이 파일에서 나온 민원·분석 결과·검토 기록을 삭제했습니다.`,
          });
          return true;
        } catch (reason: unknown) {
          setError(messageOf(reason));
          return false;
        } finally {
          setBusy(false);
        }
      },
      assignFileCategory: async (fileId, categoryId) => {
        let updated = 0;
        const ok = await run(async () => {
          updated = (await assignFileCategory(fileId, categoryId)).updatedCount;
        });
        if (ok) {
          notify({
            tone: "success",
            title: "파일 카테고리 확정",
            message: `이 파일의 민원 ${updated}건을 '${categoryById(categoryId)?.name ?? categoryId}' 카테고리로 확정했습니다.`,
            link: { to: "/complaints", label: "민원 보기" },
          });
        }
      },
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
  }, [busy, error, notify, reload, run, server, status]);

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
