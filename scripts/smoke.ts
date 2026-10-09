/**
 * End-to-end smoke test against a running dev server.
 *
 *   npm run dev          # in one terminal
 *   npm run smoke        # in another
 *
 * Set SMOKE_BASE_URL to point at a non-default host/port.
 */
import assert from "node:assert/strict";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const stamp = Date.now();

// Grading calls hosted Gemma via the Gemini API; these statuses mean "grading
// could not run here" (no key / upstream failure), which the suite tolerates.
const GRADING_ERRORS = new Set<number>([429, 502, 503, 504]);

interface Res {
  status: number;
  data: any;
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<Res> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

let passed = 0;
function check(label: string, condition: boolean, extra?: unknown) {
  if (!condition) {
    console.error(`\n  ✗ ${label}`);
    if (extra !== undefined) console.error("    ", JSON.stringify(extra, null, 2));
    throw new Error(`Smoke check failed: ${label}`);
  }
  passed++;
  console.log(`  ✓ ${label}`);
}

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + "/api/health");
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${BASE} did not become ready`);
}

/** Recursively assert no forbidden keys leaked into a payload. */
function assertNoKeys(value: unknown, forbidden: string[], path = "$") {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoKeys(v, forbidden, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      assert.ok(
        !forbidden.includes(k),
        `forbidden key "${k}" leaked at ${path}.${k}`,
      );
      assertNoKeys(v, forbidden, `${path}.${k}`);
    }
  }
}

async function main() {
  console.log(`Smoke test against ${BASE}\n`);
  await waitForServer();

  // --- health ---------------------------------------------------------------
  const health = await call("GET", "/api/health");
  check("health returns 200", health.status === 200, health.data);

  // --- registration & login -------------------------------------------------
  const teacherEmail = `teacher+${stamp}@example.com`;
  const studentEmail = `alice+${stamp}@example.com`;
  const otherEmail = `bob+${stamp}@example.com`;
  const password = "password123";

  const tReg = await call("POST", "/api/auth/register", {
    body: { email: teacherEmail, password, name: "Smoke Teacher", role: "TEACHER" },
  });
  check("register teacher -> 201", tReg.status === 201, tReg.data);
  check("register returns token", typeof tReg.data.token === "string");
  check("register hides passwordHash", !("passwordHash" in tReg.data.user));
  const teacherToken: string = tReg.data.token;

  const sReg = await call("POST", "/api/auth/register", {
    body: { email: studentEmail, password, name: "Smoke Student", role: "STUDENT" },
  });
  check("register student -> 201", sReg.status === 201, sReg.data);
  const studentToken: string = sReg.data.token;
  const studentId: string = sReg.data.user.id;

  const oReg = await call("POST", "/api/auth/register", {
    body: { email: otherEmail, password, name: "Other Student", role: "STUDENT" },
  });
  check("register second student -> 201", oReg.status === 201, oReg.data);
  const otherToken: string = oReg.data.token;
  const otherId: string = oReg.data.user.id;

  const dup = await call("POST", "/api/auth/register", {
    body: { email: teacherEmail, password, name: "Dup", role: "TEACHER" },
  });
  check("duplicate email -> 409", dup.status === 409, dup.data);

  const login = await call("POST", "/api/auth/login", {
    body: { email: teacherEmail, password },
  });
  check("login -> 200", login.status === 200, login.data);
  const badLogin = await call("POST", "/api/auth/login", {
    body: { email: teacherEmail, password: "wrong-password" },
  });
  check("bad login -> 401", badLogin.status === 401, badLogin.data);

  const me = await call("GET", "/api/auth/me", { token: teacherToken });
  check("me -> 200", me.status === 200 && me.data.user.role === "TEACHER", me.data);
  const noAuth = await call("GET", "/api/auth/me");
  check("me without token -> 401", noAuth.status === 401, noAuth.data);

  const refreshed = await call("POST", "/api/auth/refresh", {
    body: { refreshToken: tReg.data.refreshToken },
  });
  check("refresh -> 200 new token", refreshed.status === 200 && typeof refreshed.data.token === "string", refreshed.data);

  // --- role guards ----------------------------------------------------------
  const studentOnTeacherRoute = await call("GET", "/api/courses", { token: studentToken });
  check("student on teacher route -> 403", studentOnTeacherRoute.status === 403, studentOnTeacherRoute.data);

  // --- course creation & join code -----------------------------------------
  const createCourse = await call("POST", "/api/courses", {
    token: teacherToken,
    body: { name: "Smoke Course", description: "created by smoke test" },
  });
  check("create course -> 201", createCourse.status === 201, createCourse.data);
  const courseId: string = createCourse.data.course.id;
  const joinCode: string = createCourse.data.course.joinCode;
  check("course has join code", typeof joinCode === "string" && joinCode.length >= 6);

  const studentCoursesBefore = await call("GET", "/api/student/courses", { token: studentToken });
  check("student has no courses yet", studentCoursesBefore.data.courses.length === 0, studentCoursesBefore.data);

  const join = await call("POST", "/api/courses/join", {
    token: studentToken,
    body: { joinCode },
  });
  check("join by code -> 200", join.status === 200, join.data);

  const joinAgain = await call("POST", "/api/courses/join", {
    token: studentToken,
    body: { joinCode },
  });
  check("join is idempotent -> 200", joinAgain.status === 200, joinAgain.data);

  const studentCourses = await call("GET", "/api/student/courses", { token: studentToken });
  check("student now sees course", studentCourses.data.courses.length === 1, studentCourses.data);

  // --- assignment & question creation --------------------------------------
  const createAssignment = await call(
    "POST",
    `/api/courses/${courseId}/assignments`,
    {
      token: teacherToken,
      body: {
        title: "Smoke Assignment",
        description: "two questions",
        questions: [
          {
            prompt: "A ball is dropped from 20 m. How long until it hits the ground? (g = 9.8)",
            reference: "t = sqrt(2h/g) = sqrt(40/9.8) ≈ 2.02 s",
            criteria: [
              { key: "completeness", weight: 0.6 },
              { key: "elaboration", weight: 0.4 },
            ],
          },
          {
            prompt: "Argue whether civil disobedience can be justified in a democracy.",
            reference: "Rubric: definition, position, principle, counterargument, example.",
          },
        ],
      },
    },
  );
  check("create assignment -> 201", createAssignment.status === 201, createAssignment.data);
  const assignmentId: string = createAssignment.data.assignment.id;
  const questionId: string = createAssignment.data.assignment.questions[0].id;

  const hiddenBefore = await call("GET", "/api/student/assignments", { token: studentToken });
  check("unpublished assignment hidden from student", hiddenBefore.data.assignments.length === 0, hiddenBefore.data);

  // --- publish --------------------------------------------------------------
  const publish = await call("POST", `/api/assignments/${assignmentId}/publish`, {
    token: teacherToken,
    body: { published: true },
  });
  check("publish -> 200", publish.status === 200 && publish.data.assignment.published === true, publish.data);

  const visible = await call("GET", "/api/student/assignments", { token: studentToken });
  check("published assignment visible", visible.data.assignments.length === 1, visible.data);

  // --- student assignment detail (leak check) -------------------------------
  const detail = await call("GET", `/api/student/assignments/${assignmentId}`, {
    token: studentToken,
  });
  check("student can read assignment detail", detail.status === 200, detail.data);
  check(
    "student detail strips reference/criteria",
    !JSON.stringify(detail.data).includes("sqrt(2h/g)") &&
      !JSON.stringify(detail.data).includes('"reference"') &&
      !JSON.stringify(detail.data).includes('"criteria"'),
    detail.data,
  );
  assertNoKeys(detail.data, ["reference", "criteria", "passwordHash"]);

  // --- cross-course isolation ----------------------------------------------
  const foreign = await call("GET", `/api/student/assignments/${assignmentId}`, {
    token: otherToken,
  });
  check("unenrolled student -> 403/404", foreign.status === 403 || foreign.status === 404, foreign.data);

  // --- teacher sees answer key ---------------------------------------------
  const teacherDetail = await call("GET", `/api/assignments/${assignmentId}`, {
    token: teacherToken,
  });
  check(
    "teacher detail includes reference",
    teacherDetail.status === 200 &&
      teacherDetail.data.assignment.questions[0].reference.includes("sqrt(2h/g)"),
    teacherDetail.data,
  );

  // --- live check (grades without storing an attempt) ----------------------
  // Grading calls hosted Gemma via the Gemini API. If no key is configured (or
  // the upstream call fails), the route returns 502/503/504 — treated as a skip.
  const liveCheck = await call("POST", `/api/student/questions/${questionId}/check`, {
    token: studentToken,
    body: {
      answerText:
        "Gravity accelerates the ball, so I use the free-fall relation to find the time.",
    },
  });
  if (liveCheck.status === 200) {
    check("live check returns per-idea progress", Array.isArray(liveCheck.data.ideas), liveCheck.data);
    assertNoKeys(liveCheck.data, ["reference", "criteria"]);
  } else if (GRADING_ERRORS.has(liveCheck.status)) {
    console.log(`  ~ live check skipped (grading ${liveCheck.status} ${liveCheck.data?.error?.code ?? ""})`);
  } else {
    check("live check -> 200 or grading error", false, liveCheck.data);
  }

  // --- submit an answer -----------------------------------------------------
  let graded = false;
  const submit = await call("POST", `/api/student/questions/${questionId}/submit`, {
    token: studentToken,
    body: {
      answerText:
        "The ball falls under gravity so I use t = sqrt(2h/g). Plugging in h = 20 gives t = sqrt(40/9.8), which is about 2.02 seconds. This uses the free-fall relation because the ball starts from rest.",
    },
  });
  if (submit.status === 201) {
    graded = true;
    check("submit answer -> 201", true);
    check("submit returns score", typeof submit.data.score === "number", submit.data);
    check("submit returns criteriaScores", Array.isArray(submit.data.criteriaScores), submit.data);
    check("submit returns feedback", typeof submit.data.feedback === "string", submit.data);
    check("submit returns per-idea progress", Array.isArray(submit.data.ideas), submit.data);
    check(
      "submit never returns a reference key",
      !("reference" in submit.data) && !("reference" in submit.data.submission),
      submit.data,
    );
    assertNoKeys(submit.data, ["reference", "criteria"]);
  } else if (GRADING_ERRORS.has(submit.status)) {
    console.log(`  ~ submit grading skipped (grading ${submit.status} ${submit.data?.error?.code ?? ""})`);
  } else {
    check("submit answer -> 201 or grading error", false, submit.data);
  }

  if (graded) {
    const resubmit = await call("POST", `/api/student/questions/${questionId}/submit`, {
      token: studentToken,
      body: { answerText: "t = sqrt(2h/g) = sqrt(40/9.8) = 2.02 s because of gravity." },
    });
    if (resubmit.status === 201) {
      check("second attempt increments attemptNumber", resubmit.data.attemptNumber === 2, resubmit.data);
    } else if (GRADING_ERRORS.has(resubmit.status)) {
      console.log(`  ~ resubmit grading skipped (grading ${resubmit.status} ${resubmit.data?.error?.code ?? ""})`);
    } else {
      check("second attempt -> 201 or grading error", false, resubmit.data);
    }
  }

  // --- teacher submissions report ------------------------------------------
  const report = await call("GET", `/api/assignments/${assignmentId}/submissions`, {
    token: teacherToken,
  });
  check("teacher submissions -> 200", report.status === 200, report.data);
  const row = report.data.students.find((s: any) => s.student.id === studentId);
  check("report includes the student", !!row, report.data);
  if (graded) {
    check("report includes 2 stored attempts", row.submissions.length === 2, report.data);
  }

  // --- student result -------------------------------------------------------
  const result = await call("GET", `/api/student/assignments/${assignmentId}/result`, {
    token: studentToken,
  });
  check("student result -> 200", result.status === 200, result.data);
  check("result has perQuestion", Array.isArray(result.data.perQuestion) && result.data.perQuestion.length === 2, result.data);

  // --- direct invite via student lookup ------------------------------------
  const search = await call("GET", `/api/students/search?q=Other`, { token: teacherToken });
  check("student search finds match", search.status === 200 && search.data.students.length >= 1, search.data);

  const invite = await call("POST", `/api/courses/${courseId}/invites`, {
    token: teacherToken,
    body: { studentId: otherId },
  });
  check("teacher invites student -> 201", invite.status === 201, invite.data);

  const otherInvites = await call("GET", "/api/student/invites", { token: otherToken });
  check("invited student sees invite", otherInvites.data.invites.length === 1, otherInvites.data);

  const accept = await call(
    "POST",
    `/api/student/invites/${otherInvites.data.invites[0].id}/accept`,
    { token: otherToken },
  );
  check("student accepts invite -> 200", accept.status === 200, accept.data);

  const otherCourses = await call("GET", "/api/student/courses", { token: otherToken });
  check("accepted student now enrolled", otherCourses.data.courses.length === 1, otherCourses.data);

  const otherDetail = await call("GET", `/api/student/assignments/${assignmentId}`, {
    token: otherToken,
  });
  check("accepted student can now read assignment", otherDetail.status === 200, otherDetail.data);

  console.log(`\nAll ${passed} smoke checks passed.`);
}

main().catch((e) => {
  console.error(`\nSmoke test FAILED: ${e.message}`);
  process.exit(1);
});
