import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileCleaningPage } from "./FileCleaningPage";
import { FileDetailPage } from "./FileDetailPage";

const useWorkspaceMock = vi.hoisted(() => vi.fn());

vi.mock("../state/workspace", () => ({
  useWorkspace: useWorkspaceMock,
}));

vi.mock("../state/complaintData", () => ({
  useComplaintData: () => ({ complaints: [] }),
}));

function apiLoadingWorkspace() {
  return {
    files: [],
    dataMode: "api",
    loading: true,
    ensureFileData: vi.fn(() => new Promise<void>(() => undefined)),
    analysisRequested: vi.fn(() => false),
    requestAnalysis: vi.fn(),
    retryFileProcessing: vi.fn(),
    cleaningRows: vi.fn(() => []),
    cleaningArtifact: vi.fn(() => null),
    deleteFile: vi.fn(),
    jobForFile: vi.fn(() => null),
    cleaningDecision: vi.fn(() => "pending"),
    decideCleaningRule: vi.fn(),
    cleaningRules: vi.fn(() => []),
    cleaningPreview: vi.fn(() => []),
    appliedCleaningRules: vi.fn(() => null),
    applyCleaningRules: vi.fn(),
    downloadCleanedFile: vi.fn(),
  };
}

describe("파일 경로 초기 로딩", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("상세 파일 조회 중에는 파일 없음 화면을 표시하지 않는다", () => {
    useWorkspaceMock.mockReturnValue(apiLoadingWorkspace());

    render(
      <MemoryRouter initialEntries={["/files/file-1"]}>
        <Routes>
          <Route path="/files/:fileId" element={<FileDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "파일 정보를 불러오는 중입니다" })).toBeInTheDocument();
    expect(screen.queryByText("파일을 찾을 수 없습니다")).not.toBeInTheDocument();
  });

  it("정제 파일 조회 중에는 파일 없음 화면을 표시하지 않는다", () => {
    useWorkspaceMock.mockReturnValue(apiLoadingWorkspace());

    render(
      <MemoryRouter initialEntries={["/files/file-1/cleaning"]}>
        <Routes>
          <Route path="/files/:fileId/cleaning" element={<FileCleaningPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "정제 정보를 불러오는 중입니다" })).toBeInTheDocument();
    expect(screen.queryByText("파일을 찾을 수 없습니다")).not.toBeInTheDocument();
  });
});
