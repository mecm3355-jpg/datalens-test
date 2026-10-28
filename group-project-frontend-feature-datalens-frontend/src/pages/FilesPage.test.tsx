import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "../state/workspace";
import { FilesPage } from "./FilesPage";

describe("FilesPage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("다중 파일 선택과 지원 형식 안내를 제공한다", () => {
    render(
      <MemoryRouter>
        <WorkspaceProvider>
          <FilesPage />
        </WorkspaceProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "파일" })).toBeInTheDocument();
    expect(screen.getByText(/CSV, JSON, TXT, LOG/)).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG/)).toBeInTheDocument();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.multiple).toBe(true);
  });

  it("여러 파일을 각각 처리해 완료 상태를 표시한다", async () => {
    render(
      <MemoryRouter>
        <WorkspaceProvider>
          <FilesPage />
        </WorkspaceProvider>
      </MemoryRouter>,
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const json = new File([JSON.stringify([{ id: 1 }, { id: 2 }])], "records.json", { type: "application/json" });
    const log = new File(["start\ncomplete"], "service.log", { type: "text/plain" });

    fireEvent.change(input as HTMLInputElement, { target: { files: [json, log] } });

    expect((await screen.findAllByText("records.json")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("service.log").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText("2개 파일 등록 완료")).toBeInTheDocument());
    await waitFor(() => {
      const progress = screen.getAllByRole("progressbar");
      expect(progress).toHaveLength(2);
      expect(progress.every((item) => item.getAttribute("aria-valuenow") === "100")).toBe(true);
    }, { timeout: 3000 });
  });

  it("알 수 없는 형식은 기다리지 않도록 메타데이터만 등록된다고 안내한다", async () => {
    render(
      <MemoryRouter>
        <WorkspaceProvider>
          <FilesPage />
        </WorkspaceProvider>
      </MemoryRouter>,
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const unknown = new File(["unknown-format"], "archive.xyz", { type: "application/octet-stream" });

    fireEvent.change(input as HTMLInputElement, { target: { files: [unknown] } });

    await waitFor(() => {
      expect(screen.getByText(/1개는 내용 분석 미지원\(메타데이터만 저장\): archive\.xyz/)).toBeInTheDocument();
    });
  });

  it("업로드한 파일을 목록에서 삭제한다", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <WorkspaceProvider>
          <FilesPage />
        </WorkspaceProvider>
      </MemoryRouter>,
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File([JSON.stringify([{ id: 1 }])], "delete-me.json", { type: "application/json" });

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: "delete-me.json 삭제" }));

    expect(confirm).toHaveBeenCalledWith("'delete-me.json' 파일과 관련 처리 결과를 모두 삭제할까요?");
    await waitFor(() => expect(screen.getByText("delete-me.json 파일을 삭제했습니다.")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "delete-me.json" })).not.toBeInTheDocument();
  });
});
