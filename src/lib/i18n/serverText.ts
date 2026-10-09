import type { Locale } from "./config";

/**
 * The API speaks English. Messages it can show to users (error messages and
 * generated grading feedback, which is also stored with each attempt) are
 * translated here, on the client, so saved feedback follows the current
 * language too. Teacher-written text (hints, prompts) is never translated.
 * Unknown text is returned unchanged.
 */
const FR: Record<string, string> = {
  // Generic API errors (src/lib/errors.ts, src/lib/http.ts)
  "Authentication required": "Vous devez vous connecter.",
  Forbidden: "Accès refusé.",
  "Not found": "Introuvable.",
  "Something went wrong": "Une erreur s'est produite.",
  "Invalid request": "Requête invalide.",

  // Auth
  "Invalid email or password": "Courriel ou mot de passe incorrect.",
  "An account with that email already exists": "Un compte existe déjà avec ce courriel.",
  "Invalid or expired token": "Votre session a expiré. Veuillez vous reconnecter.",
  "Invalid or expired refresh token": "Votre session a expiré. Veuillez vous reconnecter.",
  "An access token is required": "Vous devez vous connecter.",
  "A refresh token is required": "Vous devez vous connecter.",
  "User no longer exists": "Ce compte n'existe plus.",
  "Your account does not have access to this resource": "Votre compte n'a pas accès à cette ressource.",

  // Courses, invites, enrollment
  "Course not found": "Cours introuvable.",
  "You do not own this course": "Ce cours ne vous appartient pas.",
  "That class code is already in use": "Ce code de cours est déjà utilisé.",
  "Use 3–16 letters or digits": "Utilisez de 3 à 16 lettres ou chiffres.",
  "No course matches that join code": "Aucun cours ne correspond à ce code.",
  "You are not enrolled in this course": "Vous n'êtes pas inscrit à ce cours.",
  "That student is already enrolled in this course": "Cet étudiant est déjà inscrit à ce cours.",
  "No such student": "Étudiant introuvable.",
  "Invite not found": "Invitation introuvable.",
  "This invite has been revoked": "Cette invitation a été annulée.",

  // Assignments and questions
  "Assignment not found": "Devoir introuvable.",
  "You do not own this assignment": "Ce devoir ne vous appartient pas.",
  "Question not found": "Question introuvable.",
  "This assignment is closed": "Ce devoir est fermé.",
  "Add at least one question before making this assignment public":
    "Ajoutez au moins une question avant de publier ce devoir.",
  "Questions cannot be changed after an assignment is published; unpublish it first":
    "Les questions ne peuvent plus être modifiées une fois le devoir publié; retirez-le d'abord.",
  "Key-ideas questions need at least one idea": "Une question à idées clés doit comporter au moins une idée.",
  "Multiple-choice questions need 2+ options with unique ids and at least one correct":
    "Une question à choix multiples doit avoir au moins 2 choix distincts, dont au moins un bon.",

  // Grading errors
  "Too many grading requests. Slow down and try again.":
    "Trop de demandes d'évaluation. Patientez un peu, puis réessayez.",
  "Set GEMINI_API_KEY in the server environment.": "L'évaluation n'est pas disponible pour le moment.",
  "GEMMA_MODEL must be gemma-4-26b-a4b-it or gemma-4-31b-it.": "L'évaluation n'est pas disponible pour le moment.",
  "Gemini API timed out.": "L'évaluation a pris trop de temps. Réessayez.",
  "Could not reach the Gemini API.": "Le service d'évaluation est injoignable. Réessayez.",
  "Gemini API rejected credentials or model access.": "L'évaluation n'est pas disponible pour le moment.",
  "Gemini API quota or rate limit reached. Try later.":
    "Le service d'évaluation est surchargé. Réessayez plus tard.",
  "Gemma returned an invalid, blocked, or incomplete decision. No decision was accepted.":
    "L'évaluation a échoué. Réessayez.",
  "This question or answer is too long to grade.": "Cette question ou cette réponse est trop longue pour être évaluée.",
  "This question has no criteria to grade against.": "Cette question n'a aucun critère d'évaluation.",
  "A grading instruction is too long.": "Une consigne d'évaluation est trop longue.",
  "This question or answer is too long for a hint.": "Cette question ou cette réponse est trop longue pour un indice.",

  // Generated feedback (gemma.ts, choice.ts)
  "All key ideas included.": "Toutes les idées clés sont incluses.",
  "Add more detail.": "Ajoutez plus de détails.",
  "Part of your explanation isn't accurate. Re-read it and fix what's wrong.":
    "Une partie de votre explication est inexacte. Relisez-la et corrigez ce qui ne va pas.",
  "Correct.": "Bonne réponse.",
  "Choose an option.": "Choisissez une réponse.",
  "Partly right: more than one option is correct.": "En partie juste : plus d'une réponse est bonne.",
  "Not quite. Read the question again and reconsider your choice.":
    "Pas tout à fait. Relisez la question et revoyez votre choix.",

  // Offline stub feedback (jevStub.ts, GRADING_BACKEND=stub)
  "You're on the right track. Try to cover a bit more of what the question is asking.":
    "Vous êtes sur la bonne voie. Essayez de couvrir un peu plus ce que demande la question.",
  "You've started, but some required ideas are still missing — what else does the prompt ask for?":
    "C'est un début, mais certaines idées demandées manquent encore. Que demande d'autre la question?",
  "The main gap is coverage: part of the question is unaddressed. List each thing the prompt requires and check it off.":
    "Le principal manque est la couverture : une partie de la question n'est pas traitée. Dressez la liste de ce que demande la question et cochez chaque élément.",
  "Nice start. Add a sentence or two explaining *why*, not just *what*.":
    "Bon début. Ajoutez une phrase ou deux qui expliquent le *pourquoi*, pas seulement le *quoi*.",
  "Develop the reasoning: connect your points with words like 'because' or 'therefore'.":
    "Développez le raisonnement : reliez vos idées avec des mots comme « parce que » ou « donc ».",
  "The missing piece is explanation — claims are stated but not justified. Walk through the reasoning step by step.":
    "Il manque l'explication : vos affirmations ne sont pas justifiées. Détaillez le raisonnement étape par étape.",
  "Your idea comes across. Try shortening sentences and using punctuation to structure it.":
    "Votre idée passe bien. Essayez de raccourcir vos phrases et de les structurer avec la ponctuation.",
  "Break your answer into clearer sentences, one idea per sentence.":
    "Découpez votre réponse en phrases plus claires, une idée par phrase.",
  "Reorganize for clarity: state the point, then support it, one idea at a time.":
    "Réorganisez pour plus de clarté : énoncez l'idée, puis appuyez-la, une idée à la fois.",
  "You're close. Double-check the key details against the concepts involved.":
    "Vous y êtes presque. Vérifiez les détails clés à la lumière des concepts en jeu.",
  "Some specifics look off. Re-examine the core idea the question targets.":
    "Certains détails semblent inexacts. Réexaminez l'idée centrale visée par la question.",
  "Focus on precision: verify the central terms and their relationships before expanding.":
    "Misez sur la précision : vérifiez les termes centraux et leurs liens avant d'élaborer.",
  "Good effort — think about what a complete answer would need to include.":
    "Bel effort. Réfléchissez à ce qu'une réponse complète devrait contenir.",
  "Add more substance and explicitly justify your reasoning.":
    "Étoffez votre réponse et justifiez explicitement votre raisonnement.",
  "Identify the single weakest part of your answer and rewrite just that part with more support.":
    "Repérez la partie la plus faible de votre réponse et réécrivez-la en l'appuyant davantage.",
};

/** Messages with a variable part, matched in order. */
const FR_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^You're close on Idea (\d+)\. Be more specific\.$/, (m) => `Vous y êtes presque pour l'idée ${m[1]}. Soyez plus précis.`],
  [/^Hints unlock after (\d+) submissions\.$/, (m) => `Les indices se débloquent après ${m[1]} soumissions.`],
  [/^Gemini API returned HTTP \d+\.$/, () => "Le service d'évaluation a renvoyé une erreur. Réessayez."],
  [/^A batch must contain .+ questions\.$/, () => "Cette question comporte trop de critères pour être évaluée."],
];

export function translateServerText(text: string, locale: Locale): string;
export function translateServerText(text: string | null, locale: Locale): string | null;
export function translateServerText(text: string | null, locale: Locale): string | null {
  if (text == null || locale === "en") return text;
  const key = text.trim();
  // Server messages sometimes omit the trailing period that UI messages carry
  const exact = FR[key] ?? FR[key.replace(/\.$/, "")];
  if (exact) return exact;
  for (const [re, render] of FR_PATTERNS) {
    const match = key.match(re);
    if (match) return render(match);
  }
  return text;
}
