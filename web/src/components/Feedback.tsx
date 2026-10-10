import { useState } from "react";
import { api } from "../lib/api";
import { coachMessage, formatAnswer } from "../lib/format";
import type { PublicQuestion, SubmitResult } from "../lib/types";
import { ScoreGauge } from "./ScoreGauge";

/** Feedback immédiat : score, bonne réponse, ta réponse, explication, source. */
export function Feedback({ question, result, onNext, isLast }: { question: PublicQuestion; result: SubmitResult; onNext: () => void; isLast: boolean }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const sendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.report(question.id, reason);
      setReported(true);
      setReporting(false);
    } catch (err) {
      setReportError((err as Error).message);
    }
  };

  return (
    <div className="animate-rise space-y-5" data-testid="feedback">
      <div className="flex flex-col items-center gap-2 text-center">
        <ScoreGauge score={result.score} />
        <p className="font-display text-xl font-bold" aria-live="polite">{coachMessage(result.score)}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-good/10 p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-good">Bonne réponse</dt>
          <dd className="mt-1 text-lg font-bold" data-testid="correct-answer">{formatAnswer(result.correct_answer, question.type, question.unit)}</dd>
        </div>
        <div className="rounded-2xl bg-line/50 p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Ta réponse</dt>
          <dd className="mt-1 text-lg font-bold">{formatAnswer(result.user_answer, question.type, question.unit)}</dd>
        </div>
      </dl>
      {result.explanation && (
        <div className="rounded-2xl border border-line p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Le saviez-vous ?</p>
          <p className="mt-1">{result.explanation}</p>
          {result.source_url && (
            <a href={result.source_url} target="_blank" rel="noreferrer" className="link mt-2 inline-block text-sm">Source ↗</a>
          )}
        </div>
      )}
      <button className="btn-primary w-full text-lg" onClick={onNext} autoFocus data-testid="next">
        {isLast ? "Voir mes résultats" : "Question suivante"}
      </button>
      <div className="text-center text-sm">
        {reported ? (
          <p className="text-muted" role="status">Merci, la question sera relue.</p>
        ) : reporting ? (
          <form onSubmit={sendReport} className="space-y-2 text-left">
            <label htmlFor="reason" className="label">Qu'est-ce qui ne va pas ?</label>
            <textarea id="reason" className="input text-base" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={500} required />
            {reportError && <p className="text-bad">{reportError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-soft flex-1 py-2">Envoyer</button>
              <button type="button" className="btn-ghost flex-1 py-2" onClick={() => setReporting(false)}>Annuler</button>
            </div>
          </form>
        ) : (
          <button className="text-muted underline-offset-4 hover:underline" onClick={() => setReporting(true)}>Signaler une erreur</button>
        )}
      </div>
    </div>
  );
}
