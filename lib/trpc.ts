import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (apiBaseUrl) {
    console.log("[TRPC] Using EXPO_PUBLIC_RORK_API_BASE_URL:", apiBaseUrl);
    return apiBaseUrl;
  }
  console.warn("[TRPC] EXPO_PUBLIC_RORK_API_BASE_URL not set, falling back to localhost");
  return "http://localhost:3000";
};

const baseUrl = getBaseUrl();
console.log("[TRPC] Initializing vanilla client with base URL:", baseUrl);

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${baseUrl}/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        console.log("[TRPC] Fetching:", url);
        try {
          const response = await fetch(url, {
            ...options,
          });
          
          const contentType = response.headers.get('content-type');
          
          if (!response.ok) {
            console.log(' GET', url, response.status, `(${response.statusText})`);
            console.error('[TRPC] Response issue - Status:', response.status, 'Content-Type:', contentType || 'unknown');
            
            if (!contentType?.includes('application/json')) {
              const textBody = await response.text();
              console.error('[TRPC] Response status:', response.status, 'Content-Type:', contentType || 'text/plain');
              console.error('[TRPC] Response body (first 200 chars):', textBody.substring(0, 200));
              console.error('[TRPC] Response body (last 100 chars):', textBody.substring(Math.max(0, textBody.length - 100)));
              console.error('[TRPC] Full response body:', textBody);
              
              const errorBody = JSON.stringify({
                error: {
                  message: `Server returned ${response.status}: ${textBody}`,
                  data: {
                    code: 'INTERNAL_SERVER_ERROR',
                    httpStatus: response.status,
                  },
                },
              });
              
              return new Response(errorBody, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                  'content-type': 'application/json',
                },
              });
            }
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
