import { describe, expect, it } from "vitest";
import { dictationDiff, sentences } from "./diff";

describe("dictationDiff", () => {
  it("marque les mots justes, faux, oubliés et en trop", () => {
    const diff = dictationDiff("Les fleurs se sont fanées.", "les fleur se sont fanées hier");
    expect(diff.map((t) => t.status)).toEqual(["ok", "wrong", "ok", "ok", "ok", "extra"]);
    expect(diff[1]).toMatchObject({ text: "fleurs", typed: "fleur" });
  });

  it("ignore casse et ponctuation, mais pas les accents", () => {
    expect(dictationDiff("Il a été là.", "il a ete la").map((t) => t.status)).toEqual(["ok", "ok", "wrong", "wrong"]);
    expect(dictationDiff("Bonjour, Paul !", "bonjour paul").every((t) => t.status === "ok")).toBe(true);
  });

  it("signale les mots oubliés", () => {
    expect(dictationDiff("un deux trois", "un trois").map((t) => t.status)).toEqual(["ok", "missing", "ok"]);
  });
});

describe("sentences", () => {
  it("découpe en phrases", () => {
    expect(sentences("Première phrase. Deuxième ! Et la fin…")).toEqual(["Première phrase.", "Deuxième !", "Et la fin…"]);
  });
});
