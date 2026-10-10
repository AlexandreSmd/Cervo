import { COLOR_HEX, formatAnswer, scoreColor } from "../lib/format";
import type { DayItem } from "../lib/types";
import { CategoryTag } from "./CategoryTag";
import { QuestionImage } from "./QuestionImage";

/** Détail des 10 questions d'une journée : ta réponse, la bonne réponse, ton score. */
export function DayItems({ items }: { items: DayItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={it.id} className="card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-muted">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLOR_HEX[scoreColor(it.score)] }} aria-hidden="true" />
              Q{i + 1}
              <CategoryTag label={it.category_label} pillar={it.pillar} />
            </span>
            <span className="font-display text-lg font-extrabold" style={{ color: COLOR_HEX[scoreColor(it.score)] }}>{it.score}</span>
          </div>
          <p className="font-semibold">{it.prompt}</p>
          {it.image_url && (
            <div className="max-w-[240px]"><QuestionImage src={it.image_url} alt={it.image_alt} credit={null} eager={false} /></div>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted">Ta réponse : </span><strong>{formatAnswer(it.user_answer, it.type, it.unit)}</strong></div>
            <div><span className="text-muted">Bonne réponse : </span><strong>{formatAnswer(it.correct_answer, it.type, it.unit)}</strong></div>
          </div>
          {it.explanation && (
            <details className="text-sm text-muted">
              <summary className="cursor-pointer font-semibold text-accent">Explication</summary>
              <p className="mt-1">{it.explanation}</p>
              {it.source_url && <a href={it.source_url} target="_blank" rel="noreferrer" className="link">Source ↗</a>}
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
