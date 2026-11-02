import { describe, expect, it, vi } from "vitest";
import { handleRelay, MAX_BODY_BYTES, upstreamFor, type RelayEnv } from "./relay.js";

const TOKEN = "t".repeat(40);
const env: RelayEnv = {
  AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/openai/v1/",
  AZURE_OPENAI_API_KEY: "company-key",
  AZURE_OPENAI_DEPLOYMENT_FAST: "fast-model",
  AZURE_OPENAI_DEPLOYMENT_DEEP: "deep-model",
  RELAY_TOKEN: TOKEN,
};

const body = {
  tier: "fast",
  system: "분류하라",
  user: "민원 목록",
  response_format: { type: "json_schema", json_schema: { name: "X", schema: {}, strict: true } },
};

function request(payload: unknown, token = TOKEN, method = "POST"): Request {
  return new Request("https://relay.example/api/chat", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload) : undefined,
  });
}

function azureReply(): typeof fetch {
  return vi.fn(async () =>
    Response.json({
      choices: [{ finish_reason: "stop", message: { content: '{"ok":true}', refusal: null } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    }),
  ) as unknown as typeof fetch;
}

describe("AI 중계", () => {
  it("출입증이 맞으면 회사 키와 배포 이름을 붙여 Azure로 보내고 글자·토큰만 돌려준다", async () => {
    const upstream = azureReply();
    const res = await handleRelay(request(body), env, upstream);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      content: '{"ok":true}',
      refusal: null,
      finishReason: "stop",
      promptTokens: 12,
      completionTokens: 3,
    });
    const [url, init] = vi.mocked(upstream).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.openai.azure.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("company-key");
    const sent = JSON.parse(init.body as string) as { model: string; response_format: unknown };
    expect(sent.model).toBe("fast-model");
    expect(sent.response_format).toEqual(body.response_format);
  });

  it("출입증이 틀리거나 없으면 Azure를 부르지 않는다", async () => {
    const upstream = azureReply();
    expect((await handleRelay(request(body, "wrong"), env, upstream)).status).toBe(401);
    expect((await handleRelay(request(body), { ...env, RELAY_TOKEN: "short" }, upstream)).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("형식이 틀리거나 너무 큰 요청은 거절한다", async () => {
    const upstream = azureReply();
    expect((await handleRelay(request({ ...body, tier: "other" }), env, upstream)).status).toBe(400);
    expect((await handleRelay(request({ ...body, user: "가".repeat(MAX_BODY_BYTES) }), env, upstream)).status).toBe(413);
    expect((await handleRelay(request(body, TOKEN, "GET"), env, upstream)).status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("Azure 오류 본문은 넘기지 않고 상태 코드만 알린다", async () => {
    const upstream = vi.fn(async () => new Response("내부 오류 문구", { status: 429 })) as unknown as typeof fetch;
    const res = await handleRelay(request(body), env, upstream);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "AI 호출 실패", upstreamStatus: 429 });
  });

  it("v1이 아닌 엔드포인트는 배포 경로와 API 버전을 쓴다", () => {
    const classic = { ...env, AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com", AZURE_OPENAI_API_VERSION: "2024-10-21" };
    expect(upstreamFor(classic, "deep")?.url).toBe(
      "https://example.openai.azure.com/openai/deployments/deep-model/chat/completions?api-version=2024-10-21",
    );
    // 버전이 없으면 호출할 수 없다
    expect(upstreamFor({ ...classic, AZURE_OPENAI_API_VERSION: "" }, "deep")).toBeNull();
  });
});
