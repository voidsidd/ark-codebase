# Conventions

## Code Style & Language
- **Frontend**: Written in TypeScript using React 18 functional components alongside Hooks (`useEffect`, `useState`). Fully typed where possible.
- **Backend**: Plain JavaScript (Node.js/CommonJS) with traditional `require()` statements. No TypeScript compilation is used on the backend.
- **Styling**: Tailwind CSS classes inline within the standard `className` prop (`clsx` and `tailwind-merge` heavily utilized for dynamic class merging).

## Patterns
- **Monolithic File**: The backend places all routes (REST + Webhook + SSE) in a single `server.js` file.
- **Environment Variables**: Missing keys silently fall back to mock or deterministic generative data (e.g., HuggingFace vs standard array lookup).

## Error Handling
- The backend leverages basic `try/catch` within async/await integrations.
- Errors while calling external models (like OpenRouter) are typically logged but do not crash the Node.js process, allowing smooth fallback to mock responses.
