import { Tabs, Redirect } from 'expo-router';
import { ShoppingCart, Store, Settings, Search, LogOut } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View, Text, Image } from 'react-native';
import { usePOS } from '@/contexts/POSContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { currentOperator, logout, isInitialSetupComplete } = usePOS();
  const { colors } = useTheme();

  if (!currentOperator) {
    return <Redirect href="/login" />;
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

  const showSettings = currentOperator?.isManager || !isInitialSetupComplete;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.border,
          height: 90,
          paddingBottom: 25,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: colors.headerBackground,
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
          tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
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
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          href: showSettings ? '/settings' : null,
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
