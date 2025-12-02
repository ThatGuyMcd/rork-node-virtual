import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import { Colors, type ThemeColors } from '@/constants/colors';
import { dataSyncService } from '@/services/dataSync';
import { useColorScheme } from 'react-native';

export type ThemeName = 'light' | 'dark' | 'sunset' | 'ocean' | 'forest' | 'midnight' | 'rose' | 'custom';
export type ThemePreference = ThemeName | 'system';

interface ThemeContextType {
  theme: ThemeName;
  themePreference: ThemePreference;
  colors: ThemeColors;
  customColors: ThemeColors | null;
  setTheme: (theme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  setCustomColors: (colors: ThemeColors) => Promise<void>;
}

export const [ThemeProvider, useTheme] = createContextHook<ThemeContextType>(() => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [theme, setThemeState] = useState<ThemeName>('dark');
  const [customColors, setCustomColorsState] = useState<ThemeColors | null>(null);

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    if (themePreference === 'system') {
      setThemeState(systemColorScheme === 'light' ? 'light' : 'dark');
    }
  }, [systemColorScheme, themePreference]);

  const loadTheme = async () => {
    const savedTheme = await dataSyncService.getTheme();
    const savedPreference = await dataSyncService.getThemePreference();
    const savedCustomColors = await dataSyncService.getCustomThemeColors();
    
    if (savedCustomColors) {
      setCustomColorsState(savedCustomColors);
    }
    
    if (savedPreference === 'system') {
      setThemePreference('system');
      setThemeState(systemColorScheme === 'light' ? 'light' : 'dark');
    } else if (savedPreference === 'custom') {
      setThemePreference('custom');
      setThemeState('custom');
    } else {
      setThemePreference(savedTheme as ThemePreference);
      setThemeState(savedTheme as ThemeName);
    }
  };

  const setTheme = useCallback(async (newTheme: ThemePreference) => {
    setThemePreference(newTheme);
    await dataSyncService.setThemePreference(newTheme);
    
    if (newTheme === 'system') {
      const actualTheme = systemColorScheme === 'light' ? 'light' : 'dark';
      setThemeState(actualTheme);
      await dataSyncService.setTheme(actualTheme);
      console.log('[Theme] Theme preference set to system, using:', actualTheme);
    } else {
      setThemeState(newTheme as ThemeName);
      await dataSyncService.setTheme(newTheme);
      console.log('[Theme] Theme changed to:', newTheme);
    }
  }, [systemColorScheme]);

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await setTheme(newTheme);
  }, [theme, setTheme]);

  const setCustomColors = useCallback(async (colors: ThemeColors) => {
    setCustomColorsState(colors);
    await dataSyncService.setCustomThemeColors(colors);
    console.log('[Theme] Custom colors updated');
  }, []);

  const colors = theme === 'custom' && customColors ? customColors : (Colors[theme as keyof typeof Colors] || Colors.dark);

  return {
    theme,
    themePreference,
    colors,
    customColors,
    setTheme,
    toggleTheme,
    setCustomColors,
  };
});
