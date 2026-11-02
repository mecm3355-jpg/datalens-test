// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressItem } from "../state/progress";
import type { DataFile, Job } from "../types";
import { ProgressWatcher } from "./ProgressWatcher";

const update = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ catalog: {} as Record<string, unknown>, items: [] as unknown[] }));
const jobs = vi.hoisted(() => new Map<string, Job>());

vi.mock("../state/progress", () => ({ useProgress: () => ({ items: state.items, update }) }));
vi.mock("../state/catalog", () => ({ useCatalog: () => state.catalog }));
const quality = vi.hoisted(() => ({ issues: [] as Array<{ type: string }> }));
const startAnalysisMock = vi.hoisted(() => vi.fn(async () => ({ jobId: "j9" })));
const readScanned = vi.hoisted(() => vi.fn(async () => undefined));
const hasSource = vi.hoisted(() => ({ value: true }));
vi.mock("../lib/remote", () => ({
  loadJob: vi.fn(async (id: string) => jobs.get(id)),
  loadQuality: vi.fn(async () => quality.issues),
  startAnalysis: startAnalysisMock,
}));

function item(patch: Partial<ProgressItem>): ProgressItem {
  return {
    key: "p1",
    name: "민원.csv",
    fileId: "f1",
    step: "diagnosing",
    detail: "",
    percent: null,
    ignoreJobId: null,
    waitingSince: null,
    scanned: false,
    scanChecked: false,
    fallbackSplitRule: null,
    ...patch,
  };
}

function job(id: string, type: string, status: Job["status"], progress: number): Job {
  return { id, fileId: "f1", type, status, progress, stage: "", error: null };
}

function setServer(status: DataFile["status"], last: Job, complaints = 0, extension = "csv") {
  jobs.set(last.id, last);
  const file: DataFile = {
    id: "f1",
    originalName: "민원.csv",
    extension,
    fileCategory: extension === "pdf" ? "document" : "tabular",
    sizeBytes: 10,
    status,
    createdAt: "2026-11-02T00:00:00Z",
    rowCount: null,
    columns: [],
    mapping: {},
    lastJobId: last.id,
  };
  state.catalog = {
    files: [file],
    complaintsByFile: () => Array.from({ length: complaints }),
    candidates: [{ id: "c1", decision: "pending" }],
    hasSource: () => hasSource.value,
    readScanned,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("진행 감시", () => {
  beforeEach(() => {
    update.mockClear();
    readScanned.mockClear();
    startAnalysisMock.mockClear();
    quality.issues = [];
    hasSource.value = true;
  });

  it("서버 작업 진행률과 단계를 진행 팝업에 반영한다", async () => {
    state.items = [item({})];
    setServer("processing", job("j2", "complaint_analysis", "processing", 60));
    render(<ProgressWatcher />);
    await flush();

    expect(update).toHaveBeenCalledWith("p1", expect.objectContaining({ step: "analyzing", percent: 60 }));
  });

  it("분석이 끝나면 민원 수와 승인 대기 후보 수를 담아 완료로 바꾼다", async () => {
    state.items = [item({ step: "analyzing" })];
    setServer("completed", job("j2", "complaint_analysis", "completed", 100), 24);
    render(<ProgressWatcher />);
    await flush();

    const [, patch] = update.mock.calls[0] as [string, { step: string; detail: string; percent: number | null }];
    expect(patch.step).toBe("done");
    expect(patch.detail).toContain("민원 24건");
    expect(patch.detail).toContain("승인 대기 후보 1개");
    expect(patch.percent).toBeNull();
  });

  it("끝난 항목과 아직 업로드 중인 항목은 건드리지 않는다", async () => {
    state.items = [item({ step: "done" }), item({ key: "p2", fileId: null, step: "uploading" })];
    setServer("processing", job("j1", "analyze", "processing", 10));
    render(<ProgressWatcher />);
    await flush();

    expect(update).not.toHaveBeenCalled();
  });

  it("글자 없는 스캔 PDF는 기다리지 않고 바로 브라우저 글자 읽기를 시작한다", async () => {
    state.items = [item({})];
    quality.issues = [{ type: "no_text_layer" }];
    setServer("completed", job("j1", "analyze", "completed", 100), 0, "pdf");
    render(<ProgressWatcher />);
    await flush();

    expect(update).toHaveBeenCalledWith("p1", expect.objectContaining({ scanned: true, step: "ocr" }));
    expect(readScanned).toHaveBeenCalledWith("p1", "f1");
  });

  it("원본이 이 창에 없는 스캔본은 다시 고르라고 안내하고 멈춘다", async () => {
    state.items = [item({})];
    quality.issues = [{ type: "no_text_layer" }];
    hasSource.value = false;
    setServer("completed", job("j1", "analyze", "completed", 100), 0, "pdf");
    render(<ProgressWatcher />);
    await flush();

    const [, patch] = update.mock.calls[0] as [string, { step: string; detail: string }];
    expect(patch.step).toBe("stopped");
    expect(patch.detail).toContain("원본 PDF를 다시 고르면");
    expect(readScanned).not.toHaveBeenCalled();
  });

  it("스캔본 글자 파일은 서버가 분석을 시작하지 않으면 국민신문고 규칙으로 직접 요청한다", async () => {
    state.items = [item({ waitingSince: 0, fallbackSplitRule: "sinmungo", scanChecked: true })];
    setServer("completed", { ...job("j1", "analyze", "completed", 100) }, 0, "txt");
    render(<ProgressWatcher />);
    await flush();
    await flush();

    expect(startAnalysisMock).toHaveBeenCalledWith("f1", {}, "sinmungo");
    expect(update).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ step: "analyzing", ignoreJobId: "j1", fallbackSplitRule: null }),
    );
  });

  it("기다리는 동안에는 민원 분석을 기다린다고 보여 준다", async () => {
    state.items = [item({})];
    setServer("completed", job("j1", "analyze", "completed", 100));
    render(<ProgressWatcher />);
    await flush();

    expect(update).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ step: "diagnosing", detail: expect.stringContaining("기다리고") as unknown }),
    );
  });
});
