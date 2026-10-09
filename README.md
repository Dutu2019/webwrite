# webwrite — WeBWorK-style app with text answers (backend)

Backend for a class-assignment app where teachers author text-answer
assignments and students submit free-text responses that are graded against
criteria. Built with Next.js App Router **API routes** + Prisma + **PostgreSQL**,
with JWT bearer-token auth.

Grading runs through **hosted Gemma 4 on the Gemini API**, called server-side
from the Next.js backend — there is no separate grading service. Each question
carries a list of criteria (key ideas) authored by the professor; they are sent
to Gemma in one batched call per answer. See "Grading" in [`API.md`](./API.md).

## Stack

| Concern    | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 15 (App Router, TypeScript)                 |
| Database   | PostgreSQL via Prisma 6 (Prisma Postgres / Vercel)  |
| Auth       | Stateless JWT bearer tokens (`jose`, HS256)         |
| Passwords  | bcryptjs                                            |
| Grading    | Hosted Gemma 4 via the Gemini API (`fetch`)         |
| Validation | zod                                                 |
| Tests      | `scripts/smoke.ts` (e2e) + Vitest (grading unit)    |

## Setup

```bash
npm install
npm run db:generate     # generate the Prisma client (platform-aware engine)
npm run db:deploy       # apply migrations to DATABASE_URL
npm run db:seed         # load example teacher/students/courses/assignments
npm run dev             # http://localhost:3000
```

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — your PostgreSQL connection string (local dev and production
  share this variable; see "Database" below)
- `JWT_SECRET`
- `GEMINI_API_KEY` (from https://aistudio.google.com/apikey) to enable grading
- `GEMMA_MODEL` — optional; `gemma-4-26b-a4b-it` (default) or `gemma-4-31b-it`

The Gemini key is used only by the server; it is never sent to the browser.

### Database

The app uses PostgreSQL everywhere. Local development points `DATABASE_URL` at a
hosted Postgres database (e.g. Prisma Postgres / Vercel Postgres), so the local
environment talks to the same database family as production. Migrations live in
`prisma/migrations` and are applied with `npm run db:deploy`
(`prisma migrate deploy`).

### Seed accounts (all password `password123`)

| Email               | Role    | Notes                       |
| ------------------- | ------- | --------------------------- |
| teacher@example.com | teacher | owns both courses           |
| alice@example.com   | student | enrolled in Physics 101     |
| bob@example.com     | student | enrolled in History 200     |

Join codes: `PHYS101`, `HIST200`.

## Scripts

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the dev server                                |
| `npm run build`     | Production build                                    |
| `npm run start`     | Serve the production build                          |
| `npm run db:generate`| Generate the Prisma client (platform-aware engine) |
| `npm run db:deploy` | Apply migrations to `DATABASE_URL`                  |
| `npm run db:migrate`| Create a migration during development               |
| `npm run db:seed`   | Seed example data                                   |
| `npm run db:studio` | Prisma Studio (browse the DB)                       |
| `npm run smoke`     | End-to-end API test (needs `npm run dev` running)   |
| `npm test`          | Vitest unit tests (grading via a mocked Gemini call)|

## Project layout

```
src/
  app/api/            # all HTTP routes (the backend)
  lib/
    db.ts             # Prisma singleton
    auth.ts           # password hashing + JWT sign/verify
    guards.ts         # requireUser / requireRole / requireCourseOwner / assertEnrolled
    errors.ts         # HttpError + status helpers (framework-free)
    http.ts           # JSON responses + error envelope + handler wrapper
    dto.ts            # response mappers (strip reference/criteria/passwordHash)
    grading/
      gemma.ts        # hosted Gemma 4 (Gemini API) client + criterion scoring
      question.ts     # load a gradable question + its criteria; per-idea view
      types.ts        # GradingInput / GradingResult
      index.ts        # evaluate() entry point
    validation/       # zod schemas
prisma/
  schema.prisma       # models (PostgreSQL)
  migrations/         # SQL migrations
  seed.ts             # example data
scripts/
  prisma-generate.mjs # platform-aware Prisma client generation
  smoke.ts            # e2e smoke test
```

See [`API.md`](./API.md) for the full endpoint reference.

## Design notes

- **Answer keys stay server-side.** `Question.reference` (answer key or rubric)
  and `Question.criteria` are only ever returned to teachers. Student-facing
  responses are built by DTO mappers in `src/lib/dto.ts`, and the smoke test
  asserts those keys never leak.
- **Authorization is per-request.** Every protected route re-checks the bearer
  token, role, course ownership, or enrollment. There is no client-supplied
  trust.
- **Grading calls hosted Gemma 4.** `src/lib/grading/index.ts` exports
  `evaluate()`; it sends the question, reference, student answer, and the
  professor's criteria to the Gemini API in one batched call and validates the
  reply strictly (no guessed or repaired answers). `GEMINI_API_KEY` stays
  server-side.
- **Students only see published work** from courses they are actively enrolled
  in.

## Deployment (Vercel)

The repo is connected to Vercel, so pushing to `main` deploys automatically.
Add these Environment Variables to the Vercel project (Production):

- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GEMMA_MODEL` (optional)

Then apply migrations with `npm run db:deploy` (from your machine, with the
production `DATABASE_URL` in the environment). `prebuild` runs
`scripts/prisma-generate.mjs`, so the correct Prisma client is always generated
before `next build`.

## Windows ARM64 note

Prisma's default Node-API query engine is an x64 native module that cannot load
into ARM64 Node. `prisma/schema.prisma` therefore sets `engineType = "binary"`,
which runs the engine as a separate x64 executable (Windows emulates x64).
`scripts/prisma-generate.mjs` removes that line when generating on any other
platform — including Vercel's Linux build — so production uses the default
engine.
