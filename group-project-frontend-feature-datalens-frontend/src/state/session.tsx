import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppError } from "../api/AppError";
import { datalensApi } from "../api/datalens";

type SessionValue = {
  loggedIn: boolean;
  loading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);
const API_MODE = import.meta.env.VITE_DATA_MODE === "api";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(!API_MODE);
  const [loading, setLoading] = useState(API_MODE);
  useEffect(() => {
    if (!API_MODE) return;
    let active = true;
    void datalensApi.session()
      .then((authenticated) => { if (active) setLoggedIn(authenticated); })
      .catch(() => { if (active) setLoggedIn(false); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const value = useMemo(
    () => ({
      loggedIn,
      loading,
      login: async (password: string) => {
        if (API_MODE) await datalensApi.login(password);
        setLoggedIn(true);
      },
      logout: async () => {
        try {
          if (API_MODE) await datalensApi.logout();
        } finally {
          setLoggedIn(false);
        }
      },
    }),
    [loading, loggedIn],
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
