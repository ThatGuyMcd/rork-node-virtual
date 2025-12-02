import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const CollapsibleSection = React.memo(({ 
  id, 
  icon: Icon, 
  title, 
  iconColor, 
  children,
  expandedSections,
  toggleSection,
  colors
}: { 
  id: string; 
  icon: any; 
  title: string; 
  iconColor: string; 
  children: React.ReactNode;
  expandedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  colors: any;
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
});

CollapsibleSection.displayName = 'CollapsibleSection';

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
  const printerIPInputRef = useRef('');
  const printerPortInputRef = useRef('9100');
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [editingReceiptSection, setEditingReceiptSection] = useState<'header' | 'footer'>('header');
  const [editingReceiptLineIndex, setEditingReceiptLineIndex] = useState<number | null>(null);
  const [receiptLineText, setReceiptLineText] = useState('');
  const [receiptLineSize, setReceiptLineSize] = useState<ReceiptLineSize>('normal');
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    account: true,
    dataSync: false,
    reportsConsolidation: false,
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

  const scrollViewRef = useRef<ScrollView>(null);

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
      if (settings.ipAddress) {
        setPrinterIPInput(settings.ipAddress);
        printerIPInputRef.current = settings.ipAddress;
      }
      if (settings.port) {
        setPrinterPortInput(settings.port.toString());
        printerPortInputRef.current = settings.port.toString();
      }
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

  const changeDepartmentSortOrder = async (departmentId: string, sortOrder: 'plu' | 'alphabetical') => {
    const newSettings = { ...productSettings };
    if (!newSettings.departmentSortOrders) {
      newSettings.departmentSortOrders = {};
    }
    newSettings.departmentSortOrders[departmentId] = sortOrder;
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
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
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
        <View style={[styles.progressCard, { backgroundColor: colors.cardBackground, borderColor: '#f97316', borderWidth: 2, borderStyle: 'dotted' }]}>
          <Text style={[styles.progressPhase, { color: '#f97316' }]}>
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

    </>
  );

  const renderReportsConsolidationContent = () => (
    <>
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
                <ScrollView style={{ maxHeight: 600 }} nestedScrollEnabled>
                  {departments.map((department) => {
                    const isHidden = productSettings.hiddenDepartmentIds.includes(department.id);
                    const group = groups.find(g => g.id === department.groupId);
                    const departmentSortOrder = productSettings.departmentSortOrders?.[department.id] || 'plu';
                    return (
                      <View key={department.id} style={[styles.departmentCard, { backgroundColor: colors.background, borderColor: colors.border }, isHidden && { opacity: 0.5 }]}>
                        <View style={styles.departmentHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.filterItemText, { color: colors.text }]}>{department.name}</Text>
                            {group && (
                              <Text style={[styles.filterItemSubtext, { color: colors.textTertiary }]}>in {group.name}</Text>
                            )}
                          </View>
                          
                          <TouchableOpacity
                            onPress={() => openColorPicker('department', department.id)}
                            style={[styles.colorButtonLarge, { backgroundColor: getItemColor('department', department.id) ? getItemColor('department', department.id) + '20' : colors.inputBackground, borderColor: getItemColor('department', department.id) || colors.border }]}
                            activeOpacity={0.7}
                          >
                            <Paintbrush size={18} color={getItemColor('department', department.id) || colors.primary} />
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            onPress={() => toggleDepartmentVisibility(department.id)}
                            activeOpacity={0.7}
                          >
                            {isHidden ? (
                              <EyeOff size={20} color={colors.textTertiary} />
                            ) : (
                              <Eye size={20} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        </View>
                        
                        {!isHidden && (
                          <View style={styles.departmentSortSection}>
                            <TouchableOpacity
                              style={[
                                styles.layoutOption,
                                { backgroundColor: colors.inputBackground, borderColor: colors.border, flex: 1 },
                                departmentSortOrder === 'plu' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                              ]}
                              onPress={() => changeDepartmentSortOrder(department.id, 'plu')}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.layoutOptionTitle, { color: colors.text, fontSize: 13 }]}>By PLU</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.layoutOption,
                                { backgroundColor: colors.inputBackground, borderColor: colors.border, flex: 1 },
                                departmentSortOrder === 'alphabetical' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                              ]}
                              onPress={() => changeDepartmentSortOrder(department.id, 'alphabetical')}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.layoutOptionTitle, { color: colors.text, fontSize: 13 }]}>Alphabetical</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </View>
    </>
  );

  const renderPaymentSettingsContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Cash Payments</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Allow customers to pay with cash</Text>
          </View>
          <Switch
            value={cashPaymentEnabled}
            onValueChange={updateCashPaymentEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Card Payments</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Allow customers to pay with card</Text>
          </View>
          <Switch
            value={cardPaymentEnabled}
            onValueChange={updateCardPaymentEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {cardPaymentEnabled && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Card Machine Provider</Text>
          
          <TouchableOpacity
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => setShowProviderDropdown(!showProviderDropdown)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, { color: colors.text }]}>
              {cardMachineProvider === 'Teya' ? 'Teya' : 'None'}
            </Text>
            <ChevronDown size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {showProviderDropdown && (
            <View style={[styles.dropdown, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              {['Teya', 'None'].map((provider) => (
                <TouchableOpacity
                  key={provider}
                  style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    updateCardMachineProvider(provider as 'Teya' | 'None');
                    setShowProviderDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                    {provider}
                  </Text>
                  {cardMachineProvider === provider && (
                    <CheckCircle size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Split Payments</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Allow customers to split payment across multiple methods</Text>
          </View>
          <Switch
            value={splitPaymentsEnabled}
            onValueChange={updateSplitPaymentsEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Allow Change</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Enable giving change to customers</Text>
          </View>
          <Switch
            value={changeAllowed}
            onValueChange={updateChangeAllowed}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Allow Cashback</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Allow cashback on non-cash tenders when change is enabled</Text>
          </View>
          <Switch
            value={cashbackAllowed}
            onValueChange={updateCashbackAllowed}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>
    </>
  );

  const renderBasketSettingsContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Table Selection Required</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Require table selection before placing orders</Text>
          </View>
          <Switch
            value={tableSelectionRequired}
            onValueChange={handleTableSelectionToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Refund Button</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Show refund button on basket screen</Text>
          </View>
          <Switch
            value={refundButtonEnabled}
            onValueChange={updateRefundButtonEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Preset Discount Percentages</Text>
        <View style={styles.discountPercentagesList}>
          {discountPercentages.map((percentage, index) => (
            <View key={index} style={[styles.discountPercentageItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.discountPercentageText, { color: colors.text }]}>{percentage}%</Text>
              <TouchableOpacity
                onPress={() => {
                  const newPercentages = discountPercentages.filter((_, i) => i !== index);
                  setDiscountPercentages(newPercentages);
                  updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                }}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
          onPress={() => {
            setEditingDiscountIndex(null);
            setDiscountInputValue('');
            setDiscountModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Percent size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Add Discount Percentage</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Gratuity</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Allow adding tips to transactions</Text>
          </View>
          <Switch
            value={gratuitySettings.enabled}
            onValueChange={(value) => updateGratuitySettings({ ...gratuitySettings, enabled: value })}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {gratuitySettings.enabled && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Preset Gratuity Percentages</Text>
          <View style={styles.discountPercentagesList}>
            {gratuityPercentages.map((percentage, index) => (
              <View key={index} style={[styles.discountPercentageItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.discountPercentageText, { color: colors.text }]}>{percentage}%</Text>
                <TouchableOpacity
                  onPress={() => {
                    const newPercentages = gratuityPercentages.filter((_, i) => i !== index);
                    setGratuityPercentages(newPercentages);
                    updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                  }}
                  activeOpacity={0.7}
                >
                  <X size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
            onPress={() => {
              setEditingGratuityIndex(null);
              setGratuityInputValue('');
              setGratuityModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Percent size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Add Gratuity Percentage</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderDiscountContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Preset Discount Percentages</Text>
        <View style={styles.discountPercentagesList}>
          {discountPercentages.map((percentage, index) => (
            <View key={index} style={[styles.discountPercentageItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.discountPercentageText, { color: colors.text }]}>{percentage}%</Text>
              <TouchableOpacity
                onPress={() => {
                  const newPercentages = discountPercentages.filter((_, i) => i !== index);
                  setDiscountPercentages(newPercentages);
                  updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                }}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
          onPress={() => {
            setEditingDiscountIndex(null);
            setDiscountInputValue('');
            setDiscountModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Percent size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Add Percentage</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderGratuityContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Gratuity</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Allow adding tips to transactions</Text>
          </View>
          <Switch
            value={gratuitySettings.enabled}
            onValueChange={(value) => updateGratuitySettings({ ...gratuitySettings, enabled: value })}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {gratuitySettings.enabled && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Preset Gratuity Percentages</Text>
          <View style={styles.discountPercentagesList}>
            {gratuityPercentages.map((percentage, index) => (
              <View key={index} style={[styles.discountPercentageItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.discountPercentageText, { color: colors.text }]}>{percentage}%</Text>
                <TouchableOpacity
                  onPress={() => {
                    const newPercentages = gratuityPercentages.filter((_, i) => i !== index);
                    setGratuityPercentages(newPercentages);
                    updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                  }}
                  activeOpacity={0.7}
                >
                  <X size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
            onPress={() => {
              setEditingGratuityIndex(null);
              setGratuityInputValue('');
              setGratuityModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Percent size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Add Percentage</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderPrinterContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Connection Type</Text>
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
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Network</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {printerSettings.connectionType === 'network' && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>IP Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={printerIPInput}
            onChangeText={(text) => {
              printerIPInputRef.current = text;
              setPrinterIPInput(text);
            }}
            placeholder="192.168.1.100"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { marginTop: 16, color: colors.textSecondary }]}>Port</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={printerPortInput}
            onChangeText={(text) => {
              printerPortInputRef.current = text;
              setPrinterPortInput(text);
            }}
            placeholder="9100"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Paper Width</Text>
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
            <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>58mm</Text>
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
            <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>80mm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {printerSettings.isConnected ? (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={[styles.statusBadge, { backgroundColor: '#10b98120' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Text style={[styles.statusText, { color: '#10b981' }]}>Printer Connected</Text>
          </View>
          {printerSettings.deviceName && (
            <Text style={[styles.deviceName, { color: colors.textSecondary }]}>{printerSettings.deviceName}</Text>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accent, flex: 1 }]}
              onPress={handleTestPrint}
              activeOpacity={0.8}
            >
              <Printer size={20} color="#ffffff" />
              <Text style={styles.buttonText}>Test Print</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger, { flex: 1 }]}
              onPress={handleDisconnectPrinter}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }, isConnectingPrinter && { opacity: 0.7 }]}
          onPress={printerSettings.connectionType === 'bluetooth' ? handleConnectBluetooth : handleConnectNetwork}
          disabled={isConnectingPrinter}
          activeOpacity={0.8}
        >
          {isConnectingPrinter ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Printer size={20} color="#ffffff" />
              <Text style={styles.buttonText}>Connect Printer</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Cash Drawer</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Open cash drawer when printing receipts</Text>
          </View>
          <Switch
            value={printerSettings.cashDrawerEnabled}
            onValueChange={handleCashDrawerToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {printerSettings.cashDrawerEnabled && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Cash Drawer Voltage</Text>
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
      )}

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Receipt Header</Text>
        <View style={styles.receiptLinesContainer}>
          {receiptSettings.headerLines.map((line, index) => (
            <View key={index} style={[styles.receiptLineItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.receiptLineText, { color: colors.text, fontSize: line.size === 'large' ? 18 : line.size === 'small' ? 12 : 14 }]}>{line.text}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const newLines = receiptSettings.headerLines.filter((_, i) => i !== index);
                  updateReceiptSettings({ ...receiptSettings, headerLines: newLines });
                }}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
          onPress={() => {
            setEditingReceiptSection('header');
            setEditingReceiptLineIndex(null);
            setReceiptLineText('');
            setReceiptLineSize('normal');
            setReceiptModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <FileText size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Add Header Line</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>Receipt Footer</Text>
        <View style={styles.receiptLinesContainer}>
          {receiptSettings.footerLines.map((line, index) => (
            <View key={index} style={[styles.receiptLineItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.receiptLineText, { color: colors.text, fontSize: line.size === 'large' ? 18 : line.size === 'small' ? 12 : 14 }]}>{line.text}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const newLines = receiptSettings.footerLines.filter((_, i) => i !== index);
                  updateReceiptSettings({ ...receiptSettings, footerLines: newLines });
                }}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
          onPress={() => {
            setEditingReceiptSection('footer');
            setEditingReceiptLineIndex(null);
            setReceiptLineText('');
            setReceiptLineSize('normal');
            setReceiptModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <FileText size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Add Footer Line</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderInitialSetupContent = () => (
    <>
      {!isInitialSetupComplete && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Complete initial setup to enable POS functionality</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={() => {
              completeInitialSetup();
              Alert.alert('Setup Complete', 'Initial setup has been completed!');
            }}
            activeOpacity={0.8}
          >
            <CheckCircle size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Complete Setup</Text>
          </TouchableOpacity>
        </View>
      )}
      {isInitialSetupComplete && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={[styles.statusBadge, { backgroundColor: '#10b98120' }]}>
            <CheckCircle size={20} color="#10b981" />
            <Text style={[styles.statusText, { color: '#10b981' }]}>Setup Complete</Text>
          </View>
        </View>
      )}
    </>
  );

  const renderDangerZoneContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>This will remove all synced data, credentials, and reset the app to its initial state.</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={handleClearData}
        activeOpacity={0.8}
      >
        <Trash2 size={20} color="#ffffff" />
        <Text style={styles.buttonText}>Clear All Data</Text>
      </TouchableOpacity>
    </>
  );

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'account':
        return renderAccountContent();
      case 'dataSync':
        return renderDataSyncContent();
      case 'reportsConsolidation':
        return renderReportsConsolidationContent();
      case 'appearance':
        return renderAppearanceContent();
      case 'payment':
        return renderPaymentSettingsContent();
      case 'pos':
        return renderBasketSettingsContent();
      case 'printer':
        return renderPrinterContent();
      case 'initialSetup':
        return renderInitialSetupContent();
      case 'danger':
        return renderDangerZoneContent();
      default:
        return null;
    }
  };

  const sections = [
    { id: 'account', icon: LogIn, title: 'Account', color: '#3b82f6', order: siteInfo ? 1 : 1 },
    { id: 'dataSync', icon: Database, title: 'Sync Data', color: '#10b981', order: siteInfo ? 2 : 999 },
    { id: 'reportsConsolidation', icon: FileText, title: 'Sales & Reports', color: '#f97316', order: siteInfo ? 3 : 2 },
    { id: 'appearance', icon: Palette, title: 'Appearance', color: '#8b5cf6', order: 4 },
    { id: 'payment', icon: CreditCard, title: 'Payment Settings', color: '#06b6d4', order: 5 },
    { id: 'pos', icon: LayoutGrid, title: 'Basket Settings', color: '#f59e0b', order: 6 },
    { id: 'printer', icon: Printer, title: 'Printer Settings', color: '#6366f1', order: 7 },
    { id: 'initialSetup', icon: SettingsIcon, title: 'Initial Setup', color: '#84cc16', order: 8 },
    { id: 'danger', icon: Trash2, title: 'Danger Zone', color: '#ef4444', order: 9 },
  ];

  const sortedSections = sections
    .filter(section => {
      if (section.id === 'dataSync' && !siteInfo) return false;
      return true;
    })
    .sort((a, b) => {
      const aExpanded = expandedSections[a.id];
      const bExpanded = expandedSections[b.id];
      if (aExpanded && !bExpanded) return -1;
      if (!aExpanded && bExpanded) return 1;
      return a.order - b.order;
    });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionsGrid}>
          {sortedSections.map((section) => (
            <CollapsibleSection
              key={section.id}
              id={section.id}
              icon={section.icon}
              title={section.title}
              iconColor={section.color}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              colors={colors}
            >
              {renderSectionContent(section.id)}
            </CollapsibleSection>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={colorPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setColorPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Color</Text>
            
            <View style={styles.colorGrid}>
              {[
                '#ef4444', '#f97316', '#f59e0b', '#eab308',
                '#84cc16', '#22c55e', '#10b981', '#14b8a6',
                '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
                '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
              ].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }]}
                  onPress={() => setCustomColor(color)}
                  activeOpacity={0.7}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Custom Color</Text>
            <View style={styles.customColorRow}>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={customColorInput}
                onChangeText={setCustomColorInput}
                placeholder="#FF5733"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={applyCustomColor}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Apply</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.textTertiary, marginTop: 16 }]}
              onPress={() => setColorPickerVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={discountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Discount Percentage</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>Percentage</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
              value={discountInputValue}
              onChangeText={setDiscountInputValue}
              placeholder="10"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setDiscountModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => {
                  const value = parseFloat(discountInputValue);
                  if (!isNaN(value) && value > 0 && value <= 100) {
                    const newPercentages = [...discountPercentages, discountInputValue];
                    setDiscountPercentages(newPercentages);
                    updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                    setDiscountModalVisible(false);
                  } else {
                    Alert.alert('Invalid Input', 'Please enter a valid percentage between 0 and 100');
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={gratuityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGratuityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Gratuity Percentage</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>Percentage</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
              value={gratuityInputValue}
              onChangeText={setGratuityInputValue}
              placeholder="15"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setGratuityModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => {
                  const value = parseFloat(gratuityInputValue);
                  if (!isNaN(value) && value > 0 && value <= 100) {
                    const newPercentages = [...gratuityPercentages, gratuityInputValue];
                    setGratuityPercentages(newPercentages);
                    updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                    setGratuityModalVisible(false);
                  } else {
                    Alert.alert('Invalid Input', 'Please enter a valid percentage between 0 and 100');
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={receiptModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Receipt Line</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>Text</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
              value={receiptLineText}
              onChangeText={setReceiptLineText}
              placeholder="Enter receipt line text"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Size</Text>
            <View style={styles.layoutOptions}>
              {['small', 'normal', 'large'].map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.layoutOption,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    receiptLineSize === size && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setReceiptLineSize(size as ReceiptLineSize)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>{size.charAt(0).toUpperCase() + size.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setReceiptModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => {
                  if (!receiptLineText.trim()) {
                    Alert.alert('Error', 'Please enter text for the receipt line');
                    return;
                  }

                  const newLine = { text: receiptLineText, size: receiptLineSize };
                  if (editingReceiptSection === 'header') {
                    updateReceiptSettings({ ...receiptSettings, headerLines: [...receiptSettings.headerLines, newLine] });
                  } else {
                    updateReceiptSettings({ ...receiptSettings, footerLines: [...receiptSettings.footerLines, newLine] });
                  }
                  setReceiptModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 20,
    rowGap: 5,
  },
  section: {
    marginBottom: 16,
  },
  sectionFixedWidth: {
    width: '47%',
  },
  sectionExpanded: {
    width: '100%',
    order: -1,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    height: 140,
  },
  sectionHeaderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingRight: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  chevronContainer: {
    padding: 4,
  },
  collapsibleContent: {
    marginTop: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  subValue: {
    fontSize: 14,
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  rememberText: {
    fontSize: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  progressPhase: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
  },
  lastSyncText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  settingRowColumn: {
    gap: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  layoutOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  layoutOption: {
    flex: 1,
    minWidth: 100,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutOptionSelected: {
    borderWidth: 2,
  },
  layoutOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  filterItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  filterItemSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  colorButton: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  customColorRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
  },
  dropdown: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deviceName: {
    fontSize: 14,
    marginTop: 8,
  },
  discountPercentagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  discountPercentageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  discountPercentageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  receiptLinesContainer: {
    gap: 8,
  },
  receiptLineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  receiptLineText: {
    fontWeight: '500',
  },
  departmentCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    gap: 12,
  },
  departmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  departmentNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorButtonLarge: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  departmentSortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
});
