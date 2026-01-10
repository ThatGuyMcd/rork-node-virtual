import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Calendar, FileText, Filter, Layers, Wand2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type PresetRange = 'today' | 'week' | 'month' | 'custom';

export default function BuildReportScreen() {
  const { colors, theme } = useTheme();
  const [presetRange, setPresetRange] = useState<PresetRange>('today');
  const [reportName, setReportName] = useState<string>('');

  const isDark = theme === 'dark' || theme.includes('Dark');

  const subtitle = useMemo(() => {
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
  }, [presetRange]);

  const handleNotReady = (feature: string) => {
    console.log('[BuildReport] Feature not yet implemented:', feature);
    Alert.alert('Coming Soon', `${feature} will be added next.`);
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
        <View style={[styles.heroCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: (isDark ? '#0ea5e920' : '#0ea5e915') }]}
              testID="build-report-hero-icon"
            >
              <Wand2 size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.text }]} testID="build-report-title">Build a Report</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]} testID="build-report-subtitle">{subtitle}</Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'today' && { borderColor: colors.primary }]}
              onPress={() => setPresetRange('today')}
              activeOpacity={0.8}
              testID="build-report-range-today"
            >
              <Text style={[styles.pillText, { color: colors.text }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'week' && { borderColor: colors.primary }]}
              onPress={() => setPresetRange('week')}
              activeOpacity={0.8}
              testID="build-report-range-week"
            >
              <Text style={[styles.pillText, { color: colors.text }]}>Last 7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'month' && { borderColor: colors.primary }]}
              onPress={() => setPresetRange('month')}
              activeOpacity={0.8}
              testID="build-report-range-month"
            >
              <Text style={[styles.pillText, { color: colors.text }]}>This Month</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }, presetRange === 'custom' && { borderColor: colors.primary }]}
              onPress={() => setPresetRange('custom')}
              activeOpacity={0.8}
              testID="build-report-range-custom"
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
              testID="build-report-name-input"
            />
          </View>
        </View>

        <View style={styles.grid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => handleNotReady('Date & time range')}
            activeOpacity={0.85}
            testID="build-report-action-date"
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary + '18' }]}>
              <Calendar size={20} color={colors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Date & Time</Text>
            <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Pick exact start/end times.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => handleNotReady('Filters')}
            activeOpacity={0.85}
            testID="build-report-action-filters"
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.accent + '18' }]}>
              <Filter size={20} color={colors.accent} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Filters</Text>
            <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Operator, tenders, refunds, etc.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => handleNotReady('Report sections')}
            activeOpacity={0.85}
            testID="build-report-action-sections"
          >
            <View style={[styles.actionIcon, { backgroundColor: '#f97316' + '18' }]}>
              <Layers size={20} color={'#f97316'} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Sections</Text>
            <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Choose what to include.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => handleNotReady('Generate report')}
            activeOpacity={0.85}
            testID="build-report-action-generate"
          >
            <View style={[styles.actionIcon, { backgroundColor: '#10b981' + '18' }]}>
              <FileText size={20} color={'#10b981'} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Generate</Text>
            <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Preview & export your report.</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.noteCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          testID="build-report-note"
        >
          <Text style={[styles.noteTitle, { color: colors.text }]}>Next step</Text>
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>Tell me what controls you want on this page (date range, operators, payment types, export formats), and I’ll build it to match the existing Reports experience.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontWeight: '700',
  },
  inputCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  noteCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
