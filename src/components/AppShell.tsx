import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";

export function AppShell() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <TopNav />
      <main id="main" className="shell-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
