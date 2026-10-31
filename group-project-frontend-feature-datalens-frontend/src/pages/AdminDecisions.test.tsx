import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidatesPage } from "./CandidatesPage";

const useSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../state/session", () => ({ useSession: useSessionMock }));
vi.mock("../state/complaintData", () => ({
  useComplaintData: () => ({
    candidates: [{
      id: "c1",
      period: "2026-10",
      size: 8,
      keywords: ["가로등"],
      suggestedName: "가로등 고장",
      suggestedDefinition: "",
      suggestedGroup: "시설",
      decision: "pending",
      exemplars: [],
    }],
    categories: [],
    categoryById: () => undefined,
    decideCandidate: vi.fn(),
    loading: false,
    error: null,
  }),
}));

function renderPage() {
  render(<MemoryRouter><CandidatesPage /></MemoryRouter>);
}

describe("후보 승인 권한", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("일반 사용자에게는 승인 버튼을 보여 주지 않는다", () => {
    useSessionMock.mockReturnValue({ user: { role: "user" } });
    renderPage();

    expect(screen.queryByRole("button", { name: "합치기" })).toBeNull();
    expect(screen.getByText(/관리자만 후보를 결정/)).toBeTruthy();
  });

  it("관리자에게는 승인 버튼을 보여 준다", () => {
    useSessionMock.mockReturnValue({ user: { role: "admin" } });
    renderPage();

    expect(screen.getByRole("button", { name: "합치기" })).toBeTruthy();
  });
});
