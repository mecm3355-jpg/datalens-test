import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useSession } from "../state/session";

const links = [
  { to: "/", label: "대시보드", end: true },
  { to: "/files", label: "파일", end: false },
  { to: "/categories", label: "카테고리", end: false },
  { to: "/reviews", label: "검토", end: false },
  { to: "/issues", label: "이슈", end: false },
  { to: "/complaints", label: "민원", end: false },
  { to: "/data", label: "데이터", end: true },
];

export function TopNav() {
  const location = useLocation();
  const { loggedIn, logout } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className={open ? "top-nav is-open" : "top-nav"}>
      <div className="top-nav-bar">
        <NavLink to="/" className="brand" end>
          <span className="wordmark">DATALENS</span>
        </NavLink>
        <nav id="primary-nav" className="nav-links" aria-label="주요 메뉴">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-tools">
          {loggedIn ? (
            <button type="button" className="btn btn-nav-logout" onClick={logout}>
              로그아웃
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-nav-login">
                로그인
              </Link>
              <Link to="/signup" className="btn btn-nav-signup">
                회원가입
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary nav-toggle"
            aria-expanded={open}
            aria-controls="primary-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "닫기" : "메뉴"}
          </button>
        </div>
      </div>
    </header>
  );
}
