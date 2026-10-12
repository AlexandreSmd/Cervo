// Écran après une réponse : verdict coloré, points, correction propre au type, explication.
import { useState } from "react";
import { api } from "../lib/api";
import { formatAnswer } from "../lib/format";
import type { PublicQuestion, SubmitResult } from "../lib/types";
import { DictationReveal, OrderReveal, PercentReveal, RecallReveal, RiddleReveal, SizeReveal } from "./reveals/Reveals";

const VERDICTS = {
  good: { title: "Bravo !", icon: "✓", bg: "bg-good", text: "text-good" },
  mid: { title: "Pas loin !", icon: "≈", bg: "bg-mid", text: "text-mid" },
  bad: { title: "Raté", icon: "✗", bg: "bg-bad", text: "text-bad" },
  time: { title: "Temps écoulé", icon: "⏱", bg: "bg-bad", text: "text-bad" },
};

export function verdictOf(score: number, timedOut?: boolean) {
  if (timedOut) return VERDICTS.time;
  if (score >= 80) return VERDICTS.good;
  if (score >= 40) return VERDICTS.mid;
  return VERDICTS.bad;
}

/** Correction propre à la mécanique ; null : affichage générique (bonne réponse + ta réponse). */
function TypedReveal({ question, result }: { question: PublicQuestion; result: SubmitResult }) {
  const truth = result.correct_answer;
  switch (question.type) {
    case "order":
      return Array.isArray(truth) ? <OrderReveal correct={truth} details={result.order_details} given={result.user_answer} /> : null;
    case "percent":
      return <PercentReveal truth={Number(truth)} given={result.user_answer} />;
    case "size":
      return result.size ? <SizeReveal config={result.size} truth={Number(truth)} given={result.user_answer} /> : null;
    case "dictation":
      return <DictationReveal expected={String(truth)} given={result.user_answer} />;
    case "recall":
      return Array.isArray(truth) ? (
        <RecallReveal expected={truth} given={result.user_answer} singleChars={!!question.recall?.single_chars} />
      ) : null;
    case "riddle":
      return <RiddleReveal answer={String(truth)} clues={result.clues ?? []} seen={result.clues_seen ?? 1} />;
    default:
      return null;
  }
}

/** Résultat d'une question : verdict + points, bonne réponse, ta réponse, explication. */
export function Feedback({
  question,
  result,
  onNext,
  isLast,
}: {
  question: PublicQuestion;
  result: SubmitResult;
  onNext: () => void;
  isLast: boolean;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const v = verdictOf(result.score, result.timed_out);
  const typed = TypedReveal({ question, result });
  const perfect = result.score === 100;
  const isFact = question.category === "fait";

  const sendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.report(question.id, reason).catch(() => undefined);
    setReported(true);
    setReporting(false);
  };

  return (
    <div className="animate-rise space-y-4" data-testid="feedback">
      <div
        className={`flex items-center gap-4 rounded-2xl border-2 border-ink ${v.bg} p-5 text-white shadow-hard`}
        role="status"
        aria-live="polite"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/25 text-2xl font-extrabold"
          aria-hidden="true"
        >
          {v.icon}
        </span>
        <span className="flex-1 font-display text-2xl font-extrabold" data-testid="verdict">
          {v.title}
        </span>
        <span className="text-right">
          <span className="block font-display text-4xl font-extrabold leading-none" data-testid="score-value">
            +{result.score}
          </span>
          <span className="text-xs font-semibold opacity-80">points</span>
        </span>
      </div>

      {result.community && (
        <p className="text-center text-sm text-muted" data-testid="community">
          {["binary", "mcq", "short_text", "riddle"].includes(question.type)
            ? `${result.community.success} % des joueurs ont trouvé`
            : `Les autres joueurs : ${result.community.average} points en moyenne`}
        </p>
      )}

      {typed ??
        (!perfect && (
          <div className="space-y-1 px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Bonne réponse</p>
            <p className="font-display text-2xl font-extrabold leading-tight" data-testid="correct-answer">
              {formatAnswer(result.correct_answer, question.type, question.unit)}
            </p>
            {result.user_answer !== null && (
              <p className="pt-1 text-sm text-muted">
                Toi : <span className="font-semibold">{formatAnswer(result.user_answer, question.type, question.unit)}</span>
              </p>
            )}
          </div>
        ))}

      {result.explanation &&
        (isFact ? (
          <div className="rounded-r-xl border-l-4 border-accent bg-accent/10 py-3 pl-4 pr-4" data-testid="did-you-know">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-accent">Le savais-tu ?</p>
            <p className="text-[16px] leading-relaxed">{result.explanation}</p>
          </div>
        ) : (
          <div className="rounded-r-xl border-l-4 border-ink bg-ink/[0.04] py-3 pl-4 pr-4">
            <p className="label mb-1">Pourquoi</p>
            <p className="text-[15px] leading-relaxed">{result.explanation}</p>
          </div>
        ))}
      {result.source_url && (
        <a href={result.source_url} target="_blank" rel="noreferrer" className="block text-center text-xs text-muted underline">
          Source
        </a>
      )}

      <button className="btn-dark w-full text-lg" onClick={onNext} autoFocus data-testid="next">
        {isLast ? "Voir mon score" : "Suivant"}
      </button>
      <div className="text-center">
        {reported ? (
          <p className="text-xs text-muted">Merci, c'est noté.</p>
        ) : reporting ? (
          <form onSubmit={sendReport} className="flex gap-2">
            <input
              className="input py-2 text-sm"
              aria-label="Qu'est-ce qui ne va pas ?"
              placeholder="Qu'est-ce qui ne va pas ?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={500}
              required
            />
            <button type="submit" className="btn-ghost btn-sm">
              Envoyer
            </button>
          </form>
        ) : (
          <button className="text-xs text-muted hover:text-ink" onClick={() => setReporting(true)}>
            ⚑ Signaler une erreur
          </button>
        )}
      </div>
    </div>
  );
}
