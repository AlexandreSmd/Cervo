// Partage du résultat : feuille de partage du téléphone (Messenger…) ou copie.
import { useEffect, useState } from "react";
import { APP_NAME, PUBLIC_URL } from "../lib/config";
import { MESSENGER_APP_URL, buildShareMessage, isMobileDevice, shareMessage, type ShareOutcome } from "../lib/share";

interface Props {
  date: string;
  total: number;
  scores: number[];
  streak: number;
  kinds?: { emoji: string; label: string }[];
}

/** Partage du résultat : feuille de partage du téléphone (Messenger…) sur mobile, copie sur ordinateur. */
export function ShareCard({ date, total, scores, streak, kinds }: Props) {
  const [mobile, setMobile] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  useEffect(() => setMobile(isMobileDevice()), []);

  const message = buildShareMessage(APP_NAME, date, total, scores, streak, PUBLIC_URL || window.location.origin, kinds);

  const share = async () => {
    setOutcome(await shareMessage(message, `${APP_NAME} · ${total}/100`));
  };

  return (
    <div className="space-y-3 text-left">
      <button className="btn w-full bg-[#0866FF] text-lg text-white" onClick={share} data-testid="share">
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="currentColor">
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.26.36.27.58l.05 1.78a.8.8 0 0 0 1.12.71l1.98-.88a.8.8 0 0 1 .53-.04c.91.25 1.87.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63Z" />
        </svg>
        {mobile ? "Envoyer sur Messenger" : "Copier mon résultat"}
      </button>

      <div aria-live="polite" className="text-center text-sm">
        {outcome === "shared" && <p className="text-good">Envoyé ! Merci de faire tourner {APP_NAME}.</p>}
        {outcome === "copied" &&
          (mobile ? (
            <div className="space-y-2 rounded-2xl bg-[#0866FF]/10 p-3">
              <p>Message copié. Ouvre Messenger et colle-le dans une conversation.</p>
              <a href={MESSENGER_APP_URL} className="btn-ghost w-full py-2">
                Ouvrir Messenger
              </a>
            </div>
          ) : (
            <p className="text-muted" data-testid="share-copied">
              Copié ! Colle-le dans Messenger, WhatsApp ou un SMS.
            </p>
          ))}
        {outcome === "failed" && <p className="text-bad">Impossible de copier automatiquement : sélectionne le message ci-dessous.</p>}
      </div>

      <button
        className="w-full text-center text-xs text-muted hover:text-ink"
        onClick={() => setShowPreview(!showPreview)}
        aria-expanded={showPreview}
      >
        {showPreview || outcome === "failed" ? "Masquer l'aperçu" : "Aperçu du message"}
      </button>
      {(showPreview || outcome === "failed") && (
        <pre className="whitespace-pre-wrap rounded-2xl bg-ink/5 p-4 font-sans text-sm" data-testid="share-preview">
          {message}
        </pre>
      )}
    </div>
  );
}
