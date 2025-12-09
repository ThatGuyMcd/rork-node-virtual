import type { Transaction } from '@/types/pos';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TERMINAL_NUMBER_KEY = 'pos_terminal_number';

export class TransactionUploadService {
  async getTerminalNumber(): Promise<string> {
    const stored = await AsyncStorage.getItem(TERMINAL_NUMBER_KEY);
    return stored || '01';
  }

  async setTerminalNumber(terminalNumber: string): Promise<void> {
    await AsyncStorage.setItem(TERMINAL_NUMBER_KEY, terminalNumber);
    console.log('[TransactionUpload] Terminal number updated:', terminalNumber);
  }

  async uploadTransactionToServer(transaction: Transaction, siteId: string): Promise<void> {
    try {
      const terminalNumber = await this.getTerminalNumber();
      const terminalId = `NV${terminalNumber.padStart(2, '0')}`;

      console.log('[TransactionUpload] Preparing transaction upload');
      console.log(`[TransactionUpload] Terminal ID: ${terminalId}`);
      console.log(`[TransactionUpload] Transaction ID: ${transaction.id}`);

      const folderPath = 'current_transactions';
      const destinationFolder = `CURRENTTRANSACTIONDATA\\${terminalId}`;

      const transactionFileName = `${transaction.id}.json`;
      const transactionContent = this.formatTransactionData(transaction, terminalId);

      const folderData = [folderPath];
      const fileData: Record<string, string> = {
        [`${folderPath}/${transactionFileName}`]: transactionContent,
      };

      console.log('[TransactionUpload] File structure:');
      console.log('  Folders:', folderData);
      console.log('  Files:', Object.keys(fileData));

      const API_BASE_URL = 'https://app.positron-portal.com';
      const url = `${API_BASE_URL}/webviewdataupload`;

      console.log('[TransactionUpload] Posting to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          SITEID: siteId,
          DESTINATIONWEBVIEWFOLDER: destinationFolder,
          FOLDERDATA: folderData,
          FILEDATA: fileData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TransactionUpload] Server error:', errorText);
        throw new Error(`Failed to upload transaction data: ${response.status} ${response.statusText}`);
      }

      const result = await response.json().catch(() => ({ success: true }));

      console.log('[TransactionUpload] Upload successful:', result);
    } catch (error) {
      console.error('[TransactionUpload] Failed to upload transaction:', error);
      throw error;
    }
  }

  private formatTransactionData(transaction: Transaction, terminalId: string): string {
    const date = new Date(transaction.timestamp);
    
    const formattedTransaction = {
      transactionId: transaction.id,
      terminalId,
      timestamp: transaction.timestamp,
      date: date.toISOString().split('T')[0],
      time: date.toTimeString().split(' ')[0],
      operator: {
        id: transaction.operatorId,
        name: transaction.operatorName,
      },
      table: transaction.tableId
        ? {
            id: transaction.tableId,
            name: transaction.tableName,
          }
        : null,
      items: transaction.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.selectedPrice.price,
        priceLabel: item.selectedPrice.label,
        lineTotal: item.lineTotal,
        vatCode: item.product.vatCode,
        vatPercentage: item.product.vatPercentage,
        departmentId: item.product.departmentId,
        groupId: item.product.groupId,
      })),
      totals: {
        subtotal: transaction.subtotal,
        discount: transaction.discount || 0,
        vatBreakdown: transaction.vatBreakdown,
        gratuity: transaction.gratuity || 0,
        total: transaction.total,
      },
      payment: {
        tenderId: transaction.tenderId,
        tenderName: transaction.tenderName,
        paymentMethod: transaction.paymentMethod,
        splitPayments: transaction.payments || [],
        cashback: transaction.cashback || 0,
      },
      flags: {
        isRefund: transaction.isRefund || false,
      },
    };

    return JSON.stringify(formattedTransaction, null, 2);
  }
}

export const transactionUploadService = new TransactionUploadService();
