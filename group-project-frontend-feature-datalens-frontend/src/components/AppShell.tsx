import { Outlet, useLocation } from "react-router-dom";
import { useCatalog } from "../state/catalog";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";

export function AppShell() {
  const { pathname } = useLocation();
  const { status, error, busy, truncated } = useCatalog();
  const banner = pathname === "/" && error === "요청 실패 (500)" ? "파일 업로드" : error;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <TopNav />
      <main id="main" className="shell-main">
        {status === "loading" ? <p className="notice banner">서버에서 데이터를 불러오는 중입니다.</p> : null}
        {busy ? <p className="notice banner">서버에 반영하는 중입니다.</p> : null}
        {banner ? <p className="notice banner">{banner}</p> : null}
        {truncated ? <p className="notice banner">민원은 최근 2,000건까지 불러왔습니다.</p> : null}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
