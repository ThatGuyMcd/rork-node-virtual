import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { BasketItem, Operator, Table } from '@/types/pos';
import { dataParser } from './dataParser';
import { dataSyncService } from './dataSync';
import { apiClient } from './api';

export interface TableDataRow {
  quantity: number;
  productName: string;
  price: number;
  pluFile: string;
  group: string;
  department: string;
  vatCode: string;
  vatPercentage: number;
  vatAmount: number;
  addedBy: string;
  timeDate: string;
  printer1: string;
  printer2: string;
  printer3: string;
  itemPrinted: string;
  tableId?: string;
}

class TableDataService {
  private readonly fileName = 'tabledata.csv';
  private data: Map<string, TableDataRow[]> = new Map();
  private tableFiles: Map<string, Map<string, string>> = new Map();
  
  private getFilePath(): string | null {
    if (Platform.OS === 'web') {
      return null;
    }
    if (!FileSystem.documentDirectory) {
      console.warn('[TableDataService] Document directory not available');
      return null;
    }
    return `${FileSystem.documentDirectory}${this.fileName}`;
  }
  
  private isFileSystemAvailable(): boolean {
    return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
  }

  private async createRows(
    table: Table,
    basket: BasketItem[],
    operator: Operator,
    vatRates: { code: string; percentage: number }[]
  ): Promise<TableDataRow[]> {
    const rows: TableDataRow[] = [];
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeDate = `${timeString} - ${dateString}`;

    const customPriceNames = await dataSyncService.getStoredCustomPriceNames();

    const labelToPrefixMap: Record<string, string> = {
      'half': 'HALF',
      'double': 'DBL',
      'small': 'SML',
      'large': 'LRG',
      '125ml': '125ML',
      '175ml': '175ML',
      '250ml': '250ML',
      'schooner': '2/3PT',
      'open': 'OPEN',
    };

    for (const item of basket) {
      const vatRate = vatRates.find(v => v.code === item.product.vatCode);
      const vatPercentage = vatRate?.percentage || 0;
      const priceExVat = item.selectedPrice.price / (1 + vatPercentage / 100);
      const vatAmount = item.selectedPrice.price - priceExVat;

      const groupIdNum = item.product.groupId.split('-')[0].trim();
      const deptIdNum = item.product.departmentId.split('-')[0].trim();
      const prodIdNum = item.product.id.replace('prod_', '').padStart(5, '0');
      const pluFile = `${groupIdNum}-${deptIdNum}-${prodIdNum}.PLU`;

      const baseName = item.product.name.split(' - ')[0];
      const messagePrefix = item.product.name.includes(' - ') ? ' - ' + item.product.name.split(' - ').slice(1).join(' - ') : '';
      const priceLabelLower = item.selectedPrice.label.toLowerCase();
      
      let prefix = labelToPrefixMap[priceLabelLower];
      
      const customMatch = item.selectedPrice.label.match(/^custom\s*(\d+)$/i);
      if (customMatch) {
        const priceNumber = customMatch[1];
        const customPriceData = customPriceNames[priceNumber];
        if (customPriceData?.prefix) {
          prefix = customPriceData.prefix;
        }
      }
      
      const shouldAddPrefix = prefix !== undefined;
      const productName = shouldAddPrefix ? `${prefix} ${baseName}${messagePrefix}` : item.product.name;

      rows.push({
        quantity: item.quantity,
        productName,
        price: item.selectedPrice.price,
        pluFile,
        group: item.product.groupId,
        department: item.product.departmentId,
        vatCode: item.product.vatCode,
        vatPercentage,
        vatAmount,
        addedBy: operator.name,
        timeDate,
        printer1: this.determinePrinter(item.product.groupId),
        printer2: 'NOT SET',
        printer3: 'NOT SET',
        itemPrinted: 'YES',
        tableId: table.id,
      });
    }

    return rows;
  }

