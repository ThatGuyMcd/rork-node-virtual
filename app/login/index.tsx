import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';

import { useRouter } from 'expo-router';
import { Lock, RefreshCw } from 'lucide-react-native';
import { usePOS } from '@/contexts/POSContext';
import { useTheme } from '@/contexts/ThemeContext';
import { dataSyncService } from '@/services/dataSync';
import type { Operator } from '@/types/pos';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { login } = usePOS();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const shakeAnimation = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadOperators();
  }, []);

  const loadOperators = async () => {
    setLoading(true);
    try {
      const loadedOperators = await dataSyncService.getStoredOperators();
      setOperators(loadedOperators);
    } catch (error) {
      console.error('Failed to load operators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOperatorSelect = async (operator: Operator) => {
    if (!operator.pin || operator.pin.trim() === '') {
      await login(operator);
      router.replace('/(tabs)');
      return;
    }
    setSelectedOperator(operator);
    setPin('');
    setError('');
  };

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);

      if (newPin.length === 4 && selectedOperator) {
        handleLogin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleLogin = async (enteredPin: string) => {
    if (!selectedOperator) return;

    if (enteredPin === selectedOperator.pin) {
      await login(selectedOperator);
      router.replace('/(tabs)');
    } else {
      setError('Incorrect PIN');
      setPin('');
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.subtitle, { marginTop: 16, color: colors.textSecondary }]}>Loading operators...</Text>
        </View>
      </View>
    );
  }

  if (!selectedOperator) {
    if (operators.length === 0) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
          <View style={styles.header}>
            <RefreshCw size={48} color={colors.textTertiary} />
            <Text style={[styles.title, { color: colors.text }]}>No Operators</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sync your data to get started</Text>
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}
              onPress={() => {
                const guestOperator: Operator = {
                  id: 'guest',
                  name: 'Guest',
                  pin: '',
                  active: true,
                  isManager: false,
                };
                login(guestOperator).then(() => {
                  router.replace('/(tabs)/settings');
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsButtonText}>Go to Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <View style={styles.headerLogo}>
            <Image
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aks991iz9extc1dtz2zq4' }}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.text }]}>NODE Virtual</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Select your name to sign in</Text>
        </View>

        <ScrollView 
          style={styles.operatorScrollView}
          contentContainerStyle={styles.operatorScrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.operatorGrid}>
            {operators.map((operator) => (
              <TouchableOpacity
                key={operator.id}
                style={[styles.operatorCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => handleOperatorSelect(operator)}
                activeOpacity={0.7}
              >
                <View style={[styles.operatorAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.operatorInitial}>
                    {operator.name.charAt(0)}
                  </Text>
                </View>
                <Text style={[styles.operatorName, { color: colors.text }]}>{operator.name}</Text>
                {operator.isManager && (
                  <View style={[styles.managerBadge, { backgroundColor: colors.warning }]}>
                    <Text style={styles.managerText}>Manager</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setSelectedOperator(null)}
      >
        <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <ScrollView 
        style={styles.pinScrollView}
        contentContainerStyle={styles.pinScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pinContainer}>
          <View style={styles.operatorInfo}>
            <View style={[styles.operatorAvatarLarge, { backgroundColor: colors.primary }]}>
              <Text style={styles.operatorInitialLarge}>
                {selectedOperator.name.charAt(0)}
              </Text>
            </View>
            <Text style={[styles.operatorNameLarge, { color: colors.text }]}>{selectedOperator.name}</Text>
          </View>

          <View style={styles.lockIcon}>
            <Lock size={32} color={colors.textTertiary} />
          </View>

          <Text style={[styles.pinLabel, { color: colors.textSecondary }]}>Enter PIN</Text>

          <Animated.View
            style={[
              styles.pinDisplay,
              { transform: [{ translateX: shakeAnimation }] },
            ]}
          >
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  { borderColor: colors.border },
                  pin.length > index && [styles.pinDotFilled, { backgroundColor: colors.primary, borderColor: colors.primary }],
                  error && [styles.pinDotError, { borderColor: colors.error }],
                ]}
              />
            ))}
          </Animated.View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : (
            <View style={styles.errorPlaceholder} />
          )}

          <View style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <TouchableOpacity
                key={digit}
                style={[styles.keypadButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => handlePinPress(digit.toString())}
                activeOpacity={0.7}
              >
                <Text style={[styles.keypadText, { color: colors.text }]}>{digit}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.keypadButton} />
            <TouchableOpacity
              style={[styles.keypadButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => handlePinPress('0')}
              activeOpacity={0.7}
            >
              <Text style={[styles.keypadText, { color: colors.text }]}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keypadButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={handleBackspace}
              activeOpacity={0.7}
            >
              <Text style={[styles.keypadTextSecondary, { color: colors.textSecondary }]}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  operatorScrollView: {
    flex: 1,
  },
  operatorScrollContent: {
    paddingBottom: 40,
  },
  operatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 8,
  },
  operatorCard: {
    width: (width - 68) / 2,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  operatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  operatorInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  operatorName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  managerBadge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  managerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    marginTop: 40,
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pinScrollView: {
    flex: 1,
  },
  pinScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  pinContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 600,
  },
  operatorInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  operatorAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  operatorInitialLarge: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  operatorNameLarge: {
    fontSize: 20,
    fontWeight: '600',
  },
  lockIcon: {
    marginBottom: 16,
  },
  pinLabel: {
    fontSize: 16,
    marginBottom: 16,
  },
  pinDisplay: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  pinDotFilled: {},
  pinDotError: {},
  errorText: {
    fontSize: 14,
    height: 24,
    marginBottom: 24,
  },
  errorPlaceholder: {
    height: 48,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    gap: 16,
  },
  keypadButton: {
    width: 80,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  keypadText: {
    fontSize: 28,
    fontWeight: '600',
  },
  keypadTextSecondary: {
    fontSize: 24,
  },
  settingsButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
