/**
 * Contract 6: ConfigPanel
 * - Loads current config from props (simulating GET /governance/config)
 * - Renders spend limit inputs
 * - Saving calls onSave with Zod-validated payload
 * - Rejects invalid values
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfigPanel } from "@/components/governance/ConfigPanel.tsx";

describe("Contract 6: ConfigPanel", () => {
  const defaultConfig = {
    maxDailySpendUsd: 10,
    autonomyLevel: "supervised" as const,
  };

  it("renders with current config values", () => {
    render(<ConfigPanel config={defaultConfig} onSave={vi.fn()} />);
    const input = screen.getByLabelText(/daily spend/i) as HTMLInputElement;
    expect(input.value).toBe("10");
  });

  it("renders autonomy level selector", () => {
    render(<ConfigPanel config={defaultConfig} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/autonomy/i)).toBeInTheDocument();
  });

  it("calls onSave with updated values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ConfigPanel config={defaultConfig} onSave={onSave} />);

    const input = screen.getByLabelText(/daily spend/i);
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ maxDailySpendUsd: 25 })
      );
    });
  });

  it("rejects negative spend limit", async () => {
    const onSave = vi.fn();
    render(<ConfigPanel config={defaultConfig} onSave={onSave} />);

    const input = screen.getByLabelText(/daily spend/i);
    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    // onSave should not be called with invalid data
    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
    expect(screen.getByText(/must be positive/i)).toBeInTheDocument();
  });
});
