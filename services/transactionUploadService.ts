import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api';
import { transactionService } from './transactionService';

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

  async uploadAllTransactionsToServer(siteId: string): Promise<void> {
    try {
      const terminalNumber = await this.getTerminalNumber();
      const terminalId = `NV${terminalNumber.padStart(2, '0')}`;

      console.log('[TransactionUpload] Preparing batch transaction upload');
      console.log(`[TransactionUpload] Site ID: ${siteId}`);
      console.log(`[TransactionUpload] Terminal ID: ${terminalId}`);

      const receipts = await transactionService.getAllReceipts();
      const receiptCount = Object.keys(receipts).length;
      
      console.log(`[TransactionUpload] Found ${receiptCount} receipts to upload`);

      if (receiptCount === 0) {
        console.log('[TransactionUpload] No receipts to upload');
        return;
      }

      const destinationFolder = `CURRENTTRANSACTIONDATA\\${terminalId}`;
      const fileData: Record<string, string> = {};

      Object.entries(receipts).forEach(([transactionId, receiptText]) => {
        const fileName = `${terminalId}_${transactionId}.RECEIPT`;
        fileData[fileName] = receiptText;
        console.log(`[TransactionUpload] Added receipt: ${fileName}`);
      });

      console.log('[TransactionUpload] Uploading via direct API...');
      console.log(`[TransactionUpload] Destination: ${destinationFolder}`);
      console.log(`[TransactionUpload] File count: ${Object.keys(fileData).length}`);

      const result = await apiClient.uploadTransactionData(
        siteId,
        destinationFolder,
        fileData
      );

      console.log('[TransactionUpload] Upload successful:', result);
    } catch (error) {
      console.error('[TransactionUpload] Failed to upload transactions:', error);
      throw error;
    }
  }
}

export const transactionUploadService = new TransactionUploadService();
