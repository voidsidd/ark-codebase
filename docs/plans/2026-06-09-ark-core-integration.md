# Ark Core Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the "nice frontend" (Axon) intelligence pipeline and UI into the main Ark codebase, rebranding it as "Ark Core" and connecting it to the Top 5 Google Cloud Services (Gemini, Pub/Sub, BigQuery, ADK, Cloud Run).

**Architecture:** 
1. The existing backend (`process_frame.py` / webhooks) remains the VLM/World Model harness.
2. The UI and SOC pipeline from `nice frontend` is ported to serve as the intelligence correlation layer.
3. Raw events flow via Pub/Sub to ADK-orchestrated agents.
4. Agents use Gemini for reasoning and BigQuery for semantic memory/history.
5. Correlated incidents are streamed to the Ark Core dashboard via SSE.

**Tech Stack:** Node.js, Express, TypeScript, Vanilla JS/HTML/CSS, @google/generative-ai, @google-cloud/pubsub, @google-cloud/bigquery, @google/adk, Docker.

---

### Task 1: Project Restructure & Rebranding

**Files:**
- Create: `package.json` (Merge nice frontend dependencies)
- Modify: `public/index.html:7-12`
- Modify: `src/index.ts:1-9`
- Test: `tests/system/test_rebrand.py` (or similar Jest test)

**Step 1: Write the failing test**
```typescript
// tests/rebrand.test.ts
import { execSync } from "child_process";
import fs from "fs";

describe("Ark Core Rebranding", () => {
  it("should have Ark Core in index.html title", () => {
    const html = fs.readFileSync("public/index.html", "utf-8");
    expect(html).toContain("<title>Ark Core</title>");
    expect(html).not.toContain("Axon");
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx jest tests/rebrand.test.ts`
Expected: FAIL with "Expected substring: <title>Ark Core</title>"

**Step 3: Write minimal implementation**
Move the contents of `nice frontend/public` and `nice frontend/src` to the root `public` and `src`.
Update `public/index.html`:
```html
<title>Ark Core</title>
```
Update `src/index.ts`:
```typescript
console.log("Ark Core running at http://localhost:3000");
```

**Step 4: Run test to verify it passes**
Run: `npx jest tests/rebrand.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add public/ src/ tests/
git commit -m "refactor: merge frontend files and rebrand to Ark Core"
```

---

### Task 2: UI Expansion (Video Feeds & Processing)

**Files:**
- Modify: `public/events.html` (sidebar links)
- Create: `public/video.html`
- Create: `public/processing.html`
- Test: `tests/ui.test.ts`

**Step 1: Write the failing test**
```typescript
// tests/ui.test.ts
import fs from "fs";

describe("UI Pages", () => {
  it("should have video and processing pages", () => {
    expect(fs.existsSync("public/video.html")).toBe(true);
    expect(fs.existsSync("public/processing.html")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx jest tests/ui.test.ts`
Expected: FAIL with "Received: false"

**Step 3: Write minimal implementation**
Create basic skeleton pages for `video.html` and `processing.html`.
Update sidebar navigation in existing HTML files to include:
```html
<a href="/video.html" class="nav-item">Video Feeds</a>
<a href="/processing.html" class="nav-item">Processing</a>
```

**Step 4: Run test to verify it passes**
Run: `npx jest tests/ui.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add public/
git commit -m "feat(ui): add Video Feeds and Processing sidebar pages"
```

---

### Task 3: Gemini SDK Integration (Reasoning Layer)

**Files:**
- Modify: `src/router.ts`
- Test: `tests/gemini.test.ts`

**Step 1: Write the failing test**
```typescript
// tests/gemini.test.ts
import { routedCompletion } from "../src/router";

describe("Gemini Routing", () => {
  it("should use gemini models instead of groq", async () => {
    const res = await routedCompletion("Test prompt", "high");
    expect(res.model_used).toContain("gemini");
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx jest tests/gemini.test.ts`
Expected: FAIL with "Received: groq/qwen3-32b"

**Step 3: Write minimal implementation**
In `src/router.ts`:
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODEL_NAME: Record<Severity, string> = {
  high: "gemini-1.5-pro",
  medium: "gemini-2.5-flash",
  low: "gemini-2.5-flash"
};
// Implement actual Gemini API call inside routedCompletion
```

**Step 4: Run test to verify it passes**
Run: `npx jest tests/gemini.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/router.ts package.json
git commit -m "feat(ai): swap Groq for Gemini SDK"
```

---

### Task 4: Pub/Sub Event Backbone

**Files:**
- Create: `src/pubsub.ts`
- Modify: `src/server.ts`
- Test: `tests/pubsub.test.ts`

**Step 1: Write the failing test**
```typescript
// tests/pubsub.test.ts
import { publishEvent } from "../src/pubsub";

describe("Pub/Sub", () => {
  it("should expose a publish method", () => {
    expect(typeof publishEvent).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx jest tests/pubsub.test.ts`
Expected: FAIL with "Cannot find module '../src/pubsub'"

**Step 3: Write minimal implementation**
In `src/pubsub.ts`:
```typescript
import { PubSub } from "@google-cloud/pubsub";
const pubsub = new PubSub();

export async function publishEvent(topicName: string, data: any) {
  const dataBuffer = Buffer.from(JSON.stringify(data));
  await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
}
```

**Step 4: Run test to verify it passes**
Run: `npx jest tests/pubsub.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/pubsub.ts package.json
git commit -m "feat(events): add Google Cloud Pub/Sub backbone"
```

---

### Task 5: BigQuery Memory Layer

**Files:**
- Modify: `src/memory.ts`
- Test: `tests/memory.test.ts`

**Step 1: Write the failing test**
```typescript
// tests/memory.test.ts
import { storeIncident } from "../src/memory";

describe("BigQuery Memory", () => {
  it("should store incident using bigquery", async () => {
    // mock bigquery and expect it to be called
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx jest tests/memory.test.ts`
Expected: FAIL due to Hindsight implementation.

**Step 3: Write minimal implementation**
In `src/memory.ts`:
```typescript
import { BigQuery } from "@google-cloud/bigquery";
const bq = new BigQuery();

export async function storeIncident(event: SiemEvent, report: IncidentReport): Promise<void> {
  await bq.dataset('ark_core').table('incidents').insert([{
     id: event.id,
     summary: report.summary,
     // ...
  }]);
}
```

**Step 4: Run test to verify it passes**
Run: `npx jest tests/memory.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/memory.ts package.json
git commit -m "feat(memory): replace Hindsight with BigQuery"
```

---

### Task 6: ADK Orchestration

**Files:**
- Modify: `src/agent.ts`

*(Follow similar TDD steps to introduce `@google/adk` routing)*

---

### Task 7: Cloud Run Deployment

**Files:**
- Create: `Dockerfile`
- Create: `cloudbuild.yaml`

*(Follow similar TDD steps testing `docker build`)*
