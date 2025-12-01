# Backend API and Schema Catalog

This document summarizes the REST API surface and how each endpoint interacts with the PostgreSQL schema used by the Turkey Audio Tours backend.

## Endpoint Overview

| Method | Path | Auth | Request | Key Responses | Tables Touched |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | None | JSON `{ email, password, first_name?, last_name? }` (password ≥6 chars; email unique) | 201 with `{ user, token }`; 400 validation; 409 conflict | `users` |
| POST | `/api/auth/login` | None | JSON `{ email, password }` | 200 with `{ user, token }`; 400 validation; 401 invalid creds | `users` |
| GET | `/api/auth/me` | Required | Header `Authorization: Bearer <token>` | 200 `{ user }`; 404 if missing | `users` |
| PUT | `/api/auth/profile` | Required | Optional `{ first_name, last_name, email }`; email must be unique if provided | 200 `{ user }`; 400 validation/empty update; 409 email conflict | `users` |
| POST | `/api/auth/change-password` | Required | `{ current_password, new_password }` (new ≥6 chars) | 200 message; 400 validation; 401 invalid current; 404 missing user | `users` |
| GET | `/api/locations` | None | Query: `category`, `is_premium`, `limit` (default 50), `offset` (default 0) | 200 list with pagination metadata | `locations` |
| GET | `/api/locations/:id` | None | URL param `id` int | 200 location; 400 invalid id; 404 not found | `locations` |
| POST | `/api/locations` | Required | `{ name, description?, category?, duration?, rating?, listeners?, is_premium?, image_url?, audio_url?, latitude?, longitude? }`; name required; category whitelist; rating 0–5; listeners ≥0; coords bounded | 201 location; 400 validation | `locations` (created_by set to authed user) |
| PUT | `/api/locations/:id` | Required | Same validations as create; `id` param int | 200 updated location; 400 validation; 404 if missing | `locations` |
| DELETE | `/api/locations/:id` | Required | `id` param int | 200 message; 400 validation; 404 if missing | `locations` |
| GET | `/api/locations/stats/overview` | None | — | 200 with totals, premium/free counts, category distribution, avg rating | `locations` (aggregations) |
| GET | `/api/users/favorites` | Required | — | 200 list of favorited locations | `user_favorites` join `locations` |
| POST | `/api/users/favorites/:locationId` | Required | `locationId` param int | 201 message; 400 validation; 404 missing location; 409 already favorited | `user_favorites`, `locations` (existence check) |
| DELETE | `/api/users/favorites/:locationId` | Required | `locationId` param int | 200 message; 400 validation; 404 if not favorited | `user_favorites` |
| GET | `/api/users/progress` | Required | — | 200 list with progress fields | `user_progress` join `locations` |
| PUT | `/api/users/progress/:locationId` | Required | `locationId` param int; body `{ progress_percentage 0–100, completed?, last_position? }` | 200 upserted progress; 400 validation; 404 missing location | `user_progress`, `locations` (existence check) |
| PUT | `/api/users/subscription` | Required | `{ subscription_type ('free'|'premium'|'pro'), is_premium (bool) }` | 200 `{ user }`; 400 validation | `users` |
| GET | `/api/users/stats` | Required | — | 200 with favorites count, started/completed counts, avg progress, recent activity | `user_favorites`, `user_progress`, `locations` |
| GET | `/health` | None | — | 200 service status | — |

## Endpoint Details

### Authentication
- **POST `/api/auth/register`** – Validates email/password plus optional names; rejects duplicate emails; stores `password_hash` using bcrypt and returns JWT including subscription fields.
- **POST `/api/auth/login`** – Validates credentials; compares password with stored hash; issues JWT.
- **GET `/api/auth/me`** – JWT required; returns profile fields.
- **PUT `/api/auth/profile`** – JWT required; optional updates for name/email; ensures at least one field provided and email uniqueness; updates `updated_at`.
- **POST `/api/auth/change-password`** – JWT required; checks current password before hashing and replacing password.

### Locations
- **GET `/api/locations`** – Supports category filtering, premium flag filter, pagination; ordered by `created_at` descending.
- **GET `/api/locations/:id`** – Returns a single location by id.
- **POST `/api/locations`** – JWT required; validates fields (category whitelist `Architecture|Religion|History|Culture|Nature`, rating 0–5, listeners ≥0, coordinates within bounds); inserts with defaults and associates `created_by` with authenticated user.
- **PUT `/api/locations/:id`** – JWT required; same validation as create; requires name plus other fields; updates timestamps.
- **DELETE `/api/locations/:id`** – JWT required; deletes after existence check.
- **GET `/api/locations/stats/overview`** – Aggregates counts (total, premium vs. free), category distribution, and average rating (ignoring zero ratings) for dashboard use.

