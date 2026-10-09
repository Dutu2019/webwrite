import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Idempotent showcase accounts: each is one teacher, one course, one published
 * assignment covering every question type.
 *
 *   demo.prof@webwrite.app       / Showcase2026!   — Chemistry, join code DEMO2026
 *   demo.humanities@webwrite.app / Showcase2026!   — History,   join code HIST2026
 *
 * Usage: npx tsx scripts/demo-account.ts
 */
const EMAIL = "demo.prof@webwrite.app";
const PASSWORD = "Showcase2026!";

async function main() {
  const teacher = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      id: "usr_demo_prof",
      email: EMAIL,
      name: "Prof. Marie Curie",
      role: "TEACHER",
      passwordHash: await hash(PASSWORD, 10),
    },
  });

  const course = await prisma.course.upsert({
    where: { id: "crs_demo_chem" },
    update: {},
    create: {
      id: "crs_demo_chem",
      name: "Intro to Chemistry",
      description: "Atoms, bonds and reactions — explained in your own words.",
      joinCode: "DEMO2026",
      teacherId: teacher.id,
    },
  });

  const assignment = await prisma.assignment.upsert({
    where: { id: "asg_demo_bonding" },
    update: {},
    create: {
      id: "asg_demo_bonding",
      courseId: course.id,
      title: "Chemical Bonding",
      description: "A short mix of question types: quick checks, a calculation, and written explanations.",
      published: true,
      publishedAt: new Date(),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const questions = [
    {
      id: "q_demo_mc",
      order: 0,
      type: "MULTIPLE_CHOICE",
      prompt: "Which type of bond forms when two atoms share a pair of electrons?",
      reference: "Covalent bond.",
      options: JSON.stringify([
        { id: "a", text: "Ionic bond", correct: false },
        { id: "b", text: "Covalent bond", correct: true },
        { id: "c", text: "Metallic bond", correct: false },
        { id: "d", text: "Hydrogen bond", correct: false },
      ]),
      points: 1,
    },
    {
      id: "q_demo_short",
      order: 1,
      type: "SHORT_ANSWER",
      prompt: "How many moles are in 36 g of water? (molar mass of H2O = 18 g/mol)",
      reference: "n = m / M = 36 / 18 = 2 mol",
      criteria: JSON.stringify([
        { key: "completeness", weight: 0.6, description: "Uses n = m/M and reaches 2 mol." },
        { key: "elaboration", weight: 0.4, description: "Shows the substitution with units." },
      ]),
      points: 1,
    },
    {
      id: "q_demo_ideas",
      order: 2,
      type: "KEY_IDEAS",
      prompt:
        "Explain why sodium chloride (table salt) has such a high melting point. " +
        "Describe the particles involved and the forces between them.",
      reference:
        "NaCl is an ionic compound: sodium gives an electron to chlorine, forming Na+ and Cl- ions. " +
        "The ions are held in a giant lattice by strong electrostatic attraction in every direction, " +
        "so a lot of energy is needed to separate them.",
      criteria: JSON.stringify([
        { key: "idea1", weight: 1,
          description: "Sodium transfers an electron to chlorine, forming positive Na+ and negative Cl- ions.",
          hint: "What happens to the electrons between sodium and chlorine?" },
        { key: "idea2", weight: 1,
          description: "Oppositely charged ions attract strongly (electrostatic attraction) in a giant lattice.",
          hint: "How are the ions arranged, and what holds them together?" },
        { key: "idea3", weight: 1,
          description: "Breaking the many strong attractions takes a lot of energy, hence the high melting point.",
          hint: "Connect the strength of the forces to the melting point." },
      ]),
      points: 2,
    },
    {
      id: "q_demo_essay",
      order: 3,
      type: "ESSAY",
      prompt:
        "Should single-use plastics be banned? Argue a position using what you know about " +
        "the chemistry of polymers.",
      reference: `RUBRIC (open-ended, no single answer):
1. Explains what polymers are and why many plastics are hard to break down.
2. Takes a clear position.
3. Supports it with a chemistry-based argument.
4. Addresses a counterargument (cost, hygiene, alternatives).
5. Uses a concrete example.`,
      criteria: JSON.stringify([
        { key: "idea1", weight: 1,
          description: "Explains that plastics are long-chain polymers with strong covalent bonds that resist breakdown.",
          hint: "What is a polymer, and why does it last so long?" },
        { key: "idea2", weight: 1,
          description: "Takes a clear position on a ban.",
          hint: "Where do you stand? Say it plainly." },
        { key: "idea3", weight: 1,
          description: "Supports the position with a chemistry-based argument.",
          hint: "Which chemical property backs up your view?" },
        { key: "idea4", weight: 1,
          description: "Addresses a counterargument such as cost, hygiene or the impact of alternatives.",
          hint: "What would someone who disagrees say?" },
        { key: "idea5", weight: 1,
          description: "Uses a concrete example (a product, policy or alternative material).",
          hint: "Can you ground this in a real case?" },
      ]),
      points: 3,
    },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {},
      create: { ...q, assignmentId: assignment.id },
    });
  }

  console.log("Demo account ready:");
  console.log(`  login:    ${EMAIL} / ${PASSWORD}`);
  console.log(`  course:   ${course.name} (join code ${course.joinCode})`);
  console.log(`  assignment: ${assignment.title} (${questions.length} questions)`);

  await humanities();
}

