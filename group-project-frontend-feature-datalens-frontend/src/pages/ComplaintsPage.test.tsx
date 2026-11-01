import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplaintsPage } from "./ComplaintsPage";

vi.mock("../state/complaintData", () => ({
  useComplaintData: () => ({
    complaints: [{
      id: "6ae70d0be9f4c1d3a4810032",
      contentMasked: "동시 신호 횡단보도",
      assignStatus: "unassigned",
      categoryId: null,
      region: null,
      receivedAt: "2026-10-21",
      attributes: { urgency: null, affected: null },
    }],
    categoryById: () => undefined,
    loading: false,
    error: null,
  }),
}));

describe("민원 목록", () => {
  afterEach(cleanup);

  it("내부 번호 대신 내용을 상세 링크로 보여 준다", () => {
    render(<MemoryRouter><ComplaintsPage /></MemoryRouter>);

    const link = screen.getByRole("link", { name: "동시 신호 횡단보도" });
    expect(link.getAttribute("href")).toBe("/complaints/6ae70d0be9f4c1d3a4810032");
    expect(screen.queryByText("6ae70d0be9f4c1d3a4810032")).toBeNull();
  });
});
