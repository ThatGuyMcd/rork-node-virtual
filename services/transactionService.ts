import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction, TransactionReport } from '@/types/pos';
import * as XLSX from 'xlsx';

const TRANSACTIONS_KEY = 'transactions';
const RECEIPTS_KEY = 'transaction_receipts';

class TransactionService {
  async saveTransaction(transaction: Transaction, receiptText?: string): Promise<void> {
    try {
      const existing = await this.getAllTransactions();
      const updated = [...existing, transaction];
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
      console.log('[TransactionService] Transaction saved:', transaction.id);

      if (receiptText) {
        await this.saveReceipt(transaction.id, receiptText);
      }
    } catch (error) {
      console.error('[TransactionService] Error saving transaction:', error);
      throw error;
    }
  }

  async getAllTransactions(): Promise<Transaction[]> {
    try {
      const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[TransactionService] Error loading transactions:', error);
      return [];
    }
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    try {
      const allTransactions = await this.getAllTransactions();
      return allTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.timestamp);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    } catch (error) {
      console.error('[TransactionService] Error filtering transactions:', error);
      return [];
    }
  }

  async generateReport(startDate: Date, endDate: Date): Promise<TransactionReport> {
    try {
      const transactions = await this.getTransactionsByDateRange(startDate, endDate);
      
      const report: TransactionReport = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalTransactions: transactions.length,
        totalRevenue: 0,
        totalVAT: 0,
        vatBreakdownByRate: {},
        transactionsByOperator: {},
        transactionsByTender: {},
        transactionsByTable: {},
        itemsSold: {},
      };

      transactions.forEach(transaction => {
        report.totalRevenue += transaction.total;
        
        Object.entries(transaction.vatBreakdown).forEach(([vatCode, vatAmount]) => {
          report.totalVAT += vatAmount;
          
          if (!report.vatBreakdownByRate[vatCode]) {
            const itemsWithThisVatCode = transaction.items.filter(item => item.product.vatCode === vatCode);
            const percentage = itemsWithThisVatCode.length > 0 ? itemsWithThisVatCode[0].product.vatPercentage : 0;
            report.vatBreakdownByRate[vatCode] = {
              totalVAT: 0,
              totalNet: 0,
              percentage,
            };
          }
          report.vatBreakdownByRate[vatCode].totalVAT += vatAmount;
          
          const netAmount = transaction.items
            .filter(item => item.product.vatCode === vatCode)
            .reduce((sum, item) => sum + item.lineTotal, 0);
          report.vatBreakdownByRate[vatCode].totalNet += (netAmount - vatAmount);
        });

        if (!report.transactionsByOperator[transaction.operatorId]) {
          report.transactionsByOperator[transaction.operatorId] = {
            count: 0,
            revenue: 0,
          };
        }
        report.transactionsByOperator[transaction.operatorId].count++;
        report.transactionsByOperator[transaction.operatorId].revenue += transaction.total;

        if (transaction.payments && transaction.payments.length > 0) {
          transaction.payments.forEach(payment => {
            if (!report.transactionsByTender[payment.tenderName]) {
              report.transactionsByTender[payment.tenderName] = {
                count: 0,
                revenue: 0,
              };
            }
            report.transactionsByTender[payment.tenderName].revenue += payment.amount;
          });
          if (!report.transactionsByTender['Split Payment']) {
            report.transactionsByTender['Split Payment'] = {
              count: 0,
              revenue: 0,
            };
          }
          report.transactionsByTender['Split Payment'].count++;
        } else {
          if (!report.transactionsByTender[transaction.tenderName]) {
            report.transactionsByTender[transaction.tenderName] = {
              count: 0,
              revenue: 0,
            };
          }
          report.transactionsByTender[transaction.tenderName].count++;
          report.transactionsByTender[transaction.tenderName].revenue += transaction.total;
        }

        if (transaction.tableId && transaction.tableName) {
          if (!report.transactionsByTable) {
            report.transactionsByTable = {};
          }
          if (!report.transactionsByTable[transaction.tableName]) {
            report.transactionsByTable[transaction.tableName] = {
              count: 0,
              revenue: 0,
            };
          }
          report.transactionsByTable[transaction.tableName].count++;
          report.transactionsByTable[transaction.tableName].revenue += transaction.total;
        }

        transaction.items.forEach(item => {
          const productName = item.product.name;
          if (!report.itemsSold[productName]) {
            report.itemsSold[productName] = {
              quantity: 0,
              revenue: 0,
            };
          }
          report.itemsSold[productName].quantity += item.quantity;
          report.itemsSold[productName].revenue += item.lineTotal;
        });
      });

      console.log('[TransactionService] Report generated:', report);
      return report;
    } catch (error) {
      console.error('[TransactionService] Error generating report:', error);
      throw error;
    }
  }

  async saveReceipt(transactionId: string, receiptText: string): Promise<void> {
    try {
      const existing = await this.getAllReceipts();
      existing[transactionId] = receiptText;
      await AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(existing));
      console.log('[TransactionService] Receipt saved:', transactionId);
    } catch (error) {
      console.error('[TransactionService] Error saving receipt:', error);
      throw error;
    }
  }

  async getAllReceipts(): Promise<Record<string, string>> {
    try {
      const data = await AsyncStorage.getItem(RECEIPTS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[TransactionService] Error loading receipts:', error);
      return {};
    }
  }

  async clearAllTransactions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TRANSACTIONS_KEY);
      await AsyncStorage.removeItem(RECEIPTS_KEY);
      console.log('[TransactionService] All transactions and receipts cleared');
    } catch (error) {
      console.error('[TransactionService] Error clearing transactions:', error);
      throw error;
    }
  }

  async exportTransactionsCSV(transactions: Transaction[]): Promise<string> {
    const headers = [
      'Transaction ID',
      'Date',
      'Time',
      'Operator',
      'Table',
      'Items',
      'Subtotal',
      'Discount',
      'VAT',
      'Gratuity',
      'Total',
      'Payment Method',
    ];

    const rows = transactions.map(transaction => {
      const date = new Date(transaction.timestamp);
      const totalVAT = Object.values(transaction.vatBreakdown).reduce((sum, vat) => sum + vat, 0);
      
      return [
        transaction.id,
        date.toLocaleDateString('en-GB'),
        date.toLocaleTimeString('en-GB'),
        transaction.operatorName,
        transaction.tableName || 'N/A',
        transaction.items.length.toString(),
        `£${transaction.subtotal.toFixed(2)}`,
        transaction.discount ? `£${transaction.discount.toFixed(2)}` : '£0.00',
        `£${totalVAT.toFixed(2)}`,
        transaction.gratuity ? `£${transaction.gratuity.toFixed(2)}` : '£0.00',
        `£${transaction.total.toFixed(2)}`,
        transaction.tenderName,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  private getPricePrefix(label: string): string {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel === 'standard') return '';
    if (lowerLabel === 'double') return 'DBL';
    if (lowerLabel === 'small') return 'SML';
    if (lowerLabel === 'large') return 'LRG';
    if (lowerLabel === 'half') return 'HALF';
    if (lowerLabel === 'schooner') return '2/3PT';
    if (label === '125ml' || label === '175ml' || label === '250ml') return label;
    return label === 'standard' ? '' : label;
  }

  async exportTransactionsExcel(transactions: Transaction[]): Promise<ArrayBuffer> {
    const workbook = XLSX.utils.book_new();

    const transactionData = transactions.map(transaction => {
      const date = new Date(transaction.timestamp);
      const totalVAT = Object.values(transaction.vatBreakdown).reduce((sum, vat) => sum + vat, 0);
      
      let paymentMethod = transaction.tenderName;
      if (transaction.payments && transaction.payments.length > 1) {
        paymentMethod = transaction.payments.map(p => `${p.tenderName} (£${p.amount.toFixed(2)})`).join(', ');
      }

      let changeOrCashback = '';
      if (transaction.cashback && transaction.cashback > 0) {
        let tender = transaction.tenderName;
        if (transaction.payments && transaction.payments.length > 0) {
          const lastPayment = transaction.payments[transaction.payments.length - 1];
          tender = lastPayment.tenderName;
        }
        const isCash = tender === 'Cash';
        changeOrCashback = isCash ? `Change: £${transaction.cashback.toFixed(2)}` : `Cashback: £${transaction.cashback.toFixed(2)}`;
      }

      return {
        'Transaction ID': transaction.id,
        'Date': date.toLocaleDateString('en-GB'),
        'Time': date.toLocaleTimeString('en-GB'),
        'Operator': transaction.operatorName,
        'Table': transaction.tableName || 'N/A',
        'Items Count': transaction.items.length,
        'Subtotal': transaction.subtotal,
        'Discount': transaction.discount || 0,
        'VAT': totalVAT,
        'Gratuity': transaction.gratuity || 0,
        'Total': transaction.total,
        'Payment Method': paymentMethod,
        'Change/Cashback': changeOrCashback,
        'Is Refund': transaction.isRefund ? 'Yes' : 'No',
      };
    });

    const transactionSheet = XLSX.utils.json_to_sheet(transactionData);
    
    transactionSheet['!cols'] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
      { wch: 20 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');

    const itemsData: {
      'Transaction ID': string;
      'Date': string;
      'Time': string;
      'Product Name': string;
      'Quantity': number;
      'Unit Price': number;
      'Line Total': number;
      'VAT Code': string;
      'VAT Percentage': number;
    }[] = [];

    transactions.forEach(transaction => {
      const date = new Date(transaction.timestamp);
      transaction.items.forEach(item => {
        const prefix = this.getPricePrefix(item.selectedPrice.label);
        const displayName = prefix ? `${prefix} ${item.product.name}` : item.product.name;
        itemsData.push({
          'Transaction ID': transaction.id,
          'Date': date.toLocaleDateString('en-GB'),
          'Time': date.toLocaleTimeString('en-GB'),
          'Product Name': displayName,
          'Quantity': item.quantity,
          'Unit Price': item.selectedPrice.price,
          'Line Total': item.lineTotal,
          'VAT Code': item.product.vatCode,
          'VAT Percentage': item.product.vatPercentage,
        });
      });
    });

    if (itemsData.length > 0) {
      const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
      itemsSheet['!cols'] = [
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 30 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items Detail');
    }

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return buffer as ArrayBuffer;
  }
}

export const transactionService = new TransactionService();
