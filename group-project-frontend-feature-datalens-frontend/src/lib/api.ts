const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type ErrorBody = {
  code?: string;
  message?: string;
};

type Envelope<T> = {
  success?: boolean;
  data?: T | null;
  error?: ErrorBody | null;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const endpoints = {
  files: "/api/v1/files",
  file: (fileId: string) => `/api/v1/files/${fileId}`,
  preview: (fileId: string) => `/api/v1/files/${fileId}/preview`,
  quality: (fileId: string) => `/api/v1/files/${fileId}/quality`,
  analysis: (fileId: string) => `/api/v1/files/${fileId}/analysis`,
  mappingSuggestion: (fileId: string) => `/api/v1/files/${fileId}/mapping-suggestion`,
  job: (jobId: string) => `/api/v1/jobs/${jobId}`,
  complaints: "/api/v1/complaints",
  categories: "/api/v1/complaints/categories",
  candidates: "/api/v1/complaints/categories/candidates",
  candidateDecision: (candidateId: string) =>
    `/api/v1/complaints/categories/candidates/${candidateId}/decision`,
  reviews: "/api/v1/complaints/reviews",
  review: (reviewId: string) => `/api/v1/complaints/reviews/${reviewId}`,
  fileCategory: (fileId: string) => `/api/v1/files/${fileId}/category`,
  filesFromBlob: "/api/v1/files/from-blob",
  blobUpload: "/api/blob-upload",
  authSession: "/api/v1/auth/session",
  authSignup: "/api/v1/auth/signup",
  authLogin: "/api/v1/auth/login",
  authLogout: "/api/v1/auth/logout",
} as const;

function errorMessage(payload: Envelope<unknown> | null, status: number): string {
  if (payload?.error?.message) return payload.error.message;
  return `요청 실패 (${status})`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    // 로그인 세션은 쿠키로 유지된다. 백엔드를 다른 주소에 띄워도 쿠키가 같이 가게 한다
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", 0, "NETWORK");
  }

  const text = await response.text();
  let payload: Envelope<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new ApiError(text || `요청 실패 (${response.status})`, response.status);
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(errorMessage(payload, response.status), response.status, payload?.error?.code ?? "REQUEST_FAILED");
  }

  if (payload && "data" in payload) return payload.data as T;
  return payload as T;
}

type UploadResult = { fileId: string; status: string; message: string };

/**
 * 파일을 올린다. 배포(VITE_UPLOAD_MODE=blob)에서는 서버 요청 크기 제한(약 4.5MB)을 피하려고
 * Vercel Blob에 먼저 올리고, 백엔드에는 저장 위치만 알린다.
 * @param file 올릴 파일
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  if (import.meta.env.VITE_UPLOAD_MODE === "blob") {
    // Blob 토큰은 저장 경로를 바이트 그대로 비교하므로 한글 등은 저장 키에서만 ASCII로 바꾼다.
    // 원래 파일명은 originalName으로 따로 보낸다
    const { uploadPresigned } = await import("@vercel/blob/client");
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "upload";
    const blob = await uploadPresigned(`incoming/${crypto.randomUUID()}-${safeName}`, file, {
      access: "private",
      handleUploadUrl: endpoints.blobUpload,
      multipart: file.size > 5 * 1024 * 1024,
    });
    return apiRequest(endpoints.filesFromBlob, {
      method: "POST",
      body: JSON.stringify({ pathname: blob.pathname, originalName: file.name }),
    });
  }
  const body = new FormData();
  body.append("file", file);
  return apiRequest(endpoints.files, { method: "POST", body });
}

/** 서버 로그인 사용자. role이 admin이어야 후보 승인·검토·파일 카테고리 확정을 할 수 있다. */
export type AuthUser = { id: string; email: string; displayName: string; role: "admin" | "user" };

type AuthSession = { authenticated: boolean; user: AuthUser | null };

/** 현재 로그인 세션을 읽는다. 로그인하지 않았으면 null. */
export async function loadSession(): Promise<AuthUser | null> {
  const session = await apiRequest<AuthSession>(endpoints.authSession);
  return session.authenticated ? session.user : null;
}

/**
 * 이메일·비밀번호로 로그인한다.
 * @param email 가입한 이메일
 * @param password 비밀번호
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  const session = await apiRequest<AuthSession>(endpoints.authLogin, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!session.user) throw new ApiError("로그인 사용자 정보가 없습니다.", 500, "INVALID_API_RESPONSE");
  return session.user;
}

/**
 * 회원가입하고 바로 로그인한다. 첫 가입자는 관리자가 된다.
 * @param email 이메일
 * @param displayName 화면에 보일 이름
 * @param password 비밀번호
 */
export async function signup(email: string, displayName: string, password: string): Promise<AuthUser> {
  const session = await apiRequest<AuthSession>(endpoints.authSignup, {
    method: "POST",
    body: JSON.stringify({ email, displayName, password }),
  });
  if (!session.user) throw new ApiError("가입 사용자 정보가 없습니다.", 500, "INVALID_API_RESPONSE");
  return session.user;
}

/** 로그아웃한다. */
export async function logout(): Promise<void> {
  await apiRequest(endpoints.authLogout, { method: "POST" });
}

/**
 * 파일과 관련 결과(진단·분석·민원·검토·작업·원본)를 삭제한다. 되돌릴 수 없다.
 * @param fileId 파일 ID
 */
export async function deleteFile(fileId: string): Promise<void> {
  await apiRequest(endpoints.file(fileId), { method: "DELETE" });
}

/**
 * 파일의 민원 전체를 한 카테고리로 확정한다(관리자만).
 * @param fileId 파일 ID
 * @param categoryId 확정할 카테고리 ID
 */
export function assignFileCategory(fileId: string, categoryId: string): Promise<{ updatedCount: number }> {
  return apiRequest(endpoints.fileCategory(fileId), {
    method: "POST",
    body: JSON.stringify({ categoryId }),
  });
}
