// Builder screens. French (Quebec) is the source; English must match its shape.

const NBSP = " ";

const fr = {
  backToClass: "← Retour au cours",
  unsavedChanges: "Modifications non enregistrées",
  saved: "Enregistré.",
  publish: "Publier",
  unpublish: "Retirer",
  saveFirst: "Enregistrez d'abord vos questions",
  addQuestionFirst: "Ajoutez et enregistrez d'abord une question",
  lockedBanner:
    "Ce devoir est publié, ses questions sont donc verrouillées. Retirez-le pour les modifier; les étudiants ne le verront plus tant que vous ne l'aurez pas publié de nouveau.",
  notFound: "Devoir introuvable.",
  loadFailed: "Impossible de charger le devoir.",
  needsFixing: "Certaines questions doivent être corrigées avant l'enregistrement.",
  saveFailed: "Impossible d'enregistrer. Veuillez réessayer.",
  visibilityFailed: "Impossible de modifier la visibilité du devoir.",
  confirmLeave: "Vos questions ne sont pas enregistrées. Quitter sans enregistrer?",
  dueOn: (date: string) => `Remise le ${date}`,
  noDueDate: "Aucune date de remise",
  questionCount: (n: number) => `${n} ${n <= 1 ? "question" : "questions"}`,
  points: (n: number) => `${n}${NBSP}${n <= 1 ? "pt" : "pts"}`,
  ideaCount: (n: number) => `${n} ${n <= 1 ? "idée" : "idées"}`,
  firstQuestion: "Ajoutez votre première question.",
  addQuestion: "Ajouter une question",
  addTypedQuestion: (typeLabel: string) => `Ajouter une question de type «${NBSP}${typeLabel}${NBSP}»`,

  /** Question kinds, keyed by their (untranslated) type id. */
  types: {
    SHORT_ANSWER: {
      label: "Réponse courte",
      description: "Une phrase ou deux, comparée à une réponse de référence.",
    },
    KEY_IDEAS: {
      label: "Idées clés",
      description: "Une explication qui doit contenir des idées précises; Gemma suit chacune d'elles.",
    },
    ESSAY: {
      label: "Dissertation",
      description: "Une argumentation plus longue, évaluée selon votre grille.",
    },
    MULTIPLE_CHOICE: {
      label: "Choix multiples",
      description: "Les étudiants choisissent parmi les choix proposés; correction exacte, sans IA.",
    },
  },

  /** Model answer / rubric field, per question type. */
  reference: {
    SHORT_ANSWER: {
      label: "Réponse de référence",
      help: "Ce que dit une réponse complète. Les étudiants ne la voient jamais.",
      placeholder: "p. ex. Parce que le traité a transféré la souveraineté à…",
    },
    KEY_IDEAS: {
      label: "Réponse de référence",
      help: "Une réponse complète qui couvre chaque idée. Les étudiants ne la voient jamais.",
      placeholder: "p. ex. La désobéissance civile consiste à enfreindre la loi publiquement et sans violence…",
    },
    ESSAY: {
      label: "Grille d'évaluation",
      help: "Ce que fait une bonne dissertation, un critère par ligne. Les étudiants ne la voient jamais.",
      placeholder:
        "1. Prend une position claire.\n2. Présente un argument fondé sur des principes.\n3. Répond à un contre-argument.",
    },
  },

  card: {
    question: (n: number) => `Question ${n}`,
    editQuestion: (n: number) => `Modifier la question ${n}`,
    dragToReorder: (n: number) => `Glissez pour déplacer la question ${n}`,
    untitled: "Question sans énoncé",
    emptyOption: "Choix vide",
    needsAttention: "À corriger",
    promptPlaceholder: "Énoncé de la question",
    questionType: "Type de question",
    points: "Points",
    mathTipLead: `Maths${NBSP}: tapez`,
    mathTipLatex: " ou LaTeX",
    moveUp: "Monter",
    moveUpLabel: "Monter la question",
    moveDown: "Descendre",
    moveDownLabel: "Descendre la question",
    duplicate: "Dupliquer",
    duplicateLabel: "Dupliquer la question",
    deleteLabel: "Supprimer la question",
  },

  ideas: {
    legend: "Idées clés",
    help: `Les étudiants voient seulement «${NBSP}Idée 1${NBSP}», «${NBSP}Idée 2${NBSP}»… et s'ils ont abordé chacune d'elles. L'indice s'affiche tant qu'une idée manque.`,
    placeholder: "Ce que la réponse doit dire",
    hintLabel: (n: number) => `Indice pour l'idée ${n}`,
    hintPlaceholder: "Indice pour les étudiants (facultatif)",
    remove: "Supprimer l'idée",
    removeLabel: (n: number) => `Supprimer l'idée ${n}`,
    add: "+ Ajouter une idée",
  },

  options: {
    legend: "Choix",
    help: "Cochez la bonne réponse. Si vous en cochez plusieurs, les étudiants devront toutes les choisir. Les étudiants ne voient jamais lesquelles sont bonnes.",
    option: (n: number) => `Choix ${n}`,
    isCorrectLabel: (n: number) => `Le choix ${n} est une bonne réponse`,
    correct: "Bonne réponse",
    markCorrect: "Marquer comme bonne réponse",
    remove: "Supprimer le choix",
    removeLabel: (n: number) => `Supprimer le choix ${n}`,
    add: "+ Ajouter un choix",
  },

  errors: {
    prompt: "* veuillez rédiger la question",
    points: "* de 1 à 1000 points",
    reference: "* veuillez ajouter une réponse de référence",
    rubric: "* veuillez ajouter une grille d'évaluation",
    noIdeas: "* ajoutez au moins une idée clé",
    emptyIdea: "* décrivez cette idée ou supprimez-la",
    tooFewOptions: "* ajoutez au moins deux choix",
    noCorrectOption: "* cochez la bonne réponse",
    emptyOption: "* rédigez ce choix ou supprimez-le",
  },
  /** Questions / Students tabs on a posted assignment. */
  tabs: { label: "Vue du devoir", questions: "Questions", students: "Étudiants" },
};

