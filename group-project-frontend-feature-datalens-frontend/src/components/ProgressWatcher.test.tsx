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
vi.mock("../lib/remote", () => ({ loadJob: vi.fn(async (id: string) => jobs.get(id)) }));

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
    ...patch,
  };
}

function job(id: string, type: string, status: Job["status"], progress: number): Job {
  return { id, fileId: "f1", type, status, progress, stage: "", error: null };
}

function setServer(status: DataFile["status"], last: Job, complaints = 0) {
  jobs.set(last.id, last);
  const file: DataFile = {
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
    lastJobId: last.id,
  };
  state.catalog = {
    files: [file],
    complaintsByFile: () => Array.from({ length: complaints }),
    candidates: [{ id: "c1", decision: "pending" }],
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
});
