import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import { Colors, type ThemeColors } from '@/constants/colors';
import { dataSyncService } from '@/services/dataSync';
import { useColorScheme } from 'react-native';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themePreference: 'light' | 'dark' | 'system';
  colors: ThemeColors;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const [ThemeProvider, useTheme] = createContextHook<ThemeContextType>(() => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    loadTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (themePreference === 'system') {
      setThemeState(systemColorScheme === 'light' ? 'light' : 'dark');
    }
  }, [systemColorScheme, themePreference]);

  const loadTheme = async () => {
    const savedTheme = await dataSyncService.getTheme();
    const savedPreference = await dataSyncService.getThemePreference();
    
    if (savedPreference === 'system') {
      setThemePreference('system');
      setThemeState(systemColorScheme === 'light' ? 'light' : 'dark');
    } else {
      setThemePreference(savedTheme);
      setThemeState(savedTheme);
    }
  };

  const setTheme = useCallback(async (newTheme: 'light' | 'dark' | 'system') => {
    setThemePreference(newTheme);
    await dataSyncService.setThemePreference(newTheme);
    
    if (newTheme === 'system') {
      const actualTheme = systemColorScheme === 'light' ? 'light' : 'dark';
      setThemeState(actualTheme);
      await dataSyncService.setTheme(actualTheme);
      console.log('[Theme] Theme preference set to system, using:', actualTheme);
    } else {
      setThemeState(newTheme);
      await dataSyncService.setTheme(newTheme);
      console.log('[Theme] Theme changed to:', newTheme);
    }
  }, [systemColorScheme]);

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await setTheme(newTheme);
  }, [theme, setTheme]);

  const colors = Colors[theme];

  return {
    theme,
    themePreference,
    colors,
    setTheme,
    toggleTheme,
  };
});
