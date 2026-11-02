// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSE_AFTER_MS, FLASH_MS, ProgressProvider, useProgress } from "./progress";

type Api = ReturnType<typeof useProgress>;
let api: Api;

function Capture() {
  const value = useProgress();
  useEffect(() => {
    api = value;
  });
  return null;
}

function setup() {
  render(
    <ProgressProvider>
      <Capture />
    </ProgressProvider>,
  );
}

describe("진행 팝업", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("고르는 즉시 떠서 단계가 바뀌는 대로 보여 주고, 모두 끝나면 버튼 없이 스스로 닫힌다", () => {
    setup();
    let key = "";
    act(() => {
      [key] = api.begin([{ name: "민원.csv" }]);
    });
    expect(screen.getByRole("dialog").textContent).toContain("파일 처리 중 (0/1 완료)");
    expect(screen.getByText("업로드").getAttribute("aria-current")).toBe("step");
    expect(screen.queryByRole("button")).toBeNull();

    act(() => api.update(key, { fileId: "f1", step: "analyzing", percent: 40 }));
    expect(screen.getByText("민원 분석 40%").getAttribute("aria-current")).toBe("step");

    act(() => api.update(key, { step: "done", detail: "민원 24건을 분석했습니다." }));
    expect(screen.getByRole("dialog").textContent).toContain("처리를 마쳤습니다");
    expect(screen.getByText("민원 24건을 분석했습니다.")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(CLOSE_AFTER_MS);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("여러 파일 중 하나라도 끝나지 않았으면 닫지 않는다", () => {
    setup();
    let keys: string[] = [];
    act(() => {
      keys = api.begin([{ name: "a.csv" }, { name: "b.pdf" }]);
    });
    act(() => api.update(keys[0], { step: "done" }));
    act(() => {
      vi.advanceTimersByTime(CLOSE_AFTER_MS * 2);
    });
    expect(screen.getByRole("dialog").textContent).toContain("1/2 완료");
  });

  it("완료 안내는 잠깐 보였다 사라진다", () => {
    setup();
    act(() => api.flash({ tone: "success", title: "후보 승인 · 카테고리 생성", message: "만들었습니다." }));
    expect(screen.getByRole("status").textContent).toContain("후보 승인");

    act(() => {
      vi.advanceTimersByTime(FLASH_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
