// Logique pure du planning (testée sans navigateur) : effet d'un glisser-déposer sur les journées.
// Une journée = une question par type, dans l'ordre fixe des types : on ne déplace jamais une
// question d'une ligne à l'autre, on remplace la question d'un type par une autre du même type.

export type DragSource = { kind: "slot"; date: string; index: number } | { kind: "bank"; id: string };

export const DRAG_MIME = "application/x-cervo";

/**
 * Journées modifiées quand on dépose `src` sur la ligne `index` de `date`.
 * - question de la banque → remplace la question de la ligne, si elle est du même type ;
 * - ligne d'une autre journée (même type) → échange les deux questions ;
 * - même journée → rien (l'ordre des types est fixe).
 * Renvoie {} si l'opération est impossible (type différent, doublon).
 * `kindOf` : le type d'une question (son champ `category`).
 */
export function applyDrop(
  days: Record<string, string[]>,
  src: DragSource,
  date: string,
  index: number,
  kindOf: (id: string) => string | undefined,
): Record<string, string[]> {
  const target = [...days[date]];
  const current = target[index];
  if (src.kind === "bank") {
    if (src.id === current || target.includes(src.id) || kindOf(src.id) !== kindOf(current)) return {};
    target[index] = src.id;
    return { [date]: target };
  }
  if (src.date === date) return {};
  const source = [...days[src.date]];
  const moved = source[src.index];
  if (kindOf(moved) !== kindOf(current) || target.includes(moved) || source.includes(current)) return {};
  source[src.index] = current;
  target[index] = moved;
  return { [src.date]: source, [date]: target };
}

/** Pourquoi un dépôt est refusé (message pour le fondateur). */
export function dropRefusal(
  days: Record<string, string[]>,
  src: DragSource,
  date: string,
  index: number,
  kindOf: (id: string) => string | undefined,
) {
  const current = days[date][index];
  const moved = src.kind === "bank" ? src.id : days[src.date][src.index];
  if (src.kind === "slot" && src.date === date) return "L'ordre des types est fixe : remplace plutôt la question.";
  if (kindOf(moved) !== kindOf(current)) return "Dépose la question sur la ligne de son type.";
  return "Cette question est déjà dans cette journée.";
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
