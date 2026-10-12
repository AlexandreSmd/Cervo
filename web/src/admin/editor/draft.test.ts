import { describe, expect, it } from "vitest";
import type { AdminQuestion } from "../../lib/types";
import { fromQuestion, newDraft, toPayload } from "./draft";

const admin = (q: Partial<AdminQuestion>) =>
  ({ images: [], status: "published", difficulty: 2, explanation: "Une explication.", prompt: "Une question ?", ...q }) as AdminQuestion;

describe("brouillon de l'éditeur", () => {
  it("chaque type démarre avec sa mécanique par défaut", () => {
    expect(newDraft("taille").type).toBe("size");
    expect(newDraft("devinette").type).toBe("riddle");
    expect(newDraft("memoire").type).toBe("recall");
    expect(newDraft("dictee").type).toBe("dictation");
  });

  it("chronologie : éléments et dates, aller-retour sans perte", () => {
    const q = admin({
      category: "chronologie",
      type: "order",
      correct_answer: ["Rome", "Oxford", "Aztèques"],
      order_details: ["753 av. J.-C.", "1096", "1325"],
    });
    expect(toPayload(fromQuestion(q))).toMatchObject({
      correct_answer: q.correct_answer,
      order_details: q.order_details,
      category: "chronologie",
    });
  });

  it("devinette : indices et alias", () => {
    const d = { ...newDraft("devinette"), correct: "koala", aliases: "koalas | le koala", clues: ["Un.", "Deux.", "Trois.", ""] };
    expect(toPayload(d)).toMatchObject({
      type: "riddle",
      correct_answer: "koala",
      accepted_aliases: ["koalas", "le koala"],
      clues: ["Un.", "Deux.", "Trois."],
    });
  });

  it("mémoire : la réponse attendue est la liste mémorisée", () => {
    const d = { ...newDraft("memoire"), memItems: "7\n2\n9", recallOrdered: false };
    expect(toPayload(d)).toMatchObject({
      type: "recall",
      correct_answer: ["7", "2", "9"],
      recall_ordered: false,
      memorize: { items: ["7", "2", "9"] },
    });
    expect(toPayload({ ...d, type: "order" })).toMatchObject({ correct_answer: ["7", "2", "9"] });
  });

  it("estimation, pourcentage, taille : des nombres (virgule acceptée)", () => {
    expect(toPayload({ ...newDraft("estimation"), correct: "6,5", unit: "t", factor: "3" })).toMatchObject({
      correct_answer: 6.5,
      numeric_config: { scale: "log", factor: 3, unit: "t" },
    });
    expect(toPayload({ ...newDraft("stat"), correct: "71" }).correct_answer).toBe(71);
    expect(toPayload({ ...newDraft("taille"), correct: "0,28" }).correct_answer).toBe(0.28);
  });

  it("chrono vide = calculé, sinon imposé", () => {
    expect(toPayload(newDraft("vocabulaire")).time_limit).toBeUndefined();
    expect(toPayload({ ...newDraft("vocabulaire"), timeLimit: "25" }).time_limit).toBe(25);
  });
});
