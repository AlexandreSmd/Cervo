// Après la réponse : une correction propre à chaque mécanique, lisible d'un coup d'œil.
import { dictationDiff } from "../../lib/diff";
import { formatNumber } from "../../lib/format";
import type { Answer, SizeConfig } from "../../lib/types";
import { HundredDots } from "../answers/PercentInput";
import { recallTokens } from "../answers/RecallInput";
import { CLUE_SCORES } from "../answers/RiddleInput";
import { SizePair } from "../answers/SizeInput";

/** Classement : l'ordre attendu, avec la date (ou la précision) de chaque élément et ✓/✗. */
export function OrderReveal({ correct, details, given }: { correct: string[]; details?: string[]; given: Answer | null }) {
  const mine = Array.isArray(given) ? given : [];
  return (
    <ol className="space-y-1.5" data-testid="order-reveal">
      {correct.map((item, i) => {
        const ok = mine[i] === item;
        return (
          <li key={item} className="flex items-center gap-3 rounded-xl bg-ink/5 px-3 py-2">
            <span className="w-5 text-center text-sm font-bold text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{item}</span>
              {details?.[i] && <span className="block text-xs font-semibold text-accent">{details[i]}</span>}
            </span>
            <span className={`text-lg ${ok ? "text-good" : "text-bad"}`} aria-label={ok ? "bien placé" : "mal placé"}>
              {ok ? "✓" : "✗"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Pourcentage : la réalité (en vert) et ta réponse, sur 100 points. */
export function PercentReveal({ truth, given }: { truth: number; given: Answer | null }) {
  const mine = typeof given === "number" ? given : null;
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-around text-center">
        <div>
          <p className="font-display text-4xl font-extrabold text-good" data-testid="correct-answer">
            {formatNumber(truth)} %
          </p>
          <p className="text-xs font-semibold text-muted">réalité</p>
        </div>
        <div>
          <p className="font-display text-2xl font-extrabold text-muted">{mine === null ? "-" : `${formatNumber(mine)} %`}</p>
          <p className="text-xs font-semibold text-muted">toi</p>
        </div>
      </div>
      <div className="mx-auto max-w-[180px]">
        <HundredDots value={mine} truth={truth} />
      </div>
    </div>
  );
}

/** Taille : les deux objets à leur vraie proportion, ta réponse en transparence. */
export function SizeReveal({ config, truth, given }: { config: SizeConfig; truth: number; given: Answer | null }) {
  const mine = typeof given === "number" && given > 0 ? given : undefined;
  return (
    <div className="space-y-2">
      <SizePair config={config} ratio={truth} ghost={mine} />
      <p className="text-center">
        <span className="font-display text-3xl font-extrabold" data-testid="correct-answer">
          × {formatNumber(truth)}
        </span>
        {mine !== undefined && <span className="ml-3 text-sm text-muted">toi : × {formatNumber(mine)}</span>}
      </p>
    </div>
  );
}

/** Dictée : le texte attendu, mot à mot ; tes fautes en rouge, ce que tu as écrit barré. */
export function DictationReveal({ expected, given }: { expected: string; given: Answer | null }) {
  const tokens = dictationDiff(expected, typeof given === "string" ? given : "");
  const errors = tokens.filter((t) => t.status !== "ok").length;
  return (
    <div className="space-y-2">
      <p className="text-[17px] leading-loose" data-testid="dictation-diff">
        {tokens.map((t, i) => (
          <span key={i}>
            {t.status === "ok" && <span>{t.text}</span>}
            {t.status === "wrong" && (
              <span className="rounded bg-bad/10 px-0.5">
                <s className="text-muted">{t.typed}</s> <strong className="text-bad">{t.text}</strong>
              </span>
            )}
            {t.status === "missing" && <strong className="rounded bg-mid/20 px-0.5 text-ink">{t.text}</strong>}
            {t.status === "extra" && <s className="text-muted">{t.text}</s>}{" "}
          </span>
        ))}
      </p>
      <p className="text-xs text-muted">
        {errors === 0 ? "Aucune faute 👏" : `${errors} faute${errors > 1 ? "s" : ""}`} · <strong className="text-bad">rouge</strong> : faute
        · <strong className="bg-mid/20 px-0.5">orange</strong> : mot oublié
      </p>
    </div>
  );
}

const loose = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Rappel : chaque élément attendu, retrouvé ou non. */
export function RecallReveal({ expected, given, singleChars }: { expected: string[]; given: Answer | null; singleChars: boolean }) {
  const typed = (Array.isArray(given) ? given : recallTokens(String(given ?? ""), singleChars)).map(loose);
  const remaining = [...typed];
  return (
    <div className="flex flex-wrap justify-center gap-2" data-testid="recall-reveal">
      {expected.map((item, i) => {
        const found = remaining.indexOf(loose(item));
        if (found >= 0) remaining.splice(found, 1);
        return (
          <span
            key={i}
            className={`rounded-xl px-3 py-2 font-display text-xl font-extrabold ${found >= 0 ? "bg-good/15 text-good" : "bg-bad/10 text-bad"}`}
          >
            {item}
          </span>
        );
      })}
    </div>
  );
}

/** Devinette : la réponse, les indices vus et ceux qu'on n'a pas eu besoin d'ouvrir. */
export function RiddleReveal({ answer, clues, seen }: { answer: string; clues: string[]; seen: number }) {
  return (
    <div className="space-y-3">
      <p className="text-center font-display text-3xl font-extrabold" data-testid="correct-answer">
        {answer}
      </p>
      <ol className="space-y-1.5">
        {clues.map((clue, i) => (
          <li key={i} className={`flex gap-3 rounded-xl px-3 py-2 text-sm ${i < seen ? "bg-ink/5 font-semibold" : "text-muted"}`}>
            <span className="w-14 shrink-0 text-xs font-bold">{i < seen ? `Indice ${i + 1}` : `${CLUE_SCORES[i] ?? 0} pts`}</span>
            <span>{clue}</span>
          </li>
        ))}
      </ol>
      <p className="text-center text-xs text-muted">
        Réponse donnée avec {seen} indice{seen > 1 ? "s" : ""}
      </p>
    </div>
  );
}
