import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Calendar, FileText, Filter, Layers, Wand2, X, Download, CheckSquare, Square, TrendingUp, Users, CreditCard, BarChart3, Trophy, Clock, RotateCcw, Percent, Gift, Banknote } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { transactionService } from '@/services/transactionService';
import { dataSyncService } from '@/services/dataSync';
import type { Transaction, TransactionReport } from '@/types/pos';

type PresetRange = 'today' | 'week' | 'month' | 'custom';

interface ReportFilters {
  operatorIds: string[];
  tenderIds: string[];
  includeRefunds: boolean;
  refundsOnly: boolean;
}

interface ReportSections {
  summary: boolean;
  vat: boolean;
  operators: boolean;
  paymentMethods: boolean;
  refunds: boolean;
  discounts: boolean;
  gratuities: boolean;
  cashback: boolean;
  groups: boolean;
  departments: boolean;
  topProducts: boolean;
  hourlyActivity: boolean;
}

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
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

export default function BuildReportScreen() {
  const { colors, theme } = useTheme();
  const [presetRange, setPresetRange] = useState<PresetRange>('today');
  const [reportName, setReportName] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date(new Date().setHours(0, 0, 0, 0)));
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({
    operatorIds: [],
    tenderIds: [],
    includeRefunds: true,
    refundsOnly: false,
  });
  const [sections, setSections] = useState<ReportSections>({
    summary: true,
    vat: true,
    operators: true,
    paymentMethods: true,
    refunds: true,
    discounts: true,
    gratuities: true,
    cashback: true,
    groups: true,
    departments: true,
    topProducts: true,
    hourlyActivity: true,
  });
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [tenders, setTenders] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<TransactionReport | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  const isDark = theme === 'dark' || theme.includes('Dark');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const ops = await dataSyncService.getStoredOperators();
    setOperators(ops.map(op => ({ id: op.id, name: op.name })));

    const tnds = await dataSyncService.getStoredTenders();
    setTenders(tnds.map(t => ({ id: t.id, name: t.name })));

    const loadedGroups = await dataSyncService.getStoredGroups();
    const groupMap: Record<string, string> = {};
    loadedGroups.forEach(group => {
      groupMap[group.id] = group.name;
    });
    setGroups(groupMap);

    const loadedDepartments = await dataSyncService.getStoredDepartments();
    const departmentMap: Record<string, string> = {};
    loadedDepartments.forEach(dept => {
      departmentMap[dept.id] = dept.name;
    });
    setDepartments(departmentMap);
  };

  const subtitle = useMemo(() => {
    if (generatedReport) {
      return `Report generated for ${formatDateTime(new Date(generatedReport.startDate))} - ${formatDateTime(new Date(generatedReport.endDate))}`;
    }
    switch (presetRange) {
      case 'today':
        return 'Quickly build a report for today.';
      case 'week':
        return 'Build a report for the last 7 days.';
      case 'month':
        return 'Build a report from the start of this month.';
      case 'custom':
        return 'Choose your own date/time range.';
      default:
        return 'Build a custom report.';
    }
  }, [presetRange, generatedReport]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (presetRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case 'custom':
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }

    return { startDate, endDate };
  }, [presetRange, customStartDate, customEndDate]);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      if (startDate > endDate) {
        Alert.alert('Invalid Date Range', 'Start date must be before end date');
        setLoading(false);
        return;
      }

      let transactions = await transactionService.getTransactionsByDateRange(startDate, endDate);

      if (filters.refundsOnly) {
        transactions = transactions.filter(t => t.isRefund);
      } else if (!filters.includeRefunds) {
        transactions = transactions.filter(t => !t.isRefund);
      }

      if (filters.operatorIds.length > 0) {
        transactions = transactions.filter(t => filters.operatorIds.includes(t.operatorId));
      }

      if (filters.tenderIds.length > 0) {
        transactions = transactions.filter(t => {
          if (t.payments && t.payments.length > 0) {
            return t.payments.some(p => filters.tenderIds.includes(p.tenderId || ''));
          }
          return filters.tenderIds.includes(t.tenderId);
        });
      }

      setFilteredTransactions(transactions.reverse());

      const report = await transactionService.generateReport(startDate, endDate);
      setGeneratedReport(report);

      console.log('[BuildReport] Report generated:', report);
    } catch (error) {
      console.error('[BuildReport] Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (filteredTransactions.length === 0) {
      Alert.alert('No Data', 'Generate a report first before exporting');
      return;
    }

    try {
      const excelBuffer = await transactionService.exportTransactionsExcel(filteredTransactions);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = reportName || `custom_report_${formatDate(new Date())}`;
        a.download = `${filename.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Report exported successfully');
      } else {
        Alert.alert('Export', 'Excel export is only available on web. Please use the web version to export reports.');
      }
    } catch (error) {
      console.error('[BuildReport] Error exporting report:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  const toggleSection = (key: keyof ReportSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleOperatorFilter = (operatorId: string) => {
    setFilters(prev => ({
      ...prev,
      operatorIds: prev.operatorIds.includes(operatorId)
        ? prev.operatorIds.filter(id => id !== operatorId)
        : [...prev.operatorIds, operatorId],
    }));
  };

  const toggleTenderFilter = (tenderId: string) => {
    setFilters(prev => ({
      ...prev,
      tenderIds: prev.tenderIds.includes(tenderId)
        ? prev.tenderIds.filter(id => id !== tenderId)
        : [...prev.tenderIds, tenderId],
    }));
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.operatorIds.length > 0) count++;
    if (filters.tenderIds.length > 0) count++;
    if (filters.refundsOnly) count++;
    if (!filters.includeRefunds) count++;
    return count;
  }, [filters]);

  const activeSectionsCount = useMemo(() => {
    return Object.values(sections).filter(v => v).length;
  }, [sections]);

  const renderReportSections = () => {
    if (!generatedReport || filteredTransactions.length === 0) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <FileText size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Report Generated</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Configure your options and tap Generate to create your custom report
          </Text>
        </View>
      );
    }

    const refundTransactions = filteredTransactions.filter(t => t.isRefund);
    const discountTransactions = filteredTransactions.filter(t => t.discount && t.discount > 0);
    const gratuityTransactions = filteredTransactions.filter(t => t.gratuity && t.gratuity > 0);
    const cashbackTransactions = filteredTransactions.filter(t => {
      if (!t.cashback || t.cashback <= 0) return false;
      if (t.payments && t.payments.length > 0) {
        const lastPayment = t.payments[t.payments.length - 1];
        return lastPayment.tenderName !== 'Cash';
      }
      return t.tenderName !== 'Cash';
    });

    return (
      <>
        {sections.summary && (
          <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <BarChart3 size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Summary</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <FileText size={24} color={colors.primary} />
                <Text style={[styles.summaryValue, { color: colors.text }]}>{generatedReport.totalTransactions}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Transactions</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <TrendingUp size={24} color="#10b981" />
                <Text style={[styles.summaryValue, { color: colors.text }]}>£{generatedReport.totalRevenue.toFixed(2)}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Revenue</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <CreditCard size={24} color="#f59e0b" />
                <Text style={[styles.summaryValue, { color: colors.text }]}>£{generatedReport.totalVAT.toFixed(2)}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total VAT</Text>
              </View>
            </View>
          </View>
        )}

        {sections.operators && (
          <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Users size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>By Operator</Text>
            </View>
            {Object.entries(generatedReport.transactionsByOperator)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([operatorId, data]) => (
                <View key={operatorId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                      {operators.find(o => o.id === operatorId)?.name || operatorId}
                    </Text>
                    <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                      {data.count} txns • Avg: £{(data.revenue / data.count).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>£{data.revenue.toFixed(2)}</Text>
                </View>
              ))}
          </View>
        )}

        {sections.paymentMethods && (
          <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <CreditCard size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>By Payment Method</Text>
            </View>
            {Object.entries(generatedReport.transactionsByTender)
              .filter(([tender]) => tender !== 'Split Payment')
              .map(([tender, data]) => (
                <View key={tender} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.breakdownLabel, { color: colors.text }]}>{tender}</Text>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>£{data.revenue.toFixed(2)}</Text>
                </View>
              ))}
          </View>
        )}

        {sections.refunds && refundTransactions.length > 0 && (
          <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <RotateCcw size={20} color="#ef4444" />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Refunds</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <FileText size={24} color="#ef4444" />
                <Text style={[styles.summaryValue, { color: colors.text }]}>{refundTransactions.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Refunds</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <TrendingUp size={24} color="#ef4444" />
                <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                  £{refundTransactions.reduce((sum, t) => sum + t.total, 0).toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Refunded</Text>
              </View>
            </View>
          </View>
        )}

        {sections.discounts && discountTransactions.length > 0 && (
          <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Percent size={20} color="#f59e0b" />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Discounts</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <FileText size={24} color="#f59e0b" />
                <Text style={[styles.summaryValue, { color: colors.text }]}>{discountTransactions.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Discounts</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <TrendingUp size={24} color="#f59e0b" />
                <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
                  £{discountTransactions.reduce((sum, t) => sum + (t.discount || 0), 0).toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Discounted</Text>
              </View>
            </View>
          </View>
        )}

        {sections.gratuities && gratuityTransactions.length > 0 && (
          <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Gift size={20} color="#10b981" />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Gratuities</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <FileText size={24} color="#10b981" />
                <Text style={[styles.summaryValue, { color: colors.text }]}>{gratuityTransactions.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Gratuities</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <TrendingUp size={24} color="#10b981" />
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                  £{gratuityTransactions.reduce((sum, t) => sum + (t.gratuity || 0), 0).toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Gratuity</Text>
              </View>
            </View>
          </View>
        )}

        {sections.cashback && cashbackTransactions.length > 0 && (
          <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Banknote size={20} color="#3b82f6" />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Cashback</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <FileText size={24} color="#3b82f6" />
                <Text style={[styles.summaryValue, { color: colors.text }]}>{cashbackTransactions.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Cashback Txns</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.background }]}>
                <TrendingUp size={24} color="#3b82f6" />
                <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>
                  £{cashbackTransactions.reduce((sum, t) => sum + (t.cashback || 0), 0).toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Cashback</Text>
              </View>
            </View>
          </View>
        )}

        {sections.groups && (() => {
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

          if (sortedGroups.length === 0) return null;

          return (
            <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Layers size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Product Group</Text>
              </View>
              {sortedGroups.map(([groupId, data]) => (
                <View key={groupId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                      {groups[groupId] || `Group ${groupId}`}
                    </Text>
                    <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                      {data.quantity} item{data.quantity !== 1 ? 's' : ''} sold
                    </Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>£{data.revenue.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {sections.departments && (() => {
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

          if (sortedDepartments.length === 0) return null;

          return (
            <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Layers size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>By Department</Text>
              </View>
              {sortedDepartments.map(([departmentId, data]) => (
                <View key={departmentId} style={[styles.breakdownItem, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>
                      {departments[departmentId] || `Department ${departmentId}`}
                    </Text>
                    <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>
                      {data.quantity} item{data.quantity !== 1 ? 's' : ''} sold
                    </Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>£{data.revenue.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {sections.topProducts && (() => {
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
            <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
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
                      <Text style={[styles.breakdownSubtext, { color: colors.textTertiary }]}>{data.quantity} sold</Text>
                    </View>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>£{data.revenue.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {sections.hourlyActivity && (() => {
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

          return (
            <View style={[styles.reportCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Clock size={20} color="#8b5cf6" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Hourly Activity</Text>
              </View>
              <View style={styles.heatMapContainer}>
                {Object.entries(hourlyData).map(([hour, data]) => {
                  const intensity = data.count / maxCount;
                  return (
                    <View key={hour} style={styles.heatMapItem}>
                      <View 
                        style={[
                          styles.heatMapBar,
                          {
                            height: 60,
                            backgroundColor: data.count === 0 
                              ? colors.background 
                              : `rgba(139, 92, 246, ${0.2 + intensity * 0.8})`,
                            borderColor: data.count > 0 ? '#8b5cf6' : colors.border,
                          }
                        ]}
                      >
                        {data.count > 0 && (
                          <Text style={[styles.heatMapBarText, { color: intensity > 0.5 ? '#fff' : colors.text }]}>
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
            </View>
          );
        })()}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="build-report-screen">
      <Stack.Screen
        options={{
          title: 'Build a Report',
          headerShown: true,
          headerStyle: { backgroundColor: colors.cardBackground },
          headerTintColor: colors.text,
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} testID="build-report-scroll">
        {!generatedReport && (
          <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: (isDark ? '#0ea5e920' : '#0ea5e915') }]}>
                <Wand2 size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: colors.text }]}>Build a Report</Text>
                <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
              </View>
            </View>

            <View style={styles.quickRow}>
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'today' && { borderColor: colors.primary }]}
                onPress={() => setPresetRange('today')}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, { color: colors.text }]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'week' && { borderColor: colors.primary }]}
                onPress={() => setPresetRange('week')}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, { color: colors.text }]}>Last 7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'month' && { borderColor: colors.primary }]}
                onPress={() => setPresetRange('month')}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, { color: colors.text }]}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'custom' && { borderColor: colors.primary }]}
                onPress={() => {
                  setPresetRange('custom');
                  setShowDatePicker(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, { color: colors.text }]}>Custom</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Report name (optional)</Text>
              <TextInput
                value={reportName}
                onChangeText={setReportName}
                placeholder="e.g., Friday Night Shift"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
              />
            </View>
          </View>
        )}

        <View style={styles.grid}>
          {presetRange === 'custom' && (
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.primary }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '18' }]}>
                <Calendar size={20} color={colors.primary} />
              </View>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Date & Time</Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                {formatDate(customStartDate)} - {formatDate(customEndDate)}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: activeFiltersCount > 0 ? colors.accent : colors.border }]}
            onPress={() => setShowFiltersModal(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.accent + '18' }]}>
              <Filter size={20} color={colors.accent} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Filters</Text>
            <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
              {activeFiltersCount > 0 ? `${activeFiltersCount} active` : 'None applied'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => setShowSectionsModal(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#f97316' + '18' }]}>
              <Layers size={20} color={'#f97316'} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Sections</Text>
            <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
              {activeSectionsCount} selected
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleGenerateReport}
            activeOpacity={0.85}
            disabled={loading}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FileText size={20} color="#fff" />
              )}
            </View>
            <Text style={[styles.actionTitle, { color: '#fff' }]}>Generate</Text>
            <Text style={[styles.actionDesc, { color: 'rgba(255,255,255,0.9)' }]}>
              {loading ? 'Building...' : 'Create report'}
            </Text>
          </TouchableOpacity>
        </View>

        {renderReportSections()}

        {generatedReport && filteredTransactions.length > 0 && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: colors.primary }]}
              onPress={handleExportReport}
              activeOpacity={0.8}
            >
              <Download size={20} color="#fff" />
              <Text style={styles.exportButtonText}>Export (Excel)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.newReportButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => {
                setGeneratedReport(null);
                setFilteredTransactions([]);
              }}
              activeOpacity={0.8}
            >
              <Wand2 size={20} color={colors.text} />
              <Text style={[styles.newReportButtonText, { color: colors.text }]}>New Report</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={showDatePicker}
        onRequestClose={() => setShowDatePicker(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Start Date & Time</Text>
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
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
                  )}
                  {showStartTimePicker && Platform.OS !== 'web' && (
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
                  )}
                </View>

                <View>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>End Date & Time</Text>
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
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
                  )}
                  {showEndTimePicker && Platform.OS !== 'web' && (
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
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.applyButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (customStartDate > customEndDate) {
                      Alert.alert('Invalid Date Range', 'Start date must be before end date');
                      return;
                    }
                    setShowDatePicker(false);
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
        visible={showFiltersModal}
        onRequestClose={() => setShowFiltersModal(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              <View style={{ gap: 20 }}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Operators</Text>
                  {operators.map(op => (
                    <TouchableOpacity
                      key={op.id}
                      style={[styles.checkboxRow, { borderBottomColor: colors.border }]}
                      onPress={() => toggleOperatorFilter(op.id)}
                      activeOpacity={0.7}
                    >
                      {filters.operatorIds.includes(op.id) ? (
                        <CheckSquare size={20} color={colors.primary} />
                      ) : (
                        <Square size={20} color={colors.textTertiary} />
                      )}
                      <Text style={[styles.checkboxLabel, { color: colors.text }]}>{op.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Methods</Text>
                  {tenders.map(tender => (
                    <TouchableOpacity
                      key={tender.id}
                      style={[styles.checkboxRow, { borderBottomColor: colors.border }]}
                      onPress={() => toggleTenderFilter(tender.id)}
                      activeOpacity={0.7}
                    >
                      {filters.tenderIds.includes(tender.id) ? (
                        <CheckSquare size={20} color={colors.primary} />
                      ) : (
                        <Square size={20} color={colors.textTertiary} />
                      )}
                      <Text style={[styles.checkboxLabel, { color: colors.text }]}>{tender.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Refunds</Text>
                  <TouchableOpacity
                    style={[styles.checkboxRow, { borderBottomColor: colors.border }]}
                    onPress={() => setFilters(prev => ({ ...prev, includeRefunds: !prev.includeRefunds, refundsOnly: false }))}
                    activeOpacity={0.7}
                  >
                    {filters.includeRefunds ? (
                      <CheckSquare size={20} color={colors.primary} />
                    ) : (
                      <Square size={20} color={colors.textTertiary} />
                    )}
                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>Include Refunds</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.checkboxRow, { borderBottomColor: colors.border }]}
                    onPress={() => setFilters(prev => ({ ...prev, refundsOnly: !prev.refundsOnly, includeRefunds: true }))}
                    activeOpacity={0.7}
                  >
                    {filters.refundsOnly ? (
                      <CheckSquare size={20} color={colors.primary} />
                    ) : (
                      <Square size={20} color={colors.textTertiary} />
                    )}
                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>Refunds Only</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={() => setShowFiltersModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={showSectionsModal}
        onRequestClose={() => setShowSectionsModal(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Report Sections</Text>
              <TouchableOpacity onPress={() => setShowSectionsModal(false)}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              <View style={{ gap: 8 }}>
                {Object.entries(sections).map(([key, value]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.checkboxRow, { borderBottomColor: colors.border }]}
                    onPress={() => toggleSection(key as keyof ReportSections)}
                    activeOpacity={0.7}
                  >
                    {value ? (
                      <CheckSquare size={20} color={colors.primary} />
                    ) : (
                      <Square size={20} color={colors.textTertiary} />
                    )}
                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={() => setShowSectionsModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.applyButtonText}>Done</Text>
            </TouchableOpacity>
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
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  quickRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  inputCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    minHeight: 120,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  actionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  reportCard: {
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
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center' as const,
  },
  actionButtonsContainer: {
    gap: 12,
    marginTop: 8,
  },
  exportButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    padding: 16,
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  newReportButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  newReportButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
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
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
