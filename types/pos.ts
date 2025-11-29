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
