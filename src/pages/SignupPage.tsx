import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../state/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^01[016789]\d{7,8}$/;

export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useSession();
  const [account, setAccount] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [termsError, setTermsError] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextAccountError = accountErrorFor(account);
    const nextTermsError = agreed ? "" : "약관에 동의해야 가입할 수 있습니다.";
    setAccountError(nextAccountError);
    setTermsError(nextTermsError);
    if (nextAccountError || nextTermsError) return;
    login();
    navigate("/");
  }

  return (
    <div className="signup">
      <div className="signup-layout">
        <section className="signup-promo" aria-label="가입 안내">
          <h1 className="signup-hero">
            <span className="signup-hero-line">
              한눈에 보는 <span className="signup-hero-accent">민원 동향</span>
            </span>
            <span className="signup-hero-line">분석 시작</span>
          </h1>
          <PromoArt />
          <ul className="signup-stats">
            <li>
              <StatIcon kind="users" />
              <span>대표 민원과 속성 6종을 한 화면에서 봅니다.</span>
            </li>
            <li>
              <StatIcon kind="rank" />
              <span>카테고리별 건수와 전월 대비 증감</span>
            </li>
            <li>
              <StatIcon kind="fund" />
              <span>샘플 데이터로 바로 둘러볼 수 있습니다.</span>
            </li>
          </ul>
        </section>

        <section className="signup-panel">
          <form className="signup-card" onSubmit={onSubmit} noValidate>
            <Link to="/" className="signup-brand">
              <Mark />
              <span>DATALENS</span>
            </Link>
            <p className="signup-welcome">DATALENS에 오신 것을 환영합니다</p>

            <label className="signup-field">
              <span>이메일/전화번호</span>
              <input
                className="signup-input"
                type="text"
                autoComplete="username"
                placeholder="이메일/전화번호 (국가번호 제외)"
                value={account}
                aria-invalid={accountError !== ""}
                onChange={(event) => {
                  setAccount(event.target.value);
                  setAccountError("");
                }}
              />
            </label>
            {accountError ? <p className="signup-error">{accountError}</p> : null}

            <label className="signup-terms">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => {
                  setAgreed(event.target.checked);
                  setTermsError("");
                }}
              />
              <span>
                계정을 생성함으로써 저는 DataLens의 <a href="#terms">이용약관</a>에 동의합니다.{" "}
                <a href="#privacy">개인정보 보호 고지</a>.
              </span>
            </label>
            {termsError ? <p className="signup-error">{termsError}</p> : null}

            <button type="submit" className="signup-submit">
              등록하다
            </button>

            <div className="signup-or" role="separator">
              <span>또는</span>
            </div>

            <div className="signup-socials">
              <SocialButton name="Google에서 계속 진행" icon={<GoogleIcon />} />
              <SocialButton name="Apple에서 계속하세요" icon={<AppleIcon />} />
              <SocialButton name="텔레그램으로 계속하세요" icon={<TelegramIcon />} />
            </div>
          </form>
          <p className="signup-footer-links">
            <a href="#corporate">법인으로 등록하세요</a>
            <span> 또는 </span>
            <Link to="/login">로그인</Link>
          </p>
        </section>
      </div>
      <nav className="signup-bottom" aria-label="하단 메뉴">
        <Link to="/">메인</Link>
        <button type="button">메뉴1</button>
        <button type="button">메뉴2</button>
      </nav>
    </div>
  );
}

function accountErrorFor(account: string) {
  const value = account.trim();
  if (value.length === 0) return "이메일 또는 휴대폰 번호를 입력하세요.";
  if (value.includes("@")) return EMAIL_PATTERN.test(value) ? "" : "이메일 형식을 확인해 주세요.";
  const digits = value.replace(/[^\d]/g, "");
  if (PHONE_PATTERN.test(digits)) return "";
  return "이메일 또는 휴대폰 번호를 확인해 주세요.";
}

function SocialButton({ name, icon }: { name: string; icon: ReactNode }) {
  return (
    <button type="button" className="signup-social">
      <span className="signup-social-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{name}</span>
    </button>
  );
}

function Mark() {
  return (
    <svg className="signup-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2 14.8 9.2 22 12 14.8 14.8 12 22 9.2 14.8 2 12 9.2 9.2 12 2Z" />
    </svg>
  );
}

function PromoArt() {
  return (
    <svg className="signup-art" viewBox="0 0 220 180" role="img" aria-label="가입 안내 그림">
      <rect x="58" y="78" width="104" height="70" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M58 96h104" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M78 54h64l12 24H66l12-24Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M96 54c6 10 22 10 28 0" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="110" cy="124" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M110 116v10M106 122h8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="150" y="46" width="36" height="28" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M159 60l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatIcon({ kind }: { kind: "users" | "rank" | "fund" }) {
  const path =
    kind === "users"
      ? "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1.5c-2.8 0-5 1.4-5 3.2V17h10v-1.3c0-1.8-2.2-3.2-5-3.2Zm7-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm1.2 1.4c-.4 0-.8 0-1.2.1 1.3.8 2.2 1.9 2.2 3.2V17H20v-1.3c0-1.6-1.6-2.8-3.8-3.3Z"
      : kind === "rank"
        ? "M4 16V8h3v8H4Zm5 0V4h3v12H9Zm5 0v-6h3v6h-3Z"
        : "M10 3 4 6v5c0 4 2.6 6.6 6 8 3.4-1.4 6-4 6-8V6l-6-3Zm-1 9.2-2.2-2.2 1-1 1.2 1.2 2.6-2.6 1 1-3.6 3.6Z";
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor" d={path} />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-0.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6.1 12 6.1Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.4 12.7c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.9-.8c-1.5 0-2.9.9-3.6 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7 1.9-1.1 2.6-2.1c.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.2-.8-2.2-3.8Zm-2-7.1c.6-.7 1-1.7.9-2.6-.9 0-1.9.6-2.5 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.3Z"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#2AABEE" d="M21.5 4.4 18.2 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6.2 13.1 1.3 11.6c-1.1-.3-1.1-1.1.2-1.6L20.2 3.2c.9-.3 1.6.2 1.3 1.2Z" />
    </svg>
  );
}
