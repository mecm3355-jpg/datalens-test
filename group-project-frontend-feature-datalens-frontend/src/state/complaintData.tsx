import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  candidates as demoCandidates,
  categories as demoCategories,
  complaints as demoComplaints,
  issues as demoIssues,
  reviews as demoReviews,
  TAXONOMY_VERSION,
} from "../data/mock";
import {
  datalensApi,
  type ApiCandidate,
  type ApiCategory,
  type ApiComplaint,
  type ApiReview,
} from "../api/datalens";
import { AppError } from "../api/AppError";
import type { Candidate, CandidateDecision, Category, Complaint, Issue, ReviewItem, Urgency } from "../types";

const DATA_MODE = import.meta.env.VITE_DATA_MODE === "api" ? "api" : "demo";
const URGENCY_RANK: Record<Urgency, number> = { 낮음: 0, 보통: 1, 높음: 2, 긴급: 3 };

function stableIssueId(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `ISSUE-${(hash >>> 0).toString(36).toUpperCase()}`;
}

function toComplaint(item: ApiComplaint, taxonomyVersion: number): Complaint {
  return {
    id: item.complaintId,
    fileId: item.fileId,
    receivedAt: item.receivedAt ?? `${item.period}-01T00:00:00Z`,
    period: item.period,
    region: item.region,
    contentMasked: item.contentMasked,
    contentType: item.contentType === "title" ? "title" : "body",
    sourceCategory: item.sourceCategory,
    categoryId: item.categoryId,
    group: item.group,
    taxonomyVersion,
    assignStatus: item.assignStatus,
    similarity: item.similarity,
    runnerUpCategoryId: null,
    candidateId: null,
    attributes: item.attributes,
    needsReview: item.needsReview,
    reviewReason: item.reviewReason,
    issueId: null,
    sourceLocator: item.sourceLocator,
    analyzer: "서버 분석",
  };
}

function toCategory(item: ApiCategory, counts: Map<string, number>): Category {
  const count = counts.get(item.categoryId) ?? 0;
  return {
    categoryId: item.categoryId,
    name: item.name,
    group: item.group,
    definition: item.definition,
    keywords: item.keywords,
    count,
    previousCount: count,
    createdInVersion: item.createdInVersion,
  };
}

function toCandidate(item: ApiCandidate): Candidate {
  return {
    id: item.candidateId,
    period: item.period,
    size: item.size,
    keywords: item.keywords,
    suggestedName: item.suggestedName,
    suggestedDefinition: item.suggestedDefinition ?? "",
    suggestedGroup: item.suggestedGroup ?? "미분류",
    decision: item.decision,
    exemplars: item.exemplars,
  };
}

function toReview(item: ApiReview): ReviewItem | null {
  if (!item.complaint) return null;
  return {
    id: item.reviewId,
    complaintId: item.complaint.complaintId,
    reason: item.reason,
    suggestedCategoryId: item.suggestedCategoryId,
    status: item.status,
  };
}

function deriveIssues(complaints: Complaint[]): Issue[] {
  const groups = new Map<string, Complaint[]>();
  for (const complaint of complaints) {
    const place = complaint.attributes.place?.trim();
    if (!complaint.categoryId || !place) continue;
    const key = `${complaint.categoryId}\u0000${place}`;
    groups.set(key, [...(groups.get(key) ?? []), complaint]);
  }
  return [...groups.entries()].flatMap(([key, members]) => {
    if (members.length < 3 && !members.some((item) => item.attributes.repeat === "재신고")) return [];
    const [categoryId, place] = key.split("\u0000");
    const dated = [...members].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const maxUrgency = members.reduce<Urgency>((current, item) => {
      const next = item.attributes.urgency ?? "낮음";
      return URGENCY_RANK[next] > URGENCY_RANK[current] ? next : current;
    }, "낮음");
    return [{
      id: stableIssueId(key),
      categoryId,
      place,
      region: members.find((item) => item.region)?.region ?? "지역 미상",
      complaintCount: members.length,
      firstReceivedAt: dated[0]?.receivedAt ?? "",
      lastReceivedAt: dated.at(-1)?.receivedAt ?? "",
      summary: `${place}에서 같은 유형의 민원 ${members.length}건이 반복되었습니다.`,
      maxUrgency,
      status: "open" as const,
    }];
  });
}

