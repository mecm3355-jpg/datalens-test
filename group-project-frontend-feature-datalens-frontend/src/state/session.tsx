import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppError } from "../api/AppError";
import { datalensApi, type AuthUser } from "../api/datalens";

type SessionValue = {
  loggedIn: boolean;
  loading: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);
const API_MODE = import.meta.env.VITE_DATA_MODE === "api";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(!API_MODE);
  const [loading, setLoading] = useState(API_MODE);
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    if (!API_MODE) return;
    let active = true;
    void datalensApi.session()
      .then((session) => {
        if (!active) return;
        setLoggedIn(session.authenticated);
        setUser(session.user);
      })
      .catch(() => {
        if (!active) return;
        setLoggedIn(false);
        setUser(null);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const value = useMemo(
    () => ({
      loggedIn,
      loading,
      user,
      login: async (email: string, password: string) => {
        if (API_MODE) setUser(await datalensApi.login(email, password));
        setLoggedIn(true);
      },
      signup: async (email: string, displayName: string, password: string) => {
        if (API_MODE) setUser(await datalensApi.signup(email, displayName, password));
        setLoggedIn(true);
      },
      logout: async () => {
        try {
          if (API_MODE) await datalensApi.logout();
        } finally {
          setLoggedIn(false);
          setUser(null);
        }
      },
    }),
    [loading, loggedIn, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new AppError("SESSION_PROVIDER_MISSING", "SessionProvider가 필요합니다.");
  }
  return value;
}
