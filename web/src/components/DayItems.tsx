// Liste repliable des 10 questions d'une journée (résultats, historique).
import { COLOR_HEX, formatAnswer, scoreColor } from "../lib/format";
import type { DayItem } from "../lib/types";
import { kindInfo } from "../lib/kinds";
import { KindIcon } from "./KindIcon";
import { QuestionMedia } from "./QuestionCard";

/** Les 10 questions d'une journée, repliées : on déplie pour voir le détail. */
export function DayItems({ items }: { items: DayItem[] }) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-sm text-muted">Touche une question pour revoir la correction.</p>
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
                <span className="shrink-0" style={{ color: kindInfo(it.category).color }}>
                  <KindIcon kind={it.category} className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 truncate text-[15px] font-semibold">
                  {i + 1}. {it.prompt}
                </span>
                <span className="w-10 shrink-0 text-right font-display text-lg font-extrabold tabular-nums">{it.score}</span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
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
    </section>
  );
}
