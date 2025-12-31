import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BasketItem, Operator } from '@/types/pos';
import { dataParser } from './dataParser';
import { dataSyncService } from './dataSync';
import { trpcClient } from '@/lib/trpc';

export interface StoredTabRow {
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
}

class StoredTabService {
  private data: Map<string, StoredTabRow[]> = new Map();
  
  private getStoredTabKey(operatorName: string): string {
    return `stored_tab_${operatorName}`;
  }

  async saveStoredTab(
    operator: Operator,
    basket: BasketItem[],
    vatRates: { code: string; percentage: number }[]
  ): Promise<void> {
    console.log('[StoredTab] Saving stored tab for operator:', operator.name);

    const rows: StoredTabRow[] = [];
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
      
      console.log(`[StoredTab] Saving item: label="${item.selectedPrice.label}", prefix="${prefix || 'NONE'}", final name="${productName}"`);

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
      });
    }

    await AsyncStorage.setItem(this.getStoredTabKey(operator.name), JSON.stringify(rows));
    console.log('[StoredTab] Successfully saved stored tab to AsyncStorage');

    try {
      console.log('[StoredTab] Syncing stored tab to server...');
      await this.syncSingleStoredTabToServer(operator.name, rows);
      console.log('[StoredTab] Stored tab sync successful');
    } catch (error) {
      console.error('[StoredTab] Stored tab sync failed:', error);
    }
  }

  async loadStoredTab(operatorName: string): Promise<StoredTabRow[]> {
    console.log('[StoredTab] Loading stored tab for operator:', operatorName);

    try {
      const data = await AsyncStorage.getItem(this.getStoredTabKey(operatorName));
      if (data) {
        const rows = JSON.parse(data) as StoredTabRow[];
        console.log(`[StoredTab] Loaded ${rows.length} rows from AsyncStorage`);
        return rows;
      }
      
      console.log('[StoredTab] No stored tab found in AsyncStorage');
      return [];
    } catch (error) {
      console.error('[StoredTab] Error loading stored tab:', error);
      return [];
    }
  }

  async clearStoredTab(operatorName: string): Promise<void> {
    console.log('[StoredTab] Clearing stored tab for operator:', operatorName);

    try {
      await AsyncStorage.removeItem(this.getStoredTabKey(operatorName));
      console.log('[StoredTab] Successfully cleared stored tab from AsyncStorage');

      try {
        console.log('[StoredTab] Syncing stored tab clear to server...');
        await this.syncSingleStoredTabToServer(operatorName, []);
        console.log('[StoredTab] Server clear sync successful');
      } catch (error) {
        console.error('[StoredTab] Server clear sync failed:', error);
      }
    } catch (error) {
      console.error('[StoredTab] Error clearing stored tab:', error);
    }
  }

  async getStoredTabStatus(operatorName: string): Promise<{ hasData: boolean; total: number }> {
    console.log('[StoredTab] Getting status for operator:', operatorName);
    
    try {
      const rows = await this.loadStoredTab(operatorName);
      const hasData = rows.length > 0;
      const total = rows.reduce((sum, row) => sum + (row.quantity * row.price), 0);
      
      console.log(`[StoredTab] Operator ${operatorName} - hasData: ${hasData}, total: ${total.toFixed(2)}`);
      return { hasData, total };
    } catch (error) {
      console.error('[StoredTab] Error getting stored tab status:', error);
      return { hasData: false, total: 0 };
    }
  }

  async getAllStoredTabStatuses(operatorNames: string[]): Promise<Map<string, { hasData: boolean; total: number }>> {
    console.log(`[StoredTab] Getting statuses for ${operatorNames.length} operators`);
    
    const statusMap = new Map<string, { hasData: boolean; total: number }>();
    
    for (const operatorName of operatorNames) {
      const status = await this.getStoredTabStatus(operatorName);
      statusMap.set(operatorName, status);
    }
    
    return statusMap;
  }

  private determinePrinter(group: string): string {
    if (group.toLowerCase().includes('food')) {
      return 'KITCHEN_PRINTER_1';
    } else if (group.toLowerCase().includes('drink')) {
      return 'KITCHEN_PRINTER_2';
    }
    return 'KITCHEN_PRINTER_1';
  }

  private async syncSingleStoredTabToServer(operatorName: string, rows: StoredTabRow[]): Promise<void> {
    console.log('[StoredTab] ===== SYNCING STORED TAB =====');
    console.log('[StoredTab] Operator:', operatorName, 'Rows:', rows.length);
    
    const siteInfo = await dataSyncService.getSiteInfo();
    if (!siteInfo) {
      console.warn('[StoredTab] No site info available, skipping sync');
      return;
    }
    
    const csvRows: string[] = [];
    csvRows.push('X,Product,Price,PLUFile,Group,Department,VATCode,VATPercentage,VATAmount,Added By,Time/Date Added,PRINTER 1,PRINTER 2,PRINTER 3,Item Printed?');
    
    for (const row of rows) {
      console.log(`[StoredTab] Syncing row to server: "${row.productName}"`);
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
    
    const csvContent = csvRows.join('\r\n') + '\r\n';
    const fileName = `${operatorName}_StoredTab.csv`;
    
    const payload = {
      siteId: siteInfo.siteId,
      operatorName: operatorName,
      csvContent: csvContent,
    };
    
    console.log(`[StoredTab] Payload structure:`);
    console.log(`[StoredTab]   siteId: ${payload.siteId}`);
    console.log(`[StoredTab]   operatorName: ${payload.operatorName}`);
    console.log(`[StoredTab]   fileName: ${fileName}`);
    console.log(`[StoredTab] CSV size: ${csvContent.length} bytes`);
    console.log(`[StoredTab] Uploading via tRPC backend...`);
    
    try {
      const result = await trpcClient.storedtab.upload.mutate(payload);
      console.log('[StoredTab] Sync successful:', result);
      console.log('[StoredTab] ===== STORED TAB SYNC COMPLETE =====');
    } catch (error: any) {
      console.error('[StoredTab] Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async downloadStoredTabForOperator(operatorName: string): Promise<void> {
    console.log('[StoredTab] ===== DOWNLOADING STORED TAB FOR OPERATOR:', operatorName, '=====');
    
    try {
      const siteInfo = await dataSyncService.getSiteInfo();
      if (!siteInfo) {
        console.warn('[StoredTab] No site info available, skipping download');
        return;
      }
      
      console.log('[StoredTab] Site ID:', siteInfo.siteId);
      
      const result = await trpcClient.storedtab.download.query({
        siteId: siteInfo.siteId,
      });
      
      console.log('[StoredTab] Download result:', JSON.stringify({
        success: result.success,
        tabCount: result.storedTabs.length,
        error: result.error || 'none'
      }));
      
      if (result.success && result.storedTabs.length > 0) {
        const serverTab = result.storedTabs.find((t: any) => t.operatorName === operatorName);
        
        if (serverTab) {
          console.log('[StoredTab] Found stored tab for operator:', operatorName);
          await this.processServerTab(serverTab);
        } else {
          console.log('[StoredTab] No stored tab found for operator:', operatorName);
          await AsyncStorage.removeItem(this.getStoredTabKey(operatorName));
        }
      } else {
        console.log('[StoredTab] No stored tabs available, clearing local data for:', operatorName);
        await AsyncStorage.removeItem(this.getStoredTabKey(operatorName));
      }
    } catch (error) {
      console.error('[StoredTab] Failed to download stored tab for operator:', error);
      console.error('[StoredTab] Error details:', error instanceof Error ? error.message : String(error));
    }
    
    console.log('[StoredTab] ===== STORED TAB DOWNLOAD COMPLETE FOR:', operatorName, '=====');
  }

  async downloadStoredTabsFromServer(): Promise<void> {
    console.log('[StoredTab] ===== DOWNLOADING STORED TABS FROM SERVER =====');
    
    try {
      const siteInfo = await dataSyncService.getSiteInfo();
      if (!siteInfo) {
        console.warn('[StoredTab] No site info available, skipping download');
        return;
      }
      
      console.log('[StoredTab] Site ID:', siteInfo.siteId);
      
      const result = await trpcClient.storedtab.download.query({
        siteId: siteInfo.siteId,
      });
      
      console.log('[StoredTab] Download result:', JSON.stringify({
        success: result.success,
        tabCount: result.storedTabs.length,
        error: result.error || 'none'
      }));
      
      if (result.success && result.storedTabs.length > 0) {
        console.log(`[StoredTab] Downloaded ${result.storedTabs.length} stored tabs from server`);
        console.log('[StoredTab] Operator names:', result.storedTabs.map((t: any) => t.operatorName).join(', '));
        
        for (const serverTab of result.storedTabs) {
          await this.processServerTab(serverTab);
        }
        
        console.log('[StoredTab] Stored tabs synced successfully - Total:', result.storedTabs.length);
      } else if (result.success && result.storedTabs.length === 0) {
        console.log('[StoredTab] No stored tabs found on server');
      } else {
        console.log('[StoredTab] Download was not successful:', result.error);
      }
    } catch (error) {
      console.error('[StoredTab] Failed to download stored tabs:', error);
      console.error('[StoredTab] Error details:', error instanceof Error ? error.message : String(error));
    }
    
    console.log('[StoredTab] ===== STORED TABS DOWNLOAD COMPLETE =====');
  }

  private async processServerTab(serverTab: any): Promise<void> {
    console.log('[StoredTab] Processing stored tab for:', serverTab.operatorName);
    
    const rows = dataParser.parseCSV(serverTab.csvContent);
    if (rows.length <= 1) {
      console.log('[StoredTab] Empty stored tab for:', serverTab.operatorName);
      await AsyncStorage.removeItem(this.getStoredTabKey(serverTab.operatorName));
      return;
    }

    const storedTabRows: StoredTabRow[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      storedTabRows.push({
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
      });
    }
    
    await AsyncStorage.setItem(
      this.getStoredTabKey(serverTab.operatorName), 
      JSON.stringify(storedTabRows)
    );
    console.log('[StoredTab] Stored tab data for:', serverTab.operatorName, 'Rows:', storedTabRows.length);
  }
}

export const storedTabService = new StoredTabService();
