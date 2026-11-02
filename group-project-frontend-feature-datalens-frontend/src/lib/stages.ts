import type { FileCategory, FileStatus } from "../types";

/** 파일 처리 단계. 작업 종류(진단 analyze / 민원 분석 complaint_analysis)와 상태로 정한다. */
export type Phase = "diagnosing" | "analyzing" | "diagnosed" | "analyzed" | "failed";

/** 단계가 바뀔 때 띄우는 안내 팝업 내용. */
export type StageNotice = {
  title: string;
  message: string;
  tone: "info" | "success" | "warning" | "error";
  // 다음에 할 일로 바로 가는 버튼(없으면 확인만)
  link?: { to: string; label: string };
};

const COMPLAINT_ANALYSIS = "complaint_analysis";

/**
 * 파일 상태와 마지막 작업 종류로 처리 단계를 구한다. 작업이 없으면(미지원 형식) null.
 * @param status 파일 상태
 * @param jobType 마지막 작업 종류(analyze, complaint_analysis 등)
 */
export function phaseOf(status: FileStatus, jobType: string | null): Phase | null {
  if (status === "failed") return "failed";
  if (jobType === null) return null;
  const analyzing = jobType === COMPLAINT_ANALYSIS;
  if (status === "queued" || status === "processing") return analyzing ? "analyzing" : "diagnosing";
  return analyzing ? "analyzed" : "diagnosed";
}

/**
 * 서버가 진단 뒤 민원 분석을 자동으로 이어 가는 형식인지. 표·문서·텍스트만 이어 간다.
 * @param category 파일 분류
 */
export function autoAnalysisExpected(category: FileCategory): boolean {
  return category === "tabular" || category === "document" || category === "text";
}

/**
 * 단계에 맞는 안내 문구를 만든다.
 * @param file 파일 ID·이름·분류
 * @param phase 새 단계
 * @param context 분석 결과 수치와 오류 메시지
 */
export function stageNotice(
  file: { id: string; originalName: string; fileCategory: FileCategory },
  phase: Phase,
  context: { complaintCount: number; pendingCandidates: number; error: string | null },
): StageNotice {
  const name = file.originalName;
  const fileLink = { to: `/files/${file.id}`, label: "파일 화면으로" };
  switch (phase) {
    case "diagnosing":
      return {
        tone: "info",
        title: "1단계 · 형식 검증과 품질 진단",
        message: autoAnalysisExpected(file.fileCategory)
          ? `'${name}' 파일을 받았습니다. 실제 형식을 확인하고 품질을 진단하고 있습니다. 끝나면 민원 분석으로 자동으로 넘어갑니다.`
          : `'${name}' 파일을 받았습니다. 실제 형식을 확인하고 기본 정보를 진단하고 있습니다.`,
      };
    case "analyzing":
      return {
        tone: "info",
        title: "2단계 · 민원 분석 자동 시작",
        message: `'${name}' 진단을 마치고 민원 분석을 시작했습니다. 개인정보를 가리고, 속성을 뽑고, 기존 카테고리에 배정한 뒤 남은 민원을 신규 후보로 묶습니다.`,
      };
    case "analyzed":
      if (context.pendingCandidates > 0) {
        return {
          tone: "success",
          title: "3단계 · 분석 완료, 후보 승인 필요",
          message: `'${name}'에서 민원 ${context.complaintCount}건을 분석했습니다. 승인을 기다리는 신규 후보가 ${context.pendingCandidates}개 있습니다. 후보를 승인하면 묶인 민원이 그 카테고리로 배정됩니다.`,
          link: { to: "/categories/candidates", label: "후보 승인하러 가기" },
        };
      }
      return {
        tone: "success",
        title: "3단계 · 분석 완료",
        message: `'${name}'에서 민원 ${context.complaintCount}건을 분석해 카테고리에 배정했습니다. 애매한 민원은 검토 화면에서 확정하세요.`,
        link: { to: "/complaints", label: "민원 보기" },
      };
    case "diagnosed":
      if (!autoAnalysisExpected(file.fileCategory)) {
        return {
          tone: "info",
          title: "진단 완료",
          message: `'${name}' 진단을 마쳤습니다. 이 형식은 민원 분석을 하지 않습니다.`,
          link: fileLink,
        };
      }
      return {
        tone: "warning",
        title: "진단 완료 · 분석은 직접 시작",
        message:
          file.fileCategory === "tabular"
            ? `'${name}'에서 민원 본문 열을 찾지 못해 자동 분석을 하지 않았습니다. 파일 화면에서 열을 정한 뒤 '분석 실행'을 누르세요.`
            : `'${name}'에서 민원을 나눌 서식(국민신문고 등)을 찾지 못했거나 글자가 없는 스캔본이라 자동 분석을 하지 않았습니다. 파일 화면에서 확인하세요.`,
        link: fileLink,
      };
    case "failed":
      return {
        tone: "error",
        title: "처리 실패",
        message: `'${name}' 처리에 실패했습니다. ${context.error ?? "처리 중 오류가 발생했습니다."}`,
        link: fileLink,
      };
  }
}
