import { describe, expect, it } from "vitest";
import { applyDrop } from "./planningLogic";

const days = { "2026-10-11": ["a", "b", "c"], "2026-10-12": ["d", "e", "f"] };

describe("applyDrop", () => {
  it("réordonne dans la même journée", () => {
    expect(applyDrop(days, { kind: "slot", date: "2026-10-11", index: 0 }, "2026-10-11", 2)).toEqual({ "2026-10-11": ["b", "c", "a"] });
  });
  it("échange entre deux journées", () => {
    expect(applyDrop(days, { kind: "slot", date: "2026-10-11", index: 1 }, "2026-10-12", 0)).toEqual({
      "2026-10-11": ["a", "d", "c"],
      "2026-10-12": ["b", "e", "f"],
    });
  });
  it("remplace par une question de la banque", () => {
    expect(applyDrop(days, { kind: "bank", id: "z" }, "2026-10-11", 1)).toEqual({ "2026-10-11": ["a", "z", "c"] });
  });
  it("échange si la question de la banque est déjà dans la journée", () => {
    expect(applyDrop(days, { kind: "bank", id: "c" }, "2026-10-11", 0)).toEqual({ "2026-10-11": ["c", "b", "a"] });
  });
  it("refuse un échange qui créerait un doublon", () => {
    const dup = { x: ["a", "b"], y: ["b", "c"] };
    // « b » est déjà dans la journée y : l'y amener une seconde fois est refusé.
    expect(applyDrop(dup, { kind: "slot", date: "x", index: 1 }, "y", 1)).toEqual({});
  });
  it("ne fait rien si on dépose une question sur elle-même", () => {
    expect(applyDrop(days, { kind: "slot", date: "2026-10-11", index: 1 }, "2026-10-11", 1)).toEqual({});
  });
});
