/**
 * StatusPanel (Full Phase 2) — 6 Docker service health badges.
 * Green dot = healthy, red dot = down, gray dot = unknown.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPanel } from "@/components/governance/StatusPanel.tsx";

const SERVICES = [
  { name: "PostgreSQL", healthy: true },
  { name: "Redis", healthy: true },
  { name: "Temporal", healthy: true },
  { name: "Temporal UI", healthy: true },
  { name: "Jaeger", healthy: true },
  { name: "Ollama", healthy: false },
];

describe("StatusPanel (Phase 2)", () => {
  it("renders all 6 Docker service badges", () => {
    render(<StatusPanel status={{ killSwitchActive: false, dailySpend: 0, autonomyLevel: "supervised", timestamp: "" }} services={SERVICES} />);
    for (const svc of SERVICES) {
      expect(screen.getByText(svc.name)).toBeInTheDocument();
    }
  });

  it("shows green dot for healthy and red dot for unhealthy", () => {
    const { container } = render(
      <StatusPanel status={{ killSwitchActive: false, dailySpend: 0, autonomyLevel: "supervised", timestamp: "" }} services={SERVICES} />
    );
    const dots = container.querySelectorAll("span.inline-block.h-2.w-2.rounded-full");
    const greenCount = Array.from(dots).filter(d => d.className.includes("green")).length;
    const redCount = Array.from(dots).filter(d => d.className.includes("red")).length;
    expect(greenCount).toBe(5);
    expect(redCount).toBe(1);
  });
});
