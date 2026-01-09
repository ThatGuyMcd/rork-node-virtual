import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInactivity } from '@/contexts/InactivityContext';
import { useTheme } from '@/contexts/ThemeContext';

const NODE_VIRTUAL_LOGO_URI =
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aks991iz9extc1dtz2zq4';
const FALLBACK_LOGO_URI = 'https://images.unsplash.com/photo-1524666041070-9d87656c25bb?auto=format&fit=crop&w=800&q=80';

export const ScreensaverOverlay = memo(function ScreensaverOverlay() {
  const { isScreensaverActive, dismissScreensaver } = useInactivity();
  const { colors } = useTheme();

  const [logoLoadFailed, setLogoLoadFailed] = useState<boolean>(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    if (isScreensaverActive) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 10, tension: 90, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      scale.setValue(0.98);
    }
  }, [isScreensaverActive, opacity, scale]);

  const backgroundColor = useMemo(() => {
    const base = colors.background ?? '#0B0D12';
    return base;
  }, [colors.background]);

  const logoUri = useMemo(() => {
    return logoLoadFailed ? FALLBACK_LOGO_URI : NODE_VIRTUAL_LOGO_URI;
  }, [logoLoadFailed]);

  if (!isScreensaverActive) return null;

  return (
    <Pressable
      testID="screensaver-overlay"
      onPress={() => dismissScreensaver('tap')}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[styles.container, { backgroundColor, opacity }]}>
        <View style={styles.vignetteTop} pointerEvents="none" />
        <View style={styles.vignetteBottom} pointerEvents="none" />

        <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
          <View style={[styles.logoCard, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
            <Image
              testID="screensaver-logo"
              source={{ uri: logoUri }}
              resizeMode="contain"
              style={styles.logo}
              accessibilityLabel="NODE Virtual logo"
              onError={(e) => {
                console.log('[ScreensaverOverlay] Logo failed to load, falling back', {
                  uri: logoUri,
                  nativeEvent: e?.nativeEvent,
                });
                setLogoLoadFailed(true);
              }}
              onLoad={() => {
                console.log('[ScreensaverOverlay] Logo loaded', { uri: logoUri });
              }}
            />
          </View>

          <Text testID="screensaver-title" style={[styles.title, { color: colors.text }]}>NODE Virtual</Text>
          <Text testID="screensaver-subtitle" style={[styles.subtitle, { color: colors.textSecondary }]}>Tap to Start</Text>
          {Platform.OS === 'web' ? (
            <Text testID="screensaver-hint" style={[styles.hint, { color: colors.textTertiary }]}>Press any key or tap</Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logoCard: {
    width: 188,
    height: 188,
    borderRadius: 44,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  logo: {
    width: 132,
    height: 132,
  },
  title: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.95,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
  },
});
