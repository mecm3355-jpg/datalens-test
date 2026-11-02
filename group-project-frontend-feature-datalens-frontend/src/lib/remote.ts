import type {
  AssignStatus,
  Candidate,
  CandidateDecision,
  Category,
  Complaint,
  DataFile,
  FileCategory,
  FileStatus,
  Job,
  MappingField,
  QualityIssue,
  ReviewItem,
  ReviewReason,
} from "../types";
import { apiRequest, endpoints } from "./api";

const FILE_CATEGORIES: FileCategory[] = ["tabular", "text", "image", "document", "other"];
const FILE_STATUSES: FileStatus[] = ["queued", "processing", "completed", "failed"];
const ASSIGN: AssignStatus[] = ["auto", "ambiguous", "unassigned", "confirmed"];
const DECISIONS: CandidateDecision[] = ["pending", "approved", "held", "merged"];
const REASONS: ReviewReason[] = ["ambiguous", "urgent", "attributeUncertain", "ocrUncertain"];
const URGENCY = ["긴급", "높음", "보통", "낮음"] as const;
const REPEAT = ["최초", "재신고"] as const;
const REQUEST = ["수리·조치", "단속", "신설·개선", "질의", "불만"] as const;
const AFFECTED = ["어린이", "노인", "장애인", "일반"] as const;

type ApiFile = {
  fileId: string;
  originalName: string;
  extension: string;
  category: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  lastJobId: string | null;
};

type ApiFileList = { items: ApiFile[]; total: number };

type ApiAttributes = {
  facility: string | null;
  place: string | null;
  urgency: string | null;
  repeat: string | null;
  requestType: string | null;
  affected: string | null;
};

export type ApiComplaint = {
  complaintId: string;
  fileId: string;
  period: string;
  receivedAt: string | null;
  region: string | null;
  contentMasked: string;
  contentType: string;
  sourceCategory: string | null;
  categoryId: string | null;
  group: string | null;
  assignStatus: string;
  similarity: number | null;
  attributes: ApiAttributes;
  needsReview: boolean;
  reviewReason: string | null;
  sourceLocator: { row?: number; page?: number; block?: number };
};

type ApiComplaintList = { total: number; items: ApiComplaint[] };

type ApiCategory = {
  categoryId: string;
  name: string;
  group: string;
  definition: string;
  keywords: string[];
  status: string;
  createdInVersion: number;
};

type ApiTaxonomy = { version: number; items: ApiCategory[] };

type ApiCandidate = {
  candidateId: string;
  period: string;
  size: number;
  keywords: string[];
  exemplars: string[];
  suggestedName: string;
  suggestedDefinition: string | null;
  suggestedGroup: string | null;
  decision: CandidateDecision;
  mergedIntoCategoryId: string | null;
};

type ApiReview = {
  reviewId: string;
  reason: string;
  status: string;
  suggestedCategoryId: string | null;
  reviewedCategoryId: string | null;
  complaint: ApiComplaint | null;
};

type ApiReviewList = { total: number; items: ApiReview[] };

type ApiJob = {
  jobId: string;
  fileId: string;
  type: string;
  status: string;
  progress: number;
  stage: string;
  error: { code: string; message: string } | null;
};

export type ApiPreview = {
  kind: "table" | "text";
  columns: string[] | null;
  lines: string[] | null;
};

export type ApiMapping = {
  columns: string[];
  mapping: Partial<Record<MappingField, string | null>>;
  notes: string[];
};

export type AnalysisStart = { jobId: string; fileId: string; status: string; message: string };

function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function maybe<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

export function toDataFile(item: ApiFile): DataFile {
  return {
    id: item.fileId,
    originalName: item.originalName,
    extension: item.extension,
    fileCategory: oneOf(item.category, FILE_CATEGORIES, "other"),
    sizeBytes: item.sizeBytes,
    status: oneOf(item.status, FILE_STATUSES, "queued"),
    createdAt: item.createdAt,
    rowCount: null,
    columns: [],
    mapping: {},
    lastJobId: item.lastJobId,
  };
}

