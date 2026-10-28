import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceProvider } from "../state/workspace";
import { FilesPage } from "./FilesPage";

describe("FilesPage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("다중 파일 선택과 지원 형식 안내를 제공한다", () => {
    render(
      <MemoryRouter>
        <WorkspaceProvider>
          <FilesPage />
        </WorkspaceProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "파일" })).toBeInTheDocument();
    expect(screen.getByText(/CSV, JSON, TXT, LOG, JPG, PNG/)).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("2개 파일을 업로드 대기열에 추가했습니다.")).toBeInTheDocument());
    await waitFor(() => {
      const progress = screen.getAllByRole("progressbar");
      expect(progress).toHaveLength(2);
      expect(progress.every((item) => item.getAttribute("aria-valuenow") === "100")).toBe(true);
    }, { timeout: 3000 });
  });
});
