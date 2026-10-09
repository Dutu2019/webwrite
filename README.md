# webwrite — WeBWorK-style app with text answers

A class-assignment app where teachers author text-answer assignments and
students write free-text explanations that are graded against **key ideas**.
Built with Next.js App Router (UI + **API routes**) + Prisma + SQLite, with JWT
bearer-token auth.

Answers are graded by the Gemma decision service in [`gemma/`](./gemma), which
marks each key idea as `not_completed`, `in_progress`, or `included`, flags
factually wrong answers, and supports live checking while the student types.
Grading is pluggable: `GRADING_BACKEND=stub` switches to a deterministic local
stub that runs fully offline (no API key or Python needed).

## Stack

| Concern    | Choice                                                  |
| ---------- | ------------------------------------------------------- |
| Framework  | Next.js 15 (App Router, TypeScript)                     |
| Database   | SQLite via Prisma 6                                     |
| Auth       | Stateless JWT bearer tokens (`jose`, HS256)             |
| Passwords  | bcryptjs                                                |
| Validation | zod                                                     |
| Grading    | Hosted Gemma 4 via `gemma/` (Python), or a local stub   |
| Tests      | `scripts/smoke.ts` (e2e) + Vitest (grading unit)        |

## Setup

```bash
cp .env.example .env    # then set JWT_SECRET and GEMINI_API_KEY
npm install
npm run db:migrate      # create prisma/dev.db, apply migrations, generate the Prisma client
npm run db:seed         # load example teacher/students/courses/assignments
npm run dev             # http://localhost:3000
```

Grading also needs the Gemma service running; see
[Grading with Gemma](#grading-with-gemma). To run without it, set
`GRADING_BACKEND="stub"` in `.env`.

One `.env` at the repo root configures everything: the Next.js app, Prisma, and
the `gemma/` service all read it. It is git-ignored.

| Variable           | Used by  | Notes                                                   |
| ------------------ | -------- | ------------------------------------------------------- |
| `DATABASE_URL`     | Prisma   | `file:./dev.db` (relative to `prisma/`)                 |
| `JWT_SECRET`       | API      | Long random string for anything non-local               |
| `GRADING_BACKEND`  | API      | `gemma` (default) or `stub` (offline)                   |
| `GEMMA_BATCH_URL`  | API      | Defaults to `http://127.0.0.1:8000/v1/decide/batch`     |
| `GEMINI_API_KEY`   | `gemma/` | From https://aistudio.google.com/apikey                 |
| `GEMMA_MODEL`      | `gemma/` | Optional: `gemma-4-26b-a4b-it` (default) or `gemma-4-31b-it` |

### Seed accounts (all password `password123`)

| Email               | Role    | Notes                       |
| ------------------- | ------- | --------------------------- |
| teacher@example.com | teacher | owns both courses           |
| alice@example.com   | student | enrolled in Physics 101     |
| bob@example.com     | student | enrolled in History 200     |

Join codes: `PHYS101`, `HIST200`.

## Grading with Gemma

1. Put `GEMINI_API_KEY` in `.env` (`GRADING_BACKEND` defaults to `gemma`).
2. Start the Gemma service in a second terminal (first run creates its venv):

   ```powershell
   cd gemma
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
   ```

   http://127.0.0.1:8000/health should show `"api_key_configured": true`.
3. Start (or restart) `npm run dev`.

**Writing key-idea questions.** Each entry in a question's `criteria` is one key
idea. `description` is the idea the answer must contain (never shown to
students); `hint` is a teacher-written nudge shown while that idea isn't
included yet. Use neutral keys like `idea1`, since keys appear in students'
attempt history:

```json
{ "key": "idea1", "weight": 1,
  "description": "Both nuclei (protons) are attracted to the shared electrons between them.",
  "hint": "What attracts the shared electrons, and to what?" }
```

The seed questions still use generic `completeness` / `elaboration` criteria;
they grade, but write real key ideas to get useful chips and hints.

**How students use it.** The UI calls `POST /api/student/questions/:id/check`
after typing pauses: it returns each idea's status (`Idea 1`, `Idea 2`, …) and
hint, stores nothing, and doesn't count as an attempt. When `isCorrect` is true
(every idea included, nothing flagged incorrect), "Continue" calls the submit
route, which re-grades on the server and records the attempt. Identical text is
cached, so re-checks and the final submit don't re-call the model. If the Gemma
service is down, both routes return `503 GRADING_UNAVAILABLE` and nothing is
stored. A check takes about 1 s.

See "Gemma backend" in [`API.md`](./API.md) for response shapes, and
[`gemma/README.md`](./gemma/README.md) for the service itself.

## Scripts

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Start the dev server                                |
| `npm run build`     | Production build                                    |
| `npm run start`     | Serve the production build                          |
| `npm run db:migrate`| Create/apply a Prisma migration                     |
| `npm run db:seed`   | Seed example data                                   |
| `npm run db:studio` | Prisma Studio (browse the DB)                       |
| `npm run smoke`     | End-to-end API test (needs `npm run dev` and the Gemma service running, or `GRADING_BACKEND=stub`) |
| `npm test`          | Vitest unit tests (grading stub)                    |

## Project layout

```
src/
  app/
    api/              # all HTTP routes (the backend)
    page.tsx, student/, teacher/, credits/   # UI pages
  components/         # Dashboard, Gallery, LoginForm
  lib/
    db.ts             # Prisma singleton
    auth.ts           # password hashing + JWT sign/verify
    guards.ts         # requireUser / requireRole / requireCourseOwner / assertEnrolled
    http.ts           # error envelope + handler wrapper
    dto.ts            # response mappers (strip reference/criteria/passwordHash)
    client/           # browser API client + form validation
    grading/
      index.ts        # evaluate(): Gemma by default, stub if GRADING_BACKEND=stub
      jevStub.ts      # offline heuristic grader
      gemma.ts        # Gemma grader (one batch call per answer, cached)
      question.ts     # load a gradable question; student-safe idea progress
    validation/       # zod schemas
gemma/                # Python service: hosted Gemma 4 decisions (see its README)
prisma/
  schema.prisma       # models
  seed.ts             # example data
scripts/smoke.ts      # e2e smoke test
```

See [`API.md`](./API.md) for the full endpoint reference.

## Design notes

- **Answer keys stay server-side.** `Question.reference` (answer key or rubric)
  and `Question.criteria` (including idea text) are only ever returned to
  teachers. Students see positional idea labels and statuses only. Student-facing
  responses are built by DTO mappers in `src/lib/dto.ts`, and the smoke test
  asserts those keys never leak.
- **Authorization is per-request.** Every protected route re-checks the bearer
  token, role, course ownership, or enrollment. There is no client-supplied
  trust; "Continue" is re-graded on the server.
- **Grading is pluggable.** `src/lib/grading/index.ts` exports `evaluate()`,
  which uses Gemma by default or the stub with `GRADING_BACKEND=stub`. A real JEV client
  could be added the same way without changing call sites.
- **Grading fails closed.** If grading is unavailable nothing is stored and the
  attempt isn't consumed; an idea the model can't judge counts as not completed.
- **Students only see published work** from courses they are actively enrolled
  in.

## Windows ARM64 note

Prisma's default Node-API query engine is an x64 native module that cannot load
into ARM64 Node. The generator in `prisma/schema.prisma` therefore sets
`engineType = "binary"`, which runs the engine as a separate x64 executable
(Windows emulates x64). On x64/other platforms you can remove that line if you
prefer the default library engine.
