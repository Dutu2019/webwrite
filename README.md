# webwrite — WeBWorK-style app with text answers

A class-assignment app where teachers build assignments and students answer in
their own words. Free-text answers are graded by **hosted Gemma 4** (via the
Gemini API) against the teacher's **key ideas**: each idea is marked
`not_completed`, `in_progress`, or `included` live while the student types.
Multiple-choice questions are marked exactly. Built with Next.js App Router (UI
and API routes) + Prisma + PostgreSQL, with JWT bearer-token auth, deployed on
Vercel.

## Stack

| Concern    | Choice                                                   |
| ---------- | -------------------------------------------------------- |
| Framework  | Next.js 15 (App Router, TypeScript)                      |
| Database   | PostgreSQL via Prisma 6                                  |
| Auth       | Stateless JWT bearer tokens (`jose`, HS256)              |
| Passwords  | bcryptjs                                                 |
| Validation | zod                                                      |
| Grading    | Hosted Gemma 4 via the Gemini API (or an offline stub)   |
| Tests      | `scripts/smoke.ts` (e2e) + Vitest (unit)                 |
| Hosting    | Vercel                                                   |

## Setup

```bash
cp .env.example .env    # then set DATABASE_URL, JWT_SECRET and GEMINI_API_KEY
npm install
npm run db:deploy       # apply migrations to DATABASE_URL
npm run db:seed         # load example teacher/students/courses/assignments
npm run dev             # http://localhost:3000
```

`DATABASE_URL` must point at a PostgreSQL database, locally too (a free Neon or
Prisma Postgres database works, or any local Postgres).

| Variable          | Notes                                                        |
| ----------------- | ------------------------------------------------------------ |
| `DATABASE_URL`    | PostgreSQL connection string                                 |
| `JWT_SECRET`      | Long random string                                           |
| `GEMINI_API_KEY`  | From https://aistudio.google.com/apikey (server-side only)   |
| `GEMMA_MODEL`     | Optional: `gemma-4-26b-a4b-it` (default) or `gemma-4-31b-it` |
| `GRADING_BACKEND` | Optional: `stub` grades offline with a heuristic, no API key |

### Seed accounts (all password `password123`)

| Email               | Role    | Notes                       |
| ------------------- | ------- | --------------------------- |
| teacher@example.com | teacher | owns both courses           |
| alice@example.com   | student | enrolled in Physics 101     |
| bob@example.com     | student | enrolled in History 200     |

Join codes: `PHYS101`, `HIST200`. Demo questions for Gemma grading:

- **Physics 101 → "Explain It: Covalent Bonds"** (`KEY_IDEAS`): two key ideas
  with hints. Log in as alice.
- **History 200 → "Essay: Civil Disobedience"** (`ESSAY`): five argument moves
  (position, principle, counterargument, …). Log in as bob.

## How grading works

**Key ideas.** Each entry in a question's `criteria` is one key idea:
`description` is what the answer must contain (never shown to students) and
`hint` is a teacher-written nudge shown while that idea isn't included yet.

```json
{ "key": "idea1", "weight": 1,
  "description": "Both nuclei (protons) are attracted to the shared electrons between them.",
  "hint": "What attracts the shared electrons, and to what?" }
```

All of a question's ideas, plus a "does it state something factually
incorrect?" check, are answered in **one** Gemma call (about 1 s). An answer is
correct when every idea is `included` and nothing is flagged incorrect.
**Essays skip the incorrect check**: with no single right answer, a defensible
position must not be flagged and block completion.

**Live checking.** The student UI calls `POST /api/student/questions/:id/check`
after typing pauses; it returns each idea's status and hint, stores nothing,
and doesn't count as an attempt. Submitting re-grades on the server and records
the attempt. Students only ever see positional labels ("Idea 1", "Idea 2", …),
never idea text or criterion keys.

**Failure handling.** Gemma's reply must be exactly the requested JSON with
allowed values, or the grade is rejected (`502 GRADING_INVALID`), never
guessed. Transient Google errors (HTTP 5xx, dropped connections) get one retry;
timeouts and quota errors don't. If grading fails, nothing is stored. Check and
submit share a per-student limit of 30 requests per minute (`429 RATE_LIMITED`).

