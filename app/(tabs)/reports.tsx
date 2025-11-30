import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { FileText, TrendingUp, Users, CreditCard, Download, X, Filter, BarChart3, Layers } from 'lucide-react-native';
import { transactionService } from '@/services/transactionService';
import type { Transaction, TransactionReport } from '@/types/pos';
import { useTheme } from '@/contexts/ThemeContext';
import { dataSyncService } from '@/services/dataSync';

type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function ReportsScreen() {
  const { colors, theme } = useTheme();
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [report, setReport] = useState<TransactionReport | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [operators, setOperators] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<Record<string, string>>({});

  useEffect(() => {
    loadOperators();
    loadGroupsAndDepartments();
    filterTransactionsByDateRange();
  }, []);

  const loadOperators = async () => {
    const ops = await dataSyncService.getStoredOperators();
    const operatorMap: Record<string, string> = {};
    ops.forEach(op => {
      operatorMap[op.id] = op.name;
    });
    setOperators(operatorMap);
  };

  const loadGroupsAndDepartments = async () => {
    const loadedGroups = await dataSyncService.getStoredGroups();
    const loadedDepartments = await dataSyncService.getStoredDepartments();
    
    const groupMap: Record<string, string> = {};
    loadedGroups.forEach(group => {
      groupMap[group.id] = group.name;
    });
    setGroups(groupMap);

    const departmentMap: Record<string, string> = {};
    loadedDepartments.forEach(dept => {
      departmentMap[dept.id] = dept.name;
    });
    setDepartments(departmentMap);
  };



  const filterTransactionsByDateRange = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = new Date(now);

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          break;
        case 'all':
          startDate = new Date(0);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      }

      const filtered = await transactionService.getTransactionsByDateRange(startDate, endDate);
      setFilteredTransactions(filtered.reverse());

      const generatedReport = await transactionService.generateReport(startDate, endDate);
      setReport(generatedReport);
    } catch (error) {
      console.error('[Reports] Error filtering transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    filterTransactionsByDateRange();
  }, [filterTransactionsByDateRange]);

  const exportReport = async () => {
    if (filteredTransactions.length === 0) {
      Alert.alert('No Data', 'There are no transactions to export');
      return;
    }

    try {
      const csv = await transactionService.exportTransactionsCSV(filteredTransactions);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Report exported successfully');
      } else {
        await Share.share({
          message: csv,
          title: 'Transaction Report',
        });
      }
    } catch (error) {
      console.error('[Reports] Error exporting report:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  const viewTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailModalVisible(true);
  };

  const DateRangeButton = ({ range, label }: { range: DateRange; label: string }) => (
    <TouchableOpacity
      style={[
        styles.dateRangeButton,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
        dateRange === range && { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
      ]}
      onPress={() => setDateRange(range)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.dateRangeText,
          { color: colors.text },
          dateRange === range && { color: colors.primary, fontWeight: '700' as const },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Filter size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Date Range</Text>
          </View>
          <View style={styles.dateRangeContainer}>
            <DateRangeButton range="today" label="Today" />
            <DateRangeButton range="week" label="Week" />
            <DateRangeButton range="month" label="Month" />
            <DateRangeButton range="all" label="All Time" />
          </View>
        </View>

        {loading ? (
          <View style={[styles.loadingContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading report...</Text>
          </View>
        ) : report ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <BarChart3 size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Summary</Text>
              </View>

              <View style={styles.summaryGrid}>
                <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                  <FileText size={24} color={colors.primary} />
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{report.totalTransactions}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Transactions</Text>
                </View>

                <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                  <TrendingUp size={24} color="#10b981" />
                  <Text style={[styles.summaryValue, { color: colors.text }]}>£{report.totalRevenue.toFixed(2)}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Revenue</Text>
                </View>

                <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                  <CreditCard size={24} color="#f59e0b" />
                  <Text style={[styles.summaryValue, { color: colors.text }]}>£{report.totalVAT.toFixed(2)}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total VAT</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Users size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Operator</Text>
              </View>
              {Object.entries(report.transactionsByOperator).map(([operatorId, data]) => (
                <View key={operatorId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                      {operators[operatorId] || operatorId}
                    </Text>
                    <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                      {data.count} transaction{data.count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                    £{data.revenue.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <CreditCard size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Payment Method</Text>
              </View>
              {Object.entries(report.transactionsByTender).map(([tender, data]) => (
                <View key={tender} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>{tender}</Text>
                    <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                      {data.count} transaction{data.count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                    £{data.revenue.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Layers size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Product Group</Text>
              </View>
              {(() => {
                const groupSales: Record<string, { quantity: number; revenue: number }> = {};
                filteredTransactions.forEach(transaction => {
                  transaction.items.forEach(item => {
                    const groupId = item.product.groupId;
                    if (!groupSales[groupId]) {
                      groupSales[groupId] = { quantity: 0, revenue: 0 };
                    }
                    groupSales[groupId].quantity += item.quantity;
                    groupSales[groupId].revenue += item.lineTotal;
                  });
                });

                const sortedGroups = Object.entries(groupSales).sort((a, b) => b[1].revenue - a[1].revenue);

                return sortedGroups.length > 0 ? sortedGroups.map(([groupId, data]) => (
                  <View key={groupId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                        {groups[groupId] || `Group ${groupId}`}
                      </Text>
                      <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                        {data.quantity} item{data.quantity !== 1 ? 's' : ''} sold
                      </Text>
                    </View>
                    <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                      £{data.revenue.toFixed(2)}
                    </Text>
                  </View>
                )) : (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No group data available
                  </Text>
                );
              })()}
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Layers size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Department</Text>
              </View>
              {(() => {
                const departmentSales: Record<string, { quantity: number; revenue: number }> = {};
                filteredTransactions.forEach(transaction => {
                  transaction.items.forEach(item => {
                    const departmentId = item.product.departmentId;
                    if (!departmentSales[departmentId]) {
                      departmentSales[departmentId] = { quantity: 0, revenue: 0 };
                    }
                    departmentSales[departmentId].quantity += item.quantity;
                    departmentSales[departmentId].revenue += item.lineTotal;
                  });
                });

                const sortedDepartments = Object.entries(departmentSales).sort((a, b) => b[1].revenue - a[1].revenue);

                return sortedDepartments.length > 0 ? sortedDepartments.map(([departmentId, data]) => (
                  <View key={departmentId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                        {departments[departmentId] || `Department ${departmentId}`}
                      </Text>
                      <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                        {data.quantity} item{data.quantity !== 1 ? 's' : ''} sold
                      </Text>
                    </View>
                    <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                      £{data.revenue.toFixed(2)}
                    </Text>
                  </View>
                )) : (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No department data available
                  </Text>
                );
              })()}
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <FileText size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Transactions</Text>
              </View>
              {filteredTransactions.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No transactions found for this period
                </Text>
              ) : (
                filteredTransactions.slice(0, 10).map((transaction) => (
                  <TouchableOpacity
                    key={transaction.id}
                    style={[styles.transactionItem, { borderBottomColor: colors.border }]}
                    onPress={() => viewTransactionDetail(transaction)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.transactionId, { color: colors.text }]}>
                        {new Date(transaction.timestamp).toLocaleString('en-GB')}
                      </Text>
                      <Text style={[styles.transactionOperator, { color: colors.textSecondary }]}>
                        {transaction.operatorName} • {transaction.tenderName}
                        {transaction.tableName && ` • ${transaction.tableName}`}
                      </Text>
                    </View>
                    <Text style={[styles.transactionTotal, { color: colors.primary }]}>
                      £{transaction.total.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: colors.primary }]}
              onPress={exportReport}
              activeOpacity={0.8}
            >
              <Download size={20} color="#fff" />
              <Text style={styles.exportButtonText}>Export Report (CSV)</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.emptyStateContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <FileText size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>No data available</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
              Complete a transaction to start seeing reports
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.detailModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Transaction Details</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <ScrollView style={styles.detailContent}>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.id}</Text>
                </View>

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date(selectedTransaction.timestamp).toLocaleString('en-GB')}
                  </Text>
                </View>

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Operator</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.operatorName}</Text>
                </View>

                {selectedTransaction.tableName && (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Table</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.tableName}</Text>
                  </View>
                )}

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.tenderName}</Text>
                </View>

                <Text style={[styles.itemsHeader, { color: colors.text }]}>Items ({selectedTransaction.items.length})</Text>
                {selectedTransaction.items.map((item, index) => (
                  <View key={index} style={[styles.itemRow, { backgroundColor: colors.background }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{item.product.name}</Text>
                      <Text style={[styles.itemDetails, { color: colors.textSecondary }]}>
                        {item.quantity} × £{item.selectedPrice.price.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={[styles.itemTotal, { color: colors.text }]}>£{item.lineTotal.toFixed(2)}</Text>
                  </View>
                ))}

                <View style={[styles.totalSection, { borderTopColor: colors.border }]}>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                    <Text style={[styles.totalValue, { color: colors.text }]}>
                      £{selectedTransaction.subtotal.toFixed(2)}
                    </Text>
                  </View>
                  {Object.entries(selectedTransaction.vatBreakdown).map(([code, amount]) => (
                    <View key={code} style={styles.totalRow}>
                      <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>VAT ({code})</Text>
                      <Text style={[styles.totalValue, { color: colors.text }]}>£{amount.toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={[styles.totalRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.totalLabelBold, { color: colors.text }]}>Total</Text>
                    <Text style={[styles.totalValueBold, { color: colors.primary }]}>
                      £{selectedTransaction.total.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  dateRangeContainer: {
    flexDirection: 'row' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  dateRangeButton: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center' as const,
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  summaryGrid: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center' as const,
    gap: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  summaryLabel: {
    fontSize: 12,
    textAlign: 'center' as const,
  },
  breakdownItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  breakdownLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  breakdownSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  transactionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  transactionOperator: {
    fontSize: 13,
  },
  transactionTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  exportButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  loadingContainer: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center' as const,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
  },
  emptyStateContainer: {
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center' as const,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center' as const,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  detailModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  detailContent: {
    flex: 1,
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  itemsHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  totalSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  totalLabelBold: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  totalValueBold: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
});
