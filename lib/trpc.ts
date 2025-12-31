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
          
          const clonedResponse = response.clone();
          const contentType = response.headers.get('content-type');
          console.log("[TRPC] Response status:", response.status, "Content-Type:", contentType);
          
          const text = await clonedResponse.text();
          console.log("[TRPC] Response body (first 200 chars):", text.substring(0, 200));
          console.log("[TRPC] Response body (last 100 chars):", text.substring(Math.max(0, text.length - 100)));
          
          if (!response.ok || !contentType?.includes('application/json')) {
            console.error("[TRPC] Response issue - Status:", response.status, "Content-Type:", contentType);
            console.error("[TRPC] Full response body:", text);
          }
          
          return response;
        } catch (error) {
          console.error("[TRPC] Fetch error:", error);
          throw error;
        }
      },
    }),
  ],
});
