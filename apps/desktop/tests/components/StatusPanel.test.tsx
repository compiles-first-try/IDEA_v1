/**
 * Contract 2: StatusPanel
 * - Renders health badges for services
 * - Shows kill switch status, daily spend, autonomy level
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPanel } from "@/components/governance/StatusPanel.tsx";

describe("Contract 2: StatusPanel", () => {
  it("renders service health badges", () => {
    render(
      <StatusPanel
        status={{
          killSwitchActive: false,
          dailySpend: 1.25,
          autonomyLevel: "supervised",
          timestamp: new Date().toISOString(),
        }}
        services={[
          { name: "PostgreSQL", healthy: true },
          { name: "Redis", healthy: true },
          { name: "Temporal", healthy: true },
          { name: "Jaeger", healthy: true },
          { name: "Ollama", healthy: true },
          { name: "Temporal UI", healthy: false },
        ]}
      />
    );

    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("Temporal")).toBeInTheDocument();
    expect(screen.getByText("Jaeger")).toBeInTheDocument();
    expect(screen.getByText("Ollama")).toBeInTheDocument();
    expect(screen.getByText("Temporal UI")).toBeInTheDocument();
  });

  it("shows daily spend", () => {
    render(
      <StatusPanel
        status={{
          killSwitchActive: false,
          dailySpend: 3.5,
          autonomyLevel: "supervised",
          timestamp: new Date().toISOString(),
        }}
        services={[]}
      />
    );

    expect(screen.getByText(/\$3\.50/)).toBeInTheDocument();
  });

  it("shows kill switch status", () => {
    render(
      <StatusPanel
        status={{
          killSwitchActive: true,
          dailySpend: 0,
          autonomyLevel: "supervised",
          timestamp: new Date().toISOString(),
        }}
        services={[]}
      />
    );

    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });
});
