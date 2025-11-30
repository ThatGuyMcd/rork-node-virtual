import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction, TransactionReport } from '@/types/pos';

const TRANSACTIONS_KEY = 'transactions';

class TransactionService {
  async saveTransaction(transaction: Transaction): Promise<void> {
    try {
      const existing = await this.getAllTransactions();
      const updated = [...existing, transaction];
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
      console.log('[TransactionService] Transaction saved:', transaction.id);
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

        if (!report.transactionsByTender[transaction.tenderName]) {
          report.transactionsByTender[transaction.tenderName] = {
            count: 0,
            revenue: 0,
          };
        }
        report.transactionsByTender[transaction.tenderName].count++;
        report.transactionsByTender[transaction.tenderName].revenue += transaction.total;

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

  async clearAllTransactions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TRANSACTIONS_KEY);
      console.log('[TransactionService] All transactions cleared');
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
      'VAT',
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
        `£${totalVAT.toFixed(2)}`,
        `£${transaction.total.toFixed(2)}`,
        transaction.tenderName,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const transactionService = new TransactionService();
