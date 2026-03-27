/**
 * Cryptographic Audit Signing
 *
 * Signs audit entries with HMAC-SHA256 so tampering is detectable.
 * Agent has INSERT but cannot forge valid signatures.
 */
import { describe, it, expect } from "vitest";

describe("Cryptographic Audit Signing", () => {
  let crypto: typeof import("../src/crypto-audit/index.js");

  it("should load module", async () => {
    crypto = await import("../src/crypto-audit/index.js");
    expect(crypto).toBeDefined();
  });

  it("should sign an audit entry", () => {
    const entry = {
      event_id: "test-123",
      timestamp: "2026-03-27T10:00:00Z",
      agent_id: "test-agent",
      action_type: "TEST_RUN",
      status: "SUCCESS",
    };
    const signed = crypto.signEntry(entry, "test-secret-key");
    expect(signed.signature).toBeDefined();
    expect(signed.signature.length).toBeGreaterThan(10);
    expect(signed.algorithm).toBe("HMAC-SHA256");
  });

  it("should verify a valid signature", () => {
    const entry = {
      event_id: "test-456",
      timestamp: "2026-03-27T10:00:00Z",
      agent_id: "test-agent",
      action_type: "LLM_CALL",
      status: "SUCCESS",
    };
    const signed = crypto.signEntry(entry, "test-secret-key");
    const valid = crypto.verifyEntry(entry, signed.signature, "test-secret-key");
    expect(valid).toBe(true);
  });

  it("should detect tampered entries", () => {
    const entry = {
      event_id: "test-789",
      timestamp: "2026-03-27T10:00:00Z",
      agent_id: "test-agent",
      action_type: "DECISION",
      status: "SUCCESS",
    };
    const signed = crypto.signEntry(entry, "test-secret-key");

    // Tamper with the entry
    const tampered = { ...entry, status: "FAILURE" };
    const valid = crypto.verifyEntry(tampered, signed.signature, "test-secret-key");
    expect(valid).toBe(false);
  });

  it("should detect wrong key", () => {
    const entry = { event_id: "x", timestamp: "t", agent_id: "a", action_type: "b", status: "SUCCESS" };
    const signed = crypto.signEntry(entry, "correct-key");
    const valid = crypto.verifyEntry(entry, signed.signature, "wrong-key");
    expect(valid).toBe(false);
  });
});
