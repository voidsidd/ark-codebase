# Integrations

## Public APIs (No Authentication Required)
- **Open-Meteo API**: Fetches live weather and environment data (`api.open-meteo.com`).
- **GBIF API**: Provides biodiversity and species occurrence data near park coordinates (`api.gbif.org`).
- **NASA EONET**: Provides nearby satellite events (`eonet.gsfc.nasa.gov`).

## Authenticated AI APIs (Optional via Environment Variables)
- **Clarifai**: Image and species classification for uploaded camera trap images. Authenticated via `CLARIFAI_PAT` environment variable (`api.clarifai.com`).
- **Hugging Face Inference API**: Fallback alternative for image classification (e.g., using `google/vit-base-patch16-224`). Authenticated via `HF_TOKEN` environment variable (`api-inference.huggingface.co`).
- **OpenRouter AI**: Generates ranger recommendations (alerts + sound analysis) using small GPT-style models. Authenticated via `OPENROUTER_API_KEY` (`openrouter.ai`).

## Fallback Mechanism
- If external generic APIs (weather, NASA, GBIF) fail to load, the system relies on fallback deterministic local data.
- If AI APIs are not provided with credentials, deterministic demo behavior is used based on mock data in `backend/data`.
