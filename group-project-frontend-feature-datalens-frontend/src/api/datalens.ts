import { apiDownload, apiRequest, apiRoutes } from "./client";
import { AppError } from "./AppError";
import { uploadPresigned as uploadToBlob } from "@vercel/blob/client";
import type { FileCategory, FileStatus } from "../types";

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
};

export type ApiReview = {
  reviewId: string;
  reason: "ambiguous" | "urgent" | "attributeUncertain";
  status: "pending" | "done";
  suggestedCategoryId: string | null;
  reviewedCategoryId: string | null;
  complaint: ApiComplaint | null;
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
  async session(): Promise<boolean> {
    const response = await apiRequest<ApiResponse<{ authenticated: boolean }>>(apiRoutes.authSession);
    return unwrap(response).authenticated;
  },
  async login(password: string): Promise<void> {
    await apiRequest<ApiResponse<{ authenticated: boolean }>>(apiRoutes.authLogin, {
      method: "POST",
      data: { password },
    });
  },
  async logout(): Promise<void> {
    await apiRequest<ApiResponse<{ authenticated: boolean }>>(apiRoutes.authLogout, {
      method: "POST",
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
  async upload(file: File): Promise<{ fileId: string }> {
    if (import.meta.env.VITE_UPLOAD_MODE === "blob") {
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(-120) || "upload";
      const blob = await uploadToBlob(`incoming/${crypto.randomUUID()}-${safeName}`, file, {
        access: "private",
        handleUploadUrl: "/api/blob-upload",
        multipart: file.size > 5 * 1024 * 1024,
      });
      return unwrap(
        await apiRequest<ApiResponse<{ fileId: string }>>(apiRoutes.filesFromBlob, {
          method: "POST",
          data: { pathname: blob.pathname, originalName: file.name },
        }),
      );
    }
    const form = new FormData();
    form.append("file", file);
    return unwrap(
      await apiRequest<ApiResponse<{ fileId: string }>>(apiRoutes.files, {
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
        decidedBy: "DataLens 운영자",
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
      data: { categoryId: categoryId || null, reviewedBy: "DataLens 운영자" },
    });
  },
};
