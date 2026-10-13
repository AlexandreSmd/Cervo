// États d'attente et d'erreur communs.
import { useAuth } from "../lib/auth";

/** Attente : la forme de l'écran qui arrive (titre, carte, bouton), plutôt qu'un écran vide. */
export function Loading({ label = "Chargement…" }: { label?: string }) {
  const { error } = useAuth();
  if (error) return <ErrorBox message={error} onRetry={() => window.location.reload()} />;
  return (
    <div className="space-y-4 pt-4" role="status" aria-label={label}>
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-10 w-4/5" />
      <div className="card space-y-4 p-6">
        <div className="skeleton h-5 w-1/3" />
        <div className="skeleton h-8 w-2/3" />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="skeleton aspect-square" />
          ))}
        </div>
        <div className="skeleton h-[52px] w-full" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mt-4 space-y-3 p-6 text-center" role="alert">
      <p className="font-display text-xl font-bold">Oups</p>
      <p className="text-muted">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}
