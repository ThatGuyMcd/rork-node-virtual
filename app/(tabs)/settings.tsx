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
import type { ProductDisplaySettings, ProductGroup, Department, DiscountSettings, GratuitySettings, PrinterSettings, ReceiptLineSize } from '@/types/pos';
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
    setExpandedSections(prev => {
      const isCurrentlyExpanded = prev[section];
      if (isCurrentlyExpanded) {
        return {
          ...prev,
          [section]: false,
        };
      } else {
        const allClosed: Record<string, boolean> = {};
        Object.keys(prev).forEach(key => {
          allClosed[key] = false;
        });
        return {
          ...allClosed,
          [section]: true,
        };
      }
    });
  };

  const expandedSection = useMemo(() => {
    return Object.keys(expandedSections).find(key => expandedSections[key]) || null;
  }, [expandedSections]);

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
      <View style={[styles.section, styles.sectionFixedWidth, isExpanded && styles.sectionExpanded]}>
        <TouchableOpacity
          style={[styles.collapsibleHeader, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
          onPress={() => toggleSection(id)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderContent}>
            <View style={[styles.iconCircle, { backgroundColor: iconColor + '20' }]}>
              <Icon size={28} color={iconColor} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
          </View>
          <View style={styles.chevronContainer}>
            {isExpanded ? (
              <ChevronUp size={20} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={20} color={colors.textSecondary} />
            )}
          </View>
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

  const renderAccountContent = () => (
    <>
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

      {!siteInfo && (
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
      )}
    </>
  );

  const renderDataSyncContent = () => (
    <>
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
    </>
  );

  const renderAppearanceContent = () => (
    <>
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
    </>
  );

  // [CONTINUES IN NEXT FILE CHUNK...]
