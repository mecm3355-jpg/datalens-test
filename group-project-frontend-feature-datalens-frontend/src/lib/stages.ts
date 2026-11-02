import type { FileCategory, FileStatus } from "../types";

/** 진행 팝업에 보이는 파일 한 개의 단계. done·stopped·failed는 끝난 단계다. */
export type Step = "uploading" | "diagnosing" | "ocr" | "analyzing" | "done" | "stopped" | "failed";

type ProgressStep = "uploading" | "diagnosing" | "ocr" | "analyzing" | "done";

/**
 * 팝업의 단계 표시줄 순서. 글자 없는 스캔본만 브라우저 글자 읽기(OCR) 단계를 거친다.
 * @param scanned 스캔본인지
 */
export function stepsFor(scanned: boolean): ProgressStep[] {
  return scanned
    ? ["uploading", "diagnosing", "ocr", "analyzing", "done"]
    : ["uploading", "diagnosing", "analyzing", "done"];
}

export const STEP_LABEL: Record<Step, string> = {
  uploading: "업로드",
  diagnosing: "형식 검증·품질 진단",
  ocr: "글자 읽기(OCR)",
  analyzing: "민원 분석",
  done: "완료",
  stopped: "분석 대기",
  failed: "실패",
};

/** 단계마다 지금 무엇을 하는지 한 줄 설명. */
export const STEP_DETAIL: Record<"uploading" | "diagnosing" | "ocr" | "analyzing", string> = {
  uploading: "파일을 올리고 있습니다.",
  diagnosing: "실제 형식을 확인하고 품질을 진단하고 있습니다.",
  ocr: "글자 없는 스캔본이라 이 브라우저에서 글자를 읽고 있습니다. 창을 닫지 마세요.",
  analyzing: "개인정보를 가리고, 속성을 뽑고, 카테고리에 배정한 뒤 남은 민원을 신규 후보로 묶고 있습니다.",
};

const COMPLAINT_ANALYSIS = "complaint_analysis";

// 진단이 끝난 뒤 서버가 민원 분석을 등록하기까지(매핑 추천 등) 기다리는 시간.
// 그 안에 분석이 시작되지 않으면 자동 분석 대상이 아니었다고 본다
// 배포 서버는 작업 대기열을 거쳐 몇십 초 걸릴 수 있어 넉넉히 둔다
export const AUTO_START_WAIT_MS = 30_000;

/** 진단을 마치고 민원 분석이 시작되기를 기다리는 동안의 설명. */
export const WAITING_DETAIL = "진단을 마쳤습니다. 민원 분석 시작을 기다리고 있습니다.";

/**
 * 끝난 단계인지.
 * @param step 단계
 */
export function isFinished(step: Step): boolean {
  return step === "done" || step === "stopped" || step === "failed";
}

/**
 * 서버가 진단 뒤 민원 분석을 자동으로 이어 가는 형식인지. 표·문서·텍스트만 이어 간다.
 * @param category 파일 분류
 */
export function autoAnalysisExpected(category: FileCategory): boolean {
  return category === "tabular" || category === "document" || category === "text";
}

/** 단계 판단에 쓰는 서버 상태. */
export type ServerState = {
  status: FileStatus;
  jobId: string | null;
  jobType: string | null;
  jobError: string | null;
  fileCategory: FileCategory;
  complaintCount: number;
  pendingCandidates: number;
};

/** nextStep 결과: 단계, 설명, 진단 뒤 분석을 기다리기 시작한 시각. */
export type StepResult = { step: Step; detail: string; waitingSince: number | null };

/**
 * 서버 상태로 파일의 현재 단계를 정한다.
 * @param server 파일·마지막 작업 상태와 분석 수치
 * @param ignoreJobId 이 작업은 이번 진행과 무관하다(다시 분석할 때 이전 분석 작업)
 * @param waitingSince 진단이 끝나 자동 분석을 기다리기 시작한 시각(없으면 null)
 * @param now 현재 시각(ms)
 */
export function nextStep(
  server: ServerState,
  ignoreJobId: string | null,
  waitingSince: number | null,
  now: number,
): StepResult {
  // 미지원 형식은 작업 없이 기본 정보만 등록되고 바로 끝난다
  if (server.jobId === null && ignoreJobId === null && server.status === "completed") {
    return { step: "done", detail: "기본 정보만 등록했습니다(내용 분석을 지원하지 않는 형식).", waitingSince: null };
  }
  // 다시 분석을 눌렀는데 아직 새 작업이 안 보이면 분석 단계로 둔다
  if (server.jobId === null || server.jobId === ignoreJobId) {
    return { step: ignoreJobId ? "analyzing" : "diagnosing", detail: "", waitingSince: null };
  }
  if (server.status === "failed") {
    return { step: "failed", detail: server.jobError ?? "처리 중 오류가 발생했습니다.", waitingSince: null };
  }
  const analysis = server.jobType === COMPLAINT_ANALYSIS;
  if (server.status === "queued" || server.status === "processing") {
    return { step: analysis ? "analyzing" : "diagnosing", detail: "", waitingSince: null };
  }
  if (analysis) {
    const candidates =
      server.pendingCandidates > 0 ? ` · 승인 대기 후보 ${server.pendingCandidates}개(후보 화면에서 승인)` : "";
    return { step: "done", detail: `민원 ${server.complaintCount}건을 분석했습니다${candidates}.`, waitingSince: null };
  }
  if (!autoAnalysisExpected(server.fileCategory)) {
    return { step: "done", detail: "진단을 마쳤습니다. 이 형식은 민원 분석을 하지 않습니다.", waitingSince: null };
  }
  // 진단만 끝났다: 서버가 곧 민원 분석을 이어 갈 수 있으므로 잠시 기다린다
  const since = waitingSince ?? now;
  if (now - since < AUTO_START_WAIT_MS) return { step: "diagnosing", detail: WAITING_DETAIL, waitingSince: since };
  return {
    step: "stopped",
    detail:
      server.fileCategory === "tabular"
        ? "민원 본문 열을 찾지 못해 자동 분석을 하지 않았습니다. 파일 화면에서 열을 정하고 분석하세요."
        : "민원을 나눌 서식을 찾지 못했거나 글자 없는 스캔본이라 자동 분석을 하지 않았습니다.",
    waitingSince: since,
  };
}
