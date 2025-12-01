import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { POSProvider } from "@/contexts/POSContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('[App] Starting app initialization...');
        if (!__DEV__) {
          try {
            console.log('[App] Checking for updates...');
            await Updates.checkForUpdateAsync();
            console.log('[App] Update check completed');
          } catch (updateError) {
            console.error('[App] Update check failed:', updateError);
          }
        }
      } catch (e) {
        console.error('[App] App initialization error:', e);
      } finally {
        console.log('[App] Hiding splash screen...');
        try {
          await SplashScreen.hideAsync();
          console.log('[App] Splash screen hidden successfully');
        } catch (splashError) {
          console.error('[App] Failed to hide splash screen:', splashError);
        }
      }
    };

    setTimeout(() => {
      console.log('[App] Starting initialization with timeout...');
      initApp();
    }, 100);
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <POSProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </POSProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
