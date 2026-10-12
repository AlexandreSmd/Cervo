// Classement (chronologie, ordre d'apparition) : on touche les éléments dans l'ordre.
export function OrderInput({
  items,
  picked,
  disabled,
  onChange,
}: {
  items: string[];
  picked: string[];
  disabled: boolean;
  onChange: (p: string[]) => void;
}) {
  return (
    <div className="space-y-2" aria-label="Classement">
      {items.map((item) => {
        const rank = picked.indexOf(item);
        const chosen = rank >= 0;
        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            data-testid="order-item"
            onClick={() => onChange(chosen ? picked.filter((p) => p !== item) : [...picked, item])}
            className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-base font-semibold transition ${chosen ? "border-ink bg-ink text-bg" : "border-ink/15 bg-card hover:border-ink/40"}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-extrabold ${chosen ? "bg-bg text-ink" : "border-2 border-dashed border-ink/25"}`}
            >
              {chosen ? rank + 1 : ""}
            </span>
            {item}
          </button>
        );
      })}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Touche dans l'ordre · retouche pour annuler</span>
        {picked.length > 0 && (
          <button type="button" className="font-semibold text-ink" onClick={() => onChange([])}>
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}
