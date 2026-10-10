import { useQueryClient } from "@tanstack/react-query";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { EMULATOR_UI_URL } from "../lib/config";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";

/** Outils de développement, visibles seulement si VITE_DEV_TOOLS=true (local). */
export function DevTools() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const run = async (label: string, fn: () => Promise<unknown>, go?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await qc.invalidateQueries();
      setMessage(`${label} : fait.`);
      if (go) navigate(go);
    } catch (err) {
      setMessage(`${label} : ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const login = (role: "demo" | "admin") => async () => {
    const { token } = await api.dev.login(role);
    await signInWithCustomToken(auth, token);
    qc.clear();
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 text-sm">
      {open && (
        <div className="card mb-2 w-72 space-y-2 p-4 shadow-xl" role="dialog" aria-label="Outils de développement">
          <p className="font-display font-bold">Outils de dev <span className="text-xs font-normal text-muted">(local uniquement)</span></p>
          <p className="truncate text-xs text-muted">Session : {user?.isAnonymous ? "invité" : user?.email ?? "…"}</p>
          <button className="btn-soft w-full py-2" disabled={busy} onClick={() => run("Connexion démo", login("demo"), "/profil")}>Connexion démo</button>
          <button className="btn-soft w-full py-2" disabled={busy} onClick={() => run("Connexion admin", login("admin"), "/admin")}>Connexion admin</button>
          <button className="btn-soft w-full py-2" disabled={busy} onClick={() => run("Rejouer le quiz du jour", api.dev.replayToday, "/")}>Rejouer le quiz du jour</button>
          <button className="btn-soft w-full py-2" disabled={busy} onClick={() => run("Historique fictif", api.dev.seedHistory, "/profil")}>Ajouter 3 semaines d'historique</button>
          <button className="btn-ghost w-full py-2" disabled={busy} onClick={() => run("Nouvelle session invité", () => signOut(auth), "/")}>Nouvelle session invité</button>
          <a className="link block text-center text-xs" href={EMULATOR_UI_URL} target="_blank" rel="noreferrer">Console des émulateurs ↗</a>
          {message && <p className="text-xs text-muted" role="status">{message}</p>}
        </div>
      )}
      <button className="btn rounded-full bg-ink px-4 py-2 text-bg shadow-lg" onClick={() => setOpen(!open)} aria-expanded={open}>
        🛠 Dev
      </button>
    </div>
  );
}
