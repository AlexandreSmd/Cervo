// Composants d'interface de l'espace fondateur : KPI, panneaux, sélecteurs, tiroir latéral.
import { useEffect, type ReactNode } from "react";
import { KindIcon } from "../components/KindIcon";
import { kindInfo } from "../lib/kinds";

export function Kpi({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl p-5 ${accent ? "bg-ink text-bg" : "bg-card"}`}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${accent ? "opacity-70" : "text-muted"}`}>{label}</div>
      <div className="mt-1 font-display text-4xl font-extrabold">{value}</div>
      {hint && <div className={`text-xs ${accent ? "opacity-70" : "text-muted"}`}>{hint}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl bg-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-ink/5 p-1" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition ${value === v ? "bg-card shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function CategoryDot({ category, className = "h-2.5 w-2.5" }: { category: string; className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: kindInfo(category).color }}
      aria-hidden="true"
    />
  );
}

/** Emoji et nom du type d'une question. */
export function KindTag({ category, short }: { category: string; short?: boolean }) {
  const info = kindInfo(category);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold" style={{ color: info.color }}>
      <KindIcon kind={category} className="h-4 w-4" />
      {short ? null : info.label}
    </span>
  );
}

export function DiffBars({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={["", "Facile", "Moyen", "Difficile"][level]}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-2.5 rounded-full ${i <= level ? "bg-ink" : "bg-ink/15"}`} />
      ))}
    </span>
  );
}

export function Rate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">-</span>;
  const color = value >= 70 ? "#1FA971" : value >= 40 ? "#F2A33A" : "#E5484D";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-ink/10">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </span>
      <span className="w-9 text-right text-sm font-semibold tabular-nums">{value}%</span>
    </span>
  );
}

/** Panneau latéral (droite) pour éditer ou consulter. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Fermer" />
      <div className={`relative flex h-full w-full flex-col bg-bg shadow-2xl ${wide ? "max-w-5xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-line bg-card px-6 py-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-lg" aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}
