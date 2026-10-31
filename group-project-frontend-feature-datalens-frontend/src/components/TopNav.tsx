import { useState } from "react";
import { Link, NavLink } from "react-router";
import { useSession } from "../state/session";

const links = [
  { to: "/", label: "대시보드", end: true },
  { to: "/files", label: "파일", end: false },
  { to: "/complaints", label: "민원", end: false },
  { to: "/categories", label: "카테고리", end: false },
  { to: "/reviews", label: "검토", end: true },
  { to: "/issues", label: "이슈", end: false },
  { to: "/data", label: "분석 리포트", end: true },
  { to: "/about", label: "서비스 소개", end: true },
];

export function TopNav() {
  const { loggedIn, logout, user } = useSession();
  const [open, setOpen] = useState(false);

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
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
          {!loggedIn ? (
            <div className="mobile-auth">
              <Link to="/login" className="btn btn-secondary" onClick={() => setOpen(false)}>로그인</Link>
              <Link to="/signup" className="btn btn-primary" onClick={() => setOpen(false)}>회원가입</Link>
            </div>
          ) : null}
        </nav>
        <div className="nav-tools">
          {loggedIn ? (
            <>
              {user ? <span className="nav-user" title={user.email}>{user.displayName}</span> : null}
              <button type="button" className="btn btn-nav-logout" onClick={() => void logout()}>
                로그아웃
              </button>
            </>
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
