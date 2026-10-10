import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pearls } from "./Pearls";

describe("Pearls", () => {
  it("affiche toujours 10 perles colorées selon le score", () => {
    render(<Pearls scores={[100, 50, 10]} />);
    const pearls = screen.getAllByTestId("pearl");
    expect(pearls).toHaveLength(10);
    expect(pearls[0]).toHaveStyle({ backgroundColor: "#1FA971" });
    expect(pearls[1]).toHaveStyle({ backgroundColor: "#F2A33A" });
    expect(pearls[2]).toHaveStyle({ backgroundColor: "#E5484D" });
    expect(pearls[3]).toHaveAttribute("title", "Question 4");
  });
});
