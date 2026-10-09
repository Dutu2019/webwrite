# webwrite — WeBWorK-style app with text answers (backend)

Backend for a class-assignment app where teachers author text-answer
assignments and students submit free-text responses that are graded against
criteria (completeness, elaboration, …). Built with Next.js App Router **API
routes** + Prisma + SQLite, with JWT bearer-token auth.

The real grading model ("JEV") is **not** wired up yet. By default responses are
scored by a deterministic local stub behind a pluggable interface; set
`GRADING_BACKEND=gemma` to grade key ideas through the Gemma decision service in
`gemma/` instead (see "Gemma backend" in [`API.md`](./API.md)).

## Stack

| Concern    | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 15 (App Router, TypeScript)                |
| Database   | SQLite via Prisma 6                                |
| Auth       | Stateless JWT bearer tokens (`jose`, HS256)        |
| Passwords  | bcryptjs                                           |
| Validation | zod                                                |
| Tests      | `scripts/smoke.ts` (e2e) + Vitest (grading unit)   |

## Setup

```bash
npm install
npm run db:migrate      # create prisma/dev.db and apply migrations
npm run db:seed         # load example teacher/students/courses/assignments
npm run dev             # http://localhost:3000
```

Copy `.env.example` to `.env` and set `JWT_SECRET` for anything non-local.

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
| `npm test`          | Vitest unit tests (grading stub)                    |

## Project layout

```
src/
  app/api/            # all HTTP routes (the backend)
  lib/
    db.ts             # Prisma singleton
    auth.ts           # password hashing + JWT sign/verify
    guards.ts         # requireUser / requireRole / requireCourseOwner / assertEnrolled
    http.ts           # error envelope + handler wrapper
    dto.ts            # response mappers (strip reference/criteria/passwordHash)
    grading/          # evaluate() + hardcoded jevStub
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
- **Grading is pluggable.** `src/lib/grading/index.ts` exports `evaluate()`.
  Today it calls `jevStub`; swapping in the real JEV client requires no changes
  at call sites.
- **Students only see published work** from courses they are actively enrolled
  in.

## Windows ARM64 note

Prisma's default Node-API query engine is an x64 native module that cannot load
into ARM64 Node. The generator in `prisma/schema.prisma` therefore sets
`engineType = "binary"`, which runs the engine as a separate x64 executable
(Windows emulates x64). On x64/other platforms you can remove that line if you
prefer the default library engine.
