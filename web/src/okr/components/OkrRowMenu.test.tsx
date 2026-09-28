import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OkrRowMenu } from "./OkrRowMenu";
import type { OkrNode } from "../domain/model";

const objective: OkrNode = {
  id: "O-1",
  type: "objective",
  title: "Test objective",
  status: "not_started",
  progress: 0,
};

describe("OkrRowMenu", () => {
  it("does not show a Delete item when onDelete is not provided", async () => {
    render(
      <OkrRowMenu
        node={objective}
        disabled={false}
        onAddChild={vi.fn()}
        onLinkJira={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("shows a Delete menu item and calls onDelete when clicked", async () => {
    const onDelete = vi.fn();
    render(
      <OkrRowMenu
        node={objective}
        disabled={false}
        onAddChild={vi.fn()}
        onLinkJira={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
