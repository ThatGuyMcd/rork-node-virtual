import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  console.warn("[TRPC] No EXPO_PUBLIC_RORK_API_BASE_URL found, using fallback URL");
  return "http://localhost:3000";
};

const baseUrl = getBaseUrl();
console.log("[TRPC] Initializing vanilla client with base URL:", baseUrl);

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${baseUrl}/api/trpc`,
      transformer: superjson,
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
        }).catch(error => {
          console.error("[TRPC] Fetch error:", error);
          throw error;
        });
      },
    }),
  ],
});
