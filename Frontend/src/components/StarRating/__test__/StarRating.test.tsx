import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StarRating } from "../StarRating";

describe("StarRating Component", () => {
  it("renders with rating 0 showing all empty stars", () => {
    render(<StarRating rating={0} />);
    const container = screen.getByRole("img");
    expect(container).toBeDefined();
    expect(container.textContent).toBe("☆☆☆☆☆");
  });

  it("renders with rating 5 showing all filled stars", () => {
    render(<StarRating rating={5} />);
    const container = screen.getByRole("img");
    expect(container.textContent).toBe("★★★★★");
  });

  it("renders with float rating correctly (3.7 rounds to 4 filled stars)", () => {
    render(<StarRating rating={3.7} />);
    const container = screen.getByRole("img");
    // 3.7 >= 0.5 (star1), >= 1.5 (star2), >= 2.5 (star3), >= 3.5 (star4), NOT >= 4.5 (star5)
    expect(container.textContent).toBe("★★★★☆");
  });

  it("renders with float rating 3.2 showing 3 filled stars", () => {
    render(<StarRating rating={3.2} />);
    const container = screen.getByRole("img");
    // 3.2 >= 0.5, 1.5, 2.5 but NOT >= 3.5
    expect(container.textContent).toBe("★★★☆☆");
  });

  it("has correct aria-label for accessibility", () => {
    render(<StarRating rating={4} />);
    const container = screen.getByRole("img");
    expect(container).toHaveAttribute("aria-label", "4 de 5 estrellas");
  });

  it("respects custom maxStars prop", () => {
    render(<StarRating rating={3} maxStars={3} />);
    const container = screen.getByRole("img");
    expect(container.textContent).toBe("★★★");
  });
});
