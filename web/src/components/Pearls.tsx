// Motif signature : 10 perles colorées selon le score de chaque question.
import { COLOR_HEX, scoreColor } from "../lib/format";

interface Props {
  scores: (number | null | undefined)[];
  current?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZES = { sm: "max-w-[12px]", md: "max-w-[20px]", lg: "max-w-[28px]" };

/** Motif signature : 10 perles, une par question, colorées selon le score. */
export function Pearls({ scores, current, size = "md", label }: Props) {
  const items = Array.from({ length: 10 }, (_, i) => scores[i]);
  const summary = label ?? `${items.filter((s) => s != null).length} questions sur 10 jouées`;
  return (
    <div className="flex items-center justify-between gap-1" role="img" aria-label={summary}>
      {items.map((s, i) => {
        const played = s !== null && s !== undefined;
        const isCurrent = current === i;
        return (
          <span
            key={i}
            data-testid="pearl"
            className={`${SIZES[size]} aspect-square min-w-0 flex-1 rounded-full transition-all ${played ? "animate-pop" : ""} ${
              isCurrent ? "ring-4 ring-accent/30 bg-accent" : played ? "" : "bg-line"
            }`}
            style={played ? { backgroundColor: COLOR_HEX[scoreColor(s as number)] } : undefined}
            title={played ? `Question ${i + 1} : ${s}/100` : `Question ${i + 1}`}
          />
        );
      })}
    </div>
  );
}
