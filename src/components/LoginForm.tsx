"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, clearSession, homeFor, login, register, type Role } from "@/lib/client/api";
import {
  cleanName,
  isValidEmail,
  isValidName,
  isValidNewPassword,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/client/validation";

type Mode = "login" | "register";
type Field = "name" | "email" | "password";
type Errors = Partial<Record<Field, string>>;

const ROLE_LABEL: Record<Role, string> = { STUDENT: "Student", TEACHER: "Professor" };

const MESSAGES = {
  name: "* your name is invalid",
  email: "* your email is invalid",
  passwordShort: `* your password must be at least ${PASSWORD_MIN} characters`,
  passwordEmpty: "* please enter your password",
};

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  const isRegister = mode === "register";

  function validate(field: Field, value: string): string {
    if (field === "name") return isValidName(value) ? "" : MESSAGES.name;
    if (field === "email") return isValidEmail(value) ? "" : MESSAGES.email;
    if (isRegister) return isValidNewPassword(value) ? "" : MESSAGES.passwordShort;
    return value ? "" : MESSAGES.passwordEmpty;
  }

  const setError = (field: Field, message: string) =>
    setErrors((prev) => ({ ...prev, [field]: message }));

  // Re-check live once an error is showing, so it clears as soon as it's fixed
  function onChange(field: Field, value: string, set: (v: string) => void) {
    set(value);
    if (errors[field]) setError(field, validate(field, value));
  }

  function onBlur(field: Field, value: string) {
    if (value) setError(field, validate(field, value));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setStatus("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("");

    const values: Record<Field, string> = { name, email, password };
    const fields: Field[] = isRegister ? ["name", "email", "password"] : ["email", "password"];
    const found: Errors = {};
    for (const f of fields) {
      const msg = validate(f, values[f]);
      if (msg) found[f] = msg;
    }
    setErrors(found);
    const firstBad = fields.find((f) => found[f]);
    if (firstBad) return refs[firstBad].current?.focus();

    setLoading(true);
    try {
      const user = isRegister
        ? await register({ name: cleanName(name), email: email.trim(), password, role })
        : await login(email.trim(), password);

      if (user.role !== role) {
        clearSession();
        setStatus(`This is a ${ROLE_LABEL[user.role].toLowerCase()} account. Switch to ${ROLE_LABEL[user.role]} to log in.`);
        return;
      }
      router.push(homeFor(user.role));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setStatus("Incorrect email or password.");
      else if (err instanceof ApiError && err.status === 409) setError("email", "* an account with this email already exists");
      else if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setStatus("Please check the fields above.");
      else setStatus("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-box">
      <h1 className="brand">WebWrite</h1>
      <p className="tagline">Humanities homework, guided by Gemma.</p>

      <div className="role-switch" role="radiogroup" aria-label={isRegister ? "Register as" : "Log in as"}>
        {(["STUDENT", "TEACHER"] as const).map((r) => (
          <label key={r} className={role === r ? "is-active" : undefined}>
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => { setRole(r); setStatus(""); }}
            />
            {ROLE_LABEL[r]}
          </label>
        ))}
        <span className={`role-thumb${role === "TEACHER" ? " is-right" : ""}`} aria-hidden="true" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        {isRegister && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              ref={refs.name}
              id="name"
              type="text"
              autoComplete="name"
              maxLength={NAME_MAX}
              spellCheck={false}
              value={name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby="name-error"
              onChange={(e) => onChange("name", e.target.value, setName)}
              onBlur={() => onBlur("name", name)}
            />
            <p className="error" id="name-error">{errors.name}</p>
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            ref={refs.email}
            id="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="email-error"
            onChange={(e) => onChange("email", e.target.value, setEmail)}
            onBlur={() => onBlur("email", email)}
          />
          <p className="error" id="email-error">{errors.email}</p>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            ref={refs.password}
            id="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            maxLength={PASSWORD_MAX}
            value={password}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="password-error"
            onChange={(e) => onChange("password", e.target.value, setPassword)}
            onBlur={() => onBlur("password", password)}
          />
          <p className="error" id="password-error">{errors.password}</p>
        </div>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "One moment…" : isRegister ? "Create account" : "Log in"}
        </button>
        <p className="form-status" role="status">{status}</p>
      </form>

      <p className="switch-mode">
        {isRegister ? "Already have an account? " : "New to WebWrite? "}
        <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")}>
          {isRegister ? "Log in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
