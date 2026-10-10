"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, clearSession, homeFor, login, register, type Role } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
// Errors and status are stored as kinds and turned into text at render time, so
// they follow the language if it's switched while one is showing.
type ErrorKind = "name" | "email" | "passwordShort" | "passwordEmpty" | "emailTaken";
type Errors = Partial<Record<Field, ErrorKind>>;
type Status =
  | { kind: "wrongCredentials" | "checkFields" | "networkError" }
  | { kind: "wrongRole"; role: Role }
  | null;

export default function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const tl = t.login;
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  const isRegister = mode === "register";

  function validate(field: Field, value: string): ErrorKind | undefined {
    if (field === "name") return isValidName(value) ? undefined : "name";
    if (field === "email") return isValidEmail(value) ? undefined : "email";
    if (isRegister) return isValidNewPassword(value) ? undefined : "passwordShort";
    return value ? undefined : "passwordEmpty";
  }

  const errorText = (kind: ErrorKind | undefined) =>
    kind === undefined ? "" : kind === "passwordShort" ? tl.errors.passwordShort(PASSWORD_MIN) : tl.errors[kind];

  function statusText(s: Status) {
    if (!s) return "";
    if (s.kind === "wrongRole") return tl.status.wrongRole(t.common.roles[s.role]);
    if (s.kind === "networkError") return t.common.status.networkError;
    return tl.status[s.kind];
  }

  const setError = (field: Field, kind: ErrorKind | undefined) =>
    setErrors((prev) => ({ ...prev, [field]: kind }));

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
    setStatus(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);

    const values: Record<Field, string> = { name, email, password };
    const fields: Field[] = isRegister ? ["name", "email", "password"] : ["email", "password"];
    const found: Errors = {};
    for (const f of fields) {
      const kind = validate(f, values[f]);
      if (kind) found[f] = kind;
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
        setStatus({ kind: "wrongRole", role: user.role });
        return;
      }
      router.push(homeFor(user.role));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setStatus({ kind: "wrongCredentials" });
      else if (err instanceof ApiError && err.status === 409) setError("email", "emailTaken");
      else if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setStatus({ kind: "checkFields" });
      else setStatus({ kind: "networkError" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-box">
      <h1 className="brand">{t.common.appName}</h1>
      <p className="tagline">{t.common.tagline}</p>

      <div className="role-switch" role="radiogroup" aria-label={isRegister ? tl.registerAs : tl.logInAs}>
        {(["STUDENT", "TEACHER"] as const).map((r) => (
          <label key={r} className={role === r ? "is-active" : undefined}>
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => { setRole(r); setStatus(null); }}
            />
            {t.common.roles[r]}
          </label>
        ))}
        <span className={`role-thumb${role === "TEACHER" ? " is-right" : ""}`} aria-hidden="true" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        {isRegister && (
          <div className="field">
            <label htmlFor="name">{tl.fullName}</label>
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
            <p className="error" id="name-error">{errorText(errors.name)}</p>
          </div>
        )}

        <div className="field">
          <label htmlFor="email">{tl.email}</label>
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
          <p className="error" id="email-error">{errorText(errors.email)}</p>
        </div>

        <div className="field">
          <label htmlFor="password">{tl.password}</label>
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
          <p className="error" id="password-error">{errorText(errors.password)}</p>
        </div>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? t.common.status.oneMoment : isRegister ? tl.createAccount : tl.logIn}
        </button>
        <p className="form-status" role="status">{statusText(status)}</p>
      </form>

      <p className="switch-mode">
        {isRegister ? tl.haveAccount : tl.newHere}{" "}
        <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")}>
          {isRegister ? tl.logIn : tl.createAnAccount}
        </button>
      </p>
    </div>
  );
}
