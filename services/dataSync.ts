import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';
import { dataParser } from './dataParser';
import type { Operator, Product, ProductGroup, Department, Tender, VATRate, Table, ProductDisplaySettings } from '@/types/pos';

const STORAGE_KEYS = {
  SITE_ID: 'pos_site_id',
  SITE_NAME: 'pos_site_name',
  CREDENTIALS: 'pos_credentials',
  LAST_SYNC: 'pos_last_sync',
  OPERATORS: 'pos_operators',
  GROUPS: 'pos_groups',
  DEPARTMENTS: 'pos_departments',
  PRODUCTS: 'pos_products',
  TENDERS: 'pos_tenders',
  VAT_RATES: 'pos_vat_rates',
  TABLES: 'pos_tables',
  TABLE_SELECTION_REQUIRED: 'pos_table_selection_required',
  PRODUCT_VIEW_LAYOUT: 'pos_product_view_layout',
  PRODUCT_VIEW_MODE: 'pos_product_view_mode',
  THEME: 'pos_theme',
  THEME_PREFERENCE: 'pos_theme_preference',
  PRODUCT_DISPLAY_SETTINGS: 'pos_product_display_settings',
};

export interface SyncProgress {
  phase: 'connecting' | 'downloading' | 'parsing' | 'complete';
  current: number;
  total: number;
  message: string;
}

export class DataSyncService {
  async linkAccount(username: string, password: string, remember: boolean): Promise<{ siteId: string; siteName: string }> {
    console.log('[DataSync] Linking account...');
    
    const result = await apiClient.linkAccount({ username, password });
    
    await AsyncStorage.setItem(STORAGE_KEYS.SITE_ID, result.venueId);
    
    if (result.venueName) {
      await AsyncStorage.setItem(STORAGE_KEYS.SITE_NAME, result.venueName);
    }
    
    if (remember) {
      await AsyncStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify({ username, password }));
    }
    
