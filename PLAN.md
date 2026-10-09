# WeBWorK-style App with Text Answers — Backend Plan

> Historical planning document. The grading layer was later changed from a local
> stub/JEV to **hosted Gemma 4 via the Gemini API**; see `README.md` and
> `API.md` for the current design.

## 1. Scope & assumptions

**Responsibility:** the backend — database schema, auth/login API, business logic, and the HTTP API the
frontend calls. Framework is Next.js, so the "backend" = **Route Handlers** under `app/api/**` plus a
server-side DB layer. Also create the Next.js project skeleton so the API has a home; the frontend team
owns the pages/components.

**In scope**
- Relational schema: users (teacher/student), courses, enrollment/invites, assignments, questions
  (answer duos), submissions, completions.
- Login/registration API with JWT bearer tokens and role guards.
- Teacher flow: create course, invite students (join code primary; direct invite backup), create/publish
  assignments with question/answer duos.
- Student flow: see only assignments from enrolled courses, submit text answers, get criterion-based scores.
- A **pluggable grading layer** with a hardcoded stub (no JEV/Gemini call yet).
- Answer keys/rubrics never leave the server.

**Out of scope (for now):** the real JEV model, frontend UI details, email delivery, scaling/ops.

## 2. Decisions (confirmed)

- **DB/ORM:** SQLite + Prisma. Role/status are `String` fields validated by zod; `criteria` /
  `criteriaScores` stored as JSON strings and parsed. `DATABASE_URL="file:./dev.db"`. Portable to Postgres.
- **Auth:** stateless **JWT bearer tokens** (HS256 via `jose`), no session/cookie table. Access token
  ~60m; optional refresh token 7d.
- **Users:** single `User` table with `role` (`TEACHER` | `STUDENT`).
- **Invites:** shareable **join code** is the primary path; teacher "find a student by name → invite" is the
  backup.
- **Scaffold scope:** Next.js app + API routes. Frontend owns pages.

## 3. Project structure

```
webwrite/
  package.json
  next.config.ts
  tsconfig.json
  .env / .env.example
  prisma/
    schema.prisma
    seed.ts
    migrations/
  src/
    app/
      api/
        health/route.ts
        auth/{register,login,logout,me,refresh}/route.ts
        courses/route.ts
        courses/join/route.ts
        courses/[id]/route.ts
        courses/[id]/invites/route.ts
        courses/[id]/invites/[inviteId]/route.ts
        students/search/route.ts
        courses/[courseId]/assignments/route.ts
        assignments/[id]/route.ts
        assignments/[id]/publish/route.ts
        assignments/[id]/submissions/route.ts
        student/courses/route.ts
        student/invites/route.ts
        student/invites/[inviteId]/accept/route.ts
        student/assignments/route.ts
        student/assignments/[id]/route.ts
        student/assignments/[id]/result/route.ts
        student/questions/[questionId]/submit/route.ts
    lib/
      db.ts                 # Prisma singleton
      auth.ts               # hashing, JWT sign/verify, getSession
      guards.ts             # requireUser / requireRole / requireCourseOwner / requireEnrollment
      http.ts               # json helpers, error shape, zod error mapping
      dto.ts                # mappers that strip reference/criteria/hash
      validation/*.ts       # zod schemas per resource
      grading/
        types.ts            # GradingInput / GradingResult
        index.ts            # evaluate() dispatcher
        jevStub.ts          # hardcoded criterion-based scorer
  scripts/smoke.ts          # end-to-end API smoke test
```

## 4. Database schema (relational)

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         String   // "TEACHER" | "STUDENT"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  taughtCourses Course[]      @relation("CourseTeacher")
  enrollments   Enrollment[]
  invitesSent   Invite[]      @relation("InviteSender")
  invitesGot    Invite[]      @relation("InviteTarget")
  submissions   Submission[]
  completions   Completion[]
}

model Course {
  id          String   @id @default(cuid())
  name        String
  description String?
  joinCode    String   @unique
  teacherId   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  teacher     User         @relation("CourseTeacher", fields: [teacherId], references: [id])
  enrollments Enrollment[]
  assignments Assignment[]
  invites     Invite[]

  @@index([teacherId])
}

model Enrollment {
  id        String   @id @default(cuid())
  courseId  String
  studentId String
  status    String   @default("ACTIVE")   // ACTIVE | DROPPED
  createdAt DateTime @default(now())

  course  Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  student User   @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([courseId, studentId])
  @@index([studentId])
}

model Invite {
  id          String   @id @default(cuid())
  courseId    String
  studentId   String
  invitedById String
  status      String   @default("PENDING") // PENDING | ACCEPTED | REVOKED
  createdAt   DateTime @default(now())

  course    Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  student   User   @relation("InviteTarget", fields: [studentId], references: [id], onDelete: Cascade)
  invitedBy User   @relation("InviteSender", fields: [invitedById], references: [id])

  @@unique([courseId, studentId])
  @@index([studentId])
}

model Assignment {
  id          String    @id @default(cuid())
  courseId    String
  title       String
  description String?
  published   Boolean   @default(false)
  publishedAt DateTime?
  dueAt       DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  course      Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  questions   Question[]
  completions Completion[]

  @@index([courseId])
}

model Question {
  id           String  @id @default(cuid())
  assignmentId String
  order        Int     @default(0)
  prompt       String
  reference    String  // answer key OR rubric — SERVER ONLY
  criteria     String? // JSON: [{ key, weight, description }]
  points       Int     @default(1)

  assignment  Assignment   @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  submissions Submission[]

  @@index([assignmentId])
}

