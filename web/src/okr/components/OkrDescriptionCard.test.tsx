import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OkrDescriptionCard } from "./OkrDetailPage";

describe("OkrDescriptionCard", () => {
  it("offers to add a description when there is none", async () => {
    const onSave = vi.fn();
    render(<OkrDescriptionCard description="" onSave={onSave} />);

    await userEvent.click(
      screen.getByRole("button", { name: "+ Add description" }),
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("bolds a selection via the toolbar and saves the raw markdown", async () => {
    const onSave = vi.fn();
    render(<OkrDescriptionCard description="hello world" onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.setSelectionRange(6, 11);

    await userEvent.click(screen.getByRole("button", { name: "B" }));
    expect(textarea.value).toBe("hello **world**");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("hello **world**");
  });

  it("renders saved markdown, not raw text, once collapsed", () => {
    render(
      <OkrDescriptionCard description="a **bold** claim" onSave={vi.fn()} />,
    );

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.queryByText("**bold**")).not.toBeInTheDocument();
  });

  it("discards the draft on cancel", async () => {
    const onSave = vi.fn();
    render(<OkrDescriptionCard description="original" onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(textarea, " and more");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("original")).toBeInTheDocument();
  });
});
