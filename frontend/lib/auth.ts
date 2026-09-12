// Token storage + JWT helpers.
// The backend issues a single access token (8h expiry). Per architecture.md,
// we store it in localStorage (no cookie — cross-origin Vercel↔Render).
// When the user sets up a real refresh flow you can swap the storage here.

export type Role = "ORGANIZER" | "STAFF";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  role: Role;
  exp: number;
  iat: number;
}

const TOKEN_KEY = "eb_access_token";
const USER_KEY = "eb_user";

export function saveAuth(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Decode the JWT payload without verifying the signature (client-side only). */
export function decodeToken(token: string): AuthTokenPayload | null {
  try {
    const [, payloadB64] = token.split(".");
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  return Date.now() / 1000 > payload.exp;
}
