import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { AppError } from "../api/AppError";

type BoundaryState = { error: Error | null };

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  /** 렌더링 중 발생한 오류를 경계 상태에 저장합니다. */
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  /** 개발자 콘솔에 컴포넌트 스택을 기록합니다. */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Route rendering failed", error, info.componentStack);
  }

  /** 오류가 없으면 하위 라우트를, 오류가 있으면 복구 안내를 표시합니다. */
  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const code = error instanceof AppError ? error.code : "UNEXPECTED_ERROR";
    return (
      <main className="shell-main">
        <section className="card error-card" role="alert">
          <p className="eyebrow">화면 오류</p>
          <h1 className="display-sm">요청한 화면을 표시하지 못했습니다</h1>
          <p className="error-code num">{code}</p>
          <p className="body notice">{error.message || "잠시 후 다시 시도해 주세요."}</p>
          <Link className="btn btn-primary" to="/">대시보드로 이동</Link>
        </section>
      </main>
    );
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}
