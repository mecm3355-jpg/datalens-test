const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const endpoints = {
  files: "/api/v1/files",
  file: (fileId: string) => `/api/v1/files/${fileId}`,
  preview: (fileId: string) => `/api/v1/files/${fileId}/preview`,
  process: (fileId: string) => `/api/v1/files/${fileId}/process`,
  quality: (fileId: string) => `/api/v1/files/${fileId}/quality`,
  analysis: (fileId: string) => `/api/v1/files/${fileId}/analysis`,
  job: (jobId: string) => `/api/v1/jobs/${jobId}`,
  retryJob: (jobId: string) => `/api/v1/jobs/${jobId}/retry`,
  dashboardSummary: "/api/v1/dashboard/summary",
  exportFile: (fileId: string, format: string) => `/api/v1/files/${fileId}/export?format=${format}`,
  complaints: "/api/v1/complaints",
  categories: "/api/v1/complaints/categories",
  candidates: "/api/v1/complaints/categories/candidates",
  candidateDecision: (candidateId: string) =>
    `/api/v1/complaints/categories/candidates/${candidateId}/decision`,
  mergeCategories: "/api/v1/complaints/categories/merge",
  splitCategories: "/api/v1/complaints/categories/split",
  reviews: "/api/v1/complaints/reviews",
  review: (reviewId: string) => `/api/v1/complaints/reviews/${reviewId}`,
  statsSummary: "/api/v1/complaints/stats/summary",
  statsInsights: "/api/v1/complaints/stats/insights",
} as const;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error((await response.text()) || `요청 실패 (${response.status})`);
  }
  return response.json() as Promise<T>;
}
