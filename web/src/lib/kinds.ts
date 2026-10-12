// Les 10 types de question, dans l'ordre du quiz (miroir de api/cervo/domain/catalog.py).
// Une question de chaque type par jour, toujours dans cet ordre.

export interface KindInfo {
  key: string;
  label: string;
  emoji: string;
  pillar: string;
  color: string;
}

export const KINDS: KindInfo[] = [
  { key: "vocabulaire", label: "Vocabulaire", emoji: "📖", pillar: "langage", color: "#DB2777" },
  { key: "taille", label: "Taille", emoji: "📏", pillar: "estimation", color: "#F2A33A" },
  { key: "fait", label: "Fait étonnant", emoji: "💡", pillar: "culture", color: "#0EA5A4" },
  { key: "memoire", label: "Mémoire", emoji: "🧠", pillar: "memoire", color: "#0284C7" },
  { key: "stat", label: "Statistique", emoji: "📊", pillar: "estimation", color: "#EA8A1A" },
  { key: "chronologie", label: "Chronologie", emoji: "⏳", pillar: "culture", color: "#16A34A" },
  { key: "estimation", label: "Estimation", emoji: "⚖️", pillar: "estimation", color: "#D97706" },
  { key: "devinette", label: "Devinette", emoji: "🕵️", pillar: "logique", color: "#8B5CF6" },
  { key: "enigme", label: "Énigme", emoji: "🧩", pillar: "logique", color: "#5B4BFF" },
  { key: "dictee", label: "Dictée", emoji: "✍️", pillar: "langage", color: "#BE185D" },
];

export const KIND_BY_KEY: Record<string, KindInfo> = Object.fromEntries(KINDS.map((k) => [k.key, k]));

export const PILLARS: Record<string, string> = {
  logique: "Logique",
  estimation: "Estimation",
  memoire: "Mémoire",
  langage: "Langage",
  culture: "Culture",
};

/** Infos d'un type ; les anciennes catégories (avant les 10 types) restent affichables. */
export function kindInfo(key: string, fallbackLabel?: string): KindInfo {
  return KIND_BY_KEY[key] ?? { key, label: fallbackLabel ?? key, emoji: "❔", pillar: "culture", color: "#70748C" };
}
