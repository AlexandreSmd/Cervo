// Croix de suppression d'une question : un premier clic demande confirmation, le second supprime
// à jamais et remplace la question aujourd'hui et dans les jours planifiés (même type).
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";

export function DeleteQuestionButton({ id, onDone }: { id: string; onDone?: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await api.admin.remove(id);
      const days = Object.keys(res.replaced).length;
      onDone?.(days ? `Question supprimée et remplacée sur ${days} jour${days > 1 ? "s" : ""}` : "Question supprimée");
      await qc.invalidateQueries();
    } catch (err) {
      onDone?.((err as Error).message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="chip bg-bad text-white" disabled={busy} onClick={remove} data-testid={`confirm-delete-${id}`}>
          {busy ? "…" : "Supprimer"}
        </button>
        <button type="button" className="chip" onClick={() => setConfirming(false)}>
          Non
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      title="Supprimer à jamais (remplacée par une autre question du même type)"
      aria-label="Supprimer la question"
      data-testid={`delete-${id}`}
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-bad/10 hover:text-bad"
    >
      ×
    </button>
  );
}
