import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryState } from "./QueryState";

describe("QueryState", () => {
  it("renders a loading indicator while isLoading is true", () => {
    render(
      <QueryState isLoading error={null} label="widgets">
        <p>content</p>
      </QueryState>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders the error message with the given label when not loading", () => {
    render(
      <QueryState isLoading={false} error={new Error("boom")} label="widgets">
        <p>content</p>
      </QueryState>,
    );
    expect(screen.getByText(/Failed to load widgets/)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders children once loading is done and there is no error", () => {
    render(
      <QueryState isLoading={false} error={null} label="widgets">
        <p>content</p>
      </QueryState>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("prioritizes the loading state over an error", () => {
    render(
      <QueryState isLoading error={new Error("boom")} label="widgets">
        <p>content</p>
      </QueryState>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
