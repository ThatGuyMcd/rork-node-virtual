import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';
import { dataParser } from './dataParser';
import type { Operator, Product, ProductGroup, Department, Tender, VATRate, Table, ProductDisplaySettings, MenuData } from '@/types/pos';
import type { ThemeColors } from '@/constants/colors';

const STORAGE_KEYS = {
  SITE_ID: 'pos_site_id',
  SITE_NAME: 'pos_site_name',
  CREDENTIALS: 'pos_credentials',
  LAST_SYNC: 'pos_last_sync',
  LAST_MANIFEST: 'pos_last_manifest',
  FILE_HASHES: 'pos_file_hashes',
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
  CUSTOM_THEME_COLORS: 'pos_custom_theme_colors',
  BUTTON_SKIN: 'pos_button_skin',
  PRODUCT_DISPLAY_SETTINGS: 'pos_product_display_settings',
  MENU_DATA: 'pos_menu_data',
  BACKGROUND_SYNC_INTERVAL: 'pos_background_sync_interval',
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

  async syncData(onProgress?: (progress: SyncProgress) => void, isIncremental: boolean = false): Promise<void> {
    console.log(`[DataSync] ========== STARTING ${isIncremental ? 'INCREMENTAL' : 'FULL'} DATA SYNC ==========`);
    
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
    console.log(`[DataSync] Will check: ${filteredManifest.length} files after filtering`);
    console.log(`[DataSync] Skipped: ${manifest.length - filteredManifest.length} files`);

    let filesToDownload = filteredManifest;
    
    if (isIncremental) {
      const previousMetadata = await this.getFileMetadata();
      filesToDownload = [];
      
      console.log('[DataSync] Checking for changed files...');
      
      for (const fileInfo of filteredManifest) {
        const previousMeta = previousMetadata[fileInfo.path];
        
        if (!previousMeta) {
          console.log(`[DataSync] New file detected: ${fileInfo.path}`);
          filesToDownload.push(fileInfo);
        } else if (fileInfo.lastModified && previousMeta.lastModified !== fileInfo.lastModified) {
          console.log(`[DataSync] Modified file detected: ${fileInfo.path} (was: ${previousMeta.lastModified}, now: ${fileInfo.lastModified})`);
          filesToDownload.push(fileInfo);
        }
      }
      
      console.log(`[DataSync] Found ${filesToDownload.length} new or changed files`);
      
      if (filesToDownload.length === 0) {
        console.log('[DataSync] No changes detected');
        onProgress?.({ phase: 'complete', current: 1, total: 1, message: 'No changes detected' });
        return;
      }
    }

    const files: Map<string, string> = new Map();

    onProgress?.({ phase: 'downloading', current: 0, total: filesToDownload.length, message: 'Syncing files...' });

    const getFriendlyName = (folder: string): string => {
      const folderUpper = folder.toUpperCase();
      switch (folderUpper) {
        case 'PLUDATA':
          return 'Syncing Product Database';
        case 'OPERATORDATA':
          return 'Syncing Operators';
        case 'TABDATA':
          return 'Syncing Tables and Tabs';
        case 'FUNCTIONDATA':
          return 'Syncing Functions';
        case 'MENUDATA':
          return 'Syncing Menus';
        case 'VATDATA':
          return 'Syncing VAT Data';
        case 'DATA':
          return 'Syncing Settings';
        default:
          return `Syncing from ${folder}`;
      }
    };

    const BATCH_SIZE = 15;
    let downloadedCount = 0;
    let lastProgressFolder = '';

    console.log(`[DataSync] Starting parallel download with batch size: ${BATCH_SIZE}`);

    for (let batchStart = 0; batchStart < filesToDownload.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, filesToDownload.length);
      const batch = filesToDownload.slice(batchStart, batchEnd);
      
      console.log(`[DataSync] Downloading batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: files ${batchStart + 1}-${batchEnd} of ${filesToDownload.length}`);
      
      const batchPromises = batch.map(async (fileInfo) => {
        try {
          const text = await apiClient.getFile(siteInfo.siteId, fileInfo.path);
          return { path: fileInfo.path, text, success: true };
        } catch (error) {
          console.error(`[DataSync] Failed to download ${fileInfo.path}:`, error);
          return { path: fileInfo.path, text: '', success: false };
        }
      });

      const results = await Promise.all(batchPromises);
      
      for (const result of results) {
        if (result.success) {
          files.set(result.path, result.text);
        }
        downloadedCount++;
        
        const folder = result.path.split('/')[0] || 'root';
        if (folder !== lastProgressFolder) {
          lastProgressFolder = folder;
          console.log(`[DataSync] Now downloading: ${getFriendlyName(folder)}`);
        }
      }
      
      const progressUpdate = {
        phase: 'downloading' as const,
        current: downloadedCount,
        total: filesToDownload.length,
        message: getFriendlyName(lastProgressFolder),
      };
      onProgress?.(progressUpdate);
    }

    console.log(`[DataSync] Downloaded ${files.size} files successfully`);
    
    onProgress?.({ phase: 'parsing', current: 0, total: 1, message: 'Processing data...' });

    if (isIncremental) {
      await this.parseAndMergeData(files);
    } else {
      await this.parseAndStoreData(files);
    }

    await this.saveFileMetadata(filteredManifest);
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

    onProgress?.({ phase: 'complete', current: 1, total: 1, message: 'Sync complete!' });

    console.log('[DataSync] ========== SYNC COMPLETE ==========');
  }

  private filterManifest(manifest: { path: string; lastModified?: string }[]): { path: string; lastModified?: string }[] {
    const allowedPrefixes = [
      'PLUDATA',
      'OPERATORDATA',
      'TABDATA',
      'FUNCTIONDATA',
      'MENUDATA',
      'VATDATA',
      'DATA',
    ];

    const filtered = manifest.filter(fileInfo => {
      const upper = fileInfo.path.toUpperCase();
      
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
      const folderA = a.path.split('/')[0].toUpperCase();
      const folderB = b.path.split('/')[0].toUpperCase();
      
      // Define priority order for folders
      const folderOrder: Record<string, number> = {
        'OPERATORDATA': 1,
        'TABDATA': 2,
        'FUNCTIONDATA': 3,
        'VATDATA': 4,
        'DATA': 5,
        'MENUDATA': 6,
        'PLUDATA': 7,
      };
      
      const orderA = folderOrder[folderA] || 999;
      const orderB = folderOrder[folderB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Within the same folder, sort alphabetically
      return a.path.localeCompare(b.path);
    });
  }

  private async parseAndStoreData(files: Map<string, string>): Promise<void> {
    const operators = await this.parseOperators(files);
    const { groups, departments } = await this.parseProductStructure(files);
    const menuData = await this.parseMenuData(files);
    const menuProductFilenames = this.extractMenuProductFilenames(menuData);
    const vatRates = await this.parseVAT(files);
    const products = await this.parseProducts(files, menuProductFilenames, vatRates);
    const tenders = await this.parseTenders(files);
    const tables = await this.parseTables(files);

    await AsyncStorage.setItem(STORAGE_KEYS.OPERATORS, JSON.stringify(operators));
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    await AsyncStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    await AsyncStorage.setItem(STORAGE_KEYS.TENDERS, JSON.stringify(tenders));
    await AsyncStorage.setItem(STORAGE_KEYS.VAT_RATES, JSON.stringify(vatRates));
    await AsyncStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
    await AsyncStorage.setItem(STORAGE_KEYS.MENU_DATA, JSON.stringify(menuData));

    console.log('[DataSync] Stored:', {
      operators: operators.length,
      groups: groups.length,
      departments: departments.length,
      products: products.length,
      tenders: tenders.length,
      vatRates: vatRates.length,
      tables: tables.length,
      menus: Object.keys(menuData).length,
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

  private extractMenuProductFilenames(menuData: MenuData): Set<string> {
    const filenames = new Set<string>();
    for (const menuProducts of Object.values(menuData)) {
      for (const menuProduct of menuProducts) {
        if (menuProduct.filename && menuProduct.filename.toUpperCase() !== 'BACK.PLU') {
          filenames.add(menuProduct.filename.toUpperCase());
        }
      }
    }
    console.log(`[DataSync] Found ${filenames.size} unique products referenced in menus`);
    return filenames;
  }

  private async parseProducts(files: Map<string, string>, menuProductFilenames: Set<string>, vatRates: VATRate[] = []): Promise<Product[]> {
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
      
      const pluFilename = fileName + '.PLU';
      const isInMenu = menuProductFilenames.has(pluFilename.toUpperCase());
      
      const sellableRaw = String(kv['SELLABLE?'] || '').trim().toLowerCase();
      const isSellable = !sellableRaw || !['no', 'false', '0', 'n', 'off'].includes(sellableRaw);
      
      if (!isSellable && !isInMenu) {
        console.log(`[DataSync] Skipping non-sellable product: ${fileName} (not in any menu)`);
        continue;
      }
      
      if (!isSellable && isInMenu) {
        console.log(`[DataSync] Including non-sellable product: ${fileName} (appears in menu)`);
      }

      const name = kv.PRODUCT_DESCRIPTION || fileName;
      let prices = dataParser.parsePriceOptions(kv);
      const vatCode = (kv.VAT_CODE || 'S').trim();
      
      let vatPercentage = parseFloat(kv.VAT_PERCENTAGE || kv.VAT_RATE || kv.VAT || '20') || 20;
      const matchingVatRate = vatRates.find(rate => rate.code.toUpperCase() === vatCode.toUpperCase());
      if (matchingVatRate) {
        vatPercentage = matchingVatRate.percentage;
        console.log(`[DataSync] Product ${fileName}: Using VAT from .VATCODE file: ${vatCode} = ${vatPercentage}%`);
      } else {
        console.log(`[DataSync] Product ${fileName}: Using VAT from .PLU file: ${vatCode} = ${vatPercentage}%`);
      }
      
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
        vatPercentage,
        buttonColor,
        fontColor,
        hotcode,
        barcode,
        filename: fileName + '.PLU',
        sellable: isSellable,
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

  async setTheme(theme: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  async getTheme(): Promise<string> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
    return data || 'dark';
  }

  async setThemePreference(preference: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, preference);
  }

  async getThemePreference(): Promise<string> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE);
    return data || 'system';
  }

  async setCustomThemeColors(colors: ThemeColors): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_THEME_COLORS, JSON.stringify(colors));
  }

  async getCustomThemeColors(): Promise<ThemeColors | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_THEME_COLORS);
    return data ? JSON.parse(data) : null;
  }

  async setButtonSkin(skin: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.BUTTON_SKIN, skin);
  }

  async getButtonSkin(): Promise<string> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BUTTON_SKIN);
    return data || 'default';
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
      groupColors: {},
      departmentColors: {},
    };
  }

  private async parseMenuData(files: Map<string, string>): Promise<MenuData> {
    const menuData: MenuData = {};
    
    console.log('[DataSync] Parsing menu data...');

    const pluFileNames = new Map<string, string>();
    for (const [path] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('PLUDATA/')) continue;
      if (!upper.endsWith('.PLU')) continue;
      if (upper.includes('ERRORCORRECT.PLU')) continue;
      
      const fileName = path.split('/').pop();
      if (fileName) {
        pluFileNames.set(fileName.toUpperCase(), fileName);
      }
    }

    console.log(`[DataSync] Found ${pluFileNames.size} .PLU files in PLUDATA`);

    for (const [path, content] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('MENUDATA/')) continue;
      if (!upper.endsWith('.CSV')) continue;

      const fileName = path.split('/').pop()?.replace(/\.CSV$/i, '') || '';
      console.log(`[DataSync] Found MENUDATA file: ${fileName}`);
      
      const menuMatch = fileName.match(/^MENU\s*(\d+)$/i) || fileName.match(/^(\d+)$/);
      if (!menuMatch) {
        console.log(`[DataSync] Skipping non-menu file: ${fileName}`);
        continue;
      }

      const menuNumber = menuMatch[1].padStart(2, '0');
      const menuId = `MENU${menuNumber}`;
      console.log(`[DataSync] ========== Parsing menu: ${menuId} ==========`);
      console.log(`[DataSync] Menu ${menuId} raw CSV content (first 500 chars): ${content.substring(0, 500)}`);

      const rows = dataParser.parseCSV(content);
      console.log(`[DataSync] Menu ${menuId}: Parsed ${rows.length} CSV rows (including header)`);
      
      // Log first few rows for debugging
      if (rows.length > 0) {
        console.log(`[DataSync] Menu ${menuId}: Header row: ${JSON.stringify(rows[0])}`);
        if (rows.length > 1) {
          console.log(`[DataSync] Menu ${menuId}: First data row: ${JSON.stringify(rows[1])}`);
        }
        if (rows.length > 2) {
          console.log(`[DataSync] Menu ${menuId}: Second data row: ${JSON.stringify(rows[2])}`);
        }
      }
      
      const products: MenuData[string] = [];
      const seenProducts = new Set<string>();
      let hasBackButton = false;
      let rowIndex = 0;

      for (const row of rows) {
        rowIndex++;
        
        // Skip header row
        if (rowIndex === 1) {
          console.log(`[DataSync] Menu ${menuId}: Skipping header row`);
          continue;
        }
        
        if (row.length < 2) {
          console.log(`[DataSync] Menu ${menuId}: Row ${rowIndex} has fewer than 2 columns, skipping`);
          continue;
        }
        
        // Extract PLU path from second column (index 1)
        const pluPath = row[1]?.trim();
        if (!pluPath) {
          console.log(`[DataSync] Menu ${menuId}: Row ${rowIndex} has empty PLU path in column 2, skipping`);
          continue;
        }

        // Handle Windows paths with backslashes and forward slashes
        // Example: C:\X-ORDERFORM\Local_Data\Products\Product_Groups\002 - DRINK\010 - Soft Drinks\002-010-10901.PLU
        const pathParts = pluPath.split(/[\\/]/);
        const pluFileName = pathParts[pathParts.length - 1];
        if (!pluFileName) continue;

        console.log(`[DataSync] Menu ${menuId}: Processing row with PLU path: ${pluPath}`);
        console.log(`[DataSync] Menu ${menuId}: Extracted filename: ${pluFileName}`);

        // Check for BACK.PLU - this indicates the menu should have a close button
        if (pluFileName.toUpperCase() === 'BACK.PLU') {
          console.log(`[DataSync] Menu ${menuId}: Found BACK.PLU - menu will have a close button`);
          hasBackButton = true;
          continue;
        }

        // Only include products with xxx-xxx- filename format
        // This filters out size modifiers like LARGE.PLU, 125ml.PLU, etc.
        const fileNameWithoutExt = pluFileName.replace(/\.PLU$/i, '');
        if (!/^\d{3}-\d{3}-/.test(fileNameWithoutExt)) {
          console.log(`[DataSync] Menu ${menuId}: Skipping non-product file (not xxx-xxx- format): ${pluFileName}`);
          continue;
        }

        // Find the matching PLU file (case-insensitive)
        const pluFileNameUpper = pluFileName.toUpperCase();
        const actualFileName = pluFileNames.get(pluFileNameUpper);
        if (!actualFileName) {
          console.log(`[DataSync] Menu ${menuId}: .PLU file not found in PLUDATA: ${pluFileName}`);
          continue;
        }

        // Find the full path in files
        let matchingPluPath: string | undefined;
        for (const [fullPath] of files.entries()) {
          const upperPath = fullPath.toUpperCase();
          if (upperPath.startsWith('PLUDATA/') && upperPath.endsWith('/' + pluFileNameUpper)) {
            matchingPluPath = fullPath;
            console.log(`[DataSync] Menu ${menuId}: Matched PLU file: ${fullPath}`);
            break;
          }
        }

        if (!matchingPluPath) {
          console.log(`[DataSync] Menu ${menuId}: Could not locate full path for ${pluFileName}`);
          continue;
        }

        const pluContent = files.get(matchingPluPath);
        if (!pluContent) {
          console.log(`[DataSync] Menu ${menuId}: Could not read content for ${matchingPluPath}`);
          continue;
        }

        const kv = dataParser.parseKV(pluContent);
        const productName = kv.PRODUCT_DESCRIPTION || pluFileName.replace(/\.PLU$/i, '');
        const hotcode = kv.HOTCODE || undefined;
        const buttonColor = dataParser.parseColor(kv.BUTTON_COLOUR) || undefined;
        const fontColor = dataParser.parseColor(kv.FONT_COLOUR) || undefined;

        // De-duplicate by product name (case-insensitive)
        const productKey = productName.toUpperCase();
        if (seenProducts.has(productKey)) {
          console.log(`[DataSync] Menu ${menuId}: Duplicate product: ${productName}, skipping`);
          continue;
        }
        seenProducts.add(productKey);

        products.push({
          productName,
          filename: pluFileName,
          hotcode,
          buttonColor,
          fontColor,
        });

        console.log(`[DataSync] Menu ${menuId}: Added product: ${productName}${hotcode ? ` (hotcode: ${hotcode})` : ''}`);
      }

      console.log(`[DataSync] Menu ${menuId}: Final product count: ${products.length}`);
      console.log(`[DataSync] Menu ${menuId}: Has back button: ${hasBackButton}`);
      
      // If BACK.PLU was found, add a special marker product
      if (hasBackButton && products.length > 0) {
        products.push({
          productName: 'BACK.PLU',
          filename: 'BACK.PLU',
          hotcode: undefined,
          buttonColor: undefined,
          fontColor: undefined,
        });
      }

      menuData[menuId] = products;
    }

    console.log(`[DataSync] Parsed ${Object.keys(menuData).length} menus`);
    for (const [menuId, products] of Object.entries(menuData)) {
      console.log(`[DataSync] Menu ${menuId}: ${products.length} products`);
    }
    return menuData;
  }

  async getStoredMenuData(): Promise<MenuData> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MENU_DATA);
    return data ? JSON.parse(data) : {};
  }

  async getLastSyncTime(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  private async getFileMetadata(): Promise<Record<string, { lastModified?: string }>> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FILE_HASHES);
    return data ? JSON.parse(data) : {};
  }

  private async saveFileMetadata(manifest: { path: string; lastModified?: string }[]): Promise<void> {
    const metadata: Record<string, { lastModified?: string }> = {};
    for (const fileInfo of manifest) {
      metadata[fileInfo.path] = {
        lastModified: fileInfo.lastModified,
      };
    }
    await AsyncStorage.setItem(STORAGE_KEYS.FILE_HASHES, JSON.stringify(metadata));
  }

  private async parseAndMergeData(files: Map<string, string>): Promise<void> {
    const existingOperators = await this.getStoredOperators();
    const existingGroups = await this.getStoredGroups();
    const existingDepartments = await this.getStoredDepartments();
    const existingProducts = await this.getStoredProducts();
    const existingTenders = await this.getStoredTenders();
    const existingVATRates = await this.getStoredVATRates();
    const existingTables = await this.getStoredTables();
    const existingMenuData = await this.getStoredMenuData();

    const newOperators = await this.parseOperators(files);
    const { groups: newGroups, departments: newDepartments } = await this.parseProductStructure(files);
    const newMenuData = await this.parseMenuData(files);
    const menuProductFilenames = this.extractMenuProductFilenames(newMenuData);
    const newVATRates = await this.parseVAT(files);
    const newProducts = await this.parseProducts(files, menuProductFilenames, newVATRates);
    const newTenders = await this.parseTenders(files);
    const newTables = await this.parseTables(files);

    const mergedOperators = newOperators.length > 0 ? newOperators : existingOperators;
    const mergedGroups = newGroups.length > 0 ? newGroups : existingGroups;
    const mergedDepartments = newDepartments.length > 0 ? newDepartments : existingDepartments;
    const mergedProducts = newProducts.length > 0 ? newProducts : existingProducts;
    const mergedTenders = newTenders.length > 0 ? newTenders : existingTenders;
    const mergedVATRates = newVATRates.length > 0 ? newVATRates : existingVATRates;
    const mergedTables = newTables.length > 0 ? newTables : existingTables;
    const mergedMenuData = Object.keys(newMenuData).length > 0 ? newMenuData : existingMenuData;

    await AsyncStorage.setItem(STORAGE_KEYS.OPERATORS, JSON.stringify(mergedOperators));
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(mergedGroups));
    await AsyncStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(mergedDepartments));
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mergedProducts));
    await AsyncStorage.setItem(STORAGE_KEYS.TENDERS, JSON.stringify(mergedTenders));
    await AsyncStorage.setItem(STORAGE_KEYS.VAT_RATES, JSON.stringify(mergedVATRates));
    await AsyncStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(mergedTables));
    await AsyncStorage.setItem(STORAGE_KEYS.MENU_DATA, JSON.stringify(mergedMenuData));

    console.log('[DataSync] Merged:', {
      operators: mergedOperators.length,
      groups: mergedGroups.length,
      departments: mergedDepartments.length,
      products: mergedProducts.length,
      tenders: mergedTenders.length,
      vatRates: mergedVATRates.length,
      tables: mergedTables.length,
      menus: Object.keys(mergedMenuData).length,
    });
  }

  async startBackgroundSync(intervalMinutes: number = 15): Promise<void> {
    console.log(`[DataSync] Starting background sync every ${intervalMinutes} minutes`);
    const intervalMs = intervalMinutes * 60 * 1000;
    
    const syncInterval = setInterval(async () => {
      try {
        const lastSync = await this.getLastSyncTime();
        if (!lastSync) {
          console.log('[DataSync] No previous sync found, skipping background sync');
          return;
        }
        
        console.log('[DataSync] Running background incremental sync...');
        await this.syncData(undefined, true);
      } catch (error) {
        console.error('[DataSync] Background sync failed:', error);
      }
    }, intervalMs);

    return syncInterval as any;
  }

  async clearSiteInfo(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SITE_ID,
      STORAGE_KEYS.SITE_NAME,
      STORAGE_KEYS.CREDENTIALS,
    ]);
    console.log('[DataSync] Site info and credentials cleared');
  }

  async clearAllData(): Promise<void> {
    const keys = Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.THEME && key !== STORAGE_KEYS.THEME_PREFERENCE && key !== STORAGE_KEYS.BACKGROUND_SYNC_INTERVAL);
    await AsyncStorage.multiRemove(keys);
    console.log('[DataSync] All data cleared');
  }

  async hasInitialSyncCompleted(): Promise<boolean> {
    const lastSync = await this.getLastSyncTime();
    return lastSync !== null;
  }

  async setBackgroundSyncInterval(interval: 'disabled' | '6' | '12' | '24'): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.BACKGROUND_SYNC_INTERVAL, interval);
    console.log('[DataSync] Background sync interval set to:', interval, 'hours');
  }

  async getBackgroundSyncInterval(): Promise<'disabled' | '6' | '12' | '24'> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BACKGROUND_SYNC_INTERVAL);
    return (data as 'disabled' | '6' | '12' | '24') || 'disabled';
  }
}

export const dataSyncService = new DataSyncService();
