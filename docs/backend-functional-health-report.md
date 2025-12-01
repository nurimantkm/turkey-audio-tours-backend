# Backend Functional Health Report

## Setup Attempts
- Node version: assumed 18+ (repository `engines` requires >=18). Existing `.env` matched `.env.example` with a local PostgreSQL URL (`postgresql://postgres:password@localhost:5432/turkey_audio_tours`).
- Commands executed: `npm install`, then `npm run dev`.
- Startup blocked: the server fails during startup because it cannot reach PostgreSQL at `127.0.0.1:5432`, so Express never begins listening.

## Observed Startup Behavior
- `npm install` completed (removed outdated packages already in `node_modules`).
- `npm run dev` invoked `nodemon server.js` but crashed while initializing the database pool, logging repeated `ECONNREFUSED 127.0.0.1:5432` errors and exiting before the server could accept requests.

## Endpoint Status Snapshot
Status categories: **Working** (verified by run), **Partial** (runs but issues), **Broken** (fails/bug), **Not tested** (blocked by startup).

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /health` | Not tested | Server never started due to missing PostgreSQL.
| `POST /api/auth/register` | Not tested | Requires running server and DB.
| `POST /api/auth/login` | Not tested | Requires running server and DB.
| `GET /api/auth/me` | Not tested | Requires valid token and DB.
| `PUT /api/auth/profile` | Not tested | Requires valid token and DB.
| `POST /api/auth/change-password` | Not tested | Requires valid token and DB.
| `GET /api/locations` | Not tested | Requires running server and DB.
| `GET /api/locations/:id` | Not tested | Requires running server and DB.
| `POST /api/locations` | Broken (code) | SQL uses 11 placeholders but passes 12 values, so creating a location will throw a parameter error before hitting the DB.
| `PUT /api/locations/:id` | Not tested | Requires running server and DB.
| `DELETE /api/locations/:id` | Not tested | Requires running server and DB.
| `GET /api/locations/stats/overview` | Broken (route order) | Defined after the `/:id` route, so requests hit the ID handler instead of stats.
| `GET /api/users/favorites` | Not tested | Requires valid token and DB.
| `POST /api/users/favorites/:locationId` | Not tested | Requires valid token and DB.
| `DELETE /api/users/favorites/:locationId` | Not tested | Requires valid token and DB.
| `GET /api/users/progress` | Not tested | Requires valid token and DB.
| `PUT /api/users/progress/:locationId` | Not tested | Requires valid token and DB.
| `PUT /api/users/subscription` | Not tested | Requires valid token and DB.
| `GET /api/users/stats` | Not tested | Requires valid token and DB.

## Authentication, Rate Limiting, and Error Handling Notes
- Auth tokens are mandatory for all `/api/users/*` and mutating `/api/locations` routes; optional auth middleware exists but is unused. Errors for missing or invalid tokens return structured JSON with clear messages.
- `/api/*` endpoints are rate-limited to 100 requests per 15 minutes per IP. `/health` and `/` are not rate-limited.
- 404 responses include the attempted method and path alongside available top-level endpoints.

## High-Impact Issues to Address
1. Server cannot start without a reachable PostgreSQL instance; consider graceful startup or documentation for local DB provisioning.
2. `POST /api/locations` SQL placeholder mismatch will throw an error even with a working DB.
3. `GET /api/locations/stats/overview` is unreachable because the `/:id` route is registered first.
