import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { queryStateMessage } from "./queryStateMessage";

describe("queryStateMessage", () => {
  it("returns a loading element while isLoading is true", () => {
    render(<>{queryStateMessage(true, null, "widgets")}</>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("returns an error element naming the label", () => {
    render(<>{queryStateMessage(false, new Error("boom"), "widgets")}</>);
    expect(screen.getByText(/Failed to load widgets/)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it("returns null once loading is done and there is no error", () => {
    expect(queryStateMessage(false, null, "widgets")).toBeNull();
  });

  it("prioritizes the loading state over an error", () => {
    render(<>{queryStateMessage(true, new Error("boom"), "widgets")}</>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });
});
