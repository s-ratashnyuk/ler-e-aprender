import type { authSession } from "../../types/authSession";

const STORAGE_KEY = "reader-auth-session";

export const readAuthSession = (): authSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as authSession;
    if (typeof parsed?.id === "number" && typeof parsed?.email === "string") {
      return parsed;
    }
  } catch {
    // ignore invalid data
  }

  return null;
};

export const writeAuthSession = (session: authSession): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearAuthSession = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};
