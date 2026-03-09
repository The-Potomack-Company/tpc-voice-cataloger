import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditableField } from "../components/EditableField";

describe("EditableField", () => {
  it("renders value as text", () => {
    render(<EditableField value="Hello" onSave={vi.fn()} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("shows placeholder when value is empty", () => {
    render(
      <EditableField value="" onSave={vi.fn()} placeholder="Enter text" />,
    );
    expect(screen.getByText("Enter text")).toBeInTheDocument();
  });

  it("shows placeholder when value is undefined", () => {
    render(
      <EditableField
        value={undefined}
        onSave={vi.fn()}
        placeholder="Enter text"
      />,
    );
    expect(screen.getByText("Enter text")).toBeInTheDocument();
  });

  it("enters edit mode on click and shows input", () => {
    render(<EditableField value="Click me" onSave={vi.fn()} />);
    fireEvent.click(screen.getByText("Click me"));
    const input = screen.getByDisplayValue("Click me");
    expect(input.tagName).toBe("INPUT");
  });

  it("calls onSave on blur with trimmed value", () => {
    const onSave = vi.fn();
    render(<EditableField value="Original" onSave={onSave} />);
    fireEvent.click(screen.getByText("Original"));

    const input = screen.getByDisplayValue("Original");
    fireEvent.change(input, { target: { value: "  Updated  " } });
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledWith("Updated");
  });

  it("does not call onSave on blur when value unchanged", () => {
    const onSave = vi.fn();
    render(<EditableField value="Same" onSave={onSave} />);
    fireEvent.click(screen.getByText("Same"));

    const input = screen.getByDisplayValue("Same");
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("renders textarea when multiline is true", () => {
    render(<EditableField value="Multi" onSave={vi.fn()} multiline />);
    fireEvent.click(screen.getByText("Multi"));
    const textarea = screen.getByDisplayValue("Multi");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("cancels on Escape key", () => {
    const onSave = vi.fn();
    render(<EditableField value="Cancel me" onSave={onSave} />);
    fireEvent.click(screen.getByText("Cancel me"));

    const input = screen.getByDisplayValue("Cancel me");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Should exit edit mode without saving
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Cancel me")).toBeInTheDocument();
  });

  it("saves on Enter key for single-line", () => {
    const onSave = vi.fn();
    render(<EditableField value="Enter save" onSave={onSave} />);
    fireEvent.click(screen.getByText("Enter save"));

    const input = screen.getByDisplayValue("Enter save");
    fireEvent.change(input, { target: { value: "New value" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).toHaveBeenCalledWith("New value");
  });

  it("renders label when provided", () => {
    render(<EditableField value="Val" onSave={vi.fn()} label="Title" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
});