### Users
- **GET `/api/users/favorites`** – JWT required; returns favorited locations with metadata and when favorited.
- **POST `/api/users/favorites/:locationId`** – JWT required; ensures location exists and not already favorited before insert.
- **DELETE `/api/users/favorites/:locationId`** – JWT required; removes favorite; 404 if none existed.
- **GET `/api/users/progress`** – JWT required; lists progress records joined with location metadata.
- **PUT `/api/users/progress/:locationId`** – JWT required; validates `progress_percentage` 0–100, optional boolean `completed`, and non-negative `last_position`; upserts progress and updates `updated_at`.
- **PUT `/api/users/subscription`** – JWT required; validates `subscription_type` enum and boolean `is_premium`; updates flags.
- **GET `/api/users/stats`** – JWT required; aggregates favorites count, progress totals (started/completed, average percent), and last 5 activities (name/category/progress/completed/timestamp).

### Health
- **GET `/health`** – Unauthenticated service check returning status, message, timestamp, and version.

## Data Model

### users
- `id SERIAL PRIMARY KEY`
- `email VARCHAR(255) UNIQUE NOT NULL`
- `password_hash VARCHAR(255) NOT NULL`
- `first_name VARCHAR(100)`
- `last_name VARCHAR(100)`
- `is_premium BOOLEAN DEFAULT FALSE`
- `subscription_type VARCHAR(50) DEFAULT 'free'`
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### locations
- `id SERIAL PRIMARY KEY`
- `name VARCHAR(255) NOT NULL`
- `description TEXT`
- `category VARCHAR(100) DEFAULT 'Architecture'`
- `duration VARCHAR(50)`
- `rating DECIMAL(2,1) DEFAULT 0.0`
- `listeners INTEGER DEFAULT 0`
- `is_premium BOOLEAN DEFAULT FALSE`
- `image_url TEXT`
- `audio_url TEXT`
- `latitude DECIMAL(10, 8)`
- `longitude DECIMAL(11, 8)`
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `created_by INTEGER REFERENCES users(id)`

### user_favorites
- `id SERIAL PRIMARY KEY`
- `user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
- `location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE`
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `UNIQUE(user_id, location_id)` to prevent duplicates

### user_progress
- `id SERIAL PRIMARY KEY`
- `user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
- `location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE`
- `progress_percentage INTEGER DEFAULT 0`
- `completed BOOLEAN DEFAULT FALSE`
- `last_position INTEGER DEFAULT 0`
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `UNIQUE(user_id, location_id)` to enforce one record per user/location

## Relationships

```
users (1) ──< locations.created_by
users (1) ──< user_favorites.user_id >── (1) locations
users (1) ──< user_progress.user_id >── (1) locations
```

- `user_favorites` and `user_progress` implement many-to-many relationships between users and locations (with additional progress metadata in the latter).
- Deleting a user cascades to favorites and progress records; deleting a location cascades likewise.

## Endpoint ↔ Table Mapping Highlights

- **Authentication endpoints** (`/api/auth/*`) read/write the `users` table (password changes update `password_hash`; profile updates affect identity fields).
- **Location CRUD** touches `locations`; the creation endpoint also fills `created_by` with the authenticated user id; rating/listener stats are stored directly on locations.
- **Favorites** endpoints manage rows in `user_favorites` and join to `locations` when reading.
- **Progress** endpoints upsert into `user_progress` and join `locations` for reads; stats aggregate counts/averages across `user_progress`.
- **Subscription** updates toggle `subscription_type`/`is_premium` flags on `users`, which are also embedded in JWT payloads.
- **Stats endpoints**: `/api/locations/stats/overview` aggregates over `locations` (counts, categories, average rating); `/api/users/stats` aggregates over `user_favorites` and `user_progress` with joins to `locations` for recent activity labels.

## Gaps / Questions

- **Admin role checks** are stubbed in `authenticateAdmin` but not enforced; current design treats any authenticated user as an admin for protected routes.
- **Data quality**: `rating` defaults to 0 and averages exclude zeros, but there is no server-side rule preventing write-time values outside 0–5 beyond validation; database constraints might be added.
- **Missing indexes**: foreign key columns (`user_id`, `location_id`, `created_by`) may benefit from indexes for stats and join-heavy queries.
- **Media URLs**: `audio_url` is nullable and not populated in defaults; consider documenting/validating expected formats.
