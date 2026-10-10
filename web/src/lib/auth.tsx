// Session Firebase : invité automatique dès l'arrivée, puis compte par lien magique.
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "./firebase";

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false, error: null });

/** Session invité automatique : on peut jouer sans compte, dès l'arrivée. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false, error: null });
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ user, ready: true, error: null });
      } else {
        setState((s) => ({ ...s, user: null, ready: false }));
        signInAnonymously(auth).catch(() =>
          setState({ user: null, ready: false, error: "Impossible d'ouvrir une session. Les émulateurs Firebase sont-ils lancés ?" }),
        );
      }
    });
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
