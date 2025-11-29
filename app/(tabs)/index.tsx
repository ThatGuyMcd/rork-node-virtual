import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';

import { ChevronLeft, X, RefreshCw, Grid3x3, Save } from 'lucide-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { usePOS } from '@/contexts/POSContext';
import { useTheme } from '@/contexts/ThemeContext';
import { dataSyncService } from '@/services/dataSync';
import { getMostCommonColor } from '@/utils/colorUtils';
import type { Product, PriceOption, ProductGroup, Department, Table, ProductDisplaySettings, MenuData, MenuProduct } from '@/types/pos';

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
  const { addToBasket, currentTable, selectTable, isTableSelectionRequired, productViewLayout, productViewMode, saveTableTab } = usePOS();
  const { colors, theme } = useTheme();

  const scaleAnim = useState(new Animated.Value(0))[0];
  const notificationOpacity = useState(new Animated.Value(0))[0];
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
    loadDisplaySettings();
  }, []);

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



  const group = groups.find((g) => g.id === selectedGroup);
  
  const visibleGroups = groups.filter(g => !displaySettings.hiddenGroupIds.includes(g.id));
  
  const visibleDepartments = departments.filter(d => !displaySettings.hiddenDepartmentIds.includes(d.id));
  
  const filteredDepartments = visibleDepartments.filter((d) => d.groupId === selectedGroup);
  
  const filteredProducts = products.filter((p) => {
    const matchingDept = departments.find(d => d.name === p.departmentId);
    if (!matchingDept || displaySettings.hiddenDepartmentIds.includes(matchingDept.id)) {
      return false;
    }
    return matchingDept?.id === selectedDepartment;
  });
  
  const allVisibleProducts = products.filter((p) => {
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
  
  const sortProducts = (products: Product[]): Product[] => {
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

      addToBasket(product, firstValidPrice, 1);
      showNotification(`Added ${product.name} to basket`);

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
    
    addToBasket(selectedProduct, price, 1);
    showNotification(`Added ${selectedProduct.name} to basket`);
    
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
    console.log('[Products] Product hotcode:', menuProduct.hotcode);

    const product = products.find(p => p.name === menuProduct.productName);
    if (!product) {
      console.warn('[Products] Product not found in menu:', menuProduct.productName);
      showNotification(`Product "${menuProduct.productName}" not found`, true);
      return;
    }

    console.log('[Products] Product found in products list');
    console.log('[Products] Product prices:', product.prices);

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
          console.log('[Products] Menu found, navigating to it');
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

    console.log('[Products] Adding product to basket');
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

  const currentMenu = currentMenuId ? menuData[currentMenuId] : null;
  const hasBackButton = currentMenu ? currentMenu.some(item => item.productName.toUpperCase() === 'BACK.PLU' || item.productName.toUpperCase() === 'BACK') : false;
  
  const uniqueMenuProducts = currentMenu ? currentMenu.filter((item, index, self) => {
    const name = item.productName.toUpperCase();
    if (name === 'BACK.PLU' || name === 'BACK') return false;
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
        <View style={[styles.tableBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.primary }]}>
          <View style={styles.tableBarRow}>
            <TouchableOpacity
              style={[styles.tableButton, currentTable && { backgroundColor: currentTable.color }]}
              onPress={() => setTableModalVisible(true)}
              activeOpacity={0.7}
            >
              <Grid3x3 size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.tableButtonText}>
                  {currentTable ? currentTable.name : 'No Table Selected'}
                </Text>
                {currentTable && (
                  <Text style={styles.tableButtonCode}>{currentTable.area} • Code: {currentTable.tabCode}</Text>
                )}
              </View>
            </TouchableOpacity>
            {currentTable && (
              <TouchableOpacity
                style={[styles.saveTableButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  await saveTableTab();
                  showNotification('Table saved and logged out');
                }}
                activeOpacity={0.7}
              >
                <Save size={20} color="#fff" />
                <Text style={styles.saveTableButtonText}>Save Tab</Text>
              </TouchableOpacity>
            )}
          </View>
          {!currentTable && (
            <Text style={styles.tableHint}>Tap to select a table</Text>
          )}
        </View>
      )}

      {productViewMode === 'group-department' && !selectedGroup && (
        <View style={styles.content}>
          <Text style={styles.heading}>Select a Category</Text>
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {visibleGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.card,
                  {
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).groupHeight,
                  },
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
                <Text style={styles.cardTitle}>{trimName(group.name)}</Text>
                <Text style={styles.cardCount}>
                  {visibleDepartments.filter((d) => d.groupId === group.id).length} departments
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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

          <Text style={styles.heading}>{group?.name ? trimName(group.name) : ''} Departments</Text>
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {filteredDepartments.map((dept) => (
              <TouchableOpacity
                key={dept.id}
                style={[
                  styles.card,
                  {
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).groupHeight,
                  },
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
                <Text style={styles.cardTitle}>{trimName(dept.name)}</Text>
                <Text style={styles.cardCount}>
                  {products.filter((p) => {
                    const matchingDept = departments.find(d => d.name === p.departmentId);
                    return matchingDept?.id === dept.id;
                  }).length} items
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {productViewMode === 'all-departments' && !selectedDepartment && (
        <View style={styles.content}>
          <Text style={styles.heading}>All Departments</Text>
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {visibleDepartments.map((dept) => (
              <TouchableOpacity
                key={dept.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: getDepartmentColor(dept.id),
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).groupHeight,
                  },
                ]}
                onPress={() => setSelectedDepartment(dept.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.cardTitle}>{trimName(dept.name)}</Text>
                <Text style={styles.cardCount}>
                  {products.filter((p) => {
                    const matchingDept = departments.find(d => d.name === p.departmentId);
                    return matchingDept?.id === dept.id;
                  }).length} items
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {productViewMode === 'all-items' && (
        <View style={styles.content}>
          <Text style={styles.heading}>All Products</Text>
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {sortProducts(allVisibleProducts).map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.productCard,
                  {
                    backgroundColor: product.buttonColor,
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).productHeight,
                  },
                ]}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.productName, { color: product.fontColor }]}
                >
                  {product.name}
                </Text>
                <Text
                  style={[styles.productPrice, { color: product.fontColor }]}
                >
                  {(() => {
                    if (product.prices.length === 0) return 'No price';
                    if (product.prices.length === 1) {
                      const priceLabel = product.prices[0].label.toUpperCase();
                      if (priceLabel === 'OPEN') return 'Open price';
                      if (priceLabel === 'NOT SET') return 'Not set';
                      return `£${product.prices[0].price.toFixed(2)}`;
                    }
                    const validPrices = product.prices.filter(p => {
                      const label = p.label.toUpperCase();
                      return label !== 'OPEN' && label !== 'NOT SET';
                    });
                    if (validPrices.length === 0) return 'See options';
                    return `from £${Math.min(...validPrices.map(p => p.price)).toFixed(2)}`;
                  })()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {(productViewMode === 'group-department' || productViewMode === 'all-departments') && selectedDepartment && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectedDepartment(null);
              if (productViewMode === 'group-department') {
                setSelectedGroup(null);
              }
            }}
          >
            <ChevronLeft size={24} color="#3b82f6" />
            <Text style={styles.backText}>
              {productViewMode === 'group-department' ? `Back to ${group?.name ? trimName(group.name) : ''} Departments` : 'Back to All Departments'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Products</Text>
          <ScrollView
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {sortProducts(filteredProducts).map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.productCard,
                  {
                    backgroundColor: product.buttonColor,
                    width: getCardDimensions(productViewLayout).width,
                    height: getCardDimensions(productViewLayout).productHeight,
                  },
                ]}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.productName, { color: product.fontColor }]}
                >
                  {product.name}
                </Text>
                <Text
                  style={[styles.productPrice, { color: product.fontColor }]}
                >
                  {(() => {
                    if (product.prices.length === 0) return 'No price';
                    if (product.prices.length === 1) {
                      const priceLabel = product.prices[0].label.toUpperCase();
                      if (priceLabel === 'OPEN') return 'Open price';
                      if (priceLabel === 'NOT SET') return 'Not set';
                      return `£${product.prices[0].price.toFixed(2)}`;
                    }
                    const validPrices = product.prices.filter(p => {
                      const label = p.label.toUpperCase();
                      return label !== 'OPEN' && label !== 'NOT SET';
                    });
                    if (validPrices.length === 0) return 'See options';
                    return `from £${Math.min(...validPrices.map(p => p.price)).toFixed(2)}`;
                  })()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
                    <Text style={[styles.priceLabel, { color: colors.text }]}>{price.label}</Text>
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
                (() => {
                  const areas = Array.from(new Set(tables.map(t => t.area))).sort();
                  return areas.map((area) => (
                    <TouchableOpacity
                      key={area}
                      style={[styles.areaCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => setSelectedArea(area)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.areaCardTitle, { color: colors.text }]}>{area}</Text>
                      <Text style={[styles.areaCardCount, { color: colors.textSecondary }]}>
                        {tables.filter(t => t.area === area).length} tables
                      </Text>
                    </TouchableOpacity>
                  ));
                })()
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setSelectedArea(null)}
                  >
                    <ChevronLeft size={20} color={colors.primary} />
                    <Text style={[styles.backText, { color: colors.primary }]}>Back to Areas</Text>
                  </TouchableOpacity>

                  <Text style={[styles.areaTitle, { color: colors.text }]}>{selectedArea} Tables</Text>

                  {tables
                    .filter(table => table.area === selectedArea)
                    .map((table) => (
                      <TouchableOpacity
                        key={table.id}
                        style={[
                          styles.tableOption,
                          { backgroundColor: colors.background, borderColor: colors.border },
                          { borderLeftWidth: 4, borderLeftColor: table.color },
                          currentTable?.id === table.id && styles.tableOptionSelected,
                        ]}
                        onPress={() => {
                          selectTable(table);
                          setTableModalVisible(false);
                          setSelectedArea(null);
                          showNotification(`Selected table: ${table.name} (${selectedArea})`);
                        }}
                        activeOpacity={0.7}
                      >
                        <View>
                          <Text style={[styles.tableOptionText, { color: colors.text }]}>{table.name}</Text>
                          <Text style={[styles.tableOptionCode, { color: colors.textSecondary }]}>Code: {table.tabCode}</Text>
                        </View>
                        {currentTable?.id === table.id && (
                          <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]} />
                        )}
                      </TouchableOpacity>
                    ))}
                </>
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
              <TouchableOpacity onPress={closeMenuModal}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
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
                      {
                        backgroundColor: buttonColor,
                        width: getCardDimensions(productViewLayout).width,
                        height: getCardDimensions(productViewLayout).productHeight,
                      },
                    ]}
                    onPress={() => handleMenuItemPress(menuProduct)}
                    activeOpacity={0.8}
                  >
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
                    {
                      width: getCardDimensions(productViewLayout).width,
                      height: getCardDimensions(productViewLayout).productHeight,
                    },
                  ]}
                  onPress={handleMenuBack}
                  activeOpacity={0.8}
                >
                  <ChevronLeft size={24} color="#fff" />
                  <Text style={[styles.productName, { color: '#fff' }]}>Back</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
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
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
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
    paddingBottom: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
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
  productPrice: {
    fontSize: 16,
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
    bottom: 60,
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
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tableBarRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tableButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  saveTableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveTableButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  tableButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  tableButtonCode: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  tableHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
    fontStyle: 'italic' as const,
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
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
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
    gap: 16,
    paddingBottom: 20,
    paddingTop: 8,
  },
  menuProductCard: {
    borderRadius: 12,
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
});
