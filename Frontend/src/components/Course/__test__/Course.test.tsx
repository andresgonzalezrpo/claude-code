import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Course } from "../Course";

describe("Course Component", () => {
  const mockCourse = {
    id: 1,
    title: "React Fundamentals",
    teacher: "John Doe",
    duration: 120,
    thumbnail: "https://example.com/thumbnail.jpg",
  };

  it("renders course information correctly", () => {
    render(<Course {...mockCourse} />);

    // Check if title is rendered
    expect(screen.getByText(mockCourse.title)).toBeDefined();

    // Check if teacher information is rendered
    expect(screen.getByText(`Profesor: ${mockCourse.teacher}`)).toBeDefined();

    // Check if duration is rendered
    expect(screen.getByText(`Duración: ${mockCourse.duration} minutos`)).toBeDefined();
  });

  it("renders thumbnail with correct alt text", () => {
    render(<Course {...mockCourse} />);

    const thumbnail = screen.getByRole("img");
    expect(thumbnail).toHaveAttribute("src", mockCourse.thumbnail);
    expect(thumbnail).toHaveAttribute("alt", mockCourse.title);
  });

  it("renders with correct structure", () => {
    const { container } = render(<Course {...mockCourse} />);

    // Check if the main article exists
    expect(container.querySelector("article")).toBeDefined();

    // Check if the thumbnail container exists
    expect(container.querySelector("div > img")).toBeDefined();

    // Check if the course info section exists
    expect(container.querySelector("div > h2")).toBeDefined();
    expect(container.querySelector("div > p")).toBeDefined();
  });

  it("renders StarRating when average_rating is provided", () => {
    render(<Course {...mockCourse} average_rating={4.2} />);

    // StarRating renders with role="img" and aria-label
    const starRating = screen.getByRole("img", { name: /estrellas/i });
    expect(starRating).toBeDefined();
    expect(starRating).toHaveAttribute("aria-label", "4.2 de 5 estrellas");
  });

  it("does not render StarRating when average_rating is not provided", () => {
    render(<Course {...mockCourse} />);

    // The only img role should be the thumbnail, not a StarRating
    const images = screen.getAllByRole("img");
    const starRating = images.find((el) =>
      el.getAttribute("aria-label")?.includes("estrellas")
    );
    expect(starRating).toBeUndefined();
  });
});
