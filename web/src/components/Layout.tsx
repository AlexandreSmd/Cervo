import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { APP_NAME, DEV_TOOLS } from "../lib/config";
import { DevTools } from "./DevTools";

function useHtmlClass(cls: string, key: string, initial: () => boolean) {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    document.documentElement.classList.toggle(cls, on);
    try { localStorage.setItem(key, on ? "on" : "off"); } catch { /* stockage indisponible */ }
  }, [on, cls, key]);
  return [on, setOn] as const;
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30" aria-label={`${APP_NAME}, accueil`}>
      <span className="flex gap-0.5" aria-hidden="true">
        <span className="h-3 w-3 rounded-full bg-accent" />
        <span className="h-3 w-3 rounded-full bg-good" />
        <span className="h-3 w-3 rounded-full bg-mid" />
      </span>
      <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [dark, setDark] = useHtmlClass("dark", "cervo-theme-dark", () => document.documentElement.classList.contains("dark"));
  const [large, setLarge] = useHtmlClass("text-large", "cervo-text-large", () => {
    try { return localStorage.getItem("cervo-text-large") === "on"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("cervo-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-2 py-2 text-sm font-semibold transition sm:px-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${isActive ? "bg-accent/10 text-accent" : "text-muted hover:text-ink"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2">Aller au contenu</a>
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-app items-center justify-between gap-2 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Navigation principale">
            <NavLink to="/" end className={navClass}>Jouer</NavLink>
            <NavLink to="/profil" className={navClass}>Profil</NavLink>
            <button type="button" onClick={() => setLarge(!large)} className="rounded-xl px-2 py-2 text-sm font-bold text-muted hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
              aria-pressed={large} aria-label={large ? "Texte normal" : "Agrandir le texte"} title="Taille du texte">
              A<span className="text-xs">A</span>
            </button>
            <button type="button" onClick={() => setDark(!dark)} className="rounded-xl px-2 py-2 text-muted hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
              aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"} title="Thème">
              {dark ? "☀︎" : "☾"}
            </button>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-app flex-1 px-4 pb-16 pt-6">{children}</main>
      <footer className="mx-auto w-full max-w-app px-4 pb-8 text-center text-sm text-muted">
        <p>Dix questions par jour. Zéro IA.</p>
        <p className="mt-2 space-x-4">
          <Link to="/a-propos" className="link">À propos</Link>
          <Link to="/confidentialite" className="link">Confidentialité</Link>
        </p>
      </footer>
      {DEV_TOOLS && <DevTools />}
    </div>
  );
}
