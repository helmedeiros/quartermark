import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OkrCreatePanel } from "./OkrCreatePanel";
import type { OkrNodeType } from "./types";

function renderPanel(allowedTypes: OkrNodeType[]) {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(
    <OkrCreatePanel
      allowedTypes={allowedTypes}
      quarterLabel="Q1 2026"
      teamName="Atlas"
      clusters={["Growth", "Platform"]}
      pending={false}
      onCreate={onCreate}
      onClose={onClose}
    />,
  );
  return { onCreate, onClose };
}

function setTitle(value: string) {
  fireEvent.change(screen.getByPlaceholderText(/Enter .* name/), {
    target: { value },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
}

describe("OkrCreatePanel submission payloads", () => {
  it("submits an objective with no metric fields", () => {
    const { onCreate } = renderPanel(["objective", "key_result", "milestone"]);
    setTitle("Grow revenue");
    submit();

    expect(onCreate).toHaveBeenCalledTimes(1);
    const [type, fields] = onCreate.mock.calls[0];
    expect(type).toBe("objective");
    expect(fields.title).toBe("Grow revenue");
    expect(fields).not.toHaveProperty("metricType");
    expect(fields).not.toHaveProperty("unit");
    expect(fields).not.toHaveProperty("target");
    expect(fields).not.toHaveProperty("current");
    expect(fields).not.toHaveProperty("progress");
  });

  it("submits a milestone with no metric fields", () => {
    const { onCreate } = renderPanel(["objective", "key_result", "milestone"]);
    fireEvent.click(screen.getByRole("button", { name: /Milestone/ }));
    setTitle("Ship v2");
    submit();

    const [type, fields] = onCreate.mock.calls[0];
    expect(type).toBe("milestone");
    expect(fields).not.toHaveProperty("metricType");
  });

  it("submits a key result with default percent metric fields", () => {
    const { onCreate } = renderPanel(["objective", "key_result", "milestone"]);
    fireEvent.click(screen.getByRole("button", { name: /Key Result/ }));
    setTitle("Increase conversion");
    submit();

    const [type, fields] = onCreate.mock.calls[0];
    expect(type).toBe("key_result");
    expect(fields.metricType).toBe("percent");
    expect(fields.unit).toBe("%");
    expect(fields.target).toBe(100);
    expect(fields.current).toBe(0);
    expect(fields.progress).toBe(0);
  });

  it("submits a key result with edited number metric fields", () => {
    const { onCreate } = renderPanel(["objective", "key_result", "milestone"]);
    fireEvent.click(screen.getByRole("button", { name: /Key Result/ }));
    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.change(screen.getByPlaceholderText("signups, hours…"), {
      target: { value: "signups" },
    });
    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "10" } });
    fireEvent.change(numberInputs[1], { target: { value: "50" } });
    setTitle("Grow signups");
    submit();

    const [, fields] = onCreate.mock.calls[0];
    expect(fields.metricType).toBe("number");
    expect(fields.unit).toBe("signups");
    expect(fields.current).toBe(10);
    expect(fields.target).toBe(50);
    expect(fields.progress).toBe(20);
  });

  it("does not resubmit metric fields when switching back to a non-key-result type", () => {
    const { onCreate } = renderPanel(["objective", "key_result", "milestone"]);
    fireEvent.click(screen.getByRole("button", { name: /Key Result/ }));
    fireEvent.click(screen.getByRole("button", { name: /Objective/ }));
    setTitle("Plain objective");
    submit();

    const [type, fields] = onCreate.mock.calls[0];
    expect(type).toBe("objective");
    expect(fields).not.toHaveProperty("metricType");
  });
});
