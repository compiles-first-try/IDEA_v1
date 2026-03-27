/**
 * ModelManager — Ollama section, Anthropic section, router visualization, V3 placeholder.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ModelManager } from "@/components/inference/ModelManager.tsx";

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    pullModel: vi.fn().mockResolvedValue({ data: {} }),
    testAnthropic: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const MOCK_MODELS = {
  ollama: [
    { name: "qwen2.5-coder:14b", size: "8.9 GB", lastUsed: "2 hours ago" },
    { name: "nomic-embed-text:latest", size: "274 MB", lastUsed: "3 hours ago" },
  ],
  anthropicKeySet: true,
  anthropicModels: ["claude-sonnet-4-6-20250514", "claude-haiku-4-5-20251001"],
  routerTiers: [
    { tier: "TRIVIAL", model: "llama3.3:8b", costPerCall: "$0.00", callsToday: 0 },
    { tier: "STANDARD", model: "qwen2.5-coder:14b", costPerCall: "$0.00", callsToday: 15 },
    { tier: "COMPLEX", model: "claude-haiku-4-5-20251001", costPerCall: "~$0.001", callsToday: 3 },
    { tier: "CRITICAL", model: "claude-sonnet-4-6-20250514", costPerCall: "~$0.015", callsToday: 1 },
  ],
};

describe("ModelManager (Phase 2)", () => {
  it("renders Ollama models section", () => {
    renderWithQuery(<ModelManager data={MOCK_MODELS} />);
    expect(screen.getAllByText("qwen2.5-coder:14b").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("nomic-embed-text:latest")).toBeInTheDocument();
  });

  it("renders pull model input", () => {
    renderWithQuery(<ModelManager data={MOCK_MODELS} />);
    expect(screen.getByPlaceholderText(/model name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pull/i })).toBeInTheDocument();
  });

  it("renders Anthropic key status (never the key itself)", () => {
    renderWithQuery(<ModelManager data={MOCK_MODELS} />);
    expect(screen.getByText(/API Key:/i)).toBeInTheDocument();
    expect(screen.getByText("Set")).toBeInTheDocument();
    expect(screen.queryByText(/sk-ant/)).not.toBeInTheDocument();
  });

  it("renders 4 model router tiers", () => {
    renderWithQuery(<ModelManager data={MOCK_MODELS} />);
    expect(screen.getByText("TRIVIAL")).toBeInTheDocument();
    expect(screen.getByText("STANDARD")).toBeInTheDocument();
    expect(screen.getByText("COMPLEX")).toBeInTheDocument();
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
  });

  it("shows V3 placeholder for fine-tuning", () => {
    renderWithQuery(<ModelManager data={MOCK_MODELS} />);
    expect(screen.getByText(/coming in v3/i)).toBeInTheDocument();
  });

  it("renders test connection button for Anthropic", () => {
    renderWithQuery(<ModelManager data={MOCK_MODELS} />);
    expect(screen.getByRole("button", { name: /test connection/i })).toBeInTheDocument();
  });
});
