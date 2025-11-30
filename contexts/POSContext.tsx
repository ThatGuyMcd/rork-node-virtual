import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { BasketItem, Operator, Product, Tender, VATRate, Table, TableOrder, Transaction, DiscountSettings, GratuitySettings } from '@/types/pos';
import { dataSyncService } from '@/services/dataSync';
import { tableDataService } from '@/services/tableDataService';
import { transactionService } from '@/services/transactionService';

interface POSContextType {
  currentOperator: Operator | null;
  basket: BasketItem[];
  tenders: Tender[];
  vatRates: VATRate[];
  currentTable: Table | null;
  tableOrders: TableOrder[];
  isTableSelectionRequired: boolean;
  productViewLayout: 'compact' | 'standard' | 'large';
  productViewMode: 'group-department' | 'all-departments' | 'all-items';
  isInitialSetupComplete: boolean;
  cardPaymentEnabled: boolean;
  cashPaymentEnabled: boolean;
  cardMachineProvider: 'Teya' | 'None';
  splitPaymentsEnabled: boolean;
  isRefundMode: boolean;
  discountSettings: DiscountSettings;
  basketDiscount: number;
  gratuitySettings: GratuitySettings;
  login: (operator: Operator) => Promise<void>;
  logout: () => Promise<void>;
  addToBasket: (product: Product, selectedPrice: any, quantity?: number, manualPrice?: number) => void;
  updateBasketItemQuantity: (index: number, quantity: number) => void;
  updateBasketItemMessage: (index: number, message: string) => void;
  removeFromBasket: (index: number) => void;
  clearBasket: () => void;
  completeSale: (tenderId: string, splitPayments?: { tenderId: string; tenderName: string; amount: number }[], gratuity?: number) => Promise<void>;
  calculateTotals: () => { subtotal: number; vatBreakdown: Record<string, number>; total: number; discount: number };
  selectTable: (table: Table | null) => void;
  saveTableOrder: () => void;
  saveTableTab: () => Promise<void>;
  loadTableOrder: (tableId: string) => void;
  clearTableOrder: (tableId: string) => void;
  updateTableSelectionRequired: (required: boolean) => Promise<void>;
  updateProductViewLayout: (layout: 'compact' | 'standard' | 'large') => Promise<void>;
  updateProductViewMode: (mode: 'group-department' | 'all-departments' | 'all-items') => Promise<void>;
  completeInitialSetup: () => Promise<void>;
  updateCardPaymentEnabled: (enabled: boolean) => Promise<void>;
  updateCashPaymentEnabled: (enabled: boolean) => Promise<void>;
  updateCardMachineProvider: (provider: 'Teya' | 'None') => Promise<void>;
  updateSplitPaymentsEnabled: (enabled: boolean) => Promise<void>;
  getAvailableTenders: () => Tender[];
  toggleRefundMode: () => boolean;
  updateDiscountSettings: (settings: DiscountSettings) => Promise<void>;
  applyDiscount: (percentage: number) => void;
  updateGratuitySettings: (settings: GratuitySettings) => Promise<void>;
}

