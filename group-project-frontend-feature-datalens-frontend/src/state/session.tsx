import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { AppError } from "../api/AppError";

type SessionValue = {
  loggedIn: boolean;
  login: () => void;
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const value = useMemo(
    () => ({
      loggedIn,
      login: () => setLoggedIn(true),
      logout: () => setLoggedIn(false),
    }),
    [loggedIn],
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
