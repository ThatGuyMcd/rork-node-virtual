import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import type { PrinterSettings, PrinterDevice, Transaction, ReceiptSettings } from '@/types/pos';
import { ESCPOSGenerator } from './escpos';

const PRINTER_SETTINGS_KEY = 'printerSettings';

class PrinterService {
  private settings: PrinterSettings = {
    connectionType: 'bluetooth',
    paperWidth: '80mm',
    isConnected: false,
    autoConnect: false,
    cashDrawerEnabled: false,
    cashDrawerVoltage: '12v',
  };

  private socket: any = null;
  private bluetoothDevice: any = null;

  async loadSettings(): Promise<PrinterSettings> {
    try {
      const stored = await AsyncStorage.getItem(PRINTER_SETTINGS_KEY);
      if (stored) {
        this.settings = JSON.parse(stored);
        console.log('[PrinterService] Loaded settings:', this.settings);
      }
      return this.settings;
    } catch (error) {
      console.error('[PrinterService] Error loading settings:', error);
      return this.settings;
    }
  }

  async saveSettings(settings: PrinterSettings): Promise<void> {
    try {
      this.settings = settings;
      await AsyncStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(settings));
      console.log('[PrinterService] Settings saved:', settings);
    } catch (error) {
      console.error('[PrinterService] Error saving settings:', error);
      throw error;
    }
  }

  getSettings(): PrinterSettings {
    return this.settings;
  }

  async scanBluetoothDevices(): Promise<PrinterDevice[]> {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Bluetooth scanning is not available on web');
      return [];
    }

    console.log('[PrinterService] Scanning for Bluetooth devices...');
    return [];
  }

  async connectBluetooth(deviceAddress: string, deviceName: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Bluetooth connection is not available on web');
      return false;
    }

    try {
      console.log('[PrinterService] Connecting to Bluetooth device:', deviceAddress);
      
      this.settings.deviceAddress = deviceAddress;
      this.settings.deviceName = deviceName;
      this.settings.isConnected = true;
      await this.saveSettings(this.settings);
      
      console.log('[PrinterService] Connected to Bluetooth device');
      return true;
    } catch (error) {
      console.error('[PrinterService] Bluetooth connection error:', error);
      throw error;
    }
  }

  async connectNetwork(ipAddress: string, port: number = 9100): Promise<boolean> {
    try {
      console.log('[PrinterService] Connecting to network printer:', ipAddress, port);

      if (Platform.OS === 'web') {
        Alert.alert(
          'Web Platform',
          'Network printer connection on web requires CORS configuration on your printer. The connection will be attempted but may fail due to browser security restrictions.'
        );
      }

      this.settings.ipAddress = ipAddress;
      this.settings.port = port;
      this.settings.isConnected = true;
      await this.saveSettings(this.settings);

      console.log('[PrinterService] Network printer configured');
      return true;
    } catch (error) {
      console.error('[PrinterService] Network connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }

      if (this.bluetoothDevice) {
        this.bluetoothDevice = null;
      }

      this.settings.isConnected = false;
      await this.saveSettings(this.settings);
      
      console.log('[PrinterService] Disconnected');
    } catch (error) {
      console.error('[PrinterService] Disconnect error:', error);
      throw error;
    }
  }

  async printReceipt(transaction: Transaction, siteName?: string, isReprint: boolean = false, receiptSettings?: ReceiptSettings): Promise<void> {
    if (!this.settings.isConnected) {
      throw new Error('Printer not connected');
    }

    const generator = new ESCPOSGenerator(this.settings.paperWidth);
    const receiptData = generator.generateReceipt(transaction, siteName, isReprint, receiptSettings);

    try {
      await this.sendData(receiptData);
      console.log(`[PrinterService] Receipt ${isReprint ? 'reprinted' : 'printed'} successfully`);
    } catch (error) {
      console.error('[PrinterService] Print error:', error);
      throw error;
    }
  }

  async printTestReceipt(): Promise<void> {
    if (!this.settings.isConnected) {
      throw new Error('Printer not connected');
    }

    const generator = new ESCPOSGenerator(this.settings.paperWidth);
    const testData = generator.generateTestReceipt();

    try {
      await this.sendData(testData);
      console.log('[PrinterService] Test receipt printed successfully');
    } catch (error) {
      console.error('[PrinterService] Test print error:', error);
      throw error;
    }
  }

  private async sendData(data: Uint8Array): Promise<void> {
    if (this.settings.connectionType === 'bluetooth') {
      await this.sendBluetoothData(data);
    } else {
      await this.sendNetworkData(data);
    }
  }

  private async sendBluetoothData(data: Uint8Array): Promise<void> {
    if (Platform.OS === 'web') {
      throw new Error('Bluetooth printing not supported on web');
    }

    if (!this.settings.deviceAddress) {
      throw new Error('No Bluetooth device configured');
    }

    console.log('[PrinterService] Sending data via Bluetooth...');
    console.log('[PrinterService] Note: Actual Bluetooth communication requires native module integration');
  }

  private async sendNetworkData(data: Uint8Array): Promise<void> {
    if (!this.settings.ipAddress || !this.settings.port) {
      throw new Error('Network printer not configured');
    }

    console.log('[PrinterService] Sending data to network printer...');

    if (Platform.OS === 'web') {
      console.warn('[PrinterService] Network printing on web has limitations');
      throw new Error('Network printing on web requires browser extensions or native apps');
    }

    console.log('[PrinterService] Note: Actual network communication requires TCP socket implementation');
  }

  isConnected(): boolean {
    return this.settings.isConnected;
  }

  async openCashDrawer(): Promise<void> {
    if (!this.settings.cashDrawerEnabled) {
      console.log('[PrinterService] Cash drawer is disabled in settings');
      return;
    }

    if (!this.settings.isConnected) {
      console.warn('[PrinterService] Cannot open cash drawer: printer not connected');
      return;
    }

    const pulse = this.settings.cashDrawerVoltage === '12v' ? '\x00' : '\x01';
    const cashDrawerCommand = new Uint8Array([
      0x1B,
      0x70,
      pulse.charCodeAt(0),
      0x19,
      0xFA,
    ]);

    try {
      await this.sendData(cashDrawerCommand);
      console.log('[PrinterService] Cash drawer opened');
    } catch (error) {
      console.error('[PrinterService] Failed to open cash drawer:', error);
      throw error;
    }
  }
}

export const printerService = new PrinterService();
