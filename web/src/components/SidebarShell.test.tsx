import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarShell } from "./SidebarShell";

describe("SidebarShell", () => {
  it("shows the loading message inside the sidebar", () => {
    const { container } = render(
      <SidebarShell isLoading error={null} label="features">
        <p>content</p>
      </SidebarShell>,
    );
    expect(container.querySelector("aside.sidebar")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("shows the error message naming what failed", () => {
    render(
      <SidebarShell
        isLoading={false}
        error={new Error("boom")}
        label="features"
      >
        <p>content</p>
      </SidebarShell>,
    );
    expect(screen.getByText(/Failed to load features/)).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("shows its children once loaded", () => {
    render(
      <SidebarShell isLoading={false} error={null} label="features">
        <p>content</p>
      </SidebarShell>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("keeps the leading slot visible in every state", () => {
    const toggle = <button type="button">toggle</button>;
    for (const props of [
      { isLoading: true, error: null },
      { isLoading: false, error: new Error("boom") },
      { isLoading: false, error: null },
    ]) {
      const { unmount } = render(
        <SidebarShell {...props} label="features" before={toggle}>
          <p>content</p>
        </SidebarShell>,
      );
      expect(screen.getByText("toggle")).toBeInTheDocument();
      unmount();
    }
  });
});
