import { NavLink } from "react-router-dom";

export function CategoryTabs() {
  return (
    <nav className="tabs" aria-label="카테고리 메뉴">
      <NavLink to="/categories" end className={({ isActive }) => `tab${isActive ? " is-active" : ""}`}>
        체계
      </NavLink>
      <NavLink
        to="/categories/candidates"
        className={({ isActive }) => `tab${isActive ? " is-active" : ""}`}
      >
        신규 후보
      </NavLink>
    </nav>
  );
}
