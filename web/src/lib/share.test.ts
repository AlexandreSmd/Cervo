import { describe, expect, it } from "vitest";
import { buildShareMessage, shareDot } from "./share";

describe("partage", () => {
  it("vert à partir de 50, rouge en dessous", () => {
    expect(shareDot(100)).toBe("🟢");
    expect(shareDot(50)).toBe("🟢");
    expect(shareDot(49)).toBe("🔴");
    expect(shareDot(0)).toBe("🔴");
  });

  it("montre les 10 questions avec leur couleur et leur score", () => {
    const scores = [100, 0, 50, 90, 80, 79, 40, 39, 100, 100];
    const text = buildShareMessage("Vif", "2026-10-10", 68, scores, 3, "https://jouevif.fr");
    expect(text).toContain("Mon score : 68/100 · 🔥 3 jours de suite");
    expect(text).toContain("🟢🔴🟢🟢🟢🟢🔴🔴🟢🟢");
    expect(text).toContain(" 1. 🟢 100/100");
    expect(text).toContain(" 2. 🔴 0/100");
    expect(text).toContain("10. 🟢 100/100");
    expect(text).toContain("7/10 questions réussies");
    expect(text).toContain("https://jouevif.fr");
  });

  it("n'affiche pas de série pour un seul jour", () => {
    expect(buildShareMessage("Vif", "2026-10-10", 50, Array(10).fill(50), 1, "x")).not.toContain("🔥");
  });
});