/** Second showcase account: a humanities teacher with one history course. */
async function humanities() {
  const email = "demo.humanities@webwrite.app";

  const teacher = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id: "usr_demo_hum",
      email,
      name: "Prof. Eleanor Hayes",
      role: "TEACHER",
      passwordHash: await hash(PASSWORD, 10),
    },
  });

  const course = await prisma.course.upsert({
    where: { id: "crs_demo_hist" },
    update: {},
    create: {
      id: "crs_demo_hist",
      name: "World History: Revolutions",
      description: "Causes, ideas and consequences of the revolutions that shaped the modern world.",
      joinCode: "HIST2026",
      teacherId: teacher.id,
    },
  });

  const assignment = await prisma.assignment.upsert({
    where: { id: "asg_demo_french_rev" },
    update: {},
    create: {
      id: "asg_demo_french_rev",
      courseId: course.id,
      title: "The French Revolution",
      description: "From the Estates-General to the Terror: quick checks, a source question, and an argument.",
      published: true,
      publishedAt: new Date(),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const questions = [
    {
      id: "q_hist_mc",
      order: 0,
      type: "MULTIPLE_CHOICE",
      prompt: "Which event on 14 July 1789 became the symbol of the French Revolution?",
      reference: "The storming of the Bastille.",
      options: JSON.stringify([
        { id: "a", text: "The Tennis Court Oath", correct: false },
        { id: "b", text: "The storming of the Bastille", correct: true },
        { id: "c", text: "The execution of Louis XVI", correct: false },
        { id: "d", text: "The Women's March on Versailles", correct: false },
      ]),
      points: 1,
    },
    {
      id: "q_hist_short",
      order: 1,
      type: "SHORT_ANSWER",
      prompt: "Name the three Estates of pre-revolutionary France and who belonged to each.",
      reference:
        "First Estate: the clergy. Second Estate: the nobility. " +
        "Third Estate: everyone else (peasants, urban workers, the bourgeoisie).",
      criteria: JSON.stringify([
        { key: "completeness", weight: 0.6, description: "Names all three Estates in the correct order." },
        { key: "elaboration", weight: 0.4, description: "Says who belonged to each Estate." },
      ]),
      points: 1,
    },
    {
      id: "q_hist_ideas",
      order: 2,
      type: "KEY_IDEAS",
      prompt:
        "Explain the main causes of the French Revolution. Consider financial, social and " +
        "intellectual factors.",
      reference:
        "France was nearly bankrupt after costly wars (including support for the American Revolution), " +
        "and bad harvests drove up bread prices. The Third Estate carried the tax burden while the clergy " +
        "and nobility held privileges. Enlightenment ideas about natural rights, popular sovereignty and " +
        "equality gave people a language to challenge absolute monarchy.",
      criteria: JSON.stringify([
        { key: "idea1", weight: 1,
          description: "Financial crisis: war debts (e.g. the American Revolution) left the state close to bankruptcy.",
          hint: "What state were the royal finances in, and why?" },
        { key: "idea2", weight: 1,
          description: "Social inequality: the Third Estate paid most taxes while the clergy and nobility were privileged.",
          hint: "Who paid the taxes, and who didn't?" },
        { key: "idea3", weight: 1,
          description: "Enlightenment ideas (natural rights, popular sovereignty) challenged absolute monarchy.",
          hint: "Which ideas gave people a reason to question the king?" },
        { key: "idea4", weight: 1,
          description: "Bad harvests and high bread prices caused hunger and popular anger.",
          hint: "What was happening to ordinary people's food supply?" },
      ]),
      points: 2,
    },
    {
      id: "q_hist_essay",
      order: 3,
      type: "ESSAY",
      prompt:
        "\"The Reign of Terror was a betrayal of the Revolution's ideals.\" To what extent do you agree?",
      reference: `RUBRIC (open-ended, no single answer):
1. Explains what the Terror was (1793–94, Committee of Public Safety, mass executions).
2. Takes a clear position.
3. Connects the argument to the Revolution's ideals (liberty, equality, rights of man).
4. Addresses the counterargument (war, internal revolt, defending the Republic).
5. Uses concrete evidence (Robespierre, Law of Suspects, specific events).`,
      criteria: JSON.stringify([
        { key: "idea1", weight: 1,
          description: "Explains what the Terror was: 1793–94, the Committee of Public Safety, mass arrests and executions.",
          hint: "What actually happened during the Terror?" },
        { key: "idea2", weight: 1,
          description: "Takes a clear position on whether it betrayed the Revolution's ideals.",
          hint: "Where do you stand? Say it plainly." },
        { key: "idea3", weight: 1,
          description: "Connects the argument to the Revolution's stated ideals, such as the Declaration of the Rights of Man.",
          hint: "Which ideals are at stake, and how does the Terror measure up?" },
        { key: "idea4", weight: 1,
          description: "Addresses the counterargument that it was a response to foreign war and internal revolt.",
          hint: "Why might its defenders say it was necessary?" },
        { key: "idea5", weight: 1,
          description: "Uses concrete evidence (Robespierre, the Law of Suspects, specific trials or events).",
          hint: "Can you name a person, law or event that supports your view?" },
      ]),
      points: 3,
    },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {},
      create: { ...q, assignmentId: assignment.id },
    });
  }

  console.log("Humanities demo account ready:");
  console.log(`  login:    ${email} / ${PASSWORD}`);
  console.log(`  course:   ${course.name} (join code ${course.joinCode})`);
  console.log(`  assignment: ${assignment.title} (${questions.length} questions)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
