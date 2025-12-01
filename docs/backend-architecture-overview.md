# Backend Architecture Overview

## High-Level Structure
```
.
├── server.js                 # Express app entrypoint and server bootstrap
├── database/
│   └── db.js                 # PostgreSQL pool, query helper, initialization
├── middleware/
│   └── auth.js               # JWT-based authentication helpers
├── routes/
│   ├── auth.js               # Registration, login, profile, password
│   ├── locations.js          # CRUD and stats for tour locations
│   └── users.js              # Favorites, progress, subscription, stats
├── package.json              # Scripts and dependencies
└── docs/
    └── backend-architecture-overview.md (this file)
```

## Boot Sequence
1. **Process start**: `npm start` runs `node server.js` (configured in `package.json`).
2. **Environment load**: `dotenv.config()` reads `.env` before any configuration is used.
3. **App creation**: `express()` instance is created and `PORT` is resolved (`process.env.PORT || 3001`).
4. **Middleware registration**: security, compression, rate limiting, CORS, parsers, and logging are attached in order (see below).
5. **Health endpoint**: `/health` is exposed for uptime checks.
6. **Route mounting**: feature routers are mounted under `/api/locations`, `/api/users`, and `/api/auth`.
7. **Fallback handlers**: a catch-all 404 responder and a global error handler are registered.
8. **Database initialization**: `startServer()` awaits `initializeDatabase()` to ensure tables/default data exist.
9. **Server listen**: `app.listen(PORT, '0.0.0.0')` logs startup details (port, environment, frontend URL).

## Request Lifecycle & Middleware Order
Middleware are applied in `server.js` in this sequence (earlier items wrap later ones):
1. `helmet()` – sets common security headers.
2. `compression()` – gzip response bodies.
3. Rate limiter (`express-rate-limit`) – attached to `/api/*` routes to cap requests per IP.
4. `cors()` – allows cross-origin requests from `FRONTEND_URL` (or `http://localhost:5173` fallback), with credentials and common methods/headers enabled.
5. `express.json()` with 10 MB limit – parses JSON bodies.
6. `express.urlencoded()` with 10 MB limit – parses URL-encoded bodies.
7. `morgan('combined')` – HTTP request logging.
8. Route handlers – mounted routers for locations, users, and auth (see next section).
9. 404 handler – catches unmatched routes and returns a structured error message.
10. Global error handler – logs the error and sends a 500 (or provided status) with environment-aware messaging.

### Authentication Flow
- `authenticateToken` middleware (from `middleware/auth.js`) verifies `Authorization: Bearer <token>` headers using `JWT_SECRET` (or the fallback string). It populates `req.user` on success or returns 401/403 on failure. Routes that require authentication apply it explicitly (e.g., user favorites/progress, profile updates, creating locations).

## Route Mounting Overview
- `/health` – inline in `server.js`; simple JSON status check.
- `/` – inline in `server.js`; returns API metadata and links.
- `/api/locations` → `routes/locations.js`
  - GET `/` list with optional `category`, `is_premium`, pagination
  - GET `/:id` fetch single
  - POST `/` create (auth required)
  - PUT `/:id` update (auth required)
  - DELETE `/:id` delete (auth required)
  - GET `/stats/overview` aggregate stats
- `/api/users` → `routes/users.js`
  - GET `/favorites`, POST/DELETE `/favorites/:locationId`
  - GET `/progress`, PUT `/progress/:locationId`
  - PUT `/subscription`
  - GET `/stats`
  - All above require authentication
- `/api/auth` → `routes/auth.js`
  - POST `/register`, POST `/login`
  - GET `/me`, PUT `/profile`, POST `/change-password` (auth required)

## Configuration & Environment Variables
| Variable | Purpose | Default/Fallback | Effect if Missing |
| --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the Pool. | none (must be provided) | Pool creation will fail, preventing startup.
| `NODE_ENV` | Controls environment mode and DB SSL (enabled in production). Also influences error messages. | `'development'` | SSL disabled by default; error handler returns detailed messages instead of generic ones.
| `PORT` | Port the Express server listens on. | `3001` | Server still starts on 3001.
| `FRONTEND_URL` | Allowed origin for CORS. | `http://localhost:5173` | CORS falls back to localhost origin.
| `JWT_SECRET` | Secret key for signing/verifying JWTs. | `'your-secret-key'` | JWTs use weak fallback; tokens from other secrets will fail verification.

> Note: `.env.example` lists additional variables for future features (uploads, email, Stripe, map services, Redis) but they are not referenced in the current codebase.

## Database Integration
- **Pool creation**: `database/db.js` builds a `pg.Pool` using `DATABASE_URL` and an SSL config that enables `rejectUnauthorized: false` in production.
- **Connection logging**: Pool emits `connect` (logs successful connection) and `error` events (logs connection issues).
- **Query helper**: `query(text, params)` wraps `pool.query`, logs execution duration and row count, and rethrows errors.
- **Initialization**: `initializeDatabase()` is awaited before the server starts. It creates tables (`users`, `locations`, `user_favorites`, `user_progress`) if missing and seeds default locations when empty. Success/failure is logged, and startup halts on errors.

## Startup Flow Summary
`startServer()` (invoked at the bottom of `server.js`):
1. Calls `initializeDatabase()` to ensure schema and seed data exist.
2. Starts the Express app listening on `PORT` and logs environment info, health URL, and configured frontend origin.

