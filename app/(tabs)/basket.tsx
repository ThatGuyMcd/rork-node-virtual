import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';

import { Trash2, Plus, Minus, CreditCard, X, Save, DollarSign, MessageSquare, RotateCcw, Percent } from 'lucide-react-native';
import { usePOS } from '@/contexts/POSContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function BasketScreen() {
  const {
    basket,
    currentTable,
    currentOperator,
    updateBasketItemQuantity,
    updateBasketItemMessage,
    removeFromBasket,
    clearBasket,
    calculateTotals,
    completeSale,
    saveTableTab,
    getAvailableTenders,
    splitPaymentsEnabled,
    isRefundMode,
    toggleRefundMode,
    discountSettings,
    basketDiscount,
    applyDiscount,
    gratuitySettings,
  } = usePOS();
  const { colors, theme } = useTheme();

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
  const scaleAnim = useState(new Animated.Value(0))[0];
  const availableTenders = getAvailableTenders();

  const { subtotal, discount, vatBreakdown, total } = calculateTotals();
  const paidAmount = splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalWithGratuity = total + gratuityAmount;
  const remainingTotal = totalWithGratuity - paidAmount;

  const openPaymentModal = () => {
    setPaymentModalVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const handleGratuitySelection = (percentage: number) => {
    const gratuityValue = (total * percentage) / 100;
    setGratuityAmount(gratuityValue);
    setGratuityModalVisible(false);
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
  };

  const handleSkipGratuity = () => {
    setGratuityAmount(0);
    setGratuityModalVisible(false);
  };

  const closePaymentModal = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPaymentModalVisible(false);
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
        await completeSale(tenderId, updatedSplitPayments);
        setSplitPayments([]);
        setSplitPaymentAmount('');
        closePaymentModal();
        return;
      }
      
      if (amount < remainingTotal) {
        setSplitPayments(updatedSplitPayments);
        setSplitPaymentAmount('');
        closePaymentModal();
        return;
      }
    }
    await completeSale(tenderId, splitPayments, gratuityAmount > 0 ? gratuityAmount : undefined);
    setSplitPayments([]);
    setSplitPaymentAmount('');
    setGratuityAmount(0);
    closePaymentModal();
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
    await saveTableTab();
  };

  const openMessageModal = (index: number) => {
    setCurrentMessageIndex(index);
    const item = basket[index];
    const existingMessage = item.product.name.includes(' - ') 
      ? item.product.name.split(' - ').slice(1).join(' - ') 
      : '';
    setMessageInput(existingMessage);
    setMessageModalVisible(true);
  };

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

  if (basket.length === 0) {
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
          {currentOperator?.isManager && (
            <TouchableOpacity
              style={[
                styles.refundButton,
                { 
                  backgroundColor: isRefundMode ? colors.error : colors.cardBackground,
                  borderColor: colors.error,
                }
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
            style={[styles.clearButton, { backgroundColor: colors.cardBackground }]}
            onPress={clearBasket}
            activeOpacity={0.7}
          >
            <Trash2 size={20} color={colors.error} />
            <Text style={[styles.clearText, { color: colors.error }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.itemsList}
        contentContainerStyle={styles.itemsContainer}
        showsVerticalScrollIndicator={false}
      >
        {basket.map((item, index) => {
          const isRefundItem = item.quantity < 0;
          return (
          <View 
            key={index} 
            style={[
              styles.basketItem, 
              { 
                backgroundColor: colors.cardBackground, 
                borderColor: isRefundItem ? colors.error : colors.border,
                borderWidth: isRefundItem ? 2 : 1,
              }
            ]}
          >
            <View style={styles.itemInfo}>
              <View style={styles.itemNameRow}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.product.name}</Text>
                {isRefundItem && (
                  <View style={[styles.refundBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.refundBadgeText}>REFUND</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                £{item.selectedPrice.price.toFixed(2)}
                {item.selectedPrice.label !== 'Standard' &&
                  ` (${item.selectedPrice.label})`}
              </Text>
            </View>

            <View style={styles.itemActions}>
              <View style={[styles.quantityControl, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    updateBasketItemQuantity(index, item.quantity - 1)
                  }
                  activeOpacity={0.7}
                >
                  <Minus size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.quantityText, { color: colors.text }]}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() =>
                    updateBasketItemQuantity(index, item.quantity + 1)
                  }
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.lineTotal, { color: isRefundItem ? colors.error : colors.primary }]}>
                {isRefundItem ? '-' : ''}£{Math.abs(item.lineTotal).toFixed(2)}
              </Text>

              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => openMessageModal(index)}
                activeOpacity={0.7}
              >
                <MessageSquare size={18} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFromBasket(index)}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )})}
      </ScrollView>

      <View style={[styles.summary, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>£{subtotal.toFixed(2)}</Text>
        </View>

        {currentOperator?.isManager && (
          <View style={styles.discountGratuityRow}>
            <TouchableOpacity
              style={[
                styles.discountButtonBottom,
                { 
                  backgroundColor: basketDiscount > 0 ? colors.accent : colors.background,
                  borderColor: basketDiscount > 0 ? colors.accent : colors.border,
                }
              ]}
              onPress={() => setDiscountModalVisible(true)}
              activeOpacity={0.7}
            >
              <Percent size={14} color={basketDiscount > 0 ? '#fff' : colors.accent} />
              <Text style={[
                styles.discountButtonBottomText,
                { color: basketDiscount > 0 ? '#fff' : colors.text }
              ]}>
                {basketDiscount > 0 ? `Discount (${basketDiscount}%)` : 'Discount'}
              </Text>
            </TouchableOpacity>
            
            {gratuitySettings.enabled && !isRefundMode && (
              <TouchableOpacity
                style={[
                  styles.gratuityButtonBottom,
                  { 
                    backgroundColor: gratuityAmount > 0 ? colors.success : colors.background,
                    borderColor: gratuityAmount > 0 ? colors.success : colors.border,
                  }
                ]}
                onPress={() => setGratuityModalVisible(true)}
                activeOpacity={0.7}
              >
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
        )}

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

        {currentTable && (
          <TouchableOpacity
            style={[styles.saveTabButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handleSaveTab}
            activeOpacity={0.8}
          >
            <Save size={20} color={colors.primary} />
            <Text style={[styles.saveTabButtonText, { color: colors.primary }]}>Save Tab</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: colors.primary }]}
          onPress={openPaymentModal}
          activeOpacity={0.8}
        >
          <CreditCard size={24} color="#fff" />
          <Text style={styles.payButtonText}>Pay £{remainingTotal.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={paymentModalVisible}
        onRequestClose={closePaymentModal}
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Payment Method</Text>
              <TouchableOpacity onPress={closePaymentModal}>
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Gratuity?</Text>
              <TouchableOpacity onPress={() => setGratuityModalVisible(false)}>
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
    marginTop: 12,
    marginBottom: 8,
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
    gap: 12,
  },
  basketItem: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  itemInfo: {
    marginBottom: 12,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  refundBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  refundBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 13,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  quantityButton: {
    padding: 8,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  lineTotal: {
    fontSize: 18,
    fontWeight: '700',
  },
  messageButton: {
    padding: 8,
  },
  removeButton: {
    padding: 8,
  },
  summary: {
    padding: 20,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    marginTop: 12,
    paddingTop: 12,
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
  saveTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
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
});
