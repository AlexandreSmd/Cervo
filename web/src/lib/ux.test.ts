import { describe, expect, it } from "vitest";
import { readableNumber } from "../components/AnswerInput";
import { dayVerdict } from "../pages/Results";

describe("readableNumber", () => {
  it("relit les grands nombres tapés d'un bloc", () => {
    expect(readableNumber("100")).toBeNull();
    expect(readableNumber("abc")).toBeNull();
    expect(readableNumber("12500")).toBe("12 500");
    expect(readableNumber("1250000")).toBe("1 250 000, soit 1,25 million");
  });
});

describe("dayVerdict", () => {
  it("donne une phrase selon la journée", () => {
    expect(dayVerdict(95, [100, 100])).toMatch(/affûté/);
    expect(dayVerdict(20, [0, 0])).toMatch(/revanche/);
    expect(dayVerdict(30, [100, 0])).toBe("1 sans faute, le reste viendra.");
  });
});
