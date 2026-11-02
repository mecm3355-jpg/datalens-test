import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiComplaintStats } from "../api/datalens";
import { DashboardPage } from "./DashboardPage";

const complaintData = vi.hoisted(() => ({ stats: null as ApiComplaintStats | null }));

vi.mock("../state/workspace", () => ({
  useWorkspace: () => ({
    files: [],
    dashboardSummary: null,
    cleaningArtifact: () => null,
    dataMode: "api",
  }),
}));
vi.mock("../state/complaintData", () => ({ useComplaintData: () => complaintData }));

/** 첫 달처럼 승인된 카테고리 없이 후보만 있는 현황을 만듭니다. */
function firstMonthStats(): ApiComplaintStats {
  return {
    currentPeriod: "2026-01",
    previousPeriod: null,
    categories: [],
    period: null,
    total: 24,
    assignment: { auto: 0, ambiguous: 0, unassigned: 24, confirmed: 0 },
    groups: [{ label: null, count: 24 }],
    regions: [{ label: "수청동", count: 8 }],
    urgency: [{ label: null, count: 24 }],
    monthly: [{ label: "2026-01", count: 24 }],
    pendingCandidates: [
      { candidateId: "c1", suggestedName: "가로등 고장", suggestedGroup: "안전·조명", size: 8, keywords: ["가로등", "고장"] },
    ],
    pendingCandidateCount: 3,
    pendingCandidateComplaints: 24,
    pendingReviews: 2,
  };
}

describe("대시보드 민원 현황", () => {
  afterEach(cleanup);

  it("승인된 카테고리가 없어도 승인 대기 후보와 승인 화면 링크를 보여 준다", () => {
    complaintData.stats = firstMonthStats();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText("가로등 고장")).toBeTruthy();
    expect(screen.getByText("후보 3개 · 민원 24건")).toBeTruthy();
    expect(screen.getByText(/아직 승인된 카테고리가 없습니다/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "후보 승인" }).getAttribute("href")).toBe("/categories/candidates");
    expect(screen.getByRole("link", { name: "검토 대기 2건" }).getAttribute("href")).toBe("/reviews");
  });

  it("분석된 민원이 없으면 업로드 안내를 보여 준다", () => {
    complaintData.stats = { ...firstMonthStats(), total: 0, pendingCandidates: [], pendingCandidateCount: 0 };
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText(/아직 분석된 민원이 없습니다/)).toBeTruthy();
  });
});
