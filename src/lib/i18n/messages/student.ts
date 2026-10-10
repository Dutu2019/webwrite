// Student screens. French (Quebec) is the source; English must match its shape.

const NBSP = " ";

const fr = {
  /** "85 %": Quebec French puts a non-breaking space before the percent sign. */
  percent: (n: number) => `${n}${NBSP}%`,
  /** Label followed by a colon ("Idée 1 :"). */
  colon: (label: string) => `${label}${NBSP}:`,
  points: (n: number) => (n < 2 ? `${n}${NBSP}pt` : `${n}${NBSP}pts`),
  questions: (n: number) => (n < 2 ? `${n} question` : `${n} questions`),
  questionsComplete: (done: number, total: number) =>
    done < 2 ? `${done} question terminée sur ${total}` : `${done} questions terminées sur ${total}`,
  due: (date: string) => `Remise le ${date}`,
  noDueDate: "Aucune date de remise",
  open: "Ouvert",
  completed: "Terminé",

  workspace: {
    loading: "Chargement de vos cours…",
    loadError: "Impossible de charger vos cours.",
    refreshError: "Vous avez rejoint le cours, mais la liste n'a pas pu être actualisée. Rechargez la page.",
    joinClass: "Rejoindre un cours",
    openOrJoin: "Ouvrez un cours dans la liste de gauche, ou rejoignez-en un autre.",
    joinFirst: "Rejoignez votre premier cours avec le code que votre professeur vous a donné.",
    taughtBy: (name: string) => `Enseigné par ${name}`,
    noAssignments: "Aucun devoir publié pour l'instant.",
  },

  join: {
    codeLabel: "Code du cours",
    codePlaceholder: "p. ex. HIST200",
    codeHelp: "Votre professeur communique ce code à son groupe.",
    joining: "Inscription…",
    submit: "Rejoindre le cours",
    errors: {
      empty: "* veuillez entrer le code du cours",
      notFound: "* aucun cours ne correspond à ce code",
      generic: "* impossible de rejoindre le cours, veuillez réessayer",
    },
  },

  assignment: {
    back: "← Retour au cours",
    notAvailable: "Ce devoir n'est pas disponible.",
    loadError: "Impossible de charger le devoir.",
    progressLabel: "Questions terminées",
    allDone: "❦ Devoir terminé. Bravo!",
    closedBanner:
      "Ce devoir est fermé. Vous pouvez revoir vos réponses, mais aucune nouvelle soumission n'est acceptée.",
    submitHelp: "Soumet toutes les réponses que vous avez modifiées et affiche votre note.",
    submitting: "Soumission…",
    submit: "Soumettre le devoir",
    submitError: "Certaines réponses n'ont pas pu être soumises. Vérifiez les questions marquées en rouge.",
    submittedTitle: "Devoir soumis",
  },

  answer: {
    completed: "✓ Terminée",
    options: "Choix de réponse",
    selectAll: "Sélectionnez toutes les réponses qui s'appliquent.",
    inputLabel: (n: number) => `Votre réponse à la question ${n}`,
    placeholder: "Votre réponse…",
    essayPlaceholder: "Rédigez votre dissertation…",
    attempts: (n: number) => (n < 2 ? `${n} tentative` : `${n} tentatives`),
    notAttempted: "Aucune tentative pour l'instant",
    submit: "Soumettre la réponse",
    resubmit: "Soumettre de nouveau",
    submitting: "Soumission…",
    correct: "Bonne réponse! Cette question est terminée.",
    attemptSaved: (n: number) => `Tentative ${n} enregistrée. La question n'est pas encore terminée; continuez.`,
    submitError: "Impossible de soumettre la réponse. Veuillez réessayer.",
  },

  feedback: {
    complete: "Réponse complète. Soumettez-la quand elle vous convient.",
    flagged: "Un élément de votre réponse est inexact. Relisez-la.",
    starting: "C'est un début",
    onTrack: "Vous êtes sur la bonne voie",
    almost: "Vous y êtes presque",
    checking: "Gemma lit votre réponse…",
    idle: "Commencez à écrire; Gemma vous dira où vous en êtes.",
    meterLabel: "Progression de votre réponse",
    hint: "Indice",
    hintIn: (n: number) => (n < 2 ? `Indice dans ${n} tentative` : `Indice dans ${n} tentatives`),
    hintUnlocksAfter: (n: number) => `Les indices se débloquent après ${n} soumissions`,
    hintAsk: "Demander un indice à Gemma sur votre réponse actuelle",
    hintLoading: "Gemma examine votre réponse…",
    hintError: "Impossible d'obtenir un indice. Réessayez.",
    keyIdeas: "Idées clés",
  },

  /** Attempts and best score on an assignment card. */
  progress: {
    title: "Soumissions jusqu'ici et votre meilleure note",
    attempts: (n: number) => (n < 2 ? `${n} tentative` : `${n} tentatives`),
    best: (pct: string) => `Meilleure note : ${pct}`,
  },

  summary: {
    pointsOf: (earned: string, max: string) => `${earned} / ${max} points`,
    attempts: "Tentatives",
    submitted: "Soumis le",
    question: "Question",
    bestScore: "Meilleure note",
    goHome: "Retour à l'accueil",
  },
};

