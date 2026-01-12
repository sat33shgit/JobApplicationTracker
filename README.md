
  # Web Application Setup

  This is a code bundle for Web Application Setup. The original project is available at https://www.figma.com/design/KK6ECiSMr3tm5Tl9SKaBNe/Web-Application-Setup.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
## Build

This repository now builds only the web application. Run:

```bash
cd c:\Sateesh\Projects\JobApplicationTracker\TrackerApp
npm install
npm run build
# Job Application Tracker

This repository contains the source for the Job Application Tracker web application.

## Running the code (quick)

Install dependencies:

```bash
npm install
```

Start the frontend dev server:

```bash
npm run dev
```

To start the local API adapter (small Node HTTP server):

```bash
npm run dev:api
```

You can run both at once:

```bash
npm run dev:all
```

## Tech Stack

- **Language & Runtime:** Node.js (JavaScript/TypeScript)
- **Frontend:** React 18 + TypeScript, built with Vite
- **UI primitives:** Radix UI components, lucide-react, clsx, cmdk
- **Charts & data viz:** recharts
- **Styling:** utility-driven CSS (project uses `globals.css`); Tailwind-related utilities present
- **Data & storage:** PostgreSQL (via `pg`), local filesystem uploads, optional Cloudflare R2 or Vercel Blob (AWS S3 SDK used for S3-compatible APIs)
- **Excel export/import:** xlsx
- **Build tools / dev:** vite, @vitejs/plugin-react-swc, concurrently

## Run Locally (detailed)

Prerequisites:

- Node.js (v16+ recommended) and npm
- If using a database for full functionality, PostgreSQL

Install dependencies:

```bash
npm install
```

Set environment variables as needed. Common environment variables used by the project:

- `DATABASE_URL` or `VERCEL_POSTGRES_URL` — Postgres connection string for migrations and runtime
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` — Cloudflare R2 (optional)
- `BLOB_READ_WRITE_TOKEN` or `VERCEL_BLOB_READ_WRITE_TOKEN` — Vercel blob read/write token (optional)
- `VERCEL_BLOB_UPLOAD_URL`, `VERCEL_BLOB_PUBLIC_URL_PREFIX` — optional remote blob upload configuration
- `ENFORCE_REMOTE_UPLOADS` — set to `true` to make remote upload failures throw instead of falling back to local storage

Optional: run DB migrations (requires `DATABASE_URL` or `VERCEL_POSTGRES_URL`):

```bash
npm run migrate
```

Development servers:

```bash
# Frontend only
npm run dev

# API adapter (local)
npm run dev:api

# Both concurrently
npm run dev:all
```

Build & preview production bundle:

```bash
npm run build
npm run serve
```

Notes:

- The local API adapter is implemented in `dev-server.js` and routes requests to files under the `api/` folder.
- File uploads default to `public/uploads/` but can be configured to use Cloudflare R2 or Vercel Blob via environment variables. See `api/blob.js` for details.
- Database migrations live in `migrations/` and are applied with `npm run migrate`.

For more context, inspect `dev-server.js`, `api/blob.js`, and the `api/` handlers.
