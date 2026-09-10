const apiBaseUrl =
  import.meta.env["VITE_API_BASE_URL"] || "http://localhost:5000/api";

export const clientConfig = {
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
  socketUrl: apiBaseUrl.replace(/\/api\/?$/, ""),
  clerkPublishableKey: import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] || "",
} as const;
