# Integration and Deployment Overview

## Architecture in Production
- **Frontend (Vercel)** ➜ **Backend (Render)** ➜ **Database (Neon PostgreSQL)**.
- The backend uses `DATABASE_URL` for its connection string. In production it enables SSL (`rejectUnauthorized: false`), which matches Neon-hosted PostgreSQL requirements while allowing local non-SSL connections in development.【F:database/db.js†L8-L16】
- The backend binds to `0.0.0.0` on `PORT` (default `3001`) and expects the frontend domain in `FRONTEND_URL` for CORS.【F:server.js†L35-L41】【F:server.js†L108-L114】

## Frontend ➜ Backend Integration
- The backend only permits cross-origin requests from the `FRONTEND_URL` environment variable (defaults to `http://localhost:5173`) and sends `Access-Control-Allow-Credentials: true`, enabling cookie/credentialed requests.【F:server.js†L35-L41】
- **Frontend API base URL derivation:** The `voyce` frontend repository was not reachable from this environment (HTTP 403 while attempting to fetch from GitHub).【656738†L1-L9】 As a result, the exact client-side derivation of the API base URL could not be inspected here. The backend expects the frontend to target its public Render URL, using the `/api/...` routes described in this repository.

## Backend ➜ Database Integration (Neon/PostgreSQL)
- Connection string: `DATABASE_URL` (example: `postgresql://username:password@host:port/dbname`).【F:.env.example†L1-L12】 A Neon URL should be supplied in production; SSL is required automatically when `NODE_ENV=production`.【F:database/db.js†L8-L16】
- On startup the backend initializes tables and seeds default locations before listening for requests.【F:server.js†L102-L124】

## Deployment Assumptions
### Backend on Render
- README deployment steps specify:
  - Build: `npm install`
  - Start: `npm start`
  - Environment: Node
  - Configure environment variables (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`).【F:README.md†L146-L164】
- These commands align with `package.json` scripts (`start` runs `node server.js`; `dev` uses `nodemon`). No mismatch detected.【F:package.json†L7-L19】

### Frontend on Vercel
- Not directly accessible in this environment. Expected behavior is that Vercel exposes the UI at its assigned domain and forwards API calls to the Render backend URL configured in the frontend’s environment settings.

## Environment Matrix
| Environment | API Base URL | Frontend URL | Database URL | Notes |
| --- | --- | --- | --- | --- |
| Local | `http://localhost:3001` (default `PORT`) | `http://localhost:5173` (`FRONTEND_URL` default) | `postgresql://username:password@localhost:5432/turkey_audio_tours` (`DATABASE_URL` example) | Use `npm run dev`; CORS allows the local frontend.【F:.env.example†L1-L12】【F:server.js†L35-L41】 |
| Development/Staging (Render) | Render service URL (e.g., `https://<service>.onrender.com`) | Vercel preview/assigned domain configured in `FRONTEND_URL` | Neon/Render Postgres connection string with SSL (`postgres://...` using `NODE_ENV=production`) | Ensure `FRONTEND_URL` matches the preview domain; SSL enforced for DB.【F:README.md†L146-L164】【F:database/db.js†L8-L16】 |
| Production | Render production URL (same as above, with custom domain if configured) | Vercel production domain | Neon production URL (with SSL) | Keep `NODE_ENV=production` and strong `JWT_SECRET`; align domains for CORS.【F:README.md†L146-L164】【F:server.js†L35-L41】 |

## CORS & Security Notes
- **Allowed origins:** Single origin from `FRONTEND_URL` (defaults to localhost).【F:server.js†L35-L41】
- **Credentials:** Enabled, so cookies or Authorization headers are allowed cross-site.【F:server.js†L35-L41】
- **Methods/Headers:** GET/POST/PUT/DELETE/OPTIONS with `Content-Type` and `Authorization` headers permitted.【F:server.js†L35-L41】
- **Rate limiting:** 100 requests per 15 minutes on `/api/*`.【F:server.js†L27-L34】
- **JWT lifetime:** Tokens expire after 7 days; failures return explicit error messages for expired/invalid tokens.【F:routes/auth.js†L23-L35】【F:README.md†L117-L122】
- **Potential risks:**
  - Only a single allowed origin; forgetting to update `FRONTEND_URL` for Vercel domains will break CORS.
  - When `NODE_ENV=production`, SSL uses `rejectUnauthorized: false`, which is typical for managed Postgres like Neon but should be reviewed if stricter TLS verification is required.【F:database/db.js†L8-L16】
  - Frontend repository unavailable for verification here, so confirm the client reads its API base URL from environment rather than hard-coding to prevent deployment mismatches.【656738†L1-L9】

