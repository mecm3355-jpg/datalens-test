import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileDetailPage } from "./FileDetailPage";

const useWorkspaceMock = vi.hoisted(() => vi.fn());
const reload = vi.hoisted(() => vi.fn(async () => undefined));
const readScannedPdf = vi.hoisted(() => vi.fn());

vi.mock("../lib/browserOcr", () => ({ readScannedPdf }));

vi.mock("../state/workspace", () => ({ useWorkspace: useWorkspaceMock }));
vi.mock("../state/complaintData", () => ({
  useComplaintData: () => ({ complaints: [], reload }),
}));

function workspace(requestComplaintAnalysis: ReturnType<typeof vi.fn>, columns = ["제목", "민원내용", "접수일"]) {
  return {
    files: [{
      id: "file-1",
      originalName: "민원.csv",
      extension: "csv",
      fileCategory: "tabular",
      status: "completed",
      sizeBytes: 10,
      rowCount: 3,
      createdAt: "2026-10-31T00:00:00Z",
      columns,
      mapping: {},
    }],
    dataMode: "api",
    loading: false,
    ensureFileData: vi.fn(async () => undefined),
    analysisRequested: vi.fn(() => false),
    requestAnalysis: vi.fn(),
    requestComplaintAnalysis,
    retryFileProcessing: vi.fn(),
    cleaningRows: vi.fn(() => []),
    cleaningArtifact: vi.fn(() => null),
    deleteFile: vi.fn(),
    jobForFile: vi.fn(() => null),
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/files/file-1"]}>
      <Routes><Route path="/files/:fileId" element={<FileDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("민원 분석 카드", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("추정한 열로 분석을 시작하고 끝나면 민원을 다시 불러온다", async () => {
    const start = vi.fn(async () => undefined);
    useWorkspaceMock.mockReturnValue(workspace(start));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "민원 분석 시작" }));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(start).toHaveBeenCalledWith("file-1", { content: "민원내용", title: "제목", receivedAt: "접수일" }, undefined);
  });

  it("PDF는 기본으로 국민신문고 규칙으로 나눠 분석한다", async () => {
    const start = vi.fn(async () => undefined);
    const base = workspace(start, []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      cleaningArtifact: vi.fn(() => ({ qualityIssues: [] })),
      files: [{ ...base.files[0], originalName: "민원.pdf", extension: "pdf", fileCategory: "document" }],
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "민원 분석 시작" }));

    await waitFor(() => expect(start).toHaveBeenCalledWith("file-1", {}, "sinmungo"));
  });

  function scannedWorkspace(analyzeOcrText: ReturnType<typeof vi.fn>) {
    const base = workspace(vi.fn(), []);
    return {
      ...base,
      analyzeOcrText,
      cleaningArtifact: vi.fn(() => ({ qualityIssues: [{ type: "no_text_layer", severity: "high", count: 1, location: null, message: "OCR 필요" }] })),
      files: [{ ...base.files[0], originalName: "스캔.pdf", extension: "pdf", fileCategory: "document", sizeBytes: 3 }],
    };
  }

  it("스캔 PDF는 브라우저에서 읽은 글자로 분석한다", async () => {
    readScannedPdf.mockResolvedValue("번호 1");
    const analyzeOcrText = vi.fn(async () => "file-2");
    useWorkspaceMock.mockReturnValue(scannedWorkspace(analyzeOcrText));
    renderPage();
    const button = await screen.findByRole("button", { name: "민원 분석 시작" });
    expect(button).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("원본 PDF 선택"), {
      target: { files: [new File(["abc"], "스캔.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(button);

    await waitFor(() => expect(analyzeOcrText).toHaveBeenCalledWith("스캔.pdf", "번호 1", "sinmungo"));
  });

  it("올린 PDF와 크기가 다른 파일은 읽지 않는다", async () => {
    const analyzeOcrText = vi.fn();
    useWorkspaceMock.mockReturnValue(scannedWorkspace(analyzeOcrText));
    renderPage();

    fireEvent.change(await screen.findByLabelText("원본 PDF 선택"), {
      target: { files: [new File(["abcdef"], "다른.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "민원 분석 시작" }));

    expect((await screen.findByRole("alert")).textContent).toContain("크기가 다른 파일");
    expect(readScannedPdf).not.toHaveBeenCalled();
  });

  it("문서는 진단 결과가 오기 전에는 시작할 수 없다", async () => {
    const base = workspace(vi.fn(), []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      files: [{ ...base.files[0], originalName: "스캔.pdf", extension: "pdf", fileCategory: "document" }],
    });
    renderPage();

    expect(await screen.findByRole("button", { name: "민원 분석 시작" })).toHaveProperty("disabled", true);
    expect(screen.queryByLabelText("원본 PDF 선택")).toBeNull();
  });

  it("서버가 스캔본을 못 읽어 실패한 파일도 브라우저에서 읽을 수 있다", async () => {
    const base = workspace(vi.fn(), []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      jobForFile: vi.fn(() => ({ status: "failed", stage: "parsing", progress: 10, error: { code: "OCR_NOT_AVAILABLE", message: "OCR 없음" } })),
      files: [{ ...base.files[0], originalName: "스캔.pdf", extension: "pdf", fileCategory: "document", status: "failed" }],
    });
    renderPage();

    expect(await screen.findByLabelText("원본 PDF 선택")).toBeTruthy();
  });

  it("API 모드에서는 저장되지 않는 컬럼 매핑 칸을 보여 주지 않는다", async () => {
    useWorkspaceMock.mockReturnValue(workspace(vi.fn()));
    renderPage();

    await screen.findByRole("button", { name: "민원 분석 시작" });
    expect(screen.queryByText("컬럼 매핑")).toBeNull();
  });

  it("내용이나 제목 열을 고르기 전에는 시작할 수 없다", async () => {
    useWorkspaceMock.mockReturnValue(workspace(vi.fn(), ["번호", "담당"]));
    renderPage();

    expect(await screen.findByRole("button", { name: "민원 분석 시작" })).toHaveProperty("disabled", true);
  });

  it("분석 실패 내용을 화면에 보여 준다", async () => {
    const start = vi.fn(async () => {
      throw new Error("분석에 실패했습니다.");
    });
    useWorkspaceMock.mockReturnValue(workspace(start));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "민원 분석 시작" }));

    expect((await screen.findByRole("alert")).textContent).toContain("분석에 실패했습니다.");
  });
});
