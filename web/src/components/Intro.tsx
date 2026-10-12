// Première visite : trois écrans courts qui présentent la mission, façon story (défilement
// automatique, toucher pour avancer, « Passer » à tout moment). Montrée une seule fois par appareil.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KINDS } from "../lib/kinds";
import { KindIcon } from "./KindIcon";
import { BrainMark } from "./Layout";

const SEEN_KEY = "vif-intro-seen";
const STEP_MS = 3200;

export function introSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // stockage indisponible : on ne bloque pas l'accès au jeu
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // rien à faire
  }
}

/** Écran 1 : la mission. */
function Mission() {
  return (
    <div className="space-y-8">
      <div className="intro-in" style={{ animationDelay: "0ms" }}>
        <BrainMark className="h-20 w-20" />
      </div>
      <h1 className="text-[44px] font-extrabold leading-[1.02]">
        <span className="intro-in block" style={{ animationDelay: "150ms" }}>
          Garde ton esprit
        </span>
        <span className="intro-in block" style={{ animationDelay: "350ms" }}>
          affûté,{" "}
          <span className="relative inline-block">
            vif
            <span
              className="intro-underline absolute -bottom-1 left-0 h-2 w-full rounded-sm bg-accent"
              style={{ animationDelay: "900ms" }}
            />
          </span>
        </span>
        <span className="intro-in block" style={{ animationDelay: "550ms" }}>
          et précis.
        </span>
      </h1>
      <p className="intro-in text-lg text-muted" style={{ animationDelay: "800ms" }}>
        Un entraînement court, chaque jour, pour un cerveau qui reste en forme.
      </p>
    </div>
  );
}

/** Écran 2 : 5 minutes, 10 défis différents. */
function Daily() {
  return (
    <div className="space-y-8">
      <p className="intro-in font-display text-[88px] font-extrabold leading-none tracking-tight" style={{ animationDelay: "0ms" }}>
        5 min
      </p>
      <h2 className="intro-in text-3xl font-extrabold leading-tight" style={{ animationDelay: "200ms" }}>
        par jour. 10 défis, tous différents.
      </h2>
      <div className="grid grid-cols-5 gap-2">
        {KINDS.map((k, i) => (
          <span
            key={k.key}
            className="intro-pop flex aspect-square items-center justify-center rounded-xl border-2 border-ink text-white"
            style={{ backgroundColor: k.color, animationDelay: `${400 + i * 90}ms` }}
            title={k.label}
          >
            <KindIcon kind={k.key} className="h-6 w-6" />
          </span>
        ))}
      </div>
      <p className="intro-in text-muted" style={{ animationDelay: "1400ms" }}>
        Vocabulaire, mémoire, estimation, logique, dictée… Sans aide, sans IA, juste toi.
      </p>
    </div>
  );
}

/** Écran 3 : la progression et le jeu entre amis. */
function Progress() {
  const scores = [100, 80, 30, 100, 60, 100, 90, 20, 100, 70];
  return (
    <div className="space-y-8">
      <h2 className="intro-in text-[40px] font-extrabold leading-[1.05]" style={{ animationDelay: "0ms" }}>
        Le même quiz pour tous, à minuit.
      </h2>
      <div className="card-strong space-y-4 p-5">
        <div className="flex items-end justify-between">
          <span className="intro-in font-display text-6xl font-extrabold text-good" style={{ animationDelay: "300ms" }}>
            75
          </span>
          <span className="intro-in chip" style={{ animationDelay: "500ms" }}>
            🔥 12 jours
          </span>
        </div>
        <div className="flex gap-1.5">
          {scores.map((s, i) => (
            <span
              key={i}
              className="intro-pop aspect-square flex-1 rounded-full border-2 border-ink"
              style={{ backgroundColor: s >= 80 ? "#1FA971" : s >= 40 ? "#F2A33A" : "#E5484D", animationDelay: `${500 + i * 80}ms` }}
            />
          ))}
        </div>
      </div>
      <p className="intro-in text-lg text-muted" style={{ animationDelay: "1300ms" }}>
        Partage ton score à tes amis, garde ta série, regarde-toi progresser.
      </p>
    </div>
  );
}

const STEPS = [Mission, Daily, Progress];

export function Intro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  // Défilement automatique, sauf sur le dernier écran (on attend le choix du joueur).
  useEffect(() => {
    if (last) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [step, last]);

  const close = () => {
    markSeen();
    onDone();
  };
  const Step = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-label="Bienvenue sur Vif" data-testid="intro">
      <div className="mx-auto flex w-full max-w-app flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/15">
                <span
                  key={`${i}-${step}`}
                  className={`block h-full rounded-full bg-ink ${i === step && !last ? "intro-bar" : ""}`}
                  style={{
                    width: i < step || (i === step && last) ? "100%" : i === step ? undefined : "0%",
                    animationDuration: `${STEP_MS}ms`,
                  }}
                />
              </span>
            ))}
          </div>
          {!last && (
            <button className="text-sm font-semibold text-muted" onClick={close} data-testid="intro-skip">
              Passer
            </button>
          )}
        </div>

        {/* Toucher l'écran fait avancer, comme une story. */}
        <button
          type="button"
          className="flex flex-1 items-center text-left focus:outline-none"
          onClick={() => !last && setStep(step + 1)}
          aria-label={last ? undefined : "Écran suivant"}
          tabIndex={last ? -1 : 0}
        >
          <div key={step} className="w-full">
            <Step />
          </div>
        </button>

        <div className="space-y-3">
          {last ? (
            <>
              <button className="btn-primary w-full text-lg" onClick={close} data-testid="intro-start">
                Commencer le quiz du jour
              </button>
              <Link to="/connexion" onClick={markSeen} className="btn-ghost w-full">
                J'ai déjà un compte
              </Link>
            </>
          ) : (
            <button className="btn-dark w-full text-lg" onClick={() => setStep(step + 1)} data-testid="intro-next">
              Suivant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
