import { apiDownload, apiRequest, apiRoutes } from "./client";
import { AppError } from "./AppError";
import { uploadPresigned as uploadToBlob } from "@vercel/blob/client";
import type { DataReport, FileCategory, FileStatus, MappingField } from "../types";

type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

export type ApiFile = {
  fileId: string;
  originalName: string;
  extension: string;
  mimeType: string;
  category: FileCategory;
  sizeBytes: number;
  status: FileStatus;
  processingCapabilities: {
    preview: boolean;
    qualityCheck: boolean;
    cleaning: boolean;
    statistics: boolean;
    aiSummary: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastJobId: string | null;
};

export type ApiFileUploadResult = {
  fileId: string;
  originalName: string;
  fileType: string;
  status: FileStatus;
  message: string;
};

export type ApiJob = {
  jobId: string;
  fileId: string;
  type: string;
  status: FileStatus;
  progress: number;
  stage: string;
  error: { code: string; message: string } | null;
};

export type ApiCleanRule =
  | { type: "trim_whitespace"; column: string }
  | { type: "remove_duplicates"; columns?: string[] }
  | {
      type: "fill_missing";
      column: string;
      strategy: "mean" | "median" | "mode" | "constant";
      value?: string | number;
    };

export type ApiSuggestion = {
  rule: ApiCleanRule;
  reason: string;
  expectedChanges: number;
};

export type ApiPreview = {
  fileId: string;
  kind: "table" | "text";
  format: string;
  limit: number;
  columns: string[] | null;
  rows: Array<Array<string | number | boolean | null>> | null;
  lines: string[] | null;
  thumbnail: string | null;
};

export type ApiAnalysis = {
  fileId: string;
  jobId: string;
  version: number;
  quality: {
    score: number | null;
    issues: Array<{
      type: string;
      severity: "low" | "medium" | "high";
      count: number;
      location: string | null;
      message: string;
    }>;
    metrics?: Record<string, number>;
    scoreBasis?: string;
  };
  analysis: Record<string, unknown>;
  ai: Record<string, unknown>;
};

export type ApiVersion = {
  resultType: "analysis" | "cleaning" | "report";
  version: number;
  jobId: string;
  createdAt: string;
  score: number | null;
  issueCount: number;
  rowCount: unknown;
  cleaning: {
    rules?: ApiCleanRule[];
    changes?: Array<ApiCleanRule & { affected: number }>;
    before?: { rowCount?: number; score?: number; issueCount?: number };
    after?: { rowCount?: number; score?: number; issueCount?: number };
  } | null;
  ai: Record<string, unknown> | null;
};

export type ApiFieldMapping = {
  sourceId?: string | null;
  title?: string | null;
  content?: string | null;
  receivedAt?: string | null;
  region?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  agency?: string | null;
  sourceCategory?: string | null;
  result?: string | null;
};

export type ApiMappingSuggestion = {
  fileId: string;
  method: "ai" | "rule";
  columns: string[];
  mapping: ApiFieldMapping;
  constants: { region: string | null; agency: string | null; sourceCategory: string | null };
  notes: string[];
};

export type ComplaintAnalysisOptions = {
  mapping?: Partial<Record<string, MappingField>>;
  splitRule?: string | null;
  attributeMethod?: "auto" | "rule" | "llm";
};

export type ApiDashboardSummary = {
  files: {
    total: number;
    totalSizeBytes: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
  jobs: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  quality: {
    analyzedFileCount: number;
    scoredFileCount: number;
    outdatedScoreFileCount: number;
    averageScore: number | null;
    issuesByType: Record<string, number>;
    issuesBySeverity: Record<string, number>;
  };
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
  assignStatus: "auto" | "ambiguous" | "unassigned" | "confirmed";
  similarity: number | null;
  attributes: {
    facility: string | null;
    place: string | null;
    urgency: "긴급" | "높음" | "보통" | "낮음" | null;
    repeat: "최초" | "재신고" | null;
    requestType: "수리·조치" | "단속" | "신설·개선" | "질의" | "불만" | null;
    affected: "어린이" | "노인" | "장애인" | "일반" | null;
  };
  needsReview: boolean;
  reviewReason: "ambiguous" | "urgent" | "attributeUncertain" | null;
  sourceLocator: { row?: number; page?: number; block?: number };
};

export type ApiCategory = {
  categoryId: string;
  version: number;
  name: string;
  group: string;
  definition: string;
  keywords: string[];
  createdInVersion: number;
};

export type ApiCandidate = {
  candidateId: string;
  period: string;
  size: number;
  keywords: string[];
  exemplars: string[];
  suggestedName: string;
  suggestedDefinition: string | null;
  suggestedGroup: string | null;
  decision: "pending" | "approved" | "held" | "merged";
  categoryId: string | null;
  mergedIntoCategoryId: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
};

export type ApiReview = {
  reviewId: string;
  reason: "ambiguous" | "urgent" | "attributeUncertain";
  status: "pending" | "done";
  suggestedCategoryId: string | null;
  reviewedCategoryId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  complaint: ApiComplaint | null;
};

export type ApiComplaintStats = {
  currentPeriod: string | null;
  previousPeriod: string | null;
  categories: Array<{ categoryId: string; currentCount: number; previousCount: number }>;
};

export type ApiComplaintInsight = {
  type: "growth" | "urgent" | "repeat";
  title: string;
  description: string;
  count: number;
};

export type ApiCategoryChange = {
  changeId: string;
  changeType: "merge" | "split";
  fromCategoryId: string;
  fromName: string;
  toCategoryIds: string[];
  toNames: string[];
  fromVersion: number;
  toVersion: number;
  reason: string | null;
  changedBy: string;
  affectedCount: number;
  createdAt: string;
};

const FIELD_TO_API: Record<Exclude<MappingField, "ignore">, keyof ApiFieldMapping> = {
  sourceId: "sourceId",
  title: "title",
  content: "content",
  receivedAt: "receivedAt",
  region: "region",
  address: "address",
  latitude: "latitude",
  longitude: "longitude",
  agency: "agency",
  sourceCategory: "sourceCategory",
  result: "result",
};

function toApiMapping(mapping: Partial<Record<string, MappingField>> = {}): ApiFieldMapping {
  const result: ApiFieldMapping = {};
  for (const [column, field] of Object.entries(mapping)) {
    if (!field || field === "ignore") continue;
    result[FIELD_TO_API[field]] = column;
  }
  return result;
}

export function fromApiMapping(mapping: ApiFieldMapping): Partial<Record<string, MappingField>> {
  const result: Partial<Record<string, MappingField>> = {};
  for (const [field, column] of Object.entries(mapping)) {
    if (!column) continue;
    const mapped = Object.entries(FIELD_TO_API).find(([, apiField]) => apiField === field)?.[0];
    if (mapped) result[column] = mapped as MappingField;
  }
  return result;
}

function reportFromVersion(version: ApiVersion | undefined): DataReport | null {
  const value = version?.ai?.report;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const report = value as Record<string, unknown>;
  if (typeof report.summary !== "string") return null;
  return {
    summary: report.summary,
    keyFindings: Array.isArray(report.keyFindings)
      ? report.keyFindings.filter((item): item is string => typeof item === "string")
      : [],
    qualityIssues: Array.isArray(report.qualityIssues)
      ? report.qualityIssues as DataReport["qualityIssues"]
      : [],
    cleaningRecommendations: Array.isArray(report.cleaningRecommendations)
      ? report.cleaningRecommendations as DataReport["cleaningRecommendations"]
      : [],
    analysisSuggestions: Array.isArray(report.analysisSuggestions)
      ? report.analysisSuggestions.filter((item): item is string => typeof item === "string")
      : [],
    caveats: Array.isArray(report.caveats)
      ? report.caveats.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "user";
};

type AuthSession = {
  authenticated: boolean;
  user: AuthUser | null;
};

/** 공통 성공 응답에서 data를 꺼내고 비정상 응답은 AppError로 통일합니다. */
function unwrap<T>(response: ApiResponse<T>): T {
  if (response.success && response.data !== null) return response.data;
  throw new AppError(
    response.error?.code ?? "INVALID_API_RESPONSE",
    response.error?.message ?? "서버 응답 형식이 올바르지 않습니다.",
  );
}

export const datalensApi = {
  async session(): Promise<AuthSession> {
    return unwrap(await apiRequest<ApiResponse<AuthSession>>(apiRoutes.authSession));
  },
  async signup(email: string, displayName: string, password: string): Promise<AuthUser> {
    const session = unwrap(await apiRequest<ApiResponse<AuthSession>>(apiRoutes.authSignup, {
      method: "POST",
      data: { email, displayName, password },
    }));
    if (!session.user) throw new AppError("INVALID_API_RESPONSE", "가입 사용자 정보가 없습니다.");
    return session.user;
  },
  async login(email: string, password: string): Promise<AuthUser> {
    const session = unwrap(await apiRequest<ApiResponse<AuthSession>>(apiRoutes.authLogin, {
      method: "POST",
      data: { email, password },
    }));
    if (!session.user) throw new AppError("INVALID_API_RESPONSE", "로그인 사용자 정보가 없습니다.");
    return session.user;
  },
  async logout(): Promise<void> {
    await apiRequest<ApiResponse<AuthSession>>(apiRoutes.authLogout, {
      method: "POST",
    });
  },
  async requestPasswordReset(email: string): Promise<string | null> {
    const result = unwrap(await apiRequest<ApiResponse<{ message: string; resetToken: string | null }>>(
      apiRoutes.authPasswordResetRequest,
      { method: "POST", data: { email } },
    ));
    return result.resetToken;
  },
  async resetPassword(token: string, password: string): Promise<void> {
    await apiRequest<ApiResponse<{ message: string }>>(apiRoutes.authPasswordResetConfirm, {
      method: "POST",
      data: { token, password },
    });
  },
  async dashboard(): Promise<ApiDashboardSummary> {
    return unwrap(await apiRequest<ApiResponse<ApiDashboardSummary>>(apiRoutes.dashboard));
  },
  async listFiles(): Promise<ApiFile[]> {
    const first = unwrap(await apiRequest<ApiResponse<{
      items: ApiFile[];
      total: number;
      page: number;
      size: number;
    }>>(`${apiRoutes.files}?page=1&size=100`));
    const items = [...first.items];
    for (let page = 2; items.length < first.total; page += 1) {
      const next = unwrap(await apiRequest<ApiResponse<{
        items: ApiFile[];
        total: number;
        page: number;
        size: number;
      }>>(`${apiRoutes.files}?page=${page}&size=100`));
      items.push(...next.items);
      if (next.items.length === 0) break;
    }
    return items;
  },
  async getFile(fileId: string): Promise<ApiFile> {
    return unwrap(await apiRequest<ApiResponse<ApiFile>>(apiRoutes.file(fileId)));
  },
  async upload(file: File): Promise<ApiFileUploadResult> {
    if (import.meta.env.VITE_UPLOAD_MODE === "blob") {
      // Blob presigned tokens compare the storage pathname byte-for-byte. Keeping
      // non-ASCII characters here can produce a differently encoded token scope,
      // so only the internal storage key is normalized to ASCII. The original
      // filename is still sent separately to the backend and shown in the UI.
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "upload";
      const blob = await uploadToBlob(`incoming/${crypto.randomUUID()}-${safeName}`, file, {
        access: "private",
        handleUploadUrl: "/api/blob-upload",
        multipart: file.size > 5 * 1024 * 1024,
      });
      return unwrap(
        await apiRequest<ApiResponse<ApiFileUploadResult>>(apiRoutes.filesFromBlob, {
          method: "POST",
          data: { pathname: blob.pathname, originalName: file.name },
        }),
      );
    }
    const form = new FormData();
    form.append("file", file);
    return unwrap(
      await apiRequest<ApiResponse<ApiFileUploadResult>>(apiRoutes.files, {
        method: "POST",
        data: form,
      }),
    );
  },
  async process(fileId: string): Promise<{ jobId: string }> {
    return unwrap(
      await apiRequest<ApiResponse<{ jobId: string }>>(apiRoutes.processFile(fileId), {
        method: "POST",
      }),
    );
  },
  async job(jobId: string): Promise<ApiJob> {
    return unwrap(await apiRequest<ApiResponse<ApiJob>>(apiRoutes.job(jobId)));
  },
  async preview(fileId: string): Promise<ApiPreview> {
    return unwrap(await apiRequest<ApiResponse<ApiPreview>>(apiRoutes.preview(fileId)));
  },
  async cleanedPreview(fileId: string, version?: number): Promise<ApiPreview> {
    return unwrap(
      await apiRequest<ApiResponse<ApiPreview>>(apiRoutes.cleanedPreview(fileId, version)),
    );
  },
  async analysis(fileId: string): Promise<ApiAnalysis> {
    return unwrap(await apiRequest<ApiResponse<ApiAnalysis>>(apiRoutes.analysis(fileId)));
  },
  async startComplaintAnalysis(
    fileId: string,
    options: ComplaintAnalysisOptions = {},
  ): Promise<{ jobId: string }> {
    return unwrap(await apiRequest<ApiResponse<{ jobId: string }>>(apiRoutes.analysis(fileId), {
      method: "POST",
      data: {
        type: "complaint",
        mapping: toApiMapping(options.mapping),
        splitRule: options.splitRule || undefined,
        attributeMethod: options.attributeMethod ?? "auto",
      },
    }));
  },
  async mappingSuggestion(fileId: string): Promise<ApiMappingSuggestion> {
    return unwrap(await apiRequest<ApiResponse<ApiMappingSuggestion>>(
      apiRoutes.mappingSuggestion(fileId),
      { method: "POST" },
    ));
  },
  async suggestions(fileId: string): Promise<ApiSuggestion[]> {
    const response = await apiRequest<ApiResponse<{ suggestions: ApiSuggestion[] }>>(
      apiRoutes.cleaningSuggestions(fileId),
      { method: "POST" },
    );
    return unwrap(response).suggestions;
  },
  async clean(fileId: string, rules: ApiCleanRule[]): Promise<{ jobId: string }> {
    return unwrap(
      await apiRequest<ApiResponse<{ jobId: string }>>(apiRoutes.clean(fileId), {
        method: "POST",
        data: { rules },
      }),
    );
  },
  async versions(fileId: string): Promise<ApiVersion[]> {
    const response = await apiRequest<ApiResponse<{ items: ApiVersion[] }>>(
      apiRoutes.versions(fileId),
    );
    return unwrap(response).items;
  },
  async latestReport(fileId: string): Promise<DataReport | null> {
    const response = await apiRequest<ApiResponse<{ items: ApiVersion[] }>>(
      `${apiRoutes.versions(fileId)}?type=report`,
    );
    return reportFromVersion(unwrap(response).items[0]);
  },
  async createReport(fileId: string): Promise<{ jobId: string }> {
    return unwrap(await apiRequest<ApiResponse<{ jobId: string }>>(apiRoutes.report(fileId), {
      method: "POST",
    }));
  },
  export(fileId: string, format: "csv" | "json"): Promise<Blob> {
    return apiDownload(apiRoutes.export(fileId, format));
  },
  async deleteFile(fileId: string): Promise<void> {
    await apiRequest<ApiResponse<{ fileId: string }>>(apiRoutes.deleteFile(fileId), {
      method: "DELETE",
    });
  },
  async complaints(): Promise<{ items: ApiComplaint[]; total: number }> {
    const first = unwrap(
      await apiRequest<ApiResponse<{ items: ApiComplaint[]; total: number }>>(
        `${apiRoutes.complaints}?limit=200`,
      ),
    );
    const items = [...first.items];
    while (items.length < first.total) {
      const next = unwrap(
        await apiRequest<ApiResponse<{ items: ApiComplaint[]; total: number }>>(
          `${apiRoutes.complaints}?skip=${items.length}&limit=200`,
        ),
      );
      if (next.items.length === 0) break;
      items.push(...next.items);
    }
    return { items, total: first.total };
  },
  async taxonomy(): Promise<{ version: number; items: ApiCategory[] }> {
    return unwrap(
      await apiRequest<ApiResponse<{ version: number; items: ApiCategory[] }>>(apiRoutes.taxonomy),
    );
  },
  async complaintStats(): Promise<ApiComplaintStats> {
    return unwrap(await apiRequest<ApiResponse<ApiComplaintStats>>(apiRoutes.complaintStats));
  },
  async complaintInsights(): Promise<ApiComplaintInsight[]> {
    const response = await apiRequest<ApiResponse<{ items: ApiComplaintInsight[] }>>(
      apiRoutes.complaintInsights,
    );
    return unwrap(response).items;
  },
  async categoryChanges(): Promise<ApiCategoryChange[]> {
    const response = await apiRequest<ApiResponse<{ items: ApiCategoryChange[] }>>(
      apiRoutes.categoryChanges,
    );
    return unwrap(response).items;
  },
  async mergeCategories(sourceCategoryId: string, targetCategoryId: string, reason: string): Promise<void> {
    await apiRequest(apiRoutes.categoryMerge, {
      method: "POST",
      data: { sourceCategoryId, targetCategoryId, reason: reason || null },
    });
  },
  async splitCategory(input: {
    sourceCategoryId: string;
    name: string;
    group?: string;
    definition?: string;
    complaintIds: string[];
    reason: string;
  }): Promise<void> {
    await apiRequest(apiRoutes.categorySplit, {
      method: "POST",
      data: { ...input, reason: input.reason || null },
    });
  },
  async candidates(): Promise<ApiCandidate[]> {
    const decisions = ["pending", "approved", "held", "merged"] as const;
    const groups = await Promise.all(decisions.map(async (decision) => {
      const response = await apiRequest<ApiResponse<{ items: ApiCandidate[] }>>(
        `${apiRoutes.candidates}?decision=${decision}`,
      );
      return unwrap(response).items;
    }));
    return groups.flat();
  },
  async decideCandidate(
    candidateId: string,
    decision: "approved" | "held" | "merged",
    mergedIntoCategoryId?: string,
  ): Promise<void> {
    await apiRequest(apiRoutes.candidateDecision(candidateId), {
      method: "POST",
      data: {
        decision,
        mergedIntoCategoryId: mergedIntoCategoryId || undefined,
      },
    });
  },
  async reviews(): Promise<ApiReview[]> {
    const statuses = ["pending", "done"] as const;
    const groups = await Promise.all(statuses.map(async (status) => {
      const first = unwrap(await apiRequest<ApiResponse<{ items: ApiReview[]; total: number }>>(
        `${apiRoutes.reviews}?status=${status}&limit=200`,
      ));
      const items = [...first.items];
      while (items.length < first.total) {
        const next = unwrap(await apiRequest<ApiResponse<{ items: ApiReview[]; total: number }>>(
          `${apiRoutes.reviews}?status=${status}&skip=${items.length}&limit=200`,
        ));
        if (next.items.length === 0) break;
        items.push(...next.items);
      }
      return items;
    }));
    return groups.flat();
  },
  async confirmReview(reviewId: string, categoryId: string): Promise<void> {
    await apiRequest(apiRoutes.review(reviewId), {
      method: "POST",
      data: { categoryId: categoryId || null },
    });
  },
};
