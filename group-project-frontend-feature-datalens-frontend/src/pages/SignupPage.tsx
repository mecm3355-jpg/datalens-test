import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "../state/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await signup(email.trim(), displayName.trim(), password);
      navigate("/", { replace: true });
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "회원가입하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function validate() {
    if (displayName.trim().length < 2) return "이름을 2자 이상 입력하세요.";
    if (!EMAIL_PATTERN.test(email.trim())) return "이메일 형식을 확인해 주세요.";
    if (password.length < 10 || !/[A-Za-z가-힣]/u.test(password) || !/\d/u.test(password)) {
      return "비밀번호는 문자와 숫자를 포함해 10자 이상이어야 합니다.";
    }
    if (password !== confirmation) return "비밀번호 확인이 일치하지 않습니다.";
    if (!agreed) return "개인정보 처리 안내에 동의해야 가입할 수 있습니다.";
    return "";
  }

  const clearError = () => setError("");

  return (
    <main className="signup">
      <div className="signup-layout">
        <section className="signup-promo" aria-label="가입 안내">
          <h1 className="signup-hero">
            <span className="signup-hero-line">내 데이터는</span>
            <span className="signup-hero-line"><span className="signup-hero-accent">내 계정에서만</span></span>
          </h1>
          <p className="body">업로드한 파일과 정제 결과는 계정별로 분리해 관리합니다.</p>
        </section>
        <section className="signup-panel">
          <form className="signup-card" onSubmit={onSubmit} noValidate>
            <Link to="/" className="signup-brand"><Mark /><span>DATALENS</span></Link>
            <h1 className="signup-welcome">회원가입</h1>
            <label className="signup-field">
              <span>이름</span>
              <input className="signup-input" autoComplete="name" value={displayName} onChange={(event) => { setDisplayName(event.target.value); clearError(); }} />
            </label>
            <label className="signup-field">
              <span>이메일</span>
              <input className="signup-input" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); clearError(); }} />
            </label>
            <label className="signup-field">
              <span>비밀번호</span>
              <input className="signup-input" type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); clearError(); }} />
            </label>
            <label className="signup-field">
              <span>비밀번호 확인</span>
              <input className="signup-input" type="password" autoComplete="new-password" value={confirmation} aria-invalid={error !== ""} onChange={(event) => { setConfirmation(event.target.value); clearError(); }} />
            </label>
            <label className="signup-terms">
              <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); clearError(); }} />
              <span>계정 정보와 업로드 파일 처리에 관한 개인정보 처리 안내에 동의합니다.</span>
            </label>
            {error ? <p className="signup-error" role="alert">{error}</p> : null}
            <button type="submit" className="signup-submit" disabled={submitting}>
              {submitting ? "계정 생성 중…" : "회원가입"}
            </button>
            <p className="signup-footer-links">이미 계정이 있나요? <Link to="/login">로그인</Link></p>
          </form>
        </section>
      </div>
    </main>
  );
}

function Mark() {
  return <span className="signup-mark" aria-hidden="true"><i /><i /><i /></span>;
}