export function toComplaint(item: ApiComplaint): Complaint {
  return {
    id: item.complaintId,
    fileId: item.fileId,
    receivedAt: item.receivedAt ?? "",
    period: item.period,
    region: item.region,
    contentMasked: item.contentMasked,
    contentType: item.contentType === "title" ? "title" : "body",
    sourceCategory: item.sourceCategory,
    categoryId: item.categoryId,
    group: item.group,
    taxonomyVersion: 0,
    assignStatus: oneOf(item.assignStatus, ASSIGN, "unassigned"),
    similarity: item.similarity,
    runnerUpCategoryId: null,
    candidateId: null,
    attributes: {
      facility: item.attributes.facility,
      place: item.attributes.place,
      urgency: maybe(item.attributes.urgency, URGENCY),
      repeat: maybe(item.attributes.repeat, REPEAT),
      requestType: maybe(item.attributes.requestType, REQUEST),
      affected: maybe(item.attributes.affected, AFFECTED),
    },
    needsReview: item.needsReview,
    reviewReason: maybe(item.reviewReason, REASONS),
    issueId: null,
    sourceLocator: item.sourceLocator ?? {},
    analyzer: "",
  };
}

export function toCategory(item: ApiCategory): Category {
  return {
    categoryId: item.categoryId,
    name: item.name,
    group: item.group,
    definition: item.definition,
    keywords: item.keywords,
    count: 0,
    previousCount: 0,
    createdInVersion: item.createdInVersion,
  };
}

export function toCandidate(item: ApiCandidate): Candidate {
  return {
    id: item.candidateId,
    period: item.period,
    size: item.size,
    keywords: item.keywords,
    suggestedName: item.suggestedName,
    suggestedDefinition: item.suggestedDefinition ?? "",
    suggestedGroup: item.suggestedGroup ?? "",
    decision: item.decision,
    exemplars: item.exemplars,
    mergedIntoCategoryId: item.mergedIntoCategoryId,
  };
}

export function toReview(item: ApiReview): ReviewItem {
  return {
    id: item.reviewId,
    complaintId: item.complaint?.complaintId ?? "",
    reason: oneOf(item.reason, REASONS, "ambiguous"),
    suggestedCategoryId: item.suggestedCategoryId,
    reviewedCategoryId: item.reviewedCategoryId,
    status: item.status === "done" ? "done" : "pending",
  };
}

export function toJob(item: ApiJob): Job {
  return {
    id: item.jobId,
    fileId: item.fileId,
    type: item.type,
    status: oneOf(item.status, FILE_STATUSES, "queued"),
    progress: item.progress,
    stage: item.stage,
    error: item.error,
  };
}

async function fetchFiles(): Promise<DataFile[]> {
  const size = 100;
  const items: DataFile[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total && page <= 20) {
    const list = await apiRequest<ApiFileList>(`${endpoints.files}?page=${page}&size=${size}`);
    items.push(...list.items.map(toDataFile));
    total = list.total;
    if (list.items.length === 0) break;
    page += 1;
  }
  return items;
}

async function fetchComplaints(): Promise<{ items: ApiComplaint[]; total: number }> {
  const limit = 200;
  const items: ApiComplaint[] = [];
  let skip = 0;
  let total = 0;
  while (skip < total || skip === 0) {
    const list = await apiRequest<ApiComplaintList>(`${endpoints.complaints}?skip=${skip}&limit=${limit}`);
    items.push(...list.items);
    total = list.total;
    if (list.items.length === 0 || items.length >= total || items.length >= 2000) break;
    skip += list.items.length;
  }
  return { items, total };
}

async function fetchCandidates(): Promise<Candidate[]> {
  const lists = await Promise.all(
    DECISIONS.map((decision) =>
      apiRequest<{ items: ApiCandidate[] }>(`${endpoints.candidates}?decision=${decision}`),
    ),
  );
  return lists.flatMap((list) => list.items.map(toCandidate));
}

async function fetchReviews(): Promise<{ reviews: ReviewItem[]; complaints: ApiComplaint[] }> {
  const reviews: ReviewItem[] = [];
  const complaints: ApiComplaint[] = [];
  for (const status of ["pending", "done"] as const) {
    let skip = 0;
    let total = Number.POSITIVE_INFINITY;
    while (skip < total && skip < 1000) {
      const list = await apiRequest<ApiReviewList>(`${endpoints.reviews}?status=${status}&skip=${skip}&limit=200`);
      for (const item of list.items) {
        reviews.push(toReview(item));
        if (item.complaint) complaints.push(item.complaint);
      }
      total = list.total;
      if (list.items.length === 0) break;
      skip += list.items.length;
    }
  }
  return { reviews, complaints };
}

/** 값 하나와 건수(값 없음은 label null). */
export type LabelCount = { label: string | null; count: number };

