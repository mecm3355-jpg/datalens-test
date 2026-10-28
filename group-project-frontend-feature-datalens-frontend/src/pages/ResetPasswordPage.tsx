import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { datalensApi } from "../api/datalens";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError("재설정 토큰이 없습니다. 재설정 요청부터 다시 진행해 주세요.");
      return;
    }
    if (password.length < 10 || !/[A-Za-z가-힣]/u.test(password) || !/\d/u.test(password)) {
      setError("비밀번호는 문자와 숫자를 포함해 10자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmation) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await datalensApi.resetPassword(token, password);
      navigate("/login", { replace: true });
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup">
      <section className="signup-panel">
        <form className="signup-card" onSubmit={onSubmit} noValidate>
          <Link to="/login" className="signup-brand">DATALENS</Link>
          <h1 className="signup-welcome">새 비밀번호 설정</h1>
          <label className="signup-field">
            <span>새 비밀번호</span>
            <input className="signup-input" type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
          </label>
          <label className="signup-field">
            <span>새 비밀번호 확인</span>
            <input className="signup-input" type="password" autoComplete="new-password" value={confirmation} aria-invalid={error !== ""} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} />
          </label>
          {error ? <p className="signup-error" role="alert">{error}</p> : null}
          <button type="submit" className="signup-submit" disabled={submitting}>
            {submitting ? "변경 중…" : "비밀번호 변경"}
          </button>
        </form>
      </section>
    </main>
  );
}
