// En-tête d'une question : type (emoji + nom), difficulté, consigne, énoncé, photos (A et B s'il y en a deux).
import { kindInfo } from "../lib/kinds";
import { KindIcon } from "./KindIcon";
import type { ImageRef, PublicQuestion } from "../lib/types";

export function Difficulty({ level }: { level: number }) {
  const label = ["", "Facile", "Moyen", "Difficile"][level] ?? "";
  return (
    <span className="inline-flex items-center gap-0.5" title={label} aria-label={label}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i <= level ? "bg-ink" : "bg-ink/15"}`} />
      ))}
    </span>
  );
}

/**
 * Badge du type de question, façon tampon : l'icône sur la couleur du type, le nom en capitales,
 * et le numéro de la question dans le quiz.
 */
export function KindChip({ category, label, position }: { category: string; label: string; position?: number }) {
  const info = kindInfo(category, label);
  return (
    <span className="inline-flex items-center gap-2" data-testid="kind-chip">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink text-white shadow-hard-sm"
        style={{ backgroundColor: info.color }}
      >
        <KindIcon kind={category} className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[12px] font-extrabold uppercase tracking-[0.14em]">{label}</span>
      {position !== undefined && (
        <span className="font-display text-[12px] font-bold text-muted">{String(position + 1).padStart(2, "0")}</span>
      )}
    </span>
  );
}

/** Une ou deux photos ; avec deux, elles sont repérées A et B. */
export function QuestionMedia({ images, eager = true }: { images: ImageRef[]; eager?: boolean }) {
  if (!images.length) return null;
  const two = images.length > 1;
  return (
    <div className={two ? "grid grid-cols-2 gap-2" : ""}>
      {images.map((img, i) => (
        <figure key={i} className="relative overflow-hidden rounded-2xl bg-bg">
          <img
            src={img.url}
            alt={img.alt}
            width={600}
            height={400}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-auto w-full"
          />
          {two && (
            <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-bg">
              {String.fromCharCode(65 + i)}
            </span>
          )}
          {img.credit && (
            <figcaption className="absolute bottom-1 right-2 text-[10px] text-muted/80">
              {img.credit.length > 40 ? "Illustration" : img.credit}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export function QuestionHeader({
  question,
}: {
  question: Pick<PublicQuestion, "category" | "category_label" | "emoji" | "instruction" | "difficulty" | "prompt" | "images"> & {
    position?: number;
  };
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <KindChip category={question.category} label={question.category_label} position={question.position} />
        <Difficulty level={question.difficulty} />
      </div>
      {question.instruction && <p className="text-xs font-bold uppercase tracking-wider text-muted">{question.instruction}</p>}
      <h1 className="text-[26px] font-bold leading-tight" data-testid="question-prompt">
        {question.prompt}
      </h1>
      <QuestionMedia images={question.images} />
    </div>
  );
}
