import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Dimensions,
  Modal,
  Animated,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { ChevronLeft, X, RefreshCw, Grid3x3, Save } from 'lucide-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { usePOS } from '@/contexts/POSContext';
import { useTheme, type ButtonSkin } from '@/contexts/ThemeContext';
import { dataSyncService } from '@/services/dataSync';
import { tableDataService } from '@/services/tableDataService';
import { apiClient } from '@/services/api';
import { dataParser } from '@/services/dataParser';
import { getMostCommonColor } from '@/utils/colorUtils';
import type { Product, PriceOption, ProductGroup, Department, Table, ProductDisplaySettings, MenuData, MenuProduct, Operator } from '@/types/pos';

const trimName = (name: string): string => {
  return name.length > 6 ? name.substring(6) : name;
};

const { width } = Dimensions.get('window');

const getCardDimensions = (layout: 'compact' | 'standard' | 'large') => {
  const gap = 16;
  const padding = 32;
  const availableWidth = width - padding;
  
  switch (layout) {
    case 'compact':
      return {
        width: (availableWidth - gap * 2) / 3,
        groupHeight: 100,
        productHeight: 80,
      };
    case 'large':
      return {
        width: availableWidth,
        groupHeight: 140,
        productHeight: 120,
      };
    case 'standard':
    default:
      return {
        width: (availableWidth - gap) / 2,
        groupHeight: 120,
        productHeight: 100,
      };
  }
};

