import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import React, { useCallback, useEffect } from "react";
import { Platform, Pressable, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { POSProvider } from "@/contexts/POSContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { InactivityProvider, useInactivity } from "@/contexts/InactivityContext";
import { ScreensaverOverlay } from "@/components/ScreensaverOverlay";
import { trpc, trpcClient } from "@/lib/trpc";
import { dataSyncService } from "@/services/dataSync";

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

function GlobalInactivityLayer() {
  const { registerActivity } = useInactivity();

  const onAnyPress = useCallback(() => {
    registerActivity('global-press');
  }, [registerActivity]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = () => {
      registerActivity('web-window-activity');
    };

    window.addEventListener('mousemove', handler);
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', handler);
    window.addEventListener('touchstart', handler);
    window.addEventListener('wheel', handler);

    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('wheel', handler);
    };
  }, [registerActivity]);

  return (
    <Pressable testID="global-activity-capture" style={{ flex: 1 }} onPress={onAnyPress}>
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <RootLayoutNav />
        <ScreensaverOverlay />
      </View>
    </Pressable>
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

  useEffect(() => {
    const checkAndAutoSync = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const syncInterval = await dataSyncService.getBackgroundSyncInterval();
        if (syncInterval === 'disabled') {
          console.log('[App] Auto-sync is disabled');
          return;
        }

        const lastSyncTime = await dataSyncService.getLastSyncTime();
        if (!lastSyncTime) {
          console.log('[App] No previous sync found, skipping auto-sync');
          return;
        }

        const lastSyncDate = new Date(lastSyncTime);
        const now = new Date();
        const hoursSinceSync = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60);
        const intervalHours = parseInt(syncInterval);

        console.log(`[App] Last sync: ${hoursSinceSync.toFixed(1)} hours ago, interval: ${intervalHours} hours`);

        if (hoursSinceSync >= intervalHours) {
          console.log(`[App] Auto-sync triggered: ${hoursSinceSync.toFixed(1)}h >= ${intervalHours}h`);
          await dataSyncService.syncData(undefined, false);
          console.log('[App] Auto-sync completed successfully');
        } else {
          console.log(`[App] Auto-sync not needed: ${hoursSinceSync.toFixed(1)}h < ${intervalHours}h`);
        }
      } catch (error) {
        console.error('[App] Auto-sync failed:', error);
      }
    };

    const timeoutId = setTimeout(() => {
      console.log('[App] Starting delayed auto-sync check...');
      checkAndAutoSync();
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <InactivityProvider>
            <POSProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <GlobalInactivityLayer />
              </GestureHandlerRootView>
            </POSProvider>
          </InactivityProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
