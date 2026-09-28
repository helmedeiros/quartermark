import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { queriesStateMessage, queryStateMessage } from "./queryStateMessage";

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

describe("queriesStateMessage", () => {
  it("reports loading regardless of any failures", () => {
    render(
      <>
        {queriesStateMessage(true, [
          { label: "routines", error: new Error("boom") },
        ])}
      </>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });

  it("names the first failure in the order given", () => {
    render(
      <>
        {queriesStateMessage(false, [
          { label: "routines", error: null },
          { label: "OKRs", error: new Error("second") },
          { label: "engineers", error: new Error("third") },
        ])}
      </>,
    );
    expect(screen.getByText(/Failed to load OKRs/)).toBeInTheDocument();
    expect(screen.getByText(/second/)).toBeInTheDocument();
    expect(screen.queryByText(/third/)).not.toBeInTheDocument();
  });

  it("returns null when nothing is loading and nothing failed", () => {
    expect(
      queriesStateMessage(false, [{ label: "routines", error: null }]),
    ).toBeNull();
  });
});