See "Grading" in [`API.md`](./API.md) for response shapes.

## Scripts

| Command               | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Start the dev server                                |
| `npm run build`       | Production build                                    |
| `npm run start`       | Serve the production build                          |
| `npm run db:generate` | Generate the Prisma client (platform-aware engine)  |
| `npm run db:deploy`   | Apply migrations to `DATABASE_URL`                  |
| `npm run db:migrate`  | Create a migration during development               |
| `npm run db:seed`     | Seed example data                                   |
| `npm run db:studio`   | Prisma Studio (browse the DB)                       |
| `npm run db:check`    | Check the database connection                       |
| `npm run smoke`       | End-to-end API test (needs `npm run dev` running)   |
| `npm test`            | Vitest unit tests                                   |

## Project layout

```
src/
  app/
    api/              # all HTTP routes (the backend)
    page.tsx, student/, teacher/, credits/   # UI pages
  components/
    student/          # assignment view, answer card with live feedback
    professor/        # class tree, assignment cards and forms
    builder/          # assignment/question builder
  lib/
    db.ts             # Prisma singleton
    auth.ts           # password hashing + JWT sign/verify
    guards.ts         # requireUser / requireRole / requireCourseOwner / assertEnrolled
    errors.ts         # HttpError + status helpers (framework-free)
    http.ts           # JSON responses + error envelope + handler wrapper
    dto.ts            # response mappers (strip reference/criteria/keys/passwordHash)
    rateLimit.ts      # per-student grading rate limit
    client/           # browser API client + session hook
    grading/
      index.ts        # evaluate(): multiple choice, Gemma, or the stub
      gemma.ts        # Gemini API client + key-idea grading (one batch call, cached)
      choice.ts       # exact multiple-choice marking
      question.ts     # load a gradable question; student-safe idea progress
      jevStub.ts      # offline heuristic grader (GRADING_BACKEND=stub)
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

- **Answer keys stay server-side.** `Question.reference`, `Question.criteria`
  (idea text and keys), and which options are correct are only ever returned to
  teachers. Student-facing responses are built by DTO mappers in
  `src/lib/dto.ts`, and the smoke test asserts nothing leaks.
- **Authorization is per-request.** Every protected route re-checks the bearer
  token, role, course ownership, or enrollment. There is no client-supplied
  trust; submissions are always re-graded on the server.
- **Grading is pluggable.** `src/lib/grading/index.ts` exports `evaluate()`;
  call sites never depend on which grader runs.
- **Grading fails closed.** If grading fails nothing is stored and the attempt
  isn't consumed; an idea the model can't judge counts as not completed.
- **Students only see published work** from courses they are actively enrolled
  in.

## Deployment (Vercel)

The repo is connected to Vercel, so pushing to `main` deploys automatically.
Add these Environment Variables to the Vercel project (Production):

- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GEMMA_MODEL` (optional)

`prebuild` runs `scripts/prisma-generate.mjs`, so the correct Prisma client is
always generated before `next build`, then `scripts/prisma-migrate.mjs`, which
applies pending migrations (`prisma migrate deploy`) on production builds only
(`VERCEL_ENV=production`; preview builds skip it). A database created with
`prisma db push` has no migration history; it is baselined automatically if its
schema already matches `prisma/schema.prisma`, otherwise the build fails. Set
`PRISMA_MIGRATE_ON_BUILD=0` to skip this step, or run `npm run db:deploy` from
your machine with the production `DATABASE_URL` in the environment.

The grading cache and the rate limit live in each serverless instance's memory,
so on Vercel they cap bursts rather than enforce exact global limits. A shared
store (e.g. Upstash Redis) would make both exact.

The grading cache and the rate limit live in each serverless instance's memory,
so on Vercel they cap bursts rather than enforce exact global limits. A shared
store (e.g. Upstash Redis) would make both exact.

## Windows ARM64 note

Prisma's default Node-API query engine is an x64 native module that cannot load
into ARM64 Node. `prisma/schema.prisma` therefore sets `engineType = "binary"`,
which runs the engine as a separate x64 executable (Windows emulates x64).
`scripts/prisma-generate.mjs` removes that line when generating on any other
platform — including Vercel's Linux build — so production uses the default
engine.
