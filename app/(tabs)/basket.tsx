import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Modal,
  Animated,
  StatusBar,
  TextInput,
  Alert,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Trash2, Plus, Minus, CreditCard, X, Save, DollarSign, MessageSquare, RotateCcw, Percent, Printer, Split, Check } from 'lucide-react-native';
import { usePOS } from '@/contexts/POSContext';
import { useTheme, type ButtonSkin } from '@/contexts/ThemeContext';
import { printerService } from '@/services/printerService';
import { transactionService } from '@/services/transactionService';
import { tableDataService, SplitBillData } from '@/services/tableDataService';
import { dataSyncService } from '@/services/dataSync';
import type { BasketItem, Transaction } from '@/types/pos';

const getPricePrefix = (productName: string, label: string): string => {
  const lowerLabel = label.toLowerCase();
  
  const customMatch = label.match(/^custom\s*(\d+)$/i);
  if (customMatch) {
    const words = productName.split(' ');
    if (words.length >= 2) {
      const firstWord = words[0];
      const knownPrefixes = ['DBL', 'SML', 'LRG', 'HALF', '2/3PT', 'OPEN', '125ML', '175ML', '250ML'];
      const firstWordUpper = firstWord.toUpperCase();
      
      if (!knownPrefixes.includes(firstWordUpper)) {
        return firstWord.toUpperCase();
      }
    }
  }
  
  if (lowerLabel === 'standard') return '';
  if (lowerLabel === 'double') return 'DBL';
  if (lowerLabel === 'small') return 'SML';
  if (lowerLabel === 'large') return 'LRG';
  if (lowerLabel === 'half') return 'HALF';
  if (lowerLabel === 'schooner') return '2/3PT';
  if (lowerLabel === 'open') return 'OPEN';
  if (lowerLabel === 'not set') return 'NOT SET';
  if (label === '125ml' || label === '175ml' || label === '250ml') return label;
  return label === 'standard' ? '' : label;
};

interface SwipeableBasketItemProps {
  item: BasketItem;
  index: number;
  isRefundItem: boolean;
  prefix: string;
  displayName: string;
  colors: any;
  isManager: boolean;
  onQuantityChange: (index: number, newQuantity: number) => void;
  onMessagePress: (index: number) => void;
  onDelete: (index: number) => void;
  onRefund: (index: number) => void;
  onUndoRefund: (index: number) => void;
  buttonSkin: ButtonSkin;
  getButtonSkinStyle: (skin: ButtonSkin, backgroundColor?: string) => any;
  getButtonOverlayStyle: (skin: ButtonSkin) => any;
}