/** 서버 집계 현황(GET /complaints/stats)에서 대시보드가 쓰는 부분. */
export type ComplaintStats = {
  total: number;
  assignment: { auto: number; ambiguous: number; unassigned: number; confirmed: number };
  // 카테고리 ID별 건수. label null은 아직 카테고리가 없는(미분류) 민원
  categoriesTotal: LabelCount[];
  pendingCandidates: Array<{ candidateId: string; suggestedName: string; suggestedGroup: string | null; size: number }>;
  pendingCandidateCount: number;
  pendingCandidateComplaints: number;
};

export type ServerData = {
  files: DataFile[];
  complaints: Complaint[];
  categories: Category[];
  taxonomyVersion: number;
  candidates: Candidate[];
  reviews: ReviewItem[];
  truncated: boolean;
  // 서버 집계. 불러오지 못하면 null(다른 화면은 계속 쓸 수 있게)
  stats: ComplaintStats | null;
};

export async function loadServer(): Promise<ServerData> {
  const [files, complaintPage, taxonomy, candidates, reviewPack] = await Promise.all([
    fetchFiles(),
    fetchComplaints(),
    apiRequest<ApiTaxonomy>(endpoints.categories),
    fetchCandidates(),
    fetchReviews(),
  ]);
  const stats = await apiRequest<ComplaintStats>(endpoints.complaintStats).catch(() => null);

  const complaintRows = complaintPage.items;
  const seen = new Set(complaintRows.map((item) => item.complaintId));
  const merged = [...complaintRows];
  for (const extra of reviewPack.complaints) {
    if (!seen.has(extra.complaintId)) {
      seen.add(extra.complaintId);
      merged.push(extra);
    }
  }

  return {
    files,
    complaints: merged.map(toComplaint),
    categories: taxonomy.items.filter((item) => item.status === "active").map(toCategory),
    taxonomyVersion: taxonomy.version,
    candidates,
    reviews: reviewPack.reviews,
    truncated: complaintPage.total > complaintRows.length,
    stats,
  };
}

export function loadJob(jobId: string): Promise<Job> {
  return apiRequest<ApiJob>(endpoints.job(jobId)).then(toJob);
}

export function loadQuality(fileId: string): Promise<QualityIssue[]> {
  return apiRequest<{ issues: QualityIssue[] }>(endpoints.quality(fileId)).then((report) => report.issues);
}

export function loadPreview(fileId: string): Promise<ApiPreview> {
  return apiRequest<ApiPreview>(endpoints.preview(fileId));
}

export function loadMapping(fileId: string): Promise<ApiMapping> {
  return apiRequest<ApiMapping>(endpoints.mappingSuggestion(fileId), { method: "POST" });
}

/**
 * 민원 분석을 요청한다. 속성은 규칙 방식으로 뽑는다(민원 본문을 외부 AI로 보내지 않음).
 * @param fileId 파일 ID
 * @param mapping 표 파일의 열 → 공통 필드 매핑
 * @param splitRule 문서·텍스트를 민원별로 나눌 규칙 이름(없으면 파일 전체 1건 또는 빈 줄로 나눔)
 */
export function startAnalysis(
  fileId: string,
  mapping: Partial<Record<string, MappingField>>,
  splitRule?: string,
): Promise<AnalysisStart> {
  const fieldToColumn: Partial<Record<MappingField, string>> = {};
  for (const [column, field] of Object.entries(mapping)) {
    if (!field || field === "ignore") continue;
    fieldToColumn[field] = column;
  }
  return apiRequest<AnalysisStart>(endpoints.analysis(fileId), {
    method: "POST",
    body: JSON.stringify({ type: "complaint", mapping: fieldToColumn, splitRule, attributeMethod: "rule" }),
  });
}

export function sendCandidateDecision(
  candidate: Candidate,
  decision: Exclude<CandidateDecision, "pending">,
  mergedIntoCategoryId?: string,
): Promise<void> {
  return apiRequest(endpoints.candidateDecision(candidate.id), {
    method: "POST",
    body: JSON.stringify({
      decision,
      decidedBy: "로컬 사용자",
      name: decision === "approved" ? candidate.suggestedName : undefined,
      group: decision === "approved" ? candidate.suggestedGroup : undefined,
      definition: decision === "approved" ? candidate.suggestedDefinition : undefined,
      mergedIntoCategoryId: decision === "merged" ? mergedIntoCategoryId : undefined,
    }),
  }).then(() => undefined);
}

export function sendReview(reviewId: string, categoryId: string): Promise<void> {
  return apiRequest(endpoints.review(reviewId), {
    method: "POST",
    body: JSON.stringify({ categoryId, reviewedBy: "로컬 사용자" }),
  }).then(() => undefined);
}
