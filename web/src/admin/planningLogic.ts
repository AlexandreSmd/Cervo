// Logique pure du planning (testée sans navigateur) : effet d'un glisser-déposer sur les journées.

export type DragSource = { kind: "slot"; date: string; index: number } | { kind: "bank"; id: string };

export const DRAG_MIME = "application/x-cervo";

/**
 * Journées modifiées quand on dépose `src` sur la position `index` de `date`.
 * - question de la banque → remplace la question visée (ou échange si elle est déjà dans la journée) ;
 * - même journée → déplace la question (réordonne) ;
 * - autre journée → échange les deux questions (refusé si cela créerait un doublon).
 * Renvoie {} si l'opération est impossible.
 */
export function applyDrop(days: Record<string, string[]>, src: DragSource, date: string, index: number): Record<string, string[]> {
  const target = [...days[date]];
  if (src.kind === "bank") {
    const existing = target.indexOf(src.id);
    if (existing >= 0) [target[existing], target[index]] = [target[index], target[existing]];
    else target[index] = src.id;
    return { [date]: target };
  }
  if (src.date === date) {
    if (src.index === index) return {};
    const [moved] = target.splice(src.index, 1);
    target.splice(index, 0, moved);
    return { [date]: target };
  }
  const source = [...days[src.date]];
  const a = source[src.index];
  const b = target[index];
  if (target.includes(a) || source.includes(b)) return {};
  source[src.index] = b;
  target[index] = a;
  return { [src.date]: source, [date]: target };
}

export function readDrag(e: React.DragEvent): DragSource | null {
  try {
    return JSON.parse(e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
}

export function writeDrag(e: React.DragEvent, src: DragSource) {
  const data = JSON.stringify(src);
  e.dataTransfer.setData(DRAG_MIME, data);
  e.dataTransfer.setData("text/plain", data);
  e.dataTransfer.effectAllowed = src.kind === "bank" ? "copy" : "move";
}
