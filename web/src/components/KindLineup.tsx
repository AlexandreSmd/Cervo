// Le programme du jour : les 10 types dans l'ordre, colorés selon le score une fois joués.
import { COLOR_HEX, scoreColor } from "../lib/format";
import { kindInfo } from "../lib/kinds";
import { KindIcon } from "./KindIcon";
import type { PublicQuestion } from "../lib/types";

export function KindLineup({ questions, scores }: { questions: Pick<PublicQuestion, "category" | "category_label">[]; scores: number[] }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Les 10 questions du jour" data-testid="lineup">
      {questions.map((q, i) => {
        const info = kindInfo(q.category, q.category_label);
        const score = scores[i];
        const played = score !== undefined;
        return (
          <li
            key={i}
            title={played ? `${info.label} : ${score}/100` : info.label}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 transition"
            style={
              played
                ? { backgroundColor: COLOR_HEX[scoreColor(score)], borderColor: "rgb(var(--ink))", color: "#fff" }
                : { borderColor: `${info.color}55`, color: info.color, backgroundColor: `${info.color}12` }
            }
          >
            <KindIcon kind={q.category} className="h-6 w-6" />
            <span className="sr-only">
              {info.label}
              {played ? ` : ${score} points` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
