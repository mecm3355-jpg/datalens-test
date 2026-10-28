import axios, { type AxiosRequestConfig } from "axios";
import { AppError } from "./AppError";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const client = axios.create({ baseURL: BASE_URL, headers: { Accept: "application/json" } });

export const apiRoutes = {
  dashboard: "/api/v1/dashboard/summary",
  files: "/api/v1/files",
  filesFromBlob: "/api/v1/files/from-blob",
  file: (fileId: string) => `/api/v1/files/${fileId}`,
  job: (jobId: string) => `/api/v1/jobs/${jobId}`,
  processFile: (fileId: string) => `/api/v1/files/${fileId}/process`,
  preview: (fileId: string) => `/api/v1/files/${fileId}/preview`,
  quality: (fileId: string) => `/api/v1/files/${fileId}/quality`,
  analysis: (fileId: string) => `/api/v1/files/${fileId}/analysis`,
  cleaningSuggestions: (fileId: string) => `/api/v1/files/${fileId}/cleaning-suggestions`,
  clean: (fileId: string) => `/api/v1/files/${fileId}/clean`,
  versions: (fileId: string) => `/api/v1/files/${fileId}/versions`,
  export: (fileId: string, format: "csv" | "json") =>
    `/api/v1/files/${fileId}/export?format=${format}`,
} as const;

/** API 경로와 fetch 옵션을 받아 JSON 응답을 반환하고 실패를 AppError로 변환합니다. */
export async function apiRequest<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<T>({ ...config, url: path });
    return response.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const payload = error.response?.data as
        | { error?: { code?: string; message?: string } }
        | string
        | undefined;
      const responseMessage = typeof payload === "string" ? payload : payload?.error?.message;
      const responseCode = typeof payload === "object" ? payload?.error?.code : undefined;
      throw new AppError(
        responseCode ?? (status ? `HTTP_${status}` : "NETWORK_ERROR"),
        responseMessage || "서버 요청을 처리하지 못했습니다.",
        { cause: error },
      );
    }
    throw new AppError("NETWORK_ERROR", "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", { cause: error });
  }
}

/** 파일 응답을 Blob으로 내려받습니다. */
export async function apiDownload(path: string): Promise<Blob> {
  try {
    const response = await client.get<Blob>(path, { responseType: "blob" });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AppError(
        error.response?.status ? `HTTP_${error.response.status}` : "NETWORK_ERROR",
        "정제 결과를 다운로드하지 못했습니다.",
        { cause: error },
      );
    }
    throw error;
  }
}
