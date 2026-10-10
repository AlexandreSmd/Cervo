import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../components/Layout";
import { Loading } from "../components/States";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEV_TOOLS, EMULATOR_UI_URL } from "../lib/config";
import { auth } from "../lib/firebase";

const NAV = [
  { to: "/admin", label: "Tableau de bord", end: true },
  { to: "/admin/planning", label: "Planning" },
  { to: "/admin/questions", label: "Questions" },
  { to: "/admin/signalements", label: "Signalements" },
];

function Gate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const meta = useQuery({ queryKey: ["admin-meta", user?.uid], queryFn: () => api.admin.questions().then(() => true), enabled: ready && !!user, retry: false, staleTime: 60_000 });

  const devLogin = async () => {
    setBusy(true);
    const { token } = await api.dev.login("admin");
    await signInWithCustomToken(auth, token);
    qc.clear();
    setBusy(false);
  };

  if (!ready || meta.isLoading) return <Loading />;
  if (meta.error instanceof ApiError && [401, 403].includes(meta.error.status)) {
    return (
      <div className="mx-auto mt-24 max-w-sm space-y-4 rounded-3xl bg-card p-8 text-center">
        <Logo to="/" />
        <h1 className="text-2xl font-extrabold">Espace fondateur</h1>
        <p className="text-sm text-muted">Réservé aux comptes listés dans ADMIN_EMAILS.</p>
        {DEV_TOOLS && <button className="btn-dark w-full" disabled={busy} onClick={devLogin} data-testid="admin-dev-login">Se connecter (local)</button>}
        <Link to="/connexion" className="btn-ghost w-full">Se connecter par e-mail</Link>
      </div>
    );
  }
  return <>{children}</>;
}

function DevBox() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setMsg("…");
    try { await fn(); await qc.invalidateQueries(); setMsg(`${label} ✓`); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="space-y-1 rounded-2xl bg-ink/5 p-3 text-xs">
      <p className="font-bold uppercase tracking-wider text-muted">Local</p>
      <button className="block w-full rounded-lg px-2 py-1.5 text-left font-semibold hover:bg-ink/5" onClick={() => run("Joueurs simulés", api.dev.simulatePlayers)} data-testid="dev-simulate">Simuler des joueurs</button>
      <button className="block w-full rounded-lg px-2 py-1.5 text-left font-semibold hover:bg-ink/5" onClick={() => run("Historique ajouté", api.dev.seedHistory)} data-testid="dev-history">Historique fictif (mon compte)</button>
      <button className="block w-full rounded-lg px-2 py-1.5 text-left font-semibold hover:bg-ink/5" onClick={() => run("Quiz du jour remis à zéro", api.dev.replayToday)}>Rejouer mon quiz du jour</button>
      <a className="block rounded-lg px-2 py-1.5 font-semibold hover:bg-ink/5" href={EMULATOR_UI_URL} target="_blank" rel="noreferrer">Console des émulateurs ↗</a>
      {msg && <p className="px-2 text-muted" role="status">{msg}</p>}
    </div>
  );
}

/** Espace fondateur : barre latérale sur ordinateur, onglets en haut sur mobile. */
export function AdminLayout() {
  const { user } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    `block whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? "bg-ink text-bg" : "text-muted hover:bg-ink/5 hover:text-ink"}`;
  return (
    <Gate>
      <div className="min-h-screen lg:flex">
        <aside className="border-b border-line bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-5 py-4"><Logo to="/admin" /></div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0" aria-label="Admin">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.label}</NavLink>)}
          </nav>
          <div className="mt-auto hidden space-y-3 p-3 lg:block">
            {DEV_TOOLS && <DevBox />}
            <div className="px-2 text-xs text-muted">
              <p className="truncate">{user?.email}</p>
              <div className="mt-1 flex gap-3">
                <Link to="/" className="link">Voir le jeu</Link>
                <button className="link" onClick={() => signOut(auth)}>Déconnexion</button>
              </div>
            </div>
          </div>
        </aside>
        <main className="mx-auto w-full max-w-admin flex-1 p-4 sm:p-8"><Outlet /></main>
      </div>
    </Gate>
  );
}
