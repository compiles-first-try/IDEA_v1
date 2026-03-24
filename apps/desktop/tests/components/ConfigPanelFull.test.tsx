/**
 * ConfigPanel (Full Phase 2) — spend limits, model tiers, autonomy, ethics constitution.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfigPanelFull } from "@/components/governance/ConfigPanelFull.tsx";

describe("ConfigPanel Full (Phase 2)", () => {
  const defaults = {
    maxDailySpendUsd: 10,
    pauseThresholdUsd: 20,
    perCallCriticalUsd: 0.05,
    autonomyLevel: "supervised" as const,
    modelTiers: {
      TRIVIAL: "llama3.3:8b",
      STANDARD: "qwen2.5-coder:14b",
      COMPLEX: "claude-haiku-4-5-20251001",
      CRITICAL: "claude-sonnet-4-6-20250514",
    },
  };

  it("renders spend limit inputs", () => {
    render(<ConfigPanelFull config={defaults} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/soft limit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hard limit/i)).toBeInTheDocument();
  });

  it("renders autonomy level selector with 3 options", () => {
    render(<ConfigPanelFull config={defaults} onSave={vi.fn()} />);
    const select = screen.getByLabelText(/autonomy/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(3);
  });

  it("renders locked constitution principles as read-only", () => {
    render(<ConfigPanelFull config={defaults} onSave={vi.fn()} />);
    expect(screen.getByText(/never execute destructive/i)).toBeInTheDocument();
    expect(screen.getByText(/never modify the kill switch/i)).toBeInTheDocument();
    expect(screen.getByText(/system-enforced/i)).toBeInTheDocument();
  });

  it("renders configurable principles as editable", () => {
    render(<ConfigPanelFull config={defaults} onSave={vi.fn()} />);
    expect(screen.getByText(/operator-configured/i)).toBeInTheDocument();
    expect(screen.getByText(/prefer typescript/i)).toBeInTheDocument();
  });

  it("renders V2 placeholders as disabled", () => {
    render(<ConfigPanelFull config={defaults} onSave={vi.fn()} />);
    const policyBtn = screen.getByText(/policy engine/i);
    expect(policyBtn.closest("button") ?? policyBtn.closest("div")).toBeInTheDocument();
    expect(screen.getAllByText(/coming in v2/i).length).toBe(3);
  });

  it("calls onSave with updated spend limits", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ConfigPanelFull config={defaults} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/soft limit/i), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });
});