const en: typeof fr = {
  backToClass: "← Back to class",
  unsavedChanges: "Unsaved changes",
  saved: "Saved.",
  publish: "Make public",
  unpublish: "Make private",
  saveFirst: "Save your questions first",
  addQuestionFirst: "Add and save a question first",
  lockedBanner:
    "This assignment is public, so its questions are locked. Make it private to edit them; students won't see it until you make it public again.",
  notFound: "Assignment not found.",
  loadFailed: "Couldn't load the assignment.",
  needsFixing: "Some questions need attention before saving.",
  saveFailed: "Couldn't save. Please try again.",
  visibilityFailed: "Couldn't change visibility.",
  confirmLeave: "You have unsaved questions. Leave without saving?",
  dueOn: (date: string) => `Due ${date}`,
  noDueDate: "No due date",
  questionCount: (n: number) => `${n} ${n === 1 ? "question" : "questions"}`,
  points: (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`,
  ideaCount: (n: number) => `${n} ${n === 1 ? "idea" : "ideas"}`,
  firstQuestion: "Add your first question.",
  addQuestion: "Add a question",
  addTypedQuestion: (typeLabel: string) => `Add ${typeLabel.toLowerCase()} question`,

  types: {
    SHORT_ANSWER: {
      label: "Short answer",
      description: "A sentence or two, checked against a model answer.",
    },
    KEY_IDEAS: {
      label: "Key ideas",
      description: "An explanation that must include specific ideas; Gemma tracks each one.",
    },
    ESSAY: {
      label: "Essay",
      description: "A longer argument, judged against your rubric.",
    },
    MULTIPLE_CHOICE: {
      label: "Multiple choice",
      description: "Students pick from options; marked exactly, no AI needed.",
    },
  },

  reference: {
    SHORT_ANSWER: {
      label: "Model answer",
      help: "What a complete answer says. Students never see it.",
      placeholder: "e.g. Because the treaty transferred sovereignty to…",
    },
    KEY_IDEAS: {
      label: "Model answer",
      help: "A full answer covering every idea. Students never see it.",
      placeholder: "e.g. Civil disobedience is public, non-violent law-breaking that…",
    },
    ESSAY: {
      label: "Rubric",
      help: "What a strong essay does, one point per line. Students never see it.",
      placeholder: "1. Takes a clear position.\n2. Gives a principled argument.\n3. Addresses a counterargument.",
    },
  },

  card: {
    question: (n: number) => `Question ${n}`,
    editQuestion: (n: number) => `Edit question ${n}`,
    dragToReorder: (n: number) => `Drag question ${n} to reorder`,
    untitled: "Untitled question",
    emptyOption: "Empty option",
    needsAttention: "Needs attention",
    promptPlaceholder: "Question",
    questionType: "Question type",
    points: "Points",
    mathTipLead: "Math: type",
    mathTipLatex: ", or LaTeX",
    moveUp: "Move up",
    moveUpLabel: "Move question up",
    moveDown: "Move down",
    moveDownLabel: "Move question down",
    duplicate: "Duplicate",
    duplicateLabel: "Duplicate question",
    deleteLabel: "Delete question",
  },

  ideas: {
    legend: "Key ideas",
    help: "Students see only “Idea 1”, “Idea 2”… and whether they have covered each one. The hint appears while an idea is still missing.",
    placeholder: "What the answer must say",
    hintLabel: (n: number) => `Hint for idea ${n}`,
    hintPlaceholder: "Hint for students (optional)",
    remove: "Remove idea",
    removeLabel: (n: number) => `Remove idea ${n}`,
    add: "+ Add idea",
  },

  options: {
    legend: "Options",
    help: "Tick the correct option. Tick several and students must choose all that apply. Students never see which are correct.",
    option: (n: number) => `Option ${n}`,
    isCorrectLabel: (n: number) => `Option ${n} is correct`,
    correct: "Correct answer",
    markCorrect: "Mark as correct",
    remove: "Remove option",
    removeLabel: (n: number) => `Remove option ${n}`,
    add: "+ Add option",
  },

  errors: {
    prompt: "* please write the question",
    points: "* 1–1000 points",
    reference: "* please add a model answer",
    rubric: "* please add a rubric",
    noIdeas: "* add at least one key idea",
    emptyIdea: "* describe this idea or remove it",
    tooFewOptions: "* add at least two options",
    noCorrectOption: "* tick the correct option",
    emptyOption: "* write this option or remove it",
  },
  tabs: { label: "Assignment view", questions: "Questions", students: "Students" },
};

export default { fr, en };
