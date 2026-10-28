import axios, { type AxiosRequestConfig } from "axios";
import { AppError } from "./AppError";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const client = axios.create({ baseURL: BASE_URL, headers: { Accept: "application/json" } });

export const apiRoutes = {
  files: "/api/v1/files",
  file: (fileId: string) => `/api/v1/files/${fileId}`,
  job: (jobId: string) => `/api/v1/jobs/${jobId}`,
  retryJob: (jobId: string) => `/api/v1/jobs/${jobId}/retry`,
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
      const responseMessage = typeof error.response?.data === "string" ? error.response.data : null;
      throw new AppError(status ? `HTTP_${status}` : "NETWORK_ERROR", responseMessage || "서버 요청을 처리하지 못했습니다.", { cause: error });
    }
    throw new AppError("NETWORK_ERROR", "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", { cause: error });
  }
}
