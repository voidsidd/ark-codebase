# Conversation archive

**Generated:** 2026-05-11  
**Scope:** Full thread summary (code/product/engineering focus). User preference noted: treat future requests as **code-first** by default; avoid unsolicited marketing strategy.

---

## 1. Initial request: understand the codebase (no docs)

**User:** Ignore documentation; explore the codebase intelligently and determine what the software does. Plan first.

**Assistant plan:**

1. Map architecture (apps, entrypoints, runtimes).
2. Trace execution from real entrypoints.
3. Infer capabilities from routes, services, models.
4. Validate with data flow.
5. Separate product vs tooling.
6. Report with evidence paths.

**Outcome (from code inspection):**

- **Product:** “Vanguard” — conservation / anti-poaching operations style platform: geospatial dashboard, real-time alerts (SSE), camera webhook → Python CV pipeline (`hendricks_engine.py`: motion, YOLO threat classes, optional Anthropic verifier), acoustic classification endpoints, environmental proxies (Open-Meteo, NASA EONET, GBIF, iNaturalist, Wikipedia image proxy), in-memory/simulated sensor loops, React+Vite frontend (`liveStream.ts` → `EventSource('/api/events')`), Supabase usage for estates in dashboard shell.
- **Root launcher:** `package.json` → `node backend/server.js`; SPA fallback serves `frontend/dist/index.html`.
- **Evidence files (non-exhaustive):** `package.json`, `backend/server.js`, `backend/ai_engine/hendricks_engine.py`, `frontend/src/App.tsx`, `frontend/src/lib/liveStream.ts`, `frontend/src/SpeciesIntelPage.tsx`, `frontend/src/SoundAnalysisPage.tsx`.

---

## 2. Pivot discussion → autonomous AI surveillance

**User:** Startup pivot from wildlife-only to broader autonomous AI surveillance (AI-native company): traffic, crime, wildlife, facial recognition, and more.

**Assistant (later superseded by user preferences):** Reframed company/product pillars (perception, intelligence, action, trust), modular verticals, facial governance warnings.

**User correction:** Do not give marketing strategy help; whenever they say anything, assume **code-related** unless stated otherwise.

**User:** Focus only on **traffic**, **crime**, **access/facial**, **critical infrastructure**; pause wildlife capabilities.

**Assistant:** Recommended **strangler refactor** — keep codebase, extract domain-agnostic core; freeze wildlife behind flags; unified incident model; four vertical adapters; strict policy/audit for facial.

---

## 3. Architecture: keep vs nuke, website/system shape

**User:** Clunky codebase; plan optimal architecture and whether to keep or completely rewrite.

**Assistant recommendation:**

- **Do not nuke.** Keep Express/React/SSE skeleton; refactor into modules.
- **Target shape:** `apps/web`, `apps/api`, `packages/domain`, detectors per vertical, policy engine, realtime gateway.
- **Phases:** feature-flag wildlife → extract domain package → correlator/incident service → frontend workspaces per vertical → hardening (RBAC, audit).

---

## 4. What the software should do (engineering contract)

**Concise contract:**

1. Ingest multi-source signals (video, access logs, IoT, etc.).
2. Detect (rules + models + calibration).
3. Correlate into incidents (time/space/entity/graph).
4. Score severity + apply policy.
5. Recommend/trigger actions with human override.
6. Audit everything sensitive (especially identity).

**Core objects:** `SensorEvent`, `Detection`, `Incident`, `Evidence`, `Decision`, `AuditRecord`.

**Lifecycle:** e.g. `NEW → TRIAGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED` (+ false positive / escalated paths).

**Operator UX:** command-center style: incident board, map/timeline, incident detail, domain filters, policy admin.

---

## 5. How to detect and correlate

**Detection:** layered — deterministic rules, CV/audio/signal models, context enrichment, calibration → normalized `Detection[]` (not raw vendor payloads).

**Correlation:** incident graph + temporal fusion — retrieve candidate incidents (time window, geofence, shared tracks/IDs), weighted score \(S_{time}, S_{space}, S_{entity}, S_{type}, S_{causal}\), merge vs new incident vs human-review band; update severity and evidence.

