import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const INCOMING_PATH = /^incoming\/[0-9a-f-]{36}-[^/]{1,120}$/iu;

/** 브라우저가 Function을 거치지 않고 Private Blob으로 직접 올릴 수 있는 토큰을 발급합니다. */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!INCOMING_PATH.test(pathname) || pathname.includes("..")) {
          throw new Error("잘못된 업로드 경로입니다.");
        }
        return {
          addRandomSuffix: false,
          allowOverwrite: false,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 토큰을 만들지 못했습니다.";
    return Response.json({ error: message }, { status: 400 });
  }
}
