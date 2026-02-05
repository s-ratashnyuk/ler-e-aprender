import type { authApiRequest } from "../../types/authApiRequest";
import type { authApiResponse } from "../../types/authApiResponse";
import type { authSession } from "../../types/authSession";

const request = async (path: string, payload: authApiRequest): Promise<authSession> => {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = (await response.json().catch(() => null)) as
    | authApiResponse
    | { Error?: string }
    | null;

  if (!response.ok) {
    const message = data && "Error" in data && data.Error ? data.Error : "Auth failed.";
    throw new Error(message);
  }

  if (!data || typeof (data as authApiResponse).UserId !== "number") {
    throw new Error("Unexpected auth response.");
  }

  return {
    id: (data as authApiResponse).UserId,
    email: (data as authApiResponse).Email
  };
};

export const signup = async (payload: authApiRequest): Promise<authSession> => {
  return request("/api/auth/signup", payload);
};

export const login = async (payload: authApiRequest): Promise<authSession> => {
  return request("/api/auth/login", payload);
};
