# ResumeAI — Backend API

Node.js + Express + TypeScript + MongoDB (Mongoose). JWT auth with bcrypt password hashing.

## Run

```bash
cp .env.example .env    # set a real JWT_SECRET
npm install
npm run dev             # http://localhost:5000
```

Health check: `GET /api/health` → `{ "status": "ok" }` (no DB required).

## Structure

```
src/
├── index.ts              # entry — starts the server, connects DB in background
├── app.ts                # Express app: middleware + routes
├── config/
│   ├── env.ts            # typed env access (secrets from environment only)
│   └── db.ts             # Mongoose connection (non-fatal in dev)
├── models/               # User, Resume (structured schema)
├── controllers/          # auth, resume, ai — thin HTTP layer
├── services/             # auth, resume, ai — business logic
├── routes/               # /auth, /resumes, /ai
├── middleware/           # requireAuth (JWT), error + 404 handlers
├── utils/                # jwt, ApiError, asyncHandler
└── types/                # Express Request augmentation (req.userId)
```

## API

| Method | Route                 | Auth | Notes                                  |
| ------ | --------------------- | ---- | -------------------------------------- |
| GET    | `/api/health`         | —    | Health check                           |
| POST   | `/api/auth/register`  | —    | `{ name, email, password }` → token    |
| POST   | `/api/auth/login`     | —    | `{ email, password }` → token          |
| GET    | `/api/auth/me`        | ✅   | Current user                           |
| GET    | `/api/resumes`        | ✅   | List the user's resumes                |
| POST   | `/api/resumes`        | ✅   | Create a resume                        |
| GET    | `/api/resumes/:id`    | ✅   | Get one (owner only)                   |
| PUT    | `/api/resumes/:id`    | ✅   | Update (owner only)                    |
| DELETE | `/api/resumes/:id`    | ✅   | Delete (owner only)                    |
| POST   | `/api/ai/generate`    | ✅   | **501** until AI is integrated         |
| POST   | `/api/ai/edit`        | ✅   | **501** until AI is integrated         |

## Notes

- **Passwords** are hashed with `bcryptjs` (pure-JS, no native build step) — a drop-in, API-compatible alternative to `bcrypt` chosen for reliable Windows installs.
- **AI logic** lives only in `services/ai.service.ts`. Controllers/routes never touch a provider SDK directly, so the provider can be wired up in one place next.
