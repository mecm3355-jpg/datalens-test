import { describe, expect, it } from "vitest";
import { AUTO_START_WAIT_MS, nextStep, type ServerState } from "./stages";

const base: ServerState = {
  status: "processing",
  jobId: "j1",
  jobType: "analyze",
  jobError: null,
  fileCategory: "tabular",
  complaintCount: 0,
  pendingCandidates: 0,
};

describe("처리 단계 판단", () => {
  it("진단 → 민원 분석 → 완료 순서로 단계를 정한다", () => {
    expect(nextStep(base, null, null, 0).step).toBe("diagnosing");
    expect(nextStep({ ...base, jobId: "j2", jobType: "complaint_analysis" }, null, null, 0).step).toBe("analyzing");

    const done = nextStep(
      { ...base, status: "completed", jobId: "j2", jobType: "complaint_analysis", complaintCount: 24, pendingCandidates: 3 },
      null,
      null,
      0,
    );
    expect(done.step).toBe("done");
    expect(done.detail).toContain("민원 24건");
    expect(done.detail).toContain("승인 대기 후보 3개");
  });

  it("진단만 끝나면 자동 분석을 잠시 기다렸다가 멈춘 이유를 알린다", () => {
    const completed = { ...base, status: "completed" as const };
    expect(nextStep(completed, null, null, 1_000)).toEqual({ step: "diagnosing", detail: "", waitingSince: 1_000 });

    const stopped = nextStep(completed, null, 1_000, 1_000 + AUTO_START_WAIT_MS);
    expect(stopped.step).toBe("stopped");
    expect(stopped.detail).toContain("본문 열");
    expect(nextStep({ ...completed, fileCategory: "document" }, null, 0, AUTO_START_WAIT_MS).detail).toContain("서식");
  });

  it("민원 분석 대상이 아닌 형식은 진단으로 끝난다", () => {
    expect(nextStep({ ...base, status: "completed", fileCategory: "image" }, null, null, 0).step).toBe("done");
    // 미지원 형식은 작업 없이 바로 끝난다
    const other = { ...base, status: "completed" as const, jobId: null, jobType: null, fileCategory: "other" as const };
    expect(nextStep(other, null, null, 0).step).toBe("done");
  });

  it("다시 분석할 때 이전 작업은 무시하고 분석 단계로 둔다", () => {
    const previous = { ...base, status: "completed" as const, jobType: "complaint_analysis" };
    expect(nextStep(previous, "j1", null, 0).step).toBe("analyzing");
  });

  it("실패하면 서버 오류 메시지를 담는다", () => {
    const failed = nextStep({ ...base, status: "failed", jobError: "원본 파일이 저장소에 없습니다." }, null, null, 0);
    expect(failed).toEqual({ step: "failed", detail: "원본 파일이 저장소에 없습니다.", waitingSince: null });
  });
});
