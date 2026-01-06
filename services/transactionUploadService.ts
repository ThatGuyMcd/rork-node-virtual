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
  }

  async uploadAllTransactionsToServer(siteId: string): Promise<void> {
    const terminalNumber = await this.getTerminalNumber();
    const terminalId = `NV${terminalNumber.padStart(2, '0')}`;

    const receipts = await transactionService.getAllReceipts();
    if (Object.keys(receipts).length === 0) {
      return;
    }

    const destinationFolder = `CURRENTTRANSACTIONDATA\\${terminalId}`;
    const fileData: Record<string, string> = {};

    Object.entries(receipts).forEach(([transactionId, receiptText]) => {
      const fileName = `${terminalId}_${transactionId}.RECEIPT`;
      fileData[fileName] = receiptText;
    });

    await apiClient.uploadTransactionData(siteId, destinationFolder, fileData);
  }
}

export const transactionUploadService = new TransactionUploadService();
