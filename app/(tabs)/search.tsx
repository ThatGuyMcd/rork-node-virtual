import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Modal,
  Animated,

} from 'react-native';
import { Camera, Search as SearchIcon, X, Barcode } from 'lucide-react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { usePOS } from '@/contexts/POSContext';
import { useTheme, type ButtonSkin } from '@/contexts/ThemeContext';
import { dataSyncService } from '@/services/dataSync';
import type { Product, PriceOption } from '@/types/pos';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const { addToBasket, currentTable, isTableSelectionRequired } = usePOS();
  const { colors, theme, buttonSkin } = useTheme();
  const scaleAnim = useState(new Animated.Value(0))[0];

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
    const base = StyleSheet.absoluteFillObject;
    switch (skin) {
      case 'rounded':
        return {
          ...base,
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
          ...base,
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
          ...base,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        };
      case 'outlined':
        return {
          ...base,
          borderRadius: 14,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
        };
      case 'minimal':
        return {
          ...base,
          borderRadius: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        };
      default:
        return null;
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts([]);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = products.filter((product) => {
        const nameMatch = product.name.toLowerCase().includes(query);
        const barcodeMatch = product.barcode?.toLowerCase().includes(query);
        return nameMatch || barcodeMatch;
      });
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  const loadProducts = async () => {
    try {
      const loadedProducts = await dataSyncService.getStoredProducts();
      setProducts(loadedProducts);
      console.log('[Search] Loaded products:', loadedProducts.length);
    } catch (error) {
      console.error('[Search] Failed to load products:', error);
    }
  };

  const handleBarcodeScanned = (data: string) => {
    console.log('[Search] Barcode scanned:', data);
    setCameraVisible(false);
    setSearchQuery(data);
    
    const product = products.find((p) => p.barcode === data);
    if (product) {
      handleProductPress(product);
    } else {
      showNotification('Product not found', true);
    }
  };

  const handleProductPress = (product: Product) => {
    if (isTableSelectionRequired && !currentTable) {
      showNotification('Please select a table first', true);
      return;
    }

    if (product.prices.length === 0) {
      showNotification('No price set for this product', true);
      return;
    }

    const validPrices = product.prices.filter((p) => {
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
        showNotification('Open pricing not supported in search', true);
        return;
      }

      addToBasket(product, firstValidPrice, 1);
      showNotification(`Added ${product.name} to basket`);
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
      showNotification('Open pricing not supported in search', true);
      closePriceModal();
      return;
    }

    addToBasket(selectedProduct, price, 1);
    showNotification(`Added ${selectedProduct.name} to basket`);
    closePriceModal();
  };

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

  const showNotification = (message: string, isError: boolean = false) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showNotification('Camera permission denied', true);
        return;
      }
    }
    setCameraVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.searchHeader, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <SearchIcon size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or barcode..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.cameraButton,
            { backgroundColor: colors.primary },
            getButtonSkinStyle(buttonSkin, colors.primary),
          ]}
          onPress={openCamera}
          activeOpacity={0.7}
        >
          {getButtonOverlayStyle(buttonSkin) && (
            <View style={getButtonOverlayStyle(buttonSkin) as any} />
          )}
          <Camera size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {searchQuery.length === 0 ? (
          <View style={styles.emptyState}>
            <Barcode size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Search for Products</Text>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Type a product name or use the camera to scan a barcode
            </Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <SearchIcon size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Results</Text>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No products match your search
            </Text>
          </View>
        ) : (
          <View style={styles.productList}>
            {filteredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.productCard,
                  { backgroundColor: product.buttonColor },
                  getButtonSkinStyle(buttonSkin, product.buttonColor),
                ]}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.8}
              >
                {getButtonOverlayStyle(buttonSkin) && (
                  <View style={getButtonOverlayStyle(buttonSkin) as any} />
                )}
                <View style={styles.productInfo}>
                  <Text style={[styles.productName, { color: product.fontColor }]}>
                    {product.name}
                  </Text>
                  {product.barcode && (
                    <Text style={[styles.productBarcode, { color: product.fontColor, opacity: 0.7 }]}>
                      {product.barcode}
                    </Text>
                  )}
                </View>
                <Text style={[styles.productPrice, { color: product.fontColor }]}>
                  {(() => {
                    if (product.prices.length === 0) return 'No price';
                    if (product.prices.length === 1) {
                      const priceLabel = product.prices[0].label.toUpperCase();
                      if (priceLabel === 'OPEN') return 'Open price';
                      if (priceLabel === 'NOT SET') return 'Not set';
                      return `£${product.prices[0].price.toFixed(2)}`;
                    }
                    const validPrices = product.prices.filter((p) => {
                      const label = p.label.toUpperCase();
                      return label !== 'OPEN' && label !== 'NOT SET';
                    });
                    if (validPrices.length === 0) return 'See options';
                    return `from £${Math.min(...validPrices.map((p) => p.price)).toFixed(2)}`;
                  })()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={'back' as CameraType}
            onBarcodeScanned={(result: { data: string }) => {
              if (result.data) {
                handleBarcodeScanned(result.data);
              }
            }}
          >
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.closeCameraButton}
                onPress={() => setCameraVisible(false)}
                activeOpacity={0.7}
              >
                <X size={32} color="#fff" />
              </TouchableOpacity>

              <View style={styles.scanArea}>
                <View style={styles.scanCorner} />
                <Text style={styles.scanText}>Align barcode within frame</Text>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

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
              .filter((price) => {
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
                    ]}
                    onPress={() => handlePriceSelect(price)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.priceLabel, { color: colors.text }]}>{price.label}</Text>
                    <Text
                      style={[
                        styles.priceAmount,
                        { color: colors.primary },
                      ]}
                    >
                      {isOpen ? 'Enter price' : `£${price.price.toFixed(2)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </Animated.View>
        </View>
      </Modal>

      {notification && (
        <View style={styles.notification}>
          <Text style={styles.notificationText}>{notification}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  productList: {
    padding: 16,
    gap: 12,
    paddingBottom: 110,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
  },
  productBarcode: {
    fontSize: 12,
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeCameraButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    right: '10%',
    height: 200,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCorner: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#f59e0b',
    borderTopLeftRadius: 12,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
  notification: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    backdropFilter: 'blur(20px)',
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