model Submission {
  id             String   @id @default(cuid())
  questionId     String
  studentId      String
  attemptNumber  Int      @default(1)
  answerText     String
  score          Float?   // 0–100 aggregate
  criteriaScores String?  // JSON
  feedback       String?
  isCorrect      Boolean  @default(false)
  createdAt      DateTime @default(now())

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  student  User     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([questionId, studentId, attemptNumber])
  @@index([studentId])
}

model Completion {
  id           String   @id @default(cuid())
  assignmentId String
  studentId    String
  completedAt  DateTime @default(now())
  score        Float?
  attempts     Int      @default(0)

  assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  student    User       @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([assignmentId, studentId])
  @@index([studentId])
}
```

## 5. API contract

Consistent envelope; errors: `{ error: { code, message, details? } }`. Auth via `Authorization: Bearer <token>`.

**Auth**
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `email, password, name, role` | hashes pw, creates user, returns token |
| POST | `/api/auth/login` | `email, password` | verifies, returns token |
| POST | `/api/auth/logout` | — | client discards token |
| GET | `/api/auth/me` | — | current user (no hash) or 401 |
| POST | `/api/auth/refresh` | `{ refreshToken }` | new access token |

**Teacher — courses & invites**
| Method | Path | Notes |
|---|---|---|
| POST | `/api/courses` | create course (generates `joinCode`) |
| GET | `/api/courses` | list own courses |
| GET/PATCH/DELETE | `/api/courses/:id` | owner only; detail includes enrollments |
| POST | `/api/courses/:id/invites` | `{ studentId }` invite existing student |
| GET | `/api/courses/:id/invites` | list invites |
| DELETE | `/api/courses/:id/invites/:inviteId` | revoke |
| GET | `/api/students/search?q=` | find students by name/email |

**Student — enrolling**
| Method | Path | Notes |
|---|---|---|
| POST | `/api/courses/join` | `{ joinCode }`, creates `Enrollment` |
| GET | `/api/student/courses` | enrolled courses |
| GET | `/api/student/invites` | pending invites |
| POST | `/api/student/invites/:inviteId/accept` | accept → enrollment |

**Teacher — assignments/questions**
| Method | Path | Notes |
|---|---|---|
| POST | `/api/courses/:courseId/assignments` | create w/ nested questions |
| GET | `/api/courses/:courseId/assignments` | list |
| GET/PATCH/DELETE | `/api/assignments/:id` | owner; full incl. `reference` |
| POST | `/api/assignments/:id/publish` | `{ published: boolean }` |
| GET | `/api/assignments/:id/submissions` | per-student submissions + completions |

**Student — assignments & answers**
| Method | Path | Notes |
|---|---|---|
| GET | `/api/student/assignments` | published + enrolled only, completion status |
| GET | `/api/student/assignments/:id` | questions WITHOUT `reference`/`criteria`; own attempts |
| POST | `/api/student/questions/:questionId/submit` | `{ answerText }` → scores |
| GET | `/api/student/assignments/:id/result` | aggregate score + completion |

Authorization: students only read published assignments from `ACTIVE` enrollments; teachers only mutate
courses/assignments they own; `reference`/`criteria`/`passwordHash` stripped on student responses.

## 6. Grading layer (stubbed)

`GradingInput { prompt, reference, criteria?, studentAnswer, attemptNumber }` →
`GradingResult { score, criteriaScores, isCorrect, feedback }`.

`lib/grading/index.ts` exports `evaluate()` delegating to `jevStub` (swap for JEV later with no call-site
changes). `jevStub` deterministic heuristics:
- `completeness`: answer length / concept presence vs reference (no echoing reference).
- `elaboration`: sentence count, connective/explanation markers.
- `attemptAdjustment`: mild boost with attempt number; guidance-only feedback.
- Default criteria: `completeness`, `elaboration`. `isCorrect` when score >= 80.

## 7. Build steps

1. **Scaffold** — Next.js (App Router, TS); deps `@prisma/client`, `prisma`, `zod`, `bcryptjs`, `jose`,
   `tsx`. `.env.example` (`DATABASE_URL`, `JWT_SECRET`), `.gitignore`. `/api/health`.
2. **Schema + migration + seed** — Prisma schema, `lib/db.ts`, seed teacher/students/course/enrollment/
   assignment + two hardcoded example questions.
3. **Auth** — `lib/auth.ts`, `lib/guards.ts`, register/login/logout/me + refresh.
4. **Courses & enrollment** — teacher CRUD + join code; student join; student invites list/accept; teacher
   student-search + invite/revoke.
5. **Assignments & questions** — create w/ nested questions, list/patch/delete, publish, ordering.
6. **Student flow** — published + enrolled list/detail, DTO stripping, leak test.
7. **Submission + grading stub** — submit, attempt count, `evaluate()`, persist `Submission`, upsert
   `Completion`.
8. **Reporting** — teacher submissions; student result.
9. **Validation & errors** — zod per endpoint, central error handler, optional middleware, login rate limit.
10. **Tests & smoke** — `scripts/smoke.ts`, Vitest for auth/authorization/leak regression.
11. **Docs & handoff** — `README.md`, `API.md`.

Milestones: M1 = 1–3, M2 = 4–5, M3 = 6–8, M4 = 9–11.

## 8. Security checklist
- Passwords hashed (bcrypt), never returned.
- JWT signed with `JWT_SECRET`, verified on every protected route.
- Answer keys/rubrics + `criteria` server-only; enforced by DTO mappers + leak tests.
- Per-request authorization: role, ownership, enrollment.
- zod validation on all inputs; parameterized queries via Prisma.
