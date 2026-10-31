import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopNav } from "./TopNav";

vi.mock("../state/session", () => ({
  useSession: () => ({ loggedIn: true, logout: vi.fn(), user: { displayName: "테스트", role: "user" } }),
}));

describe("위쪽 메뉴", () => {
  afterEach(cleanup);

  it("민원 결과 화면으로 가는 링크를 보여 준다", () => {
    render(<MemoryRouter><TopNav /></MemoryRouter>);

    for (const [name, href] of [
      ["민원", "/complaints"],
      ["카테고리", "/categories"],
      ["검토", "/reviews"],
      ["이슈", "/issues"],
    ]) {
      expect(screen.getAllByRole("link", { name })[0].getAttribute("href")).toBe(href);
    }
  });
});
