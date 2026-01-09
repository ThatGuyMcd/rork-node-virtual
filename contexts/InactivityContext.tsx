import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

interface InactivityContextType {
  isScreensaverActive: boolean;
  lastActivityAt: number;
  registerActivity: (reason?: string) => void;
  dismissScreensaver: (reason?: string) => void;
  setTimeoutMs: (timeoutMs: number) => void;
  timeoutMs: number;
}

export const [InactivityProvider, useInactivity] = createContextHook<InactivityContextType>(() => {
  const [timeoutMs, setTimeoutMsState] = useState<number>(DEFAULT_TIMEOUT_MS);
  const [lastActivityAt, setLastActivityAt] = useState<number>(() => Date.now());
  const [isScreensaverActive, setIsScreensaverActive] = useState<boolean>(false);

  const lastLogAtRef = useRef<number>(0);

  const log = useCallback((message: string, extra?: Record<string, unknown>) => {
    const now = Date.now();
    if (now - lastLogAtRef.current > 2500) {
      lastLogAtRef.current = now;
      console.log(`[Inactivity] ${message}`, extra ?? '');
    }
  }, []);

  const registerActivity = useCallback((reason?: string) => {
    const now = Date.now();
    setLastActivityAt(now);
    if (isScreensaverActive) {
      setIsScreensaverActive(false);
      console.log('[Inactivity] Screensaver dismissed due to activity', { reason: reason ?? 'unknown' });
    } else {
      log('Activity', { reason: reason ?? 'unknown' });
    }
  }, [isScreensaverActive, log]);

  const dismissScreensaver = useCallback((reason?: string) => {
    setIsScreensaverActive(false);
    setLastActivityAt(Date.now());
    console.log('[Inactivity] Screensaver dismissed', { reason: reason ?? 'tap' });
  }, []);

  const setTimeoutMs = useCallback((ms: number) => {
    const next = Number.isFinite(ms) && ms > 1000 ? ms : DEFAULT_TIMEOUT_MS;
    setTimeoutMsState(next);
    console.log('[Inactivity] Timeout updated', { timeoutMs: next });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const idleFor = now - lastActivityAt;
      if (!isScreensaverActive && idleFor >= timeoutMs) {
        setIsScreensaverActive(true);
        console.log('[Inactivity] Screensaver activated', { idleForMs: idleFor, timeoutMs });
      }
    }, 1000);

    return () => clearInterval(id);
  }, [isScreensaverActive, lastActivityAt, timeoutMs]);

  return useMemo(() => {
    return {
      isScreensaverActive,
      lastActivityAt,
      registerActivity,
      dismissScreensaver,
      setTimeoutMs,
      timeoutMs,
    };
  }, [dismissScreensaver, isScreensaverActive, lastActivityAt, registerActivity, setTimeoutMs, timeoutMs]);
});
