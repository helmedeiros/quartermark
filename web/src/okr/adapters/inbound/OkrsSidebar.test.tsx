import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/client";
import { OkrsSidebar } from "./OkrsSidebar";

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OkrsSidebar teamSlug="demo-squad" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OkrsSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--layout-sidebar-width");
    vi.spyOn(api, "getTeamBlob").mockResolvedValue({
      team: "Atlas",
      quarters: [{ quarterId: "2026-q4", label: "Q4 2026", objectives: [] }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the quarter list expanded by default", async () => {
    renderSidebar();
    expect(await screen.findByText("Q4 2026")).toBeInTheDocument();
    expect(
      document.documentElement.style.getPropertyValue("--layout-sidebar-width"),
    ).toBe("280px");
  });

  it("collapses on toggle, hiding the list and narrowing the layout column", async () => {
    renderSidebar();
    await screen.findByText("Q4 2026");

    await userEvent.click(
      screen.getByRole("button", { name: "Collapse quarter list" }),
    );

    expect(screen.queryByText("Q4 2026")).not.toBeInTheDocument();
    expect(
      document.documentElement.style.getPropertyValue("--layout-sidebar-width"),
    ).toBe("40px");
  });

  it("persists the collapsed state across remounts via localStorage", async () => {
    const { unmount } = renderSidebar();
    await screen.findByText("Q4 2026");
    await userEvent.click(
      screen.getByRole("button", { name: "Collapse quarter list" }),
    );
    unmount();

    renderSidebar();
    expect(screen.queryByText("Q4 2026")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand quarter list" }),
    ).toBeInTheDocument();
  });
});
