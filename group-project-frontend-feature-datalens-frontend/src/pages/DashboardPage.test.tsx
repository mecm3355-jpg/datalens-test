// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComplaintStats } from "../lib/remote";
import type { Category } from "../types";
import { DashboardPage, groupRows } from "./DashboardPage";

const catalog = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../state/catalog", () => ({ useCatalog: () => catalog.value }));

function category(categoryId: string, name: string, group: string): Category {
  return { categoryId, name, group, definition: "", keywords: [], count: 0, previousCount: 0, createdInVersion: 1 };
}

const categories = [
  category("CAT-0001", "가로등 고장", "안전·조명"),
  category("CAT-0002", "불법 주정차", "교통·주정차"),
  category("CAT-0003", "보안등 고장", "안전·조명"),
];

function stats(patch: Partial<ComplaintStats> = {}): ComplaintStats {
  return {
    total: 30,
    assignment: { auto: 10, ambiguous: 0, unassigned: 10, confirmed: 10 },
    categoriesTotal: [
      { label: "CAT-0002", count: 12 },
      { label: "CAT-0001", count: 8 },
      { label: null, count: 10 },
    ],
    pendingCandidates: [{ candidateId: "c1", suggestedName: "쓰레기 방치", suggestedGroup: null, size: 10 }],
    pendingCandidateCount: 1,
    pendingCandidateComplaints: 10,
    ...patch,
  };
}

describe("대시보드 카테고리별 건수", () => {
  afterEach(cleanup);

  it("상위 그룹별로 묶어 건수 많은 순으로 놓고, 0건 카테고리도 보여 준다", () => {
    const groups = groupRows(categories, stats());

    expect(groups.map((group) => [group.group, group.count])).toEqual([
      ["교통·주정차", 12],
      ["안전·조명", 8],
    ]);
    expect(groups[1].rows.map((row) => [row.name, row.count])).toEqual([
      ["가로등 고장", 8],
      ["보안등 고장", 0],
    ]);
  });

  it("카테고리별 건수와 미분류·승인 대기 후보를 보여 준다", () => {
    catalog.value = { categories, stats: stats(), status: "ready" };
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/분석을 마친 민원 30건 · 카테고리 배정 20건 · 미분류 10건/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "교통·주정차 12건" }).textContent).toContain("불법 주정차");
    expect(screen.getByRole("region", { name: "미분류 10건" }).textContent).toContain("쓰레기 방치 (후보)");
    expect(screen.getByRole("link", { name: "후보 승인하러 가기" }).getAttribute("href")).toBe("/categories/candidates");
    // 정제·카테고리 선택·최근 파일 같은 이전 내용은 없다
    expect(screen.queryByText(/정제/)).toBeNull();
    expect(screen.queryByText("최근 파일")).toBeNull();
  });

  it("분석된 민원이 없으면 파일을 올리라고 안내한다", () => {
    catalog.value = {
      categories: [],
      stats: stats({ total: 0, categoriesTotal: [], pendingCandidates: [], pendingCandidateCount: 0 }),
      status: "ready",
    };
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/아직 분석된 민원이 없습니다/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "파일 올리러 가기" }).getAttribute("href")).toBe("/files");
  });
});
