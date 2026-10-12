import { describe, expect, it } from "vitest";
import { formatCountdown, msToParisMidnight } from "./Countdown";

describe("compte à rebours", () => {
  it("compte jusqu'à minuit heure de Paris", () => {
    // 21:30 UTC le 12 octobre = 23:30 à Paris (heure d'été) : 30 minutes
    expect(msToParisMidnight(new Date("2026-10-12T21:30:00Z"))).toBe(30 * 60_000);
  });
  it("s'affiche en heures et minutes", () => {
    expect(formatCountdown(5 * 3_600_000 + 7 * 60_000)).toBe("5 h 07");
    expect(formatCountdown(12 * 60_000)).toBe("12 min");
  });
});
