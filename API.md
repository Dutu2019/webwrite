# API reference

Base URL: `http://localhost:3000`

All bodies are JSON. Authenticated endpoints require an access token:

```
Authorization: Bearer <accessToken>
```

## Error envelope

Every error uses the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

| HTTP | code               | Meaning                                   |
| ---- | ------------------ | ----------------------------------------- |
| 400  | `VALIDATION_ERROR` | Body/query failed zod validation          |
| 400  | `BAD_REQUEST`      | Semantically invalid request              |
| 401  | `UNAUTHORIZED`     | Missing/invalid/expired token             |
| 403  | `FORBIDDEN`        | Valid token, insufficient role/enrollment |
| 404  | `NOT_FOUND`        | Resource missing (or hidden from caller)  |
| 409  | `CONFLICT`         | Duplicate email, already enrolled, etc.   |
| 500  | `INTERNAL_ERROR`   | Unexpected server error                   |

## Access rules

- A **student** can only read assignments that are `published` **and** belong to
  a course where they have an `ACTIVE` enrollment.
- A **teacher** can only read/modify courses and assignments they own.
- `Question.reference` and `Question.criteria` are **never** returned on
  student-facing endpoints.
- `passwordHash` is never returned anywhere.

---

## Auth

### `POST /api/auth/register`

```json
{ "email": "a@b.com", "password": "at-least-8-chars", "name": "Ada", "role": "TEACHER" }
```

`role` is `TEACHER` or `STUDENT`. **201**:

```json
{
  "user": { "id": "...", "email": "a@b.com", "name": "Ada", "role": "TEACHER", "createdAt": "..." },
  "token": "<access JWT>",
  "refreshToken": "<refresh JWT>",
  "expiresIn": "1h"
}
```

`409` if the email already exists.

### `POST /api/auth/login`

```json
{ "email": "a@b.com", "password": "..." }
```

**200** with the same shape as register. `401` on bad credentials.

### `POST /api/auth/refresh`

```json
{ "refreshToken": "<refresh JWT>" }
```

**200**: `{ "user": {...}, "token": "<new access JWT>", "expiresIn": "1h" }`.
`401` if the refresh token is invalid/expired.

### `GET /api/auth/me` 🔒

**200**: `{ "user": { ... } }`.

### `POST /api/auth/logout`

Always **200** `{ "success": true }`. Tokens are stateless, so the client
should discard its stored token; this endpoint exists as a stable hook for a
future denylist.

---

## Teacher — courses

### `GET /api/courses` 🔒 teacher

**200**: `{ "courses": [ { id, name, description, joinCode, teacherId, counts: { enrollments, assignments } } ] }`

### `POST /api/courses` 🔒 teacher

```json
{ "name": "Physics 101", "description": "optional", "joinCode": "optional, e.g. PHYS101" }
```

`joinCode` is optional: 3–16 letters/digits, stored upper-case. When omitted, a
unique 8-character code is generated. **409** if the chosen code is taken.

**201**: `{ "course": { ... } }` including its `joinCode`.

### `GET /api/courses/{id}` 🔒 teacher (owner)

**200**: course detail with `enrollments` and `invites` (each including a public
`student` object).

### `PATCH /api/courses/{id}` 🔒 teacher (owner)

```json
{ "name": "New name", "description": "New description", "joinCode": "NEWCODE" }
```

All fields optional. Changing `joinCode` means the old code no longer works;
**409** if the new code is taken.

### `DELETE /api/courses/{id}` 🔒 teacher (owner)

**200**: `{ "success": true }`. Cascades enrollments, assignments, questions,
submissions, completions.

---

## Teacher — invites & student lookup

### `GET /api/students/search?q=<name-or-email>` 🔒 teacher

**200**: `{ "students": [ { id, email, name, role, createdAt } ] }` (max 20).

### `POST /api/courses/{id}/invites` 🔒 teacher (owner)

```json
{ "studentId": "<student user id>" }
```

Creates/refreshes a `PENDING` invite. **409** if the student is already
enrolled. **201**:

```json
{ "invite": { "id": "...", "status": "PENDING", "student": { ... } } }
```

### `GET /api/courses/{id}/invites` 🔒 teacher (owner)

**200**: `{ "invites": [ { id, status, createdAt, student } ] }`.

### `DELETE /api/courses/{id}/invites/{inviteId}` 🔒 teacher (owner)

**200**: `{ "success": true }`.

---

## Student — enrollment

### `POST /api/courses/join` 🔒 student

```json
{ "joinCode": "PHYS101" }
```

Idempotent. **200**: `{ "course": { ... }, "enrollment": { "id", "status" } }`.
`404` if no course matches the code.

### `GET /api/student/courses` 🔒 student

