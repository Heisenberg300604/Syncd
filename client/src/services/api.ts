import type { ApiError, MeResponse, ProfileResponse } from "./types";

export const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] || "http://localhost:5000/api";

type GetToken = () => Promise<string | null>;

async function request<T>(
  path: string,
  getToken: GetToken,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  let body: unknown;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const error = (body ?? {}) as ApiError;
    const message = typeof error === "string" ? error : (error.message ?? "Request failed");
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return body as T;
}

export function getMe(getToken: GetToken): Promise<MeResponse> {
  return request<MeResponse>("/me", getToken, { method: "GET" });
}

export function createProfile(
  getToken: GetToken,
  username: string,
): Promise<ProfileResponse> {
  return request<ProfileResponse>("/users/profile", getToken, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}