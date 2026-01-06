import { Tabs, Redirect } from 'expo-router';
import { ShoppingCart, Store, Settings, Search, LogOut, Printer } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, Image, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { usePOS } from '@/contexts/POSContext';
import { useTheme } from '@/contexts/ThemeContext';
import { printerService } from '@/services/printerService';

export default function TabLayout() {
  const { currentOperator, logout, isInitialSetupComplete, basket, calculateTotals } = usePOS();
  const { colors, theme } = useTheme();
  const [printerConnected, setPrinterConnected] = useState(false);

  useEffect(() => {
    const checkPrinterConnection = async () => {
      await printerService.loadSettings();
      const connected = printerService.isConnected();
      setPrinterConnected(connected);
    };
    checkPrinterConnection();
  }, []);

  if (!currentOperator) {
    return <Redirect href={"/login" as any} />;
  }

  const LogoutButton = () => (
    <TouchableOpacity
      onPress={logout}
      style={{ marginRight: 16 }}
      activeOpacity={0.7}
    >
      <LogOut size={24} color={colors.error} />
    </TouchableOpacity>
  );

  const handlePrintBill = async () => {
    if (!printerConnected) {
      Alert.alert('Printer Not Connected', 'Please connect a printer in settings.');
      return;
    }

    if (!currentOperator) {
      Alert.alert('Error', 'No operator logged in');
      return;
    }

    if (basket.length === 0) {
      Alert.alert('Error', 'Basket is empty');
      return;
    }

    const totals = calculateTotals();
    const billTransaction = {
      id: `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      operatorId: currentOperator.id,
      operatorName: currentOperator.name,
      tableId: undefined,
      tableName: undefined,
      items: [...basket],
      subtotal: totals.subtotal,
      vatBreakdown: totals.vatBreakdown,
      total: totals.total,
      tenderId: '',
      tenderName: 'BILL',
      paymentMethod: 'BILL',
      isRefund: basket.some(item => item.quantity < 0),
      discount: totals.discount > 0 ? totals.discount : undefined,
    };

    try {
      await printerService.printReceipt(billTransaction);
      Alert.alert('Success', 'Bill printed successfully');
    } catch (error) {
      console.error('[TabLayout] Failed to print bill:', error);
      Alert.alert('Print Error', 'Failed to print bill. Please check printer connection.');
    }
  };

  const BasketHeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginRight: 8 }}>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          padding: 8,
          paddingHorizontal: 10,
          borderRadius: 8,
          borderWidth: 2,
          borderStyle: printerConnected ? 'solid' : 'dotted',
          borderColor: printerConnected ? colors.primary : colors.border,
          backgroundColor: colors.cardBackground,
          alignItems: 'center',
          gap: 6,
        }}
        onPress={handlePrintBill}
        activeOpacity={printerConnected ? 0.7 : 1}
        disabled={!printerConnected}
      >
        <Printer size={20} color={printerConnected ? colors.primary : colors.textTertiary} />
        <View>
          <Text style={{
            fontSize: 10,
            fontWeight: '600',
            color: printerConnected ? colors.primary : colors.textTertiary,
            lineHeight: 11,
          }}>Print</Text>
          <Text style={{
            fontSize: 10,
            fontWeight: '600',
            color: printerConnected ? colors.primary : colors.textTertiary,
            lineHeight: 11,
          }}>Bill</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={logout}
        style={{ marginRight: 8 }}
        activeOpacity={0.7}
      >
        <LogOut size={24} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  const showSettings = currentOperator?.isManager || !isInitialSetupComplete;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: colors.primary,
          borderTopWidth: 2,
          height: 90,
          paddingBottom: 25,
          paddingTop: 8,
          position: 'absolute',
        },
        tabBarBackground: () => {
          const isLightTheme = theme === 'light' || theme.includes('Light');
          return (
            <BlurView
              intensity={80}
              tint={isLightTheme ? 'light' : 'dark'}
              style={{ flex: 1, backgroundColor: colors.tabBarBackground }}
            />
          );
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: colors.cardBackground,
          borderBottomColor: colors.primary,
          borderBottomWidth: 2,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerRight: () => <LogoutButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => <Store size={size} color={color} />,
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aks991iz9extc1dtz2zq4' }}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>NODE Virtual</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aks991iz9extc1dtz2zq4' }}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>NODE Virtual</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          title: 'Basket',
          tabBarIcon: ({ color, size }) => (
            <View>
              <ShoppingCart size={size} color={color} />
              {basket.length > 0 && (
                <View style={{
                  position: 'absolute',
                  right: -8,
                  top: -4,
                  backgroundColor: colors.error,
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: '700',
                  }}>
                    {basket.length}
                  </Text>
                </View>
              )}
            </View>
          ),
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aks991iz9extc1dtz2zq4' }}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>NODE Virtual</Text>
            </View>
          ),
          headerRight: () => <BasketHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          href: showSettings ? '/(tabs)/settings' as any : null,
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aks991iz9extc1dtz2zq4' }}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>NODE Virtual</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: null,
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aks991iz9extc1dtz2zq4' }}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>NODE Virtual</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
