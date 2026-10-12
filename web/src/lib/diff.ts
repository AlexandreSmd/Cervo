// Correction d'une dictée, mot à mot : ce qui est juste, faux, oublié ou en trop.
// L'alignement suit la même règle que le score côté serveur (distance d'édition sur les mots) ;
// la casse et la ponctuation ne comptent pas, les accents si.

export type DiffStatus = "ok" | "wrong" | "missing" | "extra";

export interface DiffToken {
  /** Le mot attendu (ou le mot tapé en trop pour « extra »), tel qu'écrit, ponctuation comprise. */
  text: string;
  status: DiffStatus;
  /** Ce que le joueur a tapé à la place (« wrong »). */
  typed?: string;
}

function normalize(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, "");
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => normalize(w));
}

export function dictationDiff(expected: string, typed: string): DiffToken[] {
  const a = words(expected);
  const b = words(typed);
  const na = a.map(normalize);
  const nb = b.map(normalize);
  // d[i][j] : distance entre les i premiers mots attendus et les j premiers mots tapés.
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (na[i - 1] === nb[j - 1] ? 0 : 1));
    }
  }
  const out: DiffToken[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (na[i - 1] === nb[j - 1] ? 0 : 1)) {
      out.push(na[i - 1] === nb[j - 1] ? { text: a[i - 1], status: "ok" } : { text: a[i - 1], status: "wrong", typed: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      out.push({ text: a[i - 1], status: "missing" });
      i--;
    } else {
      out.push({ text: b[j - 1], status: "extra" });
      j--;
    }
  }
  return out.reverse();
}

/** Découpe un texte en phrases (pour réécouter une phrase à la fois). */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]*/g) ?? []).map((s) => s.trim()).filter(Boolean);
}
