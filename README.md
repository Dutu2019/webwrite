# webwrite — WeBWorK-style app with text answers (backend)

Backend for a class-assignment app where teachers author text-answer
assignments and students submit free-text responses that are graded against
criteria. Built with Next.js App Router **API routes** + Prisma + SQLite, with
JWT bearer-token auth.

Grading runs through **hosted Gemma 4 on the Gemini API**, called server-side
from the Next.js backend — there is no separate grading service. Each question
carries a list of criteria (key ideas) authored by the professor; they are sent
to Gemma in one batched call per answer. See "Grading" in [`API.md`](./API.md).

## Stack

| Concern    | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 15 (App Router, TypeScript)                |
| Database   | SQLite via Prisma 6                                |
| Auth       | Stateless JWT bearer tokens (`jose`, HS256)        |
| Passwords  | bcryptjs                                           |
| Grading    | Hosted Gemma 4 via the Gemini API (`fetch`)        |
| Validation | zod                                                |
| Tests      | `scripts/smoke.ts` (e2e) + Vitest (grading unit)   |

## Setup

```bash
npm install
npm run db:migrate      # create prisma/dev.db and apply migrations
npm run db:seed         # load example teacher/students/courses/assignments
npm run dev             # http://localhost:3000
```

Copy `.env.example` to `.env`, set `JWT_SECRET`, and add `GEMINI_API_KEY`
(from https://aistudio.google.com/apikey) to enable grading:

```
GEMINI_API_KEY="your-key-from-google-ai-studio"
GEMMA_MODEL="gemma-4-26b-a4b-it"   # or gemma-4-31b-it
```

The key is used only by the server; it is never sent to the browser.

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
| `npm run db:migrate`| Create/apply a Prisma migration                     |
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
  schema.prisma       # models
  seed.ts             # example data
scripts/smoke.ts      # e2e smoke test
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

## Windows ARM64 note

Prisma's default Node-API query engine is an x64 native module that cannot load
into ARM64 Node. The generator in `prisma/schema.prisma` therefore sets
`engineType = "binary"`, which runs the engine as a separate x64 executable
(Windows emulates x64). On x64/other platforms you can remove that line if you
prefer the default library engine.
