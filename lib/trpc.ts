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
      fetch: async (url, options) => {
        console.log("[TRPC] Fetching:", url);
        try {
          const response = await fetch(url, {
            ...options,
          });
          
          const contentType = response.headers.get('content-type');
          
          if (!response.ok || !contentType?.includes('application/json')) {
            console.warn("[TRPC] Non-JSON or error response - Status:", response.status, "Content-Type:", contentType);
            if (response.status === 404) {
              console.warn("[TRPC] Endpoint not found (404) - this may be expected during development");
            }
          }
          
          return response;
        } catch (error) {
          console.warn("[TRPC] Fetch error:", error);
          throw error;
        }
      },
    }),
  ],
});
