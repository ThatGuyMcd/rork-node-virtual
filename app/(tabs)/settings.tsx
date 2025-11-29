import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  StatusBar,
} from 'react-native';

import { RefreshCw, LogIn, Database, Trash2, Settings as SettingsIcon, LayoutGrid, Layers, Sun, Moon, Palette, MonitorSmartphone, CheckCircle, CreditCard, ChevronDown, Filter, Eye, EyeOff, AlertTriangle } from 'lucide-react-native';
import { dataSyncService, type SyncProgress } from '@/services/dataSync';
import type { ProductDisplaySettings, ProductGroup, Department } from '@/types/pos';
import { usePOS } from '@/contexts/POSContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [siteInfo, setSiteInfo] = useState<{ siteId: string; siteName: string } | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [tableSelectionRequired, setTableSelectionRequired] = useState(false);
  const [productViewLayout, setProductViewLayout] = useState<'compact' | 'standard' | 'large'>('standard');
  const [productViewMode, setProductViewMode] = useState<'group-department' | 'all-departments' | 'all-items'>('group-department');
  const { updateTableSelectionRequired, updateProductViewLayout, updateProductViewMode, isInitialSetupComplete, completeInitialSetup, cardPaymentEnabled, cashPaymentEnabled, cardMachineProvider, splitPaymentsEnabled, updateCardPaymentEnabled, updateCashPaymentEnabled, updateCardMachineProvider, updateSplitPaymentsEnabled } = usePOS();
  const { theme, themePreference, colors, setTheme } = useTheme();


  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [productSettings, setProductSettings] = useState<ProductDisplaySettings>({
    hiddenGroupIds: [],
    hiddenDepartmentIds: [],
    sortOrder: 'filename',
  });
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    loadSiteInfo();
    loadSavedCredentials();
    loadTableSelectionSetting();
    loadProductViewLayout();
    loadProductViewMode();
    loadProductSettings();
    loadProductData();
  }, []);

  const loadSiteInfo = async () => {
    const info = await dataSyncService.getSiteInfo();
    setSiteInfo(info);
  };

  const loadSavedCredentials = async () => {
    const creds = await dataSyncService.getSavedCredentials();
    if (creds) {
      setUsername(creds.username);
      setPassword(creds.password);
      setRemember(true);
    }
  };

  const loadTableSelectionSetting = async () => {
    const required = await dataSyncService.getTableSelectionRequired();
    setTableSelectionRequired(required);
  };

  const loadProductViewLayout = async () => {
    const layout = await dataSyncService.getProductViewLayout();
    setProductViewLayout(layout);
  };

  const loadProductViewMode = async () => {
    const mode = await dataSyncService.getProductViewMode();
    setProductViewMode(mode);
  };

  const loadProductSettings = async () => {
    const settings = await dataSyncService.getProductDisplaySettings();
    setProductSettings(settings);
  };

  const loadProductData = async () => {
    const loadedGroups = await dataSyncService.getStoredGroups();
    const loadedDepartments = await dataSyncService.getStoredDepartments();
    setGroups(loadedGroups);
    setDepartments(loadedDepartments);
    setHasData(loadedGroups.length > 0);
  };

  const toggleGroupVisibility = async (groupId: string) => {
    const newSettings = { ...productSettings };
    if (newSettings.hiddenGroupIds.includes(groupId)) {
      newSettings.hiddenGroupIds = newSettings.hiddenGroupIds.filter(id => id !== groupId);
    } else {
      newSettings.hiddenGroupIds.push(groupId);
    }
    setProductSettings(newSettings);
    await dataSyncService.setProductDisplaySettings(newSettings);
  };

  const toggleDepartmentVisibility = async (departmentId: string) => {
    const newSettings = { ...productSettings };
    if (newSettings.hiddenDepartmentIds.includes(departmentId)) {
      newSettings.hiddenDepartmentIds = newSettings.hiddenDepartmentIds.filter(id => id !== departmentId);
    } else {
      newSettings.hiddenDepartmentIds.push(departmentId);
    }
    setProductSettings(newSettings);
    await dataSyncService.setProductDisplaySettings(newSettings);
  };

  const changeSortOrder = async (sortOrder: 'filename' | 'alphabetical' | 'custom') => {
    const newSettings = { ...productSettings, sortOrder };
    setProductSettings(newSettings);
    await dataSyncService.setProductDisplaySettings(newSettings);
  };

  const handleTableSelectionToggle = async (value: boolean) => {
    setTableSelectionRequired(value);
    await dataSyncService.setTableSelectionRequired(value);
    updateTableSelectionRequired(value);
  };

  const handleProductViewLayoutChange = async (layout: 'compact' | 'standard' | 'large') => {
    setProductViewLayout(layout);
    await updateProductViewLayout(layout);
  };

  const handleProductViewModeChange = async (mode: 'group-department' | 'all-departments' | 'all-items') => {
    setProductViewMode(mode);
    await updateProductViewMode(mode);
  };

  const handleLink = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your username and password');
      return;
    }

    setIsLinking(true);
    try {
      const result = await dataSyncService.linkAccount(username, password, remember);
      setSiteInfo({ siteId: result.siteId, siteName: result.siteName });
      Alert.alert('Success', `Linked to site: ${result.siteName}`);
    } catch (error) {
      console.error('Link error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to link account');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSync = async () => {
    if (!siteInfo) {
      Alert.alert('Error', 'Please link your account first');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(null);

    try {
      await dataSyncService.syncData((progress) => {
        setSyncProgress(progress);
      });

      await loadProductData();
      Alert.alert('Success', 'Data synchronized successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to sync data');
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all synced data and credentials. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await dataSyncService.clearAllData();
            setSiteInfo(null);
            setUsername('');
            setPassword('');
            setRemember(false);
            Alert.alert('Done', 'All data cleared');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: colors.text }]}>Settings</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LogIn size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          </View>

          {siteInfo ? (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Linked Site</Text>
              <Text style={[styles.value, { color: colors.text }]}>{siteInfo.siteName}</Text>
              <Text style={[styles.subValue, { color: colors.textTertiary }]}>ID: {siteInfo.siteId}</Text>
            </View>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Username (Email)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="user@example.com"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />

                <Text style={[styles.label, { marginTop: 16, color: colors.textSecondary }]}>Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  autoComplete="password"
                />

                <View style={styles.rememberRow}>
                  <Text style={[styles.rememberText, { color: colors.textSecondary }]}>Remember credentials</Text>
                  <Switch
                    value={remember}
                    onValueChange={setRemember}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleLink}
                disabled={isLinking}
              >
                {isLinking ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <LogIn size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>Link Account</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {siteInfo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Database size={20} color="#10b981" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Sync</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Sync products, operators, and settings from the server to this device.
              </Text>
            </View>

            {syncProgress && (
              <View style={[styles.progressCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={styles.progressPhase}>
                  {syncProgress.message}
                </Text>
                
                {syncProgress.total > 1 && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { 
                            backgroundColor: syncProgress.phase === 'complete' ? '#10b981' : colors.accent,
                            width: `${(syncProgress.current / syncProgress.total) * 100}%`
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.progressPercent, { color: colors.textSecondary }]}>
                      {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.buttonSuccess]}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <RefreshCw size={20} color="#ffffff" />
                  <Text style={styles.buttonText}>Sync Data</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Palette size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRowColumn}>
              <View style={styles.settingHeader}>
                {themePreference === 'light' ? <Sun size={18} color={colors.primary} /> : themePreference === 'dark' ? <Moon size={18} color={colors.primary} /> : <MonitorSmartphone size={18} color={colors.primary} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Theme</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    Choose your theme preference
                  </Text>
                </View>
              </View>
              
              <View style={styles.layoutOptions}>
                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    themePreference === 'light' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setTheme('light')}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Sun size={16} color={themePreference === 'light' ? colors.primary : colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Light Mode</Text>
                      <Text style={[styles.layoutOptionDesc, { color: colors.textTertiary }]}>Bright and clean interface</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    themePreference === 'dark' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setTheme('dark')}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Moon size={16} color={themePreference === 'dark' ? colors.primary : colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Dark Mode</Text>
                      <Text style={[styles.layoutOptionDesc, { color: colors.textTertiary }]}>Easy on the eyes</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    themePreference === 'system' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setTheme('system')}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MonitorSmartphone size={16} color={themePreference === 'system' ? colors.primary : colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>System</Text>
                      <Text style={[styles.layoutOptionDesc, { color: colors.textTertiary }]}>Use device settings</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRowColumn}>
              <View style={styles.settingHeader}>
                <Layers size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Product View Mode</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Choose how to navigate through products
                  </Text>
                </View>
              </View>
              
              <View style={styles.layoutOptions}>
                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    productViewMode === 'group-department' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleProductViewModeChange('group-department')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Group → Department View</Text>
                  <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>Navigate: Groups → Departments → Products</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    productViewMode === 'all-departments' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleProductViewModeChange('all-departments')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>All Departments View</Text>
                  <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>Navigate: All Departments → Products</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    productViewMode === 'all-items' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleProductViewModeChange('all-items')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Item View</Text>
                  <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>Show all products at once</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRowColumn}>
              <View style={styles.settingHeader}>
                <LayoutGrid size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Product View Layout</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    Choose card size for products
                  </Text>
                </View>
              </View>
              
              <View style={styles.layoutOptions}>
                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    productViewLayout === 'compact' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleProductViewLayoutChange('compact')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Compact</Text>
                  <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>3 columns, small cards</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    productViewLayout === 'standard' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleProductViewLayoutChange('standard')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Standard</Text>
                  <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>2 columns, medium cards</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    productViewLayout === 'large' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleProductViewLayoutChange('large')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Large</Text>
                  <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>1 column, large cards</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRowColumn}>
              <View style={styles.settingHeader}>
                <Filter size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Product Display Filters</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Control which groups and departments appear in the products tab</Text>
                </View>
              </View>

              {!hasData ? (
                <View style={[styles.warningBox, { backgroundColor: colors.background, borderColor: '#f59e0b' }]}>
                  <AlertTriangle size={18} color="#f59e0b" />
                  <Text style={[styles.warningText, { color: colors.textSecondary }]}>Sync your data first to configure product filters</Text>
                </View>
              ) : (
                <>
                  <View style={{ marginTop: 16 }}>
                    <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Visible Groups ({groups.length - productSettings.hiddenGroupIds.length}/{groups.length})</Text>
                    <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
                      {groups.map((group) => {
                        const isHidden = productSettings.hiddenGroupIds.includes(group.id);
                        return (
                          <TouchableOpacity
                            key={group.id}
                            style={[
                              styles.filterItem,
                              { backgroundColor: colors.background, borderColor: colors.border },
                              isHidden && { opacity: 0.5 },
                            ]}
                            onPress={() => toggleGroupVisibility(group.id)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.filterItemText, { color: colors.text }]}>{group.name}</Text>
                            </View>
                            {isHidden ? (
                              <EyeOff size={20} color={colors.textTertiary} />
                            ) : (
                              <Eye size={20} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={{ marginTop: 24 }}>
                    <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Visible Departments ({departments.length - productSettings.hiddenDepartmentIds.length}/{departments.length})</Text>
                    <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
                      {departments.map((department) => {
                        const isHidden = productSettings.hiddenDepartmentIds.includes(department.id);
                        const group = groups.find(g => g.id === department.groupId);
                        return (
                          <TouchableOpacity
                            key={department.id}
                            style={[
                              styles.filterItem,
                              { backgroundColor: colors.background, borderColor: colors.border },
                              isHidden && { opacity: 0.5 },
                            ]}
                            onPress={() => toggleDepartmentVisibility(department.id)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.filterItemText, { color: colors.text }]}>{department.name}</Text>
                              {group && (
                                <Text style={[styles.filterItemSubtext, { color: colors.textTertiary }]}>in {group.name}</Text>
                              )}
                            </View>
                            {isHidden ? (
                              <EyeOff size={20} color={colors.textTertiary} />
                            ) : (
                              <Eye size={20} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={{ marginTop: 24 }}>
                    <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Sort Order</Text>
                    <View style={styles.layoutOptions}>
                      <TouchableOpacity
                        style={[
                          styles.layoutOption,
                          { backgroundColor: colors.inputBackground, borderColor: colors.border },
                          productSettings.sortOrder === 'filename' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                        ]}
                        onPress={() => changeSortOrder('filename')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Filename Order</Text>
                        <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>Products sorted by their file names</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.layoutOption,
                          { backgroundColor: colors.inputBackground, borderColor: colors.border },
                          productSettings.sortOrder === 'alphabetical' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                        ]}
                        onPress={() => changeSortOrder('alphabetical')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Alphabetical</Text>
                        <Text style={[styles.layoutOptionDesc, { color: colors.textSecondary }]}>Products sorted A-Z by description</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Settings</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Card Payments</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Enable or disable card payment option
                </Text>
              </View>
              <Switch
                value={cardPaymentEnabled}
                onValueChange={updateCardPaymentEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Cash Payments</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Enable or disable cash payment option
                </Text>
              </View>
              <Switch
                value={cashPaymentEnabled}
                onValueChange={updateCashPaymentEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Card Machine Provider</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary, marginBottom: 12 }]}>
                Select your card machine provider
              </Text>
              
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setShowProviderDropdown(!showProviderDropdown)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>{cardMachineProvider}</Text>
                <ChevronDown size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showProviderDropdown ? '180deg' : '0deg' }] }} />
              </TouchableOpacity>

              {showProviderDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.dropdownItem, cardMachineProvider === 'Teya' && { backgroundColor: colors.primary + '20' }]}
                    onPress={() => {
                      updateCardMachineProvider('Teya');
                      setShowProviderDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>Teya</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, cardMachineProvider === 'None' && { backgroundColor: colors.primary + '20' }]}
                    onPress={() => {
                      updateCardMachineProvider('None');
                      setShowProviderDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>None</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Split Payments</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Allow customers to split payment across multiple methods
                </Text>
              </View>
              <Switch
                value={splitPaymentsEnabled}
                onValueChange={updateSplitPaymentsEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SettingsIcon size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>POS Settings</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Require Table Selection</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Force operators to select a table before adding items to basket
                </Text>
              </View>
              <Switch
                value={tableSelectionRequired}
                onValueChange={handleTableSelectionToggle}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {!isInitialSetupComplete && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <CheckCircle size={20} color="#10b981" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Initial Setup</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>
                Once you&apos;ve configured your account and synced your data, mark the initial setup as complete. This will hide the Settings tab for non-manager users.
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.buttonSuccess, { marginBottom: 0 }]}
                onPress={async () => {
                  await completeInitialSetup();
                  Alert.alert('Success', 'Initial setup completed! Settings will now only be accessible to managers.');
                }}
              >
                <CheckCircle size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Complete Initial Setup</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trash2 size={20} color="#ef4444" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Danger Zone</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleClearData}
          >
            <Trash2 size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  subValue: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#ffffff',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  rememberText: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
  },
  buttonSuccess: {
    backgroundColor: '#10b981',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b981',
    marginBottom: 12,
  },
  progressPhase: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 8,
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  settingRowColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  layoutOptions: {
    flexDirection: 'column',
    gap: 10,
  },
  layoutOption: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#334155',
  },
  layoutOptionSelected: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  layoutOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  layoutOptionDesc: {
    fontSize: 13,
    color: '#94a3b8',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
  },
  dropdownText: {
    fontSize: 15,
    color: '#ffffff',
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#ffffff',
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  filterItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  filterItemSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
  },
});
