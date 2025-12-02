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
  Modal,
} from 'react-native';

import { RefreshCw, LogIn, Database, Trash2, Settings as SettingsIcon, LayoutGrid, Layers, Sun, Moon, Palette, MonitorSmartphone, CheckCircle, CreditCard, ChevronDown, ChevronUp, Filter, Eye, EyeOff, AlertTriangle, Paintbrush, X, FileText, Percent, DollarSign, Printer, Bluetooth, Wifi } from 'lucide-react-native';
import { dataSyncService, type SyncProgress } from '@/services/dataSync';
import { printerService } from '@/services/printerService';
import { useRouter } from 'expo-router';
import type { ProductDisplaySettings, ProductGroup, Department, DiscountSettings, GratuitySettings, PrinterSettings, ReceiptSettings, ReceiptLine, ReceiptLineSize } from '@/types/pos';
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
  const { updateTableSelectionRequired, updateProductViewLayout, updateProductViewMode, isInitialSetupComplete, completeInitialSetup, cardPaymentEnabled, cashPaymentEnabled, cardMachineProvider, splitPaymentsEnabled, updateCardPaymentEnabled, updateCashPaymentEnabled, updateCardMachineProvider, updateSplitPaymentsEnabled, refundButtonEnabled, updateRefundButtonEnabled, discountSettings, updateDiscountSettings, gratuitySettings, updateGratuitySettings, receiptSettings, updateReceiptSettings, changeAllowed, cashbackAllowed, updateChangeAllowed, updateCashbackAllowed } = usePOS();
  const router = useRouter();
  const { theme, themePreference, colors, setTheme } = useTheme();


  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [productSettings, setProductSettings] = useState<ProductDisplaySettings>({
    hiddenGroupIds: [],
    hiddenDepartmentIds: [],
    sortOrder: 'filename',
    groupColors: {},
    departmentColors: {},
  });
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hasData, setHasData] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<{ type: 'group' | 'department'; id: string } | null>(null);
  const [customColorInput, setCustomColorInput] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [discountPercentages, setDiscountPercentages] = useState<string[]>([]);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [editingDiscountIndex, setEditingDiscountIndex] = useState<number | null>(null);
  const [discountInputValue, setDiscountInputValue] = useState('');
  const [gratuityPercentages, setGratuityPercentages] = useState<string[]>([]);
  const [gratuityModalVisible, setGratuityModalVisible] = useState(false);
  const [editingGratuityIndex, setEditingGratuityIndex] = useState<number | null>(null);
  const [gratuityInputValue, setGratuityInputValue] = useState('');
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    connectionType: 'bluetooth',
    paperWidth: '80mm',
    isConnected: false,
    autoConnect: false,
    cashDrawerEnabled: false,
    cashDrawerVoltage: '12v',
  });
  const [printerIPInput, setPrinterIPInput] = useState('');
  const [printerPortInput, setPrinterPortInput] = useState('9100');
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [editingReceiptSection, setEditingReceiptSection] = useState<'header' | 'footer'>('header');
  const [editingReceiptLineIndex, setEditingReceiptLineIndex] = useState<number | null>(null);
  const [receiptLineText, setReceiptLineText] = useState('');
  const [receiptLineSize, setReceiptLineSize] = useState<ReceiptLineSize>('normal');
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    account: true,
    dataSync: false,
    appearance: false,
    payment: false,
    pos: false,
    discount: false,
    gratuity: false,
    initialSetup: false,
    danger: false,
    printer: false,
    receipt: false,
  });

  useEffect(() => {
    loadSiteInfo();
    loadSavedCredentials();
    loadTableSelectionSetting();
    loadProductViewLayout();
    loadProductViewMode();
    loadProductSettings();
    loadProductData();
    loadLastSyncTime();
    loadPrinterSettings();
  }, []);

  useEffect(() => {
    setDiscountPercentages(discountSettings.presetPercentages.map(String));
  }, [discountSettings.presetPercentages]);

  useEffect(() => {
    setGratuityPercentages(gratuitySettings.presetPercentages.map(String));
  }, [gratuitySettings.presetPercentages]);

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

  const loadLastSyncTime = async () => {
    const time = await dataSyncService.getLastSyncTime();
    setLastSyncTime(time);
  };

  const loadPrinterSettings = async () => {
    try {
      const settings = await printerService.loadSettings();
      setPrinterSettings(settings);
      if (settings.ipAddress) setPrinterIPInput(settings.ipAddress);
      if (settings.port) setPrinterPortInput(settings.port.toString());
    } catch (error) {
      console.error('Error loading printer settings:', error);
    }
  };

  const handleConnectBluetooth = async () => {
    Alert.alert(
      'Bluetooth Printer',
      'Bluetooth printer scanning and connection requires native module integration. This feature will scan for nearby Bluetooth printers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Scan',
          onPress: async () => {
            setIsConnectingPrinter(true);
            try {
              const devices = await printerService.scanBluetoothDevices();
              if (devices.length === 0) {
                Alert.alert('No Devices', 'No Bluetooth printers found nearby');
              }
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to scan for devices');
            } finally {
              setIsConnectingPrinter(false);
            }
          },
        },
      ]
    );
  };

  const handleConnectNetwork = async () => {
    if (!printerIPInput.trim()) {
      Alert.alert('Error', 'Please enter a valid IP address');
      return;
    }

    const port = parseInt(printerPortInput) || 9100;
    setIsConnectingPrinter(true);

    try {
      await printerService.connectNetwork(printerIPInput.trim(), port);
      const updatedSettings = printerService.getSettings();
      setPrinterSettings(updatedSettings);
      Alert.alert('Success', 'Connected to network printer');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to connect to network printer');
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleDisconnectPrinter = async () => {
    try {
      await printerService.disconnect();
      const updatedSettings = printerService.getSettings();
      setPrinterSettings(updatedSettings);
      Alert.alert('Success', 'Printer disconnected');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to disconnect printer');
    }
  };

  const handleTestPrint = async () => {
    if (!printerSettings.isConnected) {
      Alert.alert('Error', 'Please connect a printer first');
      return;
    }

    try {
      await printerService.printTestReceipt();
      Alert.alert('Success', 'Test receipt sent to printer');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to print test receipt');
    }
  };

  const handlePaperWidthChange = async (width: '58mm' | '80mm') => {
    try {
      const updatedSettings = { ...printerSettings, paperWidth: width };
      await printerService.saveSettings(updatedSettings);
      setPrinterSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating paper width:', error);
    }
  };

  const handleConnectionTypeChange = async (type: 'bluetooth' | 'network') => {
    try {
      const updatedSettings = { ...printerSettings, connectionType: type };
      await printerService.saveSettings(updatedSettings);
      setPrinterSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating connection type:', error);
    }
  };

  const handleCashDrawerToggle = async (enabled: boolean) => {
    try {
      const updatedSettings = { ...printerSettings, cashDrawerEnabled: enabled };
      await printerService.saveSettings(updatedSettings);
      setPrinterSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating cash drawer setting:', error);
    }
  };

  const handleCashDrawerVoltageChange = async (voltage: '12v' | '24v') => {
    try {
      const updatedSettings = { ...printerSettings, cashDrawerVoltage: voltage };
      await printerService.saveSettings(updatedSettings);
      setPrinterSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating cash drawer voltage:', error);
    }
  };

  const formatSyncTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const openColorPicker = (type: 'group' | 'department', id: string) => {
    setColorPickerTarget({ type, id });
    setColorPickerVisible(true);
  };

  const setCustomColor = async (color: string) => {
    if (!colorPickerTarget) return;
    
    const newSettings = { ...productSettings };
    if (colorPickerTarget.type === 'group') {
      newSettings.groupColors = { ...newSettings.groupColors, [colorPickerTarget.id]: color };
    } else {
      newSettings.departmentColors = { ...newSettings.departmentColors, [colorPickerTarget.id]: color };
    }
    
    setProductSettings(newSettings);
    await dataSyncService.setProductDisplaySettings(newSettings);
    setColorPickerVisible(false);
    setColorPickerTarget(null);
    setCustomColorInput('');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const CollapsibleSection = ({ 
    id, 
    icon: Icon, 
    title, 
    iconColor, 
    children 
  }: { 
    id: string; 
    icon: any; 
    title: string; 
    iconColor: string; 
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections[id];
    
    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.collapsibleHeader, { borderColor: colors.border }]}
          onPress={() => toggleSection(id)}
          activeOpacity={0.7}
          disabled={false}
        >
          <View style={styles.sectionHeader}>
            <Icon size={20} color={iconColor} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.collapsibleContent}>
            {children}
          </View>
        )}
      </View>
    );
  };

  const applyCustomColor = () => {
    let colorValue = customColorInput.trim();
    if (!colorValue) return;
    
    if (!colorValue.startsWith('#')) {
      colorValue = '#' + colorValue;
    }
    
    const hexRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;
    if (hexRegex.test(colorValue)) {
      setCustomColor(colorValue);
    } else {
      Alert.alert('Invalid Color', 'Please enter a valid hex color code (e.g., #FF5733 or #F57)');
    }
  };

  const getItemColor = (type: 'group' | 'department', id: string): string | undefined => {
    if (type === 'group') {
      return productSettings.groupColors?.[id];
    }
    return productSettings.departmentColors?.[id];
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

  const handleSync = async (incremental: boolean = false) => {
    if (!siteInfo) {
      Alert.alert('Error', 'Please link your account first');
      return;
    }

    if (isSyncing) {
      console.log('[Settings] Sync already in progress, ignoring duplicate request');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(null);

    try {
      await dataSyncService.syncData((progress) => {
        setSyncProgress(progress);
      }, incremental);

      await loadProductData();
      await loadLastSyncTime();
      
      if (incremental) {
        Alert.alert('Success', 'Incremental sync completed!');
      } else {
        Alert.alert('Success', 'Full sync completed!');
      }
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
        keyboardDismissMode="on-drag"
        removeClippedSubviews={false}
      >
        <Text style={[styles.heading, { color: colors.text }]}>Settings</Text>

        <CollapsibleSection 
          id="account" 
          icon={LogIn} 
          title="Account" 
          iconColor={colors.primary}
        >
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
                  onChangeText={(text) => setUsername(text)}
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
                  onChangeText={(text) => setPassword(text)}
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
        </CollapsibleSection>

        {siteInfo && (
          <CollapsibleSection 
            id="dataSync" 
            icon={Database} 
            title="Data Sync" 
            iconColor="#10b981"
          >

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Sync products, operators, and settings from the server to this device.
              </Text>
              {lastSyncTime && (
                <Text style={[styles.lastSyncText, { color: colors.textTertiary, marginTop: 12 }]}>
                  Last synced: {formatSyncTime(lastSyncTime)}
                </Text>
              )}
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
              style={[styles.button, styles.buttonSuccess, isSyncing && { opacity: 0.7 }]}
              onPress={() => handleSync(false)}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.buttonText}>Syncing...</Text>
                </View>
              ) : (
                <>
                  <RefreshCw size={20} color="#ffffff" />
                  <Text style={styles.buttonText}>{lastSyncTime ? 'Full Sync' : 'Sync Data'}</Text>
                </>
              )}
            </TouchableOpacity>

            {lastSyncTime && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.accent, marginBottom: 12 }, isSyncing && { opacity: 0.7 }]}
                onPress={() => handleSync(true)}
                disabled={isSyncing}
                activeOpacity={0.8}
              >
                {isSyncing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.buttonText}>Syncing...</Text>
                  </View>
                ) : (
                  <>
                    <RefreshCw size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>Quick Sync (Incremental)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </CollapsibleSection>
        )}

        <CollapsibleSection 
          id="appearance" 
          icon={Palette} 
          title="Appearance" 
          iconColor={colors.primary}
        >

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
                    <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Light Mode</Text>
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
                    <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Dark Mode</Text>
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
                    <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>System</Text>
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
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                openColorPicker('group', group.id);
                              }}
                              style={[styles.colorButton, getItemColor('group', group.id) && { backgroundColor: getItemColor('group', group.id) + '20', borderRadius: 6 }]}
                              activeOpacity={0.7}
                            >
                              <Paintbrush size={18} color={getItemColor('group', group.id) || colors.primary} />
                            </TouchableOpacity>
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
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                openColorPicker('department', department.id);
                              }}
                              style={[styles.colorButton, getItemColor('department', department.id) && { backgroundColor: getItemColor('department', department.id) + '20', borderRadius: 6 }]}
                              activeOpacity={0.7}
                            >
                              <Paintbrush size={18} color={getItemColor('department', department.id) || colors.primary} />
                            </TouchableOpacity>
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
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </CollapsibleSection>

        <CollapsibleSection 
          id="payment" 
          icon={CreditCard} 
          title="Payment Settings" 
          iconColor={colors.primary}
        >

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Card Payments</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Enable or disable card payment option</Text>
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
                <Text style={[styles.label, { color: colors.textSecondary }]}>Cash Payments</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Enable or disable cash payment option</Text>
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
              <Text style={[styles.label, { color: colors.textSecondary }]}>Card Machine Provider</Text>
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
                <Text style={[styles.label, { color: colors.textSecondary }]}>Split Payments</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Allow customers to split payment across multiple methods</Text>
              </View>
              <Switch
                value={splitPaymentsEnabled}
                onValueChange={updateSplitPaymentsEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Allow Change</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Allow giving change when payment exceeds total</Text>
              </View>
              <Switch
                value={changeAllowed}
                onValueChange={updateChangeAllowed}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Allow Cashback</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Record change from non-cash tenders as cashback</Text>
              </View>
              <Switch
                value={cashbackAllowed}
                onValueChange={updateCashbackAllowed}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </CollapsibleSection>

        <CollapsibleSection 
          id="pos" 
          icon={SettingsIcon} 
          title="Basket Settings" 
          iconColor={colors.primary}
        >

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Require Table Selection</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Force operators to select a table before adding items to basket</Text>
              </View>
              <Switch
                value={tableSelectionRequired}
                onValueChange={handleTableSelectionToggle}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Refund Button</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Show refund button in basket for managers</Text>
              </View>
              <Switch
                value={refundButtonEnabled}
                onValueChange={updateRefundButtonEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Enable Gratuities</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Show gratuity button in the Basket for all users</Text>
              </View>
              <Switch
                value={gratuitySettings.enabled}
                onValueChange={(enabled) => {
                  updateGratuitySettings({ ...gratuitySettings, enabled });
                }}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Configure up to 3 preset gratuity percentages that will be offered to customers</Text>
            
            <View style={styles.discountList}>
              {gratuityPercentages.map((percentage, index) => (
                <View key={index} style={[styles.discountItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <DollarSign size={16} color={colors.success} />
                    <Text style={[styles.discountItemText, { color: colors.text }]}>{percentage}%</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingGratuityIndex(index);
                      setGratuityInputValue(percentage);
                      setGratuityModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.editButton, { color: colors.primary }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {gratuityPercentages.length < 3 && (
              <TouchableOpacity
                style={[styles.addDiscountButton, { backgroundColor: colors.success }]}
                onPress={() => {
                  setEditingGratuityIndex(null);
                  setGratuityInputValue('');
                  setGratuityModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addDiscountText}>Add Gratuity Percentage</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Configure up to 6 preset discount percentages that managers can apply to baskets</Text>
            
            <View style={styles.discountList}>
              {discountPercentages.map((percentage, index) => (
                <View key={index} style={[styles.discountItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Percent size={16} color={colors.accent} />
                    <Text style={[styles.discountItemText, { color: colors.text }]}>{percentage}%</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingDiscountIndex(index);
                      setDiscountInputValue(percentage);
                      setDiscountModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.editButton, { color: colors.primary }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {discountPercentages.length < 6 && (
              <TouchableOpacity
                style={[styles.addDiscountButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setEditingDiscountIndex(null);
                  setDiscountInputValue('');
                  setDiscountModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addDiscountText}>Add Discount Percentage</Text>
              </TouchableOpacity>
            )}
          </View>
        </CollapsibleSection>

        <CollapsibleSection 
          id="printer" 
          icon={Printer} 
          title="Printer Settings" 
          iconColor={colors.primary}
        >
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Connect a thermal printer to automatically print receipts</Text>

            {printerSettings.isConnected && (
              <View style={[styles.warningBox, { backgroundColor: colors.success + '20', borderColor: colors.success, marginBottom: 16 }]}>
                <CheckCircle size={18} color={colors.success} />
                <Text style={[styles.warningText, { color: colors.text }]}>
                  {printerSettings.connectionType === 'bluetooth' 
                    ? `Connected: ${printerSettings.deviceName || 'Bluetooth Printer'}`
                    : `Connected: ${printerSettings.ipAddress}:${printerSettings.port}`}
                </Text>
              </View>
            )}

            <View style={styles.settingRowColumn}>
              <View style={styles.settingHeader}>
                <Printer size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Paper Width</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Select your thermal printer paper width</Text>
                </View>
              </View>
              
              <View style={styles.layoutOptions}>
                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    printerSettings.paperWidth === '58mm' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handlePaperWidthChange('58mm')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>58mm (2 inch)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    printerSettings.paperWidth === '80mm' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handlePaperWidthChange('80mm')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>80mm (3 inch)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRowColumn}>
              <View style={styles.settingHeader}>
                <SettingsIcon size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>Connection Type</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Choose how to connect to your printer</Text>
                </View>
              </View>
              
              <View style={styles.layoutOptions}>
                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    printerSettings.connectionType === 'bluetooth' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleConnectionTypeChange('bluetooth')}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Bluetooth size={16} color={printerSettings.connectionType === 'bluetooth' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Bluetooth</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    printerSettings.connectionType === 'network' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => handleConnectionTypeChange('network')}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Wifi size={16} color={printerSettings.connectionType === 'network' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Network (IP)</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {printerSettings.connectionType === 'bluetooth' && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Bluetooth Connection</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Scan for nearby Bluetooth printers and connect</Text>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, marginBottom: 0 }]}
                onPress={handleConnectBluetooth}
                disabled={isConnectingPrinter || printerSettings.isConnected}
                activeOpacity={0.8}
              >
                {isConnectingPrinter ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Bluetooth size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>Scan & Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {printerSettings.connectionType === 'network' && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Network Printer</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Enter the IP address and port of your network printer</Text>
              
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>IP Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={printerIPInput}
                onChangeText={(text) => setPrinterIPInput(text)}
                placeholder="e.g., 192.168.1.100"
                placeholderTextColor={colors.textTertiary}
                keyboardType="default"
                editable={!printerSettings.isConnected}
              />

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Port</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={printerPortInput}
                onChangeText={(text) => setPrinterPortInput(text)}
                placeholder="9100"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                editable={!printerSettings.isConnected}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, marginTop: 16, marginBottom: 0 }]}
                onPress={handleConnectNetwork}
                disabled={isConnectingPrinter || printerSettings.isConnected}
                activeOpacity={0.8}
              >
                {isConnectingPrinter ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Wifi size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Cash Drawer</Text>
                <Text style={[styles.settingTitle, { color: colors.text }]}>Open cash drawer when transaction is completed</Text>
              </View>
              <Switch
                value={printerSettings.cashDrawerEnabled}
                onValueChange={handleCashDrawerToggle}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {printerSettings.cashDrawerEnabled && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.settingRowColumn}>
                <View style={styles.settingHeader}>
                  <SettingsIcon size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>Cash Drawer Voltage</Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Select the voltage for your cash drawer</Text>
                  </View>
                </View>
                
                <View style={styles.layoutOptions}>
                  <TouchableOpacity
                    style={[
                      styles.layoutOption,
                      { backgroundColor: colors.inputBackground, borderColor: colors.border },
                      printerSettings.cashDrawerVoltage === '12v' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                    ]}
                    onPress={() => handleCashDrawerVoltageChange('12v')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>12V</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.layoutOption,
                      { backgroundColor: colors.inputBackground, borderColor: colors.border },
                      printerSettings.cashDrawerVoltage === '24v' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                    ]}
                    onPress={() => handleCashDrawerVoltageChange('24v')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>24V</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {printerSettings.isConnected && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Printer Actions</Text>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.accent, marginBottom: 12 }]}
                onPress={handleTestPrint}
                activeOpacity={0.8}
              >
                <Printer size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Print Test Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.error, marginBottom: 0 }]}
                onPress={handleDisconnectPrinter}
                activeOpacity={0.8}
              >
                <X size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Customize the header and footer text on receipts and bills</Text>
            
            <Text style={[styles.filterSectionTitle, { color: colors.text, marginBottom: 12 }]}>Header Lines ({receiptSettings.headerLines.length}/7)</Text>
            {receiptSettings.headerLines.map((line, index) => (
              <View key={`header-${index}`} style={[styles.receiptLineItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.receiptLineText, { color: colors.text }]}>{line.text}</Text>
                  <Text style={[styles.receiptLineSize, { color: colors.textTertiary }]}>Size: {line.size}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingReceiptSection('header');
                    setEditingReceiptLineIndex(index);
                    setReceiptLineText(line.text);
                    setReceiptLineSize(line.size);
                    setReceiptModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.editButton, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            {receiptSettings.headerLines.length < 7 && (
              <TouchableOpacity
                style={[styles.addDiscountButton, { backgroundColor: colors.primary, marginTop: 12 }]}
                onPress={() => {
                  setEditingReceiptSection('header');
                  setEditingReceiptLineIndex(null);
                  setReceiptLineText('');
                  setReceiptLineSize('normal');
                  setReceiptModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addDiscountText}>Add Header Line</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.filterSectionTitle, { color: colors.text, marginBottom: 12, marginTop: 24 }]}>Footer Lines ({receiptSettings.footerLines.length}/7)</Text>
            {receiptSettings.footerLines.map((line, index) => (
              <View key={`footer-${index}`} style={[styles.receiptLineItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.receiptLineText, { color: colors.text }]}>{line.text}</Text>
                  <Text style={[styles.receiptLineSize, { color: colors.textTertiary }]}>Size: {line.size}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingReceiptSection('footer');
                    setEditingReceiptLineIndex(index);
                    setReceiptLineText(line.text);
                    setReceiptLineSize(line.size);
                    setReceiptModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.editButton, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            {receiptSettings.footerLines.length < 7 && (
              <TouchableOpacity
                style={[styles.addDiscountButton, { backgroundColor: colors.primary, marginTop: 12 }]}
                onPress={() => {
                  setEditingReceiptSection('footer');
                  setEditingReceiptLineIndex(null);
                  setReceiptLineText('');
                  setReceiptLineSize('normal');
                  setReceiptModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addDiscountText}>Add Footer Line</Text>
              </TouchableOpacity>
            )}
          </View>
        </CollapsibleSection>

        <CollapsibleSection 
          id="reports" 
          icon={FileText} 
          title="Reports & Consolidation" 
          iconColor="#10b981"
        >
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>View transaction history, analytics, and generate reports</Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, marginBottom: 0 }]}
              onPress={() => router.push('/reports')}
              activeOpacity={0.8}
            >
              <FileText size={20} color="#ffffff" />
              <Text style={styles.buttonText}>Open Reports</Text>
            </TouchableOpacity>
          </View>
        </CollapsibleSection>

        {!isInitialSetupComplete && (
          <CollapsibleSection 
            id="initialSetup" 
            icon={CheckCircle} 
            title="Initial Setup" 
            iconColor="#10b981"
          >

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
          </CollapsibleSection>
        )}

        <CollapsibleSection 
          id="danger" 
          icon={Trash2} 
          title="Danger Zone" 
          iconColor="#ef4444"
        >

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleClearData}
          >
            <Trash2 size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Clear All Data</Text>
          </TouchableOpacity>
        </CollapsibleSection>

        <Modal
          transparent
          visible={colorPickerVisible}
          onRequestClose={() => setColorPickerVisible(false)}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.colorPickerModal, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Color</Text>
                <TouchableOpacity onPress={() => setColorPickerVisible(false)}>
                  <X size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator>
                <View style={styles.colorGrid}>
                  {Array.from(new Set([
                    '#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6', '#f2f2f2', '#ffffff',
                    '#ff0000', '#ff1a1a', '#ff3333', '#ff4d4d', '#ff6666', '#ff8080', '#ff9999', '#ffb3b3', '#ffcccc', '#ffe6e6',
                    '#cc0000', '#e60000', '#990000', '#b30000', '#660000', '#800000',
                    '#ff6600', '#ff751a', '#ff8533', '#ff944d', '#ffa366', '#ffb380', '#ffc299', '#ffd1b3', '#ffe0cc', '#fff0e6',
                    '#cc5200', '#e65c00', '#994d00', '#b35900', '#cc6600', '#e67300', '#ff8000', '#ff8c1a', '#ff9933', '#ffa64d', '#ffb366', '#ffc080',
                    '#ffcc00', '#ffd11a', '#ffd633', '#ffdb4d', '#ffe066', '#ffe680', '#ffeb99', '#fff0b3', '#fff5cc', '#fffae6',
                    '#ccaa00', '#e6bf00', '#ffd400', '#ffd91a', '#ffde33', '#ffe34d', '#ffe866', '#ffed80', '#fff299', '#fff7b3',
                    '#ffff00', '#ffff1a', '#ffff33', '#ffff4d', '#ffff66', '#ffff80', '#ffff99', '#ffffb3', '#ffffcc', '#ffffe6',
                    '#ccff00', '#d6ff1a', '#e0ff33', '#ebff4d', '#f5ff66',
                    '#99ff00', '#adff1a', '#c2ff33', '#d6ff4d', '#ebff66',
                    '#66ff00', '#75ff1a', '#85ff33', '#94ff4d', '#a3ff66', '#b3ff80', '#c2ff99', '#d1ffb3', '#e0ffcc', '#f0ffe6',
                    '#33ff00', '#47ff1a', '#5cff33', '#70ff4d', '#85ff66', '#99ff80', '#adff99', '#c2ffb3', '#d6ffcc', '#ebffe6',
                    '#00ff00', '#1aff1a', '#33ff33', '#4dff4d', '#66ff66', '#80ff80', '#99ff99', '#b3ffb3', '#ccffcc', '#e6ffe6',
                    '#00ff33', '#1aff47', '#33ff5c', '#4dff70', '#66ff85', '#80ff99', '#99ffad', '#b3ffc2', '#ccffd6', '#e6ffeb',
                    '#00ff66', '#1aff75', '#33ff85', '#4dff94', '#66ffa3', '#80ffb3', '#99ffc2', '#b3ffd1', '#ccffe0', '#e6fff0',
                    '#00ff99', '#1affad', '#33ffc2', '#4dffd6', '#66ffeb', '#80ffff', '#99ffff', '#b3ffff', '#ccffff', '#e6ffff',
                    '#00ffcc', '#1affd6', '#33ffe0', '#4dffeb', '#66fff5',
                    '#00ffff', '#1affff', '#33ffff', '#4dffff', '#66ffff',
                    '#00ccff', '#1ad6ff', '#33e0ff', '#4debff', '#66f5ff',
                    '#0099ff', '#1aadff', '#33c2ff', '#4dd6ff', '#66ebff',
                    '#0066ff', '#1a75ff', '#3385ff', '#4d94ff', '#66a3ff', '#80b3ff', '#99c2ff', '#b3d1ff', '#cce0ff', '#e6f0ff',
                    '#0033ff', '#1a47ff', '#335cff', '#4d70ff', '#6685ff', '#8099ff', '#99adff', '#b3c2ff', '#ccd6ff', '#e6ebff',
                    '#0000ff', '#1a1aff', '#3333ff', '#4d4dff', '#6666ff', '#8080ff', '#9999ff', '#b3b3ff', '#ccccff', '#e6e6ff',
                    '#3300ff', '#4d1aff', '#6633ff', '#804dff', '#9966ff', '#b380ff', '#cc99ff', '#e0b3ff', '#f0ccff', '#fae6ff',
                    '#6600ff', '#751aff', '#8533ff', '#944dff', '#a366ff', '#c299ff', '#d1b3ff', '#e0ccff', '#f0e6ff',
                    '#9900ff', '#ad1aff', '#c233ff', '#d64dff', '#eb66ff', '#ff80ff', '#ff99ff', '#ffb3ff', '#ffccff', '#ffe6ff',
                    '#cc00ff', '#d61aff', '#e033ff', '#eb4dff', '#f566ff',
                    '#ff00ff', '#ff1aff', '#ff33ff', '#ff4dff', '#ff66ff', '#ffcccc',
                    '#ff00cc', '#ff1ad6', '#ff33e0', '#ff4deb', '#ff66f5',
                    '#ff0099', '#ff1aad', '#ff33c2', '#ff4dd6', '#ff66eb',
                    '#ff0066', '#ff1a75', '#ff3385', '#ff4d94', '#ff66a3', '#ff80b3', '#ff99c2', '#ffb3d1', '#ffcce0', '#ffe6f0',
                    '#ff0033', '#ff1a47', '#ff335c', '#ff4d70', '#ff6685', '#ff8099', '#ff99ad', '#ffb3c2', '#ffccd6', '#ffe6eb',
                    '#8b4513', '#a0522d', '#b8860b', '#cd853f', '#daa520', '#d2691e', '#bc8f8f', '#f4a460', '#deb887', '#d2b48c',
                    '#f5deb3', '#ffe4b5', '#ffefd5', '#fff8dc', '#fffaf0', '#faebd7', '#ffe4c4', '#ffdead', '#ffe4e1', '#fff5ee',
                    '#faf0e6', '#fdf5e6', '#fffacd', '#ffffe0', '#f0fff0', '#f5fffa', '#f0ffff', '#f0f8ff',
                    '#708090', '#778899', '#b0c4de', '#add8e6', '#87ceeb', '#87cefa', '#00bfff', '#1e90ff', '#6495ed', '#4682b4',
                    '#5f9ea0', '#20b2aa', '#48d1cc', '#40e0d0', '#00ced1', '#e0ffff', '#afeeee', '#7fffd4', '#66cdaa',
                    '#3cb371', '#2e8b57', '#90ee90', '#98fb98', '#8fbc8f', '#32cd32', '#00fa9a', '#00ff7f', '#adff2f', '#7fff00',
                    '#7cfc00', '#9acd32', '#6b8e23', '#556b2f',
                    '#ffd700', '#fafad2', '#ffdab9', '#eee8aa',
                    '#f0e68c', '#bdb76b', '#e6e6fa', '#d8bfd8', '#dda0dd', '#ee82ee', '#da70d6', '#ba55d3', '#9370db',
                    '#8a2be2', '#9400d3', '#9932cc', '#8b008b', '#800080', '#4b0082', '#483d8b', '#6a5acd', '#7b68ee',
                  ])).map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorOption, { backgroundColor: color }]}
                      onPress={() => setCustomColor(color)}
                      activeOpacity={0.7}
                    />
                  ))}
                </View>

                <View style={styles.customColorSection}>
                  <Text style={[styles.customColorLabel, { color: colors.text }]}>Custom Color</Text>
                  <View style={styles.customColorInputContainer}>
                    <TextInput
                      style={[styles.customColorInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={customColorInput}
                      onChangeText={(text) => setCustomColorInput(text)}
                      placeholder="#FF5733 or FF5733"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="characters"
                      maxLength={7}
                    />
                    <TouchableOpacity
                      style={[styles.applyColorButton, { backgroundColor: colors.primary }]}
                      onPress={applyCustomColor}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.applyColorText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={discountModalVisible}
          onRequestClose={() => setDiscountModalVisible(false)}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.colorPickerModal, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editingDiscountIndex !== null ? 'Edit' : 'Add'} Discount</Text>
                <TouchableOpacity onPress={() => setDiscountModalVisible(false)}>
                  <X size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Enter a discount percentage (0-100)</Text>

              <View style={styles.customColorInputContainer}>
                <TextInput
                  style={[styles.customColorInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={discountInputValue}
                  onChangeText={(text) => setDiscountInputValue(text)}
                  placeholder="e.g., 10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.applyColorButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    const value = parseFloat(discountInputValue);
                    if (isNaN(value) || value < 0 || value > 100) {
                      Alert.alert('Invalid Input', 'Please enter a number between 0 and 100');
                      return;
                    }
                    
                    const newPercentages = [...discountPercentages];
                    if (editingDiscountIndex !== null) {
                      newPercentages[editingDiscountIndex] = discountInputValue;
                    } else {
                      if (newPercentages.length >= 6) {
                        Alert.alert('Maximum Reached', 'You can only have up to 6 discount percentages');
                        return;
                      }
                      newPercentages.push(discountInputValue);
                    }
                    
                    const settings: DiscountSettings = {
                      presetPercentages: newPercentages.map(p => parseFloat(p)).sort((a, b) => a - b)
                    };
                    updateDiscountSettings(settings);
                    setDiscountPercentages(settings.presetPercentages.map(String));
                    setDiscountModalVisible(false);
                    setDiscountInputValue('');
                    setEditingDiscountIndex(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.applyColorText}>Save</Text>
                </TouchableOpacity>
              </View>

              {editingDiscountIndex !== null && (
                <TouchableOpacity
                  style={[styles.deleteDiscountButton, { backgroundColor: colors.error + '20', borderColor: colors.error, marginTop: 16 }]}
                  onPress={() => {
                    const newPercentages = discountPercentages.filter((_, i) => i !== editingDiscountIndex);
                    const settings: DiscountSettings = {
                      presetPercentages: newPercentages.map(p => parseFloat(p)).sort((a, b) => a - b)
                    };
                    updateDiscountSettings(settings);
                    setDiscountPercentages(settings.presetPercentages.map(String));
                    setDiscountModalVisible(false);
                    setDiscountInputValue('');
                    setEditingDiscountIndex(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color={colors.error} />
                  <Text style={[styles.deleteDiscountText, { color: colors.error }]}>Delete Discount</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={gratuityModalVisible}
          onRequestClose={() => setGratuityModalVisible(false)}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.colorPickerModal, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{editingGratuityIndex !== null ? 'Edit' : 'Add'} Gratuity</Text>
                <TouchableOpacity onPress={() => setGratuityModalVisible(false)}>
                  <X size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>Enter a gratuity percentage (0-100)</Text>

              <View style={styles.customColorInputContainer}>
                <TextInput
                  style={[styles.customColorInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={gratuityInputValue}
                  onChangeText={(text) => setGratuityInputValue(text)}
                  placeholder="e.g., 15"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.applyColorButton, { backgroundColor: colors.success }]}
                  onPress={() => {
                    const value = parseFloat(gratuityInputValue);
                    if (isNaN(value) || value < 0 || value > 100) {
                      Alert.alert('Invalid Input', 'Please enter a number between 0 and 100');
                      return;
                    }
                    
                    const newPercentages = [...gratuityPercentages];
                    if (editingGratuityIndex !== null) {
                      newPercentages[editingGratuityIndex] = gratuityInputValue;
                    } else {
                      if (newPercentages.length >= 3) {
                        Alert.alert('Maximum Reached', 'You can only have up to 3 gratuity percentages');
                        return;
                      }
                      newPercentages.push(gratuityInputValue);
                    }
                    
                    const settings: GratuitySettings = {
                      enabled: gratuitySettings.enabled,
                      presetPercentages: newPercentages.map(p => parseFloat(p)).sort((a, b) => a - b)
                    };
                    updateGratuitySettings(settings);
                    setGratuityPercentages(settings.presetPercentages.map(String));
                    setGratuityModalVisible(false);
                    setGratuityInputValue('');
                    setEditingGratuityIndex(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.applyColorText}>Save</Text>
                </TouchableOpacity>
              </View>

              {editingGratuityIndex !== null && (
                <TouchableOpacity
                  style={[styles.deleteDiscountButton, { backgroundColor: colors.error + '20', borderColor: colors.error, marginTop: 16 }]}
                  onPress={() => {
                    const newPercentages = gratuityPercentages.filter((_, i) => i !== editingGratuityIndex);
                    const settings: GratuitySettings = {
                      enabled: gratuitySettings.enabled,
                      presetPercentages: newPercentages.map(p => parseFloat(p)).sort((a, b) => a - b)
                    };
                    updateGratuitySettings(settings);
                    setGratuityPercentages(settings.presetPercentages.map(String));
                    setGratuityModalVisible(false);
                    setGratuityInputValue('');
                    setEditingGratuityIndex(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color={colors.error} />
                  <Text style={[styles.deleteDiscountText, { color: colors.error }]}>Delete Gratuity</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={receiptModalVisible}
          onRequestClose={() => setReceiptModalVisible(false)}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.colorPickerModal, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingReceiptLineIndex !== null ? 'Edit' : 'Add'} {editingReceiptSection === 'header' ? 'Header' : 'Footer'} Line
                </Text>
                <TouchableOpacity onPress={() => setReceiptModalVisible(false)}>
                  <X size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 8 }]}>Text</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text, marginBottom: 16 }]}
                value={receiptLineText}
                onChangeText={(text) => setReceiptLineText(text)}
                placeholder="Enter line text"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                multiline
              />

              <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 8 }]}>Size</Text>
              <View style={styles.layoutOptions}>
                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    receiptLineSize === 'small' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setReceiptLineSize('small')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Small</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    receiptLineSize === 'normal' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setReceiptLineSize('normal')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Normal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    receiptLineSize === 'large' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setReceiptLineSize('large')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Large</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, marginTop: 20 }]}
                onPress={() => {
                  if (!receiptLineText.trim()) {
                    Alert.alert('Error', 'Please enter some text');
                    return;
                  }

                  const newLine = { text: receiptLineText, size: receiptLineSize };
                  const newSettings = { ...receiptSettings };

                  if (editingReceiptSection === 'header') {
                    if (editingReceiptLineIndex !== null) {
                      newSettings.headerLines[editingReceiptLineIndex] = newLine;
                    } else {
                      if (newSettings.headerLines.length >= 7) {
                        Alert.alert('Maximum Reached', 'You can only have up to 7 header lines');
                        return;
                      }
                      newSettings.headerLines.push(newLine);
                    }
                  } else {
                    if (editingReceiptLineIndex !== null) {
                      newSettings.footerLines[editingReceiptLineIndex] = newLine;
                    } else {
                      if (newSettings.footerLines.length >= 7) {
                        Alert.alert('Maximum Reached', 'You can only have up to 7 footer lines');
                        return;
                      }
                      newSettings.footerLines.push(newLine);
                    }
                  }

                  updateReceiptSettings(newSettings);
                  setReceiptModalVisible(false);
                  setReceiptLineText('');
                  setReceiptLineSize('normal');
                  setEditingReceiptLineIndex(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>

              {editingReceiptLineIndex !== null && (
                <TouchableOpacity
                  style={[styles.deleteDiscountButton, { backgroundColor: colors.error + '20', borderColor: colors.error, marginTop: 12 }]}
                  onPress={() => {
                    const newSettings = { ...receiptSettings };
                    if (editingReceiptSection === 'header') {
                      newSettings.headerLines = newSettings.headerLines.filter((_, i) => i !== editingReceiptLineIndex);
                    } else {
                      newSettings.footerLines = newSettings.footerLines.filter((_, i) => i !== editingReceiptLineIndex);
                    }
                    updateReceiptSettings(newSettings);
                    setReceiptModalVisible(false);
                    setReceiptLineText('');
                    setReceiptLineSize('normal');
                    setEditingReceiptLineIndex(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color={colors.error} />
                  <Text style={[styles.deleteDiscountText, { color: colors.error }]}>Delete Line</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
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
  lastSyncText: {
    fontSize: 13,
    fontStyle: 'italic' as const,
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
  colorButton: {
    padding: 8,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  colorPickerModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  customColorSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  customColorLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  customColorInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  customColorInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  applyColorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyColorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  discountList: {
    gap: 10,
    marginBottom: 16,
  },
  discountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  discountItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  addDiscountButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addDiscountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteDiscountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteDiscountText: {
    fontSize: 15,
    fontWeight: '600',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  collapsibleContent: {
    marginTop: -12,
    paddingTop: 16,
  },
  receiptLineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  receiptLineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptLineSize: {
    fontSize: 12,
    marginTop: 2,
  },
});