**200**: actively enrolled courses, each with `teacher` and `enrollmentStatus`.

### `GET /api/student/invites` 🔒 student

**200**: `{ "invites": [ { id, status, createdAt, course } ] }` — pending only.

### `POST /api/student/invites/{inviteId}/accept` 🔒 student

Creates/activates the enrollment and marks the invite `ACCEPTED`.
**200**: `{ "course": { ... }, "enrollment": { "id", "status" } }`.

---

## Teacher — assignments & questions

### `GET /api/courses/{id}/assignments` 🔒 teacher (owner)

**200**: `{ "assignments": [ { ...assignment, counts: { questions, completions }, stats: { students, opened, completed } } ] }`.

`stats.students` is the number of actively enrolled students; `opened` and
`completed` count those students who have opened the assignment (first
`GET /api/student/assignments/{id}`) and completed it.

### `POST /api/courses/{id}/assignments` 🔒 teacher (owner)

```json
{
  "title": "Kinematics Basics",
  "description": "optional",
  "dueAt": "2026-11-01T00:00:00.000Z",
  "questions": [
    {
      "type": "SHORT_ANSWER",
      "prompt": "A ball is dropped from 20 m...",
      "reference": "t = sqrt(2h/g) ≈ 2.02 s",
      "criteria": [
        { "key": "completeness", "weight": 0.6 },
        { "key": "elaboration", "weight": 0.4 }
      ],
      "points": 1,
      "order": 0
    }
  ]
}
```

**201**: `{ "assignment": { ...assignment, questions: [ ...full question incl. reference ] } }`.
Unpublished by default. `questions` may be omitted or empty to create a draft;
questions can be added later with `PATCH`.

Each question has a `type` (default `SHORT_ANSWER`). All types are free-text
answers graded against `reference` and `criteria`; the type tells the UI how to
author and display the question:

| type           | `reference` holds | `criteria`                                                        |
| -------------- | ----------------- | ----------------------------------------------------------------- |
| `SHORT_ANSWER` | model answer      | optional (defaults apply)                                         |
| `KEY_IDEAS`    | model answer      | **required**: one per idea, `{ key: "idea1", description, hint? }` |
| `ESSAY`        | rubric            | optional (defaults apply)                                         |
| `MULTIPLE_CHOICE` | short answer-key note | unused; send `options` instead                              |

`MULTIPLE_CHOICE` questions carry `options: [{ id, text, correct }]` (2–20, unique
ids, at least one `correct`). They are marked exactly, not by the text grader:
students submit the chosen option ids as `answerText` (`"b"`, `"a,c"` or
`["a","c"]`); several correct options means "select all that apply" and only the
exact set counts as correct.

`type` is also returned on student question objects (never `reference`/`criteria`).
For multiple choice, students get `options: [{ id, text }]` (never `correct`) and
`multipleAnswers: true` when more than one option is correct.

Prompts, references, ideas and option text may contain LaTeX (`$…$`, `$$…$$`,
`\(…\)`, `\[…\]`); the API stores it as plain text and the UI renders it.

Every assignment object includes a derived `status`:

| status    | when                                           |
| --------- | ---------------------------------------------- |
| `CREATED` | not published                                  |
| `POSTED`  | published, and `dueAt` is unset or in the future |
| `CLOSED`  | published, and `dueAt` has passed              |

### `GET /api/assignments/{id}` 🔒 teacher (owner)

Full assignment including `reference` and `criteria`.

### `PATCH /api/assignments/{id}` 🔒 teacher (owner)

Accept `title`, `description`, `dueAt`, and/or `questions` (full replacement).
**409** if you try to change `questions` while the assignment is published.

### `DELETE /api/assignments/{id}` 🔒 teacher (owner)

**200**: `{ "success": true }`.

### `POST /api/assignments/{id}/publish` 🔒 teacher (owner)

```json
{ "published": true }
```

**200**: `{ "assignment": { ... } }`. Publishing sets `publishedAt` once.
**400** when publishing an assignment that has no questions.

### `GET /api/assignments/{id}/submissions` 🔒 teacher (owner)

**200**:

```json
{
  "assignment": { ... },
  "questions": [ { id, order, prompt, points } ],
  "students": [
    {
      "student": { id, email, name, role, createdAt },
      "completion": { "completedAt": "...", "score": 91, "attempts": 2 },
      "submissions": [ { id, questionId, attemptNumber, answerText, score, criteriaScores, feedback, isCorrect, createdAt } ]
    }
  ]
}
```

---

## Student — assignments & answers

### `GET /api/student/assignments` 🔒 student

Published assignments in enrolled courses.

**200**: `{ "assignments": [ { ...assignment, course: { id, name }, questionCount, completed, completion } ] }`.

