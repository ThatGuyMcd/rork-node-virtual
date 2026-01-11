import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
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
  CUSTOM_PRICE_NAMES: 'pos_custom_price_names',
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

  private getFriendlyName(folder: string): string {
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
  }

  private async downloadFilesWithConcurrency(
    siteId: string,
    filesToDownload: { path: string; lastModified?: string }[],
    onProgress?: (progress: SyncProgress) => void,
    options?: {
      maxConcurrentDownloads?: number;
      progressTotalOverride?: number;
      progressBaseCompleted?: number;
      progressFolderOverride?: string;
    }
  ): Promise<Map<string, string>> {
    const isAndroid = Platform.OS === 'android';

    const androidMax = options?.maxConcurrentDownloads ? Math.max(1, options.maxConcurrentDownloads) : 8;
    const defaultConcurrency = isAndroid ? 12 : 12;
    const maxAllowed = isAndroid ? Math.max(8, androidMax) : 40;
    const maxConcurrentDownloads = Math.max(1, Math.min(maxAllowed, options?.maxConcurrentDownloads ?? defaultConcurrency));
    const progressTotal = options?.progressTotalOverride ?? filesToDownload.length;
    const progressBaseCompleted = options?.progressBaseCompleted ?? 0;

    console.log('[DataSync] Platform:', Platform.OS);
    console.log('[DataSync] Download concurrency:', maxConcurrentDownloads);
    console.log('[DataSync] Files to download:', filesToDownload.length);

    const files: Map<string, string> = new Map();
    let completed = 0;
    let lastProgressFolder = '';

    const queue = [...filesToDownload];

    const worker = async (workerId: number) => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;

        try {
          const text = await apiClient.getFile(siteId, next.path);
          files.set(next.path, text);
        } catch (error) {
          console.error(`[DataSync] Worker ${workerId} failed to download ${next.path}:`, error);
        } finally {
          completed++;

          const folder = options?.progressFolderOverride ?? (next.path.split('/')[0] || 'root');
          if (folder !== lastProgressFolder) {
            lastProgressFolder = folder;
          }

          const current = progressBaseCompleted + completed;
          if (completed % 5 === 0 || completed === filesToDownload.length) {
            onProgress?.({
              phase: 'downloading',
              current,
              total: progressTotal,
              message: this.getFriendlyName(lastProgressFolder),
            });
          }
        }
      }
    };

    const workers = Array.from({ length: Math.min(maxConcurrentDownloads, filesToDownload.length) }, (_, idx) => worker(idx + 1));
    await Promise.all(workers);

    return files;
  }

  private isPluFilePath(path: string): boolean {
    const upper = path.toUpperCase();
    return upper.startsWith('PLUDATA/') && upper.endsWith('.PLU') && !upper.includes('ERRORCORRECT.PLU');
  }

  private extractFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  async syncData(
    onProgress?: (progress: SyncProgress) => void,
    isIncremental: boolean = false,
    options?: { smartPluDownload?: boolean; maxConcurrentDownloads?: number; aggressiveAndroidConcurrency?: boolean }
  ): Promise<void> {
    const isAndroid = Platform.OS === 'android';

    const androidMax = options?.aggressiveAndroidConcurrency ? 16 : 8;
    const androidDefault = options?.aggressiveAndroidConcurrency ? 12 : 6;

    const effectiveOptions = {
      ...options,
      maxConcurrentDownloads: isAndroid
        ? Math.min(options?.maxConcurrentDownloads ?? androidDefault, androidMax)
        : (options?.maxConcurrentDownloads ?? 12),
    };
    
    console.log(`[DataSync] ========== STARTING ${isIncremental ? 'INCREMENTAL' : 'FULL'} DATA SYNC ==========`);
    console.log('[DataSync] Platform:', Platform.OS);
    console.log('[DataSync] Options:', JSON.stringify(effectiveOptions));

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

    onProgress?.({ phase: 'downloading', current: 0, total: filesToDownload.length, message: 'Syncing files...' });

    const files: Map<string, string> = new Map();

    const smartPluDownload = !isIncremental && (options?.smartPluDownload ?? false);

    if (smartPluDownload) {
      console.log('[DataSync] Smart PLU download ENABLED (menu-driven)');

      const nonPluFiles = filesToDownload.filter(f => !this.isPluFilePath(f.path));
      const pluFiles = filesToDownload.filter(f => this.isPluFilePath(f.path));

      console.log('[DataSync] Non-PLU files:', nonPluFiles.length);
      console.log('[DataSync] PLU candidates:', pluFiles.length);

      const nonPluDownloaded = await this.downloadFilesWithConcurrency(siteInfo.siteId, nonPluFiles, onProgress, {
        maxConcurrentDownloads: effectiveOptions.maxConcurrentDownloads,
        progressTotalOverride: nonPluFiles.length + pluFiles.length,
      });

      for (const [path, content] of nonPluDownloaded.entries()) {
        files.set(path, content);
      }

      onProgress?.({ phase: 'parsing', current: 0, total: 1, message: 'Processing menus to optimize download...' });

      let menuData: MenuData = {};
      try {
        menuData = await this.parseMenuData(files);
      } catch (e) {
        console.error('[DataSync] Failed to parse menus during smart download, falling back to full PLU download:', e);
      }

      const menuProductFilenames = this.extractMenuProductFilenames(menuData);
      console.log('[DataSync] Menu referenced products:', menuProductFilenames.size);

      let selectedPluFiles = pluFiles;
      if (menuProductFilenames.size > 0) {
        selectedPluFiles = pluFiles.filter(f => {
          const fileNameUpper = this.extractFileName(f.path).toUpperCase();
          return menuProductFilenames.has(fileNameUpper);
        });
      }

      console.log('[DataSync] Selected PLU files to download:', selectedPluFiles.length);

      const pluDownloaded = await this.downloadFilesWithConcurrency(siteInfo.siteId, selectedPluFiles, onProgress, {
        maxConcurrentDownloads: effectiveOptions.maxConcurrentDownloads,
        progressTotalOverride: nonPluFiles.length + pluFiles.length,
        progressBaseCompleted: nonPluFiles.length,
        progressFolderOverride: 'PLUDATA',
      });

      for (const [path, content] of pluDownloaded.entries()) {
        files.set(path, content);
      }

      const skippedPluCount = pluFiles.length - selectedPluFiles.length;
      console.log('[DataSync] Smart download skipped PLU files:', skippedPluCount);
    } else {
      const downloaded = await this.downloadFilesWithConcurrency(siteInfo.siteId, filesToDownload, onProgress, {
        maxConcurrentDownloads: effectiveOptions.maxConcurrentDownloads,
      });
      for (const [path, content] of downloaded.entries()) {
        files.set(path, content);
      }
    }

    onProgress?.({ phase: 'parsing', current: 0, total: 1, message: 'Processing data...' });

    await this.saveTableDataFiles(files);

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

  private async saveTableDataFiles(files: Map<string, string>): Promise<void> {
    const isWeb = Platform.OS === 'web' || !FileSystem.documentDirectory;
    const isAndroid = Platform.OS === 'android';

    const tabEntries: { path: string; content: string }[] = [];
    for (const [path, content] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('TABDATA/')) continue;
      if (upper.endsWith('.INI')) {
        console.log(`[DataSync] Skipping .ini file: ${path}`);
        continue;
      }
      tabEntries.push({ path, content });
    }

    if (tabEntries.length === 0) {
      console.log('[DataSync] No TABDATA files present in this sync payload');
      return;
    }

    if (isWeb) {
      console.log('[DataSync] Saving TABDATA files to memory storage for web...');
      const tableFilesMap = new Map<string, Map<string, string>>();

      for (const { path, content } of tabEntries) {
        const parts = path.slice('TABDATA/'.length).split('/');
        if (parts.length < 3) continue;

        const area = parts[0];
        const table = parts[1];
        const fileName = parts[2];
        const tableKey = `${area}/${table}`;

        if (!tableFilesMap.has(tableKey)) {
          tableFilesMap.set(tableKey, new Map());
        }

        tableFilesMap.get(tableKey)!.set(fileName, content);
      }

      const { tableDataService } = await import('./tableDataService');
      for (const [tableKey, fileMap] of tableFilesMap.entries()) {
        const [area, tableName] = tableKey.split('/');
        tableDataService.storeTableFilesInMemory(area, tableName, fileMap);
      }

      console.log(`[DataSync] Stored ${tableFilesMap.size} tables in memory with their files`);
      return;
    }

    console.log('[DataSync] Saving TABDATA files to local file system...');

    const folderCache = new Set<string>();

    const ensureFolder = async (folderPath: string) => {
      if (folderCache.has(folderPath)) return;
      const folderInfo = await FileSystem.getInfoAsync(folderPath);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      }
      folderCache.add(folderPath);
    };

    const folderGroups = new Map<string, { path: string; content: string; fileName: string }[]>();
    for (const { path, content } of tabEntries) {
      const parts = path.slice('TABDATA/'.length).split('/');
      if (parts.length < 3) continue;
      const area = parts[0];
      const table = parts[1];
      const fileName = parts[2];
      const tableFolder = `${FileSystem.documentDirectory}tables/${area}/${table}/`;
      
      if (!folderGroups.has(tableFolder)) {
        folderGroups.set(tableFolder, []);
      }
      folderGroups.get(tableFolder)!.push({ path, content, fileName });
    }

    const folders = Array.from(folderGroups.keys());
    for (const folder of folders) {
      await ensureFolder(folder);
    }

    const allFiles = Array.from(folderGroups.entries()).flatMap(([folder, files]) =>
      files.map(f => ({ folder, ...f }))
    );

    const maxConcurrentWrites = isAndroid ? 4 : Math.max(2, Math.min(20, Math.round(allFiles.length / 8) + 6));
    console.log('[DataSync] TABDATA write concurrency:', maxConcurrentWrites);

    let savedCount = 0;
    let index = 0;

    const writeWorker = async () => {
      while (index < allFiles.length) {
        const currentIndex = index++;
        const file = allFiles[currentIndex];
        if (!file) continue;
        
        try {
          const filePath = `${file.folder}${file.fileName}`;
          await FileSystem.writeAsStringAsync(filePath, file.content);
          savedCount++;
        } catch (error) {
          console.error(`[DataSync] Error saving table file ${file.path}:`, error);
        }
      }
    };

    const workers = Array.from({ length: Math.min(maxConcurrentWrites, allFiles.length) }, writeWorker);
    await Promise.all(workers);

    console.log(`[DataSync] Saved ${savedCount} table data files to local file system`);
  }

  private async parseAndStoreData(files: Map<string, string>): Promise<void> {
    const [operators, { groups, departments }, menuData, vatRates, tenders, tables, customPriceNames] = await Promise.all([
      this.parseOperators(files),
      this.parseProductStructure(files),
      this.parseMenuData(files),
      this.parseVAT(files),
      this.parseTenders(files),
      this.parseTables(files),
      this.parseCustomPriceNames(files),
    ]);
    
    const menuProductFilenames = this.extractMenuProductFilenames(menuData);
    const products = await this.parseProducts(files, menuProductFilenames, vatRates);

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.OPERATORS, JSON.stringify(operators)],
      [STORAGE_KEYS.GROUPS, JSON.stringify(groups)],
      [STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments)],
      [STORAGE_KEYS.PRODUCTS, JSON.stringify(products)],
      [STORAGE_KEYS.TENDERS, JSON.stringify(tenders)],
      [STORAGE_KEYS.VAT_RATES, JSON.stringify(vatRates)],
      [STORAGE_KEYS.TABLES, JSON.stringify(tables)],
      [STORAGE_KEYS.MENU_DATA, JSON.stringify(menuData)],
      [STORAGE_KEYS.CUSTOM_PRICE_NAMES, JSON.stringify(customPriceNames)],
    ]);
  }

  private findFileByPattern(files: Map<string, string>, pattern: RegExp): string | undefined {
    for (const [path, content] of files.entries()) {
      if (pattern.test(path.toUpperCase())) {
        return content;
      }
    }
    return undefined;
  }

  private async parseOperators(files: Map<string, string>): Promise<Operator[]> {
    const content = this.findFileByPattern(files, /^OPERATORDATA\/ACTIVE_OPERATORS\.CSV$/i);
    if (!content) {
      console.log('[DataSync] No ACTIVE_OPERATORS.CSV found in files');
      console.log('[DataSync] Available files:', Array.from(files.keys()).filter(k => k.toUpperCase().includes('OPERATOR')));
      return [];
    }
    console.log('[DataSync] Found ACTIVE_OPERATORS.CSV, parsing...');
    
    const operators: Operator[] = [];
    const rows = dataParser.parseCSV(content);
    if (rows.length <= 1) return [];

    const header = rows[0].map(h => h.trim().toLowerCase());
    const nameIdx = header.findIndex(h => /operator.*name|name|user.*name/i.test(h));
    const activeIdx = header.findIndex(h => /user.*active|active/i.test(h));
    const pinIdx = header.findIndex(h => /passcode|pin|password/i.test(h));
    const managerIdx = header.findIndex(h => /manager/i.test(h));
    const activeValues = new Set(['true', 'yes', '1', 'y', 'on', 'active']);
    const managerValues = new Set(['true', 'yes', '1', 'y']);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = nameIdx >= 0 ? row[nameIdx]?.trim() : '';
      if (!name) continue;

      const activeRaw = activeIdx >= 0 ? row[activeIdx]?.trim().toLowerCase() : 'true';
      const active = activeValues.has(activeRaw);
      if (!active) continue;

      const pin = pinIdx >= 0 ? row[pinIdx]?.trim() : '';
      const managerRaw = managerIdx >= 0 ? row[managerIdx]?.trim().toLowerCase() : 'false';
      const isManager = managerValues.has(managerRaw);

      operators.push({ id: `op_${i}`, name, pin, active, isManager });
    }

    return operators;
  }

  private async parseProductStructure(files: Map<string, string>): Promise<{ groups: ProductGroup[]; departments: Department[] }> {
    const groups: ProductGroup[] = [];
    const departments: Department[] = [];
    const groupSet = new Set<string>();
    const deptMap = new Map<string, { group: string; dept: string }>();

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



    const sortedGroups = Array.from(groupSet).sort();
    sortedGroups.forEach((group, index) => {
      groups.push({
        id: `grp_${index}`,
        name: group,
        color: '#10b981',
      });

    });

    let deptIndex = 0;
    for (const { group, dept } of deptMap.values()) {
      const groupObj = groups.find(g => g.name === group);
      if (!groupObj) {
        continue;
      }
      
      departments.push({
        id: `dept_${deptIndex++}`,
        groupId: groupObj.id,
        name: dept,
        color: '#3b82f6',
      });

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

    return filenames;
  }

  private async parseProducts(files: Map<string, string>, menuProductFilenames: Set<string>, vatRates: VATRate[] = []): Promise<Product[]> {
    const products: Product[] = [];
    let productIndex = 0;
    const vatRateMap = new Map(vatRates.map(r => [r.code.toUpperCase(), r.percentage]));
    const nonSellableValues = new Set(['no', 'false', '0', 'n', 'off']);

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
      const isSellable = !sellableRaw || !nonSellableValues.has(sellableRaw);
      
      if (!isSellable && !isInMenu) continue;

      const name = kv.PRODUCT_DESCRIPTION || fileName;
      let prices = dataParser.parsePriceOptions(kv);
      const vatCode = (kv.VAT_CODE || 'S').trim();
      
      let vatPercentage = parseFloat(kv.VAT_PERCENTAGE || kv.VAT_RATE || kv.VAT || '20') || 20;
      const matchingVatPercentage = vatRateMap.get(vatCode.toUpperCase());
      if (matchingVatPercentage !== undefined) {
        vatPercentage = matchingVatPercentage;
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


    }

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
    
    const pluFileNames = new Map<string, string>();
    const pluPathMap = new Map<string, string>();
    
    for (const [path] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('PLUDATA/')) continue;
      if (!upper.endsWith('.PLU')) continue;
      if (upper.includes('ERRORCORRECT.PLU')) continue;
      
      const fileName = path.split('/').pop();
      if (fileName) {
        const upperFileName = fileName.toUpperCase();
        pluFileNames.set(upperFileName, fileName);
        pluPathMap.set(upperFileName, path);
      }
    }

    for (const [path, content] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.startsWith('MENUDATA/')) continue;
      if (!upper.endsWith('.CSV')) continue;

      const fileName = path.split('/').pop()?.replace(/\.CSV$/i, '') || '';
      const menuMatch = fileName.match(/^MENU\s*(\d+)$/i) || fileName.match(/^(\d+)$/);
      if (!menuMatch) continue;

      const menuNumber = menuMatch[1].padStart(2, '0');
      const menuId = `MENU${menuNumber}`;

      const rows = dataParser.parseCSV(content);
      const products: MenuData[string] = [];
      const seenProducts = new Set<string>();
      let hasBackButton = false;

      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (row.length < 2) continue;
        
        const pluPath = row[1]?.trim();
        if (!pluPath) continue;

        const pathParts = pluPath.split(/[\\/]/);
        const pluFileName = pathParts[pathParts.length - 1];
        if (!pluFileName) continue;

        if (pluFileName.toUpperCase() === 'BACK.PLU') {
          hasBackButton = true;
          continue;
        }

        const fileNameWithoutExt = pluFileName.replace(/\.PLU$/i, '');
        if (!/^\d{3}-\d{3}-/.test(fileNameWithoutExt)) continue;

        const pluFileNameUpper = pluFileName.toUpperCase();
        const matchingPluPath = pluPathMap.get(pluFileNameUpper);
        if (!matchingPluPath) continue;

        const pluContent = files.get(matchingPluPath);
        if (!pluContent) continue;

        const kv = dataParser.parseKV(pluContent);
        const productName = kv.PRODUCT_DESCRIPTION || fileNameWithoutExt;
        
        const productKey = productName.toUpperCase();
        if (seenProducts.has(productKey)) continue;
        seenProducts.add(productKey);

        products.push({
          productName,
          filename: pluFileName,
          hotcode: kv.HOTCODE || undefined,
          buttonColor: dataParser.parseColor(kv.BUTTON_COLOUR) || undefined,
          fontColor: dataParser.parseColor(kv.FONT_COLOUR) || undefined,
        });
      }

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

    return menuData;
  }

  async getStoredMenuData(): Promise<MenuData> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MENU_DATA);
    return data ? JSON.parse(data) : {};
  }

  private async parseCustomPriceNames(files: Map<string, string>): Promise<Record<string, { name: string; prefix: string }>> {
    const customPriceNames: Record<string, { name: string; prefix: string }> = {};
    
    for (const [path, content] of files.entries()) {
      const upper = path.toUpperCase();
      if (!upper.includes('FUNCTIONDATA/ALL FUNCTIONS/CUSTOM PRICING/')) continue;
      if (!upper.endsWith('.PLU')) continue;
      
      const fileName = path.split('/').pop()?.toUpperCase() || '';
      const match = fileName.match(/^CUSTOM_PRICE_(\d+)\.PLU$/i);
      if (!match) continue;
      
      const priceNumber = match[1];
      const kv = dataParser.parseKV(content);
      const description = kv.PRODUCT_DESCRIPTION?.trim();
      const prefix = kv.PREFIX?.trim();
      
      if (description) {
        customPriceNames[priceNumber] = {
          name: description,
          prefix: prefix || description.toUpperCase(),
        };
        console.log(`[DataSync] Custom price ${priceNumber}: ${description} (prefix: ${prefix || description.toUpperCase()})`);
      }
    }
    
    return customPriceNames;
  }

  async getStoredCustomPriceNames(): Promise<Record<string, { name: string; prefix: string }>> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_PRICE_NAMES);
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
    const [existing, parsed] = await Promise.all([
      Promise.all([
        this.getStoredOperators(),
        this.getStoredGroups(),
        this.getStoredDepartments(),
        this.getStoredProducts(),
        this.getStoredTenders(),
        this.getStoredVATRates(),
        this.getStoredTables(),
        this.getStoredMenuData(),
        this.getStoredCustomPriceNames(),
      ]),
      Promise.all([
        this.parseOperators(files),
        this.parseProductStructure(files),
        this.parseMenuData(files),
        this.parseVAT(files),
        this.parseTenders(files),
        this.parseTables(files),
        this.parseCustomPriceNames(files),
      ]),
    ]);

    const [existingOperators, existingGroups, existingDepartments, existingProducts, existingTenders, existingVATRates, existingTables, existingMenuData, existingCustomPriceNames] = existing;
    const [newOperators, { groups: newGroups, departments: newDepartments }, newMenuData, newVATRates, newTenders, newTables, newCustomPriceNames] = parsed;
    
    const menuProductFilenames = this.extractMenuProductFilenames(newMenuData);
    const newProducts = await this.parseProducts(files, menuProductFilenames, newVATRates);

    const mergedOperators = newOperators.length > 0 ? newOperators : existingOperators;
    const mergedGroups = newGroups.length > 0 ? newGroups : existingGroups;
    const mergedDepartments = newDepartments.length > 0 ? newDepartments : existingDepartments;
    const mergedProducts = newProducts.length > 0 ? newProducts : existingProducts;
    const mergedTenders = newTenders.length > 0 ? newTenders : existingTenders;
    const mergedVATRates = newVATRates.length > 0 ? newVATRates : existingVATRates;
    const mergedTables = newTables.length > 0 ? newTables : existingTables;
    const mergedMenuData = Object.keys(newMenuData).length > 0 ? newMenuData : existingMenuData;
    const mergedCustomPriceNames = Object.keys(newCustomPriceNames).length > 0 ? newCustomPriceNames : existingCustomPriceNames;

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.OPERATORS, JSON.stringify(mergedOperators)],
      [STORAGE_KEYS.GROUPS, JSON.stringify(mergedGroups)],
      [STORAGE_KEYS.DEPARTMENTS, JSON.stringify(mergedDepartments)],
      [STORAGE_KEYS.PRODUCTS, JSON.stringify(mergedProducts)],
      [STORAGE_KEYS.TENDERS, JSON.stringify(mergedTenders)],
      [STORAGE_KEYS.VAT_RATES, JSON.stringify(mergedVATRates)],
      [STORAGE_KEYS.TABLES, JSON.stringify(mergedTables)],
      [STORAGE_KEYS.MENU_DATA, JSON.stringify(mergedMenuData)],
      [STORAGE_KEYS.CUSTOM_PRICE_NAMES, JSON.stringify(mergedCustomPriceNames)],
    ]);
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
