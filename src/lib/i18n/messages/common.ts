// Strings shared across the app. French (Quebec) is the source; English must match its shape.

const fr = {
  appName: "WebWrite",
  tagline: "Des devoirs en sciences humaines, guidés par Gemma.",
  metaDescription: "Des devoirs en sciences humaines avec de la rétroaction guidée par Gemma.",
  language: {
    label: "Langue",
    switchTo: "English",
    switchToLabel: "Switch to English",
  },
  actions: {
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    close: "Fermer",
    delete: "Supprimer",
    edit: "Modifier",
    back: "Retour",
    retry: "Réessayer",
    copy: "Copier",
    copied: "Copié!",
    logout: "Se déconnecter",
  },
  status: {
    loading: "Chargement…",
    oneMoment: "Un instant…",
    genericError: "Une erreur s'est produite. Veuillez réessayer.",
    networkError: "Impossible de joindre le serveur. Veuillez réessayer.",
  },
  roles: { STUDENT: "Étudiant", TEACHER: "Professeur" },
  assignmentStatus: { CREATED: "Brouillon", POSTED: "Publié", CLOSED: "Fermé" },
  idea: (n: number) => `Idée ${n}`,
  percent: (n: number) => `${n} %`,
  ideaStatus: {
    not_completed: "Pas encore abordée",
    in_progress: "En cours",
    included: "Incluse",
  },
  sort: {
    soonest: "Date de remise : la plus proche d'abord",
    latest: "Date de remise : la plus éloignée d'abord",
    label: (soonest: boolean) =>
      `Trié par date de remise, ${soonest ? "la plus proche" : "la plus éloignée"} d'abord. Cliquez pour inverser.`,
  },
  credits: {
    link: "Crédits photo",
    title: "Crédits photo",
    pageTitle: "Crédits photo · WebWrite",
    intro: "Photos tirées de Wikimedia Commons, redimensionnées pour la page de connexion.",
    by: "par",
  },
  galleryEmpty: "Ajoutez des photos dans",
  mathPreview: { label: "Aperçu", aria: "Aperçu du rendu" },
};

const en: typeof fr = {
  appName: "WebWrite",
  tagline: "Humanities homework, guided by Gemma.",
  metaDescription: "Humanities homework with guided feedback from Gemma.",
  language: {
    label: "Language",
    switchTo: "Français",
    switchToLabel: "Passer au français",
  },
  actions: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    retry: "Try again",
    copy: "Copy",
    copied: "Copied!",
    logout: "Log out",
  },
  status: {
    loading: "Loading…",
    oneMoment: "One moment…",
    genericError: "Something went wrong. Please try again.",
    networkError: "Couldn't reach the server. Please try again.",
  },
  roles: { STUDENT: "Student", TEACHER: "Professor" },
  assignmentStatus: { CREATED: "Created", POSTED: "Posted", CLOSED: "Closed" },
  idea: (n: number) => `Idea ${n}`,
  percent: (n: number) => `${n}%`,
  ideaStatus: {
    not_completed: "Not yet covered",
    in_progress: "In progress",
    included: "Included",
  },
  sort: {
    soonest: "Due date: soonest first",
    latest: "Due date: latest first",
    label: (soonest: boolean) =>
      `Sorted by due date, ${soonest ? "soonest" : "latest"} first. Click to reverse.`,
  },
  credits: {
    link: "Photo credits",
    title: "Photo credits",
    pageTitle: "Photo credits · WebWrite",
    intro: "Photos from Wikimedia Commons, resized for the login page.",
    by: "by",
  },
  galleryEmpty: "Add photos to",
  mathPreview: { label: "Preview", aria: "Rendered preview" },
};

export default { fr, en };
