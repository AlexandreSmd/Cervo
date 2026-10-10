import { describe, expect, it } from "vitest";
import { formatAnswer, parseNumberInput, scoreColor, shareText } from "./format";

describe("scoreColor", () => {
  it("suit les seuils vert ≥ 80, orange 40–79, rouge < 40", () => {
    expect(scoreColor(100)).toBe("good");
    expect(scoreColor(80)).toBe("good");
    expect(scoreColor(79)).toBe("mid");
    expect(scoreColor(40)).toBe("mid");
    expect(scoreColor(39)).toBe("bad");
  });
});

describe("parseNumberInput", () => {
  it("accepte les formats français", () => {
    expect(parseNumberInput("384 400")).toBe(384400);
    expect(parseNumberInput("3,5")).toBe(3.5);
    expect(parseNumberInput("-12")).toBe(-12);
  });
  it("refuse ce qui n'est pas un nombre", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("abc")).toBeNull();
    expect(parseNumberInput("12abc")).toBeNull();
  });
});

describe("formatAnswer", () => {
  it("affiche vrai/faux, nombres et unités", () => {
    expect(formatAnswer(true, "binary")).toBe("Vrai");
    expect(formatAnswer(false, "binary")).toBe("Faux");
    expect(formatAnswer(634, "numeric", "m")).toMatch(/^634 m$/);
    expect(formatAnswer(null, "mcq")).toBe("—");
  });
});

describe("shareText", () => {
  it("produit un texte à emojis sans dévoiler les questions", () => {
    const text = shareText("Cervo Daily", "2026-10-10", 72, [100, 0, 50, 90, 80, 79, 40, 39, 100, 100], 3, "https://cervo.fr");
    expect(text).toContain("72/100");
    expect(text).toContain("🟩🟥🟧🟩🟩🟧🟧🟥🟩🟩");
    expect(text).toContain("🔥 3 jours");
    expect(text.split("\n")).toHaveLength(4);
  });
});
