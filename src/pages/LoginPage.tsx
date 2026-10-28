import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../state/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^01[016789]\d{7,8}$/;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useSession();
  const [step, setStep] = useState<"account" | "password">("account");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  function onAccount(event: FormEvent) {
    event.preventDefault();
    const nextError = accountErrorFor(account);
    setAccountError(nextError);
    if (nextError) return;
    setStep("password");
  }

  function onPassword(event: FormEvent) {
    event.preventDefault();
    if (password.length === 0) {
      setPasswordError("비밀번호를 입력하세요.");
      return;
    }
    login();
    navigate("/");
  }

  return (
    <div className="signup">
      <div className="signup-layout">
        <section className="login-qr" aria-label="QR 코드 로그인">
          <div className="login-qr-frame">
            <QrArt />
          </div>
          <h1 className="login-qr-title">QR 코드로 로그인</h1>
          <p className="login-qr-copy">앱에서 스캔하면 이 브라우저로 로그인됩니다.</p>
        </section>

        <section className="signup-panel">
          {step === "account" ? (
            <form className="signup-card" onSubmit={onAccount} noValidate>
              <Link to="/" className="signup-brand">
                <Mark />
                <span>DATALENS</span>
              </Link>
              <p className="signup-welcome">로그인</p>
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
              <button type="submit" className="signup-submit">
                다음
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
          ) : (
            <form className="signup-card" onSubmit={onPassword} noValidate>
              <Link to="/" className="signup-brand">
                <Mark />
                <span>DATALENS</span>
              </Link>
              <p className="signup-welcome">비밀번호 입력</p>
              <p className="login-account">{account}</p>
              <button
                type="button"
                className="login-back"
                onClick={() => {
                  setStep("account");
                  setPassword("");
                  setPasswordError("");
                }}
              >
                다른 계정 사용
              </button>
              <label className="signup-field">
                <span>비밀번호</span>
                <input
                  className="signup-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  value={password}
                  aria-invalid={passwordError !== ""}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordError("");
                  }}
                />
              </label>
              {passwordError ? <p className="signup-error">{passwordError}</p> : null}
              <button type="submit" className="signup-submit">
                로그인
              </button>
            </form>
          )}
          <p className="signup-footer-links">
            계정이 없으신가요? <Link to="/signup">회원가입</Link>
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

function QrArt() {
  const cells = [
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
    [1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
  ];
  return (
    <svg className="login-qr-art" viewBox="0 0 13 13" aria-hidden="true">
      {cells.flatMap((row, y) =>
        row.map((cell, x) => (cell ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)),
      )}
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
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
