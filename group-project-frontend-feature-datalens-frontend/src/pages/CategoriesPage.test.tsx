import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoriesPage } from "./CategoriesPage";

vi.mock("../state/session", () => ({ useSession: () => ({ user: { role: "user" } }) }));
vi.mock("../state/workspace", () => ({
  useWorkspace: () => ({ mappings: [], addMapping: vi.fn(), dataMode: "api" }),
}));
vi.mock("../state/complaintData", () => ({
  useComplaintData: () => ({
    categories: [],
    categoryById: () => undefined,
    complaints: [],
    insights: [],
    mappings: [],
    mergeCategories: vi.fn(),
    splitCategory: vi.fn(),
    taxonomyVersion: 1,
    loading: false,
    error: null,
  }),
}));

describe("카테고리 체계", () => {
  afterEach(cleanup);

  it("확정된 카테고리가 없으면 빈 칸 대신 안내를 보여 준다", () => {
    render(<MemoryRouter><CategoriesPage /></MemoryRouter>);

    expect(screen.getByText(/아직 확정된 카테고리가 없습니다/)).toBeTruthy();
  });
});
