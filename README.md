# ResumeAI — Application

**Don't fill forms. Tell your story.**

The ResumeAI product: the authenticated resume builder and the API behind it.
The public marketing website is a separate deployment,
[resumeai-marketing](https://github.com/RiyaMadaan/resumeai-marketing).

```
resumeai-app/
├── frontend/   React + TypeScript + Vite + Tailwind — the application UI
└── backend/    Node + Express + TypeScript + MongoDB — the API
```

## What the application does

- **Auth** — register / login, JWT + bcrypt, protected routes
- **Dashboard** — your resumes, with rename, duplicate, delete and ATS score
- **Create a resume** three ways — describe your career in plain language,
  answer questions in an **AI Resume Interview**, or **upload** an existing
  PDF/DOCX and have it turned into an editable resume
- **Editor** — live preview, every section editable, three templates
- **Ask AI** — improve wording and strengthen sections
- **Tailor for a job** — paste a job description and get a reviewed, tailored
  proposal; requirements you don't meet are reported, never invented
- **ATS score** — 0–100 readiness report with category breakdown and keywords
- **PDF download** — a real vector PDF, not a screenshot

Across every AI feature the rule is the same: rewrite what you wrote, never
invent facts you didn't provide.

## Prerequisites

- Node.js 18+ (developed on Node 24)
- MongoDB running locally, or a connection string
- An Anthropic API key

## Getting started

Two terminals — one per package.

### 1) Backend

```bash
cd backend
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
# edit .env — set JWT_SECRET and ANTHROPIC_API_KEY
npm install
npm run dev              # http://localhost:5000  (health: /api/health)
```

### 2) Frontend

```bash
cd frontend
cp .env.example .env     # defaults to http://localhost:5000/api
npm install
npm run dev              # http://localhost:5173
```

Then register at **http://localhost:5173/register**.

## Environment variables

### `backend/.env`

| Variable            | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `PORT`              | API port (default `5000`)                            |
| `NODE_ENV`          | `development` / `production`                         |
| `CLIENT_ORIGIN`     | Allowed CORS origin (the frontend URL)               |
| `MONGODB_URI`       | MongoDB connection string                            |
| `JWT_SECRET`        | Secret for signing JWTs — **set a real value**       |
| `JWT_EXPIRES_IN`    | Token lifetime (e.g. `7d`)                           |
| `AI_PROVIDER`       | `anthropic`                                          |
| `ANTHROPIC_API_KEY` | Anthropic API key — **backend only**                 |
| `AI_MODEL`          | Model id (e.g. `claude-opus-4-8`)                    |

### `frontend/.env`

| Variable            | Purpose                                |
| ------------------- | -------------------------------------- |
| `VITE_API_BASE_URL` | Base URL of the backend API (`…/api`)  |

**The Anthropic key is server-side only.** Every AI call is made by the backend;
the browser only ever talks to this API. Nothing secret is exposed through a
`VITE_`-prefixed variable, and `.env` files are git-ignored — commit only
`.env.example`.

## Architecture

```
React frontend  →  Express API  →  Anthropic API
                        ↓
                     MongoDB
```

All AI logic lives in one place, `backend/src/services/ai.service.ts` — never in
a controller or a React component. That is what keeps the provider swappable and
the key server-side.

### API routes

| Method | Route                   | Purpose                                  |
| ------ | ----------------------- | ---------------------------------------- |
| GET    | `/api/health`           | Liveness check                           |
| POST   | `/api/auth/register`    | Create an account                        |
| POST   | `/api/auth/login`       | Sign in                                  |
| GET    | `/api/auth/me`          | Restore the session                      |
| GET    | `/api/resumes`          | List your resumes                        |
| POST   | `/api/resumes`          | Create a resume                          |
| POST   | `/api/resumes/import`   | Import a PDF/DOCX                        |
| GET    | `/api/resumes/:id`      | Read one resume                          |
| PUT    | `/api/resumes/:id`      | Update a resume                          |
| DELETE | `/api/resumes/:id`      | Delete a resume                          |
| POST   | `/api/ai/generate`      | Career description → structured sections |
| POST   | `/api/ai/edit`          | Ask AI                                   |
| POST   | `/api/ai/customize`     | Tailor for a job description             |
| POST   | `/api/ai/ats-score`     | ATS readiness report                     |
| POST   | `/api/ai/interview`     | One turn of the AI Resume Interview      |

Everything except `/api/health` and the two auth entry points requires a bearer
token, and every resume operation is scoped to the authenticated user.

## Commands

| Location   | Command             | What it does                          |
| ---------- | ------------------- | ------------------------------------- |
| `backend`  | `npm run dev`       | Start the API with hot reload (tsx)   |
| `backend`  | `npm run build`     | Type-check and compile to `dist/`     |
| `backend`  | `npm start`         | Run the compiled server               |
| `backend`  | `npm run typecheck` | Type-check only                       |
| `frontend` | `npm run dev`       | Start the Vite dev server             |
| `frontend` | `npm run build`     | Type-check and build to `dist/`       |
| `frontend` | `npm run preview`   | Preview the production build          |

> `npm start` loads the compiled output once and has no watcher — after a
> backend change, rebuild **and** restart, or just use `npm run dev`.

## Deployment notes

- Build the frontend (`npm run build`) and serve `dist/` from any static host.
- Run the backend as a Node service with its environment variables set.
- Set `CLIENT_ORIGIN` to the deployed frontend URL so CORS allows it, and
  `VITE_API_BASE_URL` to the deployed API URL.
- Point the marketing site's `VITE_APP_URL` at wherever this frontend is
  deployed, so its CTAs land here.
