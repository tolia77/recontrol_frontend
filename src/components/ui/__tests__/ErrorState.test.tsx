import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ErrorState from "../ErrorState";

afterEach(() => cleanup());

describe("ErrorState", () => {
  it("renders the message string", () => {
    render(<ErrorState message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders a retry button when onRetry is provided", () => {
    render(<ErrorState message="Error" onRetry={() => {}} />);
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("does NOT render a retry button when onRetry is not provided", () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls onRetry when the retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("applies optional className to the container", () => {
    const { container } = render(
      <ErrorState message="Error" className="custom-class" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-class");
  });
});
