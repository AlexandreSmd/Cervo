// Libellés et règles de l'espace fondateur (miroir de api/cervo/domain/catalog.py et domain/timing.py).
import { KINDS, kindInfo } from "../lib/kinds";
import type { QuestionType } from "../lib/types";

export { KINDS, kindInfo };

/** Ce qu'il faut savoir pour écrire une bonne question de chaque type, et les mécaniques possibles. */
export interface KindRules {
  instruction: string;
  guide: string;
  answerTypes: QuestionType[];
  /** Chrono de base (facile, moyen, difficile) ; null : sans chrono. */
  baseTime: [number, number, number] | null;
  /** Énoncé proposé pour une nouvelle question. */
  prompt: string;
}

export const KIND_RULES: Record<string, KindRules> = {
  vocabulaire: {
    instruction: "Le mot juste",
    guide: "Synonyme, contraire, sens précis d'un mot. 4 choix plausibles : les pièges sont des paronymes ou des faux amis.",
    answerTypes: ["mcq"],
    baseTime: [12, 15, 18],
    prompt: "Quel est le synonyme de « … » ?",
  },
  taille: {
    instruction: "Ajuste la taille",
    guide: "Deux objets : l'un est fixe, le joueur ajuste l'autre. Le rapport doit être vérifiable (hauteur, longueur ou diamètre).",
    answerTypes: ["size"],
    baseTime: [15, 18, 20],
    prompt: "Ajuste … par rapport à … (hauteur).",
  },
  fait: {
    instruction: "Vrai ou faux ?",
    guide: "Un fait surprenant et sourcé. L'explication est le cœur de la question : elle doit donner envie de la raconter.",
    answerTypes: ["binary", "mcq"],
    baseTime: [15, 18, 20],
    prompt: "",
  },
  memoire: {
    instruction: "Regarde bien, puis réponds",
    guide:
      "Une liste montrée quelques secondes puis cachée. Ensuite : trouver l'intrus (QCM), tout réécrire (rappel) ou remettre dans l'ordre d'apparition.",
    answerTypes: ["recall", "mcq", "order"],
    baseTime: [15, 20, 25],
    prompt: "Retape-les, dans l'ordre.",
  },
  stat: {
    instruction: "Devine le pourcentage",
    guide: "Un pourcentage réel sur une population. Source fiable obligatoire, chiffre récent.",
    answerTypes: ["percent"],
    baseTime: [15, 18, 20],
    prompt: "Quelle part de … ?",
  },
  chronologie: {
    instruction: "Du plus ancien au plus récent",
    guide: "4 à 5 événements à classer. Mélange des époques proches et lointaines ; chaque élément a sa date, montrée après la réponse.",
    answerTypes: ["order"],
    baseTime: [20, 25, 30],
    prompt: "Classe ces événements, du plus ancien au plus récent.",
  },
  estimation: {
    instruction: "Ton estimation",
    guide: "Une grandeur moyenne (poids, taille, durée…). Score en proportion : l'ordre de grandeur compte plus que le chiffre exact.",
    answerTypes: ["numeric"],
    baseTime: [15, 20, 25],
    prompt: "Combien pèse en moyenne … ?",
  },
  devinette: {
    instruction: "Trouve avec le moins d'indices",
    guide: "Un animal, un pays, une personne… 3 à 5 indices du plus vague au plus précis. Chaque indice demandé coûte des points.",
    answerTypes: ["riddle"],
    baseTime: [40, 45, 50],
    prompt: "Quel animal suis-je ?",
  },
  enigme: {
    instruction: "Prends le temps de réfléchir",
    guide: "Un problème qui se résout par le raisonnement, pas par la culture : suite, logique, petit calcul malin, piège d'intuition.",
    answerTypes: ["mcq", "short_text"],
    baseTime: [45, 60, 90],
    prompt: "",
  },
  dictee: {
    instruction: "Écoute et écris",
    guide:
      "Deux phrases lues par la voix du téléphone. Pas de chrono : le joueur réécoute autant qu'il veut. Viser les accords et les pièges.",
    answerTypes: ["dictation"],
    baseTime: null,
    prompt: "Écoute et écris les deux phrases.",
  },
};

export const ANSWER_FORMATS: Record<QuestionType, string> = {
  binary: "Vrai / Faux",
  mcq: "QCM",
  numeric: "Nombre",
  short_text: "Texte libre",
  order: "Classement",
  size: "Taille",
  dictation: "Dictée",
  recall: "Rappel",
  percent: "Pourcentage",
  riddle: "Indices",
};

/** Ce que la mécanique demande au joueur (affiché dans l'éditeur). */
export const ANSWER_HINTS: Partial<Record<QuestionType, string>> = {
  binary: "Le joueur répond Vrai ou Faux.",
  mcq: "4 choix, mélangés pour le joueur.",
  recall: "Le joueur réécrit la liste mémorisée.",
  order: "Le joueur remet les éléments dans l'ordre d'apparition.",
  short_text: "Le joueur tape sa réponse (casse et accents ignorés).",
};

export const DIFFICULTIES: Record<number, string> = { 1: "Facile", 2: "Moyen", 3: "Difficile" };
export const STATUSES = { published: "Publiée", draft: "Brouillon", retired: "Retirée" } as const;

/** Chrono calculé (miroir de domain/timing.py), pour l'aperçu de l'éditeur. */
export function computeTimeLimit(q: {
  category: string;
  type: QuestionType;
  difficulty: number;
  prompt: string;
  choices?: string[] | null;
  images?: unknown[];
  correct_answer?: unknown;
}): number | null {
  const rules = KIND_RULES[q.category];
  if (!rules) return 15;
  if (!rules.baseTime) return null;
  const words = (t: string) => (t.match(/[\p{L}\p{N}_]+/gu) ?? []).length;
  let seconds = rules.baseTime[Math.min(3, Math.max(1, q.difficulty)) - 1];
  let reading = Math.max(0, words(q.prompt) - 15) / 3;
  if (q.type === "mcq") reading += Math.max(0, (q.choices ?? []).reduce((n, c) => n + words(c), 0) - 8) / 3;
  seconds += Math.min(20, reading) + 3 * (q.images?.length ?? 0);
  if (q.type === "order" && Array.isArray(q.correct_answer)) seconds += 4 * Math.max(0, q.correct_answer.length - 4);
  if (q.type === "recall" && Array.isArray(q.correct_answer)) seconds += 2 * q.correct_answer.length;
  return Math.ceil(seconds / 5) * 5;
}

/** Durée de mémorisation calculée (miroir de domain/timing.py). */
export function computeMemorizeSeconds(items: number, difficulty: number): number {
  if (!items) return 5;
  const perItem = { 1: 1.2, 2: 0.9, 3: 0.7 }[Math.min(3, Math.max(1, difficulty)) as 1 | 2 | 3];
  return Math.min(15, Math.max(3, Math.round(2 + perItem * items)));
}
