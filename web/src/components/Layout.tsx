// Cadre de l'interface joueur : barre du haut, onglets en bas sur mobile.
import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { APP_NAME } from "../lib/config";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
      aria-label={`${APP_NAME}, accueil`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="h-2.5 w-2.5 rounded-full bg-good" />
        <span className="h-2.5 w-2.5 rounded-full bg-mid" />
      </span>
      <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

const TABS = [
  { to: "/", label: "Jouer", icon: "M8 5.14v13.72a1 1 0 0 0 1.52.85l10.98-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" },
  { to: "/profil", label: "Profil", icon: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.24-8 5v1h16v-1c0-2.76-3.6-5-8-5Z" },
];

/** Interface joueur : barre du haut minimale, onglets en bas sur mobile. */
export function Layout({ children }: { children: ReactNode }) {
  // Pendant le quiz, pas d'onglets en bas : toute la place pour la question.
  const playing = useLocation().pathname === "/jouer";
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition sm:flex-none sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-sm ${
      isActive ? "text-ink sm:bg-ink/5" : "text-muted hover:text-ink"
    }`;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-app items-center justify-between px-5 py-3">
          <Logo />
          <nav className="hidden gap-1 sm:flex" aria-label="Navigation">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end className={tab}>
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className={`mx-auto w-full max-w-app flex-1 px-5 pt-2 sm:pb-12 ${playing ? "pb-8" : "pb-28"}`}>
        {children}
      </main>
      <nav
        className={`${playing ? "hidden" : "flex"} fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden`}
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
