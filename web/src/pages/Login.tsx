// Connexion par lien magique ; rattache l'e-mail à la session invité (même uid).
import { useQueryClient } from "@tanstack/react-query";
import {
  browserPopupRedirectResolver,
  EmailAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  linkWithPopup,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
  signInWithPopup,
} from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/States";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEV_TOOLS, USE_EMULATOR } from "../lib/config";
import { auth, latestEmulatorLink } from "../lib/firebase";

const EMAIL_KEY = "cervo-email-for-signin";

// Navigateurs intégrés aux applis (Messenger, Instagram…) : Google y refuse la connexion.
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Snapchat|TikTok|musical_ly|Line\//i.test(navigator.userAgent);

export function Login() {
  const { user, ready } = useAuth();
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const handled = useRef(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isLink = isSignInWithEmailLink(auth, window.location.href);

  // Retour depuis le lien magique : on rattache l'e-mail à la session invité (même uid).
  useEffect(() => {
    if (!isLink || !ready || !user || handled.current) return;
    const stored = (() => {
      try {
        return localStorage.getItem(EMAIL_KEY);
      } catch {
        return null;
      }
    })();
    if (!stored) return; // l'utilisateur doit confirmer son e-mail (autre appareil)
    handled.current = true;
    complete(stored);
    // `complete` change à chaque rendu ; l'effet ne doit tourner qu'une fois la session prête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLink, ready, user]);

  const complete = async (address: string) => {
    setCompleting(true);
    setError(null);
    const link = window.location.href;
    try {
      if (auth.currentUser?.isAnonymous) {
        try {
          await linkWithCredential(auth.currentUser, EmailAuthProvider.credentialWithLink(address, link));
        } catch (err) {
          const code = (err as { code?: string }).code ?? "";
          if (!code.includes("already-in-use")) throw err;
          // L'e-mail a déjà un compte : on s'y connecte (l'historique invité de cet appareil n'est pas fusionné).
          await signInWithEmailLink(auth, address, link);
        }
      } else {
        await signInWithEmailLink(auth, address, link);
      }
      try {
        localStorage.removeItem(EMAIL_KEY);
      } catch {
        /* stockage indisponible */
      }
      await finish();
    } catch (err) {
      setCompleting(false);
      const code = (err as { code?: string }).code ?? "";
      setError(
        code.includes("invalid-action-code") || code.includes("expired")
          ? "Ce lien a expiré ou a déjà servi. Demande un nouveau lien."
          : "La connexion n'a pas abouti. Réessaie avec un nouveau lien.",
      );
    }
  };

  /** Après une connexion : jeton à jour (e-mail), profil synchronisé, direction le profil. */
  const finish = async () => {
    await auth.currentUser?.getIdToken(true);
    await api.profile();
    await qc.invalidateQueries();
    navigate("/profil", { replace: true });
  };

  /** Google : rattache le compte à la session invité (même historique), sinon s'y connecte. */
  const google = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      if (auth.currentUser?.isAnonymous) {
        try {
          await linkWithPopup(auth.currentUser, provider, browserPopupRedirectResolver);
        } catch (err) {
          const code = (err as { code?: string }).code ?? "";
          if (!code.includes("already-in-use")) throw err;
          // Ce compte Google existe déjà : on s'y connecte (l'historique invité de cet appareil n'est pas fusionné).
          const credential = GoogleAuthProvider.credentialFromError(err as never);
          if (credential) await signInWithCredential(auth, credential);
          else await signInWithPopup(auth, provider, browserPopupRedirectResolver);
        }
      } else {
        await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      }
      await finish();
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (!code.includes("popup-closed") && !code.includes("cancelled-popup"))
        setError("La connexion avec Google n'a pas abouti. Réessaie.");
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    try {
      await sendSignInLinkToEmail(auth, email, { url: `${window.location.origin}/connexion`, handleCodeInApp: true });
      try {
        localStorage.setItem(EMAIL_KEY, email);
      } catch {
        /* ignore */
      }
      setSent(true);
      if (USE_EMULATOR) setDevLink(await latestEmulatorLink(email));
    } catch {
      setError("Impossible d'envoyer le lien. Vérifie l'adresse e-mail.");
    }
  };

  const storedEmail = (() => {
    try {
      return localStorage.getItem(EMAIL_KEY);
    } catch {
      return null;
    }
  })();
  if (completing || (isLink && !error && (!ready || storedEmail))) return <Loading label="Connexion en cours…" />;

  if (isLink) {
    return (
      <div className="card mt-4 space-y-4 p-6">
        <h1 className="text-2xl font-extrabold">Confirme ton e-mail</h1>
        <p className="text-muted">Pour finaliser la connexion, indique l'adresse à laquelle tu as reçu le lien.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handled.current = true;
            complete(email);
          }}
          className="space-y-3"
        >
          <label htmlFor="email-confirm" className="label">
            Adresse e-mail
          </label>
          <input id="email-confirm" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn-primary w-full" type="submit">
            Me connecter
          </button>
        </form>
        {error && (
          <p className="text-bad" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="card mt-4 space-y-5 p-6">
      <h1 className="text-3xl font-extrabold">Ton compte</h1>
      <p className="text-muted">Sans mot de passe. Ta progression est gardée.</p>
      {user && !user.isAnonymous && <p className="rounded-2xl bg-good/10 p-3 text-sm">Tu es déjà connecté avec {user.email}.</p>}
      {sent ? (
        <div className="space-y-3" role="status">
          <p className="font-semibold">Lien envoyé à {email} ✉️</p>
          <p className="text-sm text-muted">Ouvre-le sur cet appareil.</p>
          {USE_EMULATOR && (
            <div className="rounded-2xl bg-mid/15 p-4 text-sm">
              <p className="font-semibold">En local, aucun e-mail n'est envoyé : le lien est dans le terminal.</p>
              {devLink && DEV_TOOLS && (
                <a href={devLink} className="btn-ghost mt-2 w-full" data-testid="dev-magic-link">
                  Ouvrir le lien magique
                </a>
              )}
            </div>
          )}
          <button className="link text-sm" onClick={() => setSent(false)}>
            Utiliser une autre adresse
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {IN_APP_BROWSER && (
            <p className="rounded-2xl bg-mid/15 p-3 text-sm" data-testid="in-app-hint">
              Tu es dans le navigateur de l'appli (Messenger…) : Google y bloque la connexion. Ouvre Vif dans Safari ou Chrome (menu ⋯ → «
              Ouvrir dans le navigateur »), ou reçois un lien par e-mail ci-dessous.
            </p>
          )}
          <button
            type="button"
            onClick={google}
            data-testid="google"
            className="btn w-full border border-line bg-card text-lg text-ink hover:bg-ink/5"
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            Continuer avec Google
          </button>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-line" />
            ou par e-mail
            <span className="h-px flex-1 bg-line" />
          </div>
          <form onSubmit={send} className="space-y-3">
            <label htmlFor="email" className="sr-only">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.fr"
              required
            />
            <button className="btn-dark w-full text-lg" type="submit" data-testid="send-link">
              Recevoir le lien
            </button>
          </form>
        </div>
      )}
      {status && <p className="text-muted">{status}</p>}
      {error && (
        <p className="text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