const en: typeof fr = {
  percent: (n) => `${n}%`,
  colon: (label) => `${label}:`,
  points: (n) => (n === 1 ? `${n}${NBSP}pt` : `${n}${NBSP}pts`),
  questions: (n) => (n === 1 ? `${n} question` : `${n} questions`),
  questionsComplete: (done, total) => `${done} of ${total} ${total === 1 ? "question" : "questions"} complete`,
  due: (date) => `Due ${date}`,
  noDueDate: "No due date",
  open: "Open",
  completed: "Completed",

  workspace: {
    loading: "Loading your classes…",
    loadError: "Couldn't load your classes.",
    refreshError: "Joined, but couldn't refresh your classes. Reload the page.",
    joinClass: "Join a class",
    openOrJoin: "Open a class from the left, or join another.",
    joinFirst: "Join your first class with the code your professor gave you.",
    taughtBy: (name) => `Taught by ${name}`,
    noAssignments: "No assignments posted yet.",
  },

  join: {
    codeLabel: "Class code",
    codePlaceholder: "e.g. HIST200",
    codeHelp: "Your professor shares this code with the class.",
    joining: "Joining…",
    submit: "Join class",
    errors: {
      empty: "* please enter the class code",
      notFound: "* no class matches this code",
      generic: "* couldn't join the class, please try again",
    },
  },

  assignment: {
    back: "← Back to class",
    notAvailable: "This assignment isn't available.",
    loadError: "Couldn't load the assignment.",
    progressLabel: "Questions complete",
    allDone: "❦ Assignment complete. Well done!",
    closedBanner: "This assignment is closed. You can review your answers, but no new submissions are accepted.",
    submitHelp: "Submits every answer you've changed and shows your grade.",
    submitting: "Submitting…",
    submit: "Submit assignment",
    submitError: "Some answers couldn't be submitted. Check the questions marked in red.",
    submittedTitle: "Submitted",
  },

  answer: {
    completed: "✓ Completed",
    options: "Options",
    selectAll: "Select all that apply.",
    inputLabel: (n) => `Your answer to question ${n}`,
    placeholder: "Your answer…",
    essayPlaceholder: "Write your essay…",
    attempts: (n) => (n === 1 ? `${n} attempt` : `${n} attempts`),
    notAttempted: "Not attempted yet",
    submit: "Submit answer",
    resubmit: "Submit again",
    submitting: "Submitting…",
    correct: "Correct! This question is complete.",
    attemptSaved: (n) => `Attempt ${n} saved. Not complete yet; keep going.`,
    submitError: "Couldn't submit. Please try again.",
  },

  feedback: {
    complete: "Complete. Submit when you're happy with it.",
    flagged: "Something you wrote isn't accurate. Re-read your answer.",
    starting: "Just getting started",
    onTrack: "On the right track",
    almost: "Almost there",
    checking: "Gemma is reading your answer…",
    idle: "Start writing; Gemma will tell you how close you are.",
    meterLabel: "How close your answer is to complete",
    hint: "Hint",
    hintIn: (n: number) => `Hint in ${n} ${n === 1 ? "try" : "tries"}`,
    hintUnlocksAfter: (n: number) => `Hints unlock after ${n} submissions`,
    hintAsk: "Ask Gemma for a hint on your current answer",
    hintLoading: "Gemma is looking at your answer…",
    hintError: "Couldn't get a hint. Try again.",
    keyIdeas: "Key ideas",
  },

  progress: {
    title: "Submissions so far, and your best score",
    attempts: (n: number) => `${n} ${n === 1 ? "attempt" : "attempts"}`,
    best: (pct: string) => `Best ${pct}`,
  },

  summary: {
    pointsOf: (earned, max) => `${earned} / ${max} points`,
    attempts: "Attempts",
    submitted: "Submitted",
    question: "Question",
    bestScore: "Best score",
    goHome: "Go to homepage",
  },
};

export default { fr, en };
