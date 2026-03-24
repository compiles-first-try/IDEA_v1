# RSF Desktop — Feature Roadmap

## Current: V1 (Released)

Full governance dashboard with:
- Kill switch (3-mechanism: Redis, ENV, HTTP)
- Live audit stream via WebSocket
- Spec-to-code build pipeline visualization
- Agent roster with search, topology, and matrix views
- Model management (Ollama + Anthropic)
- Self-improvement cycle trigger and monitoring
- Knowledge base ingestion and semantic search
- Feedback panel with validation agent
- Two-tier ethics constitution (locked + configurable)
- Dark/light/system theme
- Collapsible sidebar navigation

---

## V2 Features (Next Major Version)

### Policy Engine
Fine-grained agent action authorization using Open Policy Agent (OPA) rules. Define what each agent can and cannot do at the action level.

### Management Board
Strategic oversight layer for agent alignment. Visible to human operators but not modifiable by agents. Provides a high-level view of agent alignment status.

### Hallucination Detection Panel
Semantic entropy scoring and self-consistency checking for generated artifacts. Probability calibration dashboard.

### Karpathy Loop / Context Engineering
Explicit context window management UI. Visualize what's in each agent's context, what was evicted, and how context composition affects output quality.

### Agent Creation Wizard
Define new agents directly from the UI. Generate agent blueprints, contracts, and test suites from a natural language description.
*Currently visible as disabled button: "Coming in V2 — Agent Blueprint Generator"*

### Web Monitoring Dashboard
A read-only web-accessible dashboard (separate from the Tauri desktop app) showing:
- Platform health and infrastructure status
- Agent health and execution status
- Live audit event stream
- Observable system data and metrics

Includes a **dual-key kill switch** requiring two authenticated users to activate (two-person integrity pattern).

**Rationale:** The Tauri desktop app is the full-control cockpit for a single operator; the web dashboard is a control-tower view for team visibility and emergency response.

**Requirements:** Authentication layer (not present in V1), pending-kill-request table with expiry logic.

### Ontology Editor
Structured knowledge graph visualization and editing for the knowledge base.
*Currently visible as disabled element: "Coming in V2"*

---

## V3 Features

### Lower Environments
Dev/staging/prod environment selector with isolated databases. Test changes in lower environments before promoting to production.

### Customer Fine-Tuning
Train models on accumulated feedback data. Requires sufficient training data volume to be effective.
*Currently visible as disabled button: "Coming in V3 — requires sufficient training data volume"*

### Multi-User / Multi-Tenant
Separate workspaces per user with role-based access control. Enables team collaboration on the same foundry instance.

---

## Design Principle for Placeholders

Every V2/V3 feature has a visible but disabled UI element with:
- A tooltip explaining what it does
- A "Coming in V2" or "Coming in V3" label
- No functionality — clicking shows an informational modal only

This ensures users and stakeholders can see the roadmap in the product itself.
