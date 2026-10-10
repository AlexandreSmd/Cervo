import { useState } from "react";
import { api } from "../lib/api";
import { formatAnswer } from "../lib/format";
import type { Answer, PublicQuestion, SubmitResult } from "../lib/types";

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

/** Ordre attendu, avec ✓ quand l'élément est à la bonne place. */
function OrderReveal({ correct, given }: { correct: string[]; given: Answer | null }) {
  const mine = Array.isArray(given) ? given : [];
  return (
    <ol className="space-y-1.5">
      {correct.map((item, i) => {
        const ok = mine[i] === item;
        return (
          <li key={item} className="flex items-center gap-3 rounded-xl bg-ink/5 px-3 py-2 font-semibold">
            <span className="w-5 text-center text-sm text-muted">{i + 1}</span>
            <span className="flex-1">{item}</span>
            <span className={ok ? "text-good" : "text-bad"} aria-label={ok ? "bien placé" : "mal placé"}>{ok ? "✓" : "✗"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Résultat d'une question : verdict + points, bonne réponse, ta réponse, explication. */
export function Feedback({ question, result, onNext, isLast }: { question: PublicQuestion; result: SubmitResult; onNext: () => void; isLast: boolean }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const v = verdictOf(result.score, result.timed_out);
  const perfect = result.score === 100 && question.type !== "dictation";

  const sendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.report(question.id, reason).catch(() => undefined);
    setReported(true);
    setReporting(false);
  };

  return (
    <div className="animate-rise space-y-4" data-testid="feedback">
      <div className={`flex items-center gap-4 rounded-3xl ${v.bg} p-5 text-white`} role="status" aria-live="polite">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/25 text-2xl font-extrabold" aria-hidden="true">{v.icon}</span>
        <span className="flex-1 font-display text-2xl font-extrabold" data-testid="verdict">{v.title}</span>
        <span className="text-right">
          <span className="block font-display text-4xl font-extrabold leading-none" data-testid="score-value">+{result.score}</span>
          <span className="text-xs font-semibold opacity-80">points</span>
        </span>
      </div>

      {question.type === "order" && Array.isArray(result.correct_answer) ? (
        <OrderReveal correct={result.correct_answer as string[]} given={result.user_answer} />
      ) : (
        !perfect && (
          <div className="space-y-1 px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Bonne réponse</p>
            <p className="font-display text-2xl font-extrabold leading-tight" data-testid="correct-answer">{formatAnswer(result.correct_answer, question.type, question.unit)}</p>
            {result.user_answer !== null && (
              <p className="pt-1 text-sm text-muted">Toi : <span className="font-semibold">{formatAnswer(result.user_answer, question.type, question.unit)}</span></p>
            )}
          </div>
        )
      )}

      {result.explanation && (
        <p className="rounded-2xl bg-ink/5 p-4 text-[15px] leading-relaxed"><span aria-hidden="true">💡 </span>{result.explanation}</p>
      )}

      <button className="btn-dark w-full text-lg" onClick={onNext} autoFocus data-testid="next">{isLast ? "Voir mon score" : "Suivant"}</button>
      <div className="text-center">
        {reported ? (
          <p className="text-xs text-muted">Merci, c'est noté.</p>
        ) : reporting ? (
          <form onSubmit={sendReport} className="flex gap-2">
            <input className="input py-2 text-sm" aria-label="Qu'est-ce qui ne va pas ?" placeholder="Qu'est-ce qui ne va pas ?" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={500} required />
            <button type="submit" className="btn-ghost btn-sm">Envoyer</button>
          </form>
        ) : (
          <button className="text-xs text-muted hover:text-ink" onClick={() => setReporting(true)}>⚑ Signaler une erreur</button>
        )}
      </div>
    </div>
  );
}