const SwipeableBasketItem = memo(({
  item,
  index,
  isRefundItem,
  prefix,
  displayName,
  colors,
  isManager,
  onQuantityChange,
  onMessagePress,
  onDelete,
  onRefund,
  onUndoRefund,
  buttonSkin,
  getButtonSkinStyle,
  getButtonOverlayStyle,
}: SwipeableBasketItemProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);
  const deleteButtonWidth = 80;
  const refundButtonWidth = 80;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMovedEnough = Math.abs(gestureState.dx) > 5;
        return isHorizontalSwipe && hasMovedEnough;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
        const hasMovedEnough = Math.abs(gestureState.dx) > 8;
        return isHorizontalSwipe && hasMovedEnough;
      },
      onPanResponderGrant: () => {
        console.log('[SwipeableItem] Pan started, current offset:', currentOffset.current);
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = currentOffset.current + gestureState.dx;
        if (gestureState.dx < 0 || currentOffset.current < 0) {
          const clampedValue = Math.max(Math.min(newValue, 0), -deleteButtonWidth * 1.2);
          translateX.setValue(clampedValue);
        } else if (gestureState.dx > 0 || currentOffset.current > 0) {
          const clampedValue = Math.min(Math.max(newValue, 0), refundButtonWidth * 1.2);
          translateX.setValue(clampedValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const finalValue = currentOffset.current + gestureState.dx;
        
        if (finalValue < -deleteButtonWidth / 3) {
          currentOffset.current = -deleteButtonWidth;
          Animated.spring(translateX, {
            toValue: -deleteButtonWidth,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        } else if (finalValue > refundButtonWidth / 3 && isManager) {
          currentOffset.current = refundButtonWidth;
          Animated.spring(translateX, {
            toValue: refundButtonWidth,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        } else {
          currentOffset.current = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        currentOffset.current = 0;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
      },
    })
  ).current;

  const handleDelete = useCallback(() => {
    Animated.timing(translateX, {
      toValue: -500,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      currentOffset.current = 0;
      onDelete(index);
    });
  }, [index, onDelete, translateX]);

  const handleRefund = useCallback(() => {
    Animated.timing(translateX, {
      toValue: 500,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      currentOffset.current = 0;
      onRefund(index);
    });
  }, [index, onRefund, translateX]);

  const handleUndoRefund = useCallback(() => {
    Animated.timing(translateX, {
      toValue: 500,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      currentOffset.current = 0;
      onUndoRefund(index);
    });
  }, [index, onUndoRefund, translateX]);

  const handleDecrement = useCallback(() => {
    onQuantityChange(index, item.quantity - 1);
  }, [index, item.quantity, onQuantityChange]);

  const handleIncrement = useCallback(() => {
    onQuantityChange(index, item.quantity + 1);
  }, [index, item.quantity, onQuantityChange]);

  const handleMessage = useCallback(() => {
    onMessagePress(index);
  }, [index, onMessagePress]);

  const handleRefundPress = useCallback(() => {
    if (isRefundItem) {
      handleUndoRefund();
    } else {
      handleRefund();
    }
  }, [handleRefund, handleUndoRefund, isRefundItem]);

  return (
    <View style={styles.swipeableContainer}>
      {isManager && (
        <View style={[styles.refundButtonContainer, { width: refundButtonWidth }]}>
          <TouchableOpacity
            style={[
              styles.refundButtonSwipe,
              { backgroundColor: isRefundItem ? colors.success : colors.error },
              getButtonSkinStyle(buttonSkin, isRefundItem ? colors.success : colors.error),
            ]}
            onPress={handleRefundPress}
            activeOpacity={0.8}
            testID={`basket-item-${index}-refund`}
          >
            {getButtonOverlayStyle(buttonSkin) && (
              <View style={getButtonOverlayStyle(buttonSkin) as any} />
            )}
            <RotateCcw size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={[styles.deleteButtonContainer, { width: deleteButtonWidth }]}>
        <TouchableOpacity
          style={[
            styles.deleteButton,
            { backgroundColor: colors.error },
            getButtonSkinStyle(buttonSkin, colors.error),
          ]}
          onPress={handleDelete}
          activeOpacity={0.8}
          testID={`basket-item-${index}-delete`}
        >
          {getButtonOverlayStyle(buttonSkin) && (
            <View style={getButtonOverlayStyle(buttonSkin) as any} />
          )}
          <Trash2 size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.basketItem,
          {
            backgroundColor: colors.cardBackground,
            borderColor: isRefundItem ? colors.error : colors.border,
            borderWidth: isRefundItem ? 2 : 1,
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={styles.itemTopRow}>
          <View style={styles.itemNameContainer}>
            {prefix !== '' && (
              <Text style={[styles.itemPrefix, { color: colors.primary }]}>{prefix} </Text>
            )}
            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {isRefundItem && (
              <View style={[styles.refundBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.refundBadgeText}>REFUND</Text>
              </View>
            )}
          </View>
          <View style={styles.quantitySection}>
            <View style={[styles.quantityControl, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={handleDecrement}
                activeOpacity={0.7}
                testID={`basket-item-${index}-decrement`}
              >
                <Minus size={14} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.quantityNumber, { color: colors.text }]}>{Math.abs(item.quantity)}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={handleIncrement}
                activeOpacity={0.7}
                testID={`basket-item-${index}-increment`}
              >
                <Plus size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.itemBottomRow}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleMessage}
            activeOpacity={0.7}
            testID={`basket-item-${index}-message`}
          >
            <MessageSquare size={16} color={colors.primary} />
          </TouchableOpacity>

          <Text style={[styles.lineTotal, { color: isRefundItem ? colors.error : colors.primary }]}>
            {isRefundItem ? '-' : ''}£{Math.abs(item.lineTotal).toFixed(2)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
});

SwipeableBasketItem.displayName = 'SwipeableBasketItem';

export default function BasketScreen() {
  const {
    basket,
    currentTable,
    currentOperator,
    updateBasketItemQuantity,
    updateBasketItemMessage,
    refundBasketItem,
    removeFromBasket,
    clearBasket,
    completeSale,
    saveTableTab,
    getAvailableTenders,
    splitPaymentsEnabled,
    isRefundMode,
    toggleRefundMode,
    refundButtonEnabled,
    discountSettings,
    basketDiscount,
    applyDiscount,
    gratuitySettings,
    selectTable,
    changeAllowed,
    cashbackAllowed,
    savingTable,
    processingTransaction,
  } = usePOS();
  const { colors, theme, buttonSkin } = useTheme();

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

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [splitPaymentAmount, setSplitPaymentAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState<{ tenderId: string; tenderName: string; amount: number }[]>([]);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [gratuityModalVisible, setGratuityModalVisible] = useState(false);
  const [gratuityAmount, setGratuityAmount] = useState<number>(0);
  const [customGratuityInput, setCustomGratuityInput] = useState('');
  const [receiptPrintModalVisible, setReceiptPrintModalVisible] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [screenReceiptModalVisible, setScreenReceiptModalVisible] = useState(false);
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [changeAmount, setChangeAmount] = useState(0);
  const [pendingTenderId, setPendingTenderId] = useState<string | null>(null);
  const [saveErrorModalVisible, setSaveErrorModalVisible] = useState(false);
  const [splitBillModalVisible, setSplitBillModalVisible] = useState(false);
  const [splitBills, setSplitBills] = useState<BasketItem[][]>([[], [], [], []]);
  const [activeSplitBillIndex, setActiveSplitBillIndex] = useState(0);
  const [selectedItemsForMove, setSelectedItemsForMove] = useState<Set<number>>(new Set());
  const [splitBillSourceIndex, setSplitBillSourceIndex] = useState<number>(-1);
  const [payingSplitBillIndex, setPayingSplitBillIndex] = useState<number | null>(null);
  const [payingSplitBillItems, setPayingSplitBillItems] = useState<BasketItem[]>([]);
  const [completedSplitBillPayment, setCompletedSplitBillPayment] = useState(false);
  const scaleAnim = useState(new Animated.Value(0))[0];
  const splitButtonPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const availableTenders = getAvailableTenders();
  const router = useRouter();

  const splitButtonPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        splitButtonPosition.setOffset({
          x: (splitButtonPosition.x as any)._value,
          y: (splitButtonPosition.y as any)._value,
        });
        splitButtonPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: splitButtonPosition.x, dy: splitButtonPosition.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        splitButtonPosition.flattenOffset();
      },
    })
  ).current;

  useEffect(() => {
    const checkPrinterConnection = async () => {
      await printerService.loadSettings();
      const connected = printerService.isConnected();
      setPrinterConnected(connected);
      console.log('[Basket] Printer connected:', connected);
    };
    checkPrinterConnection();
  }, []);

  const basketForCalculation = useMemo(() => {
    if (payingSplitBillIndex !== null && payingSplitBillItems.length > 0) {
      return payingSplitBillItems;
    }
    return basket;
  }, [payingSplitBillIndex, payingSplitBillItems, basket]);

  const { subtotal, discount, vatBreakdown, total } = useMemo(() => {
    const items = basketForCalculation;
    let subtotal = 0;
    const vatBreakdown: Record<string, number> = {};
    
    items.forEach(item => {
      subtotal += item.lineTotal;
      const vatCode = item.product.vatCode || 'S';
      const vatPercentage = item.product.vatPercentage || 0;
      const vatAmount = (item.lineTotal * vatPercentage) / (100 + vatPercentage);
      
      if (!vatBreakdown[vatCode]) {
        vatBreakdown[vatCode] = 0;
      }
      vatBreakdown[vatCode] += vatAmount;
    });
    
    const discountAmount = (subtotal * basketDiscount) / 100;
    const total = subtotal - discountAmount;
    
    return {
      subtotal,
      discount: discountAmount,
      vatBreakdown,
      total
    };
  }, [basketForCalculation, basketDiscount]);
  const paidAmount = useMemo(() => splitPayments.reduce((sum, payment) => sum + payment.amount, 0), [splitPayments]);
  const totalWithGratuity = useMemo(() => total + gratuityAmount, [total, gratuityAmount]);
  const remainingTotal = useMemo(() => totalWithGratuity - paidAmount, [totalWithGratuity, paidAmount]);

  const openPaymentModal = useCallback(() => {
    setPaymentModalVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [scaleAnim]);

  const handleGratuitySelection = (percentage: number) => {
    const gratuityValue = (total * percentage) / 100;
    setGratuityAmount(gratuityValue);
    setGratuityModalVisible(false);
    
    if (payingSplitBillIndex !== null) {
      setTimeout(() => {
        openPaymentModal();
      }, 300);
    }
  };

  const handleCustomGratuity = () => {
    const amount = parseFloat(customGratuityInput);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    setGratuityAmount(amount);
    setCustomGratuityInput('');
    setGratuityModalVisible(false);
    
    if (payingSplitBillIndex !== null) {
      setTimeout(() => {
        openPaymentModal();
      }, 300);
    }
  };

  const handleSkipGratuity = () => {
    setGratuityAmount(0);
    setGratuityModalVisible(false);
    
    if (payingSplitBillIndex !== null) {
      setTimeout(() => {
        openPaymentModal();
      }, 300);
    }
  };

  const closePaymentModal = (callback?: () => void) => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPaymentModalVisible(false);
      if (callback) {
        setTimeout(callback, 100);
      }
    });
  };

  const handlePayment = async (tenderId: string) => {
    const tender = availableTenders.find(t => t.id === tenderId);
    if (!tender) return;

    if (splitPaymentsEnabled && splitPaymentAmount && parseFloat(splitPaymentAmount) > 0) {
      const amount = parseFloat(splitPaymentAmount);
      const updatedSplitPayments = [...splitPayments, {
        tenderId: tender.id,
        tenderName: tender.name,
        amount: amount,
      }];
      
      const newRemaining = remainingTotal - amount;
      
      if (Math.abs(newRemaining) < 0.01) {
        closePaymentModal(async () => {
          if (payingSplitBillIndex !== null) {
            console.log('[Basket] Completing split bill payment (multi-tender) for bill:', payingSplitBillIndex === -1 ? 'Main' : payingSplitBillIndex + 1);
            
            const originalBasket = [...basket];
            basket.length = 0;
            basket.push(...payingSplitBillItems);
            
            await completeSale(tenderId, updatedSplitPayments, gratuityAmount > 0 ? gratuityAmount : undefined, 0, payingSplitBillIndex);
            
            basket.length = 0;
            basket.push(...originalBasket);
            
            if (payingSplitBillIndex >= 0) {
              const newSplitBills = [...splitBills];
              newSplitBills[payingSplitBillIndex] = [];
              setSplitBills(newSplitBills);
            }
            
            setCompletedSplitBillPayment(true);
            setPayingSplitBillIndex(null);
            setPayingSplitBillItems([]);
          } else {
            await completeSale(tenderId, updatedSplitPayments, gratuityAmount > 0 ? gratuityAmount : undefined, 0, payingSplitBillIndex);
          }
          
          setSplitPayments([]);
          setSplitPaymentAmount('');
          setGratuityAmount(0);
          const allTransactions = await transactionService.getAllTransactions();
          const lastTxn = allTransactions[allTransactions.length - 1];
          setLastTransaction(lastTxn || null);
          console.log('[Basket] Showing receipt print modal after split payment completion');
          setReceiptPrintModalVisible(true);
        });
        return;
      }
      
      if (amount > remainingTotal) {
        const change = amount - remainingTotal;
        
        if (!changeAllowed) {
          Alert.alert('Change Not Allowed', 'Please enter the exact amount or less.');
          return;
        }
        
        const tender = availableTenders.find(t => t.id === tenderId);
        const isCash = tender?.name === 'Cash';
        
        if (!isCash && !cashbackAllowed) {
          Alert.alert('Cashback Not Allowed', 'Change can only be given for cash payments. Please enter the exact amount or less.');
          return;
        }
        
        setChangeAmount(change);
        setPendingTenderId(tenderId);
        closePaymentModal();
        setTimeout(() => {
          setChangeModalVisible(true);
        }, 300);
        return;
      }
      
      if (amount < remainingTotal) {
        setSplitPayments(updatedSplitPayments);
        setSplitPaymentAmount('');
        closePaymentModal();
        return;
      }
    }
    closePaymentModal(async () => {
      if (payingSplitBillIndex !== null) {
        console.log('[Basket] Completing split bill payment for bill:', payingSplitBillIndex === -1 ? 'Main' : payingSplitBillIndex + 1);
        
        const originalBasket = [...basket];
        basket.length = 0;
        basket.push(...payingSplitBillItems);
        
        await completeSale(tenderId, splitPayments, gratuityAmount > 0 ? gratuityAmount : undefined, 0, payingSplitBillIndex);
        
        basket.length = 0;
        basket.push(...originalBasket);
        
        if (payingSplitBillIndex >= 0) {
          const newSplitBills = [...splitBills];
          newSplitBills[payingSplitBillIndex] = [];
          setSplitBills(newSplitBills);
        }
        
        setCompletedSplitBillPayment(true);
        setPayingSplitBillIndex(null);
        setPayingSplitBillItems([]);
      } else {
        await completeSale(tenderId, splitPayments, gratuityAmount > 0 ? gratuityAmount : undefined, 0, payingSplitBillIndex);
      }
      
      setSplitPayments([]);
      setSplitPaymentAmount('');
      setGratuityAmount(0);
      const allTransactions = await transactionService.getAllTransactions();
      const lastTxn = allTransactions[allTransactions.length - 1];
      setLastTransaction(lastTxn || null);
      console.log('[Basket] Showing receipt print modal after payment completion');
      setReceiptPrintModalVisible(true);
    });
  };

  const handleKeypadPress = (value: string) => {
    if (value === 'C') {
      setSplitPaymentAmount('');
    } else if (value === '←') {
      setSplitPaymentAmount(splitPaymentAmount.slice(0, -1));
    } else if (value === '.') {
      if (!splitPaymentAmount.includes('.')) {
        setSplitPaymentAmount(splitPaymentAmount + value);
      }
    } else {
      if (splitPaymentAmount.length < 10) {
        setSplitPaymentAmount(splitPaymentAmount + value);
      }
    }
  };

  const handleSaveTab = async () => {
    try {
      await saveTableTab();
      router.replace('/login');
    } catch (error) {
      console.error('[Basket] Failed to save table:', error);
      setSaveErrorModalVisible(true);
    }
  };

  const openSplitBillModal = useCallback(() => {
    setSplitBills([[], [], [], []]);
    setActiveSplitBillIndex(0);
    setSelectedItemsForMove(new Set());
    setSplitBillSourceIndex(-1);
    setSplitBillModalVisible(true);
    console.log('[Basket] Opened split bill modal');
  }, []);

  const closeSplitBillModal = useCallback(() => {
    setSplitBillModalVisible(false);
    setSelectedItemsForMove(new Set());
    setSplitBillSourceIndex(-1);
    console.log('[Basket] Closed split bill modal');
  }, []);

  const cancelSplitBillPayment = useCallback(() => {
    setPayingSplitBillIndex(null);
    setPayingSplitBillItems([]);
    setSplitPayments([]);
    setSplitPaymentAmount('');
    setGratuityAmount(0);
    setSplitBillModalVisible(true);
    console.log('[Basket] Cancelled split bill payment');
  }, []);

  const getMainBasketForSplit = useCallback(() => {
    const movedItemIndices = new Set<number>();
    splitBills.forEach(bill => {
      bill.forEach(item => {
        const originalIndex = basket.findIndex((b, idx) => 
          !movedItemIndices.has(idx) &&
          b.product.id === item.product.id && 
          b.selectedPrice.key === item.selectedPrice.key
        );
        if (originalIndex >= 0) {
          movedItemIndices.add(originalIndex);
        }
      });
    });
    return basket.filter((_, idx) => !movedItemIndices.has(idx));
  }, [basket, splitBills]);

  const toggleItemSelection = useCallback((itemIndex: number, sourceIndex: number) => {
    if (splitBillSourceIndex !== -1 && splitBillSourceIndex !== sourceIndex) {
      setSelectedItemsForMove(new Set([itemIndex]));
      setSplitBillSourceIndex(sourceIndex);
    } else {
      const newSelected = new Set(selectedItemsForMove);
      if (newSelected.has(itemIndex)) {
        newSelected.delete(itemIndex);
      } else {
        newSelected.add(itemIndex);
      }
      setSelectedItemsForMove(newSelected);
      setSplitBillSourceIndex(sourceIndex);
    }
  }, [selectedItemsForMove, splitBillSourceIndex]);

  const moveSelectedItems = useCallback((targetBillIndex: number) => {
    if (selectedItemsForMove.size === 0 || splitBillSourceIndex === targetBillIndex) return;
    
    const sourceItems = splitBillSourceIndex === -1 ? getMainBasketForSplit() : splitBills[splitBillSourceIndex];
    const itemsToMove = Array.from(selectedItemsForMove).map(idx => sourceItems[idx]).filter(Boolean);
    
    if (itemsToMove.length === 0) return;
    
    const newSplitBills = [...splitBills];
    
    if (splitBillSourceIndex >= 0) {
      newSplitBills[splitBillSourceIndex] = sourceItems.filter((_, idx) => !selectedItemsForMove.has(idx));
    }
    
    if (targetBillIndex === -1) {
      if (splitBillSourceIndex >= 0) {
        newSplitBills[splitBillSourceIndex] = sourceItems.filter((_, idx) => !selectedItemsForMove.has(idx));
      }
    } else {
      newSplitBills[targetBillIndex] = [...newSplitBills[targetBillIndex], ...itemsToMove];
    }
    
    setSplitBills(newSplitBills);
    setSelectedItemsForMove(new Set());
    setSplitBillSourceIndex(-1);
    console.log('[Basket] Moved items to bill', targetBillIndex === -1 ? 'Main' : targetBillIndex + 1);
  }, [selectedItemsForMove, splitBillSourceIndex, splitBills, getMainBasketForSplit]);

  const calculateBillTotal = useCallback((items: BasketItem[]) => {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  }, []);

  const handleSaveSplitBills = useCallback(async () => {
    if (!currentTable || !currentOperator) {
      Alert.alert('Error', 'No table selected');
      return;
    }
    
    const mainBasket = getMainBasketForSplit();
    const splitBillData: SplitBillData = {
      mainBasket,
      splitBills: splitBills
    };
    
    try {
      const vatRatesData = await dataSyncService.getStoredVATRates();
      await tableDataService.saveSplitBillsToTable(
        currentTable,
        splitBillData,
        currentOperator,
        vatRatesData
      );
      
      Alert.alert('Success', 'Split bills saved to table');
      closeSplitBillModal();
      router.replace('/login');
    } catch (error) {
      console.error('[Basket] Failed to save split bills:', error);
      Alert.alert('Error', 'Failed to save split bills');
    }
  }, [currentTable, currentOperator, splitBills, getMainBasketForSplit, closeSplitBillModal, router]);

  const handlePaySplitBill = useCallback((billIndex: number) => {
    const billItems = billIndex === -1 ? getMainBasketForSplit() : splitBills[billIndex];
    if (billItems.length === 0) {
      Alert.alert('Empty Bill', 'This bill has no items to pay');
      return;
    }
    
    console.log('[Basket] Starting payment for split bill:', billIndex === -1 ? 'Main' : billIndex + 1, 'with', billItems.length, 'items');
    
    setPayingSplitBillIndex(billIndex);
    setPayingSplitBillItems(billItems);
    
    setSplitPayments([]);
    setSplitPaymentAmount('');
    setGratuityAmount(0);
    
    closeSplitBillModal();
    
    setTimeout(() => {
      if (gratuitySettings.enabled && !isRefundMode) {
        setGratuityModalVisible(true);
      } else {
        openPaymentModal();
      }
    }, 300);
  }, [splitBills, getMainBasketForSplit, gratuitySettings.enabled, isRefundMode, openPaymentModal, closeSplitBillModal]);

  const openMessageModal = useCallback((index: number) => {
    setCurrentMessageIndex(index);
    const item = basket[index];
    const existingMessage = item?.product.name.includes(' - ')
      ? item.product.name.split(' - ').slice(1).join(' - ')
      : '';
    setMessageInput(existingMessage);
    setMessageModalVisible(true);
  }, [basket]);

  const closeMessageModal = () => {
    setMessageModalVisible(false);
    setCurrentMessageIndex(null);
    setMessageInput('');
  };

  const handleMessageSubmit = () => {
    if (currentMessageIndex !== null) {
      updateBasketItemMessage(currentMessageIndex, messageInput.trim());
      closeMessageModal();
    }
  };

  const handleDiscountSelect = (percentage: number) => {
    applyDiscount(percentage);
    setDiscountModalVisible(false);
  };

  const handleRemoveDiscount = () => {
    applyDiscount(0);
    setDiscountModalVisible(false);
  };



  const handleReceiptDismiss = useCallback(() => {
    if (completedSplitBillPayment) {
      console.log('[Basket] Split bill payment completed, returning to split bill modal');
      setCompletedSplitBillPayment(false);
      setTimeout(() => {
        setSplitBillModalVisible(true);
      }, 100);
    } else if (currentTable) {
      selectTable(null);
      console.log('[Basket] Table deselected after receipt');
    }
  }, [completedSplitBillPayment, currentTable, selectTable]);

  const handlePrintReceipt = async () => {
    if (!lastTransaction) {
      Alert.alert('Error', 'No transaction found to print');
      setReceiptPrintModalVisible(false);
      return;
    }

    try {
      await printerService.printReceipt(lastTransaction);
      setReceiptPrintModalVisible(false);
      Alert.alert('Success', 'Receipt printed successfully');
      handleReceiptDismiss();
    } catch (error) {
      console.error('[Basket] Failed to print receipt:', error);
      setReceiptPrintModalVisible(false);
      Alert.alert('Print Error', 'Failed to print receipt. Please check printer connection.');
    }
  };

  const handleSkipReceipt = () => {
    setReceiptPrintModalVisible(false);
    handleReceiptDismiss();
  };

  const handlePrintToScreen = () => {
    setReceiptPrintModalVisible(false);
    setTimeout(() => {
      setScreenReceiptModalVisible(true);
    }, 100);
  };

  const handleCloseScreenReceipt = () => {
    setScreenReceiptModalVisible(false);
    handleReceiptDismiss();
  };

  const handleRefundItem = useCallback((index: number) => {
    refundBasketItem(index);
  }, [refundBasketItem]);

  const handleUndoRefund = useCallback((index: number) => {
    refundBasketItem(index);
  }, [refundBasketItem]);

  const handleConfirmChange = async () => {
    if (!pendingTenderId) return;

    setChangeModalVisible(false);
    const updatedSplitPayments = [...splitPayments, {
      tenderId: pendingTenderId,
      tenderName: availableTenders.find(t => t.id === pendingTenderId)?.name || '',
      amount: remainingTotal,
    }];
    
    if (payingSplitBillIndex !== null) {
      console.log('[Basket] Completing split bill payment with change for bill:', payingSplitBillIndex === -1 ? 'Main' : payingSplitBillIndex + 1);
      
      const originalBasket = [...basket];
      basket.length = 0;
      basket.push(...payingSplitBillItems);
      
      await completeSale(pendingTenderId, updatedSplitPayments, gratuityAmount > 0 ? gratuityAmount : undefined, changeAmount, payingSplitBillIndex);
      
      basket.length = 0;
      basket.push(...originalBasket);
      
      if (payingSplitBillIndex >= 0) {
        const newSplitBills = [...splitBills];
        newSplitBills[payingSplitBillIndex] = [];
        setSplitBills(newSplitBills);
      }
      
      setCompletedSplitBillPayment(true);
      setPayingSplitBillIndex(null);
      setPayingSplitBillItems([]);
    } else {
      await completeSale(pendingTenderId, updatedSplitPayments, gratuityAmount > 0 ? gratuityAmount : undefined, changeAmount, payingSplitBillIndex);
    }
    
    setSplitPayments([]);
    setSplitPaymentAmount('');
    setGratuityAmount(0);
    setPendingTenderId(null);
    setChangeAmount(0);
    
    const allTransactions = await transactionService.getAllTransactions();
    const lastTxn = allTransactions[allTransactions.length - 1];
    console.log('[Basket] Last transaction after change:', lastTxn?.id, 'cashback:', lastTxn?.cashback);
    setLastTransaction(lastTxn || null);
    console.log('[Basket] Showing receipt print modal after change confirmation');
    setReceiptPrintModalVisible(true);
  };

  if (basket.length === 0 && !receiptPrintModalVisible && !screenReceiptModalVisible) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>Your basket is empty</Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Add items from the Products tab to get started
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Basket ({basket.length} items)</Text>
          {currentTable && (
            <Text style={[styles.tableTag, { color: colors.primary }]}>
              Table: {currentTable.name}
            </Text>
          )}
          {isRefundMode && (
            <Text style={[styles.refundModeTag, { color: colors.error, backgroundColor: colors.error + '20' }]}>
              🔄 REFUND MODE
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {currentOperator?.isManager && refundButtonEnabled && (
            <TouchableOpacity
              style={[
                styles.refundButton,
                { 
                  backgroundColor: isRefundMode ? colors.error : colors.cardBackground,
                  borderColor: colors.error,
                },
                getButtonSkinStyle(buttonSkin, isRefundMode ? colors.error : colors.cardBackground),
              ]}
              onPress={() => {
                const success = toggleRefundMode();
                if (!success && !isRefundMode) {
                  Alert.alert(
                    'Cannot Activate Refund Mode',
                    'Please add at least one item to the basket before activating refund mode.',
                    [{ text: 'OK' }]
                  );
                }
              }}
              activeOpacity={0.7}
            >
              {getButtonOverlayStyle(buttonSkin) && (
                <View style={getButtonOverlayStyle(buttonSkin) as any} />
              )}
              <RotateCcw size={20} color={isRefundMode ? '#fff' : colors.error} />
              <Text style={[
                styles.refundButtonText,
                { color: isRefundMode ? '#fff' : colors.error }
              ]}>
                {isRefundMode ? 'Exit' : 'Refund'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.clearButton,
              { backgroundColor: colors.cardBackground },
              getButtonSkinStyle(buttonSkin, colors.cardBackground),
            ]}
            onPress={clearBasket}
            activeOpacity={0.7}
            testID="basket-clear"
          >
            {getButtonOverlayStyle(buttonSkin) && (
              <View style={getButtonOverlayStyle(buttonSkin) as any} />
            )}
            <Trash2 size={20} color={colors.error} />
            <Text style={[styles.clearText, { color: colors.error }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={basket}
        style={styles.itemsList}
        contentContainerStyle={styles.itemsContainer}
        keyExtractor={(item, index) => `${item.product.id}:${item.selectedPrice.key}:${index}`}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={50}
        windowSize={8}
        renderItem={({ item, index }) => {
          const isRefundItem = item.quantity < 0;
          const prefix = getPricePrefix(item.product.name, item.selectedPrice.label);

          const displayName =
            prefix !== '' && item.product.name.toUpperCase().startsWith(prefix.toUpperCase() + ' ')
              ? item.product.name.substring(prefix.length + 1)
              : item.product.name;

          return (
            <SwipeableBasketItem
              item={item}
              index={index}
              isRefundItem={isRefundItem}
              prefix={prefix}
              displayName={displayName}
              colors={colors}
              isManager={currentOperator?.isManager || false}
              onQuantityChange={updateBasketItemQuantity}
              onMessagePress={openMessageModal}
              onDelete={removeFromBasket}
              onRefund={handleRefundItem}
              onUndoRefund={handleUndoRefund}
              buttonSkin={buttonSkin}
              getButtonSkinStyle={getButtonSkinStyle}
              getButtonOverlayStyle={getButtonOverlayStyle}
            />
          );
        }}
      />

      {currentTable && basket.length > 0 && !splitBillModalVisible && (
        <Animated.View
          {...splitButtonPanResponder.panHandlers}
          style={[
            styles.splitBillFloatingButton,
            { backgroundColor: colors.accent },
            getButtonSkinStyle(buttonSkin, colors.accent),
            {
              transform: [
                { translateX: splitButtonPosition.x },
                { translateY: splitButtonPosition.y },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.splitBillFloatingButtonInner}
            onPress={openSplitBillModal}
            activeOpacity={0.8}
            testID="split-bill-button"
          >
            {getButtonOverlayStyle(buttonSkin) && (
              <View style={[getButtonOverlayStyle(buttonSkin) as any, { borderRadius: 28 }]} />
            )}
            <Split size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={[styles.summary, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>£{subtotal.toFixed(2)}</Text>
        </View>

        <View style={styles.discountGratuityRow}>
          {currentOperator?.isManager && (
            <TouchableOpacity
              style={[
                styles.discountButtonBottom,
                { 
                  backgroundColor: basketDiscount > 0 ? colors.accent : colors.background,
                  borderColor: basketDiscount > 0 ? colors.accent : colors.border,
                },
                getButtonSkinStyle(buttonSkin, basketDiscount > 0 ? colors.accent : colors.background),
              ]}
              onPress={() => setDiscountModalVisible(true)}
              activeOpacity={0.7}
            >
              {getButtonOverlayStyle(buttonSkin) && (
                <View style={getButtonOverlayStyle(buttonSkin) as any} />
              )}
              <Percent size={14} color={basketDiscount > 0 ? '#fff' : colors.accent} />
              <Text style={[
                styles.discountButtonBottomText,
                { color: basketDiscount > 0 ? '#fff' : colors.text }
              ]}>
                {basketDiscount > 0 ? `Discount (${basketDiscount}%)` : 'Discount'}
              </Text>
            </TouchableOpacity>
          )}
          
          {gratuitySettings.enabled && !isRefundMode && (
            <TouchableOpacity
              style={[
                styles.gratuityButtonBottom,
                { 
                  backgroundColor: gratuityAmount > 0 ? colors.success : colors.background,
                  borderColor: gratuityAmount > 0 ? colors.success : colors.border,
                },
                getButtonSkinStyle(buttonSkin, gratuityAmount > 0 ? colors.success : colors.background),
              ]}
              onPress={() => setGratuityModalVisible(true)}
              activeOpacity={0.7}
            >
              {getButtonOverlayStyle(buttonSkin) && (
                <View style={getButtonOverlayStyle(buttonSkin) as any} />
              )}
              <DollarSign size={14} color={gratuityAmount > 0 ? '#fff' : colors.success} />
              <Text style={[
                styles.gratuityButtonBottomText,
                { color: gratuityAmount > 0 ? '#fff' : colors.text }
              ]}>
                {gratuityAmount > 0 ? `Gratuity (£${gratuityAmount.toFixed(2)})` : 'Gratuity'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {basketDiscount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.accent }]}>Discount ({basketDiscount}%)</Text>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>-£{discount.toFixed(2)}</Text>
          </View>
        )}

        {Object.entries(vatBreakdown).map(([code, amount]) => (
          <View key={code} style={styles.summaryRow}>
            <Text style={[styles.summaryLabelSmall, { color: colors.textTertiary }]}>VAT ({code})</Text>
            <Text style={[styles.summaryValueSmall, { color: colors.textSecondary }]}>
              £{amount.toFixed(2)}
            </Text>
          </View>
        ))}

        {gratuityAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>Gratuity</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>£{gratuityAmount.toFixed(2)}</Text>
          </View>
        )}

        {splitPayments.length > 0 && (
          <View style={{ marginTop: 8, gap: 6 }}>
            {splitPayments.map((payment, index) => (
              <View key={index} style={styles.summaryRow}>
                <Text style={[styles.summaryLabelSmall, { color: colors.textSecondary }]}>
                  {payment.tenderName}
                </Text>
                <Text style={[styles.summaryValueSmall, { color: colors.success }]}>-£{payment.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>{paidAmount > 0 ? 'Remaining' : 'Total'}</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>£{remainingTotal.toFixed(2)}</Text>
        </View>

        <View style={styles.buttonRow}>
          {currentTable && (
            <TouchableOpacity
              style={[
                styles.saveTabButton,
                { backgroundColor: colors.cardBackground, borderColor: colors.border },
                getButtonSkinStyle(buttonSkin, colors.cardBackground),
              ]}
              onPress={handleSaveTab}
              activeOpacity={0.8}
            >
              {getButtonOverlayStyle(buttonSkin) && (
                <View style={getButtonOverlayStyle(buttonSkin) as any} />
              )}
              <Save size={20} color={colors.primary} />
              <Text style={[styles.saveTabButtonText, { color: colors.primary }]}>Save Tab</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.payButton,
              { backgroundColor: colors.primary, flex: currentTable ? 1 : undefined },
              getButtonSkinStyle(buttonSkin, colors.primary),
            ]}
            onPress={openPaymentModal}
            activeOpacity={0.8}
            testID="basket-pay"
          >
            {getButtonOverlayStyle(buttonSkin) && (
              <View style={getButtonOverlayStyle(buttonSkin) as any} />
            )}
            <CreditCard size={24} color="#fff" />
            <Text style={styles.payButtonText}>Pay £{remainingTotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        transparent
        visible={paymentModalVisible}
        onRequestClose={() => closePaymentModal()}
        animationType="none"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Animated.View
            style={[
              styles.paymentModal,
              { backgroundColor: colors.cardBackground },
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {payingSplitBillIndex !== null 
                  ? `Pay ${payingSplitBillIndex === -1 ? 'Main Bill' : `Bill ${payingSplitBillIndex + 1}`}`
                  : 'Select Payment Method'}
              </Text>
              <TouchableOpacity onPress={() => {
                if (payingSplitBillIndex !== null) {
                  closePaymentModal();
                  setTimeout(() => {
                    cancelSplitBillPayment();
                  }, 300);
                } else {
                  closePaymentModal();
                }
              }}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalTotal, { color: colors.primary }]}>
              {paidAmount > 0 ? 'Remaining' : 'Total'}: £{remainingTotal.toFixed(2)}
            </Text>

            {splitPaymentsEnabled && (
              <View style={[styles.splitPaymentSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.splitPaymentLabel, { color: colors.textSecondary }]}>Enter partial payment amount:</Text>
                
                <View style={[styles.amountInput, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <DollarSign size={20} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.amountInputText, { color: colors.text }]}
                    value={splitPaymentAmount}
                    editable={false}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.keypad}>
                  {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', '←']].map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.keypadRow}>
                      {row.map((key) => (
                        <TouchableOpacity
                          key={key}
                          style={[styles.keypadButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                          onPress={() => handleKeypadPress(key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.keypadButtonText, { color: colors.text }]}>{key}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.keypadButtonClear, { backgroundColor: colors.error + '20', borderColor: colors.error }]}
                    onPress={() => handleKeypadPress('C')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.keypadButtonClearText, { color: colors.error }]}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {availableTenders.length > 0 ? (
              availableTenders.map((tender) => (
                <TouchableOpacity
                  key={tender.id}
                  style={[
                    styles.tenderOption,
                    { borderLeftColor: tender.color, backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => handlePayment(tender.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tenderName, { color: colors.text }]}>{tender.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={[styles.noTendersContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.noTendersText, { color: colors.textSecondary }]}>
                  No payment methods enabled. Please enable at least one payment method in Settings.
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={messageModalVisible}
        onRequestClose={closeMessageModal}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.messageModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Message</Text>
              <TouchableOpacity onPress={closeMessageModal}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {currentMessageIndex !== null && (
              <Text style={[styles.modalProductName, { color: colors.textSecondary }]}>
                {basket[currentMessageIndex].product.name.split(' - ')[0]}
              </Text>
            )}

            <TextInput
              style={[styles.messageTextInput, { backgroundColor: colors.background, borderColor: colors.primary, color: colors.text }]}
              value={messageInput}
              onChangeText={setMessageInput}
              placeholder="Type your message..."
              placeholderTextColor={colors.textTertiary}
              multiline
              autoFocus
            />

            <TouchableOpacity
              style={[styles.submitMessageButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={handleMessageSubmit}
              activeOpacity={0.7}
            >
              <Text style={styles.submitMessageText}>Update Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={discountModalVisible}
        onRequestClose={() => setDiscountModalVisible(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.discountModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Apply Discount</Text>
              <TouchableOpacity onPress={() => setDiscountModalVisible(false)}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.discountModalSubtitle, { color: colors.textSecondary }]}>Select a discount percentage to apply to the basket</Text>

            {basketDiscount > 0 && (
              <View style={[styles.currentDiscountBanner, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}>
                <Percent size={18} color={colors.accent} />
                <Text style={[styles.currentDiscountText, { color: colors.accent }]}>Current discount: {basketDiscount}%</Text>
              </View>
            )}

            <View style={styles.discountGrid}>
              {discountSettings.presetPercentages.filter(p => p > 0).map((percentage) => (
                <TouchableOpacity
                  key={percentage}
                  style={[
                    styles.discountOption,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    basketDiscount === percentage && { borderColor: colors.accent, backgroundColor: colors.accent + '20' },
                  ]}
                  onPress={() => handleDiscountSelect(percentage)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.discountOptionText,
                    { color: basketDiscount === percentage ? colors.accent : colors.text }
                  ]}>
                    {percentage}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {basketDiscount > 0 && (
              <TouchableOpacity
                style={[styles.removeDiscountButton, { backgroundColor: colors.error + '20', borderColor: colors.error }]}
                onPress={handleRemoveDiscount}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.error} />
                <Text style={[styles.removeDiscountText, { color: colors.error }]}>Remove Discount</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={gratuityModalVisible}
        onRequestClose={() => setGratuityModalVisible(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.discountModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {payingSplitBillIndex !== null 
                  ? `Add Gratuity - ${payingSplitBillIndex === -1 ? 'Main Bill' : `Bill ${payingSplitBillIndex + 1}`}`
                  : 'Add Gratuity?'}
              </Text>
              <TouchableOpacity onPress={() => {
                setGratuityModalVisible(false);
                if (payingSplitBillIndex !== null) {
                  cancelSplitBillPayment();
                }
              }}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.discountModalSubtitle, { color: colors.textSecondary }]}>Would you like to add a gratuity to this order?</Text>

            <View style={styles.discountGrid}>
              {gratuitySettings.presetPercentages.map((percentage) => (
                <TouchableOpacity
                  key={percentage}
                  style={[
                    styles.discountOption,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => handleGratuitySelection(percentage)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.discountOptionText,
                    { color: colors.text }
                  ]}>
                    {percentage}%
                  </Text>
                  <Text style={[
                    styles.gratuityAmountText,
                    { color: colors.textSecondary }
                  ]}>
                    £{((total * percentage) / 100).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.customGratuitySection, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.customGratuityLabel, { color: colors.textSecondary }]}>Custom Amount</Text>
              <View style={styles.customGratuityInputContainer}>
                <Text style={[styles.currencySymbol, { color: colors.textTertiary }]}>£</Text>
                <TextInput
                  style={[styles.customGratuityInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
                  value={customGratuityInput}
                  onChangeText={setCustomGratuityInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.applyGratuityButton, { backgroundColor: colors.success }]}
                  onPress={handleCustomGratuity}
                  activeOpacity={0.7}
                >
                  <Text style={styles.applyGratuityText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.skipGratuityButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={handleSkipGratuity}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipGratuityText, { color: colors.textSecondary }]}>Skip Gratuity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={receiptPrintModalVisible}
        onRequestClose={() => setReceiptPrintModalVisible(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.receiptModal, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.receiptModalIconContainer, { backgroundColor: colors.success + '20' }]}>
              <Printer size={48} color={colors.success} />
            </View>
            
            <Text style={[styles.receiptModalTitle, { color: colors.text }]}>Transaction Complete!</Text>
            <Text style={[styles.receiptModalSubtitle, { color: colors.textSecondary }]}>Would you like to print a receipt?</Text>

            <View style={styles.receiptModalButtons}>
              <TouchableOpacity
                style={[
                  styles.receiptModalButton,
                  { 
                    backgroundColor: printerConnected ? colors.primary : colors.cardBackground,
                    borderColor: printerConnected ? colors.primary : colors.border,
                    borderWidth: printerConnected ? 0 : 2,
                    borderStyle: printerConnected ? 'solid' : 'dotted',
                  }
                ]}
                onPress={handlePrintReceipt}
                activeOpacity={printerConnected ? 0.8 : 1}
                disabled={!printerConnected}
              >
                <Printer size={20} color={printerConnected ? "#fff" : colors.textTertiary} />
                <Text style={[
                  styles.receiptModalButtonText,
                  { color: printerConnected ? "#fff" : colors.textTertiary }
                ]}>Print Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.receiptModalButtonSecondary, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={handlePrintToScreen}
                activeOpacity={0.8}
              >
                <Text style={[styles.receiptModalButtonSecondaryText, { color: colors.text }]}>Print to Screen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.receiptModalButtonSecondary, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={handleSkipReceipt}
                activeOpacity={0.8}
              >
                <Text style={[styles.receiptModalButtonSecondaryText, { color: colors.textSecondary }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={screenReceiptModalVisible}
        onRequestClose={handleCloseScreenReceipt}
        animationType="slide"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.screenReceiptModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.screenReceiptHeader}>
              <Text style={[styles.screenReceiptTitle, { color: colors.text }]}>Receipt</Text>
              <TouchableOpacity onPress={handleCloseScreenReceipt}>
                <X size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.screenReceiptContent} showsVerticalScrollIndicator={false}>
              {lastTransaction && (
                <View style={[styles.receiptContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.receiptHeader, { color: colors.text }]}>RECEIPT</Text>
                  <Text style={[styles.receiptSubheader, { color: colors.textSecondary }]}>Transaction #{lastTransaction.id.slice(-8)}</Text>
                  <Text style={[styles.receiptDate, { color: colors.textSecondary }]}>{new Date(lastTransaction.timestamp).toLocaleString()}</Text>
                  
                  <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
                  
                  <View style={styles.receiptInfoRow}>
                    <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Operator:</Text>
                    <Text style={[styles.receiptValue, { color: colors.text }]}>{lastTransaction.operatorName}</Text>
                  </View>

                  {lastTransaction.tableName && (
                    <View style={styles.receiptInfoRow}>
                      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Table:</Text>
                      <Text style={[styles.receiptValue, { color: colors.text }]}>{lastTransaction.tableName}</Text>
                    </View>
                  )}

                  <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />

                  <Text style={[styles.receiptSectionTitle, { color: colors.text }]}>Items</Text>
                  {lastTransaction.items.map((item, index) => {
                    const prefix = getPricePrefix(item.product.name, item.selectedPrice.label);
                    const displayName = (prefix && !item.product.name.toUpperCase().startsWith(prefix.toUpperCase() + ' '))
                      ? `${prefix} ${item.product.name}` 
                      : item.product.name;
                    return (
                    <View key={index} style={styles.receiptItemRow}>
                      <View style={styles.receiptItemInfo}>
                        <Text style={[styles.receiptItemName, { color: colors.text }]}>{displayName}</Text>
                        <Text style={[styles.receiptItemDetails, { color: colors.textSecondary }]}>
                          {Math.abs(item.quantity)} × £{item.selectedPrice.price.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={[styles.receiptItemTotal, { color: colors.text }]}>£{Math.abs(item.lineTotal).toFixed(2)}</Text>
                    </View>
                  )})}

                  <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.receiptTotalsSection}>
                    <View style={styles.receiptInfoRow}>
                      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                      <Text style={[styles.receiptValue, { color: colors.text }]}>£{lastTransaction.subtotal.toFixed(2)}</Text>
                    </View>

                    {lastTransaction.discount && lastTransaction.discount > 0 && (
                      <View style={styles.receiptInfoRow}>
                        <Text style={[styles.receiptLabel, { color: colors.accent }]}>Discount</Text>
                        <Text style={[styles.receiptValue, { color: colors.accent }]}>-£{lastTransaction.discount.toFixed(2)}</Text>
                      </View>
                    )}

                    {Object.entries(lastTransaction.vatBreakdown).map(([code, amount]) => (
                      <View key={code} style={styles.receiptInfoRow}>
                        <Text style={[styles.receiptLabel, { color: colors.textTertiary }]}>VAT ({code})</Text>
                        <Text style={[styles.receiptValue, { color: colors.textSecondary }]}>£{amount.toFixed(2)}</Text>
                      </View>
                    ))}

                    {lastTransaction.gratuity && lastTransaction.gratuity > 0 && (
                      <View style={styles.receiptInfoRow}>
                        <Text style={[styles.receiptLabel, { color: colors.success }]}>Gratuity</Text>
                        <Text style={[styles.receiptValue, { color: colors.success }]}>£{lastTransaction.gratuity.toFixed(2)}</Text>
                      </View>
                    )}

                    <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />

                    <View style={styles.receiptInfoRow}>
                      <Text style={[styles.receiptTotalLabelBold, { color: colors.text }]}>TOTAL</Text>
                      <Text style={[styles.receiptTotalValueBold, { color: colors.primary }]}>£{lastTransaction.total.toFixed(2)}</Text>
                    </View>

                    <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />

                    {lastTransaction.payments && lastTransaction.payments.length > 0 ? (
                      <View>
                        <Text style={[styles.receiptLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Payment Methods:</Text>
                        {lastTransaction.payments.map((payment, idx) => (
                          <View key={idx} style={styles.receiptInfoRow}>
                            <Text style={[styles.receiptLabel, { color: colors.text, paddingLeft: 12 }]}>{payment.tenderName}</Text>
                            <Text style={[styles.receiptValue, { color: colors.text }]}>£{payment.amount.toFixed(2)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.receiptInfoRow}>
                        <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                        <Text style={[styles.receiptValue, { color: colors.text }]}>{lastTransaction.paymentMethod}</Text>
                      </View>
                    )}

                    {lastTransaction.cashback && lastTransaction.cashback > 0 && (() => {
                      let lastPaymentTender = lastTransaction.tenderName;
                      if (lastTransaction.payments && lastTransaction.payments.length > 0) {
                        const lastPayment = lastTransaction.payments[lastTransaction.payments.length - 1];
                        lastPaymentTender = lastPayment.tenderName;
                      }
                      const isCash = lastPaymentTender === 'Cash';
                      const label = isCash ? 'Change' : 'Cashback';
                      console.log('[Basket Receipt] Displaying cashback:', lastTransaction.cashback, 'Label:', label, 'Tender:', lastPaymentTender, 'Full transaction:', JSON.stringify(lastTransaction, null, 2));
                      return (
                        <>
                          <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
                          <View style={styles.receiptInfoRow}>
                            <Text style={[styles.receiptLabel, { color: colors.success, fontWeight: '700' as const }]}>{label}</Text>
                            <Text style={[styles.receiptValue, { color: colors.success, fontWeight: '700' as const }]}>£{lastTransaction.cashback.toFixed(2)}</Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>

                  {lastTransaction.isRefund && (
                    <View style={[styles.receiptRefundBanner, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
                      <Text style={[styles.receiptRefundText, { color: colors.error }]}>REFUND</Text>
                    </View>
                  )}

                  <Text style={[styles.receiptFooter, { color: colors.textTertiary }]}>Thank you for your business!</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeScreenReceiptButton, { backgroundColor: colors.primary }]}
              onPress={handleCloseScreenReceipt}
              activeOpacity={0.8}
            >
              <Text style={styles.closeScreenReceiptButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={changeModalVisible}
        onRequestClose={() => setChangeModalVisible(false)}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.changeModal, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.changeIconContainer, { backgroundColor: colors.success + '20' }]}>
              <DollarSign size={48} color={colors.success} />
            </View>
            
            <Text style={[styles.changeModalTitle, { color: colors.text }]}>Change Due</Text>
            <Text style={[styles.changeAmount, { color: colors.success }]}>£{changeAmount.toFixed(2)}</Text>
            <Text style={[styles.changeModalSubtitle, { color: colors.textSecondary }]}>
              {pendingTenderId && availableTenders.find(t => t.id === pendingTenderId)?.name === 'Cash' 
                ? 'Change will be given in cash' 
                : 'Cashback will be recorded (change given on non-cash tender)'}
            </Text>

            <TouchableOpacity
              style={[styles.confirmChangeButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirmChange}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmChangeButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
        visible={processingTransaction}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.processingModal, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.processingIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <CreditCard size={48} color={colors.primary} />
            </View>
            
            <Text style={[styles.processingModalTitle, { color: colors.text }]}>Processing Transaction...</Text>
            <Text style={[styles.processingModalSubtitle, { color: colors.textSecondary }]}>
              Please wait while we post your transaction to the server
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
          <View style={[styles.changeModal, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.changeIconContainer, { backgroundColor: colors.error + '20' }]}>
              <X size={48} color={colors.error} />
            </View>
            
            <Text style={[styles.changeModalTitle, { color: colors.text }]}>Save Failed</Text>
            <Text style={[styles.changeModalSubtitle, { color: colors.textSecondary }]}>
              The table didn&apos;t save. Please try again.
            </Text>

            <TouchableOpacity
              style={[styles.confirmChangeButton, { backgroundColor: colors.primary }]}
              onPress={() => setSaveErrorModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmChangeButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={splitBillModalVisible}
        onRequestClose={closeSplitBillModal}
        animationType="slide"
      >
        <View style={[styles.splitBillModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.splitBillHeader, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeSplitBillModal} style={styles.splitBillCloseButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.splitBillTitle, { color: colors.text }]}>Split Bill</Text>
            <TouchableOpacity 
              onPress={handleSaveSplitBills} 
              style={[styles.splitBillSaveButton, { backgroundColor: colors.primary }]}
            >
              <Save size={18} color="#fff" />
              <Text style={styles.splitBillSaveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.splitBillTabs, { backgroundColor: colors.cardBackground }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.splitBillTabsContent} style={styles.splitBillTabsScroll}>
              <TouchableOpacity
                style={[
                  styles.splitBillTab,
                  activeSplitBillIndex === -1 && { backgroundColor: colors.primary },
                  { borderColor: colors.border }
                ]}
                onPress={() => setActiveSplitBillIndex(-1)}
              >
                <Text style={[
                  styles.splitBillTabText,
                  { color: activeSplitBillIndex === -1 ? '#fff' : colors.text }
                ]}>Main</Text>
                <Text style={[
                  styles.splitBillTabAmount,
                  { color: activeSplitBillIndex === -1 ? '#fff' : colors.textSecondary }
                ]}>£{calculateBillTotal(getMainBasketForSplit()).toFixed(2)}</Text>
              </TouchableOpacity>
              {[0, 1, 2, 3].map((index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.splitBillTab,
                    activeSplitBillIndex === index && { backgroundColor: colors.accent },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setActiveSplitBillIndex(index)}
                >
                  <Text style={[
                    styles.splitBillTabText,
                    { color: activeSplitBillIndex === index ? '#fff' : colors.text }
                  ]}>Bill {index + 1}</Text>
                  <Text style={[
                    styles.splitBillTabAmount,
                    { color: activeSplitBillIndex === index ? '#fff' : colors.textSecondary }
                  ]}>£{calculateBillTotal(splitBills[index]).toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {selectedItemsForMove.size > 0 && (
            <View style={[styles.splitBillMoveBar, { backgroundColor: colors.primary }]}>
              <Text style={styles.splitBillMoveBarText}>
                {selectedItemsForMove.size} item(s) selected
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.splitBillMoveBarScroll} contentContainerStyle={styles.splitBillMoveBarContent}>
                {splitBillSourceIndex !== -1 && (
                  <TouchableOpacity
                    style={[styles.splitBillMoveButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                    onPress={() => moveSelectedItems(-1)}
                  >
                    <Text style={styles.splitBillMoveButtonText}>→ Main</Text>
                  </TouchableOpacity>
                )}
                {[0, 1, 2, 3].map((index) => (
                  splitBillSourceIndex !== index && (
                    <TouchableOpacity
                      key={index}
                      style={[styles.splitBillMoveButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                      onPress={() => moveSelectedItems(index)}
                    >
                      <Text style={styles.splitBillMoveButtonText}>→ Bill {index + 1}</Text>
                    </TouchableOpacity>
                  )
                ))}
              </ScrollView>
            </View>
          )}

          <ScrollView style={styles.splitBillContent} contentContainerStyle={styles.splitBillContentContainer}>
            {(() => {
              const currentItems = activeSplitBillIndex === -1 ? getMainBasketForSplit() : splitBills[activeSplitBillIndex];
              const sourceIndex = activeSplitBillIndex;
              
              if (currentItems.length === 0) {
                return (
                  <View style={styles.splitBillEmptyState}>
                    <Text style={[styles.splitBillEmptyText, { color: colors.textTertiary }]}>
                      {activeSplitBillIndex === -1 ? 'All items have been moved to split bills' : 'No items in this bill'}
                    </Text>
                    <Text style={[styles.splitBillEmptySubtext, { color: colors.textTertiary }]}>
                      {activeSplitBillIndex === -1 ? 'Move items back from split bills or proceed with payment' : 'Select items from another bill and move them here'}
                    </Text>
                  </View>
                );
              }
              
              return currentItems.map((item, index) => {
                const isSelected = splitBillSourceIndex === sourceIndex && selectedItemsForMove.has(index);
                return (
                  <TouchableOpacity
                    key={`${item.product.id}-${item.selectedPrice.key}-${index}`}
                    style={[
                      styles.splitBillItem,
                      { backgroundColor: colors.cardBackground, borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { borderWidth: 2 }
                    ]}
                    onPress={() => toggleItemSelection(index, sourceIndex)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.splitBillItemCheckbox,
                      { borderColor: isSelected ? colors.primary : colors.border },
                      isSelected && { backgroundColor: colors.primary }
                    ]}>
                      {isSelected && <Check size={14} color="#fff" />}
                    </View>
                    <View style={styles.splitBillItemInfo}>
                      <Text style={[styles.splitBillItemName, { color: colors.text }]} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text style={[styles.splitBillItemDetails, { color: colors.textSecondary }]}>
                        {item.quantity} × £{item.selectedPrice.price.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={[styles.splitBillItemTotal, { color: colors.primary }]}>
                      £{item.lineTotal.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              });
            })()}
          </ScrollView>

          <View style={[styles.splitBillFooter, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
            <View style={styles.splitBillFooterInfo}>
              <Text style={[styles.splitBillFooterLabel, { color: colors.textSecondary }]}>
                {activeSplitBillIndex === -1 ? 'Main Bill' : `Bill ${activeSplitBillIndex + 1}`} Total
              </Text>
              <Text style={[styles.splitBillFooterTotal, { color: colors.primary }]}>
                £{calculateBillTotal(activeSplitBillIndex === -1 ? getMainBasketForSplit() : splitBills[activeSplitBillIndex]).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.splitBillPayButton,
                { backgroundColor: colors.success },
                getButtonSkinStyle(buttonSkin, colors.success)
              ]}
              onPress={() => handlePaySplitBill(activeSplitBillIndex)}
              activeOpacity={0.8}
            >
              {getButtonOverlayStyle(buttonSkin) && (
                <View style={getButtonOverlayStyle(buttonSkin) as any} />
              )}
              <CreditCard size={18} color="#fff" />
              <Text style={styles.splitBillPayButtonText}>Pay This Bill</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  tableTag: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  refundModeTag: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  discountGratuityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  discountButtonBottom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  discountButtonBottomText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gratuityButtonBottom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  gratuityButtonBottomText: {
    fontSize: 14,
    fontWeight: '600',
  },
  printBillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    opacity: 1,
  },
  refundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
  },
  refundButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemsList: {
    flex: 1,
  },
  itemsContainer: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
    paddingBottom: 110,
  },
  swipeableContainer: {
    position: 'relative' as const,
    height: 'auto' as const,
    marginBottom: 0,
  },
  refundButtonContainer: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'flex-start' as const,
    paddingLeft: 6,
  },
  refundButtonSwipe: {
    width: 70,
    height: '90%',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: 10,
  },
  deleteButtonContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'flex-end' as const,
    paddingRight: 6,
  },
  deleteButton: {
    width: 70,
    height: '90%',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: 10,
  },
  basketItem: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    gap: 6,
    backgroundColor: '#fff',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap' as const,
    paddingTop: 5,
  },
  itemPrefix: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  refundBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 6,
  },
  refundBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  quantitySection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  quantityNumber: {
    fontSize: 16,
    fontWeight: '700',
    width: 40,
    textAlign: 'center' as const,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  quantityButton: {
    padding: 6,
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right' as const,
  },
  messageButton: {
    padding: 8,
  },
  summary: {
    padding: 20,
    borderTopWidth: 1,
    paddingBottom: 110,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryLabelSmall: {
    fontSize: 14,
  },
  summaryValueSmall: {
    fontSize: 14,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  saveTabButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    flex: 1,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paymentModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
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
  modalTotal: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  tenderOption: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  tenderName: {
    fontSize: 18,
    fontWeight: '600',
  },
  noTendersContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  noTendersText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  splitPaymentSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  splitPaymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  amountInputText: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 8,
  },
  keypad: {
    gap: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadButton: {
    flex: 1,
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  keypadButtonClear: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  keypadButtonClearText: {
    fontSize: 16,
    fontWeight: '700',
  },
  messageModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalProductName: {
    fontSize: 16,
    marginBottom: 20,
  },
  messageInputDisplay: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    minHeight: 60,
  },
  messageInputText: {
    fontSize: 18,
    textAlign: 'center',
  },
  messageTextInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  keyboardContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 6,
    justifyContent: 'center' as const,
  },
  keyboardButton: {
    minWidth: 32,
    height: 42,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  keyboardButtonWide: {
    minWidth: 60,
  },
  keyboardButtonSpace: {
    flex: 1,
  },
  keyboardButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  submitMessageButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
  },
  submitMessageText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  discountModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  discountModalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  currentDiscountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  currentDiscountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  discountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
    marginBottom: 20,
  },
  discountOption: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    width: '30%',
  },
  discountOptionText: {
    fontSize: 18,
    fontWeight: '700',
  },
  removeDiscountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  removeDiscountText: {
    fontSize: 15,
    fontWeight: '600',
  },
  gratuityAmountText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  customGratuitySection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  customGratuityLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  customGratuityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
  },
  customGratuityInput: {
    minWidth: 100,
    maxWidth: 150,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  applyGratuityButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyGratuityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  skipGratuityButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  skipGratuityText: {
    fontSize: 15,
    fontWeight: '600',
  },
  receiptModal: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  receiptModalIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  receiptModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  receiptModalSubtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  receiptModalButtons: {
    width: '100%',
    gap: 12,
  },
  receiptModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
  },
  receiptModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  receiptModalButtonSecondary: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  receiptModalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  screenReceiptModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    height: '90%',
  },
  screenReceiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  screenReceiptTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  screenReceiptContent: {
    flex: 1,
  },
  receiptContainer: {
    paddingBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 8,
  },
  receiptHeader: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  receiptSubheader: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  receiptDate: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  receiptDivider: {
    height: 1,
    marginVertical: 12,
  },
  receiptInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  receiptLabel: {
    fontSize: 14,
  },
  receiptValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  receiptItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  receiptItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  receiptItemDetails: {
    fontSize: 12,
  },
  receiptItemTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptTotalsSection: {
    marginTop: 4,
  },
  receiptTotalLabel: {
    fontSize: 14,
  },
  receiptTotalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptTotalLabelBold: {
    fontSize: 16,
    fontWeight: '700',
  },
  receiptTotalValueBold: {
    fontSize: 18,
    fontWeight: '700',
  },
  receiptRefundBanner: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 16,
    alignItems: 'center',
  },
  receiptRefundText: {
    fontSize: 16,
    fontWeight: '700',
  },
  receiptFooter: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  closeScreenReceiptButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeScreenReceiptButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  changeModal: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  changeIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  changeModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  changeAmount: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  changeModalSubtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  confirmChangeButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmChangeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  savingModal: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  savingIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  savingModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  savingModalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  processingModal: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  processingIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  processingModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  processingModalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  splitBillFloatingButton: {
    position: 'absolute' as const,
    right: 16,
    bottom: 280,
    width: 56,
    height: 56,
    borderRadius: 28,
    zIndex: 100,
  },
  splitBillFloatingButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  splitBillFloatingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  splitBillModalContainer: {
    flex: 1,
  },
  splitBillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  splitBillCloseButton: {
    padding: 8,
  },
  splitBillTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  splitBillSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  splitBillSaveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  splitBillTabs: {
    paddingVertical: 12,
  },
  splitBillTabsScroll: {
    flexGrow: 0,
  },
  splitBillTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row' as const,
  },
  splitBillTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center' as const,
  },
  splitBillTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  splitBillTabAmount: {
    fontSize: 12,
    marginTop: 2,
  },
  splitBillMoveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  splitBillMoveBarScroll: {
    flex: 1,
  },
  splitBillMoveBarContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingRight: 16,
  },
  splitBillMoveBarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  splitBillMoveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  splitBillMoveButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  splitBillContent: {
    flex: 1,
  },
  splitBillContentContainer: {
    padding: 16,
    gap: 8,
  },
  splitBillEmptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 60,
  },
  splitBillEmptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  splitBillEmptySubtext: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingHorizontal: 40,
  },
  splitBillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  splitBillItemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  splitBillItemInfo: {
    flex: 1,
  },
  splitBillItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  splitBillItemDetails: {
    fontSize: 13,
    marginTop: 2,
  },
  splitBillItemTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  splitBillFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    gap: 16,
  },
  splitBillFooterInfo: {
    flex: 1,
  },
  splitBillFooterLabel: {
    fontSize: 14,
  },
  splitBillFooterTotal: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  splitBillPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  splitBillPayButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
