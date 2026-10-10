// États d'attente et d'erreur communs.
import { useAuth } from "../lib/auth";

export function Loading({ label = "Chargement…" }: { label?: string }) {
  const { error } = useAuth();
  if (error) return <ErrorBox message={error} />;
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-muted" role="status">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-3 w-3 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <span>{label}</span>
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
