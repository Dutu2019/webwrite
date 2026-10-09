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
      "submissions": [ { id, questionId, attemptNumber, answerText, score, criteriaScores (with criterion keys), feedback, isCorrect, createdAt } ]
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

**403** once the assignment is `CLOSED`, same as submit. Check and submit share a
per-student limit of **30 grading requests per minute**; beyond that they return
**429 `RATE_LIMITED`** with `details.retryAfterSeconds`.

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
  "criteriaScores": [ { "label": "Idea 1", "score": 100, "weight": 0.6, "status": "included" } ],
  "ideas": [ { "label": "Idea 1", "status": "included", "hint": null } ],
  "flaggedIncorrect": false,
  "feedback": "…guiding hint, never the answer…",
  "isCorrect": true,
  "completion": { "completedAt": "...", "score": 91, "attempts": 1 }
}
```

**403** once the assignment is `CLOSED` (its due date has passed).

Each call stores a new attempt. The assignment's `Completion` row is
created once **every** question has a correct attempt; its `score` is the
points-weighted average of the best score per question, and `attempts` the total
attempts on the assignment. The reference is never returned. Students get
`criteriaScores` with positional `label`s ("Idea 1", …), never the teacher's
criterion keys, which could describe the idea; the teacher submissions report
keeps the keys.

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

Grading lives behind `src/lib/grading/index.ts` → `evaluate(input) → GradingResult`
and calls **hosted Gemma 4 through the Gemini API** directly from the Next.js
backend (`src/lib/grading/gemma.ts`). There is no separate grading service.

Configure it with two server-only environment variables:

- `GEMINI_API_KEY` — required; get one at https://aistudio.google.com/apikey
- `GEMMA_MODEL` — optional; `gemma-4-26b-a4b-it` (default) or `gemma-4-31b-it`

### Criteria are the grading rubric

For each assignment question the professor supplies a list of `criteria`. Each
criterion is one **key idea** the answer must contain:

```json
{ "key": "idea1", "weight": 1,
  "description": "Both nuclei (protons) are attracted to the shared electrons between them.",
  "hint": "What attracts the shared electrons, and to what?" }
```

`description` is the idea the model checks for (server-only, never sent to the
student) and optional `hint` is a teacher-written nudge shown while the idea
isn't included yet.

### How an answer is scored

Every criterion plus an "is anything stated incorrectly?" check are sent to Gemma
in **one** batched model call at temperature 0. `ESSAY` questions skip the
incorrect check: with no single right answer, a defensible position must not be
flagged and block completion. Each criterion is scored on an
ordered three-level rubric:

| Level           | Score | Meaning                                       |
| --------------- | ----- | --------------------------------------------- |
| `not_completed` | 0     | the idea is missing or stated incorrectly     |
| `in_progress`   | 50    | touched on but vague, incomplete, or implied  |
| `included`      | 100   | stated clearly and correctly                  |

`score` is the weighted average (0–100) and `isCorrect` requires every criterion
`included` **and** no factually incorrect statement; there is no attempt bonus.
A `null` / `insufficient_information` answer counts as `not_completed`. The reply
must be exactly the requested JSON with allowed values — malformed, truncated, or
blocked output is rejected, never repaired.

### Endpoints

- `POST /api/student/questions/{id}/check` grades the current text and returns
  per-idea progress (`ideas: [{ label, status, hint }]`); nothing is stored.
- `POST /api/student/questions/{id}/submit` re-grades server-side and records the
  attempt, returning the same `criteriaScores` plus `ideas`, `flaggedIncorrect`,
  `isCorrect`, and `feedback`.

Identical inputs are cached in memory, so re-checking unchanged text and the
final submit don't re-call the model. Transient Gemini failures (HTTP 5xx or a
dropped connection) get exactly one retry; timeouts, 429s, and invalid replies
are never retried.

### Errors

| HTTP | code                    | Cause                                             |
| ---- | ----------------------- | ------------------------------------------------- |
| 503  | `GRADING_UNAVAILABLE`   | `GEMINI_API_KEY` missing or `GEMMA_MODEL` unknown |
| 502  | `GRADING_UNREACHABLE`   | could not reach the Gemini API                    |
| 502  | `GRADING_AUTH`          | Gemini rejected the key or model access           |
| 502  | `GRADING_UPSTREAM`      | Gemini returned another error status              |
| 502  | `GRADING_INVALID`       | blocked/incomplete/unparseable model reply        |
| 504  | `GRADING_TIMEOUT`       | Gemini did not respond in time                    |
| 429  | `GRADING_QUOTA`         | Gemini quota or rate limit reached                |
| 429  | `RATE_LIMITED`          | student exceeded 30 grading requests per minute   |
| 422  | `GRADING_INPUT_INVALID` | overly long input or no criteria                  |
