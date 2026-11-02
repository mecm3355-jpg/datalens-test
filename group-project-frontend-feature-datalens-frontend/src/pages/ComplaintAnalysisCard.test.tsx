import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutoOcrState } from "../hooks/useApiWorkspace";
import { FileDetailPage } from "./FileDetailPage";

const useWorkspaceMock = vi.hoisted(() => vi.fn());
const readScannedPdf = vi.hoisted(() => vi.fn());

vi.mock("../lib/browserOcr", () => ({ readScannedPdf }));

vi.mock("../state/workspace", () => ({ useWorkspace: useWorkspaceMock }));
const complaintsMock = vi.hoisted(() => vi.fn((): Array<Record<string, unknown>> => []));
vi.mock("../state/complaintData", () => ({
  useComplaintData: () => ({ complaints: complaintsMock() }),
}));

function workspace(requestAnalysis: ReturnType<typeof vi.fn>, columns = ["제목", "민원내용", "접수일"]) {
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
    uploadedSource: vi.fn((): File | null => null),
    autoOcrStatus: vi.fn((): AutoOcrState | null => null),
    analysisRequested: vi.fn(() => false),
    requestAnalysis,
    reportForFile: vi.fn(() => null),
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
    complaintsMock.mockReturnValue([]);
  });

  it("표 파일은 민원 분석 칸 대신 위쪽 버튼으로 시작한다", async () => {
    useWorkspaceMock.mockReturnValue(workspace(vi.fn(), []));
    renderPage();

    await screen.findByRole("button", { name: /분석/ });
    expect(screen.queryByText("민원 분석")).toBeNull();
    expect(screen.queryByLabelText("원본 PDF 선택")).toBeNull();
  });

  it("대기 중인 텍스트 파일에는 규칙 없이 시작하는 위쪽 버튼을 보여 주지 않는다", async () => {
    const base = workspace(vi.fn(), []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      files: [{ ...base.files[0], originalName: "민원.pdf.ocr.txt", extension: "txt", fileCategory: "text", status: "queued" }],
    });
    renderPage();

    await screen.findByRole("button", { name: "파일 삭제" });
    expect(screen.queryByRole("button", { name: /민원 분석 실행|민원 다시 분석/ })).toBeNull();
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

    await waitFor(() => expect(start).toHaveBeenCalledWith("file-1", { splitRule: "sinmungo" }));
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

  it("이 창에서 올린 스캔 PDF는 다시 고르지 않고 바로 읽는다", async () => {
    readScannedPdf.mockResolvedValue("번호 1");
    const analyzeOcrText = vi.fn(async () => "file-2");
    const source = new File(["abc"], "스캔.pdf", { type: "application/pdf" });
    useWorkspaceMock.mockReturnValue({ ...scannedWorkspace(analyzeOcrText), uploadedSource: vi.fn(() => source) });
    renderPage();

    const button = await screen.findByRole("button", { name: "민원 분석 시작" });
    expect(screen.queryByLabelText("원본 PDF 선택")).toBeNull();
    fireEvent.click(button);

    await waitFor(() => expect(readScannedPdf).toHaveBeenCalledWith(source, expect.any(Function)));
  });

  it("진단 결과를 못 불러오면 다시 불러오기를 보여 준다", async () => {
    const base = workspace(vi.fn(), []);
    const ensureFileData = vi.fn(async () => undefined);
    useWorkspaceMock.mockReturnValue({
      ...base,
      ensureFileData,
      files: [{ ...base.files[0], originalName: "민원.pdf", extension: "pdf", fileCategory: "document", processingError: "요청 실패" }],
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "다시 불러오기" }));

    await waitFor(() => expect(ensureFileData).toHaveBeenCalledTimes(2));
  });

  it("분석이 끝나면 민원과 신규 후보로 가는 길을 보여 준다", async () => {
    complaintsMock.mockReturnValue([{ id: "c1", fileId: "file-1", contentMasked: "횡단보도", receivedAt: "2026-10-21", assignStatus: "unassigned", categoryId: null, region: null, attributes: {}, sourceLocator: { row: 1 }, similarity: null }]);
    const base = workspace(vi.fn(), []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      cleaningArtifact: vi.fn(() => ({ qualityIssues: [] })),
      files: [{ ...base.files[0], originalName: "민원.pdf", extension: "pdf", fileCategory: "document" }],
    });
    renderPage();

    expect((await screen.findByRole("link", { name: "민원 보기" })).getAttribute("href")).toBe("/complaints");
    expect(screen.getByRole("link", { name: "신규 후보 보기" }).getAttribute("href")).toBe("/categories/candidates");
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

  it("분석 실패 내용을 화면에 보여 준다", async () => {
    const start = vi.fn(async () => {
      throw new Error("분석에 실패했습니다.");
    });
    const base = workspace(start, []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      cleaningArtifact: vi.fn(() => ({ qualityIssues: [] })),
      files: [{ ...base.files[0], originalName: "민원.txt", extension: "txt", fileCategory: "text" }],
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "민원 분석 시작" }));

    expect((await screen.findByRole("alert")).textContent).toContain("분석에 실패했습니다.");
  });

  it("업로드 직후 자동 글자 읽기가 도는 동안에는 진행 상황을 보여 주고 다시 시작하지 못하게 한다", async () => {
    const base = workspace(vi.fn(), []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      cleaningArtifact: vi.fn(() => ({ qualityIssues: [{ type: "no_text_layer" }] })),
      autoOcrStatus: vi.fn((): AutoOcrState => ({ running: true, message: "글자 읽는 중 2/5쪽 · 창을 닫지 마세요." })),
      files: [{ ...base.files[0], originalName: "스캔.pdf", extension: "pdf", fileCategory: "document" }],
    });
    renderPage();

    expect((await screen.findByText(/글자 읽는 중 2\/5쪽/)).textContent).toContain("창을 닫지 마세요");
    expect((screen.getByRole("button", { name: "민원 분석 시작" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("자동 글자 읽기가 끝나면 읽은 글자 파일로 가는 길을 보여 준다", async () => {
    const base = workspace(vi.fn(), []);
    useWorkspaceMock.mockReturnValue({
      ...base,
      cleaningArtifact: vi.fn(() => ({ qualityIssues: [{ type: "no_text_layer" }] })),
      autoOcrStatus: vi.fn((): AutoOcrState => ({
        running: false,
        message: "읽은 글자로 민원 분석을 마쳤습니다.",
        resultFileId: "file-ocr",
      })),
      files: [{ ...base.files[0], originalName: "스캔.pdf", extension: "pdf", fileCategory: "document" }],
    });
    renderPage();

    const link = await screen.findByRole("link", { name: "읽은 글자 파일 보기" });
    expect(link.getAttribute("href")).toBe("/files/file-ocr");
  });
});
