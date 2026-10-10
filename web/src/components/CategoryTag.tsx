const PILLAR_STYLE: Record<string, string> = {
  raisonnement: "bg-accent/10 text-accent",
  estimation: "bg-[#F2A33A]/15 text-[#B26A00] dark:text-[#F2C27A]",
  memoire: "bg-[#1FA971]/10 text-[#137A51] dark:text-[#6FD6A8]",
  esprit_critique: "bg-[#E5484D]/10 text-[#B4252A] dark:text-[#FF9A9D]",
};

export function CategoryTag({ label, pillar }: { label: string; pillar: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${PILLAR_STYLE[pillar] ?? "bg-line text-ink"}`}>
      {label}
    </span>
  );
}

export function DifficultyDots({ level }: { level: number }) {
  const label = ["", "Facile", "Moyen", "Difficile"][level] ?? "";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted" title={label}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "bg-muted" : "bg-line"}`} />
      ))}
      <span className="sr-only sm:not-sr-only sm:ml-1">{label}</span>
    </span>
  );
}
