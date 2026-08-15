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

export interface CreateProfileBody {
  username?: unknown;
}