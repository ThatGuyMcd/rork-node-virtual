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
}

export interface TransactionReport {
  startDate: string;
  endDate: string;
  totalTransactions: number;
  totalRevenue: number;
  totalVAT: number;
  transactionsByOperator: Record<string, { count: number; revenue: number }>;
  transactionsByTender: Record<string, { count: number; revenue: number }>;
  transactionsByTable?: Record<string, { count: number; revenue: number }>;
  itemsSold: Record<string, { quantity: number; revenue: number }>;
}
