/**
 * Build Session Store — tracks spec, pipeline stages, artifacts, busy state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "@/store/session.ts";

describe("Session Store", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("defaults to idle with empty spec", () => {
    const s = useSessionStore.getState();
    expect(s.spec).toBe("");
    expect(s.busy).toBe(false);
    expect(s.stages).toHaveLength(6);
    expect(s.stages.every((st) => st.status === "pending")).toBe(true);
  });

  it("sets spec text", () => {
    useSessionStore.getState().setSpec("Build a calculator");
    expect(useSessionStore.getState().spec).toBe("Build a calculator");
  });

  it("sets reasoning mode", () => {
    useSessionStore.getState().setReasoningMode("feynman");
    expect(useSessionStore.getState().reasoningMode).toBe("feynman");
  });

  it("starts a build — sets busy and resets stages", () => {
    useSessionStore.getState().setSpec("test");
    useSessionStore.getState().startBuild();
    const s = useSessionStore.getState();
    expect(s.busy).toBe(true);
    expect(s.stages.every((st) => st.status === "pending")).toBe(true);
  });

  it("updates a stage status with metadata", () => {
    useSessionStore.getState().startBuild();
    useSessionStore.getState().updateStage("spec-interpreter", {
      status: "running",
      modelUsed: "qwen2.5-coder:14b",
    });
    const stage = useSessionStore.getState().stages.find((s) => s.id === "spec-interpreter");
    expect(stage?.status).toBe("running");
    expect(stage?.modelUsed).toBe("qwen2.5-coder:14b");
  });

  it("completes a build — sets busy false, stores artifacts", () => {
    useSessionStore.getState().startBuild();
    useSessionStore.getState().completeBuild({
      generatedCode: "function add(a,b){return a+b}",
      generatedTests: "test('adds', () => expect(add(1,2)).toBe(3))",
      qualityGates: [{ name: "AST", result: "pass", details: "Zero errors" }],
      auditTrail: [{ timestamp: "now", agent: "code-gen", action: "LLM_CALL", model: "qwen", duration: "1s" }],
    });
    const s = useSessionStore.getState();
    expect(s.busy).toBe(false);
    expect(s.artifacts?.generatedCode).toContain("add");
    expect(s.artifacts?.generatedTests).toContain("test");
  });

  it("reset clears everything", () => {
    useSessionStore.getState().setSpec("something");
    useSessionStore.getState().startBuild();
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.spec).toBe("");
    expect(s.busy).toBe(false);
    expect(s.artifacts).toBeNull();
  });
});
