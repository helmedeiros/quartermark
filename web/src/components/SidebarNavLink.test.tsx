import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SidebarNavLink } from "./SidebarNavLink";
import { sidebarLinkClass } from "./sidebarLinkClass";

describe("SidebarNavLink", () => {
  it("renders the name and the detail line", () => {
    render(
      <MemoryRouter>
        <SidebarNavLink to="/x" name="Q1 2027" detail="3 objectives" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Q1 2027")).toBeInTheDocument();
    expect(screen.getByText("3 objectives")).toBeInTheDocument();
  });

  it("omits the detail line when there is none", () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNavLink to="/x" name="Team Absences" />
      </MemoryRouter>,
    );
    expect(container.querySelector(".role")).toBeNull();
  });
});

describe("sidebarLinkClass", () => {
  it("marks only the active link", () => {
    expect(sidebarLinkClass({ isActive: false })).toBe("eng-card");
    expect(sidebarLinkClass({ isActive: true })).toBe("eng-card active");
  });
});