### `GET /api/student/assignments/{id}` 🔒 student

**200**:

```json
{
  "assignment": { ... },
  "course": { "id": "...", "name": "..." },
  "questions": [
    {
      "id": "...", "order": 0, "prompt": "...", "points": 1,
      "ideas": [ { "label": "Idea 1" }, { "label": "Idea 2" } ],
      "attempts": [ { id, questionId, attemptNumber, answerText, score, criteriaScores, feedback, isCorrect, createdAt } ]
    }
  ]
}
```

`questions[]` intentionally **omits** `reference` and `criteria`; `ideas` only has
positional labels, one per criterion, never the idea text.

### `POST /api/student/questions/{questionId}/check` 🔒 student

Live check while the student writes (the frontend should call it after typing
pauses). Same body as submit. Grades the current text but **stores nothing and
does not count as an attempt**.

**200**:

```json
{
  "ideas": [
    { "label": "Idea 1", "status": "in_progress", "hint": "What attracts the shared electrons?" },
    { "label": "Idea 2", "status": "included", "hint": null }
  ],
  "flaggedIncorrect": false,
  "feedback": "What attracts the shared electrons?",
  "isCorrect": false
}
```

`status` is `not_completed`, `in_progress`, or `included`. `hint` is the teacher's
criterion hint, shown only while that idea isn't included. `flaggedIncorrect` means
the answer states something wrong; it blocks completion. Enable "Continue" when
`isCorrect` is true, then call submit, which re-grades on the server.

**403** once the assignment is `CLOSED`, same as submit.

### `POST /api/student/questions/{questionId}/submit` 🔒 student

```json
{ "answerText": "The ball falls freely, so t = sqrt(2h/g) ..." }
```

**201**:

```json
{
  "submission": { "id", "questionId", "attemptNumber", "answerText", "score", "criteriaScores", "feedback", "isCorrect", "createdAt" },
  "attemptNumber": 1,
  "score": 91,
  "criteriaScores": [ { "key": "completeness", "score": 100, "weight": 0.6, "status": "included" } ],
  "ideas": [ { "label": "Idea 1", "status": "included", "hint": null } ],
  "flaggedIncorrect": false,
  "feedback": "…guiding hint, never the answer…",
  "isCorrect": true,
  "completion": { "completedAt": "...", "score": 91, "attempts": 1 }
}
```

**403** once the assignment is `CLOSED` (its due date has passed).

Each call stores a new attempt. A `Completion` row is created/updated once the
answer is judged correct. The reference is never returned. `criteriaScores[].key`
is the teacher's criterion key and *is* visible to students, so use neutral keys
(e.g. `idea1`) for key-idea questions.

### `GET /api/student/assignments/{id}/result` 🔒 student

**200**:

```json
{
  "assignment": { ... },
  "completed": true,
  "completion": { "completedAt": "...", "score": 91, "attempts": 2 },
  "perQuestion": [
    { "questionId": "...", "prompt": "...", "points": 1, "attempts": 2, "bestScore": 91, "isCorrect": true }
  ],
  "earnedPoints": 0.91,
  "maxPoints": 1
}
```

---

## Grading

Grading lives behind `src/lib/grading/index.ts` → `evaluate(input)` and currently
delegates to a deterministic stub (`jevStub`). The stub supports criterion keys
`completeness`, `elaboration`, `clarity`, and `accuracy` (plus a few synonyms);
unknown keys fall back to a generic length/reasoning heuristic. The aggregate is
a weighted average (0–100) with a small bonus for later attempts, and
`isCorrect` is `score >= 80`. Swapping in the real JEV model requires no changes
at call sites.

### Gemma backend (`GRADING_BACKEND=gemma`)

Grades through the Gemma decision service in `gemma/` (run it separately; set
`GEMMA_BATCH_URL` if it isn't on `127.0.0.1:8000`). Each criterion is a **key idea**:
`description` is the idea the answer must contain (server-only) and optional `hint`
is a teacher-written nudge shown to students while the idea isn't included:

```json
{ "key": "idea1", "weight": 1,
  "description": "Both nuclei (protons) are attracted to the shared electrons between them.",
  "hint": "What attracts the shared electrons, and to what?" }
```

All criteria plus an "is anything stated incorrectly?" check are answered in one
model call. Each criterion gets `not_completed` / `in_progress` / `included`
(scores 0 / 50 / 100). `isCorrect` requires every criterion `included` and no
incorrect statement; there is no attempt bonus. Identical answers are cached in
memory, so re-checking unchanged text and the final submit don't re-call the
model. If the service is down, check and submit return **503
`GRADING_UNAVAILABLE`** and nothing is stored; overlong input returns **422
`GRADING_INPUT_INVALID`**.
