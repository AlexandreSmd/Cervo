// Cadre de l'interface joueur : barre du haut, onglets en bas sur mobile.
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { APP_NAME } from "../lib/config";

/** Le logo : un cerveau en deux hémisphères (violet, vert) et une étincelle (orange). */
export function BrainMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path
        d="M19 31V10.5a5 5 0 0 0-9.4-2.4A5.2 5.2 0 0 0 5.8 15a5.6 5.6 0 0 0 .9 9.4A5 5 0 0 0 12.5 31a4.6 4.6 0 0 0 6.5 0Z"
        fill="#5B4BFF"
      />
      <path
        d="M21 31V10.5a5 5 0 0 1 9.4-2.4 5.2 5.2 0 0 1 3.8 6.9 5.6 5.6 0 0 1-.9 9.4A5 5 0 0 1 27.5 31a4.6 4.6 0 0 1-6.5 0Z"
        fill="#1FA971"
      />
      <circle cx="20" cy="36" r="2.4" fill="#F2A33A" />
    </svg>
  );
}

/** En haut à droite : « Se connecter » pour un invité, sinon l'initiale du compte (vers le profil). */
function AccountButton() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.isAnonymous) {
    return (
      <Link to="/connexion" className="btn-ghost btn-sm bg-card" data-testid="header-login">
        Se connecter
      </Link>
    );
  }
  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  return (
    <Link
      to="/profil"
      aria-label="Mon profil"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-display font-extrabold text-white"
    >
      {initial}
    </Link>
  );
}

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
      aria-label={`${APP_NAME}, accueil`}
    >
      <BrainMark />
      <span className="whitespace-nowrap font-display text-xl font-extrabold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

/** Bandeau quand le téléphone perd le réseau (il disparaît dès le retour de la connexion). */
function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="bg-ink px-5 py-2 text-center text-sm font-semibold text-bg" role="status" data-testid="offline">
      Pas de réseau. Ta partie est gardée : reprends dès que la connexion revient.
    </div>
  );
}

const TABS = [
  { to: "/", label: "Jouer", icon: "M8 5.14v13.72a1 1 0 0 0 1.52.85l10.98-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" },
  { to: "/profil", label: "Profil", icon: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.24-8 5v1h16v-1c0-2.76-3.6-5-8-5Z" },
];

/** Interface joueur : barre du haut minimale, onglets en bas sur mobile. */
export function Layout({ children }: { children: ReactNode }) {
  // Pendant le quiz, pas d'onglets en bas : toute la place pour la question.
  const path = useLocation().pathname;
  const playing = path === "/jouer";
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition sm:flex-none sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-sm ${
      isActive ? "text-ink sm:bg-ink/5" : "text-muted hover:text-ink"
    }`;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-app items-center justify-between px-5 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <nav className="hidden gap-1 sm:flex" aria-label="Navigation">
              {TABS.map((t) => (
                <NavLink key={t.to} to={t.to} end className={tab}>
                  {t.label}
                </NavLink>
              ))}
            </nav>
            {!playing && path !== "/connexion" && <AccountButton />}
          </div>
        </div>
        <OfflineBanner />
      </header>
      <main id="main" className={`mx-auto w-full max-w-app flex-1 px-5 pt-2 sm:pb-12 ${playing ? "pb-8" : "pb-28"}`}>
        {children}
      </main>
      <nav
        className={`${playing ? "hidden" : "flex"} fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] sm:hidden`}
        aria-label="Navigation"
      >
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className={tab}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
