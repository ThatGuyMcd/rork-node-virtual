import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
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
  PanResponder,
  FlatList,
} from 'react-native';

import { RefreshCw, LogIn, Database, Trash2, Settings as SettingsIcon, LayoutGrid, Layers, Sun, Moon, Palette, MonitorSmartphone, CheckCircle, CreditCard, ChevronDown, Filter, Eye, EyeOff, AlertTriangle, Paintbrush, X, FileText, Percent, Printer, Bluetooth, Wifi, ArrowUp, ArrowDown, Info, Server, Users, Menu, Loader, Edit2, Download } from 'lucide-react-native';
import { dataSyncService, type SyncProgress } from '@/services/dataSync';
import { apiClient } from '@/services/api';
import { trpcClient } from '@/lib/trpc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { printerService } from '@/services/printerService';
import { transactionUploadService } from '@/services/transactionUploadService';
import { useRouter } from 'expo-router';
import type { ProductDisplaySettings, ProductGroup, Department, DiscountSettings, GratuitySettings, PrinterSettings, ReceiptLineSize } from '@/types/pos';
import { usePOS } from '@/contexts/POSContext';
import { useTheme, type ThemeName, type ThemePreference, type ButtonSkin } from '@/contexts/ThemeContext';
import { Colors, type ThemeColors } from '@/constants/colors';
import { hexToRgb, rgbToHex } from '@/utils/colorUtils';

