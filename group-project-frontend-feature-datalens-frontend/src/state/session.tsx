import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "../lib/api";
import type { AuthUser } from "../lib/api";

type SessionValue = {
  // 처음 세션을 확인하는 동안 true. 그동안 로그인 화면으로 보내지 않는다
  loading: boolean;
  loggedIn: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/** 서버 로그인 세션(쿠키)을 화면 상태로 연결합니다. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .loadSession()
      .then((next) => {
        if (!cancelled) setUser(next);
      })
      // 세션 확인이 실패하면 로그인하지 않은 것으로 보고 로그인 화면에서 다시 시도하게 한다
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password));
  }, []);
  const signup = useCallback(async (email: string, displayName: string, password: string) => {
    setUser(await api.signup(email, displayName, password));
  }, []);
  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ loading, loggedIn: user !== null, user, login, signup, logout }),
    [loading, user, login, signup, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("세션이 없습니다.");
  }
  return value;
}
