import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const quickLinks = [
  { to: "/", label: "대시보드" },
  { to: "/files", label: "파일" },
  { to: "/categories", label: "카테고리" },
  { to: "/reviews", label: "검토" },
  { to: "/issues", label: "이슈" },
  { to: "/complaints", label: "민원" },
  { to: "/data", label: "데이터" },
];

const communityLinks: { label: string; to?: string }[] = [
  { label: "DataLens 소개", to: "/about" },
  { label: "보도자료 및 뉴스" },
  { label: "자주 묻는 질문" },
  { label: "개인정보 처리방침" },
  { label: "이용약관" },
];

function focusPageTop() {
  window.scrollTo(0, 0);
  const heading = document.querySelector("#main h1");
  if (!(heading instanceof HTMLElement)) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

export function Footer() {
  const location = useLocation();
  const shouldFocusTop = useRef(false);

  useEffect(() => {
    if (!shouldFocusTop.current) return;
    shouldFocusTop.current = false;
    focusPageTop();
  }, [location.pathname, location.search, location.hash]);

  function handleNavigate(to: string) {
    const url = new URL(to, window.location.origin);
    const samePage =
      url.pathname === location.pathname &&
      url.search === location.search &&
      url.hash === location.hash;
    if (samePage) {
      focusPageTop();
      return;
    }
    shouldFocusTop.current = true;
  }

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <p className="footer-logo">DataLens</p>
            <p className="footer-desc">
              데이터렌즈는 민원 동향과 카테고리를 한 화면에서 보고 정리할 수 있게 만든 분석
              화면입니다.
            </p>
            <div className="footer-social" aria-label="소셜 미디어">
              <SocialButton label="Facebook">
                <FacebookIcon />
              </SocialButton>
              <SocialButton label="Instagram">
                <InstagramIcon />
              </SocialButton>
              <SocialButton label="X">
                <XIcon />
              </SocialButton>
              <SocialButton label="LinkedIn">
                <LinkedInIcon />
              </SocialButton>
              <SocialButton label="YouTube">
                <YouTubeIcon />
              </SocialButton>
            </div>
          </div>

          <nav className="footer-col" aria-label="빠른 링크">
            <p className="footer-title">빠른 링크</p>
            <ul className="footer-links">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} onClick={() => handleNavigate(link.to)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="footer-col" aria-label="커뮤니티">
            <p className="footer-title">커뮤니티</p>
            <ul className="footer-links">
              {communityLinks.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link to={link.to} onClick={() => handleNavigate(link.to!)}>
                      {link.label}
                    </Link>
                  ) : (
                    <button type="button">{link.label}</button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer-stores">
            <button type="button" className="store-badge">
              <AppleIcon />
              <span>
                <span className="store-kicker">Download on the</span>
                <span className="store-name">App Store</span>
              </span>
            </button>
            <button type="button" className="store-badge">
              <PlayIcon />
              <span>
                <span className="store-kicker">GET IT ON</span>
                <span className="store-name">Google Play</span>
              </span>
            </button>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 DataLens All rights reserved.</p>
          <label className="footer-lang">
            <KoreanFlag />
            <select aria-label="언어" defaultValue="ko">
              <option value="ko">한국어</option>
            </select>
          </label>
        </div>
      </div>
    </footer>
  );
}

function SocialButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button type="button" className="footer-social-btn" aria-label={label}>
      {children}
    </button>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.5 8.5V6.8c0-.7.5-1.1 1.2-1.1H17V3h-2.1C12.4 3 11 4.5 11 6.7v1.8H9v2.7h2V21h2.8v-9.8h2.2l.4-2.7h-2.6z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.7 4h2.4l-5.3 6.1L20.2 20h-4.7l-3.7-4.8L7.6 20H5.2l5.7-6.5L4 4h4.8l3.3 4.4L16.7 4zm-.8 14.4h1.3L8.2 5.5H6.8l9.1 12.9z"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.7 9.4H4.2V20h2.5V9.4zM5.4 4C4.5 4 3.8 4.7 3.8 5.6s.7 1.6 1.6 1.6 1.6-.7 1.6-1.6S6.3 4 5.4 4zM20.2 20h-2.5v-5.6c0-1.6-.6-2.6-2-2.6-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1.9V20h-2.5s.1-9.2 0-10.2h2.5v1.5c.3-.5 1.2-1.7 3.1-1.7 2.2 0 3.9 1.5 3.9 4.6V20z"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 8.2a2.5 2.5 0 0 0-1.8-1.8C18.2 6 12 6 12 6s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 3.8 2.5 2.5 0 0 0 1.8 1.8C5.8 18 12 18 12 18s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-3.8zM10.2 15.1V8.9L15.6 12l-5.4 3.1z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.4 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.9-.8c-1.5 0-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7 1.9-1.1 2.6-2.1c.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.2-.8-2.2-3.6zM14.7 6.6c.6-.7 1-1.7.9-2.6-.9 0-1.9.6-2.5 1.3-.6.6-1.1 1.6-.9 2.5 1 .1 1.9-.5 2.5-1.2z"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#34a853" d="M3.4 20.6 13.2 12 3.4 3.4v17.2z" />
      <path fill="#fbbc04" d="m13.2 12 3.3 3.1-10.7 6.1L13.2 12z" />
      <path fill="#ea4335" d="m16.5 8.9-3.3 3.1L5.8 2.8l10.7 6.1z" />
      <path fill="#4285f4" d="M20.6 10.7c.6.4.6 1.2 0 1.6l-3.1 1.8-3.3-2.1 3.3-2.1 3.1 1.8z" />
    </svg>
  );
}

function KoreanFlag() {
  return (
    <svg className="footer-flag" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="#fff" />
      <path fill="#cd2e3a" d="M8 3.2a4.8 4.8 0 0 1 0 9.6 2.4 2.4 0 0 1 0-4.8 2.4 2.4 0 0 0 0-4.8z" />
      <path fill="#0047a0" d="M8 3.2a2.4 2.4 0 0 1 0 4.8 2.4 2.4 0 0 1 0 4.8 4.8 4.8 0 0 1 0-9.6z" />
    </svg>
  );
}
