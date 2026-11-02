import { handleRelay, type RelayEnv } from "../lib/relay.js";

/** POST /api/chat — DataLens 백엔드의 AI 요청을 회사 Azure OpenAI로 중계한다. */
async function handle(request: Request): Promise<Response> {
  return handleRelay(request, process.env as RelayEnv);
}

export default { fetch: handle };
