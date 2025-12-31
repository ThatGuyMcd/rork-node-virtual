import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { BasketItem, Operator, Table } from '@/types/pos';
import { dataParser } from './dataParser';
import { dataSyncService } from './dataSync';
import { apiClient } from './api';
import { trpcClient } from '@/lib/trpc';

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
  
  private getFilePath(): string | null {
    if (Platform.OS === 'web') {
      return null;
    }
    if (!FileSystem.documentDirectory) {
      console.warn('[TableDataService] Document directory is not available');
      return null;
    }
    return `${FileSystem.documentDirectory}${this.fileName}`;
  }
  
  private isFileSystemAvailable(): boolean {
    return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
  }

  async saveTableDataLocally(
    table: Table,
    basket: BasketItem[],
    operator: Operator,
    vatRates: { code: string; percentage: number }[]
  ): Promise<void> {
    console.log('[TableDataService] Saving table data locally (no sync) for table:', table.name);

    const rows: TableDataRow[] = [];
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeDate = `${timeString} - ${dateString}`;

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

      const pluFile = `${item.product.groupId}-${item.product.departmentId}-${item.product.id.replace('prod_', '').padStart(5, '0')}.PLU`;

      const baseName = item.product.name.split(' - ')[0];
      const messagePrefix = item.product.name.includes(' - ') ? ' - ' + item.product.name.split(' - ').slice(1).join(' - ') : '';
      const priceLabelLower = item.selectedPrice.label.toLowerCase();
      const prefix = labelToPrefixMap[priceLabelLower];
      const shouldAddPrefix = prefix !== undefined;
      const productName = shouldAddPrefix ? `${prefix} ${baseName}${messagePrefix}` : item.product.name;
      
      console.log(`[TableDataService] Saving item: label="${item.selectedPrice.label}", prefix="${prefix || 'NONE'}", final name="${productName}"`);

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

    if (!this.isFileSystemAvailable()) {
      console.log('[TableDataService] Using in-memory storage');
      this.data.set(table.id, rows);
      console.log('[TableDataService] Successfully saved table data to memory');
    } else {
      await this.clearTableDataLocally(table.id);
      await this.appendRowsToCSV(rows);
      console.log('[TableDataService] Successfully saved table data to CSV (local only)');
    }
  }

  async saveTableData(
    table: Table,
    basket: BasketItem[],
    operator: Operator,
    vatRates: { code: string; percentage: number }[]
  ): Promise<void> {
    console.log('[TableDataService] Saving table data for table:', table.name);

    const rows: TableDataRow[] = [];
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeDate = `${timeString} - ${dateString}`;

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

      const pluFile = `${item.product.groupId}-${item.product.departmentId}-${item.product.id.replace('prod_', '').padStart(5, '0')}.PLU`;

      const baseName = item.product.name.split(' - ')[0];
      const messagePrefix = item.product.name.includes(' - ') ? ' - ' + item.product.name.split(' - ').slice(1).join(' - ') : '';
      const priceLabelLower = item.selectedPrice.label.toLowerCase();
      const prefix = labelToPrefixMap[priceLabelLower];
      const shouldAddPrefix = prefix !== undefined;
      const productName = shouldAddPrefix ? `${prefix} ${baseName}${messagePrefix}` : item.product.name;
      
      console.log(`[TableDataService] Saving item: label="${item.selectedPrice.label}", prefix="${prefix || 'NONE'}", final name="${productName}"`);

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

    if (!this.isFileSystemAvailable()) {
      console.log('[TableDataService] Using in-memory storage');
      this.data.set(table.id, rows);
      console.log('[TableDataService] Successfully saved table data to memory');
    } else {
      await this.clearTableDataLocally(table.id);
      await this.appendRowsToCSV(rows);
      console.log('[TableDataService] Successfully saved table data to CSV');
    }

    console.log('[TableDataService] Syncing single table to server (BLOCKING)...');
    await this.syncSingleTableToServer(table, rows);
    console.log('[TableDataService] Single table sync successful');
  }

  async loadTableData(tableId: string): Promise<TableDataRow[]> {
    console.log('[TableDataService] Loading table data for table ID:', tableId);

    try {
      if (!this.isFileSystemAvailable()) {
        console.log('[TableDataService] Loading from in-memory storage');
        return this.data.get(tableId) || [];
      }
      
      const filePath = this.getFilePath();
      if (!filePath) {
        return [];
      }
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        console.log('[TableDataService] CSV file does not exist yet');
        return [];
      }

      const content = await FileSystem.readAsStringAsync(filePath);
      const rows = dataParser.parseCSV(content);

      if (rows.length <= 1) {
        console.log('[TableDataService] CSV file is empty or only has header');
        return [];
      }

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

      console.log(`[TableDataService] Loaded ${tableRows.length} rows for table ${tableId}`);
      return tableRows;
    } catch (error) {
      console.error('[TableDataService] Error loading table data:', error);
      return [];
    }
  }

  async clearTableDataLocally(tableId: string): Promise<void> {
    console.log('[TableDataService] Clearing table data locally (no sync) for table ID:', tableId);

    try {
      if (!this.isFileSystemAvailable()) {
        console.log('[TableDataService] Clearing from in-memory storage');
        this.data.delete(tableId);
      } else {
        const filePath = this.getFilePath();
        if (!filePath) {
          return;
        }
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (!fileInfo.exists) {
          console.log('[TableDataService] CSV file does not exist');
          return;
        }

        const content = await FileSystem.readAsStringAsync(filePath);
        const rows = dataParser.parseCSV(content);

        if (rows.length <= 1) {
          return;
        }

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

        const csvContent = this.rowsToCSV(filteredRows);
        await FileSystem.writeAsStringAsync(filePath, csvContent);
        
        console.log('[TableDataService] Successfully cleared table data from local storage (no sync)');
      }
    } catch (error) {
      console.error('[TableDataService] Error clearing table data locally:', error);
    }
  }

  async clearTableData(tableId: string, table?: Table): Promise<void> {
    console.log('[TableDataService] Clearing table data for table ID:', tableId);

    await this.clearTableDataLocally(tableId);
    
    if (table) {
      console.log('[TableDataService] Syncing table clear to server (BLOCKING)...');
      await this.syncSingleTableToServer(table, []);
      console.log('[TableDataService] Server clear sync successful');
    }
  }

  private async appendRowsToCSV(rows: TableDataRow[]): Promise<void> {
    try {
      const filePath = this.getFilePath();
      if (!filePath) {
        throw new Error('File system not available');
      }
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      let content = '';

      if (!fileInfo.exists) {
        const header = 'X,Product,Price,PLUFile,Group,Department,VATCode,VATPercentage,VATAmount,Added By,Time/Date Added,PRINTER 1,PRINTER 2,PRINTER 3,Item Printed?,Table ID\n';
        content = header;
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
      console.error('[TableDataService] Error appending to CSV:', error);
      throw error;
    }
  }

  private rowsToCSV(rows: string[][]): string {
    return rows.map(row => row.join(',')).join('\n');
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
    console.log('[TableDataService] Getting status for table ID:', tableId);
    
    try {
      const rows = await this.loadTableData(tableId);
      const hasData = rows.length > 0;
      const subtotal = rows.reduce((sum, row) => sum + (row.quantity * row.price), 0);
      
      console.log(`[TableDataService] Table ${tableId} - hasData: ${hasData}, subtotal: ${subtotal.toFixed(2)}`);
      return { hasData, subtotal };
    } catch (error) {
      console.error('[TableDataService] Error getting table status:', error);
      return { hasData: false, subtotal: 0 };
    }
  }

  async getAllTableStatuses(tableIds: string[]): Promise<Map<string, { hasData: boolean; subtotal: number }>> {
    console.log(`[TableDataService] Getting statuses for ${tableIds.length} tables (optimized batch mode)`);
    const startTime = Date.now();
    
    const statusMap = new Map<string, { hasData: boolean; subtotal: number }>();
    
    try {
      if (!this.isFileSystemAvailable()) {
        console.log('[TableDataService] Using in-memory storage for batch status check');
        for (const tableId of tableIds) {
          const rows = this.data.get(tableId) || [];
          const hasData = rows.length > 0;
          const subtotal = rows.reduce((sum, row) => sum + (row.quantity * row.price), 0);
          statusMap.set(tableId, { hasData, subtotal });
        }
        return statusMap;
      }
      
      const filePath = this.getFilePath();
      if (!filePath) {
        tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0 }));
        return statusMap;
      }
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        console.log('[TableDataService] CSV file does not exist, all tables empty');
        tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0 }));
        return statusMap;
      }

      console.log('[TableDataService] Reading CSV file once for all tables...');
      const content = await FileSystem.readAsStringAsync(filePath);
      const rows = dataParser.parseCSV(content);

      if (rows.length <= 1) {
        console.log('[TableDataService] CSV file is empty, all tables empty');
        tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0 }));
        return statusMap;
      }

      const header = rows[0].map(h => h.trim());
      const tableIdIndex = header.findIndex(h => /table.*id/i.test(h));
      
      const tableDataMap = new Map<string, TableDataRow[]>();
      tableIds.forEach(id => tableDataMap.set(id, []));

      console.log('[TableDataService] Parsing and grouping rows by table ID...');
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

      console.log('[TableDataService] Calculating statuses for all tables...');
      for (const tableId of tableIds) {
        const tableRows = tableDataMap.get(tableId) || [];
        const hasData = tableRows.length > 0;
        const subtotal = tableRows.reduce((sum, row) => sum + (row.quantity * row.price), 0);
        statusMap.set(tableId, { hasData, subtotal });
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[TableDataService] Batch status check complete in ${elapsed}ms for ${tableIds.length} tables`);
    } catch (error) {
      console.error('[TableDataService] Error in batch status check:', error);
      tableIds.forEach(id => statusMap.set(id, { hasData: false, subtotal: 0 }));
    }
    
    return statusMap;
  }

  async exportCSV(): Promise<string | null> {
    try {
      if (!this.isFileSystemAvailable()) {
        console.log('[TableDataService] Cannot export CSV - file system not available');
        return null;
      }
      
      const filePath = this.getFilePath();
      if (!filePath) {
        return null;
      }
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (!fileInfo.exists) {
        console.log('[TableDataService] No CSV file to export');
        return null;
      }

      return filePath;
    } catch (error) {
      console.error('[TableDataService] Error exporting CSV:', error);
      return null;
    }
  }

  private async syncSingleTableToServer(table: Table, rows: TableDataRow[]): Promise<void> {
    console.log('[TableDataService] ===== SYNCING SINGLE TABLE TO SERVER =====');
    console.log('[TableDataService] Table:', table.name, 'Area:', table.area, 'Rows:', rows.length);

    const siteInfo = await dataSyncService.getSiteInfo();
    if (!siteInfo) {
      console.warn('[TableDataService] No site info available, skipping sync');
      return;
    }

    console.log(`[TableDataService] Site ID: ${siteInfo.siteId}`);

    try {
      if (Platform.OS === 'web') {
        console.log('[TableDataService] Using tRPC proxy sync (web-safe)');
        const result = await trpcClient.tabledata.sync.mutate({
          siteId: siteInfo.siteId,
          area: table.area,
          tableName: table.name,
          tableId: table.id,
          tableData: rows.map((r) => ({
            quantity: r.quantity,
            productName: r.productName,
            price: r.price,
            pluFile: r.pluFile,
            group: r.group,
            department: r.department,
            vatCode: r.vatCode,
            vatPercentage: r.vatPercentage,
            vatAmount: r.vatAmount,
            addedBy: r.addedBy,
            timeDate: r.timeDate,
            printer1: r.printer1,
            printer2: r.printer2,
            printer3: r.printer3,
            itemPrinted: r.itemPrinted,
            tableId: r.tableId ?? table.id,
          })),
        });

        console.log('[TableDataService] tRPC sync result:', result);

        if (!result?.success) {
          throw new Error(result?.error || 'Server sync failed');
        }

        console.log('[TableDataService] ===== SINGLE TABLE SYNC COMPLETE (tRPC) =====');
        return;
      }

      console.log('[TableDataService] Using direct API sync (native)');

      const csvRows: string[] = [];
      csvRows.push('X,Product,Price,PLUFile,Group,Department,VATCode,VATPercentage,VATAmount,Added By,Time/Date Added,PRINTER 1,PRINTER 2,PRINTER 3,Item Printed?,Table ID');

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
          row.tableId || '',
        ].join(',');
        csvRows.push(line);
      }

      const csvContent = csvRows.join('\n');
      console.log('[TableDataService] CSV content size:', csvContent.length, 'bytes');

      const result = await apiClient.saveTableData(siteInfo.siteId, table.area, table.name, csvContent);
      console.log('[TableDataService] Direct API sync result:', result);

      if (!result.success) {
        throw new Error('Server sync reported failure');
      }

      console.log('[TableDataService] ===== SINGLE TABLE SYNC COMPLETE (direct) =====');
    } catch (error) {
      console.error('[TableDataService] Single table sync error:', error);
      throw error;
    }
  }

  async syncAllTableDataToServer(): Promise<void> {
    console.log('[TableDataService] ===== STARTING BULK TABLE DATA SYNC =====');
    
    try {
      const siteInfo = await dataSyncService.getSiteInfo();
      if (!siteInfo) {
        console.warn('[TableDataService] No site info available, skipping bulk sync');
        return;
      }
      
      const tables = await dataSyncService.getStoredTables();
      if (tables.length === 0) {
        console.log('[TableDataService] No tables configured, skipping bulk sync');
        return;
      }
      
      console.log(`[TableDataService] Found ${tables.length} tables to sync`);
      
      for (const table of tables) {
        try {
          console.log(`[TableDataService] Syncing table: ${table.area}/${table.name}`);
          const tableRows = await this.loadTableData(table.id);
          await this.syncSingleTableToServer(table, tableRows);
          console.log(`[TableDataService] Successfully synced table: ${table.area}/${table.name}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`[TableDataService] Failed to sync table ${table.area}/${table.name}:`, error);
        }
      }
      
      console.log('[TableDataService] ===== BULK TABLE DATA SYNC COMPLETE =====');
    } catch (error) {
      console.error('[TableDataService] Bulk sync failed:', error);
    }
  }


}

export const tableDataService = new TableDataService();
