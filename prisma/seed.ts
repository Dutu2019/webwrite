import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Idempotent seed with hardcoded example data so the API is testable before
 * the real JEV grading model exists.
 *
 * Accounts (password for all): "password123"
 *   teacher@example.com   — teacher (owns both courses)
 *   alice@example.com     — student (enrolled in Physics 101)
 *   bob@example.com       — student (enrolled in History 200)
 *
 * Join codes: PHYS101, HIST200
 */
async function main() {
  const passwordHash = await hash("password123", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: {
      id: "usr_teacher1",
      email: "teacher@example.com",
      name: "Prof. Ada Lovelace",
      role: "TEACHER",
      passwordHash,
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      id: "usr_student1",
      email: "alice@example.com",
      name: "Alice Chen",
      role: "STUDENT",
      passwordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      id: "usr_student2",
      email: "bob@example.com",
      name: "Bob Diaz",
      role: "STUDENT",
      passwordHash,
    },
  });

  const physics = await prisma.course.upsert({
    where: { id: "crs_physics" },
    update: {},
    create: {
      id: "crs_physics",
      name: "Physics 101",
      description: "Mechanics and kinematics.",
      joinCode: "PHYS101",
      teacherId: teacher.id,
    },
  });

  const history = await prisma.course.upsert({
    where: { id: "crs_history" },
    update: {},
    create: {
      id: "crs_history",
      name: "History 200",
      description: "Modern political thought.",
      joinCode: "HIST200",
      teacherId: teacher.id,
    },
  });

  await prisma.enrollment.upsert({
    where: {
      courseId_studentId: { courseId: physics.id, studentId: alice.id },
    },
    update: {},
    create: { courseId: physics.id, studentId: alice.id, status: "ACTIVE" },
  });

  await prisma.enrollment.upsert({
    where: {
      courseId_studentId: { courseId: history.id, studentId: bob.id },
    },
    update: {},
    create: { courseId: history.id, studentId: bob.id, status: "ACTIVE" },
  });

  const kinematics = await prisma.assignment.upsert({
    where: { id: "asg_kinematics" },
    update: {},
    create: {
      id: "asg_kinematics",
      courseId: physics.id,
      title: "Kinematics Basics",
      description: "Free-fall and motion under gravity.",
      published: true,
      publishedAt: new Date(),
    },
  });

  await prisma.question.upsert({
    where: { id: "q_m1" },
    update: {},
    create: {
      id: "q_m1",
      assignmentId: kinematics.id,
      order: 0,
      prompt:
        "A ball is dropped from 20 m. How long until it hits the ground? (g = 9.8 m/s^2)",
      reference: "t = sqrt(2h/g) = sqrt(40/9.8) ≈ 2.02 s",
      criteria: JSON.stringify([
        { key: "completeness", weight: 0.6, description: "Uses the correct free-fall relation and reaches a value." },
        { key: "elaboration", weight: 0.4, description: "Shows the setup and unit-consistent steps." },
      ]),
      points: 1,
    },
  });

  await prisma.question.upsert({
    where: { id: "q_m2" },
    update: {},
    create: {
      id: "q_m2",
      assignmentId: kinematics.id,
      order: 1,
      prompt:
        "A car accelerates from rest at 3 m/s^2 for 5 s. What distance does it cover?",
      reference: "d = 0.5 * a * t^2 = 0.5 * 3 * 25 = 37.5 m",
      criteria: JSON.stringify([
        { key: "completeness", weight: 0.6, description: "Selects the correct kinematic equation and computes the distance." },
        { key: "elaboration", weight: 0.4, description: "Shows substitution and arithmetic clearly." },
      ]),
      points: 1,
    },
  });

  const civil = await prisma.assignment.upsert({
    where: { id: "asg_civil" },
    update: {},
    create: {
      id: "asg_civil",
      courseId: history.id,
      title: "Essay: Civil Disobedience",
      description: "Open-ended argument question.",
      published: true,
      publishedAt: new Date(),
    },
  });

  await prisma.question.upsert({
    where: { id: "q_h1" },
    update: {},
    create: {
      id: "q_h1",
      assignmentId: civil.id,
      order: 0,
      type: "ESSAY",
      prompt:
        "Argue whether civil disobedience can be justified in a democracy.",
      reference: `RUBRIC (open-ended, no single answer):
1. Defines civil disobedience vs ordinary law-breaking.
2. Takes a clear position.
3. Gives a principled argument (justice vs legality).
4. Addresses the counterargument (undermining the rule of law).
5. Uses a concrete example or analogy.`,
      criteria: JSON.stringify([
        { key: "completeness", weight: 0.5, description: "Addresses multiple rubric dimensions." },
        { key: "elaboration", weight: 0.5, description: "Develops a reasoned, illustrated argument." },
      ]),
      points: 2,
    },
  });

  console.log("Seed complete:");
  console.log(`  teacher: ${teacher.email}`);
  console.log(`  students: ${alice.email}, ${bob.email}`);
  console.log(`  courses: ${physics.name} (${physics.joinCode}), ${history.name} (${history.joinCode})`);
  console.log(`  assignments: ${kinematics.title}, ${civil.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
