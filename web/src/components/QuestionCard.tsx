import type { ImageRef, PublicQuestion } from "../lib/types";

const PILLAR_DOT: Record<string, string> = {
  raisonnement: "bg-accent", estimation: "bg-mid", memoire: "bg-good", esprit_critique: "bg-bad",
};

export function Difficulty({ level }: { level: number }) {
  const label = ["", "Facile", "Moyen", "Difficile"][level] ?? "";
  return (
    <span className="inline-flex items-center gap-0.5" title={label} aria-label={label}>
      {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-3 rounded-full ${i <= level ? "bg-ink" : "bg-ink/15"}`} />)}
    </span>
  );
}

export function CategoryChip({ label, pillar }: { label: string; pillar: string }) {
  return (
    <span className="chip">
      <span className={`h-2 w-2 rounded-full ${PILLAR_DOT[pillar] ?? "bg-muted"}`} aria-hidden="true" />
      {label}
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
          <img src={img.url} alt={img.alt} width={600} height={400} loading={eager ? "eager" : "lazy"} decoding="async" className="h-auto w-full" />
          {two && <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-bg">{String.fromCharCode(65 + i)}</span>}
          {img.credit && <figcaption className="absolute bottom-1 right-2 text-[10px] text-muted/80">{img.credit.length > 40 ? "Illustration" : img.credit}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export function QuestionHeader({ question }: { question: Pick<PublicQuestion, "category_label" | "pillar" | "difficulty" | "prompt" | "images"> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CategoryChip label={question.category_label} pillar={question.pillar} />
        <Difficulty level={question.difficulty} />
      </div>
      <h1 className="text-[26px] font-bold leading-tight" data-testid="question-prompt">{question.prompt}</h1>
      <QuestionMedia images={question.images} />
    </div>
  );
}
