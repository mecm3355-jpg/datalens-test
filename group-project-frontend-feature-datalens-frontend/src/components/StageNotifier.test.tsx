// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataFile, Job } from "../types";
import { AUTO_START_WAIT_MS, StageNotifier } from "./StageNotifier";

const notify = vi.hoisted(() => vi.fn());
const catalog = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const jobs = vi.hoisted(() => new Map<string, Job>());

vi.mock("../state/notices", () => ({ useNotices: () => ({ notify }) }));
vi.mock("../state/catalog", () => ({ useCatalog: () => catalog.value }));
vi.mock("../lib/remote", () => ({ loadJob: vi.fn(async (id: string) => jobs.get(id)) }));

function file(status: DataFile["status"], lastJobId: string): DataFile {
  return {
    id: "f1",
    originalName: "민원.csv",
    extension: "csv",
    fileCategory: "tabular",
    sizeBytes: 10,
    status,
    createdAt: "2026-11-02T00:00:00Z",
    rowCount: null,
    columns: [],
    mapping: {},
    lastJobId,
  };
}

function job(id: string, type: string, status: Job["status"]): Job {
  const value: Job = { id, fileId: "f1", type, status, progress: 0, stage: "", error: null };
  jobs.set(id, value);
  return value;
}

function setFiles(files: DataFile[], complaints = 0, pending = 0) {
  catalog.value = {
    status: "ready",
    files,
    complaintsByFile: () => Array.from({ length: complaints }),
    candidates: Array.from({ length: pending }, (_, i) => ({ id: `c${i}`, decision: "pending" })),
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("단계 안내 팝업", () => {
  beforeEach(() => {
    notify.mockClear();
    jobs.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("처음 불러온 상태는 알리지 않고, 이후 바뀐 단계만 차례로 알린다", async () => {
    job("j1", "analyze", "processing");
    setFiles([file("processing", "j1")]);
    const view = render(<StageNotifier />);
    await flush();
    expect(notify).not.toHaveBeenCalled();

    job("j2", "complaint_analysis", "queued");
    setFiles([file("queued", "j2")]);
    view.rerender(<StageNotifier />);
    await flush();
    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ title: "2단계 · 민원 분석 자동 시작" }));

    job("j2", "complaint_analysis", "completed");
    setFiles([file("completed", "j2")], 24, 3);
    view.rerender(<StageNotifier />);
    await flush();
    expect(notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "3단계 · 분석 완료, 후보 승인 필요" }),
    );
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("진단 뒤 자동 분석이 시작되지 않으면 기다렸다가 멈췄다고 알린다", async () => {
    vi.useFakeTimers();
    job("j1", "analyze", "processing");
    setFiles([file("processing", "j1")]);
    const view = render(<StageNotifier />);
    await flush();

    job("j1", "analyze", "completed");
    setFiles([file("completed", "j1")]);
    view.rerender(<StageNotifier />);
    await flush();
    // 서버가 곧 민원 분석을 이어 갈 수 있으므로 바로 알리지 않는다
    expect(notify).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(AUTO_START_WAIT_MS);
    });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "진단 완료 · 분석은 직접 시작" }));
  });

  it("기다리는 동안 민원 분석이 시작되면 멈췄다는 안내 대신 분석 시작을 알린다", async () => {
    vi.useFakeTimers();
    job("j1", "analyze", "processing");
    setFiles([file("processing", "j1")]);
    const view = render(<StageNotifier />);
    await flush();

    job("j1", "analyze", "completed");
    setFiles([file("completed", "j1")]);
    view.rerender(<StageNotifier />);
    await flush();
    job("j2", "complaint_analysis", "processing");
    setFiles([file("processing", "j2")]);
    view.rerender(<StageNotifier />);
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(AUTO_START_WAIT_MS);
    });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "2단계 · 민원 분석 자동 시작" }));
  });
});
