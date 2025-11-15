Database and API integration (Vercel Postgres)

Overview
- This project uses Vercel Postgres (Postgres) to persist job applications.
- Serverless API endpoints are added under `api/` which use `pg` to connect to the database.

Files added
- `migrations/001_init.sql` — initial schema for `jobs`, `notes`, `tags`, and `job_tags`.
- `scripts/migrate.js` — Node migration runner (reads `DATABASE_URL` env var).
- `api/db.js` — DB helper that reuses a `pg` Pool across invocations.
- `api/jobs/index.js` — `GET /api/jobs` and `POST /api/jobs`.
- `api/jobs/[id].js` — `GET/PUT/PATCH/DELETE /api/jobs/:id`.

Local development
1. Install dependencies:

```bash
npm install
```

2. Set a local Postgres connection string in `.env` (or in your shell):

```bash
export DATABASE_URL="postgres://user:pass@localhost:5432/jobtracker"
```

3. Run migrations:

```bash
npm run migrate
```

4. Start the dev server:

```bash
npm run dev
```

API usage
- List jobs: `GET /api/jobs`
- Create job: `POST /api/jobs` with JSON body { title, company, status, ... }
- Get job: `GET /api/jobs/{id}`
- Update job: `PUT /api/jobs/{id}` with JSON body of fields to update
- Delete job: `DELETE /api/jobs/{id}`

Vercel deployment
- Add Vercel Postgres to your project and set the produced environment variable (commonly `DATABASE_URL` or `VERCEL_POSTGRES_URL`) in the Vercel project settings.
- Vercel will pick up serverless `api/` endpoints automatically.

Security
- Set the DB credentials only as environment variables in Vercel. Do not commit credentials to source control.
