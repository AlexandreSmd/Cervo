import { useState } from "react";
import { api } from "../lib/api";
import { COLOR_HEX, formatAnswer, scoreColor } from "../lib/format";
import type { PublicQuestion, SubmitResult } from "../lib/types";

/** Résultat d'une question : score, bonne réponse, ta réponse, explication. */
export function Feedback({ question, result, onNext, isLast }: { question: PublicQuestion; result: SubmitResult; onNext: () => void; isLast: boolean }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const color = COLOR_HEX[scoreColor(result.score)];

  const sendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.report(question.id, reason).catch(() => undefined);
    setReported(true);
    setReporting(false);
  };

  return (
    <div className="animate-rise space-y-4" data-testid="feedback">
      <div className="flex items-end justify-between">
        <p className="font-display text-6xl font-extrabold" style={{ color }} aria-live="polite" data-testid="score-value">{result.score}</p>
        <p className="pb-2 text-sm font-semibold text-muted">/ 100</p>
      </div>
      <dl className="divide-y divide-line rounded-2xl bg-ink/5">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-muted">Réponse</dt>
          <dd className="text-right font-bold" data-testid="correct-answer">{formatAnswer(result.correct_answer, question.type, question.unit)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-sm text-muted">Toi</dt>
          <dd className="text-right font-bold">{formatAnswer(result.user_answer, question.type, question.unit)}</dd>
        </div>
      </dl>
      {result.explanation && <p className="text-[15px] leading-relaxed text-muted">{result.explanation}</p>}
      <button className="btn-dark w-full text-lg" onClick={onNext} autoFocus data-testid="next">{isLast ? "Résultats" : "Suivant"}</button>
      <div className="text-center">
        {reported ? (
          <p className="text-xs text-muted" role="status">Merci, c'est noté.</p>
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
