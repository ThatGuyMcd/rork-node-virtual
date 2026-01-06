import { Platform } from "react-native";
import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = (): string => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  if (apiBaseUrl) {
    console.log("[TRPC] Using API base URL:", apiBaseUrl);
    return apiBaseUrl;
  }

  if (Platform.OS === "web") {
    console.log("[TRPC] Web platform - using relative URLs");
    return "";
  }

  console.log("[TRPC] Native platform - using localhost");
  return "http://localhost:3000";
};

const createTrpcClientInstance = () => {
  const baseUrl = getBaseUrl();
  const trpcUrl = `${baseUrl}/trpc`;
  console.log("[TRPC] Client URL:", trpcUrl);
  
  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: trpcUrl,
        transformer: superjson,
        fetch: async (url, options) => {
          console.log("[TRPC] Request:", options?.method || 'GET', url);
          
          try {
            const response = await fetch(url, {
              ...options,
              signal: AbortSignal.timeout(60000),
            });
            
            console.log("[TRPC] Response:", response.status, response.statusText);
            
            if (!response.ok) {
              const contentType = response.headers.get('content-type');
              if (!contentType?.includes('application/json')) {
                const textBody = await response.text();
                console.error('[TRPC] Non-JSON error response:', textBody.substring(0, 200));
                
                return new Response(JSON.stringify({
                  error: {
                    message: `Server error ${response.status}`,
                    data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: response.status },
                  },
                }), {
                  status: response.status,
                  headers: { 'content-type': 'application/json' },
                });
              }
            }
            
            return response;
          } catch (error: any) {
            console.error("[TRPC] Request failed:", error.message);
            throw error;
          }
        },
      }),
    ],
  });
};

export const trpcClient = createTrpcClientInstance();
