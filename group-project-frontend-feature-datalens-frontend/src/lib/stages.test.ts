import { describe, expect, it } from "vitest";
import { phaseOf, stageNotice } from "./stages";

const csv = { id: "f1", originalName: "민원.csv", fileCategory: "tabular" as const };
const pdf = { id: "f2", originalName: "목록.pdf", fileCategory: "document" as const };
const image = { id: "f3", originalName: "사진.jpg", fileCategory: "image" as const };
const none = { complaintCount: 0, pendingCandidates: 0, error: null };

describe("처리 단계", () => {
  it("작업 종류와 상태로 단계를 구한다", () => {
    expect(phaseOf("queued", "analyze")).toBe("diagnosing");
    expect(phaseOf("processing", "complaint_analysis")).toBe("analyzing");
    expect(phaseOf("completed", "analyze")).toBe("diagnosed");
    expect(phaseOf("completed", "complaint_analysis")).toBe("analyzed");
    expect(phaseOf("failed", null)).toBe("failed");
    // 미지원 형식은 작업이 없어 알릴 단계가 없다
    expect(phaseOf("completed", null)).toBeNull();
  });
});

describe("단계 안내", () => {
  it("분석이 끝나고 승인 대기 후보가 있으면 후보 승인으로 안내한다", () => {
    const notice = stageNotice(csv, "analyzed", { complaintCount: 24, pendingCandidates: 3, error: null });

    expect(notice.message).toContain("민원 24건");
    expect(notice.message).toContain("후보가 3개");
    expect(notice.link).toEqual({ to: "/categories/candidates", label: "후보 승인하러 가기" });
  });

  it("후보가 없으면 민원 목록으로 안내한다", () => {
    expect(stageNotice(csv, "analyzed", { ...none, complaintCount: 5 }).link?.to).toBe("/complaints");
  });

  it("자동 분석이 이어지지 않은 이유를 형식별로 알린다", () => {
    expect(stageNotice(csv, "diagnosed", none).message).toContain("본문 열");
    expect(stageNotice(pdf, "diagnosed", none).message).toContain("서식");
    expect(stageNotice(image, "diagnosed", none).message).toContain("민원 분석을 하지 않습니다");
    expect(stageNotice(csv, "diagnosed", none).link?.to).toBe("/files/f1");
  });

  it("진단 시작 안내는 자동 분석 여부를 구분한다", () => {
    expect(stageNotice(csv, "diagnosing", none).message).toContain("자동으로 넘어갑니다");
    expect(stageNotice(image, "diagnosing", none).message).not.toContain("자동으로 넘어갑니다");
  });

  it("실패하면 서버 오류 메시지를 보여 준다", () => {
    const notice = stageNotice(pdf, "failed", { ...none, error: "원본 파일이 저장소에 없습니다." });

    expect(notice.tone).toBe("error");
    expect(notice.message).toContain("원본 파일이 저장소에 없습니다.");
  });
});
