export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// The session token from sign-in. Kept in localStorage so a refresh stays signed in.
const TOKEN_KEY = "cgs.token";
let token: string | null | undefined;
const tokenListeners = new Set<() => void>();

export function getToken(): string | null {
  if (token === undefined) {
    try {
      token = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
  }
  return token;
}

export function setToken(t: string | null) {
  if (t === getToken()) return;
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private window: signed in for this tab only */
  }
  tokenListeners.forEach((l) => l());
}

export function onTokenChange(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(API_URL + path, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    // Session expired or the backend was reseeded: drop the token and let the app send you to sign-in.
    if (res.status === 401 && !path.startsWith("/auth/sign")) setToken(null);
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, "")).join(". ") : JSON.stringify(j.detail);
    } catch {
      /* keep status text */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