export const [POSProvider, usePOS] = createContextHook<POSContextType>(() => {
  const [currentOperator, setCurrentOperator] = useState<Operator | null>(null);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [currentTable, setCurrentTable] = useState<Table | null>(null);
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
  const [isTableSelectionRequired, setIsTableSelectionRequired] = useState(false);
  const [productViewLayout, setProductViewLayout] = useState<'compact' | 'standard' | 'large'>('standard');
  const [productViewMode, setProductViewMode] = useState<'group-department' | 'all-departments' | 'all-items'>('group-department');
  const [isInitialSetupComplete, setIsInitialSetupComplete] = useState(false);
  const [cardPaymentEnabled, setCardPaymentEnabled] = useState(true);
  const [cashPaymentEnabled, setCashPaymentEnabled] = useState(true);
  const [cardMachineProvider, setCardMachineProvider] = useState<'Teya' | 'None'>('None');
  const [splitPaymentsEnabled, setSplitPaymentsEnabled] = useState(false);
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [discountSettings, setDiscountSettings] = useState<DiscountSettings>({ presetPercentages: [5, 10, 15, 20, 25, 50] });
  const [basketDiscount, setBasketDiscount] = useState(0);
  const [gratuitySettings, setGratuitySettings] = useState<GratuitySettings>({ enabled: false, presetPercentages: [10, 15, 20] });

  const [tenders, setTenders] = useState<Tender[]>([
    { id: '1', name: 'Cash', color: '#10b981' },
    { id: '2', name: 'Card', color: '#3b82f6' },
  ]);

  const [vatRates, setVatRates] = useState<VATRate[]>([
    { code: 'S', percentage: 20 },
    { code: 'Z', percentage: 0 },
  ]);

  useEffect(() => {
    AsyncStorage.getItem('currentOperator').then((data) => {
      if (data) {
        setCurrentOperator(JSON.parse(data));
      }
    });
    AsyncStorage.getItem('tableOrders').then((data) => {
      if (data) {
        setTableOrders(JSON.parse(data));
      }
    });
    dataSyncService.getTableSelectionRequired().then((required) => {
      setIsTableSelectionRequired(required);
    });
    dataSyncService.getProductViewLayout().then((layout) => {
      setProductViewLayout(layout);
    });
    dataSyncService.getProductViewMode().then((mode) => {
      setProductViewMode(mode);
    });
    AsyncStorage.getItem('initialSetupComplete').then((data) => {
      setIsInitialSetupComplete(data === 'true');
    });
    AsyncStorage.getItem('cardPaymentEnabled').then((data) => {
      setCardPaymentEnabled(data !== 'false');
    });
    AsyncStorage.getItem('cashPaymentEnabled').then((data) => {
      setCashPaymentEnabled(data !== 'false');
    });
    AsyncStorage.getItem('cardMachineProvider').then((data) => {
      if (data === 'Teya' || data === 'None') {
        setCardMachineProvider(data);
      }
    });
    AsyncStorage.getItem('splitPaymentsEnabled').then((data) => {
      setSplitPaymentsEnabled(data === 'true');
    });
    AsyncStorage.getItem('discountSettings').then((data) => {
      if (data) {
        setDiscountSettings(JSON.parse(data));
      }
    });
    AsyncStorage.getItem('gratuitySettings').then((data) => {
      if (data) {
        setGratuitySettings(JSON.parse(data));
      }
    });
    dataSyncService.getStoredVATRates().then((rates) => {
      if (rates && rates.length > 0) {
        setVatRates(rates);
        console.log('[POS] Loaded VAT rates from storage:', rates);
      }
    });
    dataSyncService.getStoredTenders().then((loadedTenders) => {
      if (loadedTenders && loadedTenders.length > 0) {
        setTenders(loadedTenders);
        console.log('[POS] Loaded tenders from storage:', loadedTenders);
      }
    });
  }, []);

  const login = useCallback(async (operator: Operator) => {
    setCurrentOperator(operator);
    await AsyncStorage.setItem('currentOperator', JSON.stringify(operator));
  }, []);

  const logout = useCallback(async () => {
    if (currentTable && basket.length > 0 && currentOperator) {
      console.log('[POS] Saving table data before logout...');
      await tableDataService.saveTableData(currentTable, basket, currentOperator, vatRates);
    }
    
    setCurrentOperator(null);
    setCurrentTable(null);
    setBasket([]);
    await AsyncStorage.removeItem('currentOperator');
  }, [currentTable, basket, currentOperator, vatRates]);

  const addToBasket = useCallback((product: Product, selectedPrice: any, quantity: number = 1, manualPrice?: number) => {
    const actualPrice = manualPrice !== undefined ? manualPrice : (selectedPrice?.price ?? 0);
    const priceToUse = manualPrice !== undefined 
      ? { ...selectedPrice, price: manualPrice, label: selectedPrice?.label || 'manual' }
      : selectedPrice;

    const quantityToUse = isRefundMode ? -Math.abs(quantity) : quantity;

    const newItem: BasketItem = {
      product,
      quantity: quantityToUse,
      selectedPrice: priceToUse,
      lineTotal: quantityToUse * actualPrice,
    };
    setBasket([...basket, newItem]);
  }, [basket, isRefundMode]);

  const updateBasketItemQuantity = useCallback((index: number, quantity: number) => {
    if (quantity === 0 || (quantity > 0 && basket[index].quantity < 0) || (quantity < 0 && basket[index].quantity > 0)) {
      setBasket(basket.filter((_, i) => i !== index));
      return;
    }
    const newBasket = [...basket];
    newBasket[index].quantity = quantity;
    newBasket[index].lineTotal = quantity * newBasket[index].selectedPrice.price;
    setBasket(newBasket);
  }, [basket]);

  const updateBasketItemMessage = useCallback((index: number, message: string) => {
    const newBasket = [...basket];
    const item = newBasket[index];
    const baseName = item.product.name.split(' - ')[0];
    newBasket[index].product = { 
      ...item.product, 
      name: message ? `${baseName} - ${message}` : baseName 
    };
    setBasket(newBasket);
  }, [basket]);

  const removeFromBasket = useCallback((index: number) => {
    setBasket(basket.filter((_, i) => i !== index));
  }, [basket]);

  const clearBasket = useCallback(() => {
    setBasket([]);
    setBasketDiscount(0);
  }, []);

  const calculateTotals = useCallback(() => {
    const subtotal = basket.reduce((sum, item) => sum + item.lineTotal, 0);
    const discount = (subtotal * basketDiscount) / 100;
    const subtotalAfterDiscount = subtotal - discount;
    const vatBreakdown: Record<string, number> = {};

    basket.forEach((item) => {
      const vatPercentage = item.product.vatPercentage;
      const vatCode = item.product.vatCode;
      
      if (vatPercentage > 0) {
        const lineTotalAfterDiscount = item.lineTotal * (1 - basketDiscount / 100);
        const vatAmount = lineTotalAfterDiscount * (vatPercentage / (100 + vatPercentage));
        vatBreakdown[vatCode] = (vatBreakdown[vatCode] || 0) + vatAmount;
      }
    });

    return { subtotal, discount, vatBreakdown, total: subtotalAfterDiscount };
  }, [basket, basketDiscount]);

  const completeSale = useCallback(async (tenderId: string, splitPayments?: { tenderId: string; tenderName: string; amount: number }[], gratuity?: number) => {
    if (!currentOperator) {
      console.error('[POS] Cannot complete sale: no operator logged in');
      return;
    }

    const tender = tenders.find(t => t.id === tenderId);
    if (!tender) {
      console.error('[POS] Cannot complete sale: invalid tender');
      return;
    }

    const totals = calculateTotals();
    const finalTotal = totals.total + (gratuity || 0);
    
    if (splitPayments && splitPayments.length > 0) {
      const remainingAmount = finalTotal - splitPayments.reduce((sum, p) => sum + p.amount, 0);
      const finalPayment = Math.abs(remainingAmount) >= 0.01 
        ? [{ tenderId: tender.id, tenderName: tender.name, amount: remainingAmount }]
        : [];
      
      const allPayments = [
        ...splitPayments,
        ...finalPayment
      ].filter(payment => Math.abs(payment.amount) >= 0.01);
      
      const isRefund = basket.some(item => item.quantity < 0);
      const transaction: Transaction = {
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        operatorId: currentOperator.id,
        operatorName: currentOperator.name,
        tableId: currentTable?.id,
        tableName: currentTable?.name,
        items: [...basket],
        subtotal: totals.subtotal,
        vatBreakdown: totals.vatBreakdown,
        total: finalTotal,
        tenderId: tender.id,
        tenderName: `Split Payment`,
        paymentMethod: `Split Payment`,
        payments: allPayments,
        isRefund,
        discount: totals.discount > 0 ? totals.discount : undefined,
        gratuity,
      };
      await transactionService.saveTransaction(transaction);
      console.log('[POS] Split payment transaction recorded:', transaction.id, allPayments);
    } else {
      const isRefund = basket.some(item => item.quantity < 0);
      const transaction: Transaction = {
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        operatorId: currentOperator.id,
        operatorName: currentOperator.name,
        tableId: currentTable?.id,
        tableName: currentTable?.name,
        items: [...basket],
        subtotal: totals.subtotal,
        vatBreakdown: totals.vatBreakdown,
        total: finalTotal,
        tenderId: tender.id,
        tenderName: tender.name,
        paymentMethod: tender.name,
        isRefund,
        discount: totals.discount > 0 ? totals.discount : undefined,
        gratuity,
      };
      await transactionService.saveTransaction(transaction);
      console.log('[POS] Transaction recorded:', transaction.id);
    }
    
    if (basket.some(item => item.quantity < 0)) {
      setIsRefundMode(false);
      console.log('[POS] Refund completed, exiting refund mode');
    }
    
    if (currentTable) {
      await tableDataService.clearTableData(currentTable.id);
      console.log('[POS] Cleared table data from CSV for table:', currentTable.id);
    }
    
    setBasketDiscount(0);
    clearBasket();
  }, [clearBasket, currentTable, currentOperator, tenders, basket, calculateTotals]);

  const saveTableOrder = useCallback(() => {
    if (!currentTable || !currentOperator || basket.length === 0) return;

    const updatedOrders = tableOrders.filter(o => o.tableId !== currentTable.id);
    const newOrder: TableOrder = {
      tableId: currentTable.id,
      tableName: currentTable.name,
      items: [...basket],
      createdAt: new Date().toISOString(),
      operatorId: currentOperator.id,
    };
    updatedOrders.push(newOrder);
    setTableOrders(updatedOrders);
    AsyncStorage.setItem('tableOrders', JSON.stringify(updatedOrders));
    console.log('[POS] Saved table order:', newOrder);
  }, [currentTable, currentOperator, basket, tableOrders]);

  const loadTableOrder = useCallback((tableId: string) => {
    const order = tableOrders.find(o => o.tableId === tableId);
    if (order) {
      setBasket(order.items);
      console.log('[POS] Loaded table order:', order);
    } else {
      setBasket([]);
    }
  }, [tableOrders]);

  const selectTable = useCallback(async (table: Table | null) => {
    if (currentTable && basket.length > 0) {
      saveTableOrder();
    }
    setCurrentTable(table);
    if (table) {
      const csvRows = await tableDataService.loadTableData(table.id);
      if (csvRows.length > 0) {
        console.log('[POS] Loading basket from CSV...');
        const products = await dataSyncService.getStoredProducts();
        const loadedBasket: BasketItem[] = [];

        for (const row of csvRows) {
          const baseName = row.productName.split(' - ')[0];
          let product = products.find(p => p.name === baseName || p.name === row.productName);
          
          if (!product && row.pluFile) {
            product = products.find(p => {
              if (!p.filename) return false;
              const productPlu = `${p.groupId}-${p.departmentId}-${p.id.replace('prod_', '').padStart(5, '0')}.PLU`;
              return productPlu === row.pluFile;
            });
          }
          
          if (product) {
            const selectedPrice = product.prices[0] || { key: 'PRICE_STANDARD', label: 'standard', price: row.price };
            const productWithMessage = row.productName.includes(' - ') 
              ? { ...product, name: row.productName }
              : product;
            loadedBasket.push({
              product: productWithMessage,
              quantity: row.quantity,
              selectedPrice: { ...selectedPrice, price: row.price },
              lineTotal: row.quantity * row.price,
            });
          } else {
            console.warn('[POS] Could not find product for row:', row);
          }
        }

        setBasket(loadedBasket);
        console.log(`[POS] Loaded ${loadedBasket.length} items from CSV`);
      } else {
        const order = tableOrders.find(o => o.tableId === table.id);
        if (order) {
          setBasket(order.items);
          console.log('[POS] Loaded table order:', order);
        } else {
          setBasket([]);
        }
      }
    } else {
      setBasket([]);
    }
  }, [currentTable, basket, saveTableOrder, tableOrders]);

  const saveTableTab = useCallback(async () => {
    if (!currentTable || !currentOperator || basket.length === 0) {
      console.log('[POS] Cannot save tab: missing table, operator, or empty basket');
      return;
    }

    try {
      await tableDataService.saveTableData(currentTable, basket, currentOperator, vatRates);
      console.log('[POS] Successfully saved table tab to CSV');
      
      setCurrentTable(null);
      setBasket([]);
      setCurrentOperator(null);
      await AsyncStorage.removeItem('currentOperator');
      console.log('[POS] Deselected table and logged out user');
    } catch (error) {
      console.error('[POS] Error saving table tab:', error);
    }
  }, [currentTable, currentOperator, basket, vatRates]);

  const clearTableOrder = useCallback((tableId: string) => {
    const updatedOrders = tableOrders.filter(o => o.tableId !== tableId);
    setTableOrders(updatedOrders);
    AsyncStorage.setItem('tableOrders', JSON.stringify(updatedOrders));
    if (currentTable?.id === tableId) {
      setBasket([]);
    }
    console.log('[POS] Cleared table order:', tableId);
  }, [tableOrders, currentTable]);

  const updateTableSelectionRequired = useCallback(async (required: boolean) => {
    setIsTableSelectionRequired(required);
    await dataSyncService.setTableSelectionRequired(required);
    console.log('[POS] Table selection required updated:', required);
  }, []);

  const updateProductViewLayout = useCallback(async (layout: 'compact' | 'standard' | 'large') => {
    setProductViewLayout(layout);
    await dataSyncService.setProductViewLayout(layout);
    console.log('[POS] Product view layout updated:', layout);
  }, []);

  const updateProductViewMode = useCallback(async (mode: 'group-department' | 'all-departments' | 'all-items') => {
    setProductViewMode(mode);
    await dataSyncService.setProductViewMode(mode);
    console.log('[POS] Product view mode updated:', mode);
  }, []);

  const completeInitialSetup = useCallback(async () => {
    setIsInitialSetupComplete(true);
    await AsyncStorage.setItem('initialSetupComplete', 'true');
    console.log('[POS] Initial setup completed');
  }, []);

  const updateCardPaymentEnabled = useCallback(async (enabled: boolean) => {
    setCardPaymentEnabled(enabled);
    await AsyncStorage.setItem('cardPaymentEnabled', enabled.toString());
    console.log('[POS] Card payment enabled updated:', enabled);
  }, []);

  const updateCashPaymentEnabled = useCallback(async (enabled: boolean) => {
    setCashPaymentEnabled(enabled);
    await AsyncStorage.setItem('cashPaymentEnabled', enabled.toString());
    console.log('[POS] Cash payment enabled updated:', enabled);
  }, []);

  const updateCardMachineProvider = useCallback(async (provider: 'Teya' | 'None') => {
    setCardMachineProvider(provider);
    await AsyncStorage.setItem('cardMachineProvider', provider);
    console.log('[POS] Card machine provider updated:', provider);
  }, []);

  const updateSplitPaymentsEnabled = useCallback(async (enabled: boolean) => {
    setSplitPaymentsEnabled(enabled);
    await AsyncStorage.setItem('splitPaymentsEnabled', enabled.toString());
    console.log('[POS] Split payments enabled updated:', enabled);
  }, []);

  const getAvailableTenders = useCallback(() => {
    return tenders.filter(tender => {
      if (tender.name === 'Cash') return cashPaymentEnabled;
      if (tender.name === 'Card') return cardPaymentEnabled;
      return true;
    });
  }, [tenders, cashPaymentEnabled, cardPaymentEnabled]);

  const toggleRefundMode = useCallback(() => {
    if (!isRefundMode && basket.length === 0) {
      console.log('[POS] Cannot activate refund mode: basket is empty');
      return false;
    }

    if (!isRefundMode) {
      const updatedBasket = basket.map(item => ({
        ...item,
        quantity: -Math.abs(item.quantity),
        lineTotal: -Math.abs(item.lineTotal),
      }));
      setBasket(updatedBasket);
      setIsRefundMode(true);
      console.log('[POS] Refund mode activated, existing items marked for refund');
      return true;
    } else {
      const updatedBasket = basket.map(item => ({
        ...item,
        quantity: Math.abs(item.quantity),
        lineTotal: Math.abs(item.lineTotal),
      }));
      setBasket(updatedBasket);
      setIsRefundMode(false);
      console.log('[POS] Refund mode deactivated, items unmarked for refund');
      return true;
    }
  }, [isRefundMode, basket]);

  const updateDiscountSettings = useCallback(async (settings: DiscountSettings) => {
    setDiscountSettings(settings);
    await AsyncStorage.setItem('discountSettings', JSON.stringify(settings));
    console.log('[POS] Discount settings updated:', settings);
  }, []);

  const applyDiscount = useCallback((percentage: number) => {
    setBasketDiscount(percentage);
    console.log('[POS] Discount applied:', percentage + '%');
  }, []);

  const updateGratuitySettings = useCallback(async (settings: GratuitySettings) => {
    setGratuitySettings(settings);
    await AsyncStorage.setItem('gratuitySettings', JSON.stringify(settings));
    console.log('[POS] Gratuity settings updated:', settings);
  }, []);

  return {
    currentOperator,
    basket,
    tenders,
    vatRates,
    currentTable,
    tableOrders,
    isTableSelectionRequired,
    productViewLayout,
    productViewMode,
    login,
    logout,
    addToBasket,
    updateBasketItemQuantity,
    updateBasketItemMessage,
    removeFromBasket,
    clearBasket,
    completeSale,
    calculateTotals,
    selectTable,
    saveTableOrder,
    saveTableTab,
    loadTableOrder,
    clearTableOrder,
    updateTableSelectionRequired,
    updateProductViewLayout,
    updateProductViewMode,
    isInitialSetupComplete,
    completeInitialSetup,
    cardPaymentEnabled,
    cashPaymentEnabled,
    cardMachineProvider,
    splitPaymentsEnabled,
    updateCardPaymentEnabled,
    updateCashPaymentEnabled,
    updateCardMachineProvider,
    updateSplitPaymentsEnabled,
    getAvailableTenders,
    isRefundMode,
    toggleRefundMode,
    discountSettings,
    basketDiscount,
    updateDiscountSettings,
    applyDiscount,
    gratuitySettings,
    updateGratuitySettings,
  };
});
