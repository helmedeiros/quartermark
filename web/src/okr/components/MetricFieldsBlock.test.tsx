import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetricFieldsBlock } from "./MetricFieldsBlock";

function baseProps() {
  return {
    metricType: "percent" as const,
    unit: "",
    current: "0",
    target: "100",
    onMetricTypeChange: vi.fn(),
    onUnitChange: vi.fn(),
    onCurrentChange: vi.fn(),
    onTargetChange: vi.fn(),
  };
}

describe("MetricFieldsBlock", () => {
  it("hides the unit field and shows a percent suffix for percent metrics", () => {
    render(<MetricFieldsBlock {...baseProps()} />);
    expect(screen.queryByText("Unit label")).not.toBeInTheDocument();
    expect(screen.getAllByText("%").length).toBeGreaterThan(0);
  });

  it("shows the unit field with a currency placeholder for currency metrics", () => {
    render(<MetricFieldsBlock {...baseProps()} metricType="currency" />);
    expect(screen.getByPlaceholderText("$, €, £…")).toBeInTheDocument();
  });

  it("shows the unit field with a generic placeholder for number metrics", () => {
    render(<MetricFieldsBlock {...baseProps()} metricType="number" />);
    expect(screen.getByPlaceholderText("signups, hours…")).toBeInTheDocument();
  });

  it("renders a boolean toggle instead of current/target inputs for boolean metrics", () => {
    render(<MetricFieldsBlock {...baseProps()} metricType="boolean" />);
    expect(screen.getByText("✓ Complete")).toBeInTheDocument();
    expect(screen.getByText("✕ Incomplete")).toBeInTheDocument();
    expect(screen.queryByText("Target")).not.toBeInTheDocument();
  });

  it("defaults the current/boolean field label to Current", () => {
    render(<MetricFieldsBlock {...baseProps()} metricType="number" />);
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("uses custom current and boolean field labels when provided", () => {
    render(
      <MetricFieldsBlock
        {...baseProps()}
        metricType="boolean"
        currentLabel="Start"
        booleanLabel="Status"
      />,
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("calls onUnitChange, onCurrentChange, and onTargetChange with new values", () => {
    const props = baseProps();
    render(<MetricFieldsBlock {...props} metricType="number" />);
    fireEvent.change(screen.getByPlaceholderText("signups, hours…"), {
      target: { value: "signups" },
    });
    expect(props.onUnitChange).toHaveBeenCalledWith("signups");

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "5" } });
    expect(props.onCurrentChange).toHaveBeenCalledWith("5");
    fireEvent.change(numberInputs[1], { target: { value: "20" } });
    expect(props.onTargetChange).toHaveBeenCalledWith("20");
  });

  it("calls onMetricTypeChange when a different metric type is picked", () => {
    const props = baseProps();
    render(<MetricFieldsBlock {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    expect(props.onMetricTypeChange).toHaveBeenCalledWith("number");
  });

  it("disables all inputs when disabled is true", () => {
    render(<MetricFieldsBlock {...baseProps()} metricType="number" disabled />);
    expect(screen.getByPlaceholderText("signups, hours…")).toBeDisabled();
    for (const input of screen.getAllByRole("spinbutton")) {
      expect(input).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