type ComplaintDataValue = {
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  taxonomyVersion: number;
  complaints: Complaint[];
  categories: Category[];
  candidates: Candidate[];
  reviews: ReviewItem[];
  issues: Issue[];
  categoryById: (id: string | null) => Category | undefined;
  decideCandidate: (id: string, decision: CandidateDecision, mergedIntoId?: string) => Promise<void>;
  confirmReview: (id: string, categoryId: string) => Promise<void>;
};

const ComplaintDataContext = createContext<ComplaintDataValue | null>(null);

export function ComplaintDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(DATA_MODE === "api");
  const [error, setError] = useState<string | null>(null);
  const [taxonomyVersion, setTaxonomyVersion] = useState(TAXONOMY_VERSION);
  const [complaints, setComplaints] = useState<Complaint[]>(DATA_MODE === "demo" ? demoComplaints : []);
  const [categories, setCategories] = useState<Category[]>(DATA_MODE === "demo" ? demoCategories : []);
  const [candidates, setCandidates] = useState<Candidate[]>(DATA_MODE === "demo" ? demoCandidates : []);
  const [reviews, setReviews] = useState<ReviewItem[]>(DATA_MODE === "demo" ? demoReviews : []);

  const load = useCallback(async () => {
    if (DATA_MODE !== "api") return;
    setLoading(true);
    try {
      const [complaintResult, taxonomy, candidateItems, reviewItems] = await Promise.all([
        datalensApi.complaints(),
        datalensApi.taxonomy().catch(() => ({ version: 0, items: [] })),
        datalensApi.candidates().catch(() => []),
        datalensApi.reviews().catch(() => []),
      ]);
      const nextComplaints = complaintResult.items.map((item) => toComplaint(item, taxonomy.version));
      const counts = new Map<string, number>();
      nextComplaints.forEach((item) => {
        if (item.categoryId) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
      });
      setTaxonomyVersion(taxonomy.version);
      setComplaints(nextComplaints);
      setCategories(taxonomy.items.map((item) => toCategory(item, counts)));
      setCandidates(candidateItems.map(toCandidate));
      setReviews(reviewItems.flatMap((item) => toReview(item) ?? []));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "민원 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const value = useMemo<ComplaintDataValue>(() => ({
    loading,
    error,
    reload: load,
    taxonomyVersion,
    complaints,
    categories,
    candidates,
    reviews,
    issues: DATA_MODE === "api" ? deriveIssues(complaints) : demoIssues,
    categoryById: (id) => categories.find((category) => category.categoryId === id),
    decideCandidate: async (id, decision, mergedIntoId) => {
      if (DATA_MODE === "api") {
        if (decision === "pending") throw new AppError("INVALID_DECISION", "대기 상태로 되돌릴 수 없습니다.");
        await datalensApi.decideCandidate(id, decision, mergedIntoId);
        await load();
        return;
      }
      setCandidates((current) => current.map((item) => item.id === id ? { ...item, decision } : item));
    },
    confirmReview: async (id, categoryId) => {
      if (DATA_MODE === "api") {
        await datalensApi.confirmReview(id, categoryId);
        await load();
        return;
      }
      setReviews((current) => current.map((item) => item.id === id ? { ...item, status: "done" } : item));
    },
  }), [candidates, categories, complaints, error, load, loading, reviews, taxonomyVersion]);

  return <ComplaintDataContext.Provider value={value}>{children}</ComplaintDataContext.Provider>;
}

export function useComplaintData(): ComplaintDataValue {
  const value = useContext(ComplaintDataContext);
  if (!value) throw new AppError("COMPLAINT_DATA_PROVIDER_MISSING", "ComplaintDataProvider가 필요합니다.");
  return value;
}