const CollapsibleSection = memo(({ 
  id, 
  icon: Icon, 
  title, 
  iconColor, 
  children,
  isExpanded,
  onToggle,
  colors,
  buttonSkin,
}: { 
  id: string; 
  icon: any; 
  title: string; 
  iconColor: string; 
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  colors: any;
  buttonSkin: ButtonSkin;
}) => {
  const buttonSkinStyle = useMemo(() => getButtonSkinStyleStatic(buttonSkin, colors.cardBackground), [buttonSkin, colors.cardBackground]);
  const overlayStyle = useMemo(() => getButtonOverlayStyleStatic(buttonSkin), [buttonSkin]);
  const iconBgColor = useMemo(() => iconColor + '20', [iconColor]);
  
  return (
    <View style={[styles.section, styles.sectionFixedWidth, isExpanded && styles.sectionExpanded]}>
      <TouchableOpacity
        style={[
          styles.collapsibleHeader, 
          { borderColor: colors.border, backgroundColor: colors.cardBackground },
          buttonSkinStyle
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        {overlayStyle && (
          <View style={overlayStyle as any} />
        )}
        <View style={styles.sectionHeaderContent}>
          <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
            <Icon size={28} color={iconColor} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
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

const getButtonSkinStyleStatic = (skin: ButtonSkin, backgroundColor: string = '#000000') => {
  switch (skin) {
    case 'rounded':
      return {
        borderRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 10,
      };
    case 'sharp':
      return {
        borderRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 0,
        elevation: 4,
      };
    case 'soft':
      return {
        borderRadius: 20,
        shadowColor: backgroundColor,
        shadowOffset: { width: -4, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 0,
      };
    case 'outlined':
      return {
        borderRadius: 16,
        borderWidth: 3,
        borderColor: backgroundColor,
        shadowColor: backgroundColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 0,
      };
    case 'minimal':
      return {
        borderRadius: 8,
        borderWidth: 0,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      };
    case 'default':
    default:
      return {
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
      };
  }
};

const getButtonOverlayStyleStatic = (skin: ButtonSkin) => {
  switch (skin) {
    case 'rounded':
      return {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 28,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderTopColor: 'rgba(255, 255, 255, 0.4)',
        borderLeftColor: 'rgba(255, 255, 255, 0.3)',
        borderBottomWidth: 3,
        borderRightWidth: 3,
        borderBottomColor: 'rgba(0, 0, 0, 0.5)',
        borderRightColor: 'rgba(0, 0, 0, 0.4)',
      };
    case 'sharp':
      return {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 4,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopColor: 'rgba(255, 255, 255, 0.5)',
        borderLeftColor: 'rgba(255, 255, 255, 0.4)',
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomColor: 'rgba(0, 0, 0, 0.6)',
        borderRightColor: 'rgba(0, 0, 0, 0.5)',
      };
    case 'soft':
      return {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
      };
    case 'outlined':
      return {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
      };
    case 'minimal':
      return {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
      };
    default:
      return null;
  }
};

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
  const { theme, themePreference, colors, setTheme, customColors, setCustomColors, buttonSkin, setButtonSkin } = useTheme();
  const [customThemeColors, setCustomThemeColors] = useState<ThemeColors>(customColors || Colors.dark);
  const [customThemeModalVisible, setCustomThemeModalVisible] = useState(false);
  const [editingColorKey, setEditingColorKey] = useState<keyof ThemeColors | null>(null);


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
  const [customColorModalVisible, setCustomColorModalVisible] = useState(false);
  const [customColorRgb, setCustomColorRgb] = useState({ r: 255, g: 87, b: 51 });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [backgroundSyncInterval, setBackgroundSyncInterval] = useState<'disabled' | '6' | '12' | '24'>('disabled');
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
  const redSliderWidth = useRef(300);
  const greenSliderWidth = useRef(300);
  const blueSliderWidth = useRef(300);
  const [isDraggingRed, setIsDraggingRed] = useState(false);
  const [isDraggingGreen, setIsDraggingGreen] = useState(false);
  const [isDraggingBlue, setIsDraggingBlue] = useState(false);
  const [terminalNumber, setTerminalNumber] = useState('01');
  const [terminalNumberModalVisible, setTerminalNumberModalVisible] = useState(false);
  const [terminalNumberInput, setTerminalNumberInput] = useState('');
  const [settingsProfiles, setSettingsProfiles] = useState<Array<{ name: string; timestamp: string }>>([]);
  const [createProfileModalVisible, setCreateProfileModalVisible] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [loadProfileModalVisible, setLoadProfileModalVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isDownloadingProfiles, setIsDownloadingProfiles] = useState(false);
  

  
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
    about: false,
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
    loadBackgroundSyncInterval();
    loadTerminalNumber();
    loadSettingsProfiles();
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

  const loadBackgroundSyncInterval = async () => {
    const interval = await dataSyncService.getBackgroundSyncInterval();
    setBackgroundSyncInterval(interval);
  };

  const loadTerminalNumber = async () => {
    const number = await transactionUploadService.getTerminalNumber();
    setTerminalNumber(number);
  };

  const loadSettingsProfiles = async () => {
    try {
      console.log('[Settings] Loading settings profiles from AsyncStorage...');
      const stored = await AsyncStorage.getItem('pos_settings_profiles');
      console.log('[Settings] Raw stored value:', stored ? `Found (${stored.length} chars)` : 'null');
      
      if (stored) {
        const profiles = JSON.parse(stored);
        console.log('[Settings] Parsed profiles:', JSON.stringify(profiles));
        console.log('[Settings] Profile count:', profiles.length);
        console.log('[Settings] Profile names:', profiles.map((p: any) => p.name).join(', '));
        setSettingsProfiles(profiles);
        console.log('[Settings] Settings profiles state updated with', profiles.length, 'profiles');
      } else {
        console.log('[Settings] No profiles found in AsyncStorage');
        setSettingsProfiles([]);
      }
    } catch (error) {
      console.error('[Settings] Error loading settings profiles:', error);
      console.error('[Settings] Error details:', error instanceof Error ? error.message : String(error));
    }
  };

  const downloadSettingsProfiles = async () => {
    if (!siteInfo) {
      Alert.alert('Error', 'Please link your account first');
      return;
    }

    setIsDownloadingProfiles(true);
    try {
      console.log('[Settings] Downloading settings profiles from server using sync methodology...');
      
      const manifest = await apiClient.getManifest(siteInfo.siteId);
      console.log('[Settings] Manifest loaded:', manifest.length, 'total files');
      
      const profileFiles = manifest.filter(file => {
        const upper = file.path.toUpperCase();
        return upper.startsWith('SETTINGS-PROFILES/') && upper.endsWith('.JSON');
      });
      
      console.log('[Settings] Found', profileFiles.length, 'profile files in manifest');
      
      if (profileFiles.length === 0) {
        Alert.alert('No Profiles', 'No settings profiles found on the server');
        return;
      }

      const downloadedProfiles = [];
      
      for (const fileInfo of profileFiles) {
        try {
          console.log('[Settings] Downloading profile:', fileInfo.path);
          const content = await apiClient.getFile(siteInfo.siteId, fileInfo.path);
          const profileData = JSON.parse(content);
          
          const profileName = profileData.profileName || fileInfo.path.split('/').pop()?.replace('.json', '') || 'Unknown';
          const timestamp = profileData.timestamp || new Date().toISOString();
          const data = profileData.profileData || profileData;
          
          await AsyncStorage.setItem(`pos_settings_profile_${profileName}`, JSON.stringify(data));
          
          downloadedProfiles.push({
            name: profileName,
            timestamp: timestamp,
          });
          
          console.log('[Settings] Downloaded and saved profile:', profileName);
        } catch (fileError) {
          console.error('[Settings] Error downloading profile file:', fileInfo.path, fileError);
        }
      }

      if (downloadedProfiles.length > 0) {
        await AsyncStorage.setItem('pos_settings_profiles', JSON.stringify(downloadedProfiles));
        setSettingsProfiles(downloadedProfiles);
        Alert.alert('Success', `Downloaded ${downloadedProfiles.length} settings profile(s) from server!`);
      } else {
        Alert.alert('Error', 'Failed to download any profiles');
      }
    } catch (error) {
      console.error('[Settings] Error downloading profiles:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to download profiles');
    } finally {
      setIsDownloadingProfiles(false);
    }
  };

  const saveSettingsProfile = async () => {
    const name = profileNameInput.trim();
    if (!name) {
      Alert.alert('Error', 'Please enter a profile name');
      return;
    }

    setIsSavingProfile(true);
    try {
      const profileData = {
        cardPaymentEnabled,
        cashPaymentEnabled,
        cardMachineProvider,
        splitPaymentsEnabled,
        refundButtonEnabled,
        changeAllowed,
        cashbackAllowed,
        discountSettings,
        gratuitySettings,
        tableSelectionRequired,
        productViewLayout,
        productViewMode,
        themePreference,
        customColors,
        buttonSkin,
        productSettings,
        printerSettings,
        receiptSettings,
        backgroundSyncInterval,
        terminalNumber,
      };

      const profile = {
        name,
        timestamp: new Date().toISOString(),
        data: profileData,
      };

      const profiles = [...settingsProfiles];
      const existingIndex = profiles.findIndex(p => p.name === name);
      
      if (existingIndex >= 0) {
        const shouldOverwrite = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Profile Exists',
            `A profile named "${name}" already exists. Do you want to overwrite it?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Overwrite', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
        
        if (!shouldOverwrite) {
          setIsSavingProfile(false);
          return;
        }
        
        profiles[existingIndex] = profile;
      } else {
        profiles.push(profile);
      }

      await AsyncStorage.setItem('pos_settings_profiles', JSON.stringify(profiles));
      await AsyncStorage.setItem(`pos_settings_profile_${name}`, JSON.stringify(profileData));
      
      setSettingsProfiles(profiles);
      setCreateProfileModalVisible(false);
      setProfileNameInput('');
      
      if (siteInfo) {
        console.log('[Settings] Uploading all profiles to server...');
        try {
          const allProfilesData: Record<string, any> = {};
          
          for (const prof of profiles) {
            const profileDataFromStorage = await AsyncStorage.getItem(`pos_settings_profile_${prof.name}`);
            if (profileDataFromStorage) {
              allProfilesData[prof.name] = {
                profileName: prof.name,
                profileData: JSON.parse(profileDataFromStorage),
                timestamp: prof.timestamp,
              };
            }
          }
          
          console.log('[Settings] Uploading', Object.keys(allProfilesData).length, 'profiles');
          
          const uploadResult = await apiClient.uploadSettingsProfiles(
            siteInfo.siteId,
            allProfilesData
          );
          
          if (uploadResult.success) {
            console.log('[Settings] All profiles uploaded successfully');
            Alert.alert('Success', `Settings profile "${name}" saved and synced to server!`);
          } else {
            console.error('[Settings] Profile upload failed:', uploadResult.error);
            Alert.alert('Success', `Settings profile "${name}" saved locally. Server sync failed.`);
          }
        } catch (uploadError) {
          console.error('[Settings] Error uploading profiles:', uploadError);
          Alert.alert('Success', `Settings profile "${name}" saved locally. Server sync failed.`);
        }
      } else {
        Alert.alert('Success', `Settings profile "${name}" saved successfully!`);
      }
    } catch (error) {
      console.error('Error saving settings profile:', error);
      Alert.alert('Error', 'Failed to save settings profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const loadSettingsProfile = async (profileName: string) => {
    setIsLoadingProfile(true);
    try {
      const stored = await AsyncStorage.getItem(`pos_settings_profile_${profileName}`);
      if (!stored) {
        Alert.alert('Error', 'Profile data not found');
        return;
      }

      const profileData = JSON.parse(stored);
      
      if (profileData.cardPaymentEnabled !== undefined) updateCardPaymentEnabled(profileData.cardPaymentEnabled);
      if (profileData.cashPaymentEnabled !== undefined) updateCashPaymentEnabled(profileData.cashPaymentEnabled);
      if (profileData.cardMachineProvider !== undefined) updateCardMachineProvider(profileData.cardMachineProvider);
      if (profileData.splitPaymentsEnabled !== undefined) updateSplitPaymentsEnabled(profileData.splitPaymentsEnabled);
      if (profileData.refundButtonEnabled !== undefined) updateRefundButtonEnabled(profileData.refundButtonEnabled);
      if (profileData.changeAllowed !== undefined) updateChangeAllowed(profileData.changeAllowed);
      if (profileData.cashbackAllowed !== undefined) updateCashbackAllowed(profileData.cashbackAllowed);
      if (profileData.discountSettings) updateDiscountSettings(profileData.discountSettings);
      if (profileData.gratuitySettings) updateGratuitySettings(profileData.gratuitySettings);
      if (profileData.tableSelectionRequired !== undefined) {
        setTableSelectionRequired(profileData.tableSelectionRequired);
        await dataSyncService.setTableSelectionRequired(profileData.tableSelectionRequired);
        updateTableSelectionRequired(profileData.tableSelectionRequired);
      }
      if (profileData.productViewLayout) {
        setProductViewLayout(profileData.productViewLayout);
        await updateProductViewLayout(profileData.productViewLayout);
      }
      if (profileData.productViewMode) {
        setProductViewMode(profileData.productViewMode);
        await updateProductViewMode(profileData.productViewMode);
      }
      if (profileData.themePreference) await setTheme(profileData.themePreference);
      if (profileData.customColors) await setCustomColors(profileData.customColors);
      if (profileData.buttonSkin) await setButtonSkin(profileData.buttonSkin);
      if (profileData.productSettings) {
        setProductSettings(profileData.productSettings);
        await dataSyncService.setProductDisplaySettings(profileData.productSettings);
      }
      if (profileData.printerSettings) {
        setPrinterSettings(profileData.printerSettings);
        await printerService.saveSettings(profileData.printerSettings);
      }
      if (profileData.receiptSettings) updateReceiptSettings(profileData.receiptSettings);
      if (profileData.backgroundSyncInterval) {
        setBackgroundSyncInterval(profileData.backgroundSyncInterval);
        await dataSyncService.setBackgroundSyncInterval(profileData.backgroundSyncInterval);
      }
      if (profileData.terminalNumber) {
        setTerminalNumber(profileData.terminalNumber);
        await transactionUploadService.setTerminalNumber(profileData.terminalNumber);
      }

      setLoadProfileModalVisible(false);
      Alert.alert('Success', `Settings profile "${profileName}" loaded successfully!`);
    } catch (error) {
      console.error('Error loading settings profile:', error);
      Alert.alert('Error', 'Failed to load settings profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const deleteSettingsProfile = async (profileName: string) => {
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete the profile "${profileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const profiles = settingsProfiles.filter(p => p.name !== profileName);
              await AsyncStorage.setItem('pos_settings_profiles', JSON.stringify(profiles));
              await AsyncStorage.removeItem(`pos_settings_profile_${profileName}`);
              setSettingsProfiles(profiles);
              Alert.alert('Success', `Profile "${profileName}" deleted`);
            } catch (error) {
              console.error('Error deleting profile:', error);
              Alert.alert('Error', 'Failed to delete profile');
            }
          },
        },
      ]
    );
  };

  const handleTerminalNumberUpdate = async () => {
    const number = terminalNumberInput.trim();
    if (!number) {
      Alert.alert('Error', 'Please enter a terminal number');
      return;
    }
    if (!/^\d{1,2}$/.test(number)) {
      Alert.alert('Error', 'Terminal number must be 1-2 digits');
      return;
    }
    await transactionUploadService.setTerminalNumber(number);
    setTerminalNumber(number);
    setTerminalNumberModalVisible(false);
    Alert.alert('Success', `Terminal number set to NV${number.padStart(2, '0')}`);
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

  const moveGroupUp = async (groupId: string) => {
    const visibleGroups = groups.filter(g => !productSettings.hiddenGroupIds.includes(g.id));
    const currentOrder = productSettings.customGroupOrder || visibleGroups.map(g => g.id);
    const index = currentOrder.indexOf(groupId);
    if (index > 0) {
      const newOrder = [...currentOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      const newSettings = { ...productSettings, customGroupOrder: newOrder, sortOrder: 'custom' as const };
      setProductSettings(newSettings);
      await dataSyncService.setProductDisplaySettings(newSettings);
    }
  };

  const moveGroupDown = async (groupId: string) => {
    const visibleGroups = groups.filter(g => !productSettings.hiddenGroupIds.includes(g.id));
    const currentOrder = productSettings.customGroupOrder || visibleGroups.map(g => g.id);
    const index = currentOrder.indexOf(groupId);
    if (index < currentOrder.length - 1 && index !== -1) {
      const newOrder = [...currentOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      const newSettings = { ...productSettings, customGroupOrder: newOrder, sortOrder: 'custom' as const };
      setProductSettings(newSettings);
      await dataSyncService.setProductDisplaySettings(newSettings);
    }
  };

  const moveDepartmentUp = async (departmentId: string) => {
    const visibleDepartments = departments.filter(d => !productSettings.hiddenDepartmentIds.includes(d.id));
    const currentOrder = productSettings.customDepartmentOrder || visibleDepartments.map(d => d.id);
    const index = currentOrder.indexOf(departmentId);
    if (index > 0) {
      const newOrder = [...currentOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      const newSettings = { ...productSettings, customDepartmentOrder: newOrder, sortOrder: 'custom' as const };
      setProductSettings(newSettings);
      await dataSyncService.setProductDisplaySettings(newSettings);
    }
  };

  const moveDepartmentDown = async (departmentId: string) => {
    const visibleDepartments = departments.filter(d => !productSettings.hiddenDepartmentIds.includes(d.id));
    const currentOrder = productSettings.customDepartmentOrder || visibleDepartments.map(d => d.id);
    const index = currentOrder.indexOf(departmentId);
    if (index < currentOrder.length - 1 && index !== -1) {
      const newOrder = [...currentOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      const newSettings = { ...productSettings, customDepartmentOrder: newOrder, sortOrder: 'custom' as const };
      setProductSettings(newSettings);
      await dataSyncService.setProductDisplaySettings(newSettings);
    }
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

  const toggleSection = useCallback((section: string) => {
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
  }, []);

  const expandedSection = useMemo(() => 
    Object.keys(expandedSections).find(key => expandedSections[key]) || null
  , [expandedSections]);

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
      await loadSettingsProfiles();
      
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

  const handleDelinkSite = () => {
    Alert.alert(
      'De-link Site',
      'This will remove the site connection and saved credentials. You will need to link again to sync data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'De-link',
          style: 'destructive',
          onPress: async () => {
            await dataSyncService.clearSiteInfo();
            setSiteInfo(null);
            setUsername('');
            setPassword('');
            setRemember(false);
            Alert.alert('Done', 'Site has been de-linked');
          },
        },
      ]
    );
  };

  const renderAccountContent = () => (
    <>
      {siteInfo ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Linked Site</Text>
            <Text style={[styles.value, { color: colors.text }]}>{siteInfo.siteName}</Text>
            <Text style={[styles.subValue, { color: colors.textTertiary }]}>ID: {siteInfo.siteId}</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#ef4444' }]}
            onPress={handleDelinkSite}
            activeOpacity={0.8}
          >
            <LogIn size={20} color="#ffffff" />
            <Text style={styles.buttonText}>De-link Site</Text>
          </TouchableOpacity>
        </>
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

  const handleBackgroundSyncIntervalChange = async (interval: 'disabled' | '6' | '12' | '24') => {
    setBackgroundSyncInterval(interval);
    await dataSyncService.setBackgroundSyncInterval(interval);
    if (interval !== 'disabled') {
      Alert.alert(
        'Background Sync Enabled',
        `Data will automatically sync every ${interval} hours while the app is open. Note: Background sync when the app is closed requires additional native setup and is not available in this version.`,
        [{ text: 'OK' }]
      );
    }
  };

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: syncProgress.total > 1 ? 12 : 0 }}>
            {(() => {
              const message = syncProgress.message;
              const iconColor = '#f97316';
              const iconSize = 20;
              
              if (message.includes('Connecting')) {
                return <Server size={iconSize} color={iconColor} />;
              } else if (message.includes('Product Database')) {
                return <Database size={iconSize} color={iconColor} />;
              } else if (message.includes('Operators')) {
                return <Users size={iconSize} color={iconColor} />;
              } else if (message.includes('Tables')) {
                return <LayoutGrid size={iconSize} color={iconColor} />;
              } else if (message.includes('Functions')) {
                return <SettingsIcon size={iconSize} color={iconColor} />;
              } else if (message.includes('Menus')) {
                return <Menu size={iconSize} color={iconColor} />;
              } else if (message.includes('VAT')) {
                return <Percent size={iconSize} color={iconColor} />;
              } else if (message.includes('Processing')) {
                return <Loader size={iconSize} color={iconColor} />;
              } else if (message.includes('complete')) {
                return <CheckCircle size={iconSize} color='#10b981' />;
              } else {
                return <RefreshCw size={iconSize} color={iconColor} />;
              }
            })()}
            <Text style={[styles.progressPhase, { color: syncProgress.message.includes('complete') ? '#10b981' : '#f97316', flex: 1 }]}>
              {syncProgress.message}
            </Text>
          </View>
          
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
        <View style={styles.settingRowColumn}>
          <View style={styles.settingHeader}>
            <RefreshCw size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Automatic Background Sync</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Automatically sync data at regular intervals while the app is active
              </Text>
            </View>
          </View>
          
          <View style={styles.syncIntervalOptions}>
            <TouchableOpacity
              style={[
                styles.syncIntervalOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                backgroundSyncInterval === 'disabled' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => handleBackgroundSyncIntervalChange('disabled')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Disabled</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.syncIntervalOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                backgroundSyncInterval === '6' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => handleBackgroundSyncIntervalChange('6')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Every 6h</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.syncIntervalOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                backgroundSyncInterval === '12' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => handleBackgroundSyncIntervalChange('12')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Every 12h</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.syncIntervalOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                backgroundSyncInterval === '24' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => handleBackgroundSyncIntervalChange('24')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Every 24h</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {siteInfo && (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.settingHeader}>
            <Database size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Settings Profiles</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Save and load complete settings configurations</Text>
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            {settingsProfiles.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary, textAlign: 'center', marginVertical: 16 }]}>No saved profiles yet</Text>
            ) : (
              <View style={{ gap: 8, marginBottom: 12 }}>
                {settingsProfiles.map((profile) => (
                  <View
                    key={profile.name}
                    style={[styles.profileItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
                      <Text style={[styles.profileTimestamp, { color: colors.textTertiary }]}>
                        {new Date(profile.timestamp).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={styles.profileActions}>
                      <TouchableOpacity
                        onPress={() => loadSettingsProfile(profile.name)}
                        style={[styles.profileActionButton, { backgroundColor: colors.primary }]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.profileActionButtonText, { color: '#ffffff' }]}>Load</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteSettingsProfile(profile.name)}
                        style={[styles.profileActionButton, { backgroundColor: colors.textTertiary }]}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1, marginBottom: 0 }]}
                onPress={() => {
                  setProfileNameInput('');
                  setCreateProfileModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Database size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Save Current Settings</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accent, marginTop: 12, marginBottom: 0 }, isDownloadingProfiles && { opacity: 0.7 }]}
              onPress={downloadSettingsProfiles}
              disabled={isDownloadingProfiles}
              activeOpacity={0.8}
            >
              {isDownloadingProfiles ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Download size={20} color="#ffffff" />
                  <Text style={styles.buttonText}>Download Profiles from Server</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

    </>
  );

  const renderReportsConsolidationContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Terminal Number</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Set unique identifier for this terminal (NV{terminalNumber.padStart(2, '0')})</Text>
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginBottom: 0, paddingVertical: 8, paddingHorizontal: 16 }]}
            onPress={() => {
              setTerminalNumberInput(terminalNumber);
              setTerminalNumberModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { fontSize: 14 }]}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 16 }]}>View transaction history, analytics, and generate reports</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, marginBottom: 0 }]}
          onPress={() => router.push('/reports' as any)}
          activeOpacity={0.8}
        >
          <FileText size={20} color="#ffffff" />
          <Text style={styles.buttonText}>Open Reports</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const openCustomThemeModal = () => {
    setCustomThemeColors(customColors || colors);
    setCustomThemeModalVisible(true);
  };

  const saveCustomTheme = async () => {
    await setCustomColors(customThemeColors);
    await setTheme('custom');
    setCustomThemeModalVisible(false);
  };

  const editColorInCustomTheme = (key: keyof ThemeColors, color: string) => {
    setCustomThemeColors(prev => ({ ...prev, [key]: color }));
  };

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
                <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Light</Text>
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
                <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Dark</Text>
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

          <Text style={[styles.colorSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>Dark Themes</Text>

          <View style={[styles.layoutOptions, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'sunset' && [styles.layoutOptionSelected, { borderColor: '#f97316', backgroundColor: '#f9731620' }],
              ]}
              onPress={() => setTheme('sunset')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Sunset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'ocean' && [styles.layoutOptionSelected, { borderColor: '#0ea5e9', backgroundColor: '#0ea5e920' }],
              ]}
              onPress={() => setTheme('ocean')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Ocean</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'forest' && [styles.layoutOptionSelected, { borderColor: '#22c55e', backgroundColor: '#22c55e20' }],
              ]}
              onPress={() => setTheme('forest')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Forest</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.layoutOptions, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'midnight' && [styles.layoutOptionSelected, { borderColor: '#a855f7', backgroundColor: '#a855f720' }],
              ]}
              onPress={() => setTheme('midnight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Midnight</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'rose' && [styles.layoutOptionSelected, { borderColor: '#f43f5e', backgroundColor: '#f43f5e20' }],
              ]}
              onPress={() => setTheme('rose')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Rose</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'lavender' && [styles.layoutOptionSelected, { borderColor: '#c084fc', backgroundColor: '#c084fc20' }],
              ]}
              onPress={() => setTheme('lavender')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Lavender</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.colorSectionTitle, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>Light Themes</Text>

          <View style={styles.layoutOptions}>
            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'sunsetLight' && [styles.layoutOptionSelected, { borderColor: '#f97316', backgroundColor: '#f9731620' }],
              ]}
              onPress={() => setTheme('sunsetLight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Dawn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'oceanLight' && [styles.layoutOptionSelected, { borderColor: '#0ea5e9', backgroundColor: '#0ea5e920' }],
              ]}
              onPress={() => setTheme('oceanLight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Sky</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'forestLight' && [styles.layoutOptionSelected, { borderColor: '#22c55e', backgroundColor: '#22c55e20' }],
              ]}
              onPress={() => setTheme('forestLight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Meadow</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.layoutOptions, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'midnightLight' && [styles.layoutOptionSelected, { borderColor: '#a855f7', backgroundColor: '#a855f720' }],
              ]}
              onPress={() => setTheme('midnightLight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Twilight</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'roseLight' && [styles.layoutOptionSelected, { borderColor: '#f43f5e', backgroundColor: '#f43f5e20' }],
              ]}
              onPress={() => setTheme('roseLight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Blossom</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                themePreference === 'lavenderLight' && [styles.layoutOptionSelected, { borderColor: '#c084fc', backgroundColor: '#c084fc20' }],
              ]}
              onPress={() => setTheme('lavenderLight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Orchid</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.settingRowColumn}>
          <View style={styles.settingHeader}>
            <Paintbrush size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Button Skins</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Choose button style for group, department, and product buttons in the Products tab
              </Text>
            </View>
          </View>
          
          <View style={styles.layoutOptions}>
            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                buttonSkin === 'default' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => setButtonSkin('default')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Default</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                buttonSkin === 'rounded' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => setButtonSkin('rounded')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Rounded</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                buttonSkin === 'sharp' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => setButtonSkin('sharp')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Sharp</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.layoutOptions, { marginTop: 8 }]}>
            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                buttonSkin === 'soft' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => setButtonSkin('soft')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Soft</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                buttonSkin === 'outlined' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => setButtonSkin('outlined')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Outlined</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layoutOption,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
                buttonSkin === 'minimal' && [styles.layoutOptionSelected, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
              ]}
              onPress={() => setButtonSkin('minimal')}
              activeOpacity={0.7}
            >
              <Text style={[styles.layoutOptionTitle, { color: colors.text }]}>Minimal</Text>
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
                  {(() => {
                    const visibleGroups = groups.filter(g => !productSettings.hiddenGroupIds.includes(g.id));
                    const orderedGroups = productSettings.customGroupOrder
                      ? [...visibleGroups].sort((a, b) => {
                          const aIndex = productSettings.customGroupOrder!.indexOf(a.id);
                          const bIndex = productSettings.customGroupOrder!.indexOf(b.id);
                          if (aIndex === -1) return 1;
                          if (bIndex === -1) return -1;
                          return aIndex - bIndex;
                        })
                      : visibleGroups;
                    
                    return orderedGroups.map((group, index) => {
                      return (
                        <View
                          key={group.id}
                          style={[
                            styles.filterItem,
                            { backgroundColor: colors.background, borderColor: colors.border },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.filterItemText, { color: colors.text }]}>{group.name}</Text>
                          </View>
                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              onPress={() => moveGroupUp(group.id)}
                              style={[styles.arrowButton, index === 0 && { opacity: 0.3 }]}
                              disabled={index === 0}
                              activeOpacity={0.7}
                            >
                              <ArrowUp size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => moveGroupDown(group.id)}
                              style={[styles.arrowButton, index === orderedGroups.length - 1 && { opacity: 0.3 }]}
                              disabled={index === orderedGroups.length - 1}
                              activeOpacity={0.7}
                            >
                              <ArrowDown size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => openColorPicker('group', group.id)}
                              style={[styles.colorButton, getItemColor('group', group.id) && { backgroundColor: getItemColor('group', group.id) + '20', borderRadius: 6 }]}
                              activeOpacity={0.7}
                            >
                              <Paintbrush size={18} color={getItemColor('group', group.id) || colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => toggleGroupVisibility(group.id)}
                              activeOpacity={0.7}
                            >
                              <Eye size={20} color={colors.primary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    });
                  })()}
                  {groups.filter(g => productSettings.hiddenGroupIds.includes(g.id)).map((group) => (
                    <View
                      key={group.id}
                      style={[
                        styles.filterItem,
                        { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.5 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.filterItemText, { color: colors.text }]}>{group.name}</Text>
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => openColorPicker('group', group.id)}
                          style={[styles.colorButton, getItemColor('group', group.id) && { backgroundColor: getItemColor('group', group.id) + '20', borderRadius: 6 }]}
                          activeOpacity={0.7}
                        >
                          <Paintbrush size={18} color={getItemColor('group', group.id) || colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => toggleGroupVisibility(group.id)}
                          activeOpacity={0.7}
                        >
                          <EyeOff size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <View style={{ marginTop: 24 }}>
                <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Visible Departments ({departments.length - productSettings.hiddenDepartmentIds.length}/{departments.length})</Text>
                <ScrollView style={{ maxHeight: 600 }} nestedScrollEnabled>
                  {(() => {
                    const visibleDepartments = departments.filter(d => !productSettings.hiddenDepartmentIds.includes(d.id));
                    const orderedDepartments = productSettings.customDepartmentOrder
                      ? [...visibleDepartments].sort((a, b) => {
                          const aIndex = productSettings.customDepartmentOrder!.indexOf(a.id);
                          const bIndex = productSettings.customDepartmentOrder!.indexOf(b.id);
                          if (aIndex === -1) return 1;
                          if (bIndex === -1) return -1;
                          return aIndex - bIndex;
                        })
                      : visibleDepartments;
                    
                    return orderedDepartments.map((department, index) => {
                      const group = groups.find(g => g.id === department.groupId);
                      const departmentSortOrder = productSettings.departmentSortOrders?.[department.id] || 'plu';
                      return (
                        <View key={department.id} style={[styles.departmentCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <View style={styles.departmentHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.filterItemText, { color: colors.text }]}>{department.name}</Text>
                              {group && (
                                <Text style={[styles.filterItemSubtext, { color: colors.textTertiary }]}>in {group.name}</Text>
                              )}
                            </View>
                            
                            <View style={styles.actionButtons}>
                              <TouchableOpacity
                                onPress={() => moveDepartmentUp(department.id)}
                                style={[styles.arrowButton, index === 0 && { opacity: 0.3 }]}
                                disabled={index === 0}
                                activeOpacity={0.7}
                              >
                                <ArrowUp size={16} color={colors.textSecondary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => moveDepartmentDown(department.id)}
                                style={[styles.arrowButton, index === orderedDepartments.length - 1 && { opacity: 0.3 }]}
                                disabled={index === orderedDepartments.length - 1}
                                activeOpacity={0.7}
                              >
                                <ArrowDown size={16} color={colors.textSecondary} />
                              </TouchableOpacity>
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
                                <Eye size={20} color={colors.primary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          
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
                        </View>
                      );
                    });
                  })()}
                  {departments.filter(d => productSettings.hiddenDepartmentIds.includes(d.id)).map((department) => {
                    const group = groups.find(g => g.id === department.groupId);
                    return (
                      <View key={department.id} style={[styles.departmentCard, { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.5 }]}>
                        <View style={styles.departmentHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.filterItemText, { color: colors.text }]}>{department.name}</Text>
                            {group && (
                              <Text style={[styles.filterItemSubtext, { color: colors.textTertiary }]}>in {group.name}</Text>
                            )}
                          </View>
                          
                          <View style={styles.actionButtons}>
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
                              <EyeOff size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                          </View>
                        </View>
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
            style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
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
        {discountPercentages.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No discount percentages added yet</Text>
        ) : (
          <View style={styles.percentagesList}>
            {discountPercentages.map((percentage, index) => (
              <View key={index} style={[styles.percentageItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.percentageValue, { color: colors.text }]}>{percentage}%</Text>
                <View style={styles.percentageActions}>
                  <TouchableOpacity
                    onPress={() => {
                      if (index > 0) {
                        const newPercentages = [...discountPercentages];
                        [newPercentages[index - 1], newPercentages[index]] = [newPercentages[index], newPercentages[index - 1]];
                        setDiscountPercentages(newPercentages);
                        updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                      }
                    }}
                    style={[styles.percentageActionButton, index === 0 && { opacity: 0.3 }]}
                    disabled={index === 0}
                    activeOpacity={0.7}
                  >
                    <ArrowUp size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (index < discountPercentages.length - 1) {
                        const newPercentages = [...discountPercentages];
                        [newPercentages[index], newPercentages[index + 1]] = [newPercentages[index + 1], newPercentages[index]];
                        setDiscountPercentages(newPercentages);
                        updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                      }
                    }}
                    style={[styles.percentageActionButton, index === discountPercentages.length - 1 && { opacity: 0.3 }]}
                    disabled={index === discountPercentages.length - 1}
                    activeOpacity={0.7}
                  >
                    <ArrowDown size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingDiscountIndex(index);
                      setDiscountInputValue(percentage);
                      setDiscountModalVisible(true);
                    }}
                    style={styles.percentageActionButton}
                    activeOpacity={0.7}
                  >
                    <Edit2 size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const newPercentages = discountPercentages.filter((_, i) => i !== index);
                      setDiscountPercentages(newPercentages);
                      updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                    }}
                    style={styles.percentageActionButton}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        {discountPercentages.length < 9 ? (
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
            <Text style={styles.buttonText}>Add Discount Percentage ({discountPercentages.length}/9)</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.limitReachedBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Info size={16} color={colors.textSecondary} />
            <Text style={[styles.limitReachedText, { color: colors.textSecondary }]}>Maximum of 9 slots reached</Text>
          </View>
        )}
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
          {gratuityPercentages.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No gratuity percentages added yet</Text>
          ) : (
            <View style={styles.percentagesList}>
              {gratuityPercentages.map((percentage, index) => (
                <View key={index} style={[styles.percentageItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.percentageValue, { color: colors.text }]}>{percentage}%</Text>
                  <View style={styles.percentageActions}>
                    <TouchableOpacity
                      onPress={() => {
                        if (index > 0) {
                          const newPercentages = [...gratuityPercentages];
                          [newPercentages[index - 1], newPercentages[index]] = [newPercentages[index], newPercentages[index - 1]];
                          setGratuityPercentages(newPercentages);
                          updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                        }
                      }}
                      style={[styles.percentageActionButton, index === 0 && { opacity: 0.3 }]}
                      disabled={index === 0}
                      activeOpacity={0.7}
                    >
                      <ArrowUp size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (index < gratuityPercentages.length - 1) {
                          const newPercentages = [...gratuityPercentages];
                          [newPercentages[index], newPercentages[index + 1]] = [newPercentages[index + 1], newPercentages[index]];
                          setGratuityPercentages(newPercentages);
                          updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                        }
                      }}
                      style={[styles.percentageActionButton, index === gratuityPercentages.length - 1 && { opacity: 0.3 }]}
                      disabled={index === gratuityPercentages.length - 1}
                      activeOpacity={0.7}
                    >
                      <ArrowDown size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingGratuityIndex(index);
                        setGratuityInputValue(percentage);
                        setGratuityModalVisible(true);
                      }}
                      style={styles.percentageActionButton}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const newPercentages = gratuityPercentages.filter((_, i) => i !== index);
                        setGratuityPercentages(newPercentages);
                        updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                      }}
                      style={styles.percentageActionButton}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
          {gratuityPercentages.length < 9 ? (
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
              <Text style={styles.buttonText}>Add Gratuity Percentage ({gratuityPercentages.length}/9)</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.limitReachedBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Info size={16} color={colors.textSecondary} />
              <Text style={[styles.limitReachedText, { color: colors.textSecondary }]}>Maximum of 9 slots reached</Text>
            </View>
          )}
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

  const renderAboutContent = () => (
    <>
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>App Name</Text>
        <Text style={[styles.value, { color: colors.text }]}>NODE Virtual</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Version</Text>
        <Text style={[styles.value, { color: colors.text }]}>1.0.1</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Developer</Text>
        <Text style={[styles.value, { color: colors.text }]}>Limitless-Tech</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 8 }]}>Description</Text>
        <Text style={[styles.infoText, { color: colors.text }]}>
          A table ordering platform designed for smooth service and modern payments. Supports integration with multiple card machine providers to deliver a diverse, feature-rich card payment experience, while also allowing payments to be recorded directly on any Android device. Built to connect to your main till system through the cloud for streamlined deployment and dependable synchronization.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Platform</Text>
        <Text style={[styles.value, { color: colors.text }]}>Android</Text>
      </View>
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
      case 'about':
        return renderAboutContent();
      case 'danger':
        return renderDangerZoneContent();
      default:
        return null;
    }
  };

  const sections = useMemo(() => [
    { id: 'account', icon: LogIn, title: 'Account Site Settings', color: '#3b82f6', order: siteInfo ? 1 : 1 },
    { id: 'dataSync', icon: Database, title: 'Server Sync Settings', color: '#10b981', order: siteInfo ? 2 : 999 },
    { id: 'reportsConsolidation', icon: FileText, title: 'Sales & Reports', color: '#f97316', order: siteInfo ? 3 : 2 },
    { id: 'appearance', icon: Palette, title: 'Appearance Settings', color: '#8b5cf6', order: 4 },
    { id: 'payment', icon: CreditCard, title: 'Payment Settings', color: '#06b6d4', order: 5 },
    { id: 'pos', icon: LayoutGrid, title: 'Basket Settings', color: '#f59e0b', order: 6 },
    { id: 'printer', icon: Printer, title: 'Printer Settings', color: '#6366f1', order: 7 },
    { id: 'initialSetup', icon: SettingsIcon, title: 'Initial Setup', color: '#84cc16', order: 8 },
    { id: 'about', icon: Info, title: 'About this App', color: '#06b6d4', order: 9 },
    { id: 'danger', icon: Trash2, title: 'Danger Zone', color: '#ef4444', order: 10 },
  ], [siteInfo]);

  const sortedSections = useMemo(() => 
    sections
      .filter(section => {
        if (section.id === 'dataSync' && !siteInfo) return false;
        if (section.id === 'initialSetup' && isInitialSetupComplete) return false;
        return true;
      })
      .sort((a, b) => {
        const aExpanded = expandedSections[a.id];
        const bExpanded = expandedSections[b.id];
        if (aExpanded && !bExpanded) return -1;
        if (!aExpanded && bExpanded) return 1;
        return a.order - b.order;
      })
  , [sections, siteInfo, isInitialSetupComplete, expandedSections]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 50 }]}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ top: 90 }}
      >
        <View style={styles.sectionsGrid}>
          {sortedSections.map((section) => {
            const isExpanded = expandedSections[section.id];
            return (
              <CollapsibleSection
                key={section.id}
                id={section.id}
                icon={section.icon}
                title={section.title}
                iconColor={section.color}
                isExpanded={isExpanded}
                onToggle={() => toggleSection(section.id)}
                colors={colors}
                buttonSkin={buttonSkin}
              >
                {renderSectionContent(section.id)}
              </CollapsibleSection>
            );
          })}
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Color</Text>
              <TouchableOpacity
                onPress={() => setColorPickerVisible(false)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.colorSectionTitle, { color: colors.textSecondary }]}>Preset Colors</Text>
            <ScrollView 
              style={styles.colorPickerScroll}
              contentContainerStyle={styles.colorPickerScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.colorGrid}>
                {[
                  '#b91c1c', '#dc2626', '#ef4444', '#f87171',
                  '#c2410c', '#ea580c', '#f97316', '#fb923c',
                  '#b45309', '#d97706', '#f59e0b', '#fbbf24',
                  '#4d7c0f', '#65a30d', '#84cc16', '#a3e635',
                  '#15803d', '#16a34a', '#22c55e', '#4ade80',
                  '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4',
                  '#0e7490', '#0891b2', '#06b6d4', '#22d3ee',
                  '#0369a1', '#0284c7', '#0ea5e9', '#38bdf8',
                  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa',
                  '#4338ca', '#4f46e5', '#6366f1', '#818cf8',
                  '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa',
                  '#7e22ce', '#9333ea', '#a855f7', '#c084fc',
                  '#a21caf', '#c026d3', '#d946ef', '#e879f9',
                  '#be185d', '#db2777', '#ec4899', '#f472b6',
                ].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorOption, { backgroundColor: color }]}
                    onPress={() => setCustomColor(color)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.colorSectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>Custom Color</Text>
            <TouchableOpacity
              style={[styles.customColorButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              onPress={() => {
                setCustomColorModalVisible(true);
                if (customColorInput) {
                  const rgb = hexToRgb(customColorInput);
                  if (rgb) {
                    setCustomColorRgb(rgb);
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.customColorPreview, { backgroundColor: rgbToHex(customColorRgb.r, customColorRgb.g, customColorRgb.b) }]} />
              <Text style={[styles.customColorButtonText, { color: colors.text }]}>Create Custom Color</Text>
              <Palette size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={customColorModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomColorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Custom Color</Text>
            
            <View style={[styles.customColorPreviewLarge, { backgroundColor: rgbToHex(customColorRgb.r, customColorRgb.g, customColorRgb.b) }]} />
            <Text style={[styles.hexDisplay, { color: colors.text }]}>{rgbToHex(customColorRgb.r, customColorRgb.g, customColorRgb.b).toUpperCase()}</Text>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <View style={styles.sliderLabelContainer}>
                  <View style={[styles.sliderColorDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={[styles.sliderLabel, { color: colors.text }]}>Red</Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.text }]}>{Math.round(customColorRgb.r)}</Text>
              </View>
              <View
                style={[styles.sliderTrack, { backgroundColor: colors.border }]}
                onLayout={(event) => {
                  redSliderWidth.current = event.nativeEvent.layout.width;
                }}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: (event) => {
                    setIsDraggingRed(true);
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = redSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderMove: (event) => {
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = redSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderRelease: () => {
                    setIsDraggingRed(false);
                  },
                }).panHandlers}
              >
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: '#ef4444',
                      left: `${((customColorRgb.r || 0) / 255) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderInputContainer}>
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, prev.r - 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.sliderInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={String(Math.round(customColorRgb.r))}
                  onChangeText={(text) => {
                    const val = parseInt(text) || 0;
                    setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, Math.min(255, val)) }));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, r: Math.min(255, prev.r + 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <View style={styles.sliderLabelContainer}>
                  <View style={[styles.sliderColorDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={[styles.sliderLabel, { color: colors.text }]}>Green</Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.text }]}>{Math.round(customColorRgb.g)}</Text>
              </View>
              <View
                style={[styles.sliderTrack, { backgroundColor: colors.border }]}
                onLayout={(event) => {
                  greenSliderWidth.current = event.nativeEvent.layout.width;
                }}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: (event) => {
                    setIsDraggingGreen(true);
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = greenSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderMove: (event) => {
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = greenSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderRelease: () => {
                    setIsDraggingGreen(false);
                  },
                }).panHandlers}
              >
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: '#22c55e',
                      left: `${((customColorRgb.g || 0) / 255) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderInputContainer}>
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, prev.g - 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.sliderInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={String(Math.round(customColorRgb.g))}
                  onChangeText={(text) => {
                    const val = parseInt(text) || 0;
                    setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, Math.min(255, val)) }));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, g: Math.min(255, prev.g + 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <View style={styles.sliderLabelContainer}>
                  <View style={[styles.sliderColorDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={[styles.sliderLabel, { color: colors.text }]}>Blue</Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.text }]}>{Math.round(customColorRgb.b)}</Text>
              </View>
              <View
                style={[styles.sliderTrack, { backgroundColor: colors.border }]}
                onLayout={(event) => {
                  blueSliderWidth.current = event.nativeEvent.layout.width;
                }}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: (event) => {
                    setIsDraggingBlue(true);
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = blueSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderMove: (event) => {
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = blueSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderRelease: () => {
                    setIsDraggingBlue(false);
                  },
                }).panHandlers}
              >
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: '#3b82f6',
                      left: `${((customColorRgb.b || 0) / 255) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderInputContainer}>
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, prev.b - 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.sliderInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={String(Math.round(customColorRgb.b))}
                  onChangeText={(text) => {
                    const val = parseInt(text) || 0;
                    setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, Math.min(255, val)) }));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, b: Math.min(255, prev.b + 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setCustomColorModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => {
                  const hexColor = rgbToHex(customColorRgb.r, customColorRgb.g, customColorRgb.b);
                  setCustomColor(hexColor);
                  setCustomColorModalVisible(false);
                  setColorPickerVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Apply</Text>
              </TouchableOpacity>
            </View>
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingDiscountIndex !== null ? 'Edit Discount Percentage' : 'Add Discount Percentage'}</Text>
            
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
                    if (editingDiscountIndex !== null) {
                      const newPercentages = [...discountPercentages];
                      newPercentages[editingDiscountIndex] = discountInputValue;
                      setDiscountPercentages(newPercentages);
                      updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                      setDiscountModalVisible(false);
                    } else {
                      if (discountPercentages.length >= 9) {
                        Alert.alert('Limit Reached', 'You can only have up to 9 discount percentages');
                        return;
                      }
                      const newPercentages = [...discountPercentages, discountInputValue];
                      setDiscountPercentages(newPercentages);
                      updateDiscountSettings({ ...discountSettings, presetPercentages: newPercentages.map(Number) });
                      setDiscountModalVisible(false);
                    }
                  } else {
                    Alert.alert('Invalid Input', 'Please enter a valid percentage between 0 and 100');
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{editingDiscountIndex !== null ? 'Save' : 'Add'}</Text>
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingGratuityIndex !== null ? 'Edit Gratuity Percentage' : 'Add Gratuity Percentage'}</Text>
            
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
                    if (editingGratuityIndex !== null) {
                      const newPercentages = [...gratuityPercentages];
                      newPercentages[editingGratuityIndex] = gratuityInputValue;
                      setGratuityPercentages(newPercentages);
                      updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                      setGratuityModalVisible(false);
                    } else {
                      if (gratuityPercentages.length >= 9) {
                        Alert.alert('Limit Reached', 'You can only have up to 9 gratuity percentages');
                        return;
                      }
                      const newPercentages = [...gratuityPercentages, gratuityInputValue];
                      setGratuityPercentages(newPercentages);
                      updateGratuitySettings({ ...gratuitySettings, presetPercentages: newPercentages.map(Number) });
                      setGratuityModalVisible(false);
                    }
                  } else {
                    Alert.alert('Invalid Input', 'Please enter a valid percentage between 0 and 100');
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{editingGratuityIndex !== null ? 'Save' : 'Add'}</Text>
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

      <Modal
        visible={customThemeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomThemeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.customThemeModalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Custom Theme</Text>
              <TouchableOpacity
                onPress={() => setCustomThemeModalVisible(false)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.themeColorsList}
              showsVerticalScrollIndicator={true}
            >
              {Object.entries(customThemeColors).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.themeColorItem, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => {
                    setEditingColorKey(key as keyof ThemeColors);
                    const rgb = hexToRgb(value);
                    if (rgb) {
                      setCustomColorRgb(rgb);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeColorInfo}>
                    <Text style={[styles.themeColorKey, { color: colors.text }]}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                    </Text>
                    <Text style={[styles.themeColorValue, { color: colors.textSecondary }]}>{value}</Text>
                  </View>
                  <View style={[styles.themeColorPreview, { backgroundColor: value, borderColor: colors.border }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setCustomThemeModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={saveCustomTheme}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Save & Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editingColorKey !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingColorKey(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingColorKey ? editingColorKey.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()) : 'Edit Color'}
              </Text>
              <TouchableOpacity
                onPress={() => setEditingColorKey(null)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.customColorPreviewLarge, { backgroundColor: rgbToHex(customColorRgb.r, customColorRgb.g, customColorRgb.b) }]} />
            <Text style={[styles.hexDisplay, { color: colors.text }]}>{rgbToHex(customColorRgb.r, customColorRgb.g, customColorRgb.b).toUpperCase()}</Text>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <View style={styles.sliderLabelContainer}>
                  <View style={[styles.sliderColorDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={[styles.sliderLabel, { color: colors.text }]}>Red</Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.text }]}>{Math.round(customColorRgb.r)}</Text>
              </View>
              <View
                style={[styles.sliderTrack, { backgroundColor: colors.border }]}
                onLayout={(event) => {
                  redSliderWidth.current = event.nativeEvent.layout.width;
                }}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: (event) => {
                    setIsDraggingRed(true);
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = redSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderMove: (event) => {
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = redSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderRelease: () => {
                    setIsDraggingRed(false);
                  },
                }).panHandlers}
              >
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: '#ef4444',
                      left: `${((customColorRgb.r || 0) / 255) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderInputContainer}>
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, prev.r - 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.sliderInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={String(Math.round(customColorRgb.r))}
                  onChangeText={(text) => {
                    const val = parseInt(text) || 0;
                    setCustomColorRgb(prev => ({ ...prev, r: Math.max(0, Math.min(255, val)) }));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, r: Math.min(255, prev.r + 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <View style={styles.sliderLabelContainer}>
                  <View style={[styles.sliderColorDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={[styles.sliderLabel, { color: colors.text }]}>Green</Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.text }]}>{Math.round(customColorRgb.g)}</Text>
              </View>
              <View
                style={[styles.sliderTrack, { backgroundColor: colors.border }]}
                onLayout={(event) => {
                  greenSliderWidth.current = event.nativeEvent.layout.width;
                }}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: (event) => {
                    setIsDraggingGreen(true);
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = greenSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderMove: (event) => {
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = greenSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderRelease: () => {
                    setIsDraggingGreen(false);
                  },
                }).panHandlers}
              >
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: '#22c55e',
                      left: `${((customColorRgb.g || 0) / 255) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderInputContainer}>
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, prev.g - 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.sliderInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={String(Math.round(customColorRgb.g))}
                  onChangeText={(text) => {
                    const val = parseInt(text) || 0;
                    setCustomColorRgb(prev => ({ ...prev, g: Math.max(0, Math.min(255, val)) }));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, g: Math.min(255, prev.g + 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <View style={styles.sliderLabelContainer}>
                  <View style={[styles.sliderColorDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={[styles.sliderLabel, { color: colors.text }]}>Blue</Text>
                </View>
                <Text style={[styles.sliderValue, { color: colors.text }]}>{Math.round(customColorRgb.b)}</Text>
              </View>
              <View
                style={[styles.sliderTrack, { backgroundColor: colors.border }]}
                onLayout={(event) => {
                  blueSliderWidth.current = event.nativeEvent.layout.width;
                }}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: (event) => {
                    setIsDraggingBlue(true);
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = blueSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderMove: (event) => {
                    const locationX = event.nativeEvent.locationX;
                    const sliderWidth = blueSliderWidth.current;
                    const newValue = Math.round((locationX / sliderWidth) * 255);
                    setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, Math.min(255, newValue)) }));
                  },
                  onPanResponderRelease: () => {
                    setIsDraggingBlue(false);
                  },
                }).panHandlers}
              >
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      backgroundColor: '#3b82f6',
                      left: `${((customColorRgb.b || 0) / 255) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.sliderInputContainer}>
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, prev.b - 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.sliderInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={String(Math.round(customColorRgb.b))}
                  onChangeText={(text) => {
                    const val = parseInt(text) || 0;
                    setCustomColorRgb(prev => ({ ...prev, b: Math.max(0, Math.min(255, val)) }));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={[styles.sliderButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setCustomColorRgb(prev => ({ ...prev, b: Math.min(255, prev.b + 10) }))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sliderButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setEditingColorKey(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => {
                  if (editingColorKey) {
                    const hexColor = rgbToHex(customColorRgb.r, customColorRgb.g, customColorRgb.b);
                    editColorInCustomTheme(editingColorKey, hexColor);
                    setEditingColorKey(null);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={terminalNumberModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTerminalNumberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Set Terminal Number</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>Terminal Number (1-99)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
              value={terminalNumberInput}
              onChangeText={setTerminalNumberInput}
              placeholder="01"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              maxLength={2}
            />

            <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 12, fontSize: 13 }]}>
              This will appear as NV{terminalNumberInput.padStart(2, '0') || '01'} in transaction records
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setTerminalNumberModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleTerminalNumberUpdate}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createProfileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Save Settings Profile</Text>
            
            <Text style={[styles.label, { color: colors.textSecondary }]}>Profile Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
              value={profileNameInput}
              onChangeText={setProfileNameInput}
              placeholder="e.g., Restaurant Setup, Bar Config"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />

            <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: 12, fontSize: 13 }]}>This will save all your current settings including payment options, appearance, basket settings, and more.</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.textTertiary, flex: 1 }]}
                onPress={() => setCreateProfileModalVisible(false)}
                activeOpacity={0.8}
                disabled={isSavingProfile}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, flex: 1 }, isSavingProfile && { opacity: 0.7 }]}
                onPress={saveSettingsProfile}
                activeOpacity={0.8}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Save</Text>
                )}
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
    paddingBottom: 110,
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
    minWidth: 90,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncIntervalOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  syncIntervalOption: {
    flexBasis: '48%',
    minWidth: 0,
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
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorPickerScroll: {
    maxHeight: 300,
  },
  colorPickerScrollContent: {
    paddingBottom: 10,
  },
  colorSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
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
  dropdownButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
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
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  percentagesList: {
    gap: 8,
    marginBottom: 8,
  },
  percentageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  percentageValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  percentageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentageActionButton: {
    padding: 6,
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrowButton: {
    padding: 6,
  },
  customColorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  customColorPreview: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  customColorButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  customColorPreviewLarge: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  hexDisplay: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
    position: 'relative',
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    top: -8,
    marginLeft: -12,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  sliderInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderButton: {
    width: 36,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  sliderInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  customThemeModalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 16,
    padding: 20,
  },
  themeColorsList: {
    maxHeight: 400,
  },
  themeColorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  themeColorInfo: {
    flex: 1,
    gap: 4,
  },
  themeColorKey: {
    fontSize: 15,
    fontWeight: '600',
  },
  themeColorValue: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  themeColorPreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
  },
  limitReachedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  limitReachedText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
  },
  profileTimestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  profileActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
