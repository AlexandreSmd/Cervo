// Connexion par lien magique ; rattache l'e-mail à la session invité (même uid).
import { useQueryClient } from "@tanstack/react-query";
import { EmailAuthProvider, isSignInWithEmailLink, linkWithCredential, sendSignInLinkToEmail, signInWithEmailLink } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/States";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEV_TOOLS, USE_EMULATOR } from "../lib/config";
import { auth, latestEmulatorLink } from "../lib/firebase";

const EMAIL_KEY = "cervo-email-for-signin";

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
      await auth.currentUser?.getIdToken(true);
      try {
        localStorage.removeItem(EMAIL_KEY);
      } catch {
        /* ignore */
      }
      await api.profile();
      await qc.invalidateQueries();
      navigate("/profil", { replace: true });
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
      <p className="text-muted">Un lien de connexion par e-mail, sans mot de passe. Ta progression est gardée.</p>
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