export default function ProductsScreen() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [manualPriceModalVisible, setManualPriceModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [manualPrice, setManualPrice] = useState('');
  const [selectedPriceForManual, setSelectedPriceForManual] = useState<PriceOption | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [loadingAreaData, setLoadingAreaData] = useState(false);
  const [tableStatuses, setTableStatuses] = useState<Map<string, { hasData: boolean; subtotal: number; isLocked: boolean }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<ProductDisplaySettings>({
    hiddenGroupIds: [],
    hiddenDepartmentIds: [],
    sortOrder: 'filename',
  });
  const [menuData, setMenuData] = useState<MenuData>({});
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [currentMenuId, setCurrentMenuId] = useState<string | null>(null);
  const [menuStack, setMenuStack] = useState<string[]>([]);
  const [saveErrorModalVisible, setSaveErrorModalVisible] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [customPriceNames, setCustomPriceNames] = useState<Record<string, { name: string; prefix: string }>>({});
  const justFinishedLoadingAreaRef = useRef(false);
  const router = useRouter();

  const getButtonSkinStyle = useCallback((skin: ButtonSkin, backgroundColor: string = '#000000') => {
    switch (skin) {
      case 'rounded':
        return {
          borderRadius: 28,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 10,
        };
      case 'sharp':
        return {
          borderRadius: 4,
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 0,
          elevation: 4,
        };
      case 'soft':
        return {
          borderRadius: 20,
          shadowColor: backgroundColor,
          shadowOffset: { width: -4, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 0,
        };
      case 'outlined':
        return {
          borderRadius: 16,
          borderWidth: 3,
          borderColor: backgroundColor,
          shadowColor: backgroundColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 20,
          elevation: 0,
        };
      case 'minimal':
        return {
          borderRadius: 8,
          borderWidth: 0,
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
        };
      case 'default':
      default:
        return {
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 6,
        };
    }
  }, []);

  const getButtonOverlayStyle = useCallback((skin: ButtonSkin) => {
    switch (skin) {
      case 'rounded':
        return {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 28,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderTopColor: 'rgba(255, 255, 255, 0.4)',
          borderLeftColor: 'rgba(255, 255, 255, 0.3)',
          borderBottomWidth: 3,
          borderRightWidth: 3,
          borderBottomColor: 'rgba(0, 0, 0, 0.5)',
          borderRightColor: 'rgba(0, 0, 0, 0.4)',
        };
      case 'sharp':
        return {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 4,
          borderTopWidth: 4,
          borderLeftWidth: 4,
          borderTopColor: 'rgba(255, 255, 255, 0.5)',
          borderLeftColor: 'rgba(255, 255, 255, 0.4)',
          borderBottomWidth: 4,
          borderRightWidth: 4,
          borderBottomColor: 'rgba(0, 0, 0, 0.6)',
          borderRightColor: 'rgba(0, 0, 0, 0.5)',
        };
      case 'soft':
        return {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        };
      case 'outlined':
        return {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 14,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
        };
      case 'minimal':
        return {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        };
      default:
        return null;
    }
  }, []);
  const [productMsgModalVisible, setProductMsgModalVisible] = useState(false);
  const [productMsgInput, setProductMsgInput] = useState('');
  const [productMsgProduct, setProductMsgProduct] = useState<Product | null>(null);
  const [productMsgPrice, setProductMsgPrice] = useState<PriceOption | null>(null);
  const { addToBasket, currentTable, selectTable, isTableSelectionRequired, productViewLayout, productViewMode, saveTableTab, savingTable } = usePOS();
  const { colors, theme, buttonSkin } = useTheme();

  const handleSaveTab = async () => {
    try {
      await saveTableTab();
      router.replace('/login');
    } catch (error) {
      console.error('[Products] Failed to save table:', error);
      setSaveErrorModalVisible(true);
    }
  };

  const scaleAnim = useState(new Animated.Value(0))[0];
  const notificationOpacity = useState(new Animated.Value(0))[0];
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
    loadDisplaySettings();
    loadCustomPriceNames();
  }, []);



  useEffect(() => {
    if (tableModalVisible && tables.length > 0 && !loadingAreaData) {
      // Skip loading table statuses if we just finished loading area data
      // because loadAreaData already set the statuses with locked info
      if (justFinishedLoadingAreaRef.current) {
        console.log('[Products] Skipping loadTableStatuses - just finished loading area data');
        justFinishedLoadingAreaRef.current = false;
        return;
      }
      loadTableStatuses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableModalVisible, tables, loadingAreaData]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadDisplaySettings();
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [loadedGroups, loadedDepartments, loadedProducts, loadedTables, loadedMenuData] = await Promise.all([
        dataSyncService.getStoredGroups(),
        dataSyncService.getStoredDepartments(),
        dataSyncService.getStoredProducts(),
        dataSyncService.getStoredTables(),
        dataSyncService.getStoredMenuData(),
      ]);
      setGroups(loadedGroups);
      setDepartments(loadedDepartments);
      setProducts(loadedProducts);
      setTables(loadedTables);
      setMenuData(loadedMenuData);
      console.log('[Products] Loaded menu data:', Object.keys(loadedMenuData));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDisplaySettings = async () => {
    const settings = await dataSyncService.getProductDisplaySettings();
    setDisplaySettings(settings);
    console.log('[Products] Display settings updated:', settings);
  };

  const loadCustomPriceNames = async () => {
    const names = await dataSyncService.getStoredCustomPriceNames();
    setCustomPriceNames(names);
    console.log('[Products] Custom price names loaded:', names);
  };

  const formatPriceLabel = useCallback((label: string): string => {
    const upperLabel = label.toUpperCase();
    
    if (upperLabel === 'NOT SET' || upperLabel === 'OPEN') {
      return label;
    }
    
    const customMatch = label.match(/^custom\s*(\d+)$/i);
    if (customMatch) {
      const priceNumber = customMatch[1];
      const customPriceData = customPriceNames[priceNumber];
      if (customPriceData?.name) {
        return customPriceData.name.charAt(0).toUpperCase() + customPriceData.name.slice(1).toLowerCase();
      }
    }
    
    return label
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, [customPriceNames]);

  const loadTableStatuses = async () => {
    console.log('[Products] Loading table statuses...');
    const tableIds = tables.map(t => t.id);
    const statuses = await tableDataService.getAllTableStatuses(tableIds);
    setTableStatuses(statuses);
    console.log('[Products] Table statuses loaded:', statuses.size);
  };

  const loadAreaData = async (area: string) => {
    console.time(`[Products] loadAreaData(${area})`);
    setLoadingAreaData(true);
    setDownloadProgress(0);
    const startedAt = Date.now();

    const setProgress = (next: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(next)));
      setDownloadProgress((prev) => (clamped > prev ? clamped : prev));
    };

    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            const elapsedMs = Date.now() - startedAt;
            console.error(`[Products] ${label} timed out after ${ms}ms (elapsed ${elapsedMs}ms)`);
            reject(new Error(`${label} timed out`));
          }, ms);
        });

        return (await Promise.race([promise, timeoutPromise])) as T;
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    };

    try {
      console.log('[Products] Downloading fresh data for area:', area);
      setProgress(2);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      setProgress(6);
      const siteInfo = await withTimeout(dataSyncService.getSiteInfo(), 10000, 'Loading site info');
      if (!siteInfo) {
        console.error('[Products] No site info found');
        showNotification('Cannot sync data: No site linked', true);
        setLoadingAreaData(false);
        setDownloadProgress(0);
        return;
      }

      setProgress(12);
      const manifest = await withTimeout(apiClient.getManifest(siteInfo.siteId), 45000, 'Fetching manifest');
      setProgress(20);
      const areaFiles = manifest.filter(fileInfo => {
        const upper = fileInfo.path.toUpperCase();
        return upper.startsWith(`TABDATA/${area.toUpperCase()}/`);
      });

      console.log(`[Products] Found ${areaFiles.length} files for area ${area}`);
      setProgress(24);

      const allTableFolders = new Set<string>();
      
      try {
        const tableplanPath = `TABDATA/${area}/tableplan.ini`;
        setProgress(28);
        const tableplanContent = await withTimeout(apiClient.getFile(siteInfo.siteId, tableplanPath), 45000, `Downloading ${tableplanPath}`);
        
        const lines = tableplanContent.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
          
          if (trimmed.toUpperCase().startsWith('TABLE:')) {
            const afterTable = trimmed.substring(6);
            const tableName = afterTable.split('=')[0].trim();
            if (tableName) {
              allTableFolders.add(`${area}/${tableName}`);
            }
          }
        }
      } catch {
        manifest.forEach(fileInfo => {
          const upper = fileInfo.path.toUpperCase();
          if (!upper.startsWith('TABDATA/')) return;
          
          const parts = fileInfo.path.slice('TABDATA/'.length).split('/');
          if (parts.length < 3) return;
          
          const fileArea = parts[0];
          const tableName = parts[1];
          
          if (tableName.toLowerCase() === 'area_settings.ini' || tableName.toLowerCase() === 'tableplan.ini') {
            return;
          }
          
          if (fileArea.toUpperCase() === area.toUpperCase()) {
            allTableFolders.add(`${fileArea}/${tableName}`);
          }
        });
      }

      // Build table objects immediately so UI can show them while downloading
      setProgress(34);
      const hashTimestamp = Date.now();
      const tableSet = new Map<string, { area: string; table: string; tableId: string }>();
      const areaTables: Table[] = [];
      
      for (const folderPath of allTableFolders) {
        const parts = folderPath.split('/');
        if (parts.length !== 2) continue;
        
        const areaName = parts[0];
        const tableName = parts[1];
        const key = `${areaName}/${tableName}`;
        
        let hash = 0;
        const hashString = `${areaName}_${tableName}_${hashTimestamp}`;
        for (let i = 0; i < hashString.length; i++) {
          hash = (hash * 31 + hashString.charCodeAt(i)) >>> 0;
        }
        const tableId = `table_${hash}`;
        tableSet.set(key, { area: areaName, table: tableName, tableId });
        
        let colorHash = 0;
        const colorHashString = `${areaName}_${tableName}`;
        for (let i = 0; i < colorHashString.length; i++) {
          colorHash = (colorHash * 31 + colorHashString.charCodeAt(i)) >>> 0;
        }
        const hue = colorHash % 360;

        areaTables.push({
          id: tableId,
          name: tableName,
          tabCode: tableName,
          area: areaName,
          color: `hsl(${hue}, 65%, 50%)`,
        });
      }

      // Update tables state early so skeleton appears
      setTables(prevTables => {
        const otherAreaTables = prevTables.filter(t => t.area !== area);
        return [...otherAreaTables, ...areaTables];
      });

      setProgress(40);

      const downloadFiles = async (
        filesToDownload: { path: string; lastModified?: string }[],
        options?: { batchSize?: number; onProgress?: (completed: number, total: number) => void }
      ): Promise<Map<string, string>> => {
        const defaultBatchSize = Platform.OS === 'android' ? 12 : 50;
        const maxBatchSize = Platform.OS === 'android' ? 20 : 60;
        const batchSize = Math.max(5, Math.min(maxBatchSize, options?.batchSize ?? defaultBatchSize));
        const files: Map<string, string> = new Map();
        let completed = 0;

        for (let i = 0; i < filesToDownload.length; i += batchSize) {
          const batch = filesToDownload.slice(i, i + batchSize);
          const batchPromises = batch.map((fileInfo) =>
            apiClient
              .getFile(siteInfo.siteId, fileInfo.path)
              .then((content) => ({ path: fileInfo.path, content }))
              .catch((e) => {
                console.warn('[Products] Failed to download file (skipping):', fileInfo.path, e);
                return null;
              })
          );

          const results = await Promise.all(batchPromises);
          for (const result of results) {
            if (result) {
              files.set(result.path, result.content);
            }
          }

          completed = Math.min(filesToDownload.length, completed + batch.length);
          options?.onProgress?.(completed, filesToDownload.length);
        }

        return files;
      };

      const isPriorityTableFile = (path: string): boolean => {
        const upper = path.toUpperCase();
        if (!upper.startsWith(`TABDATA/${area.toUpperCase()}/`)) return false;
        if (upper.endsWith('/TABLEDATA.CSV')) return true;
        if (upper.endsWith('/TABLEOPEN.INI')) return true;
        if (upper === `TABDATA/${area.toUpperCase()}/TABLEPLAN.INI`) return true;
        if (upper === `TABDATA/${area.toUpperCase()}/AREA_SETTINGS.INI`) return true;
        return false;
      };

      const priorityFiles = areaFiles.filter((f) => isPriorityTableFile(f.path));
      const secondaryFiles = areaFiles.filter((f) => !isPriorityTableFile(f.path));

      console.log(`[Products] Priority files: ${priorityFiles.length}, secondary files: ${secondaryFiles.length}`);

      if (priorityFiles.length === 0) {
        console.warn('[Products] No priority files found for area - skipping download to avoid stuck refresh UI');
        setProgress(100);

        justFinishedLoadingAreaRef.current = true;
        setLoadingAreaData(false);
        console.timeEnd(`[Products] loadAreaData(${area})`);
        showNotification(`Loaded ${areaTables.length} tables`);
        return;
      }

      setDownloadProgress(0);
      setProgress(40);

      const files = await withTimeout(
        downloadFiles(priorityFiles, {
          batchSize: Platform.OS === 'android' ? 15 : 60,
          onProgress: (completed, total) => {
            const downloadPct = total === 0 ? 100 : Math.round((completed / total) * 100);
            const mapped = 40 + (downloadPct * 45) / 100;
            setProgress(mapped);
          },
        }),
        120000,
        'Downloading priority files'
      );

      setProgress(85);

      // Process priority files in single pass - build statuses and file maps together
      const tableDataMap = new Map<string, string>();
      const lockedTables = new Set<string>();
      const tableFilesMap = new Map<string, Map<string, string>>();

      // Initialize file maps
      for (const key of tableSet.keys()) {
        tableFilesMap.set(key, new Map());
      }

      for (const [path, content] of files) {
        const upper = path.toUpperCase();
        if (!upper.startsWith('TABDATA/')) continue;

        const parts = path.slice('TABDATA/'.length).split('/');
        if (parts.length < 3) continue;

        const areaName = parts[0];
        const table = parts[1];
        const fileName = parts[2];
        const key = `${areaName}/${table}`;
        const tableInfo = tableSet.get(key);

        const tableFiles = tableFilesMap.get(key);
        if (tableFiles) {
          tableFiles.set(fileName, content);
        }

        const fileNameUpper = fileName.toUpperCase();
        if (fileNameUpper === 'TABLEOPEN.INI' && tableInfo) {
          lockedTables.add(tableInfo.tableId);
        } else if (fileNameUpper === 'TABLEDATA.CSV' && tableInfo) {
          tableDataMap.set(tableInfo.tableId, content);
        }
      }

      // Background: download non-critical files and merge into memory (do not block UI)
      if (secondaryFiles.length > 0) {
        setTimeout(() => {
          console.log('[Products] Background downloading secondary area files...');
          downloadFiles(secondaryFiles, { batchSize: 60 })
            .then((secondaryDownloaded) => {
              const secondaryTableFilesMap = new Map<string, Map<string, string>>();

              for (const [path, content] of secondaryDownloaded) {
                const upper = path.toUpperCase();
                if (!upper.startsWith('TABDATA/')) continue;

                const parts = path.slice('TABDATA/'.length).split('/');
                if (parts.length < 3) continue;

                const areaName = parts[0];
                const table = parts[1];
                const fileName = parts[2];
                const key = `${areaName}/${table}`;

                if (!secondaryTableFilesMap.has(key)) {
                  secondaryTableFilesMap.set(key, new Map());
                }

                secondaryTableFilesMap.get(key)!.set(fileName, content);
              }

              for (const [key, mergedFiles] of secondaryTableFilesMap) {
                const parts = key.split('/');
                if (parts.length === 2) {
                  tableDataService.mergeTableFilesInMemory(parts[0], parts[1], mergedFiles);
                }
              }

              console.log('[Products] Background area file download complete');
            })
            .catch((e) => {
              console.warn('[Products] Background secondary download failed:', e);
            });
        }, 50);
      }

      // Build statuses and store files in memory simultaneously
      // Keep this path as light as possible: we compute subtotals after UI becomes interactive.
      const quickStatuses = new Map<string, { hasData: boolean; subtotal: number; isLocked: boolean }>();
      
      for (const table of areaTables) {
        const csvContent = tableDataMap.get(table.id);
        const isLocked = lockedTables.has(table.id);
        const hasData = typeof csvContent === 'string' && csvContent.trim().length > 0;
        quickStatuses.set(table.id, { hasData, subtotal: 0, isLocked });
      }

      // Store all files in memory at once
      for (const [key, tableFiles] of tableFilesMap) {
        const parts = key.split('/');
        if (parts.length === 2) {
          tableDataService.storeTableFilesInMemory(parts[0], parts[1], tableFiles);
        }
      }

      // Update statuses
      setTableStatuses(prevStatuses => {
        const newStatuses = new Map(prevStatuses);
        for (const [tableId, status] of quickStatuses) {
          newStatuses.set(tableId, status);
        }
        return newStatuses;
      });

      setProgress(95);
      justFinishedLoadingAreaRef.current = true;
      setLoadingAreaData(false);
      setProgress(100);
      console.timeEnd(`[Products] loadAreaData(${area})`);
      
      // Background: compute subtotals + save table data locally (fire and forget)
      setTimeout(async () => {
        try {
          console.time(`[Products] loadAreaData(${area}) backgroundWork`);
          const vatRates = await dataSyncService.getStoredVATRates();
          const subtotalUpdates = new Map<string, number>();
          
          for (const [tableId, csvContent] of tableDataMap) {
            const table = areaTables.find(t => t.id === tableId);
            if (!table) continue;
            
            const rows = dataParser.parseCSV(csvContent);
            
            let subtotal = 0;
            if (rows.length > 1) {
              for (let i = 1; i < rows.length; i++) {
                const qty = parseFloat(rows[i][0] || '1');
                const price = parseFloat(rows[i][2] || '0');
                subtotal += qty * price;
              }
            }
            subtotalUpdates.set(tableId, subtotal);
            
            const tableDataRows = rows.slice(1).map(row => ({
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
              tableId: tableId,
            }));
            
            if (tableDataRows.length > 0) {
              const operator: Operator = {
                id: 'system',
                name: tableDataRows[0].addedBy || 'System',
                pin: '',
                active: true,
                isManager: false,
              };
              
              await tableDataService.saveTableDataLocally(
                table,
                tableDataRows.map(dataRow => ({
                  product: {
                    id: `prod_${dataRow.pluFile}`,
                    name: dataRow.productName,
                    departmentId: dataRow.department,
                    groupId: dataRow.group,
                    prices: [{ key: 'PRICE_STANDARD', label: 'standard', price: dataRow.price }],
                    vatCode: dataRow.vatCode,
                    vatPercentage: dataRow.vatPercentage,
                    buttonColor: '#1e293b',
                    fontColor: '#ffffff',
                  },
                  quantity: dataRow.quantity,
                  selectedPrice: { key: 'PRICE_STANDARD', label: 'standard', price: dataRow.price },
                  lineTotal: dataRow.quantity * dataRow.price,
                })),
                operator,
                vatRates
              ).catch(() => {});
            }
          }

          if (subtotalUpdates.size > 0) {
            setTableStatuses(prev => {
              const next = new Map(prev);
              for (const [tableId, subtotal] of subtotalUpdates) {
                const existing = next.get(tableId);
                if (existing) {
                  const effectiveHasData = subtotal > 0.0001;
                  next.set(tableId, { ...existing, hasData: effectiveHasData, subtotal });
                }
              }
              return next;
            });
          }
          console.timeEnd(`[Products] loadAreaData(${area}) backgroundWork`);
        } catch (e) {
          console.warn('[Products] loadAreaData background work failed:', e);
        }
      }, 50);

      showNotification(`Loaded ${areaTables.length} tables`);
    } catch (error) {
      console.error('[Products] Failed to load area data:', error);
      showNotification('Failed to refresh area data', true);
      setLoadingAreaData(false);
    }
  };



  const group = groups.find((g) => g.id === selectedGroup);
  
  const visibleGroups = (() => {
    const filtered = groups.filter(g => !displaySettings.hiddenGroupIds.includes(g.id));
    if (displaySettings.sortOrder === 'custom' && displaySettings.customGroupOrder) {
      return [...filtered].sort((a, b) => {
        const aIndex = displaySettings.customGroupOrder!.indexOf(a.id);
        const bIndex = displaySettings.customGroupOrder!.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    return filtered;
  })();
  
  const visibleDepartments = (() => {
    const filtered = departments.filter(d => !displaySettings.hiddenDepartmentIds.includes(d.id));
    if (displaySettings.sortOrder === 'custom' && displaySettings.customDepartmentOrder) {
      return [...filtered].sort((a, b) => {
        const aIndex = displaySettings.customDepartmentOrder!.indexOf(a.id);
        const bIndex = displaySettings.customDepartmentOrder!.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    return filtered;
  })();
  
  const productCountByDepartmentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const deptNameOrId = p.departmentId;
      const matchingDept = departments.find((d) => d.name === deptNameOrId);
      const deptId = matchingDept?.id;
      if (!deptId) continue;
      map.set(deptId, (map.get(deptId) ?? 0) + 1);
    }
    return map;
  }, [products, departments]);

  const departmentCountByGroupId = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of visibleDepartments) {
      map.set(d.groupId, (map.get(d.groupId) ?? 0) + 1);
    }
    return map;
  }, [visibleDepartments]);

  const filteredDepartments = visibleDepartments.filter((d) => d.groupId === selectedGroup);
  
  const filteredProducts = products.filter((p) => {
    if (p.sellable === false) {
      return false;
    }
    const matchingDept = departments.find(d => d.name === p.departmentId);
    if (!matchingDept || displaySettings.hiddenDepartmentIds.includes(matchingDept.id)) {
      return false;
    }
    return matchingDept?.id === selectedDepartment;
  });
  
  const allVisibleProducts = products.filter((p) => {
    if (p.sellable === false) {
      return false;
    }
    const matchingDept = departments.find(d => d.name === p.departmentId);
    if (!matchingDept || displaySettings.hiddenDepartmentIds.includes(matchingDept.id)) {
      return false;
    }
    const matchingGroup = groups.find(g => g.id === matchingDept.groupId);
    if (!matchingGroup || displaySettings.hiddenGroupIds.includes(matchingGroup.id)) {
      return false;
    }
    return true;
  });
  
  const sortProducts = (products: Product[], departmentId?: string): Product[] => {
    // Check if we have a department-specific sort order
    if (departmentId && displaySettings.departmentSortOrders?.[departmentId]) {
      const sortOrder = displaySettings.departmentSortOrders[departmentId];
      if (sortOrder === 'alphabetical') {
        return [...products].sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortOrder === 'plu') {
        // Sort by PLU (filename)
        return [...products].sort((a, b) => {
          const aFilename = a.filename || '';
          const bFilename = b.filename || '';
          return aFilename.localeCompare(bFilename);
        });
      }
    }
    
    // Fall back to global sort order
    if (displaySettings.sortOrder === 'alphabetical') {
      return [...products].sort((a, b) => a.name.localeCompare(b.name));
    }
    return products;
  };

  const getGroupColor = useCallback((groupId: string) => {
    if (displaySettings.groupColors?.[groupId]) {
      return displaySettings.groupColors[groupId];
    }
    const depts = departments.filter(d => d.groupId === groupId);
    const productColors: string[] = [];
    depts.forEach(dept => {
      const deptProducts = products.filter(p => {
        const matchingDept = departments.find(d => d.name === p.departmentId);
        return matchingDept?.id === dept.id;
      });
      deptProducts.forEach(prod => productColors.push(prod.buttonColor));
    });
    return getMostCommonColor(productColors);
  }, [departments, products, displaySettings.groupColors]);

  const getDepartmentColor = useCallback((deptId: string) => {
    if (displaySettings.departmentColors?.[deptId]) {
      return displaySettings.departmentColors[deptId];
    }
    const deptProducts = products.filter(p => {
      const matchingDept = departments.find(d => d.name === p.departmentId);
      return matchingDept?.id === deptId;
    });
    const productColors = deptProducts.map(p => p.buttonColor);
    return getMostCommonColor(productColors);
  }, [departments, products, displaySettings.departmentColors]);

  const checkAndShowMenu = useCallback((product: Product) => {
    console.log('[Products] ========== checkAndShowMenu START ==========');
    console.log('[Products] Product:', product.name);
    console.log('[Products] Product hotcode:', product.hotcode);
    
    if (!product.hotcode || product.hotcode.toUpperCase() === 'NOT SET') {
      console.log('[Products] No hotcode or hotcode is NOT SET');
      console.log('[Products] ========== checkAndShowMenu END (no hotcode) ==========');
      return false;
    }
    
    const hotcode = product.hotcode.toUpperCase().trim();
    console.log('[Products] Checking for menu hotcode:', hotcode);
    console.log('[Products] Available menu IDs:', Object.keys(menuData));
    
    const menuMatch = hotcode.match(/^MENU\s*(\d+)$/i);
    
    if (!menuMatch) {
      console.log('[Products] Hotcode does not match MENU pattern');
      console.log('[Products] ========== checkAndShowMenu END (no pattern match) ==========');
      return false;
    }
    
    const menuNumber = menuMatch[1].padStart(2, '0');
    const menuId = `MENU${menuNumber}`;
    console.log('[Products] Matched menu number:', menuMatch[1]);
    console.log('[Products] Padded menu ID:', menuId);
    console.log('[Products] Menu exists in menuData?', menuData[menuId] ? 'YES' : 'NO');
    
    if (menuData[menuId]) {
      console.log('[Products] Menu data length:', menuData[menuId].length);
      console.log('[Products] First 3 menu items:', menuData[menuId].slice(0, 3));
    }
    
    if (!menuData[menuId] || menuData[menuId].length === 0) {
      console.log('[Products] Menu not found or empty');
      console.log('[Products] ========== checkAndShowMenu END (menu empty) ==========');
      return false;
    }
    
    console.log('[Products] Opening menu modal NOW');
    console.log('[Products] Setting currentMenuId to:', menuId);
    console.log('[Products] Setting menuModalVisible to: true');
    
    setCurrentMenuId(menuId);
    setMenuStack([menuId]);
    setMenuModalVisible(true);
    
    console.log('[Products] ========== checkAndShowMenu END (menu opened) ==========');
    return true;
  }, [menuData]);

  const handleProductPress = (product: Product) => {
    console.log('[Products] Product pressed:', product.name, 'HOTCODE:', product.hotcode);

    if (isTableSelectionRequired && !currentTable) {
      showNotification('Please select a table first', true);
      setTableModalVisible(true);
      return;
    }

    if (product.prices.length === 0) {
      showNotification('No price set for this product', true);
      return;
    }

    const validPrices = product.prices.filter(p => {
      const label = p.label.toUpperCase();
      return label !== 'NOT SET';
    });

    if (validPrices.length === 0) {
      showNotification('No price set for this product', true);
      return;
    }

    if (validPrices.length === 1) {
      const firstValidPrice = validPrices[0];
      const priceValue = firstValidPrice.label.toUpperCase();

      if (priceValue === 'OPEN') {
        setSelectedProduct(product);
        setSelectedPriceForManual(firstValidPrice);
        setManualPrice('');
        setManualPriceModalVisible(true);
        return;
      }

      // Check if this is a custom price and apply prefix
      let productToAdd = product;
      const customMatch = firstValidPrice.label.match(/^custom\s*(\d+)$/i);
      if (customMatch) {
        const priceNumber = customMatch[1];
        const customPriceData = customPriceNames[priceNumber];
        if (customPriceData?.prefix && customPriceData.prefix.toUpperCase() !== 'NOT SET') {
          productToAdd = {
            ...product,
            name: `${customPriceData.prefix} ${product.name}`
          };
          console.log('[Products] Applied custom price prefix (auto-select):', customPriceData.prefix);
        }
      }

      addToBasket(productToAdd, firstValidPrice, 1);
      showNotification(`Added ${productToAdd.name} to basket`);

      // Check for menu after a short delay to ensure basket state is updated
      setTimeout(() => {
        console.log('[Products] Checking for menu after single price auto-selection');
        const hasMenu = checkAndShowMenu(product);
        if (!hasMenu) {
          console.log('[Products] No menu found for product');
        }
      }, 100);
    } else {
      setSelectedProduct(product);
      setPriceModalVisible(true);
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  };

  const handlePriceSelect = (price: PriceOption) => {
    if (!selectedProduct) return;

    const priceValue = price.label.toUpperCase();

    if (priceValue === 'NOT SET') {
      showNotification('No price set for this option', true);
      return;
    }

    if (priceValue === 'OPEN') {
      setSelectedPriceForManual(price);
      setManualPrice('');
      closePriceModal();
      setManualPriceModalVisible(true);
      return;
    }

    const productToCheck = selectedProduct;
    
    // Check if product requires PRODUCTMSG
    if (productToCheck.hotcode && productToCheck.hotcode.toUpperCase() === 'PRODUCTMSG') {
      setProductMsgProduct(productToCheck);
      setProductMsgPrice(price);
      setProductMsgInput('');
      closePriceModal();
      setProductMsgModalVisible(true);
      return;
    }
    
    // Check if this is a custom price and apply prefix
    let productToAdd = selectedProduct;
    const customMatch = price.label.match(/^custom\s*(\d+)$/i);
    if (customMatch) {
      const priceNumber = customMatch[1];
      const customPriceData = customPriceNames[priceNumber];
      if (customPriceData?.prefix && customPriceData.prefix.toUpperCase() !== 'NOT SET') {
        productToAdd = {
          ...selectedProduct,
          name: `${customPriceData.prefix} ${selectedProduct.name}`
        };
        console.log('[Products] Applied custom price prefix:', customPriceData.prefix);
      }
    }
    
    addToBasket(productToAdd, price, 1);
    showNotification(`Added ${productToAdd.name} to basket`);
    
    closePriceModal();
    
    // Check for menu AFTER price modal animation completes
    setTimeout(() => {
      console.log('[Products] Checking for menu after price modal closed');
      const hasMenu = checkAndShowMenu(productToCheck);
      if (!hasMenu) {
        console.log('[Products] No menu found for product');
      }
    }, 250);
  };

  const handleManualPriceSubmit = () => {
    if (!selectedProduct || !selectedPriceForManual) return;
    
    const price = parseFloat(manualPrice);
    if (isNaN(price) || price < 0) {
      showNotification('Please enter a valid price', true);
      return;
    }

    const productToCheck = selectedProduct;
    const customPrice = price;
    
    // Check if product requires PRODUCTMSG
    if (productToCheck.hotcode && productToCheck.hotcode.toUpperCase() === 'PRODUCTMSG') {
      console.log('[Products] PRODUCTMSG detected after OPEN price entry');
      setProductMsgProduct(productToCheck);
      // Store the custom price in a special way - we'll need to pass it through
      // Create a temporary price option with the custom price
      const customPriceOption: PriceOption = {
        ...selectedPriceForManual,
        price: customPrice,
      };
      setProductMsgPrice(customPriceOption);
      setProductMsgInput('');
      closeManualPriceModal();
      // Add small delay to allow manual price modal to close smoothly
      setTimeout(() => {
        setProductMsgModalVisible(true);
      }, 100);
      return;
    }

    addToBasket(selectedProduct, selectedPriceForManual, 1, price);
    showNotification(`Added ${selectedProduct.name} to basket (£${price.toFixed(2)})`);
    
    closeManualPriceModal();
    
    // Check for menu AFTER manual price modal closes
    setTimeout(() => {
      console.log('[Products] Checking for menu after manual price modal closed');
      const hasMenu = checkAndShowMenu(productToCheck);
      if (!hasMenu) {
        console.log('[Products] No menu found for product');
      }
    }, 250);
  };

  const showNotification = (message: string, isError: boolean = false) => {
    setNotification(message);
  };

  useEffect(() => {
    if (!notification) return;

    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    notificationOpacity.stopAnimation();
    notificationOpacity.setValue(0);

    Animated.timing(notificationOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      Animated.timing(notificationOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setNotification(null);
      });
    }, 2000);

    notificationTimeoutRef.current = timeout;

    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [notification, notificationOpacity]);

  const closePriceModal = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPriceModalVisible(false);
      setSelectedProduct(null);
    });
  };

  const closeManualPriceModal = () => {
    setManualPriceModalVisible(false);
    setSelectedProduct(null);
    setSelectedPriceForManual(null);
    setManualPrice('');
  };

  const handleManualPriceKeyPress = (digit: string) => {
    if (digit === '.' && manualPrice.includes('.')) return;
    if (manualPrice.split('.')[1]?.length >= 2) return;
    setManualPrice(prev => prev + digit);
  };

  const handleManualPriceBackspace = () => {
    setManualPrice(prev => prev.slice(0, -1));
  };

  const handleMenuItemPress = (menuProduct: MenuProduct) => {
    console.log('[Products] ========== MENU ITEM PRESSED ==========');
    console.log('[Products] Product name:', menuProduct.productName);
    console.log('[Products] Product filename:', menuProduct.filename);
    console.log('[Products] Product hotcode:', menuProduct.hotcode);

    // Find product by filename (case-insensitive)
    const menuFilename = menuProduct.filename.toUpperCase();
    console.log('[Products] Searching for filename:', menuFilename);
    
    let product = products.find(p => {
      // Match by the filename field that we added to Product
      return p.filename && p.filename.toUpperCase() === menuFilename;
    });
    
    if (!product) {
      console.warn('[Products] Product not found by filename:', menuProduct.filename);
      console.warn('[Products] Trying fallback search by name...');
      // Fallback: try to find by product name
      product = products.find(p => p.name.toUpperCase() === menuProduct.productName.toUpperCase());
    }
    
    if (!product) {
      console.warn('[Products] Product not found by filename or name:', menuProduct.productName);
      console.warn('[Products] Searched for filename:', menuProduct.filename);
      console.warn('[Products] Available product filenames (first 10):', products.slice(0, 10).map(p => ({ filename: p.filename, name: p.name })));
      console.warn('[Products] Total products:', products.length);
      showNotification(`Product "${menuProduct.productName}" not found`, true);
      return;
    }

    console.log('[Products] Product found!');
    console.log('[Products] Product ID:', product.id);
    console.log('[Products] Product name:', product.name);
    console.log('[Products] Product prices:', product.prices);

    // Check if this product has a menu hotcode to open a nested menu
    if (menuProduct.hotcode && menuProduct.hotcode.toUpperCase() !== 'NOT SET') {
      const hotcode = menuProduct.hotcode.toUpperCase();
      console.log('[Products] Checking hotcode:', hotcode);
      const menuMatch = hotcode.match(/^MENU\s*(\d+)$/i);
      
      if (menuMatch) {
        const menuNumber = menuMatch[1].padStart(2, '0');
        const menuId = `MENU${menuNumber}`;
        console.log('[Products] This is a menu hotcode, opening nested menu:', menuId, 'from hotcode:', hotcode);
        console.log('[Products] Available menus:', Object.keys(menuData));
        
        if (menuData[menuId] && menuData[menuId].length > 0) {
          console.log('[Products] Menu found, adding product to basket first, then navigating to nested menu');
          // Add to basket before navigating to nested menu
          if (product.prices.length > 0) {
            const validPrices = product.prices.filter(p => {
              const label = p.label.toUpperCase();
              return label !== 'NOT SET';
            });
            if (validPrices.length > 0) {
              addToBasket(product, validPrices[0], 1);
              showNotification(`Added ${product.name} to basket`);
            }
          }
          setCurrentMenuId(menuId);
          setMenuStack(prev => [...prev, menuId]);
          return;
        } else {
          console.warn('[Products] Nested menu not found or empty:', menuId);
          showNotification(`Menu ${menuId} not found`, true);
          return;
        }
      } else {
        console.log('[Products] Hotcode does not match MENU pattern:', hotcode);
      }
    } else {
      console.log('[Products] No hotcode or hotcode is NOT SET');
    }

    console.log('[Products] Processing product press (will handle prices, PRODUCTMSG, etc.)');
    closeMenuModal();
    handleProductPress(product);
  };

  const handleMenuBack = () => {
    if (menuStack.length > 1) {
      const newStack = [...menuStack];
      newStack.pop();
      setMenuStack(newStack);
      setCurrentMenuId(newStack[newStack.length - 1]);
    } else {
      closeMenuModal();
    }
  };

  const closeMenuModal = () => {
    setMenuModalVisible(false);
    setCurrentMenuId(null);
    setMenuStack([]);
  };

  const handleProductMsgSubmit = () => {
    if (!productMsgProduct || !productMsgPrice) return;
    
    const msg = productMsgInput.trim();
    if (!msg) {
      showNotification('Please enter a message', true);
      return;
    }

    const productToCheck = productMsgProduct;
    const customName = `${productMsgProduct.name} - ${msg}`;
    
    // Create a modified product with the custom name
    const modifiedProduct = { ...productMsgProduct, name: customName };
    
    // Check if this price option has a custom price (from OPEN price entry)
    // If the price matches the label price, use normal flow, otherwise use custom price
    const hasCustomPrice = productMsgPrice.label.toUpperCase() === 'OPEN';
    
    if (hasCustomPrice) {
      // Use the custom price that was set
      addToBasket(modifiedProduct, productMsgPrice, 1, productMsgPrice.price);
      showNotification(`Added ${customName} to basket (£${productMsgPrice.price.toFixed(2)})`);
    } else {
      addToBasket(modifiedProduct, productMsgPrice, 1);
      showNotification(`Added ${customName} to basket`);
    }
    
    setProductMsgModalVisible(false);
    setProductMsgInput('');
    setProductMsgProduct(null);
    setProductMsgPrice(null);
    
    // Check for menu after PRODUCTMSG submission
    setTimeout(() => {
      console.log('[Products] Checking for menu after PRODUCTMSG');
      const hasMenu = checkAndShowMenu(productToCheck);
      if (!hasMenu) {
        console.log('[Products] No menu found for product');
      }
    }, 250);
  };

  const closeProductMsgModal = () => {
    setProductMsgModalVisible(false);
    setProductMsgInput('');
    setProductMsgProduct(null);
    setProductMsgPrice(null);
  };

  const currentMenu = currentMenuId ? menuData[currentMenuId] : null;
  const hasBackButton = currentMenu ? currentMenu.some(item => {
    const name = item.productName.toUpperCase();
    const filename = item.filename?.toUpperCase() || '';
    return name === 'BACK.PLU' || name === 'BACK' || filename.startsWith('LOAD_');
  }) : false;
  
  const uniqueMenuProducts = currentMenu ? currentMenu.filter((item, index, self) => {
    const name = item.productName.toUpperCase();
    const filename = item.filename?.toUpperCase() || '';
    // Filter out BACK.PLU, BACK, and LOAD_ files
    if (name === 'BACK.PLU' || name === 'BACK' || filename.startsWith('LOAD_')) return false;
    // Filter out size modifiers that don't match the xxx-xxx- pattern
    if (!filename.match(/^\d+-\d+-/)) return false;
    return index === self.findIndex(t => t.productName.toUpperCase() === name);
  }) : [];

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading products...</Text>
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <RefreshCw size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data</Text>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Go to Settings to link your account and sync data</Text>
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          onPress={loadData}
          activeOpacity={0.7}
        >
          <RefreshCw size={16} color={colors.primary} />
          <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      {tables.length > 0 && (
        <View style={[styles.tableBar, { backgroundColor: colors.background }]}>
          <View style={styles.tableBarContent}>
            <TouchableOpacity
              style={[
                styles.tableChip,
                { 
                  backgroundColor: currentTable ? currentTable.color : colors.cardBackground,
                  borderColor: currentTable ? 'transparent' : colors.border,
                },
                getButtonSkinStyle(buttonSkin, currentTable ? currentTable.color : colors.cardBackground),
              ]}
              onPress={() => setTableModalVisible(true)}
              activeOpacity={0.8}
            >
              {getButtonOverlayStyle(buttonSkin) && (
                <View style={getButtonOverlayStyle(buttonSkin) as any} />
              )}
              <Grid3x3 size={16} color={currentTable ? "#fff" : colors.textSecondary} />
              <View style={styles.tableChipContent}>
                <Text style={[styles.tableChipText, { color: currentTable ? '#fff' : colors.textSecondary }]}>
                  {currentTable ? currentTable.name : 'Select Table'}
                </Text>
                {currentTable && (
                  <Text style={styles.tableChipSubtext}>{currentTable.area}</Text>
                )}
              </View>
            </TouchableOpacity>
            {currentTable && (
              <TouchableOpacity
                style={[
                  styles.saveChip,
                  { backgroundColor: colors.primary },
                  getButtonSkinStyle(buttonSkin, colors.primary),
                ]}
                onPress={handleSaveTab}
                activeOpacity={0.8}
              >
                {getButtonOverlayStyle(buttonSkin) && (
                  <View style={getButtonOverlayStyle(buttonSkin) as any} />
                )}
                <Save size={16} color="#fff" />
                <Text style={styles.saveChipText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {productViewMode === 'group-department' && !selectedGroup && (
        <View style={styles.content}>
          <Text style={[styles.heading, { color: colors.text }]}>Select a Category</Text>
          <FlatList
            key={productViewLayout}
            data={visibleGroups}
            keyExtractor={(group) => group.id}
            numColumns={productViewLayout === 'large' ? 1 : productViewLayout === 'compact' ? 3 : 2}
            columnWrapperStyle={productViewLayout === 'large' ? undefined : styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={18}
            windowSize={8}
            maxToRenderPerBatch={24}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            renderItem={({ item: group }) => (
              <TouchableOpacity
                testID={`group-card-${group.id}`}
                style={[
                  styles.card,
                  {
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).groupHeight,
                  },
                  getButtonSkinStyle(buttonSkin, getGroupColor(group.id)),
                ]}
                onPress={() => setSelectedGroup(group.id)}
                activeOpacity={0.8}
              >
                {isLiquidGlassAvailable() ? (
                  <GlassView
                    style={StyleSheet.absoluteFill}
                    glassEffectStyle="regular"
                    tintColor={getGroupColor(group.id)}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: getGroupColor(group.id), opacity: 0.9 }]} />
                )}
                {getButtonOverlayStyle(buttonSkin) && (
                  <View style={getButtonOverlayStyle(buttonSkin) as any} />
                )}
                <Text
                  style={[
                    styles.cardTitle,
                    productViewLayout === 'compact' && styles.cardTitleCompact,
                    productViewLayout === 'large' && styles.cardTitleLarge,
                  ]}
                >
                  {trimName(group.name)}
                </Text>
                <Text style={styles.cardCount}>
                  {departmentCountByGroupId.get(group.id) ?? 0} departments
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {productViewMode === 'group-department' && selectedGroup && !selectedDepartment && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedGroup(null)}
          >
            <ChevronLeft size={24} color="#3b82f6" />
            <Text style={styles.backText}>Back to Categories</Text>
          </TouchableOpacity>

          <Text style={[styles.heading, { color: colors.text }]}>{group?.name ? trimName(group.name) : ''} Departments</Text>
          <FlatList
            key={productViewLayout}
            data={filteredDepartments}
            keyExtractor={(dept) => dept.id}
            numColumns={productViewLayout === 'large' ? 1 : productViewLayout === 'compact' ? 3 : 2}
            columnWrapperStyle={productViewLayout === 'large' ? undefined : styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={18}
            windowSize={8}
            maxToRenderPerBatch={24}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            renderItem={({ item: dept }) => (
              <TouchableOpacity
                testID={`department-card-${dept.id}`}
                style={[
                  styles.card,
                  {
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).groupHeight,
                  },
                  getButtonSkinStyle(buttonSkin, getDepartmentColor(dept.id)),
                ]}
                onPress={() => setSelectedDepartment(dept.id)}
                activeOpacity={0.8}
              >
                {isLiquidGlassAvailable() ? (
                  <GlassView
                    style={StyleSheet.absoluteFill}
                    glassEffectStyle="regular"
                    tintColor={getDepartmentColor(dept.id)}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: getDepartmentColor(dept.id), opacity: 0.9 }]} />
                )}
                {getButtonOverlayStyle(buttonSkin) && (
                  <View style={getButtonOverlayStyle(buttonSkin) as any} />
                )}
                <Text
                  style={[
                    styles.cardTitle,
                    productViewLayout === 'compact' && styles.cardTitleCompact,
                    productViewLayout === 'large' && styles.cardTitleLarge,
                  ]}
                >
                  {trimName(dept.name)}
                </Text>
                <Text style={styles.cardCount}>
                  {productCountByDepartmentId.get(dept.id) ?? 0} items
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {productViewMode === 'all-departments' && !selectedDepartment && (
        <View style={styles.content}>
          <Text style={[styles.heading, { color: colors.text }]}>All Departments</Text>
          <FlatList
            key={productViewLayout}
            data={visibleDepartments}
            keyExtractor={(dept) => dept.id}
            numColumns={productViewLayout === 'large' ? 1 : productViewLayout === 'compact' ? 3 : 2}
            columnWrapperStyle={productViewLayout === 'large' ? undefined : styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={18}
            windowSize={8}
            maxToRenderPerBatch={24}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            renderItem={({ item: dept }) => (
              <TouchableOpacity
                testID={`department-card-${dept.id}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: getDepartmentColor(dept.id),
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).groupHeight,
                  },
                  getButtonSkinStyle(buttonSkin, getDepartmentColor(dept.id)),
                ]}
                onPress={() => setSelectedDepartment(dept.id)}
                activeOpacity={0.8}
              >
                {getButtonOverlayStyle(buttonSkin) && (
                  <View style={getButtonOverlayStyle(buttonSkin) as any} />
                )}
                <Text
                  style={[
                    styles.cardTitle,
                    productViewLayout === 'compact' && styles.cardTitleCompact,
                    productViewLayout === 'large' && styles.cardTitleLarge,
                  ]}
                >
                  {trimName(dept.name)}
                </Text>
                <Text style={styles.cardCount}>
                  {productCountByDepartmentId.get(dept.id) ?? 0} items
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {productViewMode === 'all-items' && (
        <View style={styles.content}>
          <Text style={[styles.heading, { color: colors.text }]}>All Products</Text>
          <FlatList
            key={productViewLayout}
            data={sortProducts(allVisibleProducts, undefined)}
            keyExtractor={(product) => product.id}
            numColumns={productViewLayout === 'large' ? 1 : productViewLayout === 'compact' ? 3 : 2}
            columnWrapperStyle={productViewLayout === 'large' ? undefined : styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={24}
            windowSize={7}
            maxToRenderPerBatch={32}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            renderItem={({ item: product }) => (
              <TouchableOpacity
                testID={`product-card-${product.id}`}
                style={[
                  styles.productCard,
                  {
                    backgroundColor: product.buttonColor,
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).productHeight,
                  },
                  getButtonSkinStyle(buttonSkin, product.buttonColor),
                ]}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.8}
              >
                {getButtonOverlayStyle(buttonSkin) && (
                  <View style={getButtonOverlayStyle(buttonSkin) as any} />
                )}
                <Text
                  style={[
                    productViewLayout === 'compact'
                      ? styles.productNameCompact
                      : productViewLayout === 'large'
                        ? styles.productNameLarge
                        : styles.productName,
                    { color: product.fontColor },
                  ]}
                >
                  {product.name}
                </Text>
                <Text
                  style={[
                    productViewLayout === 'compact'
                      ? styles.productPriceCompact
                      : productViewLayout === 'large'
                        ? styles.productPriceLarge
                        : styles.productPrice,
                    { color: product.fontColor },
                  ]}
                >
                  {(() => {
                    if (product.prices.length === 0) return 'No price';
                    const validPrices = product.prices.filter((p) => {
                      const label = p.label.toUpperCase();
                      return label !== 'OPEN' && label !== 'NOT SET';
                    });
                    if (validPrices.length === 0) {
                      const priceLabel = product.prices[0].label.toUpperCase();
                      if (priceLabel === 'OPEN') return 'Open price';
                      if (priceLabel === 'NOT SET') return 'Not set';
                      return 'See options';
                    }
                    if (validPrices.length === 1) {
                      return `£${validPrices[0].price.toFixed(2)}`;
                    }
                    return `from £${Math.min(...validPrices.map((p) => p.price)).toFixed(2)}`;
                  })()}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {(productViewMode === 'group-department' || productViewMode === 'all-departments') && selectedDepartment && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectedDepartment(null);
            }}
          >
            <ChevronLeft size={24} color="#3b82f6" />
            <Text style={styles.backText}>
              {productViewMode === 'group-department' ? `Back to ${group?.name ? trimName(group.name) : ''} Departments` : 'Back to All Departments'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.heading, { color: colors.text }]}>{(() => {
            const dept = departments.find(d => d.id === selectedDepartment);
            return dept ? trimName(dept.name) : 'Products';
          })()}</Text>
          <FlatList
            key={productViewLayout}
            data={sortProducts(filteredProducts, selectedDepartment || undefined)}
            keyExtractor={(product) => product.id}
            numColumns={productViewLayout === 'large' ? 1 : productViewLayout === 'compact' ? 3 : 2}
            columnWrapperStyle={productViewLayout === 'large' ? undefined : styles.gridRow}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={24}
            windowSize={7}
            maxToRenderPerBatch={32}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            renderItem={({ item: product }) => (
              <TouchableOpacity
                testID={`product-card-${product.id}`}
                style={[
                  styles.productCard,
                  {
                    backgroundColor: product.buttonColor,
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).productHeight,
                  },
                  getButtonSkinStyle(buttonSkin, product.buttonColor),
                ]}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.8}
              >
                {getButtonOverlayStyle(buttonSkin) && (
                  <View style={getButtonOverlayStyle(buttonSkin) as any} />
                )}
                <Text
                  style={[
                    productViewLayout === 'compact'
                      ? styles.productNameCompact
                      : productViewLayout === 'large'
                        ? styles.productNameLarge
                        : styles.productName,
                    { color: product.fontColor },
                  ]}
                >
                  {product.name}
                </Text>
                <Text
                  style={[
                    productViewLayout === 'compact'
                      ? styles.productPriceCompact
                      : productViewLayout === 'large'
                        ? styles.productPriceLarge
                        : styles.productPrice,
                    { color: product.fontColor },
                  ]}
                >
                  {(() => {
                    if (product.prices.length === 0) return 'No price';
                    const validPrices = product.prices.filter((p) => {
                      const label = p.label.toUpperCase();
                      return label !== 'OPEN' && label !== 'NOT SET';
                    });
                    if (validPrices.length === 0) {
                      const priceLabel = product.prices[0].label.toUpperCase();
                      if (priceLabel === 'OPEN') return 'Open price';
                      if (priceLabel === 'NOT SET') return 'Not set';
                      return 'See options';
                    }
                    if (validPrices.length === 1) {
                      return `£${validPrices[0].price.toFixed(2)}`;
                    }
                    return `from £${Math.min(...validPrices.map((p) => p.price)).toFixed(2)}`;
                  })()}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <Modal
        transparent
        visible={priceModalVisible}
        onRequestClose={closePriceModal}
        animationType="none"
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.priceModal,
              { backgroundColor: colors.cardBackground },
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Size</Text>
              <TouchableOpacity onPress={closePriceModal}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalProductName, { color: colors.textSecondary }]}>
              {selectedProduct?.name}
            </Text>

            {selectedProduct?.prices
              .filter(price => {
                const label = price.label.toUpperCase();
                return label !== 'NOT SET';
              })
              .map((price, index) => {
                const priceLabel = price.label.toUpperCase();
                const isOpen = priceLabel === 'OPEN';
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.priceOption,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      isOpen && styles.priceOptionSpecial,
                    ]}
                    onPress={() => handlePriceSelect(price)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.priceLabel, { color: colors.text }]}>{formatPriceLabel(price.label)}</Text>
                    <Text style={[
                      styles.priceAmount,
                      { color: colors.primary },
                      isOpen && styles.priceAmountOpen,
                    ]}>
                      {isOpen ? 'Enter price' : `£${price.price.toFixed(2)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </Animated.View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={manualPriceModalVisible}
        onRequestClose={closeManualPriceModal}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.manualPriceModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Enter Price</Text>
              <TouchableOpacity onPress={closeManualPriceModal}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalProductName, { color: colors.textSecondary }]}>
              {selectedProduct?.name}
            </Text>

            <View style={[styles.priceInputDisplay, { backgroundColor: colors.background, borderColor: colors.primary }]}>
              <Text style={[styles.priceInputText, { color: colors.text }]}>
                £{manualPrice || '0.00'}
              </Text>
            </View>

            <View style={styles.numericKeypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={[styles.numericKeypadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => handleManualPriceKeyPress(String(digit))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.numericKeypadText, { color: colors.text }]}>{digit}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.numericKeypadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={handleManualPriceBackspace}
                activeOpacity={0.7}
              >
                <Text style={[styles.numericKeypadText, { color: colors.text }]}>⌫</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitPriceButton, { backgroundColor: colors.primary }]}
              onPress={handleManualPriceSubmit}
              activeOpacity={0.7}
            >
              <Text style={styles.submitPriceText}>Add to Basket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={tableModalVisible}
        onRequestClose={() => setTableModalVisible(false)}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.tableModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Table</Text>
              <TouchableOpacity onPress={() => setTableModalVisible(false)}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.tableOption,
                { backgroundColor: colors.background, borderColor: colors.border },
                !currentTable && styles.tableOptionSelected,
              ]}
              onPress={() => {
                selectTable(null);
                setTableModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tableOptionText, { color: colors.text }]}>No Table</Text>
              {!currentTable && (
                <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>

            <ScrollView style={styles.tableList}>
              {!selectedArea ? (
                <View style={styles.tableGrid}>
                  {(() => {
                    const areas = Array.from(new Set(tables.map(t => t.area))).sort();
                    const areaColors = [
                      '#8b5cf6',
                      '#06b6d4',
                      '#10b981',
                      '#f59e0b',
                      '#ec4899',
                      '#6366f1',
                      '#14b8a6',
                      '#f97316',
                      '#a855f7',
                      '#3b82f6',
                    ];
                    return areas.map((area, index) => {
                      const areaColor = areaColors[index % areaColors.length];
                      return (
                        <TouchableOpacity
                          key={area}
                          style={[styles.areaCard, { backgroundColor: areaColor }, getButtonSkinStyle(buttonSkin, areaColor)]}
                          onPress={() => {
                            console.log('[Products] Area selected:', area);
                            setSelectedArea(area);
                            setLoadingAreaData(true);
                            setDownloadProgress(0);
                            void loadAreaData(area);
                          }}
                          activeOpacity={0.8}
                        >
                          {isLiquidGlassAvailable() ? (
                            <GlassView
                              style={StyleSheet.absoluteFill}
                              glassEffectStyle="regular"
                              tintColor={areaColor}
                            />
                          ) : (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: areaColor, opacity: 0.9 }]} />
                          )}
                          {getButtonOverlayStyle(buttonSkin) && (
                            <View style={getButtonOverlayStyle(buttonSkin) as any} />
                          )}
                          <Text style={[styles.areaCardTitle, { color: '#ffffff' }]}>{area}</Text>
                          <Text style={[styles.areaCardCount, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                            {tables.filter(t => t.area === area).length} tables
                          </Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              ) : (
                <View>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setSelectedArea(null)}
                  >
                    <ChevronLeft size={20} color={colors.primary} />
                    <Text style={[styles.backText, { color: colors.primary }]}>Back to Areas</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={[styles.areaTitle, { color: colors.text }]}>{selectedArea} Tables</Text>
                  </View>

                  {loadingAreaData && (
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 8 }]}>
                        Refreshing {selectedArea}…
                      </Text>
                      <Text style={[styles.loadingText, { color: colors.primary, marginTop: 6, fontSize: 16, fontWeight: '700' }]}>
                        {downloadProgress}%
                      </Text>
                    </View>
                  )}

                  {loadingAreaData ? (
                    <View style={styles.tableGrid}>
                      {Array.from({ length: Math.max(12, tables.filter(t => t.area === selectedArea).length || 0) }).map((_, idx) => (
                        <View
                          key={`table-skeleton-${idx}`}
                          style={[
                            styles.tableGridItem,
                            {
                              backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                              borderWidth: 1,
                              borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                          testID={`table-skeleton-${idx}`}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.tableGrid}>
                      {tables
                        .filter(table => table.area === selectedArea)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((table) => {
                          const status = tableStatuses.get(table.id);
                          const hasData = status?.hasData || false;
                          const isLocked = status?.isLocked || false;
                          const subtotal = status?.subtotal || 0;
                          const statusColor = isLocked ? '#6b7280' : (hasData ? '#166534' : '#1e3a8a');

                          return (
                            <TouchableOpacity
                              key={table.id}
                              style={[
                                styles.tableGridItem,
                                { backgroundColor: statusColor },
                                getButtonSkinStyle(buttonSkin, statusColor),
                                currentTable?.id === table.id && styles.tableOptionSelected,
                                isLocked && styles.tableLockedItem,
                              ]}
                              onPress={() => {
                                if (isLocked) {
                                  showNotification(`Table ${table.name} is locked by another terminal`, true);
                                  return;
                                }
                                selectTable(table);
                                setTableModalVisible(false);
                                setSelectedArea(null);
                                showNotification(`Selected table: ${table.name} (${selectedArea})`);
                              }}
                              activeOpacity={isLocked ? 1 : 0.8}
                              testID={`table-button-${table.id}`}
                            >
                              {isLiquidGlassAvailable() ? (
                                <GlassView
                                  style={StyleSheet.absoluteFill}
                                  glassEffectStyle="regular"
                                  tintColor={statusColor}
                                />
                              ) : (
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: statusColor, opacity: 0.9 }]} />
                              )}
                              {getButtonOverlayStyle(buttonSkin) && (
                                <View style={getButtonOverlayStyle(buttonSkin) as any} />
                              )}
                              <View style={styles.tableButtonContent}>
                                <Text
                                  style={[
                                    styles.tableNameText,
                                    { color: '#ffffff' },
                                  ]}
                                >
                                  {table.name}
                                </Text>

                                <View
                                  pointerEvents="none"
                                  style={[
                                    styles.tableStatusBadge,
                                    {
                                      backgroundColor: isLocked
                                        ? '#f97316'
                                        : hasData
                                          ? colors.warning
                                          : '#10b981',
                                    },
                                  ]}
                                >
                                  <Text style={styles.tableStatusBadgeText}>
                                    {isLocked ? 'LOCKED' : hasData ? 'IN USE' : 'FREE'}
                                  </Text>
                                </View>

                                {hasData && !isLocked && (
                                  <Text style={[styles.tableSubtotal, { color: 'rgba(255, 255, 255, 0.92)' }]}>
                                    £{subtotal.toFixed(2)}
                                  </Text>
                                )}
                              </View>
                              {currentTable?.id === table.id && (
                                <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={menuModalVisible}
        onRequestClose={closeMenuModal}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.menuModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {currentMenuId ? currentMenuId : 'Menu'}
              </Text>
            </View>

            {menuStack.length > 1 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleMenuBack}
              >
                <ChevronLeft size={20} color={colors.primary} />
                <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
              </TouchableOpacity>
            )}

            <ScrollView
              contentContainerStyle={styles.menuGridContainer}
              showsVerticalScrollIndicator={false}
            >
              {uniqueMenuProducts.map((menuProduct, index) => {
                const matchingProduct = products.find(p => p.name === menuProduct.productName);
                const buttonColor = menuProduct.buttonColor || matchingProduct?.buttonColor || '#1e293b';
                const fontColor = menuProduct.fontColor || matchingProduct?.fontColor || '#ffffff';

                return (
                  <TouchableOpacity
                    key={`${menuProduct.productName}-${index}`}
                    style={[
                      styles.menuProductCard,
                      { backgroundColor: buttonColor },
                      getButtonSkinStyle(buttonSkin, buttonColor),
                    ]}
                    onPress={() => handleMenuItemPress(menuProduct)}
                    activeOpacity={0.8}
                  >
                    {getButtonOverlayStyle(buttonSkin) && (
                      <View style={getButtonOverlayStyle(buttonSkin) as any} />
                    )}
                    <Text style={[styles.productName, { color: fontColor }]}>
                      {menuProduct.productName}
                    </Text>
                    {matchingProduct && (
                      <Text style={[styles.productPrice, { color: fontColor }]}>
                        {(() => {
                          if (matchingProduct.prices.length === 0) return 'No price';
                          if (matchingProduct.prices.length === 1) {
                            const priceLabel = matchingProduct.prices[0].label.toUpperCase();
                            if (priceLabel === 'OPEN') return 'Open price';
                            if (priceLabel === 'NOT SET') return 'Not set';
                            return `£${matchingProduct.prices[0].price.toFixed(2)}`;
                          }
                          const validPrices = matchingProduct.prices.filter(p => {
                            const label = p.label.toUpperCase();
                            return label !== 'OPEN' && label !== 'NOT SET';
                          });
                          if (validPrices.length === 0) return 'See options';
                          return `from £${Math.min(...validPrices.map(p => p.price)).toFixed(2)}`;
                        })()}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}

              {hasBackButton && (
                <TouchableOpacity
                  style={[
                    styles.menuProductCard,
                    styles.menuBackButton,
                    styles.menuBackButtonFullWidth,
                    getButtonSkinStyle(buttonSkin, '#3b82f6'),
                  ]}
                  onPress={handleMenuBack}
                  activeOpacity={0.8}
                >
                  {getButtonOverlayStyle(buttonSkin) && (
                    <View style={getButtonOverlayStyle(buttonSkin) as any} />
                  )}
                  <ChevronLeft size={24} color="#fff" />
                  <Text style={[styles.productName, { color: '#fff' }]}>Back</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={productMsgModalVisible}
        onRequestClose={closeProductMsgModal}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.manualPriceModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Enter Message</Text>
              <TouchableOpacity onPress={closeProductMsgModal}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalProductName, { color: colors.textSecondary }]}>
              {productMsgProduct?.name}
            </Text>

            <TextInput
              style={[styles.messageTextInput, { backgroundColor: colors.background, borderColor: colors.primary, color: colors.text }]}
              value={productMsgInput}
              onChangeText={setProductMsgInput}
              placeholder="Type your message..."
              placeholderTextColor={colors.textTertiary}
              multiline
              autoFocus
            />

            <TouchableOpacity
              style={[styles.submitPriceButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={handleProductMsgSubmit}
              activeOpacity={0.7}
            >
              <Text style={styles.submitPriceText}>Add to Basket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {notification && (
        <Animated.View style={{ opacity: notificationOpacity }}>
          {isLiquidGlassAvailable() ? (
            <GlassView style={styles.notification} glassEffectStyle="regular" tintColor="#1e3a8a">
              <Text style={styles.notificationText}>{notification}</Text>
            </GlassView>
          ) : (
            <View style={[styles.notification, styles.notificationFallback]}>
              <Text style={styles.notificationText}>{notification}</Text>
            </View>
          )}
        </Animated.View>
      )}

      <Modal
        transparent
        visible={savingTable}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.savingModal, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.savingIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Save size={48} color={colors.primary} />
            </View>
            
            <Text style={[styles.savingModalTitle, { color: colors.text }]}>Saving Table...</Text>
            <Text style={[styles.savingModalSubtitle, { color: colors.textSecondary }]}>
              Please wait while we save your table data
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={saveErrorModalVisible}
        onRequestClose={() => setSaveErrorModalVisible(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.savingModal, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.savingIconContainer, { backgroundColor: colors.error + '20' }]}>
              <X size={48} color={colors.error} />
            </View>
            
            <Text style={[styles.savingModalTitle, { color: colors.text }]}>Save Failed</Text>
            <Text style={[styles.savingModalSubtitle, { color: colors.textSecondary }]}>
              The table didn&apos;t save. Please try again.
            </Text>

            <TouchableOpacity
              style={[styles.submitPriceButton, { backgroundColor: colors.primary, marginTop: 24 }]}
              onPress={() => setSaveErrorModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.submitPriceText}>OK</Text>
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
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 110,
  },
  gridRow: {
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cardTitleCompact: {
    fontSize: 14,
  },
  cardTitleLarge: {
    fontSize: 18,
  },
  cardCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  productCard: {
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
  },
  productNameCompact: {
    fontSize: 12,
    fontWeight: '700',
  },
  productNameLarge: {
    fontSize: 18,
    fontWeight: '700',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  productPriceCompact: {
    fontSize: 13,
    fontWeight: '600',
  },
  productPriceLarge: {
    fontSize: 18,
    fontWeight: '600',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  priceModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalProductName: {
    fontSize: 16,
    marginBottom: 20,
  },
  priceOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  priceOptionSpecial: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  priceAmountOpen: {
    color: '#f59e0b',
    fontSize: 14,
  },
  priceAmountNotSet: {
    color: '#ef4444',
    fontSize: 14,
  },
  manualPriceModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  priceInputDisplay: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
  },
  priceInputText: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  numericKeypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  numericKeypadButton: {
    width: '30%',
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  numericKeypadText: {
    fontSize: 24,
    fontWeight: '600',
  },
  submitPriceButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitPriceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  notification: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  notificationFallback: {
    backgroundColor: 'rgba(30, 58, 138, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.6)',
    backdropFilter: 'blur(20px)',
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  tableBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  tableBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tableChipSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  saveChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  tableModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  tableList: {
    marginTop: 16,
  },
  tableOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  tableOptionSelected: {
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  tableOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tableOptionCode: {
    fontSize: 12,
    marginTop: 4,
  },
  selectedIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  areaCard: {
    width: '48%',
    padding: 20,
    minHeight: 80,
    overflow: 'hidden',
  },
  areaCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  areaCardCount: {
    fontSize: 13,
  },
  areaTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  menuModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 600,
    maxHeight: '85%',
  },
  menuGridContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
    paddingBottom: 20,
    paddingTop: 8,
  },
  menuProductCard: {
    width: '47%',
    minHeight: 90,
    padding: 12,
    justifyContent: 'space-between' as const,
    overflow: 'hidden' as const,
  },
  menuBackButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  menuBackButtonFullWidth: {
    width: '100%',
  },
  keyboardContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'nowrap' as const,
    gap: 6,
    marginBottom: 6,
    justifyContent: 'center' as const,
  },
  keyboardButton: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  keyboardButtonWide: {
    flex: 1.5,
  },
  keyboardButtonSpace: {
    flex: 3,
  },
  keyboardButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  messageTextInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  tableInUseIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tableInUseText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#fff',
  },
  tableSubtotal: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
  },
  tableGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
    marginTop: 8,
    justifyContent: 'space-between' as const,
  },
  tableGridItem: {
    width: '47%',
    padding: 12,
    paddingTop: 14,
    paddingBottom: 12,
    minHeight: 96,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center' as const,
    justifyContent: 'flex-start' as const,
  },
  tableLockedItem: {
    opacity: 0.6,
  },
  tableFreeIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tableFreeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#fff',
  },
  tableStatusBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
  },
  tableStatusBadgeText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: 0.4,
  },
  tableButtonContent: {
    width: '100%',
    alignItems: 'center' as const,
    justifyContent: 'flex-start' as const,
    paddingTop: 6,
  },
  tableNameText: {
    fontSize: 16,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    paddingHorizontal: 6,
    width: '100%',
    flexWrap: 'wrap' as const,
    lineHeight: 18,
  },
  savingModal: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center' as const,
  },
  savingIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  savingModalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  savingModalSubtitle: {
    fontSize: 16,
    textAlign: 'center' as const,
  },
});
