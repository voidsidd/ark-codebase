# Concerns

## Technical Debt and Architecture Issues
- **Monolithic `server.js`**: The Express server script reaches over 1100 lines and combines everything out of the box (Routing, Controller Logic, External APIs, SSE, Mock Data Seeding).
- **Ephemeral State**: State updates inside (`data/*.json`) and SSE (`clients`) will be entirely wiped upon application reboot or redeploy on containerized instances (like Render or Heroku) if persistent storage is not utilized externally.

## Testing and Fragility
- **Lack of Tests**: Zero automated tests. Given the high-consequence nature of the Vanguard Correlation Engine logic, assertions on correlation logic should be paramount.
- **Error Handling**: Missing API keys fallback quietly for the sake of presentation, but in production, they need definitive alerting constraints. Use of local fallback data can easily obscure API failure states.

## Security
- **Cross-Origin Resource Sharing (CORS)**: Currently configured as `app.use(cors({ origin: '*' }))` which is overtly permissive and assumes all API consumers act benignly.
- **Environment Variables**: Care must be taken to not commit `CLARIFAI_PAT` or `OPENROUTER_API_KEY` in source control or `.env` inadvertently.
