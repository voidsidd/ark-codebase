# Vanguard: Disrupting the Poaching Paradigm

Welcome to **Vanguard**. If you’re here, you’re likely tired of the antiquated, analog approach to environmental conservation. We don’t just log patrols; we triangulate threats with the cold, hard logic of a machine-learning-driven correlation engine. Vanguard is a real-time conservation intelligence platform that turns the "intelligence delay" into a relic of the past.

Built for the Government of India, the Karnataka Forest Department, and every high-stakes sandalwood or agarwood estate that actually gives a damn about its assets, Vanguard is the definitive solution for protected area management.

## 🚀 The Visionary Stack

We’ve discarded the bloated legacy tech of our competitors for a lean, high-performance architecture that scales until the last poacher puts down their rifle.

- **The Visual Cortex (Frontend):** A high-fidelity React 18 / Vite engine. We use **CesiumJS** for sub-meter resolution 3D global visualization and **Leaflet** for tactical 2D overlays. This isn't just a dashboard; it's a digital twin of the wilderness.
- **The Central Nervous System (Backend):** A Node.js sanctuary optimized for asynchronous event processing. It handles **SSE (Server-Sent Events)** to maintain persistent sinks for live sensor telemetry.
- **The Tactical Brain (AI/ML):** 
  - **Vanguard Correlation Engine (VCE):** Triangulates acoustic, visual, and human intelligence. Three sources? One confirmation. Tactical dispatch in under 1500ms.
  - **Vision:** Integrated with **Clarifai** and **HuggingFace** for real-time species classification.
  - **Cognition:** **OpenRouter** and **Gemini** generate actionable ranger recommendations that don't suck.
- **The Immutable Ledger (Storage):** **Supabase** for robust authentication and high-integrity estate data, with a **MongoDB Atlas** cluster for rapid zone telemetry.

---

## 🛠️ Deployment for the Modern Architect

If you're still deploying to on-prem servers in the jungle, you've already lost. Vanguard is built for the cloud. Specifically **Render**.

### The Environment Variable Secret Sauce
To make the AI actually intelligent, you need to feed it keys. Don't be that guy who commits them to Git.

| Variable | Function |
|----------|----------|
| `VITE_CESIUM_ION_TOKEN` | Unlocks sub-meter satellite resolution. |
| `CLARIFAI_PAT` | Real-time computer vision PAT. |
| `HF_TOKEN` | HuggingFace Inference API – the backup vision. |
| `OPENROUTER_API_KEY` | Generates recommendations that rangers actually follow. |
| `MONGODB_URI` | The connection string for your Atlas cluster. |
| `SUPABASE_URL` / `SUPABASE_KEY` | The backbone of your user integrity. |

---

## 📚 Documentation: The "In Case of Total Collapse" Vault

We’ve included a `documentation/` directory. It is the holy grail of this project. If every local file on your machine was vaporized tomorrow, this folder contains everything needed to rebuild the Vanguard empire from the ashes.

- [**System Architecture**](./documentation/architecture.md): How the magic happens.
- [**Database Schema**](./documentation/database.md): The blueprint of our intelligence.
- [**API Reference**](./documentation/api_reference.md): How we talk to the world.
- [**Rebuild Guide**](./documentation/rebuild_guide.md): Zero to 100% in 15 minutes.

---

## 🏛️ Government & Industry Utility

Vanguard is uniquely positioned to secure the **Sandalwood and Agarwood** industries, heavily backed by the **Government of India** and the **State of Karnataka**. These are billions of dollars in precious environmental assets. Vanguard provides the real-time vigilance required to protect these national treasures from illicit harvesting.

---

*“The intelligence delay is the poacher’s greatest ally. Vanguard is their greatest enemy.”*
— **Vanguard Engineering**