**Implementation sketch:** `IDetector.detect(SensorEvent)`, `Correlator.correlate(Detection)` backed by hot index (e.g. Redis) + durable store (e.g. Postgres).

---

## 6. Models, deployment, scaling (direct answer)

**Models (illustrative):**

- Traffic: detector + tracker (e.g. YOLO-family + ByteTrack), optional lane/segmentation; rules + temporal logic for incidents; ANPR stack or vendor.
- Crime/safety: detection + ReID; pose/behavior/anomaly models as needed; weapon models cautiously (FP risk).
- Access/facial: detection + embedding + vector match + quality/liveness; **policy engine** never model-only decisions.
- Critical infra: perimeter + sensor fusion + boosted risk scores initially.

**LLM:** small instruct model for narration/SOP suggestions only—not primary detector truth.

**Deployment:** edge inference + cloud control plane; containers; K8s cloud / k3s edge; Triton or equivalent for CV serving; Kafka/Redpanda, Redis, Postgres, object storage, SSE/WebSocket to UI.

**Scaling:** shard by camera/site; adaptive FPS; FP16/TensorRT at edge; horizontally scale correlator by partition key; retention tiers for evidence and vectors.

---

## 7. `.agent` skills review (listed paths only)

User requested reading **only** these skills under `.agent/skills/…/SKILL.md` (not the whole `.agent` tree):

1. loki-mode  
2. llm-ops  
3. llm-application-dev-prompt-optimize  
4. llm-application-dev-langchain-agent  
5. llm-application-dev-ai-assistant  
6. llm-app-patterns  
7. geoffrey-hinton  
8. explain-like-socrates  
9. ddd-context-mapping  
10. git-advanced-workflows  
11. julia-pro  
12. llm-app-patterns (duplicate in list)  
13–14. llm-application-dev-ai-assistant / langchain-agent  
15. database-cloud-optimization-cost-optimize  
16. context-driven-development  
17. context-agent  
18. cloud-devops  
19. cloud-architect  
20. codex-review  
21. bug-hunter  
22. browser-automation  
23. backend-architect  
24. autonomous-agent-patterns  
25. andrej-karpathy  
26. aegisops-ai  

**Summary table (utility for this project):**

| Skill | Role |
|-------|------|
| **backend-architect**, **ddd-context-mapping** | Service boundaries, APIs, events, ACL between vendors and domain |
| **llm-app-patterns**, **llm-ops**, prompt/langchain/assistant skills | LLM assist layer: RAG, evals, streaming, agents—secondary to deterministic detection |
| **bug-hunter**, **git-advanced-workflows** | Regression hunting, bisect, parallel refactors |
| **browser-automation** | Playwright E2E for dashboard |
| **cloud-architect**, **cloud-devops**, **database-cloud-optimization-cost-optimize**, **aegisops-ai** | Infra, cost, Terraform/K8s gates |
| **context-driven-development**, **context-agent** | Managed context artifacts / session continuity (note: context-agent doc references paths that may need localizing) |
| **autonomous-agent-patterns** | Tool loops, permissions, HITL for internal operators |
| **loki-mode** | Full autonomous SDLC with `.loki/`—conflicts with “discuss first”; use only when explicitly desired |
| **codex-review** | External Codex CLI workflow + changelog |
| **geoffrey-hinton**, **andrej-karpathy**, **explain-like-socrates** | Persona/teaching—not default for code tasks |
| **julia-pro** | Only if Julia is adopted |

---

## 8. Current request

**User:** Put this entire conversation in a markdown file in the **root of the project**.

**File:** `CONVERSATION-ARCHIVE.md` (this document).

---

## Appendix: user preferences captured for future sessions

1. **Code-first:** Assume implementation/architecture unless user clearly asks otherwise.
2. **No unsolicited marketing** strategy.
3. **Product focus:** Traffic, crime, access/facial (governed), critical infra — wildlife paused.
4. **Architecture stance:** Prefer strangler refactor over full rewrite unless explicitly reconsidered.
