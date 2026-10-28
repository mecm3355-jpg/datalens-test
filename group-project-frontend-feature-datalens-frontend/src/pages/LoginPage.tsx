import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../state/session";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("접근 비밀번호를 입력하세요.");
      return;
    }
    setSubmitting(true);
    try {
      await login(password);
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
          <div className="signup-brand">
            <Mark />
            <span>DATALENS</span>
          </div>
          <h1 className="signup-welcome">운영자 로그인</h1>
          <p className="body">배포 환경에 등록한 접근 비밀번호를 입력하세요.</p>
          <label className="signup-field">
            <span>접근 비밀번호</span>
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
            {submitting ? "확인 중…" : "로그인"}
          </button>
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