    return {
      siteId: result.venueId,
      siteName: result.venueName || result.venueId,
    };
  }

  async getSavedCredentials(): Promise<{ username: string; password: string } | null> {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    return saved ? JSON.parse(saved) : null;
  }

  async getSiteInfo(): Promise<{ siteId: string; siteName: string } | null> {
    const siteId = await AsyncStorage.getItem(STORAGE_KEYS.SITE_ID);
    if (!siteId) return null;
    
    const siteName = await AsyncStorage.getItem(STORAGE_KEYS.SITE_NAME) || siteId;
    return { siteId, siteName };
  }

  async syncData(onProgress?: (progress: SyncProgress) => void): Promise<void> {
    console.log('[DataSync] ========== STARTING DATA SYNC ==========');
    
    const siteInfo = await this.getSiteInfo();
    if (!siteInfo) {
      throw new Error('No site linked. Please link your account first.');
    }

    console.log(`[DataSync] Site ID: ${siteInfo.siteId}`);
    console.log(`[DataSync] Site Name: ${siteInfo.siteName}`);

    onProgress?.({ phase: 'connecting', current: 0, total: 1, message: 'Connecting to server...' });

    const manifest = await apiClient.getManifest(siteInfo.siteId);
    console.log(`[DataSync] Manifest loaded: ${manifest.length} total files`);

    const filteredManifest = this.filterManifest(manifest);
    console.log(`[DataSync] Will download: ${filteredManifest.length} files after filtering`);
    console.log(`[DataSync] Skipped: ${manifest.length - filteredManifest.length} files`);

    const files: Map<string, string> = new Map();

    onProgress?.({ phase: 'downloading', current: 0, total: filteredManifest.length, message: 'Downloading files...' });

    const getFriendlyName = (folder: string): string => {
      const folderUpper = folder.toUpperCase();
      switch (folderUpper) {
        case 'PLUDATA':
          return 'Downloading Product Database';
        case 'OPERATORDATA':
          return 'Downloading Operators';
        case 'TABDATA':
          return 'Downloading Tables and Tabs';
        case 'FUNCTIONDATA':
          return 'Downloading Functions';
        case 'MENUDATA':
          return 'Downloading Menus';
        default:
          return `Downloading from ${folder}`;
      }
    };

    for (let i = 0; i < filteredManifest.length; i++) {
      const path = filteredManifest[i];
      const currentNum = i + 1;
      
      console.log(`[DataSync] Downloading file ${currentNum} of ${filteredManifest.length}: ${path}`);
      
      try {
        const text = await apiClient.getFile(siteInfo.siteId, path);
        files.set(path, text);
        
        console.log(`[DataSync] Successfully downloaded: ${path}`);
        
        const folder = path.split('/')[0] || 'root';
        const progressUpdate = {
          phase: 'downloading' as const,
          current: currentNum,
          total: filteredManifest.length,
          message: getFriendlyName(folder),
        };
        
        onProgress?.(progressUpdate);
        
        if (currentNum % 5 === 0 || currentNum === filteredManifest.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (error) {
        console.error(`[DataSync] Failed to download ${path}:`, error);
        const folder = path.split('/')[0] || 'root';
        const progressUpdate = {
          phase: 'downloading' as const,
          current: currentNum,
          total: filteredManifest.length,
          message: `Error: ${getFriendlyName(folder)}`,
        };
        onProgress?.(progressUpdate);
      }
    }

    console.log(`[DataSync] Downloaded ${files.size} files successfully`);
    
    onProgress?.({ phase: 'parsing', current: 0, total: 1, message: 'Processing data...' });

    await this.parseAndStoreData(files);

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

    onProgress?.({ phase: 'complete', current: 1, total: 1, message: 'Sync complete!' });

    console.log('[DataSync] ========== SYNC COMPLETE ==========');
  }

  private filterManifest(manifest: string[]): string[] {
    const allowedPrefixes = [
      'PLUDATA',
      'OPERATORDATA',
      'TABDATA',
      'FUNCTIONDATA',
      'MENUDATA',
    ];

    const filtered = manifest.filter(path => {
      const upper = path.toUpperCase();
      
      // Only include files from allowed folders
      if (!allowedPrefixes.some(prefix => upper === prefix || upper.startsWith(prefix + '/'))) {
        return false;
      }
      
      // Skip ERRORCORRECT.PLU files and their backups
      if (upper.includes('ERRORCORRECT.PLU')) {
        return false;
      }
      
      // Skip .bak files
      if (upper.endsWith('.BAK') || /\.BAK_\d+/.test(upper)) {
        return false;
      }
      
      return true;
    });

    // Sort by folder to download one folder at a time
    return filtered.sort((a, b) => {
      const folderA = a.split('/')[0].toUpperCase();
      const folderB = b.split('/')[0].toUpperCase();
      
      // Define priority order for folders
      const folderOrder: Record<string, number> = {
        'OPERATORDATA': 1,
        'TABDATA': 2,
        'FUNCTIONDATA': 3,
        'MENUDATA': 4,
        'PLUDATA': 5,
      };
      
      const orderA = folderOrder[folderA] || 999;
      const orderB = folderOrder[folderB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Within the same folder, sort alphabetically
      return a.localeCompare(b);
    });
  }

  private async parseAndStoreData(files: Map<string, string>): Promise<void> {
    const operators = await this.parseOperators(files);
    const { groups, departments } = await this.parseProductStructure(files);
    const products = await this.parseProducts(files);
    const tenders = await this.parseTenders(files);
    const vatRates = await this.parseVAT(files);
    const tables = await this.parseTables(files);

    await AsyncStorage.setItem(STORAGE_KEYS.OPERATORS, JSON.stringify(operators));
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    await AsyncStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    await AsyncStorage.setItem(STORAGE_KEYS.TENDERS, JSON.stringify(tenders));
    await AsyncStorage.setItem(STORAGE_KEYS.VAT_RATES, JSON.stringify(vatRates));
    await AsyncStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));

    console.log('[DataSync] Stored:', {
      operators: operators.length,
      groups: groups.length,
      departments: departments.length,
      products: products.length,
      tenders: tenders.length,
      vatRates: vatRates.length,
      tables: tables.length,
    });
  }

  private async parseOperators(files: Map<string, string>): Promise<Operator[]> {
    const operators: Operator[] = [];
    
    for (const [path, content] of files.entries()) {
      if (path.toUpperCase() === 'OPERATORDATA/ACTIVE_OPERATORS.CSV') {
        const rows = dataParser.parseCSV(content);
        if (rows.length <= 1) continue;

        const header = rows[0].map(h => h.trim().toLowerCase());
        const nameIdx = header.findIndex(h => /operator.*name|name|user.*name/i.test(h));
        const activeIdx = header.findIndex(h => /user.*active|active/i.test(h));
        const pinIdx = header.findIndex(h => /passcode|pin|password/i.test(h));
        const managerIdx = header.findIndex(h => /manager/i.test(h));

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = nameIdx >= 0 ? row[nameIdx]?.trim() : '';
          if (!name) continue;

          const activeRaw = activeIdx >= 0 ? row[activeIdx]?.trim().toLowerCase() : 'true';
          const active = ['true', 'yes', '1', 'y', 'on', 'active'].includes(activeRaw);

          const pin = pinIdx >= 0 ? row[pinIdx]?.trim() : '';
          const managerRaw = managerIdx >= 0 ? row[managerIdx]?.trim().toLowerCase() : 'false';
          const isManager = ['true', 'yes', '1', 'y'].includes(managerRaw);

          operators.push({
            id: `op_${i}`,
            name,
            pin,
            active,
            isManager,
          });
        }
      }
    }

    return operators.filter(op => op.active);
  }

  private async parseProductStructure(files: Map<string, string>): Promise<{ groups: ProductGroup[]; departments: Department[] }> {
    const groups: ProductGroup[] = [];
    const departments: Department[] = [];
    const groupSet = new Set<string>();
    const deptMap = new Map<string, { group: string; dept: string }>();

    console.log('[DataSync] Parsing product structure...');

    for (const [path] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('PLUDATA/')) continue;
      if (!upper.endsWith('.PLU')) continue;
      
      // Skip ERRORCORRECT.PLU files
      if (upper.includes('ERRORCORRECT.PLU')) continue;

      const parts = path.slice('PLUDATA/'.length).split('/');
      if (parts.length < 3) continue;

      const group = parts[0];
      const dept = parts[1];

      groupSet.add(group);
      const key = `${group}/${dept}`;
      if (!deptMap.has(key)) {
        deptMap.set(key, { group, dept });
      }
    }

    console.log(`[DataSync] Found ${groupSet.size} groups and ${deptMap.size} departments`);

    const sortedGroups = Array.from(groupSet).sort();
    sortedGroups.forEach((group, index) => {
      groups.push({
        id: `grp_${index}`,
        name: group,
        color: '#10b981',
      });
      console.log(`[DataSync] Group: ${group}`);
    });

    let deptIndex = 0;
    for (const { group, dept } of deptMap.values()) {
      const groupObj = groups.find(g => g.name === group);
      if (!groupObj) {
        console.warn(`[DataSync] Warning: Department ${dept} has no matching group for ${group}`);
        continue;
      }
      
      departments.push({
        id: `dept_${deptIndex++}`,
        groupId: groupObj.id,
        name: dept,
        color: '#3b82f6',
      });
      console.log(`[DataSync] Department: ${group}/${dept} (groupId: ${groupObj.id})`);
    }

    return { groups, departments };
  }

  private async parseProducts(files: Map<string, string>): Promise<Product[]> {
    const products: Product[] = [];
    let productIndex = 0;

    console.log('[DataSync] Parsing products...');

    for (const [path, content] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('PLUDATA/')) continue;
      if (!upper.endsWith('.PLU')) continue;
      
      // Skip ERRORCORRECT.PLU files
      if (upper.includes('ERRORCORRECT.PLU')) continue;
      
      const fileName = path.split('/').pop()?.replace(/\.PLU$/i, '') || '';
      if (!/^\d{3}-\d{3}-/.test(fileName)) continue;

      const parts = path.slice('PLUDATA/'.length).split('/');
      if (parts.length < 3) continue;

      const groupName = parts[0];
      const deptName = parts[1];

      const kv = dataParser.parseKV(content);
      
      const sellable = String(kv['SELLABLE?'] || '').trim().toLowerCase();
      if (sellable && ['no', 'false', '0', 'n', 'off'].includes(sellable)) continue;

      const name = kv.PRODUCT_DESCRIPTION || fileName;
      let prices = dataParser.parsePriceOptions(kv);
      const vatCode = (kv.VAT_CODE || 'S').trim();
      const buttonColor = dataParser.parseColor(kv.BUTTON_COLOUR) || '#1e293b';
      const fontColor = dataParser.parseColor(kv.FONT_COLOUR) || '#ffffff';
      const hotcode = kv.HOTCODE || undefined;
      const barcode = kv.BARCODE || undefined;

      if (prices.length === 0) {
        const std = String(kv.PRICE_STANDARD || '').trim().toUpperCase();
        if (std === 'OPEN') {
          prices = [{ key: 'PRICE_STANDARD', label: 'OPEN', price: 0 }];
        } else if (std === 'NOT SET') {
          prices = [{ key: 'PRICE_STANDARD', label: 'NOT SET', price: 0 }];
        } else {
          continue;
        }
      }

      products.push({
        id: `prod_${productIndex++}`,
        name,
        departmentId: deptName,
        groupId: groupName,
        prices,
        vatCode,
        buttonColor,
        fontColor,
        hotcode,
        barcode,
      });
    }

    console.log(`[DataSync] Parsed ${products.length} products`);
    return products;
  }

  private async parseTenders(files: Map<string, string>): Promise<Tender[]> {
    const tenders: Tender[] = [];
    let tenderIndex = 0;

    for (const [path, content] of files.entries()) {
      if (!path.toUpperCase().startsWith('TENDERDATA/')) continue;
      if (!path.toUpperCase().endsWith('.TENDER')) continue;

      const kv = dataParser.parseKV(content);
      const name = kv.TENDER_NAME || path.split('/').pop()?.replace('.TENDER', '') || 'Unknown';

      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
      }
      const hue = hash % 360;

      tenders.push({
        id: `tender_${tenderIndex++}`,
        name,
        color: `hsl(${hue}, 70%, 45%)`,
      });
    }

    if (tenders.length === 0) {
      tenders.push(
        { id: 'tender_0', name: 'Cash', color: '#10b981' },
        { id: 'tender_1', name: 'Card', color: '#3b82f6' }
      );
    }

    return tenders;
  }

  private async parseVAT(files: Map<string, string>): Promise<VATRate[]> {
    const vatRates: VATRate[] = [];

    for (const [path, content] of files.entries()) {
      if (!path.toUpperCase().startsWith('VATDATA/')) continue;
      if (!path.toUpperCase().endsWith('.VATCODE')) continue;

      const kv = dataParser.parseKV(content);
      const code = path.split('/').pop()?.replace('.VATCODE', '') || '';
      const percentage = parseFloat(kv.PERCENTAGE || '0') || 0;

      vatRates.push({ code, percentage });
    }

    if (vatRates.length === 0) {
      vatRates.push(
        { code: 'S', percentage: 20 },
        { code: 'Z', percentage: 0 }
      );
    }

    return vatRates;
  }

  async getStoredOperators(): Promise<Operator[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.OPERATORS);
    return data ? JSON.parse(data) : [];
  }

  async getStoredGroups(): Promise<ProductGroup[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    return data ? JSON.parse(data) : [];
  }

  async getStoredDepartments(): Promise<Department[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
    return data ? JSON.parse(data) : [];
  }

  async getStoredProducts(): Promise<Product[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [];
  }

  async getStoredTenders(): Promise<Tender[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TENDERS);
    return data ? JSON.parse(data) : [];
  }

  async getStoredVATRates(): Promise<VATRate[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.VAT_RATES);
    return data ? JSON.parse(data) : [];
  }

  private async parseTables(files: Map<string, string>): Promise<Table[]> {
    const tables: Table[] = [];
    const tableSet = new Map<string, { area: string; table: string }>();

    console.log('[DataSync] Parsing tables...');

    for (const [path] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('TABDATA/')) continue;
      
      if (upper.endsWith('.INI')) {
        console.log(`[DataSync] Skipping .ini file: ${path}`);
        continue;
      }
      
      const parts = path.slice('TABDATA/'.length).split('/');
      if (parts.length < 3) continue;

      const area = parts[0];
      const table = parts[1];
      
      const key = `${area}/${table}`;
      if (!tableSet.has(key)) {
        tableSet.set(key, { area, table });
      }
    }

    console.log(`[DataSync] Found ${tableSet.size} tables across multiple areas`);

    let tableIndex = 0;
    for (const { area, table } of tableSet.values()) {
      let hash = 0;
      const hashString = `${area}_${table}`;
      for (let i = 0; i < hashString.length; i++) {
        hash = (hash * 31 + hashString.charCodeAt(i)) >>> 0;
      }
      const hue = hash % 360;

      tables.push({
        id: `table_${tableIndex++}`,
        name: table,
        tabCode: table,
        area,
        color: `hsl(${hue}, 65%, 50%)`,
      });

      console.log(`[DataSync] Parsed table: ${area} / ${table}`);
    }

    console.log(`[DataSync] Parsed ${tables.length} tables`);
    return tables;
  }

  async getStoredTables(): Promise<Table[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TABLES);
    return data ? JSON.parse(data) : [];
  }

  async setTableSelectionRequired(required: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.TABLE_SELECTION_REQUIRED, JSON.stringify(required));
  }

  async getTableSelectionRequired(): Promise<boolean> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TABLE_SELECTION_REQUIRED);
    return data ? JSON.parse(data) : false;
  }

  async setProductViewLayout(layout: 'compact' | 'standard' | 'large'): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_VIEW_LAYOUT, layout);
  }

  async getProductViewLayout(): Promise<'compact' | 'standard' | 'large'> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCT_VIEW_LAYOUT);
    return (data as 'compact' | 'standard' | 'large') || 'standard';
  }

  async setProductViewMode(mode: 'group-department' | 'all-departments' | 'all-items'): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_VIEW_MODE, mode);
  }

  async getProductViewMode(): Promise<'group-department' | 'all-departments' | 'all-items'> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCT_VIEW_MODE);
    return (data as 'group-department' | 'all-departments' | 'all-items') || 'group-department';
  }

  async setTheme(theme: 'light' | 'dark'): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  async getTheme(): Promise<'light' | 'dark'> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
    return (data as 'light' | 'dark') || 'dark';
  }

  async setThemePreference(preference: 'light' | 'dark' | 'system'): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, preference);
  }

  async getThemePreference(): Promise<'light' | 'dark' | 'system'> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE);
    return (data as 'light' | 'dark' | 'system') || 'system';
  }

  async setProductDisplaySettings(settings: ProductDisplaySettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_DISPLAY_SETTINGS, JSON.stringify(settings));
  }

  async getProductDisplaySettings(): Promise<ProductDisplaySettings> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCT_DISPLAY_SETTINGS);
    return data ? JSON.parse(data) : {
      hiddenGroupIds: [],
      hiddenDepartmentIds: [],
      sortOrder: 'filename',
    };
  }

  async clearAllData(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.THEME && key !== STORAGE_KEYS.THEME_PREFERENCE);
    await AsyncStorage.multiRemove(keys);
    console.log('[DataSync] All data cleared');
  }
}

export const dataSyncService = new DataSyncService();
