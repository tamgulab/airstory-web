# Reference air quality (OpenAQ + WAQI)

The **Analysis** page can show a **reference series** near Philadelphia / New York / Hanoi for **PM2.5** (and sometimes CO / temp / humidity). Keys stay on the **backend only**.

## Priority

1. **[OpenAQ](https://openaq.org/)** v3 — preferred when a nearby sensor exists.
2. **[WAQI](https://aqicn.org/)** (aqicn.org) — fallback when OpenAQ is empty (especially **Hanoi**).
3. Simulated city baseline — last resort in the UI.

WAQI PM2.5 values are published as US EPA AQI and converted on the server to approximate **µg/m³** so they line up with classroom measurements.

## Local backend

1. Copy `backend/.env.example` → `backend/.env` (gitignored).
2. Set one or both:
   ```bash
   OPENAQ_API_KEY=your_openaq_key
   WAQI_API_TOKEN=your_waqi_token
   ```
3. Restart the API (`npm run dev` in `backend/`).

- OpenAQ key: https://docs.openaq.org/using-the-api/api-key  
- WAQI token: https://aqicn.org/data-platform/token/

## Production (Render)

Add **`OPENAQ_API_KEY`** and/or **`WAQI_API_TOKEN`** → Save → redeploy.

## Git

Never commit real keys. `backend/.env` is ignored; keep examples in `.env.example` only.

## Behavior

- Endpoint (unchanged for the frontend): `GET /analytics/openaq/daily` and `/analytics/openaq/heatmap`.
- Response may include `source: "openaq" | "waqi"` and `locationName`.
- Heat Map city overlay uses the same fallback (WAQI map bounds when OpenAQ returns no points).
