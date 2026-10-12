// Session Firebase : invité automatique dès l'arrivée, puis compte par lien magique ou Google.
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { forgetOtherUsers } from "./cache";
import { USE_EMULATOR } from "./config";
import { auth } from "./firebase";

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false, error: null });

// Au-delà, on affiche un message avec « Réessayer » plutôt qu'un chargement sans fin.
const SESSION_TIMEOUT_MS = 12_000;

const SESSION_ERROR = USE_EMULATOR
  ? "Impossible d'ouvrir une session. Les émulateurs Firebase sont-ils lancés ?"
  : "Impossible d'ouvrir une session. Vérifie ta connexion internet, puis réessaie.";

/** Session invité automatique : on peut jouer sans compte, dès l'arrivée. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false, error: null });
  useEffect(() => {
    const watchdog = window.setTimeout(() => setState((s) => (s.ready ? s : { ...s, error: SESSION_ERROR })), SESSION_TIMEOUT_MS);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        window.clearTimeout(watchdog);
        forgetOtherUsers(user.uid);
        setState({ user, ready: true, error: null });
      } else {
        setState((s) => ({ ...s, user: null, ready: false }));
        signInAnonymously(auth).catch(() => setState({ user: null, ready: false, error: SESSION_ERROR }));
      }
    });
    return () => {
      window.clearTimeout(watchdog);
      unsubscribe();
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
