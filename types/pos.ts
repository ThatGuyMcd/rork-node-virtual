export interface Operator {
  id: string;
  name: string;
  pin: string;
  active: boolean;
  isManager: boolean;
}

export interface ProductGroup {
  id: string;
  name: string;
  color: string;
}

export interface Department {
  id: string;
  groupId: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  departmentId: string;
  groupId: string;
  prices: PriceOption[];
  vatCode: string;
  vatPercentage: number;
  buttonColor: string;
  fontColor: string;
  hotcode?: string;
  barcode?: string;
  filename?: string;
  sellable?: boolean;
}

export interface PriceOption {
  label: string;
  price: number;
  key: string;
}

export interface BasketItem {
  product: Product;
  quantity: number;
  selectedPrice: PriceOption;
  lineTotal: number;
}

export interface Tender {
  id: string;
  name: string;
  color: string;
}

export interface VATRate {
  code: string;
  percentage: number;
}

export interface Table {
  id: string;
  name: string;
  tabCode: string;
  area: string;
  color?: string;
  isLocked?: boolean;
}

export interface TableOrder {
  tableId: string;
  tableName: string;
  items: BasketItem[];
  createdAt: string;
  operatorId: string;
}

export interface ProductDisplaySettings {
  hiddenGroupIds: string[];
  hiddenDepartmentIds: string[];
  sortOrder: 'filename' | 'alphabetical' | 'custom';
  customGroupOrder?: string[];
  customDepartmentOrder?: string[];
  groupColors?: Record<string, string>;
  departmentColors?: Record<string, string>;
  departmentSortOrders?: Record<string, 'plu' | 'alphabetical'>;
}

export interface MenuData {
  [menuId: string]: MenuProduct[];
}

export interface MenuProduct {
  productName: string;
  filename: string;
  hotcode?: string;
  buttonColor?: string;
  fontColor?: string;
}

export interface PaymentRecord {
  tenderId: string;
  tenderName: string;
  amount: number;
}

export interface Transaction {
  id: string;
  timestamp: string;
  operatorId: string;
  operatorName: string;
  tableId?: string;
  tableName?: string;
  items: BasketItem[];
  subtotal: number;
  vatBreakdown: Record<string, number>;
  total: number;
  tenderId: string;
  tenderName: string;
  paymentMethod: string;
  payments?: PaymentRecord[];
  isRefund?: boolean;
  discount?: number;
  gratuity?: number;
  cashback?: number;
}

export interface TransactionReport {
  startDate: string;
  endDate: string;
  totalTransactions: number;
  totalRevenue: number;
  totalVAT: number;
  vatBreakdownByRate: Record<string, { totalVAT: number; totalNet: number; percentage: number }>;
  transactionsByOperator: Record<string, { count: number; revenue: number }>;
  transactionsByTender: Record<string, { count: number; revenue: number }>;
  transactionsByTable?: Record<string, { count: number; revenue: number }>;
  itemsSold: Record<string, { quantity: number; revenue: number }>;
}

export interface DiscountSettings {
  presetPercentages: number[];
}

export interface GratuitySettings {
  enabled: boolean;
  presetPercentages: number[];
}

export type PrinterConnectionType = 'bluetooth' | 'network';
export type PrinterPaperWidth = '58mm' | '80mm';

export interface PrinterSettings {
  connectionType: PrinterConnectionType;
  paperWidth: PrinterPaperWidth;
  deviceName?: string;
  deviceAddress?: string;
  ipAddress?: string;
  port?: number;
  isConnected: boolean;
  autoConnect: boolean;
  cashDrawerEnabled: boolean;
  cashDrawerVoltage: '12v' | '24v';
}

export interface PrinterDevice {
  name: string;
  address: string;
  type: 'bluetooth' | 'network';
}

export type ReceiptLineSize = 'small' | 'normal' | 'large';

export interface ReceiptLine {
  text: string;
  size: ReceiptLineSize;
}

export interface ReceiptSettings {
  headerLines: ReceiptLine[];
  footerLines: ReceiptLine[];
}

export interface SettingsProfile {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string; // Operator name
  settings: {
    // POS Settings
    tableSelectionRequired: boolean;
    productViewLayout: 'compact' | 'standard' | 'large';
    productViewMode: 'group-department' | 'all-departments' | 'all-items';
    productDisplaySettings: ProductDisplaySettings;
    discountSettings: DiscountSettings;
    gratuitySettings: GratuitySettings;
    printerSettings: PrinterSettings;
    receiptSettings: ReceiptSettings;
    terminalNumber: string;
    
    // Feature Flags
    cardPaymentEnabled: boolean;
    cashPaymentEnabled: boolean;
    splitPaymentsEnabled: boolean;
    cardMachineProvider: 'Teya' | 'None';
    changeAllowed: boolean;
    cashbackAllowed: boolean;
    refundButtonEnabled: boolean;
    backgroundSyncInterval: 'disabled' | '6' | '12' | '24';
    
    // Theme Settings
    themePreference: 'light' | 'dark' | 'system' | 'custom' | string;
    customColors: any | null;
    buttonSkin: 'default' | 'rounded' | 'sharp' | 'soft' | 'outlined' | 'minimal';
  };
}
