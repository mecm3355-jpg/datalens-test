import { timingSafeEqual } from "node:crypto";

/**
 * DataLens 백엔드와 Azure OpenAI 사이의 중계.
 *
 * 회사 Azure 키는 이 중계 서버(본인 Vercel)에만 두고, DataLens 배포에는 출입증(RELAY_TOKEN)만 둔다.
 * 백엔드가 만든 요청(시스템·사용자 메시지, 응답 JSON 스키마)에 키와 배포 이름만 붙여 그대로 보내고,
 * 응답 글자와 토큰 수만 돌려준다. 요청·응답 내용과 키는 로그에 남기지 않는다.
 */

/** 중계 서버 환경 변수(본인 Vercel의 Environment Variables). */
export type RelayEnv = {
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_API_VERSION?: string;
  AZURE_OPENAI_DEPLOYMENT_FAST?: string;
  AZURE_OPENAI_DEPLOYMENT_DEEP?: string;
  RELAY_TOKEN?: string;
};

/** 백엔드가 보내는 요청 본문. */
type RelayRequest = {
  tier: "fast" | "deep";
  system: string;
  user: string;
  // Azure chat completions의 response_format(json_schema) 그대로
  response_format: Record<string, unknown>;
};

// 요청 본문 상한: 민원 묶음 하나(마스킹본)는 이 안에 들어온다. 큰 요청으로 비용이 튀는 것을 막는다
export const MAX_BODY_BYTES = 256 * 1024;
// 응답 길이 상한(출력 토큰). 분류·이름 짓기 결과는 이 안에 들어온다
export const MAX_COMPLETION_TOKENS = 8_000;
// Azure 호출 제한 시간
const UPSTREAM_TIMEOUT_MS = 110_000;

/**
 * 출입증이 맞는지 본다. 길이가 달라도 시간 차이로 값을 짐작할 수 없게 비교한다.
 * @param header Authorization 헤더 값
 * @param token 설정된 출입증
 */
function authorized(header: string | null, token: string): boolean {
  const given = Buffer.from(header?.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * 요청 본문을 검사한다. 맞지 않으면 null.
 * @param value JSON으로 읽은 본문
 */
function parseRequest(value: unknown): RelayRequest | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (body.tier !== "fast" && body.tier !== "deep") return null;
  if (typeof body.system !== "string" || typeof body.user !== "string") return null;
  if (!body.response_format || typeof body.response_format !== "object") return null;
  return {
    tier: body.tier,
    system: body.system,
    user: body.user,
    response_format: body.response_format as Record<string, unknown>,
  };
}

/**
 * tier에 맞는 Azure 호출 주소와 배포 이름. 설정이 빠졌으면 null.
 * 엔드포인트가 .../openai/v1 이면 v1 API(배포 이름을 model로), 아니면 배포 경로 + API 버전을 쓴다.
 * @param env 환경 변수
 * @param tier fast 또는 deep
 */
export function upstreamFor(env: RelayEnv, tier: "fast" | "deep"): { url: string; deployment: string } | null {
  const endpoint = (env.AZURE_OPENAI_ENDPOINT ?? "").trim().replace(/\/+$/u, "");
  const deployment = (tier === "fast" ? env.AZURE_OPENAI_DEPLOYMENT_FAST : env.AZURE_OPENAI_DEPLOYMENT_DEEP)?.trim();
  if (!endpoint || !deployment || !env.AZURE_OPENAI_API_KEY) return null;
  if (endpoint.endsWith("/openai/v1")) return { url: `${endpoint}/chat/completions`, deployment };
  const version = env.AZURE_OPENAI_API_VERSION?.trim();
  if (!version) return null;
  const path = `/openai/deployments/${encodeURIComponent(deployment)}/chat/completions`;
  return { url: `${endpoint}${path}?api-version=${encodeURIComponent(version)}`, deployment };
}

/**
 * 중계 요청 하나를 처리한다.
 * @param request 들어온 요청
 * @param env 환경 변수
 * @param fetchImpl Azure 호출에 쓸 fetch(테스트에서 바꿔 끼운다)
 */
export async function handleRelay(
  request: Request,
  env: RelayEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "POST만 받습니다." }, { status: 405 });
  const token = env.RELAY_TOKEN ?? "";
  // 출입증이 너무 짧으면 짐작당하기 쉬우므로 설정 오류로 보고 받지 않는다
  if (token.length < 32) return Response.json({ error: "중계 서버 출입증이 설정되지 않았습니다." }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), token)) {
    return Response.json({ error: "출입증이 맞지 않습니다." }, { status: 401 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON 형식이 아닙니다." }, { status: 400 });
  }
  const body = parseRequest(parsed);
  if (!body) return Response.json({ error: "요청 형식이 맞지 않습니다." }, { status: 400 });

  const upstream = upstreamFor(env, body.tier);
  if (!upstream) return Response.json({ error: `AI 연결 정보가 없습니다(${body.tier}).` }, { status: 503 });

  let reply: Response;
  try {
    reply = await fetchImpl(upstream.url, {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": env.AZURE_OPENAI_API_KEY ?? "" },
      body: JSON.stringify({
        model: upstream.deployment,
        messages: [
          { role: "system", content: body.system },
          { role: "user", content: body.user },
        ],
        response_format: body.response_format,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return Response.json({ error: "AI 서버에 연결하지 못했습니다." }, { status: 502 });
  }
  // Azure 오류 본문은 내부 문구라 넘기지 않고 상태 코드만 알린다(백엔드가 그 코드로 기록한다)
  if (!reply.ok) return Response.json({ error: "AI 호출 실패", upstreamStatus: reply.status }, { status: 502 });

  const data = (await reply.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = data.choices?.[0];
  return Response.json({
    content: choice?.message?.content ?? "",
    refusal: choice?.message?.refusal ?? null,
    finishReason: choice?.finish_reason ?? null,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  });
}
