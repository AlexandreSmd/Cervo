import type { QuestionType } from "../lib/types";

export const CATEGORIES: Record<string, { label: string; pillar: string }> = {
  culture: { label: "Culture générale", pillar: "memoire" },
  logique: { label: "Logique", pillar: "raisonnement" },
  reflexion: { label: "Réflexion", pillar: "raisonnement" },
  geographie: { label: "Géographie", pillar: "estimation" },
  histoire: { label: "Histoire", pillar: "memoire" },
  sciences: { label: "Sciences", pillar: "estimation" },
  nature: { label: "Nature et animaux", pillar: "memoire" },
  arts: { label: "Arts et culture", pillar: "memoire" },
  sport: { label: "Sport", pillar: "memoire" },
  estimation: { label: "Estimation", pillar: "estimation" },
  vrai_faux: { label: "Vrai ou faux", pillar: "esprit_critique" },
};

export const CATEGORY_COLOR: Record<string, string> = {
  culture: "#1FA971", histoire: "#0EA5A4", arts: "#16A34A", nature: "#65A30D", sport: "#0891B2",
  logique: "#5B4BFF", reflexion: "#8B5CF6", estimation: "#F2A33A", geographie: "#EA8A1A", sciences: "#D97706",
  vrai_faux: "#E5484D",
};

export const INPUT_FORMATS = { text: "Texte", image: "Photo", images2: "2 photos" } as const;
export type InputFormat = keyof typeof INPUT_FORMATS;

export const ANSWER_FORMATS: Record<QuestionType, string> = {
  binary: "Vrai / Faux", mcq: "QCM", numeric: "Nombre", short_text: "Texte libre",
};

export const DIFFICULTIES: Record<number, string> = { 1: "Facile", 2: "Moyen", 3: "Difficile" };
export const STATUSES = { published: "Publiée", draft: "Brouillon", retired: "Retirée" } as const;

export const INPUT_ICON: Record<string, string> = { text: "Aa", image: "▣", images2: "▣▣" };
export const ANSWER_ICON: Record<QuestionType, string> = { binary: "V/F", mcq: "ABCD", numeric: "123", short_text: "abc" };

/** Modèles de questions : un format d'entrée + un format de réponse, pré-remplis. */
export interface Template {
  key: string;
  title: string;
  hint: string;
  input: InputFormat;
  type: QuestionType;
  category: string;
  prompt?: string;
  choices?: string[];
}

export const TEMPLATES: Template[] = [
  { key: "vf", title: "Vrai ou faux", hint: "Texte → Vrai/Faux", input: "text", type: "binary", category: "vrai_faux" },
  { key: "qcm", title: "QCM", hint: "Texte → 4 choix", input: "text", type: "mcq", category: "culture" },
  { key: "nombre", title: "Estimation", hint: "Texte → nombre", input: "text", type: "numeric", category: "estimation" },
  { key: "libre", title: "Réponse libre", hint: "Texte → mot", input: "text", type: "short_text", category: "logique" },
  { key: "personne", title: "Reconnaître une personne", hint: "Photo → nom", input: "image", type: "short_text", category: "culture", prompt: "Qui est cette personne ?" },
  { key: "lieu", title: "Reconnaître un lieu", hint: "Photo → 4 choix", input: "image", type: "mcq", category: "geographie", prompt: "Où a été prise cette photo ?" },
  { key: "photo-nombre", title: "Estimer sur photo", hint: "Photo → nombre", input: "image", type: "numeric", category: "estimation", prompt: "Quelle est la hauteur de ce monument, en mètres ?" },
  { key: "comparer", title: "Comparer 2 photos", hint: "2 photos → A ou B", input: "images2", type: "mcq", category: "estimation", prompt: "Laquelle… ?", choices: ["La photo A", "La photo B", "Les deux", "Aucune des deux"] },
];