  async saveTableDataLocally(
    table: Table,
    basket: BasketItem[],
    operator: Operator,
    vatRates: { code: string; percentage: number }[]
  ): Promise<void> {
    const rows = await this.createRows(table, basket, operator, vatRates);

    if (!this.isFileSystemAvailable()) {
      this.data.set(table.id, rows);
    } else {
      await this.clearTableDataLocally(table.id);
      await this.appendRowsToCSV(rows);
    }
  }

  async saveTableData(
    table: Table,
    basket: BasketItem[],
    operator: Operator,
    vatRates: { code: string; percentage: number }[]
  ): Promise<void> {
    const rows = await this.createRows(table, basket, operator, vatRates);

    if (!this.isFileSystemAvailable()) {
      this.data.set(table.id, rows);
    } else {
      await this.clearTableDataLocally(table.id);
      await this.appendRowsToCSV(rows);
      await this.saveTableDataToTableFolder(table, rows);
    }

    await this.syncToServer(table);
  }

  private async syncToServer(table: Table): Promise<void> {
    const siteInfo = await dataSyncService.getSiteInfo();
    if (!siteInfo) {
      console.warn('[TableDataService] No site info, skipping sync');
      return;
    }

    let allFiles = await this.getAllTableFiles(table);
    
    if (Object.keys(allFiles).length === 0) {
      console.log('[TableDataService] No files from file system, checking memory data');
      const memoryRows = this.data.get(table.id);
      if (memoryRows && memoryRows.length > 0) {
        console.log('[TableDataService] Found memory data, using it for upload');
        const csvContent = this.rowsToCSV(memoryRows);
        allFiles = { 'tabledata.csv': csvContent };
      } else {
        console.warn('[TableDataService] No files or memory data to upload for table:', table.name);
        throw new Error('No files to upload');
      }
    }
    
    const result = await apiClient.saveSingleTableData(
      siteInfo.siteId,
      table.area,
      table.name,
      allFiles['tabledata.csv'] || '',
      Object.fromEntries(Object.entries(allFiles).filter(([key]) => key !== 'tabledata.csv'))
    );
    
    if (!result.success) {
      throw new Error('Server sync failed');
    }
  }

  private rowsToCSV(rows: TableDataRow[]): string {
    const csvRows: string[] = [];
    csvRows.push('X,Product,Price,PLUFile,Group,Department,VATCode,VATPercentage,VATAmount,Added By,Time/Date Added,PRINTER 1,PRINTER 2,PRINTER 3,Item Printed?');

    for (const row of rows) {
      const line = [
        row.quantity.toFixed(3),
        ` ${row.productName}`,
        row.price.toFixed(2),
        row.pluFile,
        row.group,
        row.department,
        row.vatCode,
        row.vatPercentage.toString(),
        row.vatAmount.toFixed(2),
        row.addedBy,
        row.timeDate,
        row.printer1,
        row.printer2,
        row.printer3,
        row.itemPrinted,
      ].join(',');
      csvRows.push(line);
    }

    return csvRows.join('\n');
  }

