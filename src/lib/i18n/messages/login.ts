// Login / registration page.

const fr = {
  logInAs: "Se connecter en tant que",
  registerAs: "S'inscrire en tant que",
  fullName: "Nom complet",
  email: "Courriel",
  password: "Mot de passe",
  logIn: "Se connecter",
  createAccount: "Créer le compte",
  haveAccount: "Vous avez déjà un compte?",
  newHere: "Nouveau sur WebWrite?",
  createAnAccount: "Créer un compte",
  errors: {
    name: "* votre nom n'est pas valide",
    email: "* votre courriel n'est pas valide",
    passwordShort: (min: number) => `* votre mot de passe doit contenir au moins ${min} caractères`,
    passwordEmpty: "* veuillez entrer votre mot de passe",
    emailTaken: "* un compte existe déjà avec ce courriel",
  },
  status: {
    wrongCredentials: "Courriel ou mot de passe incorrect.",
    checkFields: "Veuillez vérifier les champs ci-dessus.",
    wrongRole: (accountRole: string) =>
      `Ce compte est un compte ${accountRole.toLowerCase()}. Choisissez « ${accountRole} » pour vous connecter.`,
  },
};

const en: typeof fr = {
  logInAs: "Log in as",
  registerAs: "Register as",
  fullName: "Full name",
  email: "Email",
  password: "Password",
  logIn: "Log in",
  createAccount: "Create account",
  haveAccount: "Already have an account?",
  newHere: "New to WebWrite?",
  createAnAccount: "Create an account",
  errors: {
    name: "* your name is invalid",
    email: "* your email is invalid",
    passwordShort: (min: number) => `* your password must be at least ${min} characters`,
    passwordEmpty: "* please enter your password",
    emailTaken: "* an account with this email already exists",
  },
  status: {
    wrongCredentials: "Incorrect email or password.",
    checkFields: "Please check the fields above.",
    wrongRole: (accountRole: string) =>
      `This is a ${accountRole.toLowerCase()} account. Switch to ${accountRole} to log in.`,
  },
};

export default { fr, en };
