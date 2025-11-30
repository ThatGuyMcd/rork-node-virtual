import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { BasketItem, Operator, Table } from '@/types/pos';
import { dataParser } from './dataParser';

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

  async saveTableData(
    table: Table,
    basket: BasketItem[],
    operator: Operator,
    vatRates: { code: string; percentage: number }[]
  ): Promise<void> {
    console.log('[TableDataService] Saving table data for table:', table.name);

    if (!this.isFileSystemAvailable()) {
      console.log('[TableDataService] Using in-memory storage');
      const rows: TableDataRow[] = [];
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-GB', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeDate = `${timeString} - ${dateString}`;

      for (const item of basket) {
        const vatRate = vatRates.find(v => v.code === item.product.vatCode);
        const vatPercentage = vatRate?.percentage || 0;
        const priceExVat = item.selectedPrice.price / (1 + vatPercentage / 100);
        const vatAmount = item.selectedPrice.price - priceExVat;

        const pluFile = `${item.product.groupId}-${item.product.departmentId}-${item.product.id.replace('prod_', '').padStart(5, '0')}.PLU`;

        rows.push({
          quantity: item.quantity,
          productName: item.product.name,
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

      this.data.set(table.id, rows);
      console.log('[TableDataService] Successfully saved table data to memory');
      return;
    }

    await this.clearTableData(table.id);

    const rows: TableDataRow[] = [];
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeDate = `${timeString} - ${dateString}`;

    for (const item of basket) {
      const vatRate = vatRates.find(v => v.code === item.product.vatCode);
      const vatPercentage = vatRate?.percentage || 0;
      const priceExVat = item.selectedPrice.price / (1 + vatPercentage / 100);
      const vatAmount = item.selectedPrice.price - priceExVat;

      const pluFile = `${item.product.groupId}-${item.product.departmentId}-${item.product.id.replace('prod_', '').padStart(5, '0')}.PLU`;

      rows.push({
        quantity: item.quantity,
        productName: item.product.name,
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

    await this.appendRowsToCSV(rows);
    console.log('[TableDataService] Successfully saved table data');
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

  async clearTableData(tableId: string): Promise<void> {
    console.log('[TableDataService] Clearing table data for table ID:', tableId);

    try {
      if (!this.isFileSystemAvailable()) {
        console.log('[TableDataService] Clearing from in-memory storage');
        this.data.delete(tableId);
        return;
      }
      
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
      
      console.log('[TableDataService] Successfully cleared table data');
    } catch (error) {
      console.error('[TableDataService] Error clearing table data:', error);
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
    console.log('[TableDataService] Getting statuses for all tables');
    
    const statusMap = new Map<string, { hasData: boolean; subtotal: number }>();
    
    await Promise.all(
      tableIds.map(async (tableId) => {
        const status = await this.getTableStatus(tableId);
        statusMap.set(tableId, status);
      })
    );
    
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
}

export const tableDataService = new TableDataService();
