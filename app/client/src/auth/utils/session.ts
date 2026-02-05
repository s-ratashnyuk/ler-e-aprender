import type { authApiResponse } from "../../types/authApiResponse";
import type { authSession } from "../../types/authSession";

let cachedSession: authSession | null | undefined;
let inflightRequest: Promise<authSession | null> | null = null;

const parseSessionResponse = (value: unknown): authSession | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as authApiResponse;
  if (typeof record.UserId !== "number" || typeof record.Email !== "string") {
    return null;
  }

  return { id: record.UserId, email: record.Email };
};

export const refreshAuthSession = async (): Promise<authSession | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  if (inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = (async (): Promise<authSession | null> => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        cachedSession = null;
        return null;
      }

      const data = (await response.json().catch(() => null)) as unknown;
      const parsed = parseSessionResponse(data);
      cachedSession = parsed;
      return parsed;
    } catch {
      cachedSession = null;
      return null;
    }
  })();

  try {
    return await inflightRequest;
  } finally {
    inflightRequest = null;
  }
};

export const primeAuthSession = (session: authSession | null): void => {
  cachedSession = session;
};

export const getCachedAuthSession = (): authSession | null | undefined => {
  return cachedSession;
};

export const clearAuthSession = (): void => {
  cachedSession = null;
};
