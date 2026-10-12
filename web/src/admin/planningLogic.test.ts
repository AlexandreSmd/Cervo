import { describe, expect, it } from "vitest";
import { applyDrop } from "./planningLogic";

// Deux journées, trois types (t = taille, d = dictée, m = mémoire) dans l'ordre.
const KIND: Record<string, string> = { t1: "t", t2: "t", t3: "t", d1: "d", d2: "d", d3: "d", m1: "m", m2: "m" };
const kindOf = (id: string) => KIND[id];
const days = { "2026-10-11": ["t1", "d1", "m1"], "2026-10-12": ["t2", "d2", "m2"] };

describe("applyDrop", () => {
  it("remplace par une question du même type depuis la banque", () => {
    expect(applyDrop(days, { kind: "bank", id: "t3" }, "2026-10-11", 0, kindOf)).toEqual({ "2026-10-11": ["t3", "d1", "m1"] });
  });
  it("refuse une question d'un autre type", () => {
    expect(applyDrop(days, { kind: "bank", id: "d3" }, "2026-10-11", 0, kindOf)).toEqual({});
  });
  it("échange la même ligne entre deux journées", () => {
    expect(applyDrop(days, { kind: "slot", date: "2026-10-11", index: 1 }, "2026-10-12", 1, kindOf)).toEqual({
      "2026-10-11": ["t1", "d2", "m1"],
      "2026-10-12": ["t2", "d1", "m2"],
    });
  });
  it("refuse de réordonner une journée (l'ordre des types est fixe)", () => {
    expect(applyDrop(days, { kind: "slot", date: "2026-10-11", index: 0 }, "2026-10-11", 2, kindOf)).toEqual({});
  });
  it("refuse un échange entre lignes de types différents", () => {
    expect(applyDrop(days, { kind: "slot", date: "2026-10-11", index: 0 }, "2026-10-12", 1, kindOf)).toEqual({});
  });
  it("refuse un doublon", () => {
    expect(applyDrop(days, { kind: "bank", id: "t1" }, "2026-10-11", 0, kindOf)).toEqual({});
  });
});
