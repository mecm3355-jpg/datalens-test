import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { datalensApi } from "../api/datalens";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("가입한 이메일을 입력하세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const token = await datalensApi.requestPasswordReset(email.trim());
      if (token) {
        navigate(`/reset-password?token=${encodeURIComponent(token)}`);
        return;
      }
      setMessage("가입된 이메일이면 비밀번호 재설정 안내를 전송했습니다. 받은편지함을 확인해 주세요.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "요청을 처리하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup">
      <section className="signup-panel">
        <form className="signup-card" onSubmit={onSubmit} noValidate>
          <Link to="/login" className="signup-brand">DATALENS</Link>
          <h1 className="signup-welcome">비밀번호 재설정</h1>
          <p className="body">가입한 이메일로 재설정 요청을 접수합니다.</p>
          <label className="signup-field">
            <span>이메일</span>
            <input className="signup-input" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} />
          </label>
          {error ? <p className="signup-error" role="alert">{error}</p> : null}
          {message ? <p className="notice" role="status">{message}</p> : null}
          <button type="submit" className="signup-submit" disabled={submitting}>
            {submitting ? "요청 중…" : "재설정 요청"}
          </button>
          <p className="signup-footer-links"><Link to="/login">로그인으로 돌아가기</Link></p>
        </form>
      </section>
    </main>
  );
}
