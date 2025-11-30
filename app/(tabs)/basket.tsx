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
} from 'react-native';

import { Trash2, Plus, Minus, CreditCard, X, Save, DollarSign, MessageSquare } from 'lucide-react-native';
import { usePOS } from '@/contexts/POSContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function BasketScreen() {
  const {
    basket,
    currentTable,
    updateBasketItemQuantity,
    updateBasketItemMessage,
    removeFromBasket,
    clearBasket,
    calculateTotals,
    completeSale,
    saveTableTab,
    getAvailableTenders,
    splitPaymentsEnabled,
  } = usePOS();
  const { colors, theme } = useTheme();

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [splitPaymentAmount, setSplitPaymentAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState<{ tenderId: string; tenderName: string; amount: number }[]>([]);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const scaleAnim = useState(new Animated.Value(0))[0];
  const availableTenders = getAvailableTenders();

  const { subtotal, vatBreakdown, total } = calculateTotals();
  const paidAmount = splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const remainingTotal = total - paidAmount;

  const openPaymentModal = () => {
    setPaymentModalVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
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
      if (amount < remainingTotal) {
        setSplitPayments([...splitPayments, {
          tenderId: tender.id,
          tenderName: tender.name,
          amount: amount,
        }]);
        setSplitPaymentAmount('');
        closePaymentModal();
        return;
      }
    }
    await completeSale(tenderId, splitPayments);
    setSplitPayments([]);
    setSplitPaymentAmount('');
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
        </View>
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: colors.cardBackground }]}
          onPress={clearBasket}
          activeOpacity={0.7}
        >
          <Trash2 size={20} color={colors.error} />
          <Text style={[styles.clearText, { color: colors.error }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.itemsList}
        contentContainerStyle={styles.itemsContainer}
        showsVerticalScrollIndicator={false}
      >
        {basket.map((item, index) => (
          <View key={index} style={[styles.basketItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.text }]}>{item.product.name}</Text>
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

              <Text style={[styles.lineTotal, { color: colors.primary }]}>
                £{item.lineTotal.toFixed(2)}
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
        ))}
      </ScrollView>

      <View style={[styles.summary, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>£{subtotal.toFixed(2)}</Text>
        </View>

        {Object.entries(vatBreakdown).map(([code, amount]) => (
          <View key={code} style={styles.summaryRow}>
            <Text style={[styles.summaryLabelSmall, { color: colors.textTertiary }]}>VAT ({code})</Text>
            <Text style={[styles.summaryValueSmall, { color: colors.textSecondary }]}>
              £{amount.toFixed(2)}
            </Text>
          </View>
        ))}

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
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
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
});