  private async saveTableDataToTableFolder(table: Table, rows: TableDataRow[]): Promise<void> {
    if (!this.isFileSystemAvailable() || !FileSystem.documentDirectory) {
      console.log('[TableDataService] File system not available, skipping table folder save');
      return;
    }

    try {
      const tableFolder = `${FileSystem.documentDirectory}tables/${table.area}/${table.name}/`;
      console.log('[TableDataService] Ensuring table folder exists:', tableFolder);
      
      const folderInfo = await FileSystem.getInfoAsync(tableFolder);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(tableFolder, { intermediates: true });
        console.log('[TableDataService] Created table folder');
      }
      
      const csvContent = this.rowsToCSV(rows);
      const filePath = `${tableFolder}tabledata.csv`;
      await FileSystem.writeAsStringAsync(filePath, csvContent);
      console.log(`[TableDataService] Saved tabledata.csv to table folder (${csvContent.length} bytes)`);
    } catch (error) {
      console.error('[TableDataService] Error saving tabledata.csv to table folder:', error);
      throw error;
    }
  }

  private async getAllTableFiles(table: Table): Promise<Record<string, string>> {
    const allFiles: Record<string, string> = {};
    
    if (!this.isFileSystemAvailable() || !FileSystem.documentDirectory) {
      console.log('[TableDataService] File system not available, checking memory storage');
      const tableKey = `${table.area}/${table.name}`;
      const memoryFiles = this.tableFiles.get(tableKey);
      if (memoryFiles) {
        console.log(`[TableDataService] Found ${memoryFiles.size} files in memory for ${tableKey}`);
        return Object.fromEntries(memoryFiles);
      }
      console.log('[TableDataService] No files in memory storage');
      return allFiles;
    }

    try {
      const tableFolder = `${FileSystem.documentDirectory}tables/${table.area}/${table.name}/`;
      console.log('[TableDataService] Reading all files from:', tableFolder);
      
      const folderInfo = await FileSystem.getInfoAsync(tableFolder);
      
      if (!folderInfo.exists) {
        console.log('[TableDataService] Table folder does not exist');
        return allFiles;
      }
      
      if (!folderInfo.isDirectory) {
        console.log('[TableDataService] Path exists but is not a directory');
        return allFiles;
      }

      const files = await FileSystem.readDirectoryAsync(tableFolder);
      console.log('[TableDataService] Files found in table folder:', files);
      
      for (const file of files) {
        if (file === 'tableopen.ini') {
          console.log('[TableDataService] Skipping tableopen.ini');
          continue;
        }
        
        const filePath = `${tableFolder}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists && !fileInfo.isDirectory) {
          const content = await FileSystem.readAsStringAsync(filePath);
          allFiles[file] = content;
          console.log(`[TableDataService] Added file: ${file} (${content.length} bytes)`);
        }
      }
      
      console.log(`[TableDataService] Total files to upload: ${Object.keys(allFiles).length}`);
      console.log('[TableDataService] File names:', Object.keys(allFiles));
    } catch (error) {
      console.error('[TableDataService] Error reading table files:', error);
      throw error;
    }
    
    return allFiles;
  }

  async loadTableData(tableId: string): Promise<TableDataRow[]> {

    try {
      if (!this.isFileSystemAvailable()) {
        return this.data.get(tableId) || [];
      }
      
      const filePath = this.getFilePath();
      if (!filePath) return [];
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) return [];

      const content = await FileSystem.readAsStringAsync(filePath);
      const rows = dataParser.parseCSV(content);

      if (rows.length <= 1) return [];

      const header = rows[0].map(h => h.trim());
      const tableIdIndex = header.findIndex(h => /table.*id/i.test(h));

      const tableRows: TableDataRow[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowTableId = tableIdIndex >= 0 ? row[tableIdIndex]?.trim() : '';
        
        if (rowTableId === tableId) {
          tableRows.push({
            quantity: parseFloat(row[0] || '1'),
            productName: row[1]?.trim() || '',
            price: parseFloat(row[2] || '0'),
            pluFile: row[3]?.trim() || '',
            group: row[4]?.trim() || '',
            department: row[5]?.trim() || '',
            vatCode: row[6]?.trim() || '',
            vatPercentage: parseFloat(row[7] || '0'),
            vatAmount: parseFloat(row[8] || '0'),
            addedBy: row[9]?.trim() || '',
            timeDate: row[10]?.trim() || '',
            printer1: row[11]?.trim() || 'NOT SET',
            printer2: row[12]?.trim() || 'NOT SET',
            printer3: row[13]?.trim() || 'NOT SET',
            itemPrinted: row[14]?.trim() || 'NO',
            tableId: rowTableId,
          });
        }
      }

      return tableRows;
    } catch (error) {
      console.error('[TableDataService] Load error:', error);
      return [];
    }
  }

  async clearTableDataLocally(tableId: string): Promise<void> {

    try {
      if (!this.isFileSystemAvailable()) {
        this.data.delete(tableId);
        return;
      }
      
      const filePath = this.getFilePath();
      if (!filePath) return;
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) return;

      const content = await FileSystem.readAsStringAsync(filePath);
      const rows = dataParser.parseCSV(content);

      if (rows.length <= 1) return;

      const header = rows[0];
      const tableIdIndex = header.findIndex(h => /table.*id/i.test(h.trim()));
      
      const filteredRows = [header];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowTableId = tableIdIndex >= 0 ? row[tableIdIndex]?.trim() : '';
        
        if (rowTableId !== tableId) {
          filteredRows.push(row);
        }
      }

      const csvContent = filteredRows.map(row => row.join(',')).join('\n');
      await FileSystem.writeAsStringAsync(filePath, csvContent);
    } catch (error) {
      console.error('[TableDataService] Clear error:', error);
    }
  }

  async clearTableData(tableId: string, table?: Table): Promise<void> {
    await this.clearTableDataLocally(tableId);
    
    if (table) {
      if (this.isFileSystemAvailable() && FileSystem.documentDirectory) {
        const tableFolder = `${FileSystem.documentDirectory}tables/${table.area}/${table.name}/`;
        const folderInfo = await FileSystem.getInfoAsync(tableFolder);
        if (folderInfo.exists) {
          await FileSystem.deleteAsync(tableFolder, { idempotent: true });
          console.log('[TableDataService] Deleted table folder:', tableFolder);
        }
        await this.syncToServer(table);
      } else {
        const tableKey = `${table.area}/${table.name}`;
        this.tableFiles.delete(tableKey);
        console.log('[TableDataService] Cleared table files from memory:', tableKey);
        await this.syncToServer(table);
      }
    }
  }

  private async appendRowsToCSV(rows: TableDataRow[]): Promise<void> {
    try {
      const filePath = this.getFilePath();
      if (!filePath) throw new Error('File system not available');
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      let content = '';

      if (!fileInfo.exists) {
        content = 'X,Product,Price,PLUFile,Group,Department,VATCode,VATPercentage,VATAmount,Added By,Time/Date Added,PRINTER 1,PRINTER 2,PRINTER 3,Item Printed?,Table ID\n';
      } else {
        content = await FileSystem.readAsStringAsync(filePath);
        if (content.length > 0 && !content.endsWith('\n')) {
          content += '\n';
        }
      }

      for (const row of rows) {
        const line = [
          row.quantity.toFixed(3),
          ` ${row.productName}`,
          row.price.toFixed(2),
          row.pluFile,
          row.group,
          row.department,
          row.vatCode,
          row.vatPercentage,
          row.vatAmount.toFixed(2),
          row.addedBy,
          row.timeDate,
          row.printer1,
          row.printer2,
          row.printer3,
          row.itemPrinted,
          row.tableId || '',
        ].join(',');
        
        content += line + '\n';
      }

      await FileSystem.writeAsStringAsync(filePath, content);
    } catch (error) {
      console.error('[TableDataService] Append error:', error);
      throw error;
    }
  }

  storeTableFilesInMemory(area: string, tableName: string, files: Map<string, string>): void {
    const tableKey = `${area}/${tableName}`;
    this.tableFiles.set(tableKey, new Map(files));
    console.log(`[TableDataService] Stored ${files.size} files in memory for ${tableKey}`);
  }

  private determinePrinter(group: string): string {
    if (group.toLowerCase().includes('food')) {
      return 'KITCHEN_PRINTER_1';
    } else if (group.toLowerCase().includes('drink')) {
      return 'KITCHEN_PRINTER_2';
    }
    return 'KITCHEN_PRINTER_1';
  }

  async getTableStatus(tableId: string): Promise<{ hasData: boolean; subtotal: number }> {
    const rows = await this.loadTableData(tableId);
    const hasData = rows.length > 0;
    const subtotal = rows.reduce((sum, row) => sum + (row.quantity * row.price), 0);
    return { hasData, subtotal };
  }

  private async isTableLockedInMemory(tableId: string): Promise<boolean> {
    for (const [tableKey, files] of this.tableFiles.entries()) {
      if (files.has('tableopen.ini')) {
        const tables = await dataSyncService.getStoredTables();
        const table = tables.find(t => `${t.area}/${t.name}` === tableKey && t.id === tableId);
        if (table) {
          return true;
        }
      }
    }
    return false;
  }

  private async isTableLockedInFileSystem(tableId: string): Promise<boolean> {
    if (!this.isFileSystemAvailable() || !FileSystem.documentDirectory) {
      return false;
    }
    
    try {
      const tables = await dataSyncService.getStoredTables();
      const table = tables.find(t => t.id === tableId);
      if (!table) {
        return false;
      }
      
      const tableFolder = `${FileSystem.documentDirectory}tables/${table.area}/${table.name}/`;
      const tableopenPath = `${tableFolder}tableopen.ini`;
      const fileInfo = await FileSystem.getInfoAsync(tableopenPath);
      return fileInfo.exists;
    } catch (error) {
      console.error('[TableDataService] Error checking table lock:', error);
      return false;
    }
  }

  async getAllTableStatuses(tableIds: string[]): Promise<Map<string, { hasData: boolean; subtotal: number; isLocked: boolean }>> {
    const statusMap = new Map<string, { hasData: boolean; subtotal: number; isLocked: boolean }>();
    
    try {
      if (!this.isFileSystemAvailable()) {
        for (const tableId of tableIds) {
          const rows = this.data.get(tableId) || [];
          const hasData = rows.length > 0;
          const subtotal = rows.reduce((sum, row) => sum + (row.quantity * row.price), 0);
          const isLocked = await this.isTableLockedInMemory(tableId);
          statusMap.set(tableId, { hasData, subtotal, isLocked });
        }
        return statusMap;
      }
      
      const filePath = this.getFilePath();
      if (!filePath) {
        tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0, isLocked: false }));
        return statusMap;
      }
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0, isLocked: false }));
        return statusMap;
      }

      const content = await FileSystem.readAsStringAsync(filePath);
      const rows = dataParser.parseCSV(content);

      if (rows.length <= 1) {
        tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0, isLocked: false }));
        return statusMap;
      }

      const header = rows[0].map(h => h.trim());
      const tableIdIndex = header.findIndex(h => /table.*id/i.test(h));
      
      const tableDataMap = new Map<string, TableDataRow[]>();
      tableIds.forEach(id => tableDataMap.set(id, []));

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowTableId = tableIdIndex >= 0 ? row[tableIdIndex]?.trim() : '';
        
        if (tableIds.includes(rowTableId)) {
          const tableRow: TableDataRow = {
            quantity: parseFloat(row[0] || '1'),
            productName: row[1]?.trim() || '',
            price: parseFloat(row[2] || '0'),
            pluFile: row[3]?.trim() || '',
            group: row[4]?.trim() || '',
            department: row[5]?.trim() || '',
            vatCode: row[6]?.trim() || '',
            vatPercentage: parseFloat(row[7] || '0'),
            vatAmount: parseFloat(row[8] || '0'),
            addedBy: row[9]?.trim() || '',
            timeDate: row[10]?.trim() || '',
            printer1: row[11]?.trim() || 'NOT SET',
            printer2: row[12]?.trim() || 'NOT SET',
            printer3: row[13]?.trim() || 'NOT SET',
            itemPrinted: row[14]?.trim() || 'NO',
            tableId: rowTableId,
          };
          tableDataMap.get(rowTableId)?.push(tableRow);
        }
      }

      for (const tableId of tableIds) {
        const tableRows = tableDataMap.get(tableId) || [];
        const hasData = tableRows.length > 0;
        const subtotal = tableRows.reduce((sum, row) => sum + (row.quantity * row.price), 0);
        const isLocked = await this.isTableLockedInFileSystem(tableId);
        statusMap.set(tableId, { hasData, subtotal, isLocked });
      }
    } catch (error) {
      console.error('[TableDataService] Batch status error:', error);
      tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0, isLocked: false }));
    }
    
    return statusMap;
  }

  async exportCSV(): Promise<string | null> {
    try {
      if (!this.isFileSystemAvailable()) return null;
      
      const filePath = this.getFilePath();
      if (!filePath) return null;
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) return null;

      return filePath;
    } catch (error) {
      console.error('[TableDataService] Export error:', error);
      return null;
    }
  }

  async syncSingleTableToServerSafe(
    table: Table,
    basket: BasketItem[],
    operator: Operator,
    vatRates: { code: string; percentage: number }[]
  ): Promise<void> {
    const rows = await this.createRows(table, basket, operator, vatRates);
    
    if (!this.isFileSystemAvailable()) {
      this.data.set(table.id, rows);
      console.log('[TableDataService] Stored table data in memory for web upload');
      
      const tableKey = `${table.area}/${table.name}`;
      let files = this.tableFiles.get(tableKey);
      if (!files) {
        files = new Map();
        this.tableFiles.set(tableKey, files);
      }
      const csvContent = this.rowsToCSV(rows);
      files.set('tabledata.csv', csvContent);
      console.log(`[TableDataService] Updated tabledata.csv in memory for ${tableKey}`);
    } else {
      await this.saveTableDataToTableFolder(table, rows);
    }
    
    await this.syncToServer(table);
  }

  async syncClearTableToServerSafe(table: Table): Promise<void> {
    if (!this.isFileSystemAvailable()) {
      this.data.delete(table.id);
      const tableKey = `${table.area}/${table.name}`;
      this.tableFiles.delete(tableKey);
      console.log('[TableDataService] Cleared table data from memory for web upload');
    } else if (FileSystem.documentDirectory) {
      const tableFolder = `${FileSystem.documentDirectory}tables/${table.area}/${table.name}/`;
      const folderInfo = await FileSystem.getInfoAsync(tableFolder);
      if (folderInfo.exists) {
        await FileSystem.deleteAsync(tableFolder, { idempotent: true });
        console.log('[TableDataService] Deleted table folder for clear sync:', tableFolder);
      }
    }
    await this.syncToServer(table);
  }

  async syncAllTableDataToServer(): Promise<void> {
    const siteInfo = await dataSyncService.getSiteInfo();
    if (!siteInfo) {
      return;
    }
    
    const allTableData = await this.getAllTableDataGrouped();
    
    if (allTableData.size === 0) {
      return;
    }
    
    const result = await apiClient.saveAllTableData(siteInfo.siteId, allTableData);
    if (!result.success) {
      throw new Error('Failed to sync all tables');
    }
  }

  private async getAllTableDataGrouped(): Promise<Map<string, TableDataRow[]>> {
    const groupedData = new Map<string, TableDataRow[]>();
    
    try {
      if (!this.isFileSystemAvailable()) {
        for (const [tableId, rows] of this.data.entries()) {
          groupedData.set(tableId, rows);
        }
        return groupedData;
      }
      
      const filePath = this.getFilePath();
      if (!filePath) return groupedData;
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) return groupedData;

      const content = await FileSystem.readAsStringAsync(filePath);
      const rows = dataParser.parseCSV(content);

      if (rows.length <= 1) return groupedData;

      const header = rows[0].map(h => h.trim());
      const tableIdIndex = header.findIndex(h => /table.*id/i.test(h));

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowTableId = tableIdIndex >= 0 ? row[tableIdIndex]?.trim() : '';
        
        if (rowTableId) {
          if (!groupedData.has(rowTableId)) {
            groupedData.set(rowTableId, []);
          }
          
          groupedData.get(rowTableId)!.push({
            quantity: parseFloat(row[0] || '1'),
            productName: row[1]?.trim() || '',
            price: parseFloat(row[2] || '0'),
            pluFile: row[3]?.trim() || '',
            group: row[4]?.trim() || '',
            department: row[5]?.trim() || '',
            vatCode: row[6]?.trim() || '',
            vatPercentage: parseFloat(row[7] || '0'),
            vatAmount: parseFloat(row[8] || '0'),
            addedBy: row[9]?.trim() || '',
            timeDate: row[10]?.trim() || '',
            printer1: row[11]?.trim() || 'NOT SET',
            printer2: row[12]?.trim() || 'NOT SET',
            printer3: row[13]?.trim() || 'NOT SET',
            itemPrinted: row[14]?.trim() || 'NO',
            tableId: rowTableId,
          });
        }
      }
    } catch (error) {
      console.error('[TableDataService] Error getting grouped data:', error);
    }
    
    return groupedData;
  }
}

export const tableDataService = new TableDataService();
