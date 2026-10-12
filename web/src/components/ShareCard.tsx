// Partage du résultat : feuille de partage du téléphone (Messenger…) ou copie.
import { useEffect, useState } from "react";
import { APP_NAME, PUBLIC_URL } from "../lib/config";
import { buildShareMessage, isMobileDevice, shareMessage, type ShareOutcome } from "../lib/share";

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
      <button className="btn-primary w-full text-lg" onClick={share} data-testid="share">
        {/* Icône « partager » : une flèche qui sort d'une boîte. */}
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 15V3 M7.5 7.5 12 3l4.5 4.5 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
        Partager
      </button>

      <div aria-live="polite" className="text-center text-sm">
        {outcome === "shared" && <p className="text-good">Envoyé ! Merci de faire tourner {APP_NAME}.</p>}
        {outcome === "copied" && (
          <p className="text-muted" data-testid="share-copied">
            {mobile ? "Message copié : colle-le dans une conversation." : "Copié ! Colle-le dans Messenger, WhatsApp ou un SMS."}
          </p>
        )}
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
