import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const INCOMING_PATH = /^incoming\/[0-9a-f-]{36}-[^/]{1,120}$/iu;

async function authenticated(request: Request): Promise<boolean> {
  if (process.env.AUTH_REQUIRED !== "true") return true;
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie) return false;

  // MongoDB에 저장된 불투명 세션은 백엔드만 검증한다. Blob 서비스가
  // 비밀키나 세션 저장소 구현을 중복 소유하지 않도록 같은 배포의 세션 API에 위임한다.
  const sessionUrl = new URL("/api/v1/auth/session", request.url);
  const response = await fetch(sessionUrl, {
    method: "GET",
    headers: { accept: "application/json", cookie },
    redirect: "manual",
  });

  if (response.status === 401) return false;
  if (!response.ok) {
    throw new Error("로그인 세션을 확인할 수 없습니다.");
  }
  return true;
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    if (body.type === "blob.generate-presigned-url" && !(await authenticated(request))) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const result = await handleUploadPresigned({
      request,
      body,
      getSignedToken: async (pathname) => {
        if (!INCOMING_PATH.test(pathname) || pathname.includes("..")) {
          throw new Error("올바르지 않은 업로드 경로입니다.");
        }
        const validUntil = Date.now() + 10 * 60 * 1000;
        return {
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            validUntil,
          }),
          urlOptions: {
            addRandomSuffix: false,
            allowOverwrite: false,
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            validUntil,
          },
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "업로드 URL을 만들지 못했습니다.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export default { fetch: handle };
