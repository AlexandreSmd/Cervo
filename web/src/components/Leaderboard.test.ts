import { describe, expect, it } from "vitest";
import { changeLabel, monthLabel } from "./Leaderboard";

describe("classement", () => {
  it("nomme le mois", () => {
    expect(monthLabel("2026-10")).toBe("octobre");
    expect(monthLabel("2027-01")).toBe("janvier");
  });

  it("dit ce que le quiz du jour a changé", () => {
    expect(changeLabel({ change: 3, previous_rank: 7 })).toEqual({ text: "▲ 3 places", tone: "good" });
    expect(changeLabel({ change: -1, previous_rank: 2 })).toEqual({ text: "▼ 1 place", tone: "bad" });
    expect(changeLabel({ change: 0, previous_rank: 4 })).toEqual({ text: "=", tone: "muted" });
    expect(changeLabel({ change: null, previous_rank: null })).toEqual({ text: "nouveau", tone: "good" });
  });
});
