// Browser client for the backend API (see API.md). Same-origin requests to /api/*.

export type Role = "TEACHER" | "STUDENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: string;
}

/** Error carrying the backend's { error: { code, message, details } } envelope. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TOKEN_KEY = "webwrite.token";
const REFRESH_KEY = "webwrite.refreshToken";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveSession(token: string, refreshToken?: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch { /* storage blocked */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch { /* storage blocked */ }
}

export const hasSession = () => Boolean(read(TOKEN_KEY));

async function send(path: string, method: string, body?: unknown, token?: string | null) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? "INTERNAL_ERROR", err?.message ?? "Something went wrong", err?.details);
  }
  return data as T;
}

async function refresh(): Promise<boolean> {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return false;
  const res = await send("/api/auth/refresh", "POST", { refreshToken });
  if (!res.ok) return false;
  const data: { token: string } = await res.json();
  saveSession(data.token);
  return true;
}

/** Authenticated request; refreshes the access token once on 401. */
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let res = await send(path, method, body, read(TOKEN_KEY));
  if (res.status === 401 && (await refresh())) {
    res = await send(path, method, body, read(TOKEN_KEY));
  }
  return parse<T>(res);
}

export async function login(email: string, password: string): Promise<User> {
  const data = await parse<AuthResponse>(await send("/api/auth/login", "POST", { email, password }));
  saveSession(data.token, data.refreshToken);
  return data.user;
}

export async function register(input: { name: string; email: string; password: string; role: Role }): Promise<User> {
  const data = await parse<AuthResponse>(await send("/api/auth/register", "POST", input));
  saveSession(data.token, data.refreshToken);
  return data.user;
}

export async function logout() {
  await send("/api/auth/logout", "POST").catch(() => {});
  clearSession();
}

export const getMe = () => api<{ user: User }>("/api/auth/me").then((d) => d.user);

export const homeFor = (role: Role) => (role === "TEACHER" ? "/teacher" : "/student");
