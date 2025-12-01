import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
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

let trpcClientInstance: ReturnType<typeof trpc.createClient> | null = null;

const createTRPCClient = () => {
  if (trpcClientInstance) return trpcClientInstance;
  
  try {
    const baseUrl = getBaseUrl();
    console.log("[TRPC] Initializing client with base URL:", baseUrl);
    
    trpcClientInstance = trpc.createClient({
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
    
    return trpcClientInstance;
  } catch (error) {
    console.error("[TRPC] Failed to initialize client:", error);
    throw error;
  }
};

export const trpcClient = createTRPCClient();
