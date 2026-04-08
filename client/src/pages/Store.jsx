import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShoppingCart,
  faPlus,
  faMinus,
  faTimes,
  faTimesCircle,
  faBox,
  faArrowLeft,
  faCopy,
  faCreditCard,
  faMoneyBillWave,
  faCheck,
  faTags,
  faInfinity,
  faUtensils,
  faChevronRight,
  faCheckCircle,
  faGripVertical,
  faLock,
  faEdit,
  faTrash,
  faFolder,
  faFolderPlus
} from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';
import { SOCKET_URL, getImageUrl } from '../config.js';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PluginSlot from '../components/PluginSlot';
import { PluginProvider } from '../context/PluginContext';

const API = 'https://srservi2.srautomatic.com';

function SortableProductCard({ product, onEdit, onDelete, currencySymbol }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    position: 'relative',
  };

  const isUnlimited = product.unlimited_stock === true || product.unlimited_stock === 1 || product.unlimited_stock === '1';
  const isOutOfStock = !isUnlimited && product.stock === 0;

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`store-product-wrapper${isOutOfStock ? ' out-of-stock' : ''}`}>
        <div className="store-edit-drag-handle" {...attributes} {...listeners}>
          <FontAwesomeIcon icon={faGripVertical} />
        </div>
        <div className={`store-product-card${isOutOfStock ? ' out-of-stock' : ''}`}>
          {isOutOfStock && (
            <div className="out-of-stock-badge">Agotado</div>
          )}
          <div className="store-prod-edit-overlay">
            <button onClick={() => onEdit(product)} className="store-prod-edit-btn">
              <FontAwesomeIcon icon={faEdit} />
            </button>
            <button onClick={() => onDelete(product)} className="store-prod-edit-btn danger">
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
          <div className="store-product-image">
            {product.image ? (
              <img
                src={getImageUrl(product.image)}
                alt={product.name}
                className={isOutOfStock ? 'grayscale' : ''}
              />
            ) : (
              <FontAwesomeIcon icon={faBox} className="placeholder-icon" />
            )}
          </div>
        </div>
        <div className="store-product-info">
          <div className={`store-product-details${isOutOfStock ? ' out-of-stock' : ''}`}>
            <span className="store-product-name">{product.name}:</span>
            <span className="store-product-price">{currencySymbol}{Number(product.price).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Store() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const terminalFromUrl = searchParams.get('terminal');
  const configFromUrl = searchParams.get('config');
  const adminEditToken = searchParams.get('admin_edit');
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderType, setOrderType] = useState('serve');
  const [productConfig, setProductConfig] = useState({
    selectedIngredients: [],
    selectedExtras: [],
    quantity: 1
  });
  const [ingredientsModalOpen, setIngredientsModalOpen] = useState(false);
  const [extrasModalOpen, setExtrasModalOpen] = useState(false);
  const [productModalStep, setProductModalStep] = useState('main');
  const [addingToCart, setAddingToCart] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [lastOrderNumber, setLastOrderNumber] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [availableTerminals, setAvailableTerminals] = useState([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfiguration, setSelectedConfiguration] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [editDragActiveId, setEditDragActiveId] = useState(null);
  const [sessionPin, setSessionPin] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catName, setCatName] = useState('');
  const [pluginPaymentProvider, setPluginPaymentProvider] = useState(null);
  const [pluginPaymentKey, setPluginPaymentKey] = useState(null);
  const [deviceUid] = useState(() => {
    let uid = localStorage.getItem('srservi_device_uid');
    if (!uid) {
      uid = 'dev_' + crypto.randomUUID();
      localStorage.setItem('srservi_device_uid', uid);
    }
    return uid;
  });
  const [adminToken, setAdminToken] = useState(null);
  const [editorTab, setEditorTab] = useState('products');
  const [extras, setExtras] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [complementModal, setComplementModal] = useState(null);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [restartingSending, setRestartingSending] = useState(false);
  const [complementForm, setComplementForm] = useState({ name: '', price: '', type: 'extra', category_id: '', stock: '', unlimited_stock: true, imageFile: null });
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [prodForm, setProdForm] = useState({ name: '', price: '', category_id: '', description: '', stock: '0', unlimited_stock: true });
  const [prodImageFile, setProdImageFile] = useState(null);
  const [prodSaving, setProdSaving] = useState(false);
  const [prodNewExtras, setProdNewExtras] = useState([]);
  const [prodNewIngredients, setProdNewIngredients] = useState([]);
  const longPressTimerRef = useRef(null);
  const categoryRef = useRef(null);
  const storeIdRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    setActiveCategory('all');
    storeIdRef.current = store?.store?.id || null;
  }, [store?.store?.id]);

  useEffect(() => {
    if (selectedConfiguration?.is_minimarket && store?.store?.code) {
      navigate(`/market/${store.store.code}${configFromUrl ? `?config=${configFromUrl}` : ''}`);
    }
  }, [selectedConfiguration, store]);

  useEffect(() => {
    const container = categoryRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cat = entry.target.dataset.category;
            if (cat) setActiveCategory(cat);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    const reobserve = () => {
      const tabs = container.querySelectorAll('.category-tab');
      tabs.forEach((tab) => observer.observe(tab));
    };

    reobserve();
    const mutationObserver = new MutationObserver(reobserve);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [cashPaymentSuccess, setCashPaymentSuccess] = useState(false);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(90);
  const [notification, setNotification] = useState(null);
  const [barcode, setBarcode] = useState('');
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchStore();

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Conectado al servidor WebSocket');
      if (storeIdRef.current) {
        socket.emit('register_store', storeIdRef.current);
      }
    });

    socket.on('product_created', (product) => {
      console.log('Producto creado en tiempo real:', product);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: [...prev.products, product]
        };
      });
    });

    socket.on('product_updated', (product) => {
      console.log('Producto actualizado en tiempo real:', product);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.map(p => p.id === product.id ? product : p)
        };
      });
    });

    socket.on('product_deleted', (data) => {
      console.log('Producto eliminado en tiempo real:', data);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.filter(p => p.id !== data.id)
        };
      });
    });

    socket.on('category_created', () => fetchStore());
    socket.on('category_updated', () => fetchStore());
    socket.on('category_deleted', () => fetchStore());
    socket.on('ingredient_created', () => fetchStore());
    socket.on('ingredient_updated', () => fetchStore());
    socket.on('ingredient_deleted', () => fetchStore());
    socket.on('extra_created', () => fetchStore());
    socket.on('extra_updated', () => fetchStore());
    socket.on('extra_deleted', () => fetchStore());
    socket.on('inventory_updated', (data) => {
      console.log('Inventario actualizado en tiempo real:', data);
      setStore(prev => {
        if (!prev) return prev;
        const updatedProducts = prev.products.map(product => {
          if (product.id === data.product_id) {
            return {
              ...product,
              stock: data.stock !== undefined ? data.stock : product.stock,
              unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : product.unlimited_stock
            };
          }
          if (product.ingredients) {
            product.ingredients = product.ingredients.map(ing => {
              if (ing.id === data.product_id) {
                return {
                  ...ing,
                  stock: data.stock !== undefined ? data.stock : ing.stock,
                  unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : ing.unlimited_stock
                };
              }
              return ing;
            });
          }
          if (product.extras) {
            product.extras = product.extras.map(ext => {
              if (ext.id === data.product_id) {
                return {
                  ...ext,
                  stock: data.stock !== undefined ? data.stock : ext.stock,
                  unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : ext.unlimited_stock
                };
              }
              return ext;
            });
          }
          return product;
        });
        return { ...prev, products: updatedProducts };
      });
    });

    socket.on('totem_restart', (data) => {
      // Only restart if this is not the admin editor and matches our store
      if (!adminEditToken && storeIdRef.current && data.store_id === storeIdRef.current) {
        showRestartNotification(5);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, terminalFromUrl]);

  useEffect(() => {
    if (store?.store?.id && socketRef.current?.connected) {
      socketRef.current.emit('register_store', store.store.id);
    }
  }, [store?.store?.id]);

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/public/${code}`, { cache: 'no-store' });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Código no encontrado');
        }
        if (response.status === 403) {
          const data = await response.json();
          throw new Error(data.error || 'Tienda suspendida');
        }
        throw new Error('Error al cargar la tienda');
      }

      const data = await response.json();
      const uniqueProducts = (data.products || []).filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      );
      const uniqueCategories = (data.categories || []).filter((cat, index, self) =>
        index === self.findIndex((c) => c.id === cat.id)
      );
      const uniqueIngredients = (data.ingredients || []).filter((ing, index, self) =>
        index === self.findIndex((i) => i.id === ing.id)
      );
      const uniqueExtras = (data.extras || []).filter((ext, index, self) =>
        index === self.findIndex((e) => e.id === ext.id)
      );
      const deduplicatedData = {
        ...data,
        products: uniqueProducts,
        categories: uniqueCategories,
        ingredients: uniqueIngredients,
        extras: uniqueExtras
      };
      console.log('Store data received:', deduplicatedData);
      console.log('Number of products:', deduplicatedData.products?.length || 0);
      setStore(deduplicatedData);

      const terminalsResponse = await fetch(`/api/public/${code}/mercado-pago-terminals`);
      if (terminalsResponse.ok) {
        const terminalsData = await terminalsResponse.json();
        const safeTerminals = Array.isArray(terminalsData) ? terminalsData : [];
        setAvailableTerminals(safeTerminals);
        const hasTerminalFromUrl = terminalFromUrl && safeTerminals.some(terminal => String(terminal.id) === String(terminalFromUrl));
        setSelectedTerminalId(prev =>
          hasTerminalFromUrl
            ? String(terminalFromUrl)
            : (prev && safeTerminals.some(terminal => String(terminal.id) === String(prev)))
            ? prev
            : (safeTerminals[0]?.id ? String(safeTerminals[0].id) : '')
        );
      } else {
        setAvailableTerminals([]);
        setSelectedTerminalId('');
      }

      let configsData = [];
      const configsResponse = await fetch(`/api/public/store-configurations/${data.store.id}`);
      if (configsResponse.ok) {
        configsData = await configsResponse.json();
        setConfigurations(configsData);

        if (configFromUrl) {
          const urlConfig = configsData.find(c => String(c.id) === String(configFromUrl));
          setSelectedConfiguration(urlConfig || null);
        } else {
          const defaultConfig = configsData.find(c => c.is_default) || configsData[0];
          setSelectedConfiguration(defaultConfig || null);
        }
      } else {
        setConfigurations([]);
        setSelectedConfiguration(null);
      }

      // Auto-enter edit mode if admin token
      if (adminEditToken) {
        try {
          const vRes = await fetch(`/api/public/${code}/validate-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminEditToken })
          });
          const vData = await vRes.json();
          if (vData.valid) {
            setAdminToken(adminEditToken);
            setEditMode(true);
            setSessionPin('admin');
          }
        } catch { /* ignore */ }
      }

      // Register this device
      fetch(`/api/public/${code}/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_uid: deviceUid })
      }).catch(() => {});

      // Load device-specific config
      try {
        const dcRes = await fetch(`/api/public/device-config/${deviceUid}/${data.store.id}`);
        if (dcRes.ok) {
          const dc = await dcRes.json();
          // Apply assigned configuration
          if (dc.config_id && configsData) {
            const assigned = configsData.find(c => c.id === dc.config_id);
            if (assigned) setSelectedConfiguration(assigned);
          }
          // Pending restart (admin changed config)
          if (dc.pending_restart) {
            const delay = parseInt(dc.restart_time) || 10;
            showRestartNotification(delay);
          }
        }
      } catch { /* ignore */ }

      // Check if a plugin payment provider is available
      try {
        const ppRes = await fetch(`/api/plugins/payments/provider?store_id=${data.store.id}&device_uid=${deviceUid}`);
        if (ppRes.ok) {
          const ppData = await ppRes.json();
          if (ppData.available) setPluginPaymentProvider(ppData);
        }
      } catch { /* no payment plugin, ignore */ }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const colors = store?.store ? {
    primary: store.store.primary_color || '#000000',
    secondary: store.store.secondary_color || '#FFFFFF',
    accent: store.store.accent_color || '#D4AF37',
    header: store.store.header_color || '#000000',
    currency: {
      symbol: store.store.currency_symbol || '$',
      code: store.store.currency_code || 'USD',
      name: store.store.currency_name || 'Dólar Estadounidense'
    }
  } : {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#D4AF37',
    header: '#000000',
    currency: {
      symbol: '$',
      code: 'USD',
      name: 'Dólar Estadounidense'
    }
  };

  const openProductModal = (product) => {
    if (!product.unlimited_stock && product.stock === 0) {
      setNotification({ name: product.name, agotado: true });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    setSelectedProduct(product);
    setProductConfig({
      selectedIngredients: [],
      selectedExtras: [],
      quantity: 1,
      notes: ''
    });

    const hasIngredients = product.ingredients && product.ingredients.length > 0;

    if (hasIngredients) {
      setProductModalStep('complements');
      setTimeout(() => setIngredientsModalOpen(true), 100);
    } else {
      setProductModalStep('main');
      setTimeout(() => addToCart(), 100);
    }
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setProductModalStep('main');
    setAddingToCart(false);
    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
  };

  const anyModalOpen = pinModalOpen || prodModalOpen || catModalOpen || complementModal || showRestartConfirm || editMode || ingredientsModalOpen || extrasModalOpen || paymentModalOpen || cartOpen;

  useEffect(() => {
    if (anyModalOpen) return;
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus({ preventScroll: true });
    }
    const interval = setInterval(() => {
      if (anyModalOpen) return;
      if (barcodeInputRef.current && document.activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current.focus({ preventScroll: true });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [anyModalOpen]);

  const handleBarcodeScan = (barcodeValue) => {
    if (!store?.products) return;
    const found = store.products.find(p => p.barcode === barcodeValue);
    if (found) {
      if (!found.unlimited_stock && found.stock === 0) {
        setNotification({ name: found.name, agotado: true });
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      setNotification({ name: found.name, image: found.image });
      setTimeout(() => setNotification(null), 2000);
      const unitPrice = found.price;
      const cartItem = {
        id: Date.now(),
        product_id: found.id,
        product_name: found.name,
        product_image: found.image,
        unit_price: unitPrice,
        quantity: 1,
        total: unitPrice
      };
      setCart([...cart, cartItem]);
    } else if (barcodeValue.length > 0) {
      setNotification({ name: 'Producto no encontrado', image: null });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const toggleIngredient = (ingredient) => {
    const isOutOfStock = !ingredient.unlimited_stock && ingredient.stock === 0;
    if (isOutOfStock) {
      return;
    }
    setProductConfig(prev => {
      const exists = prev.selectedIngredients.find(i => i.id === ingredient.id);
      if (exists) {
        return {
          ...prev,
          selectedIngredients: prev.selectedIngredients.filter(i => i.id !== ingredient.id)
        };
      } else {
        const ingredientConfig = selectedProduct.ingredients.find(i => i.id === ingredient.id);
        const maxSelections = ingredientConfig?.max_selections || 1;
        if (prev.selectedIngredients.length >= maxSelections) {
          alert(`Solo puedes seleccionar máximo ${maxSelections} ingrediente(s) de "${ingredientConfig.name}"`);
          return prev;
        }
        return {
          ...prev,
          selectedIngredients: [...prev.selectedIngredients, ingredient]
        };
      }
    });
  };

  const toggleExtra = (extra) => {
    const isOutOfStock = !extra.unlimited_stock && extra.stock === 0;
    if (isOutOfStock) {
      return;
    }
    setProductConfig(prev => {
      const exists = prev.selectedExtras.find(e => e.id === extra.id);
      if (exists) {
        return {
          ...prev,
          selectedExtras: prev.selectedExtras.filter(e => e.id !== extra.id)
        };
      } else {
        return {
          ...prev,
          selectedExtras: [...prev.selectedExtras, extra]
        };
      }
    });
  };

  const calculateProductPrice = () => {
    if (!selectedProduct) return 0;

    let price = selectedProduct.price;

    productConfig.selectedIngredients.forEach(ing => {
      price += ing.price || 0;
    });

    productConfig.selectedExtras.forEach(extra => {
      price += extra.price || 0;
    });

    return price;
  };

  const addToCart = () => {
    if (!selectedProduct) return;

    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);

    const unitPrice = calculateProductPrice();
    const cartItem = {
      id: Date.now(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_image: selectedProduct.image,
      unit_price: unitPrice,
      quantity: productConfig.quantity,
      total: unitPrice * productConfig.quantity,
      selected_ingredients: productConfig.selectedIngredients.map(i => i.name),
      selected_extras: productConfig.selectedExtras.map(e => e.name)
    };

    setCart([...cart, cartItem]);
    setNotification({ name: selectedProduct.name, image: selectedProduct.image });
    setProductModalStep('main');
    closeProductModal();
    setTimeout(() => setNotification(null), 1500);
  };

  const handleNextToExtras = () => {
    const requiredIngredients = selectedProduct.ingredients.filter(ing => ing.is_required);
    const missingRequired = requiredIngredients.filter(req =>
      !productConfig.selectedIngredients.some(sel => sel.id === req.id)
    );

    if (missingRequired.length > 0) {
      alert(`Por favor selecciona los siguientes ingredientes obligatorios:\n${missingRequired.map(i => '- ' + i.name).join('\n')}`);
      return;
    }
    setIngredientsModalOpen(false);

    if (selectedProduct.extras && selectedProduct.extras.length > 0) {
      setProductModalStep('extras');
      setTimeout(() => setExtrasModalOpen(true), 100);
    } else {
      setTimeout(() => addToCart(), 100);
    }
  };

  const handleBackToMain = () => {
    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
    setProductModalStep('main');
  };

  const handleBackToComplements = () => {
    setExtrasModalOpen(false);
    setProductModalStep('complements');
    setTimeout(() => setIngredientsModalOpen(true), 100);
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity > 0) {
          return {
            ...item,
            quantity: newQuantity,
            total: Number(item.unit_price) * newQuantity
          };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  const getFinalTotal = () => {
    const subtotal = getCartTotal();
    const discount = Number(appliedCoupon?.discount_total || 0);
    return Math.max(subtotal - discount, 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    alert('Código copiado: ' + code);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCartOpen(false);
    setPaymentModalOpen(true);
  };

  const applyCoupon = async () => {
    if (!couponCodeInput.trim() || cart.length === 0) return;
    try {
      setCouponLoading(true);
      const response = await fetch(`/api/public/${code}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_code: couponCodeInput.trim(),
          subtotal: getCartTotal()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo aplicar el cupón');
      }
      setAppliedCoupon(data);
      setCouponCodeInput(data.coupon_code || couponCodeInput.trim().toUpperCase());
    } catch (err) {
      alert(err.message);
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
  };

  const processPayment = async (selectedMethod = paymentMethod) => {
    if (cart.length === 0) return;
    const hasPluginProvider = selectedMethod === 'card' && pluginPaymentProvider;
    if (selectedMethod === 'card' && !hasPluginProvider && !selectedTerminalId) {
      alert('No hay máquina de pago asignada para esta sesión');
      return;
    }

    setPaymentMethod(selectedMethod);
    setProcessingPayment(true);
    setPaymentError(null);
    setPaymentConfirmed(false);
    setPaymentCancelled(false);

    const finalTotal = getFinalTotal();
    const storeId = store.store.id;
    const cartItems = cart.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      selected_ingredients: item.selected_ingredients,
      selected_extras: item.selected_extras
    }));

    try {
      // --- Plugin payment provider (Tuu, etc.) ---
      if (hasPluginProvider) {
        // Create order first
        const orderRes = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: 'card',
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2)
          })
        });
        if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
        const order = await orderRes.json();
        setPendingOrderData({ order, storeId });

        // Charge via generic payment API
        const chargeRes = await fetch('/api/plugins/payments/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_id: order.id,
            amount: Math.round(Number(finalTotal)),
            description: `Pedido #${order.order_number || order.id}`,
            device_uid: deviceUid
          })
        });
        const chargeData = await chargeRes.json();
        if (!chargeData.success) throw new Error(chargeData.error || 'Error al enviar cobro');

        setPluginPaymentKey(chargeData.paymentKey);
        setPaymentWaiting(true);
        setPaymentTimeLeft(300);

      // --- MercadoPago card ---
      } else if (selectedMethod === 'card') {
        const response = await fetch(API + '/api/orders/process-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: selectedMethod,
            items: cartItems, selected_terminal_id: selectedTerminalId ? parseInt(selectedTerminalId) : null,
            coupon_code: appliedCoupon?.coupon_code || null, total: Number(finalTotal).toFixed(2)
          })
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al procesar');
        const result = await response.json();
        setPendingOrderData({ order: result.order || result, storeId });
        setPaymentWaiting(true);
        setPaymentTimeLeft(90);

      // --- Cash ---
      } else {
        const response = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: selectedMethod,
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2)
          })
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al procesar');
        const order = await response.json();
        setPendingOrderData({ order, storeId });
        setLastOrderNumber(order.order_number);
        setCashPaymentSuccess(true);
        setPaymentModalOpen(false);
        setCart([]);
        setCartOpen(false);
      }
    } catch (err) {
      setPaymentError(err.message);
      alert(err.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  useEffect(() => {
    if (!paymentWaiting || !pendingOrderData) return;

    const orderId = pendingOrderData.order.id;
    const storeId = pendingOrderData.storeId;
    const isPluginPayment = !!pluginPaymentKey;

    const onPaymentSuccess = () => {
      setPaymentConfirmed(true);
      setLastOrderNumber(pendingOrderData.order.order_number);
      setCart([]);
      setCartOpen(false);
      setPaymentModalOpen(false);
      setPaymentWaiting(false);
      setPluginPaymentKey(null);
    };

    const onPaymentFail = () => {
      setPaymentWaiting(false);
      setPaymentCancelled(true);
      setPluginPaymentKey(null);
    };

    const pollInterval = setInterval(async () => {
      try {
        if (isPluginPayment) {
          // --- Generic plugin payment polling ---
          const res = await fetch(`/api/plugins/payments/status/${pluginPaymentKey}`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.status === 'Completed') {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentSuccess();
          } else if (['Canceled', 'Failed', 'Timeout'].includes(data.status)) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentFail();
          }
        } else {
          // --- MercadoPago polling ---
          const res = await fetch(`/api/orders/${orderId}/payment-status?store_id=${storeId}`);
          if (!res.ok) return;
          const data = await res.json();

          const mpStatus = data.mp_status || data.status;
          const payStatus = data.payment_status || data.status;
          const paidAmount = data.paid_amount || '0';

          const isApproved =
            (payStatus === 'approved' || payStatus === 'paid' || payStatus === 'processed' ||
             mpStatus === 'processed') &&
            (parseFloat(paidAmount) > 0 || payStatus === 'processed' || mpStatus === 'processed');
          const isCancelled = mpStatus === 'canceled' || mpStatus === 'refunded' ||
            mpStatus === 'expired' || mpStatus === 'failed' ||
            payStatus === 'canceled' || payStatus === 'refunded' ||
            data.order_status === 'canceled' || data.order_status === 'refunded';

          if (isApproved) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            await fetch(`/api/orders/${orderId}/confirm-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ store_id: storeId })
            });
            onPaymentSuccess();
          } else if (isCancelled) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentFail();
          }
        }
      } catch (err) {
        console.error('Error polling payment status:', err);
      }
    }, 5000);

    const timerInterval = setInterval(() => {
      setPaymentTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          clearInterval(pollInterval);
          if (isPluginPayment && pluginPaymentKey) {
            fetch(`/api/plugins/payments/cancel/${pluginPaymentKey}`, { method: 'POST' });
          }
          onPaymentFail();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [paymentWaiting, pendingOrderData, pluginPaymentKey]);

  useEffect(() => {
    setAppliedCoupon(null);
  }, [cart]);

  const fetchComplements = async () => {
    try {
      const [exRes, inRes] = await Promise.all([
        fetch(`/api/public/${code}/extras`),
        fetch(`/api/public/${code}/ingredients`)
      ]);
      if (exRes.ok) setExtras(await exRes.json());
      if (inRes.ok) setIngredients(await inRes.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (editMode && adminToken) fetchComplements();
  }, [editMode, adminToken]);

  const saveComplement = async () => {
    if (!complementForm.name.trim()) return;
    const type = complementForm.type;
    const formData = new FormData();
    formData.append('token', adminToken);
    formData.append('name', complementForm.name.trim());
    formData.append('price', parseFloat(complementForm.price) || 0);
    formData.append('category_id', complementForm.category_id || '');
    formData.append('stock', parseInt(complementForm.stock) || 0);
    formData.append('unlimited_stock', complementForm.unlimited_stock);
    if (complementForm.imageFile) formData.append('image', complementForm.imageFile);

    await fetch(`/api/public/${code}/${type === 'extra' ? 'extras' : 'ingredients'}`, {
      method: 'POST',
      body: formData
    });
    setComplementModal(null);
    setComplementForm({ name: '', price: '', type: 'extra', category_id: '', stock: '', unlimited_stock: true, imageFile: null });
    fetchComplements();
    fetchStore();
  };

  const deleteComplement = async (type, id) => {
    if (!confirm('¿Eliminar?')) return;
    await fetch(`/api/public/${code}/${type === 'extra' ? 'extras' : 'ingredients'}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: adminToken })
    });
    fetchComplements();
    fetchStore();
  };

  const updateProductStock = async (productId, stock, unlimitedStock) => {
    await fetch(`/api/public/${code}/products/${productId}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: adminToken, stock, unlimited_stock: unlimitedStock })
    });
    fetchStore();
  };

  const getAuthBody = () => adminToken ? { token: adminToken } : { pin: sessionPin };

  const showRestartNotification = (delaySec) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);color:#fff;font-family:sans-serif;';
    const countdownEl = document.createElement('div');
    overlay.innerHTML = `
      <div style="font-size:48px;margin-bottom:16px;">&#x1F504;</div>
      <h2 style="margin:0 0 8px;font-size:22px;text-align:center;">El administrador realizó cambios</h2>
      <p style="margin:0 0 20px;font-size:16px;color:#ccc;text-align:center;">Este totem será reiniciado</p>
    `;
    countdownEl.style.cssText = 'font-size:36px;font-weight:bold;color:#D4AF37;';
    countdownEl.textContent = delaySec;
    overlay.appendChild(countdownEl);
    document.body.appendChild(overlay);

    let remaining = delaySec;
    const interval = setInterval(() => {
      remaining--;
      countdownEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        window.location.reload();
      }
    }, 1000);
  };

  const groupProductsByCategory = () => {
    if (!store?.products) return {};

    const grouped = {};
    store.products.forEach(product => {
      if (!product.category_name) return; // sin categoría solo aparece en "Todo"
      if (!grouped[product.category_name]) {
        grouped[product.category_name] = [];
      }
      grouped[product.category_name].push(product);
    });

    return grouped;
  };

  const handleLongPressStart = () => {
    if (editMode) return;
    longPressTimerRef.current = setTimeout(() => {
      setPinInput('');
      setPinError('');
      setPinModalOpen(true);
    }, 10000);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePinSubmit = async (pinValue) => {
    const pin = pinValue || pinInput;
    if (!pin || pin.length < 4) return;
    try {
      const response = await fetch(`/api/public/${code}/verify-edit-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await response.json();
      if (data.valid) {
        setSessionPin(pin);
        setEditMode(true);
        setPinModalOpen(false);
        setPinInput('');
        setPinError('');
      } else {
        setPinError('PIN incorrecto');
        setPinInput('');
      }
    } catch {
      setPinError('Error al verificar PIN');
      setPinInput('');
    }
  };

  const editSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleEditDragStart = (event) => {
    setEditDragActiveId(event.active.id);
  };

  const handleEditDragEnd = async (event) => {
    const { active, over } = event;
    setEditDragActiveId(null);

    if (!over || active.id === over.id || !store?.products) return;

    const allProducts = [...store.products];
    const oldIndex = allProducts.findIndex(p => p.id === active.id);
    const newIndex = allProducts.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newProducts = arrayMove(allProducts, oldIndex, newIndex);
    setStore(prev => ({ ...prev, products: newProducts }));

    try {
      await fetch(`/api/public/${code}/products/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...getAuthBody(),
          products: newProducts.map(p => ({ id: p.id }))
        })
      });
    } catch (error) {
      console.error('Error saving order:', error);
    }
  };

  const openCatModal = (cat = null) => {
    setEditingCat(cat);
    setCatName(cat ? cat.name : '');
    setCatModalOpen(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    try {
      const url = editingCat
        ? `/api/public/${code}/categories/${editingCat.id}`
        : `/api/public/${code}/categories`;
      await fetch(url, {
        method: editingCat ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getAuthBody(), name: catName.trim() })
      });
      setCatModalOpen(false);
      setCatName('');
      setEditingCat(null);
      fetchStore();
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const deleteCat = async (cat) => {
    if (!confirm(`¿Eliminar "${cat.name}"? Los productos quedarán sin categoría.`)) return;
    try {
      await fetch(`/api/public/${code}/categories/${cat.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthBody())
      });
      fetchStore();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const openProdModal = (product = null) => {
    setEditingProd(product);
    setProdForm({
      name: product?.name || '',
      price: product?.price?.toString() || '',
      category_id: product?.category_id?.toString() || '',
      description: product?.description || '',
      stock: product?.stock?.toString() || '0',
      unlimited_stock: product?.unlimited_stock ?? true
    });
    setProdImageFile(null);
    setProdNewExtras([]);
    setProdNewIngredients([]);
    setProdModalOpen(true);
  };

  const saveProd = async () => {
    if (!prodForm.name.trim() || !prodForm.price) return;
    setProdSaving(true);
    try {
      const formData = new FormData();
      if (adminToken) formData.append('token', adminToken);
      else formData.append('pin', sessionPin);
      formData.append('name', prodForm.name.trim());
      formData.append('price', parseFloat(prodForm.price));
      formData.append('category_id', prodForm.category_id || '');
      formData.append('description', prodForm.description || '');
      if (prodImageFile) {
        formData.append('image', prodImageFile);
      } else if (editingProd) {
        formData.append('keep_image', 'true');
      }

      const url = editingProd
        ? `/api/public/${code}/products/${editingProd.id}`
        : `/api/public/${code}/products`;

      await fetch(url, {
        method: editingProd ? 'PUT' : 'POST',
        body: formData
      });

      // Update stock if admin editor
      if (adminToken) {
        const prodData = await (await fetch(`/api/public/${code}`, { cache: 'no-store' })).json();
        const lastProd = editingProd ? editingProd : prodData.products?.[prodData.products.length - 1];
        if (lastProd?.id) {
          await updateProductStock(lastProd.id, parseInt(prodForm.stock) || 0, prodForm.unlimited_stock);
        }
      }

      // Create new complements (extras & ingredients) if any
      if (adminToken) {
        const categoryId = prodForm.category_id || '';
        for (const ext of prodNewExtras) {
          if (!ext.name.trim()) continue;
          const extData = new FormData();
          extData.append('token', adminToken);
          extData.append('name', ext.name.trim());
          extData.append('price', parseFloat(ext.price) || 0);
          extData.append('category_id', categoryId);
          extData.append('stock', 0);
          extData.append('unlimited_stock', true);
          await fetch(`/api/public/${code}/extras`, { method: 'POST', body: extData });
        }
        for (const ing of prodNewIngredients) {
          if (!ing.name.trim()) continue;
          const ingData = new FormData();
          ingData.append('token', adminToken);
          ingData.append('name', ing.name.trim());
          ingData.append('price', parseFloat(ing.price) || 0);
          ingData.append('category_id', categoryId);
          ingData.append('stock', 0);
          ingData.append('unlimited_stock', true);
          await fetch(`/api/public/${code}/ingredients`, { method: 'POST', body: ingData });
        }
        if (prodNewExtras.length > 0 || prodNewIngredients.length > 0) {
          fetchComplements();
        }
      }

      setProdModalOpen(false);
      setEditingProd(null);
      setProdImageFile(null);
      setProdNewExtras([]);
      setProdNewIngredients([]);
      fetchStore();
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setProdSaving(false);
    }
  };

  const deleteProd = async (product) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await fetch(`/api/public/${code}/products/${product.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthBody())
      });
      fetchStore();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        Cargando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="index-container">
        <div className="index-card">
          <h1 className="index-title" style={{ color: '#DC3545' }}>Error</h1>
          <p className="index-subtitle">{error}</p>
          <button
            className="btn btn-secondary w-full"
            onClick={() => navigate('/')}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const groupedProducts = groupProductsByCategory();
  const hasProducts = (store?.products || []).length > 0;

  const renderProductCard = (product) => {
    const isUnlimited = product.unlimited_stock === true || product.unlimited_stock === 1 || product.unlimited_stock === '1';
    const isOutOfStock = !isUnlimited && product.stock === 0;
    return (
      <div
        key={product.id}
        className={`store-product-wrapper${isOutOfStock ? ' out-of-stock' : ''}`}
      >
        <div
          className={`store-product-card${isOutOfStock ? ' out-of-stock' : ''}`}
          onClick={() => !editMode && openProductModal(product)}
        >
          {isOutOfStock && (
            <div className="out-of-stock-badge">
              Agotado
            </div>
          )}
          {editMode && (
            <div className="store-prod-edit-overlay">
              <button onClick={(e) => { e.stopPropagation(); openProdModal(product); }} className="store-prod-edit-btn">
                <FontAwesomeIcon icon={faEdit} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteProd(product); }} className="store-prod-edit-btn danger">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          )}
          <div className="store-product-image">
            {product.image ? (
              <img
                src={getImageUrl(product.image)}
                alt={product.name}
                className={isOutOfStock ? 'grayscale' : ''}
              />
            ) : (
              <FontAwesomeIcon icon={faBox} className="placeholder-icon" />
            )}
          </div>
        </div>
        <div className="store-product-info">
          <div className={`store-product-details${isOutOfStock ? ' out-of-stock' : ''}`}>
            <span className="store-product-name">{product.name}:</span>
            <span className="store-product-price">{colors.currency.symbol}{Number(product.price).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderAddProductCard = () => (
    <div className="store-product-wrapper" key="add-product">
      <div className="store-product-card store-add-card" onClick={() => openProdModal()}>
        <FontAwesomeIcon icon={faPlus} className="store-add-icon" />
      </div>
      <div className="store-product-info">
        <div className="store-product-details">
          <span className="store-product-name">Nuevo producto</span>
        </div>
      </div>
    </div>
  );

  return (
    <PluginProvider mode="store" isPremium={!!store?.store?.is_premium}>
    <div
      className="store-container"
      style={{ '--store-primary': colors.primary, '--store-secondary': colors.secondary, '--store-accent': colors.accent, '--store-header': colors.header || colors.primary }}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
      onTouchMove={handleLongPressEnd}
      onMouseDown={handleLongPressStart}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
    >
      <header className="store-header">
        {store?.store?.is_premium ? (
          <div className="store-header-content">
            <div className="store-header-brand">
              {store?.store?.logo_url && (
                <img
                  src={store.store.logo_url}
                  alt={store?.store?.name}
                  className="store-header-logo"
                />
              )}
              <h1 className="store-header-name">
                {store?.store?.name}
              </h1>
            </div>
            <p className="store-header-powered">
              AutoServicio By SRAutomatic
            </p>
          </div>
        ) : (
          <div className="flex" style={{ justifyContent: 'flex-end' }}>
            <p className="store-header-powered">
              AutoServicio By SRAutomatic
            </p>
          </div>
        )}
      </header>

      <PluginSlot name="store-header" context={{ storeId: store?.store?.id, code }} />

      <div className="category-tabs">
        <div
          ref={categoryRef}
          className="category-tabs-list"
        >
        <button
          className={`category-tab${activeCategory === 'all' ? ' active' : ''}`}
          data-category="all"
          onClick={() => setActiveCategory('all')}
        >
          Todo
        </button>
        {(editMode ? (store?.categories || []).map(c => c.name) : Object.keys(groupedProducts)).map(cat => {
          const catObj = (store?.categories || []).find(c => c.name === cat);
          return (
            <button
              key={cat}
              className={`category-tab${activeCategory === cat ? ' active' : ''}`}
              data-category={cat}
              onClick={() => !editMode && setActiveCategory(cat)}
            >
              {cat}
              {editMode && catObj && (
                <span className="cat-tab-edit-icons">
                  <span onClick={(e) => { e.stopPropagation(); openCatModal(catObj); }}><FontAwesomeIcon icon={faEdit} /></span>
                  <span onClick={(e) => { e.stopPropagation(); deleteCat(catObj); }} className="cat-tab-del"><FontAwesomeIcon icon={faTrash} /></span>
                </span>
              )}
            </button>
          );
        })}
        {editMode && (
          <button className="category-tab cat-tab-add" onClick={() => openCatModal()}>
            <FontAwesomeIcon icon={faFolderPlus} />
          </button>
        )}
        </div>
      </div>

      {!hasProducts && (
        <div className="store-empty">
          <div className="store-empty-icon" style={{ background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}40)` }}>
            <FontAwesomeIcon icon={faBox} style={{ color: colors.accent }} />
          </div>
          <h2>
            Esta tienda aún no tiene productos
          </h2>
          <p>
            El propietario aún no ha agregado productos a su catálogo. ¡Vuelve pronto!
          </p>
        </div>
      )}

      {editMode && (
        <div className="store-editor-bar">
          <div className="store-editor-tabs">
            <button className={`store-editor-tab${editorTab === 'products' ? ' active' : ''}`} onClick={() => setEditorTab('products')}>
              <FontAwesomeIcon icon={faBox} /> Productos
            </button>
            {adminToken && (
              <button className={`store-editor-tab${editorTab === 'complements' ? ' active' : ''}`} onClick={() => setEditorTab('complements')}>
                <FontAwesomeIcon icon={faPlus} /> Complementos
              </button>
            )}
          </div>
          <button className="store-editor-done" onClick={() => { if (adminToken) { setShowRestartConfirm(true); } else { setEditMode(false); } }}>
            Listo
          </button>
        </div>
      )}

      {editMode && editorTab === 'complements' && adminToken && (
        <div className="store-editor-complements">
          <div className="store-editor-comp-header">
            <span>Extras ({extras.length})</span>
            <button className="store-edit-cat-add-btn" onClick={() => { setComplementForm({ ...complementForm, type: 'extra' }); setComplementModal('extra'); }}>
              <FontAwesomeIcon icon={faPlus} /> Nuevo
            </button>
          </div>
          <div className="store-editor-comp-list">
            {extras.map(e => (
              <div key={e.id} className="store-editor-comp-item">
                {e.image && <img src={getImageUrl(e.image)} alt="" className="store-editor-comp-img" />}
                <div className="store-editor-comp-info">
                  <strong>{e.name}</strong>
                  {Number(e.price) > 0 && <span className="store-editor-comp-price">+${Number(e.price).toFixed(0)}</span>}
                </div>
                <button onClick={() => deleteComplement('extra', e.id)} className="store-prod-edit-btn danger" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
            {extras.length === 0 && <span style={{ color: '#999', fontSize: '13px', padding: '8px' }}>Sin extras</span>}
          </div>

          <div className="store-editor-comp-header" style={{ marginTop: '12px' }}>
            <span>Ingredientes ({ingredients.length})</span>
            <button className="store-edit-cat-add-btn" onClick={() => { setComplementForm({ ...complementForm, type: 'ingredient' }); setComplementModal('ingredient'); }}>
              <FontAwesomeIcon icon={faPlus} /> Nuevo
            </button>
          </div>
          <div className="store-editor-comp-list">
            {ingredients.map(i => (
              <div key={i.id} className="store-editor-comp-item">
                {i.image && <img src={getImageUrl(i.image)} alt="" className="store-editor-comp-img" />}
                <div className="store-editor-comp-info">
                  <strong>{i.name}</strong>
                  {Number(i.price) > 0 && <span className="store-editor-comp-price">+${Number(i.price).toFixed(0)}</span>}
                </div>
                <button onClick={() => deleteComplement('ingredient', i.id)} className="store-prod-edit-btn danger" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
            {ingredients.length === 0 && <span style={{ color: '#999', fontSize: '13px', padding: '8px' }}>Sin ingredientes</span>}
          </div>
        </div>
      )}


      {!editMode && activeCategory === 'all' && hasProducts && (
        <div className="category-sections">
          {(() => {
            const uncategorized = (store?.products || []).filter(p => !p.category_name);
            return uncategorized.length > 0 ? (
              <div className="products-grid">
                {uncategorized.map(product => renderProductCard(product))}
              </div>
            ) : null;
          })()}
          {Object.entries(groupedProducts).map(([category, products]) => (
            <div key={category} className="category-section">
              <div className="category-section-header">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon
                    icon={faTags}
                    className="category-section-icon"
                  />
                  <h3 className="category-section-title">
                    {category}
                  </h3>
                </div>
                <div className="category-section-line" />
              </div>
              <div className="products-grid">
                {products.map(product => renderProductCard(product))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!editMode && activeCategory !== 'all' && hasProducts && (
        <div className="products-grid">
          {Object.entries(groupedProducts)
            .filter(([category]) => activeCategory === category)
            .flatMap(([category, products]) =>
              products.map(product => renderProductCard(product))
            )}
        </div>
      )}

      {editMode && editorTab === 'products' && (
        <DndContext
          sensors={editSensors}
          collisionDetection={closestCenter}
          onDragStart={handleEditDragStart}
          onDragEnd={handleEditDragEnd}
        >
          <SortableContext
            items={(store?.products || []).map(p => p.id)}
            strategy={rectSortingStrategy}
          >
            <div className="products-grid" style={{ padding: '0 16px' }}>
              {(store?.products || []).map(product => (
                <SortableProductCard key={product.id} product={product} onEdit={openProdModal} onDelete={deleteProd} currencySymbol={colors.currency.symbol} />
              ))}
              {renderAddProductCard()}
            </div>
          </SortableContext>
          <DragOverlay>
            {editDragActiveId ? (() => {
              const product = store?.products?.find(p => p.id === editDragActiveId);
              if (!product) return null;
              return (
                <div className="store-product-wrapper" style={{ opacity: 0.8 }}>
                  <div className="store-product-card">
                    <div className="store-product-image">
                      {product.image ? (
                        <img src={getImageUrl(product.image)} alt={product.name} />
                      ) : (
                        <FontAwesomeIcon icon={faBox} className="placeholder-icon" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      <PluginSlot name="store-footer" context={{ storeId: store?.store?.id, code }} />

      {hasProducts && (
      <div className="cart-bar">
        <div className="cart-bar-left" onClick={() => setCartOpen(true)}>
          <div className="cart-bar-icon">
            <FontAwesomeIcon icon={faShoppingCart} />
            <span className="cart-bar-count">{getCartCount()}</span>
          </div>
          <span className="cart-bar-text">Ver carrito</span>
        </div>
        <div className="cart-bar-right">
          <span className="cart-bar-total">
            {colors.currency.symbol}{Number(getCartTotal()).toFixed(2)}
          </span>
          <button
            onClick={() => setCartOpen(true)}
            className="cart-bar-pay-btn"
          >
            PAGAR
          </button>
        </div>
      </div>
      )}

      {notification && (
        <div className="toast">
          {notification.image ? (
            <img
              src={getImageUrl(notification.image)}
              alt={notification.name}
              className="toast-image"
            />
          ) : (
            <div className="toast-placeholder">
              <FontAwesomeIcon icon={faBox} />
            </div>
          )}
          <div>
            <div className="toast-name">{notification.name}</div>
            {notification.agotado ? (
              <div className="toast-status-soldout">Agotado</div>
            ) : (
              <div className="toast-status-added">Agregado <FontAwesomeIcon icon={faCheck} /></div>
            )}
          </div>
        </div>
      )}

      <input
        ref={barcodeInputRef}
        type="text"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && barcode) {
            e.preventDefault();
            handleBarcodeScan(barcode);
            setBarcode('');
          }
        }}
        className="barcode-input"
      />

      {ingredientsModalOpen && selectedProduct && (
        <div
          className="store-modal-overlay"
          onClick={() => setIngredientsModalOpen(false)}
        >
          <div
            className="store-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="store-modal-header">
              <button
                onClick={() => {
                  setIngredientsModalOpen(false);
                  setProductModalStep('main');
                }}
                className="store-modal-close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? 'Complementos' : '1. Complementos'}
              </h2>
            </div>

            <div className="flex justify-center items-center gap-3" style={{
              padding: '12px 20px',
              borderBottom: '2px solid var(--store-primary)'
            }}>
              <span className="font-bold" style={{ fontSize: '16px', color: 'var(--store-primary)' }}>
                Seleccionados:
              </span>
              <span className="font-bold" style={{
                fontSize: '20px',
                color: productConfig.selectedIngredients.length > 0 ? 'var(--store-accent)' : 'var(--store-primary)'
              }}>
                {productConfig.selectedIngredients.length}
              </span>
              {selectedProduct.ingredients[0]?.max_selections && (
                <>
                  <span style={{ color: 'var(--store-primary)' }}>/</span>
                  <span className="font-bold" style={{ fontSize: '20px', color: 'var(--store-primary)' }}>
                    {selectedProduct.ingredients[0].max_selections}
                  </span>
                </>
              )}
            </div>

            <div className="store-modal-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.ingredients.map(ingredient => {
                  const ingredientIsOutOfStock = !ingredient.unlimited_stock && ingredient.stock === 0;
                  const isSelected = productConfig.selectedIngredients.find(i => i.id === ingredient.id);
                  return (
                  <div
                    key={ingredient.id}
                    className={`option-item${isSelected ? ' selected' : ''}`}
                    style={{
                      flexDirection: 'column',
                      padding: 0,
                      backgroundColor: ingredientIsOutOfStock ? '#f8f9fa' : (isSelected ? 'var(--store-accent)' : '#fff'),
                      borderColor: isSelected ? 'var(--store-accent)' : ingredientIsOutOfStock ? '#dc3545' : '#e0e0e0',
                      borderWidth: '2px',
                      cursor: ingredientIsOutOfStock ? 'not-allowed' : 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: ingredientIsOutOfStock ? 0.6 : 1
                    }}
                    onClick={() => toggleIngredient(ingredient)}
                  >
                    {ingredientIsOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        Agotado
                      </div>
                    )}
                    {ingredient.unlimited_stock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        <FontAwesomeIcon icon={faInfinity} /> Stock
                      </div>
                    )}
                    {ingredient.image ? (
                      <img
                        src={ingredient.image}
                        alt={ingredient.name}
                        style={{
                          width: '100%',
                          height: '140px',
                          objectFit: 'cover',
                          borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                      }}>
                        <FontAwesomeIcon icon={faUtensils} style={{ fontSize: '48px', color: 'var(--store-accent)' }} />
                      </div>
                    )}
                    <div className="text-center" style={{ padding: '8px' }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '13px',
                        color: isSelected ? '#fff' : 'var(--store-primary)',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {ingredient.name}
                      </div>
                      {Number(ingredient.price) > 0 && (
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: isSelected ? '#fff' : 'var(--store-accent)'
                        }}>
                          +{colors.currency.symbol}{Number(ingredient.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FontAwesomeIcon icon={faCheck} style={{ fontSize: '12px', color: 'var(--store-accent)' }} />
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div className="store-modal-footer">
              {productModalStep === 'main' ? (
                <button
                  onClick={() => setIngredientsModalOpen(false)}
                  className="btn btn-lg btn-full"
                  style={{
                    backgroundColor: 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  Listo
                </button>
              ) : (
                <button
                  onClick={selectedProduct.extras?.length > 0 ? handleNextToExtras : addToCart}
                  disabled={addingToCart}
                  className="btn btn-lg btn-full"
                  style={{
                    backgroundColor: addingToCart ? '#28a745' : 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  {selectedProduct.extras?.length > 0 ? <>Siguiente <FontAwesomeIcon icon={faChevronRight} /></> : (addingToCart ? '¡Agregado!' : `Agregar - ${colors.currency.symbol}${(calculateProductPrice() * productConfig.quantity).toFixed(2)}`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {extrasModalOpen && selectedProduct && (
        <div
          className="store-modal-overlay"
          onClick={() => setExtrasModalOpen(false)}
        >
          <div
            className="store-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="store-modal-header">
              <button
                onClick={() => {
                  setExtrasModalOpen(false);
                  setProductModalStep('main');
                }}
                className="store-modal-close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? 'Extras' : '2. Extras'}
              </h2>
            </div>

            <div className="flex justify-center items-center gap-3" style={{
              padding: '12px 20px',
              borderBottom: '2px solid var(--store-primary)'
            }}>
              <span className="font-bold" style={{ fontSize: '16px', color: 'var(--store-primary)' }}>
                Seleccionados:
              </span>
              <span className="font-bold" style={{
                fontSize: '20px',
                color: productConfig.selectedExtras.length > 0 ? 'var(--store-accent)' : 'var(--store-primary)'
              }}>
                {productConfig.selectedExtras.length}
              </span>
            </div>

            <div className="store-modal-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.extras.map(extra => {
                  const extraIsOutOfStock = !extra.unlimited_stock && extra.stock === 0;
                  const isSelected = productConfig.selectedExtras.find(e => e.id === extra.id);
                  return (
                  <div
                    key={extra.id}
                    className={`option-item${isSelected ? ' selected' : ''}`}
                    style={{
                      flexDirection: 'column',
                      padding: 0,
                      backgroundColor: extraIsOutOfStock ? '#f8f9fa' : (isSelected ? 'var(--store-accent)' : '#fff'),
                      borderColor: isSelected ? 'var(--store-accent)' : extraIsOutOfStock ? '#dc3545' : '#e0e0e0',
                      borderWidth: '2px',
                      cursor: extraIsOutOfStock ? 'not-allowed' : 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: extraIsOutOfStock ? 0.6 : 1
                    }}
                    onClick={() => toggleExtra(extra)}
                  >
                    {extraIsOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        Agotado
                      </div>
                    )}
                    {extra.unlimited_stock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        <FontAwesomeIcon icon={faInfinity} /> Stock
                      </div>
                    )}
                    {extra.image ? (
                      <img
                        src={extra.image}
                        alt={extra.name}
                        style={{
                          width: '100%',
                          height: '140px',
                          objectFit: 'cover',
                          borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '140px',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                      }}>
                        <FontAwesomeIcon icon={faUtensils} style={{ fontSize: '48px', color: 'var(--store-accent)' }} />
                      </div>
                    )}
                    <div className="text-center" style={{ padding: '8px' }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '13px',
                        color: isSelected ? '#fff' : 'var(--store-primary)',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {extra.name}
                      </div>
                      {Number(extra.price) > 0 && (
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: isSelected ? '#fff' : 'var(--store-accent)'
                        }}>
                          +{colors.currency.symbol}{Number(extra.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FontAwesomeIcon icon={faCheck} style={{ fontSize: '12px', color: 'var(--store-accent)' }} />
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div className="store-modal-footer">
              {productModalStep === 'main' ? (
                <button
                  onClick={() => setExtrasModalOpen(false)}
                  className="btn btn-lg btn-full"
                  style={{
                    backgroundColor: 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  Listo
                </button>
              ) : (
                <button
                  onClick={addToCart}
                  disabled={addingToCart}
                  className="btn btn-lg btn-full"
                  style={{
                    backgroundColor: addingToCart ? '#28a745' : 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  {addingToCart ? '¡Agregado!' : `Agregar - ${colors.currency.symbol}${(calculateProductPrice() * productConfig.quantity).toFixed(2)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {cartOpen && (
        <div className="cart-overlay" onClick={() => setCartOpen(false)} />
      )}

      <div className={`store-cart-sheet${cartOpen ? ' open' : ''}`}>
        <div className="store-cart-handle" onClick={() => setCartOpen(false)}>
          <div className="store-cart-handle-bar" />
        </div>

        <div className="store-cart-header">
          <div className="store-cart-header-left">
            <FontAwesomeIcon icon={faShoppingCart} />
            <h2>Mi Pedido</h2>
          </div>
          <button className="store-cart-close" onClick={() => setCartOpen(false)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="store-cart-body">
          {cart.length === 0 ? (
            <div className="store-cart-empty">
              <FontAwesomeIcon icon={faShoppingCart} className="store-cart-empty-icon" />
              <p className="store-cart-empty-title">Tu carrito esta vacio</p>
              <p className="store-cart-empty-text">Agrega productos para comenzar</p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div className="store-cart-item" key={item.id}>
                  <div className="store-cart-item-thumb">
                    {item.product_image ? (
                      <img src={getImageUrl(item.product_image)} alt={item.product_name} />
                    ) : (
                      <FontAwesomeIcon icon={faBox} className="store-cart-item-thumb-icon" />
                    )}
                  </div>
                  <div className="store-cart-item-content">
                    <div className="store-cart-item-top">
                      <h4 className="store-cart-item-name">{item.product_name}</h4>
                      <button className="store-cart-item-remove" onClick={() => removeFromCart(item.id)}>
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>

                    {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                      <div className="store-cart-item-extras">{item.selected_ingredients.join(', ')}</div>
                    )}
                    {item.selected_extras && item.selected_extras.length > 0 && (
                      <div className="store-cart-item-extras">+ {item.selected_extras.join(', ')}</div>
                    )}

                    <div className="store-cart-item-bottom">
                      <div className="store-cart-qty">
                        <button className="store-cart-qty-btn" onClick={() => updateQuantity(item.id, -1)}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <span className="store-cart-qty-value">{item.quantity}</span>
                        <button className="store-cart-qty-btn" onClick={() => updateQuantity(item.id, 1)}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                      <div className="store-cart-item-total">
                        {colors.currency.symbol}{Number(item.total).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="store-cart-summary">
                <div className="store-cart-summary-row">
                  <span>Subtotal</span>
                  <span className="font-semibold">{colors.currency.symbol}{Number(getCartTotal()).toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="store-cart-summary-row store-cart-discount">
                    <span>Descuento ({appliedCoupon.coupon_code})</span>
                    <span>-{colors.currency.symbol}{Number(appliedCoupon.discount_total || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="store-cart-summary-total">
                  <span>Total</span>
                  <span>{colors.currency.symbol}{Number(getFinalTotal()).toFixed(2)}</span>
                </div>
                <div className="store-cart-coupon">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="Codigo de cupon"
                    className="store-cart-coupon-input"
                  />
                  {appliedCoupon ? (
                    <button onClick={removeCoupon} className="btn btn-danger btn-sm">Quitar</button>
                  ) : (
                    <button onClick={applyCoupon} disabled={couponLoading || !couponCodeInput.trim()} className="btn btn-secondary btn-sm">
                      {couponLoading ? '...' : 'Aplicar'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="store-cart-footer">
            <div className="store-cart-order-type">
              <label className="store-cart-order-label">Tipo de pedido</label>
              <div className={`store-cart-type-grid${selectedConfiguration?.allow_serve && selectedConfiguration?.allow_takeout ? '' : ' single'}`}>
                {selectedConfiguration?.allow_serve && (
                  <button
                    onClick={() => setOrderType('serve')}
                    className={`store-cart-type-btn${orderType === 'serve' ? ' active' : ''}`}
                  >
                    <FontAwesomeIcon icon={faBox} />
                    <span>Comer aqui</span>
                  </button>
                )}
                {selectedConfiguration?.allow_takeout && (
                  <button
                    onClick={() => setOrderType('takeout')}
                    className={`store-cart-type-btn${orderType === 'takeout' ? ' active' : ''}`}
                  >
                    <FontAwesomeIcon icon={faShoppingCart} />
                    <span>Llevar</span>
                  </button>
                )}
              </div>
            </div>

            <button onClick={handleCheckout} className="store-cart-checkout-btn">
              <FontAwesomeIcon icon={faCheck} />
              Confirmar Pedido - {colors.currency.symbol}{Number(getFinalTotal()).toFixed(2)}
            </button>

            <button onClick={() => setCart([])} className="store-cart-clear-btn">
              <FontAwesomeIcon icon={faTimesCircle} />
              Vaciar carrito
            </button>
          </div>
        )}
      </div>

      {paymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px' }}>
            <h2 style={{
              color: 'var(--store-primary)',
              marginBottom: '10px',
              fontSize: '24px'
            }}>
              {processingPayment ? 'Procesando Pago...' : 'Metodo de Pago'}
            </h2>
            <p className="text-muted" style={{ marginBottom: '25px', fontSize: '14px' }}>
              {processingPayment
                ? (paymentMethod === 'card'
                    ? 'Acerque o pase la tarjeta en el terminal Point'
                    : 'Procesando...')
                : 'Selecciona como deseas pagar'
              }
            </p>

            {processingPayment ? (
              <div className="flex flex-col items-center" style={{ padding: '40px', gap: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  border: '5px solid var(--store-accent)',
                  borderTop: '5px solid var(--store-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p className="text-muted" style={{ fontSize: '14px' }}>
                  Esperando confirmacion del terminal...
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col" style={{ gap: '15px' }}>
                  {selectedConfiguration?.accept_card && (
                    <button
                      onClick={() => processPayment('card')}
                      className="btn btn-lg btn-full"
                      style={{
                        backgroundColor: 'var(--store-secondary)',
                        color: 'var(--store-primary)',
                        border: '3px solid #ddd',
                        borderRadius: '15px'
                      }}
                    >
                      <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '28px' }} />
                      <span className="font-bold" style={{ fontSize: '18px' }}>Tarjeta</span>
                    </button>
                  )}

                  {selectedConfiguration?.accept_cash && (
                    <button
                      onClick={() => processPayment('cash')}
                      className="btn btn-lg btn-full"
                      style={{
                        backgroundColor: 'var(--store-secondary)',
                        color: 'var(--store-primary)',
                        border: '3px solid #ddd',
                        borderRadius: '15px'
                      }}
                    >
                      <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '28px' }} />
                      <span className="font-bold" style={{ fontSize: '18px' }}>Efectivo</span>
                    </button>
                  )}

                  {!selectedConfiguration?.accept_cash && !selectedConfiguration?.accept_card && (
                    <p className="text-muted">No hay metodos de pago disponibles</p>
                  )}
                </div>

                {selectedConfiguration?.accept_card && availableTerminals.length > 0 && (
                  <div className="text-muted text-sm" style={{ marginTop: '14px' }}>
                    Maquina Point asignada:{' '}
                    <strong>
                      {availableTerminals.find(terminal => String(terminal.id) === String(selectedTerminalId))?.name || 'No disponible'}
                    </strong>
                  </div>
                )}

                <p style={{
                  color: '#999',
                  marginTop: '20px',
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  Al tocar Tarjeta o Efectivo el pedido se procesa inmediatamente
                </p>

                <button
                  onClick={() => {
                    setPaymentModalOpen(false);
                  }}
                  className="btn"
                  style={{
                    marginTop: '10px',
                    backgroundColor: 'transparent',
                    color: '#666',
                    border: 'none'
                  }}
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {paymentWaiting && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              Esperando Pago
            </h2>
            <p className="text-muted" style={{ marginBottom: '20px', fontSize: '14px' }}>
              Acerque o pase la tarjeta en el terminal Point
            </p>
            <div style={{
              width: '80px',
              height: '80px',
              border: '6px solid var(--store-accent)',
              borderTop: '6px solid var(--store-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <p className="text-muted" style={{ fontSize: '14px', marginBottom: '10px' }}>
              Esperando confirmacion del pago...
            </p>
            <p className="font-bold" style={{
              color: paymentTimeLeft <= 30 ? '#DC3545' : 'var(--store-primary)',
              fontSize: '24px',
              marginBottom: '20px'
            }}>
              {Math.floor(paymentTimeLeft / 60)}:{String(paymentTimeLeft % 60).padStart(2, '0')}
            </p>
            <button
              onClick={async () => {
                if (!pendingOrderData) return;
                try {
                  await fetch(`/api/orders/${pendingOrderData.order.id}/cancel-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store_id: pendingOrderData.storeId })
                  });
                } catch (e) { console.error(e); }
                setPaymentWaiting(false);
                setPaymentCancelled(true);
              }}
              className="btn btn-danger"
              style={{ padding: '12px 24px', borderRadius: '10px' }}
            >
              Cancelar pago
            </button>
          </div>
        </div>
      )}

      {paymentConfirmed && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '60px', marginBottom: '20px', color: 'var(--success)' }} />
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              Muchas gracias por su compra
            </h2>
            <p className="text-muted" style={{ marginBottom: '20px', fontSize: '16px' }}>
              Por favor espere su orden
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: 'var(--store-primary)',
                color: 'var(--store-secondary)',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.8 }}>Numero de Orden</p>
                <p className="font-bold" style={{ fontSize: '48px', margin: 0 }}>{lastOrderNumber}</p>
              </div>
            )}
            <button
              onClick={() => {
                setPaymentConfirmed(false);
                setPendingOrderData(null);
                setLastOrderNumber(null);
                setPaymentModalOpen(false);
              }}
              className="btn btn-lg btn-full"
              style={{
                marginTop: '25px',
                backgroundColor: 'var(--store-accent)',
                color: 'var(--store-primary)'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {paymentCancelled && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '60px', marginBottom: '20px', color: 'var(--danger)' }} />
            <h2 style={{ color: '#DC3545', marginBottom: '10px', fontSize: '24px' }}>
              Pago No Completado
            </h2>
            {pendingOrderData?.order?.order_number && (
              <p className="font-bold" style={{ color: '#DC3545', marginBottom: '10px', fontSize: '18px' }}>
                Orden #{pendingOrderData.order.order_number}
              </p>
            )}
            <p className="text-muted" style={{ marginBottom: '25px', fontSize: '14px' }}>
              El pago no fue completado o se cancelo. Como quieres pagar?
            </p>
            <div className="flex flex-col" style={{ gap: '15px' }}>
              <button
                onClick={() => {
                  setPaymentCancelled(false);
                  setPendingOrderData(null);
                  setProcessingPayment(true);
                  processPayment('card');
                }}
                className="btn btn-lg btn-full"
                style={{
                  backgroundColor: 'var(--store-primary)',
                  color: 'var(--store-secondary)',
                  borderRadius: '15px'
                }}
              >
                <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '22px' }} />
                <span className="font-bold" style={{ fontSize: '18px' }}>Reintentar con Tarjeta</span>
              </button>
              <button
                onClick={() => {
                  setPaymentCancelled(false);
                  setPaymentModalOpen(true);
                }}
                className="btn btn-lg btn-full"
                style={{
                  backgroundColor: 'var(--store-accent)',
                  color: 'var(--store-primary)',
                  borderRadius: '15px'
                }}
              >
                <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '22px' }} />
                <span className="font-bold" style={{ fontSize: '18px' }}>Pagar en Efectivo</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch(`/api/orders/${pendingOrderData.order.id}/cancel-payment`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ store_id: pendingOrderData.storeId })
                    });
                  } catch (e) { console.error(e); }
                  setPaymentCancelled(false);
                  setPendingOrderData(null);
                  setPaymentWaiting(false);
                  setCart([]);
                  setCartOpen(false);
                  setPaymentModalOpen(false);
                }}
                className="btn btn-danger btn-lg btn-full"
                style={{ borderRadius: '15px' }}
              >
                <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '22px' }} />
                <span className="font-bold" style={{ fontSize: '18px' }}>Cancelar Orden</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cashPaymentSuccess && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '60px', marginBottom: '20px', color: 'var(--success)' }} />
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              Muchas gracias por su compra
            </h2>
            <p className="text-muted" style={{ marginBottom: '20px', fontSize: '16px' }}>
              Por favor espere su orden
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: 'var(--store-primary)',
                color: 'var(--store-secondary)',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.8 }}>Numero de Orden</p>
                <p className="font-bold" style={{ fontSize: '48px', margin: 0 }}>{lastOrderNumber}</p>
              </div>
            )}
            <p style={{
              color: '#999',
              fontSize: '13px',
              fontStyle: 'italic'
            }}>
              Pague con efectivo justo en caja para procesar su orden
            </p>
            <button
              onClick={() => {
                setCashPaymentSuccess(false);
                setLastOrderNumber(null);
              }}
              className="btn btn-lg btn-full"
              style={{
                marginTop: '25px',
                backgroundColor: 'var(--store-accent)',
                color: 'var(--store-primary)'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      {prodModalOpen && (
        <div className="store-modal-overlay" onClick={() => setProdModalOpen(false)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--store-primary)', textAlign: 'center' }}>
              {editingProd ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>

            <div className="store-prod-modal-image-area">
              {prodImageFile ? (
                <img src={URL.createObjectURL(prodImageFile)} alt="Preview" className="store-prod-modal-preview" />
              ) : editingProd?.image ? (
                <img src={getImageUrl(editingProd.image)} alt="Actual" className="store-prod-modal-preview" />
              ) : (
                <div className="store-prod-modal-no-image">
                  <FontAwesomeIcon icon={faBox} />
                </div>
              )}
              <label className="store-prod-modal-image-btn">
                <FontAwesomeIcon icon={faEdit} /> {prodImageFile || editingProd?.image ? 'Cambiar' : 'Agregar imagen'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { if (e.target.files[0]) setProdImageFile(e.target.files[0]); }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                placeholder="Nombre del producto"
                autoFocus
                className="store-prod-modal-input main"
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  step="0.01"
                  value={prodForm.price}
                  onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })}
                  placeholder="Precio"
                  className="store-prod-modal-input"
                  style={{ flex: 1 }}
                />
                <select
                  value={prodForm.category_id}
                  onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })}
                  className="store-prod-modal-input"
                  style={{ flex: 1 }}
                >
                  <option value="">Sin categoría</option>
                  {(store?.categories || []).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={prodForm.description}
                onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                placeholder="Descripción (opcional)"
                className="store-prod-modal-input"
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={prodForm.unlimited_stock} onChange={(e) => setProdForm({ ...prodForm, unlimited_stock: e.target.checked })} />
                  Stock ilimitado
                </label>
                {!prodForm.unlimited_stock && (
                  <input
                    type="number"
                    min="0"
                    value={prodForm.stock}
                    onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                    placeholder="Stock"
                    className="store-prod-modal-input"
                    style={{ width: '80px' }}
                  />
                )}
              </div>

              {adminToken && (
                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '12px', marginTop: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--store-primary)', marginBottom: '8px' }}>Extras</div>
                  {extras.filter(e => !prodForm.category_id || String(e.category_id) === String(prodForm.category_id) || !e.category_id).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                      {extras.filter(e => !prodForm.category_id || String(e.category_id) === String(prodForm.category_id) || !e.category_id).map(e => (
                        <span key={e.id} style={{ fontSize: '11px', padding: '3px 8px', background: '#f0f0f0', borderRadius: '12px', color: '#555' }}>
                          {e.name}{Number(e.price) > 0 ? ` +${Number(e.price).toFixed(0)}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {prodNewExtras.map((ext, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={ext.name}
                        onChange={(e) => { const arr = [...prodNewExtras]; arr[i] = { ...arr[i], name: e.target.value }; setProdNewExtras(arr); }}
                        placeholder="Nombre"
                        className="store-prod-modal-input"
                        style={{ flex: 2, padding: '8px', fontSize: '13px' }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={ext.price}
                        onChange={(e) => { const arr = [...prodNewExtras]; arr[i] = { ...arr[i], price: e.target.value }; setProdNewExtras(arr); }}
                        placeholder="$"
                        className="store-prod-modal-input"
                        style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                      />
                      <button
                        onClick={() => setProdNewExtras(prodNewExtras.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setProdNewExtras([...prodNewExtras, { name: '', price: '' }])}
                    style={{ fontSize: '12px', color: 'var(--store-primary)', background: 'none', border: '1px dashed #ccc', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', width: '100%' }}
                  >
                    <FontAwesomeIcon icon={faPlus} /> Agregar extra
                  </button>

                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--store-primary)', marginBottom: '8px', marginTop: '12px' }}>Ingredientes</div>
                  {ingredients.filter(ing => !prodForm.category_id || String(ing.category_id) === String(prodForm.category_id) || !ing.category_id).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                      {ingredients.filter(ing => !prodForm.category_id || String(ing.category_id) === String(prodForm.category_id) || !ing.category_id).map(ing => (
                        <span key={ing.id} style={{ fontSize: '11px', padding: '3px 8px', background: '#f0f0f0', borderRadius: '12px', color: '#555' }}>
                          {ing.name}{Number(ing.price) > 0 ? ` +${Number(ing.price).toFixed(0)}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {prodNewIngredients.map((ing, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={ing.name}
                        onChange={(e) => { const arr = [...prodNewIngredients]; arr[i] = { ...arr[i], name: e.target.value }; setProdNewIngredients(arr); }}
                        placeholder="Nombre"
                        className="store-prod-modal-input"
                        style={{ flex: 2, padding: '8px', fontSize: '13px' }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={ing.price}
                        onChange={(e) => { const arr = [...prodNewIngredients]; arr[i] = { ...arr[i], price: e.target.value }; setProdNewIngredients(arr); }}
                        placeholder="$"
                        className="store-prod-modal-input"
                        style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                      />
                      <button
                        onClick={() => setProdNewIngredients(prodNewIngredients.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setProdNewIngredients([...prodNewIngredients, { name: '', price: '' }])}
                    style={{ fontSize: '12px', color: 'var(--store-primary)', background: 'none', border: '1px dashed #ccc', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', width: '100%' }}
                  >
                    <FontAwesomeIcon icon={faPlus} /> Agregar ingrediente
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => { setProdModalOpen(false); setProdImageFile(null); setProdNewExtras([]); setProdNewIngredients([]); }}
                className="store-prod-modal-btn cancel"
              >
                Cancelar
              </button>
              <button
                onClick={saveProd}
                disabled={!prodForm.name.trim() || !prodForm.price || prodSaving}
                className={`store-prod-modal-btn confirm${!prodForm.name.trim() || !prodForm.price || prodSaving ? ' disabled' : ''}`}
              >
                {prodSaving ? 'Guardando...' : editingProd ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {complementModal && (
        <div className="store-modal-overlay" onClick={() => setComplementModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--store-primary)', textAlign: 'center' }}>
              Nuevo {complementModal === 'extra' ? 'Extra' : 'Ingrediente'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" value={complementForm.name} onChange={(e) => setComplementForm({ ...complementForm, name: e.target.value })} placeholder="Nombre" autoFocus className="store-prod-modal-input main" />
              <input type="number" step="0.01" value={complementForm.price} onChange={(e) => setComplementForm({ ...complementForm, price: e.target.value })} placeholder="Precio adicional" className="store-prod-modal-input" />
              <select value={complementForm.category_id} onChange={(e) => setComplementForm({ ...complementForm, category_id: e.target.value })} className="store-prod-modal-input">
                <option value="">Sin categoría</option>
                {(store?.categories || []).map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={complementForm.unlimited_stock} onChange={(e) => setComplementForm({ ...complementForm, unlimited_stock: e.target.checked })} />
                  Stock ilimitado
                </label>
                {!complementForm.unlimited_stock && (
                  <input type="number" min="0" value={complementForm.stock} onChange={(e) => setComplementForm({ ...complementForm, stock: e.target.value })} placeholder="Stock" className="store-prod-modal-input" style={{ width: '80px' }} />
                )}
              </div>
              <label className="store-prod-modal-image-btn" style={{ alignSelf: 'flex-start' }}>
                <FontAwesomeIcon icon={faEdit} /> {complementForm.imageFile ? complementForm.imageFile.name : 'Imagen'}
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setComplementForm({ ...complementForm, imageFile: e.target.files[0] }); }} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setComplementModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button onClick={saveComplement} disabled={!complementForm.name.trim()} className={`store-prod-modal-btn confirm${!complementForm.name.trim() ? ' disabled' : ''}`}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {catModalOpen && (
        <div className="store-modal-overlay" onClick={() => setCatModalOpen(false)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--store-primary)', textAlign: 'center' }}>
              {editingCat ? 'Editar Categoría' : 'Nueva Categoría'}
            </h3>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCat(); }}
              placeholder="Nombre de la categoría"
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid var(--store-primary)',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => setCatModalOpen(false)}
                style={{
                  flex: 1, padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px',
                  background: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveCat}
                disabled={!catName.trim()}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                  background: catName.trim() ? 'var(--store-accent)' : '#ccc',
                  color: catName.trim() ? 'var(--store-primary)' : '#666',
                  fontSize: '14px', cursor: catName.trim() ? 'pointer' : 'default', fontWeight: '700'
                }}
              >
                {editingCat ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestartConfirm && (
        <div className="store-modal-overlay" onClick={() => {}}>
          <div className="store-pin-modal" style={{ maxWidth: '340px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#x1F504;</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--store-primary)' }}>Edición completada</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#666' }}>
              ¿Deseas reiniciar todos los totems para que apliquen los cambios?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setShowRestartConfirm(false); setEditMode(false); }}
                style={{ flex: 1, padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', background: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                No, solo salir
              </button>
              <button
                onClick={async () => {
                  setRestartingSending(true);
                  try {
                    await fetch(`/api/public/${code}/restart-all`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token: adminToken })
                    });
                  } catch {}
                  setRestartingSending(false);
                  setShowRestartConfirm(false);
                  setEditMode(false);
                }}
                disabled={restartingSending}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: 'var(--store-accent)', color: 'var(--store-primary)', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                {restartingSending ? 'Enviando...' : 'Reiniciar totems'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pinModalOpen && (
        <div className="store-modal-overlay" onClick={() => setPinModalOpen(false)}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: '28px', color: 'var(--store-accent)', marginBottom: '8px' }} />
              <h3 style={{ margin: 0, color: 'var(--store-primary)' }}>Ingresa el PIN</h3>
            </div>

            <div className="pin-dots">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`pin-dot${pinInput.length > i ? ' filled' : ''}`}
                  style={{
                    borderColor: pinError ? '#dc3545' : 'var(--store-primary)'
                  }}
                />
              ))}
            </div>

            {pinError && (
              <p style={{ color: '#dc3545', textAlign: 'center', margin: '8px 0 0', fontSize: '14px' }}>
                {pinError}
              </p>
            )}

            <div className="pin-numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, idx) => (
                <button
                  key={idx}
                  className={`pin-numpad-btn${key === null ? ' pin-numpad-empty' : ''}${key === 'del' ? ' pin-numpad-del' : ''}`}
                  onClick={() => {
                    if (key === null) return;
                    if (key === 'del') {
                      setPinInput(prev => prev.slice(0, -1));
                      setPinError('');
                      return;
                    }
                    if (pinInput.length >= 4) return;
                    const newPin = pinInput + key;
                    setPinInput(newPin);
                    setPinError('');
                    if (newPin.length === 4) {
                      setTimeout(() => {
                        handlePinSubmit(newPin);
                      }, 200);
                    }
                  }}
                  disabled={key === null}
                >
                  {key === 'del' ? (
                    <FontAwesomeIcon icon={faArrowLeft} />
                  ) : key !== null ? key : ''}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPinModalOpen(false)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '12px',
                backgroundColor: 'transparent',
                color: '#999',
                border: 'none',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
    </PluginProvider>
  );
}

export default Store;
