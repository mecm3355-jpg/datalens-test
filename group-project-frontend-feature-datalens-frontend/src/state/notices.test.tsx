// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { NoticeProvider, useNotices } from "./notices";

function Trigger() {
  const { notify } = useNotices();
  useEffect(() => {
    notify({ tone: "info", title: "첫 안내", message: "하나" });
    notify({
      tone: "success",
      title: "둘째 안내",
      message: "둘",
      link: { to: "/categories/candidates", label: "후보 승인하러 가기" },
    });
  }, [notify]);
  return null;
}

describe("안내 팝업", () => {
  afterEach(cleanup);

  it("한 번에 하나씩 띄우고, 확인하면 다음 안내, 이동 버튼은 그 화면으로 보낸다", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <NoticeProvider>
          <Routes>
            <Route path="/" element={<Trigger />} />
            <Route path="/categories/candidates" element={<p>후보 화면</p>} />
          </Routes>
        </NoticeProvider>
      </MemoryRouter>,
    );

    expect((await screen.findByRole("dialog")).textContent).toContain("첫 안내");
    expect(screen.getByText("안내 1개가 더 있습니다.")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "확인" })));
    expect(screen.getByRole("dialog").textContent).toContain("둘째 안내");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "후보 승인하러 가기" })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("후보 화면")).toBeTruthy();
  });

  it("Esc로 닫는다", async () => {
    render(
      <MemoryRouter>
        <NoticeProvider>
          <Trigger />
        </NoticeProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("dialog");

    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));
    expect(screen.getByRole("dialog").textContent).toContain("둘째 안내");
  });
});
