import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "../state/session";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 모두 입력하세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup">
      <section className="signup-panel">
        <form className="signup-card" onSubmit={onSubmit} noValidate>
          <Link to="/" className="signup-brand">
            <Mark />
            <span>DATALENS</span>
          </Link>
          <h1 className="signup-welcome">로그인</h1>
          <p className="body">가입한 계정으로 파일과 정제 결과를 안전하게 관리하세요.</p>
          <label className="signup-field">
            <span>이메일</span>
            <input
              className="signup-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
            />
          </label>
          <label className="signup-field">
            <span>비밀번호</span>
            <input
              className="signup-input"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={error !== ""}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
            />
          </label>
          {error ? <p className="signup-error" role="alert">{error}</p> : null}
          <button type="submit" className="signup-submit" disabled={submitting}>
            {submitting ? "로그인 중…" : "로그인"}
          </button>
          <p className="signup-footer-links">
            <Link to="/forgot-password">비밀번호를 잊으셨나요?</Link>
            <span> · </span>
            <Link to="/signup">회원가입</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

function Mark() {
  return (
    <span className="signup-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
