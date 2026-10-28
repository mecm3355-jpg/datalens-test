import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const INCOMING_PATH = /^incoming\/[0-9a-f-]{36}-[^/]{1,120}$/iu;
const COOKIE_NAME = "datalens_session";

async function authenticated(request: Request): Promise<boolean> {
  if (process.env.AUTH_REQUIRED !== "true") return true;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET이 설정되지 않았습니다.");
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  const parts = token?.split(".") ?? [];
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !/^[0-9a-f]{64}$/iu.test(signature ?? "")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBytes = Uint8Array.from(signature.match(/.{1,2}/g) ?? [], (value) =>
    Number.parseInt(value, 16),
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(payload),
  );
  if (!valid) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
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
