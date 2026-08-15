export const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] || "http://localhost:5000/api";

export interface PublicUser {
  id: string;
  clerkUserId: string;
  username: string;
}

export interface MeResponse {
  authenticated: true;
  user: PublicUser | null;
  onboardingComplete: boolean;
}

export interface ProfileResponse {
  user: PublicUser;
}

export interface ApiError {
  message: string;
  authenticated?: boolean;
}