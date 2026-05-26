import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { LoadingState } from "../LoadingState";

afterEach(() => cleanup());

describe("LoadingState", () => {
  it('renders a spinner with role="status"', () => {
    render(<LoadingState />);
    const spinner = screen.getByRole("status");
    expect(spinner).toBeDefined();
  });

  it("renders optional message when provided", () => {
    render(<LoadingState message="Loading data..." />);
    expect(screen.getByText("Loading data...")).toBeDefined();
  });

  it("renders without message when not provided", () => {
    const { container } = render(<LoadingState />);
    const p = container.querySelector("p");
    expect(p).toBeNull();
  });

  it("composes Spinner internally (has spin animation class)", () => {
    const { container } = render(<LoadingState />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("applies optional className to the container", () => {
    const { container } = render(<LoadingState className="my-extra-class" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("my-extra-class");
  });
});
