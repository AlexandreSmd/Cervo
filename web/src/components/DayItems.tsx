// Liste repliable des 10 questions d'une journée (résultats, historique).
import { COLOR_HEX, formatAnswer, scoreColor } from "../lib/format";
import type { DayItem } from "../lib/types";
import { QuestionMedia } from "./QuestionCard";

/** Les 10 questions d'une journée, repliées : on déplie pour voir le détail. */
export function DayItems({ items }: { items: DayItem[] }) {
  return (
    <ol className="card divide-y divide-line overflow-hidden">
      {items.map((it, i) => (
        <li key={it.id}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-ink/[0.03]">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: COLOR_HEX[scoreColor(it.score)] }}
                aria-hidden="true"
              />
              <span className="shrink-0 text-lg" aria-hidden="true">
                {it.emoji ?? "❔"}
              </span>
              <span className="flex-1 truncate text-[15px] font-semibold">
                {i + 1}. {it.prompt}
              </span>
              <span className="font-display text-lg font-extrabold">{it.score}</span>
            </summary>
            <div className="space-y-3 px-5 pb-5 text-sm">
              {it.images.length > 0 && (
                <div className="max-w-[320px]">
                  <QuestionMedia images={it.images} eager={false} />
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-muted">Réponse</span>
                <strong className="text-right">{formatAnswer(it.correct_answer, it.type, it.unit)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">Toi</span>
                <strong className="text-right">{formatAnswer(it.user_answer, it.type, it.unit)}</strong>
              </div>
              {it.explanation && <p className="text-muted">{it.explanation}</p>}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
