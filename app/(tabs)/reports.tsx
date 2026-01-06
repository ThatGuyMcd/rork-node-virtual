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
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FileText, TrendingUp, Users, CreditCard, Download, X, Filter, BarChart3, Layers, Calendar, RotateCcw, Search, Percent, Gift, Trophy, Clock, Zap, Star, DollarSign, Printer, Banknote } from 'lucide-react-native';
import { transactionService } from '@/services/transactionService';
import type { Transaction, TransactionReport } from '@/types/pos';
import { useTheme } from '@/contexts/ThemeContext';
import { dataSyncService } from '@/services/dataSync';
import { useFocusEffect } from 'expo-router';
import { printerService } from '@/services/printerService';

type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom';

const getPricePrefix = (label: string): string => {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel === 'standard') return '';
  if (lowerLabel === 'double') return 'DBL';
  if (lowerLabel === 'small') return 'SML';
  if (lowerLabel === 'large') return 'LRG';
  if (lowerLabel === 'half') return 'HALF';
  if (lowerLabel === 'schooner') return '2/3PT';
  if (label === '125ml' || label === '175ml' || label === '250ml') return label;
  return label === 'standard' ? '' : label;
};

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
};

const formatDateTime = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const formatDateTimeForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [datePickerModalVisible, setDatePickerModalVisible] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [transactionSearchModalVisible, setTransactionSearchModalVisible] = useState(false);
  const [refundSearchModalVisible, setRefundSearchModalVisible] = useState(false);
  const [searchStartDate, setSearchStartDate] = useState<Date>(new Date());
  const [searchEndDate, setSearchEndDate] = useState<Date>(new Date());
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  const [searchType, setSearchType] = useState<'transaction' | 'refund'>('transaction');
  const [showSearchStartDatePicker, setShowSearchStartDatePicker] = useState(false);
  const [showSearchStartTimePicker, setShowSearchStartTimePicker] = useState(false);
  const [showSearchEndDatePicker, setShowSearchEndDatePicker] = useState(false);
  const [showSearchEndTimePicker, setShowSearchEndTimePicker] = useState(false);
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);

  useEffect(() => {
    loadOperators();
    loadGroupsAndDepartments();
    checkPrinterConnection();
  }, []);

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
        case 'custom':
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
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
  }, [dateRange, customStartDate, customEndDate]);

  const checkPrinterConnection = async () => {
    const connected = printerService.isConnected();
    setIsPrinterConnected(connected);
    console.log('[Reports] Printer connected:', connected);
  };

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

  useEffect(() => {
    filterTransactionsByDateRange();
  }, [filterTransactionsByDateRange]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Reports] Tab focused - reloading transactions');
      filterTransactionsByDateRange();
      checkPrinterConnection();
      return () => {};
    }, [filterTransactionsByDateRange])
  );

  const exportReport = async () => {
    if (filteredTransactions.length === 0) {
      Alert.alert('No Data', 'There are no transactions to export');
      return;
    }

    try {
      const excelBuffer = await transactionService.exportTransactionsExcel(filteredTransactions);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Report exported successfully');
      } else {
        Alert.alert('Export', 'Excel export is only available on web. Please use the web version to export reports.');
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

  const handlePrintReceipt = async () => {
    if (!selectedTransaction) return;

    try {
      await printerService.printReceipt(selectedTransaction, 'Your Business Name', true);
      Alert.alert('Success', 'Receipt reprinted successfully');
    } catch (error) {
      console.error('[Reports] Error reprinting receipt:', error);
      Alert.alert('Error', 'Failed to reprint receipt: ' + (error as Error).message);
    }
  };

  const handleSearchTransactions = async () => {
    if (searchStartDate > searchEndDate) {
      Alert.alert('Invalid Date Range', 'Start date must be before end date');
      return;
    }

    setLoading(true);
    try {
      const results = await transactionService.getTransactionsByDateRange(searchStartDate, searchEndDate);
      const filteredResults = searchType === 'refund' 
        ? results.filter(t => t.isRefund)
        : results;
      setSearchResults(filteredResults.reverse());
      setTransactionSearchModalVisible(false);
      setRefundSearchModalVisible(false);
      if (searchType === 'transaction') {
        setTransactionSearchModalVisible(true);
      } else {
        setRefundSearchModalVisible(true);
      }
    } catch (error) {
      console.error('[Reports] Error searching transactions:', error);
      Alert.alert('Error', 'Failed to search transactions');
    } finally {
      setLoading(false);
    }
  };

  const openTransactionSearch = () => {
    setSearchType('transaction');
    setSearchStartDate(new Date(new Date().setHours(0, 0, 0, 0)));
    setSearchEndDate(new Date());
    setSearchResults([]);
    setTransactionSearchModalVisible(true);
  };

  const openRefundSearch = () => {
    setSearchType('refund');
    setSearchStartDate(new Date(new Date().setHours(0, 0, 0, 0)));
    setSearchEndDate(new Date());
    setSearchResults([]);
    setRefundSearchModalVisible(true);
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

        <View style={styles.searchButtonsContainer}>
          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: colors.primary }]}
            onPress={openTransactionSearch}
            activeOpacity={0.8}
          >
            <Search size={20} color="#fff" />
            <Text style={styles.searchButtonText}>Find Transaction</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: '#ef4444' }]}
            onPress={openRefundSearch}
            activeOpacity={0.8}
          >
            <Search size={20} color="#fff" />
            <Text style={styles.searchButtonText}>Find Refund</Text>
          </TouchableOpacity>
        </View>

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
          <TouchableOpacity
            style={[
              styles.customDateButton,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
              dateRange === 'custom' && { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
            ]}
            onPress={() => setDatePickerModalVisible(true)}
            activeOpacity={0.7}
          >
            <Calendar size={18} color={dateRange === 'custom' ? colors.primary : colors.text} />
            <Text
              style={[
                styles.customDateButtonText,
                { color: colors.text },
                dateRange === 'custom' && { color: colors.primary, fontWeight: '700' as const },
              ]}
            >
              {dateRange === 'custom'
                ? `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`
                : 'Custom Range'}
            </Text>
          </TouchableOpacity>
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
                <CreditCard size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>VAT Breakdown</Text>
              </View>
              {Object.entries(report.vatBreakdownByRate).length > 0 ? (
                Object.entries(report.vatBreakdownByRate)
                  .sort((a, b) => b[1].totalVAT - a[1].totalVAT)
                  .map(([vatCode, data]) => (
                    <View key={vatCode} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breakdownLabel, { color: colors.text }]}>VAT Rate {vatCode}</Text>
                        <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>  
                          {data.percentage}% • Net: £{data.totalNet.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                        £{data.totalVAT.toFixed(2)}
                      </Text>
                    </View>
                  ))
              ) : (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No VAT data available
                </Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Users size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Operator</Text>
              </View>
              {(() => {
                const operatorStats = Object.entries(report.transactionsByOperator).map(([operatorId, data]) => ({
                  operatorId,
                  operatorName: operators[operatorId] || operatorId,
                  count: data.count,
                  revenue: data.revenue,
                  avgTransaction: data.revenue / data.count,
                }));
                
                const topOperator = operatorStats.sort((a, b) => b.revenue - a.revenue)[0];
                const mostTransactions = operatorStats.sort((a, b) => b.count - a.count)[0];
                const highestAverage = operatorStats.sort((a, b) => b.avgTransaction - a.avgTransaction)[0];
                
                return (
                  <>
                    {operatorStats.length > 1 && (
                      <View style={[styles.operatorStatsContainer, { backgroundColor: colors.background }]}>
                        <View style={styles.operatorStatCard}>
                          <Star size={18} color="#f59e0b" />
                          <Text style={[styles.operatorStatLabel, { color: colors.textSecondary }]}>Top Seller</Text>
                          <Text style={[styles.operatorStatValue, { color: colors.text }]}>{topOperator.operatorName}</Text>
                          <Text style={[styles.operatorStatSubtext, { color: colors.textTertiary }]}>£{topOperator.revenue.toFixed(2)}</Text>
                        </View>
                        <View style={styles.operatorStatCard}>
                          <Zap size={18} color="#10b981" />
                          <Text style={[styles.operatorStatLabel, { color: colors.textSecondary }]}>Most Active</Text>
                          <Text style={[styles.operatorStatValue, { color: colors.text }]}>{mostTransactions.operatorName}</Text>
                          <Text style={[styles.operatorStatSubtext, { color: colors.textTertiary }]}>{mostTransactions.count} txns</Text>
                        </View>
                        <View style={styles.operatorStatCard}>
                          <DollarSign size={18} color="#3b82f6" />
                          <Text style={[styles.operatorStatLabel, { color: colors.textSecondary }]}>Highest Avg</Text>
                          <Text style={[styles.operatorStatValue, { color: colors.text }]}>{highestAverage.operatorName}</Text>
                          <Text style={[styles.operatorStatSubtext, { color: colors.textTertiary }]}>£{highestAverage.avgTransaction.toFixed(2)}</Text>
                        </View>
                      </View>
                    )}
                    
                    <Text style={[styles.sectionSubtitle, { color: colors.text, marginTop: operatorStats.length > 1 ? 16 : 0 }]}>All Operators</Text>
                    {operatorStats.sort((a, b) => b.revenue - a.revenue).map(({ operatorId, operatorName, count, revenue, avgTransaction }) => (
                      <View key={operatorId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.breakdownLabel, { color: colors.text }]}>{operatorName}</Text>
                          <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                            {count} transaction{count !== 1 ? 's' : ''} • Avg: £{avgTransaction.toFixed(2)}
                          </Text>
                        </View>
                        <Text style={[styles.breakdownValue, { color: colors.primary }]}>£{revenue.toFixed(2)}</Text>
                      </View>
                    ))}
                  </>
                );
              })()}
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <CreditCard size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Payment Method</Text>
              </View>
              {Object.entries(report.transactionsByTender)
                .filter(([tender]) => tender !== 'Split Payment')
                .map(([tender, data]) => (
                <View key={tender} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>{tender}</Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                    £{data.revenue.toFixed(2)}
                  </Text>
                </View>
              ))}
              {(() => {
                const cashTotal = report.transactionsByTender['Cash']?.revenue || 0;
                const cardTotal = report.transactionsByTender['Card']?.revenue || 0;
                const combinedTotal = cashTotal + cardTotal;
                return (
                  <View style={[styles.breakdownItem, { borderTopWidth: 2, borderTopColor: colors.border, marginTop: 8, paddingTop: 16 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownLabel, { color: colors.text, fontWeight: '700' as const }]}>Combined Total</Text>
                    </View>
                    <Text style={[styles.breakdownValue, { color: colors.primary, fontSize: 18 }]}>
                      £{combinedTotal.toFixed(2)}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {(() => {
              const refundTransactions = filteredTransactions.filter(t => t.isRefund);
              const refundTotal = refundTransactions.reduce((sum, t) => sum + t.total, 0);
              const refundCount = refundTransactions.length;

              if (refundCount === 0) return null;

              const refundsByOperator: Record<string, { count: number; total: number }> = {};
              const refundsByPaymentMethod: Record<string, { count: number; total: number }> = {};

              refundTransactions.forEach(transaction => {
                if (!refundsByOperator[transaction.operatorId]) {
                  refundsByOperator[transaction.operatorId] = { count: 0, total: 0 };
                }
                refundsByOperator[transaction.operatorId].count++;
                refundsByOperator[transaction.operatorId].total += transaction.total;

                if (transaction.payments && transaction.payments.length > 0) {
                  transaction.payments.forEach(payment => {
                    if (!refundsByPaymentMethod[payment.tenderName]) {
                      refundsByPaymentMethod[payment.tenderName] = { count: 0, total: 0 };
                    }
                    refundsByPaymentMethod[payment.tenderName].total += payment.amount;
                  });
                } else {
                  if (!refundsByPaymentMethod[transaction.tenderName]) {
                    refundsByPaymentMethod[transaction.tenderName] = { count: 0, total: 0 };
                  }
                  refundsByPaymentMethod[transaction.tenderName].count++;
                  refundsByPaymentMethod[transaction.tenderName].total += transaction.total;
                }
              });

              return (
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <RotateCcw size={20} color="#ef4444" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Refunds</Text>
                  </View>

                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <FileText size={24} color="#ef4444" />
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{refundCount}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Refunds</Text>
                    </View>

                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <TrendingUp size={24} color="#ef4444" />
                      <Text style={[styles.summaryValue, { color: '#ef4444' }]}>£{refundTotal.toFixed(2)}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Refunded</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>By Operator</Text>
                  {Object.entries(refundsByOperator).map(([operatorId, data]) => (
                    <View key={operatorId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                          {operators[operatorId] || operatorId}
                        </Text>
                        <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                          {data.count} refund{data.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.breakdownValue, { color: '#ef4444' }]}>
                        £{data.total.toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>By Payment Method</Text>
                  {Object.entries(refundsByPaymentMethod)
                    .filter(([method]) => method !== 'Split Payment')
                    .map(([method, data]) => (
                    <View key={method} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breakdownLabel, { color: colors.text }]}>{method}</Text>
                        {data.count > 0 && (
                          <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                            {data.count} refund{data.count !== 1 ? 's' : ''}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.breakdownValue, { color: '#ef4444' }]}>
                        £{data.total.toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Recent Refund Transactions</Text>
                  {refundTransactions.slice(0, 5).map((transaction) => (
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
                      <Text style={[styles.transactionTotal, { color: '#ef4444' }]}>
                        £{transaction.total.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {(() => {
              const transactionsWithDiscount = filteredTransactions.filter(t => t.discount && t.discount > 0);
              const totalDiscountAmount = transactionsWithDiscount.reduce((sum, t) => sum + (t.discount || 0), 0);
              const discountCount = transactionsWithDiscount.length;

              if (discountCount === 0) return null;

              const discountsByOperator: Record<string, { count: number; total: number }> = {};

              transactionsWithDiscount.forEach(transaction => {
                if (!discountsByOperator[transaction.operatorId]) {
                  discountsByOperator[transaction.operatorId] = { count: 0, total: 0 };
                }
                discountsByOperator[transaction.operatorId].count++;
                discountsByOperator[transaction.operatorId].total += transaction.discount || 0;
              });

              return (
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Percent size={20} color="#f59e0b" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Discounts</Text>
                  </View>

                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <FileText size={24} color="#f59e0b" />
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{discountCount}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Discounts</Text>
                    </View>

                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <TrendingUp size={24} color="#f59e0b" />
                      <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>£{totalDiscountAmount.toFixed(2)}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Discounted</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>By Operator</Text>
                  {Object.entries(discountsByOperator).map(([operatorId, data]) => (
                    <View key={operatorId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breakdownLabel, { color: colors.text }]}>{
                          operators[operatorId] || operatorId
                        }</Text>
                        <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                          {data.count} discount{data.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.breakdownValue, { color: '#f59e0b' }]}>
                        £{data.total.toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Recent Discount Transactions</Text>
                  {transactionsWithDiscount.slice(0, 5).map((transaction) => (
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
                          {transaction.tableName && ` • ${transaction.tableName}`} • Discount: £{transaction.discount?.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={[styles.transactionTotal, { color: colors.primary }]}>
                        £{transaction.total.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {(() => {
              const transactionsWithGratuity = filteredTransactions.filter(t => t.gratuity && t.gratuity > 0);
              const totalGratuityAmount = transactionsWithGratuity.reduce((sum, t) => sum + (t.gratuity || 0), 0);
              const gratuityCount = transactionsWithGratuity.length;

              if (gratuityCount === 0) return null;

              const gratuityByOperator: Record<string, { count: number; total: number }> = {};

              transactionsWithGratuity.forEach(transaction => {
                if (!gratuityByOperator[transaction.operatorId]) {
                  gratuityByOperator[transaction.operatorId] = { count: 0, total: 0 };
                }
                gratuityByOperator[transaction.operatorId].count++;
                gratuityByOperator[transaction.operatorId].total += transaction.gratuity || 0;
              });

              return (
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Gift size={20} color="#10b981" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Gratuities</Text>
                  </View>

                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <FileText size={24} color="#10b981" />
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{gratuityCount}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Gratuities</Text>
                    </View>

                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <TrendingUp size={24} color="#10b981" />
                      <Text style={[styles.summaryValue, { color: '#10b981' }]}>£{totalGratuityAmount.toFixed(2)}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Gratuity</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>By Operator</Text>
                  {Object.entries(gratuityByOperator).map(([operatorId, data]) => (
                    <View key={operatorId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breakdownLabel, { color: colors.text }]}>{
                          operators[operatorId] || operatorId
                        }</Text>
                        <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                          {data.count} gratuity transaction{data.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.breakdownValue, { color: '#10b981' }]}>
                        £{data.total.toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Recent Gratuity Transactions</Text>
                  {transactionsWithGratuity.slice(0, 5).map((transaction) => (
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
                          {transaction.tableName && ` • ${transaction.tableName}`} • Gratuity: £{transaction.gratuity?.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={[styles.transactionTotal, { color: colors.primary }]}>
                        £{transaction.total.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {(() => {
              const transactionsWithCashback = filteredTransactions.filter(t => {
                if (!t.cashback || t.cashback <= 0) return false;
                
                if (t.payments && t.payments.length > 0) {
                  const lastPayment = t.payments[t.payments.length - 1];
                  return lastPayment.tenderName !== 'Cash';
                } else {
                  return t.tenderName !== 'Cash';
                }
              });
              const totalCashbackAmount = transactionsWithCashback.reduce((sum, t) => sum + (t.cashback || 0), 0);
              const cashbackCount = transactionsWithCashback.length;

              if (cashbackCount === 0) return null;

              const cashbackByOperator: Record<string, { count: number; total: number }> = {};
              const cashbackByPaymentMethod: Record<string, { count: number; total: number }> = {};

              transactionsWithCashback.forEach(transaction => {
                if (!cashbackByOperator[transaction.operatorId]) {
                  cashbackByOperator[transaction.operatorId] = { count: 0, total: 0 };
                }
                cashbackByOperator[transaction.operatorId].count++;
                cashbackByOperator[transaction.operatorId].total += transaction.cashback || 0;

                if (transaction.payments && transaction.payments.length > 0) {
                  const lastPayment = transaction.payments[transaction.payments.length - 1];
                  if (lastPayment.tenderName !== 'Cash') {
                    if (!cashbackByPaymentMethod[lastPayment.tenderName]) {
                      cashbackByPaymentMethod[lastPayment.tenderName] = { count: 0, total: 0 };
                    }
                    cashbackByPaymentMethod[lastPayment.tenderName].count++;
                    cashbackByPaymentMethod[lastPayment.tenderName].total += transaction.cashback || 0;
                  }
                } else {
                  if (transaction.tenderName !== 'Cash') {
                    if (!cashbackByPaymentMethod[transaction.tenderName]) {
                      cashbackByPaymentMethod[transaction.tenderName] = { count: 0, total: 0 };
                    }
                    cashbackByPaymentMethod[transaction.tenderName].count++;
                    cashbackByPaymentMethod[transaction.tenderName].total += transaction.cashback || 0;
                  }
                }
              });

              return (
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Banknote size={20} color="#3b82f6" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Cashback</Text>
                  </View>

                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <FileText size={24} color="#3b82f6" />
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{cashbackCount}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Cashback Txns</Text>
                    </View>

                    <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                      <TrendingUp size={24} color="#3b82f6" />
                      <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>£{totalCashbackAmount.toFixed(2)}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Cashback</Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>By Operator</Text>
                  {Object.entries(cashbackByOperator).map(([operatorId, data]) => (
                    <View key={operatorId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breakdownLabel, { color: colors.text }]}>{
                          operators[operatorId] || operatorId
                        }</Text>
                        <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                          {data.count} cashback transaction{data.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.breakdownValue, { color: '#3b82f6' }]}>
                        £{data.total.toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Recent Cashback Transactions</Text>
                  {transactionsWithCashback.slice(0, 5).map((transaction) => (
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
                          {transaction.tableName && ` • ${transaction.tableName}`} • Cashback: £{transaction.cashback?.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={[styles.transactionTotal, { color: colors.primary }]}>
                        £{transaction.total.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

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

            {(() => {
              const productSales: Record<string, { quantity: number; revenue: number; productName: string }> = {};
              filteredTransactions.forEach(transaction => {
                transaction.items.forEach(item => {
                  const productId = item.product.id;
                  if (!productSales[productId]) {
                    productSales[productId] = { quantity: 0, revenue: 0, productName: item.product.name };
                  }
                  productSales[productId].quantity += Math.abs(item.quantity);
                  productSales[productId].revenue += Math.abs(item.lineTotal);
                });
              });

              const topProducts = Object.entries(productSales)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 10);

              if (topProducts.length === 0) return null;

              return (
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Trophy size={20} color="#f59e0b" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Top Selling Products</Text>
                  </View>
                  {topProducts.map(([productId, data], index) => (
                    <View key={productId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 }}>
                        <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#d97706' : colors.background }]}>
                          <Text style={[styles.rankText, { color: index < 3 ? '#fff' : colors.textSecondary }]}>#{index + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.breakdownLabel, { color: colors.text }]}>{data.productName}</Text>
                          <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                            {data.quantity} sold
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.breakdownValue, { color: colors.primary }]}>£{data.revenue.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {(() => {
              const hourlyData: Record<number, { count: number; revenue: number }> = {};
              for (let i = 0; i < 24; i++) {
                hourlyData[i] = { count: 0, revenue: 0 };
              }

              filteredTransactions.forEach(transaction => {
                const hour = new Date(transaction.timestamp).getHours();
                hourlyData[hour].count++;
                hourlyData[hour].revenue += transaction.total;
              });

              const maxCount = Math.max(...Object.values(hourlyData).map(d => d.count), 1);
              const maxRevenue = Math.max(...Object.values(hourlyData).map(d => d.revenue), 1);

              if (filteredTransactions.length === 0) return null;

              return (
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Clock size={20} color="#8b5cf6" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Hourly Activity Heat Map</Text>
                  </View>
                  <Text style={[styles.heatMapSubtitle, { color: colors.textSecondary }]}>
                    Transaction volume and revenue by hour
                  </Text>
                  <View style={styles.heatMapContainer}>
                    {Object.entries(hourlyData).map(([hour, data]) => {
                      const intensity = data.count / maxCount;
                      const revenueIntensity = data.revenue / maxRevenue;
                      const averageIntensity = (intensity + revenueIntensity) / 2;
                      
                      return (
                        <View key={hour} style={styles.heatMapItem}>
                          <View 
                            style={[
                              styles.heatMapBar,
                              {
                                height: 60,
                                backgroundColor: data.count === 0 
                                  ? colors.background 
                                  : `rgba(139, 92, 246, ${0.2 + averageIntensity * 0.8})`,
                                borderColor: data.count > 0 ? '#8b5cf6' : colors.border,
                              }
                            ]}
                          >
                            {data.count > 0 && (
                              <Text style={[styles.heatMapBarText, { color: averageIntensity > 0.5 ? '#fff' : colors.text }]}>
                                {data.count}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.heatMapLabel, { color: colors.textSecondary }]}>
                            {hour.toString().padStart(2, '0')}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.heatMapLegend}>
                    <View style={styles.heatMapLegendItem}>
                      <View style={[styles.heatMapLegendBox, { backgroundColor: 'rgba(139, 92, 246, 0.3)' }]} />
                      <Text style={[styles.heatMapLegendText, { color: colors.textSecondary }]}>Low Activity</Text>
                    </View>
                    <View style={styles.heatMapLegendItem}>
                      <View style={[styles.heatMapLegendBox, { backgroundColor: 'rgba(139, 92, 246, 0.6)' }]} />
                      <Text style={[styles.heatMapLegendText, { color: colors.textSecondary }]}>Medium Activity</Text>
                    </View>
                    <View style={styles.heatMapLegendItem}>
                      <View style={[styles.heatMapLegendBox, { backgroundColor: 'rgba(139, 92, 246, 1)' }]} />
                      <Text style={[styles.heatMapLegendText, { color: colors.textSecondary }]}>High Activity</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

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
              <Text style={styles.exportButtonText}>Export Report (Excel)</Text>
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

                {selectedTransaction.payments && selectedTransaction.payments.length > 0 ? (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Methods</Text>
                    <View style={{ gap: 4 }}>
                      {selectedTransaction.payments.map((payment, idx) => (
                        <Text key={idx} style={[styles.detailValue, { color: colors.text }]}>
                          {payment.tenderName}: £{payment.amount.toFixed(2)}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.tenderName}</Text>
                  </View>
                )}

                <Text style={[styles.itemsHeader, { color: colors.text }]}>Items ({selectedTransaction.items.length})</Text>
                {selectedTransaction.items.map((item, index) => {
                  const prefix = getPricePrefix(item.selectedPrice.label);
                  const displayName = prefix ? `${prefix} ${item.product.name}` : item.product.name;
                  return (
                  <View key={index} style={[styles.itemRow, { backgroundColor: colors.background }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{displayName}</Text>
                      <Text style={[styles.itemDetails, { color: colors.textSecondary }]}>
                        {item.quantity} × £{item.selectedPrice.price.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={[styles.itemTotal, { color: colors.text }]}>£{item.lineTotal.toFixed(2)}</Text>
                  </View>
                )})}

                <View style={[styles.totalSection, { borderTopColor: colors.border }]}>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                    <Text style={[styles.totalValue, { color: colors.text }]}>
                      £{selectedTransaction.subtotal.toFixed(2)}
                    </Text>
                  </View>
                  {selectedTransaction.discount && selectedTransaction.discount > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Discount</Text>
                      <Text style={[styles.totalValue, { color: '#f59e0b' }]}>-£{selectedTransaction.discount.toFixed(2)}</Text>
                    </View>
                  )}
                  {Object.entries(selectedTransaction.vatBreakdown).map(([code, amount]) => (
                    <View key={code} style={styles.totalRow}>
                      <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>VAT ({code})</Text>
                      <Text style={[styles.totalValue, { color: colors.text }]}>£{amount.toFixed(2)}</Text>
                    </View>
                  ))}
                  {selectedTransaction.gratuity && selectedTransaction.gratuity > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Gratuity</Text>
                      <Text style={[styles.totalValue, { color: '#10b981' }]}>+£{selectedTransaction.gratuity.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.totalRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={[styles.totalLabelBold, { color: colors.text }]}>Total</Text>
                    <Text style={[styles.totalValueBold, { color: colors.primary }]}>
                      £{selectedTransaction.total.toFixed(2)}
                    </Text>
                  </View>
                  {selectedTransaction.cashback && selectedTransaction.cashback > 0 && (() => {
                    let tender = selectedTransaction.tenderName;
                    if (selectedTransaction.payments && selectedTransaction.payments.length > 0) {
                      const lastPayment = selectedTransaction.payments[selectedTransaction.payments.length - 1];
                      tender = lastPayment.tenderName;
                    }
                    const isCash = tender === 'Cash';
                    const label = isCash ? 'Change' : 'Cashback';
                    return (
                      <>
                        <View style={styles.totalRow}>
                          <Text style={[styles.totalLabelBold, { color: '#10b981' }]}>{label}</Text>
                          <Text style={[styles.totalValueBold, { color: '#10b981' }]}>
                            £{selectedTransaction.cashback.toFixed(2)}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.printReceiptButton,
                {
                  backgroundColor: isPrinterConnected ? colors.primary : colors.cardBackground,
                  borderColor: isPrinterConnected ? colors.primary : colors.border,
                  borderWidth: isPrinterConnected ? 0 : 2,
                  borderStyle: isPrinterConnected ? 'solid' : 'dotted',
                },
              ]}
              onPress={handlePrintReceipt}
              activeOpacity={isPrinterConnected ? 0.8 : 1}
              disabled={!isPrinterConnected}
            >
              <Printer size={20} color={isPrinterConnected ? '#fff' : colors.textTertiary} />
              <Text
                style={[
                  styles.printReceiptButtonText,
                  { color: isPrinterConnected ? '#fff' : colors.textTertiary },
                ]}
              >
                Re-Print Receipt
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={datePickerModalVisible}
        onRequestClose={() => setDatePickerModalVisible(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.datePickerModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setDatePickerModalVisible(false)}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Start Date & Time</Text>
                  <TouchableOpacity
                    style={[
                      styles.datePickerButton,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    onPress={() => Platform.OS === 'web' ? null : setShowStartDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    {Platform.OS === 'web' ? (
                      <input
                        type="datetime-local"
                        value={formatDateTimeForInput(customStartDate)}
                        onChange={(e) => {
                          const date = new Date(e.target.value);
                          if (!isNaN(date.getTime())) {
                            setCustomStartDate(date);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: 16,
                          fontSize: 16,
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: colors.text,
                          fontFamily: 'inherit',
                        }}
                      />
                    ) : (
                      <Text style={[styles.datePickerButtonText, { color: colors.text }]}>
                        {formatDateTime(customStartDate)}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {showStartDatePicker && Platform.OS !== 'web' && (
                    <View>
                      <DateTimePicker
                        value={customStartDate}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                          setShowStartDatePicker(false);
                          if (selectedDate) {
                            const newDate = new Date(
                              selectedDate.getFullYear(),
                              selectedDate.getMonth(),
                              selectedDate.getDate(),
                              customStartDate.getHours(),
                              customStartDate.getMinutes()
                            );
                            setCustomStartDate(newDate);
                            setShowStartTimePicker(true);
                          }
                        }}
                      />
                    </View>
                  )}
                  {showStartTimePicker && Platform.OS !== 'web' && (
                    <View>
                      <DateTimePicker
                        value={customStartDate}
                        mode="time"
                        display="spinner"
                        onChange={(event, selectedTime) => {
                          setShowStartTimePicker(false);
                          if (selectedTime) {
                            const newDate = new Date(
                              customStartDate.getFullYear(),
                              customStartDate.getMonth(),
                              customStartDate.getDate(),
                              selectedTime.getHours(),
                              selectedTime.getMinutes()
                            );
                            setCustomStartDate(newDate);
                          }
                        }}
                      />
                    </View>
                  )}
                </View>

                <View>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>End Date & Time</Text>
                  <TouchableOpacity
                    style={[
                      styles.datePickerButton,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    onPress={() => Platform.OS === 'web' ? null : setShowEndDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    {Platform.OS === 'web' ? (
                      <input
                        type="datetime-local"
                        value={formatDateTimeForInput(customEndDate)}
                        onChange={(e) => {
                          const date = new Date(e.target.value);
                          if (!isNaN(date.getTime())) {
                            setCustomEndDate(date);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: 16,
                          fontSize: 16,
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: colors.text,
                          fontFamily: 'inherit',
                        }}
                      />
                    ) : (
                      <Text style={[styles.datePickerButtonText, { color: colors.text }]}>
                        {formatDateTime(customEndDate)}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {showEndDatePicker && Platform.OS !== 'web' && (
                    <View>
                      <DateTimePicker
                        value={customEndDate}
                        mode="date"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                          setShowEndDatePicker(false);
                          if (selectedDate) {
                            const newDate = new Date(
                              selectedDate.getFullYear(),
                              selectedDate.getMonth(),
                              selectedDate.getDate(),
                              customEndDate.getHours(),
                              customEndDate.getMinutes()
                            );
                            setCustomEndDate(newDate);
                            setShowEndTimePicker(true);
                          }
                        }}
                      />
                    </View>
                  )}
                  {showEndTimePicker && Platform.OS !== 'web' && (
                    <View>
                      <DateTimePicker
                        value={customEndDate}
                        mode="time"
                        display="spinner"
                        onChange={(event, selectedTime) => {
                          setShowEndTimePicker(false);
                          if (selectedTime) {
                            const newDate = new Date(
                              customEndDate.getFullYear(),
                              customEndDate.getMonth(),
                              customEndDate.getDate(),
                              selectedTime.getHours(),
                              selectedTime.getMinutes()
                            );
                            setCustomEndDate(newDate);
                          }
                        }}
                      />
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.applyButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (customStartDate > customEndDate) {
                      Alert.alert('Invalid Date Range', 'Start date must be before end date');
                      return;
                    }
                    setDateRange('custom');
                    setDatePickerModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applyButtonText}>Apply Date Range</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={transactionSearchModalVisible || refundSearchModalVisible}
        onRequestClose={() => {
          setTransactionSearchModalVisible(false);
          setRefundSearchModalVisible(false);
        }}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.searchModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {searchType === 'transaction' ? 'Find Transaction' : 'Find Refund'}
              </Text>
              <TouchableOpacity onPress={() => {
                setTransactionSearchModalVisible(false);
                setRefundSearchModalVisible(false);
              }}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: '80%' }}>
              {searchResults.length === 0 ? (
                <View style={{ gap: 16 }}>
                  <Text style={[styles.searchLabel, { color: colors.text }]}>
                    Select date range to search {searchType === 'transaction' ? 'transactions' : 'refunds'}
                  </Text>

                  <View>
                    <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Start Date & Time</Text>
                    <TouchableOpacity
                      style={[
                        styles.datePickerButton,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                      onPress={() => Platform.OS === 'web' ? null : setShowSearchStartDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      {Platform.OS === 'web' ? (
                        <input
                          type="datetime-local"
                          value={formatDateTimeForInput(searchStartDate)}
                          onChange={(e) => {
                            const date = new Date(e.target.value);
                            if (!isNaN(date.getTime())) {
                              setSearchStartDate(date);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: 16,
                            fontSize: 16,
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: colors.text,
                            fontFamily: 'inherit',
                          }}
                        />
                      ) : (
                        <Text style={[styles.datePickerButtonText, { color: colors.text }]}>
                          {formatDateTime(searchStartDate)}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {showSearchStartDatePicker && Platform.OS !== 'web' && (
                      <View>
                        <DateTimePicker
                          value={searchStartDate}
                          mode="date"
                          display="spinner"
                          onChange={(event, selectedDate) => {
                            setShowSearchStartDatePicker(false);
                            if (selectedDate) {
                              const newDate = new Date(
                                selectedDate.getFullYear(),
                                selectedDate.getMonth(),
                                selectedDate.getDate(),
                                searchStartDate.getHours(),
                                searchStartDate.getMinutes()
                              );
                              setSearchStartDate(newDate);
                              setShowSearchStartTimePicker(true);
                            }
                          }}
                        />
                      </View>
                    )}
                    {showSearchStartTimePicker && Platform.OS !== 'web' && (
                      <View>
                        <DateTimePicker
                          value={searchStartDate}
                          mode="time"
                          display="spinner"
                          onChange={(event, selectedTime) => {
                            setShowSearchStartTimePicker(false);
                            if (selectedTime) {
                              const newDate = new Date(
                                searchStartDate.getFullYear(),
                                searchStartDate.getMonth(),
                                searchStartDate.getDate(),
                                selectedTime.getHours(),
                                selectedTime.getMinutes()
                              );
                              setSearchStartDate(newDate);
                            }
                          }}
                        />
                      </View>
                    )}
                  </View>

                  <View>
                    <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>End Date & Time</Text>
                    <TouchableOpacity
                      style={[
                        styles.datePickerButton,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                      onPress={() => Platform.OS === 'web' ? null : setShowSearchEndDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      {Platform.OS === 'web' ? (
                        <input
                          type="datetime-local"
                          value={formatDateTimeForInput(searchEndDate)}
                          onChange={(e) => {
                            const date = new Date(e.target.value);
                            if (!isNaN(date.getTime())) {
                              setSearchEndDate(date);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: 16,
                            fontSize: 16,
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: colors.text,
                            fontFamily: 'inherit',
                          }}
                        />
                      ) : (
                        <Text style={[styles.datePickerButtonText, { color: colors.text }]}>
                          {formatDateTime(searchEndDate)}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {showSearchEndDatePicker && Platform.OS !== 'web' && (
                      <View>
                        <DateTimePicker
                          value={searchEndDate}
                          mode="date"
                          display="spinner"
                          onChange={(event, selectedDate) => {
                            setShowSearchEndDatePicker(false);
                            if (selectedDate) {
                              const newDate = new Date(
                                selectedDate.getFullYear(),
                                selectedDate.getMonth(),
                                selectedDate.getDate(),
                                searchEndDate.getHours(),
                                searchEndDate.getMinutes()
                              );
                              setSearchEndDate(newDate);
                              setShowSearchEndTimePicker(true);
                            }
                          }}
                        />
                      </View>
                    )}
                    {showSearchEndTimePicker && Platform.OS !== 'web' && (
                      <View>
                        <DateTimePicker
                          value={searchEndDate}
                          mode="time"
                          display="spinner"
                          onChange={(event, selectedTime) => {
                            setShowSearchEndTimePicker(false);
                            if (selectedTime) {
                              const newDate = new Date(
                                searchEndDate.getFullYear(),
                                searchEndDate.getMonth(),
                                searchEndDate.getDate(),
                                selectedTime.getHours(),
                                selectedTime.getMinutes()
                              );
                              setSearchEndDate(newDate);
                            }
                          }}
                        />
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.applyButton, { backgroundColor: colors.primary }]}
                    onPress={handleSearchTransactions}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.applyButtonText}>Search</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.searchResultsHeader}>
                    <Text style={[styles.searchResultsTitle, { color: colors.text }]}>
                      Found {searchResults.length} {searchType === 'transaction' ? 'transaction' : 'refund'}{searchResults.length !== 1 ? 's' : ''}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setSearchResults([])}
                      style={[styles.newSearchButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.newSearchButtonText, { color: colors.primary }]}>New Search</Text>
                    </TouchableOpacity>
                  </View>

                  {searchResults.map((transaction) => (
                    <TouchableOpacity
                      key={transaction.id}
                      style={[styles.transactionItem, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setTransactionSearchModalVisible(false);
                        setRefundSearchModalVisible(false);
                        viewTransactionDetail(transaction);
                      }}
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
                        <Text style={[styles.transactionOperator, { color: colors.textTertiary, fontSize: 12 }]}>
                          ID: {transaction.id}
                        </Text>
                      </View>
                      <Text style={[styles.transactionTotal, { color: transaction.isRefund ? '#ef4444' : colors.primary }]}>
                        £{transaction.total.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
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
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 8,
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
    height: '80%',
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
  customDateButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 8,
  },
  customDateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  datePickerModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  datePickerButton: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden' as const,
  },
  datePickerButtonText: {
    padding: 16,
    fontSize: 16,
  },
  applyButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  searchButtonsContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 16,
  },
  searchButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  searchModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  searchLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  searchResultsHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
    paddingBottom: 12,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  newSearchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
  },
  newSearchButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  heatMapContainer: {
    flexDirection: 'row' as const,
    gap: 4,
    marginTop: 12,
  },
  heatMapItem: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 4,
  },
  heatMapBar: {
    width: '100%',
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heatMapBarText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  heatMapLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
  },
  heatMapSubtitle: {
    fontSize: 13,
    marginBottom: 4,
  },
  heatMapLegend: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
  },
  heatMapLegendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  heatMapLegendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  heatMapLegendText: {
    fontSize: 11,
  },
  operatorStatsContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  operatorStatCard: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 4,
  },
  operatorStatLabel: {
    fontSize: 11,
    textAlign: 'center' as const,
  },
  operatorStatValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  operatorStatSubtext: {
    fontSize: 11,
    textAlign: 'center' as const,
  },
  printReceiptButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  printReceiptButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
