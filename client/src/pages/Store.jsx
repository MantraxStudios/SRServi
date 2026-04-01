import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShoppingCart, 
  faPlus, 
  faMinus, 
  faTimes, 
  faBox,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';

function Store() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [productConfig, setProductConfig] = useState({
    selectedIngredients: [],
    selectedExtras: [],
    quantity: 1,
    notes: ''
  });

  useEffect(() => {
    fetchStore();
    
    const socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
      console.log('Conectado al servidor WebSocket');
      if (store?.store?.id) {
        socket.emit('register_store', store.store.id);
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
    
    return () => {
      socket.disconnect();
    };
  }, [code]);

  useEffect(() => {
    if (store?.store?.id) {
      const socket = io('http://localhost:3001');
      socket.emit('register_store', store.store.id);
      socket.disconnect();
    }
  }, [store?.store?.id]);

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/public/${code}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Codigo no encontrado');
        }
        throw new Error('Error al cargar la tienda');
      }

      const data = await response.json();
      console.log('Store data received:', data);
      console.log('Number of products:', data.products?.length || 0);
      setStore(data);
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
    setSelectedProduct(product);
    setProductConfig({
      selectedIngredients: [],
      selectedExtras: [],
      quantity: 1,
      notes: ''
    });
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
  };

  const toggleIngredient = (ingredient) => {
    setProductConfig(prev => {
      const exists = prev.selectedIngredients.find(i => i.id === ingredient.id);
      if (exists) {
        return {
          ...prev,
          selectedIngredients: prev.selectedIngredients.filter(i => i.id !== ingredient.id)
        };
      } else {
        return {
          ...prev,
          selectedIngredients: [...prev.selectedIngredients, ingredient]
        };
      }
    });
  };

  const toggleExtra = (extra) => {
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

    const unitPrice = calculateProductPrice();
    const cartItem = {
      id: Date.now(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      unit_price: unitPrice,
      quantity: productConfig.quantity,
      total: unitPrice * productConfig.quantity,
      selected_ingredients: productConfig.selectedIngredients.map(i => i.name),
      selected_extras: productConfig.selectedExtras.map(e => e.name),
      notes: productConfig.notes
    };

    setCart([...cart, cartItem]);
    closeProductModal();
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

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          store_id: store.store.id,
          customer_name: customerName,
          items: cart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            selected_ingredients: item.selected_ingredients,
            selected_extras: item.selected_extras,
            notes: item.notes
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Error al procesar el pedido');
      }

      alert('Pedido realizado exitosamente!');
      setCart([]);
      setCartOpen(false);
      setCustomerName('');
    } catch (err) {
      alert(err.message);
    }
  };

  const groupProductsByCategory = () => {
    if (!store?.products) return {};
    
    const grouped = {};
    store.products.forEach(product => {
      const category = product.category_name || 'Sin Categoria';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="loading" style={{ backgroundColor: '#F5F5F5' }}>
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
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            style={{ width: '100%' }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const groupedProducts = groupProductsByCategory();
  const hasProducts = Object.keys(groupedProducts).length > 0;

  return (
    <div className="store-container" style={{ backgroundColor: colors.secondary }}>
      <header style={{
        background: `linear-gradient(135deg, ${colors.header}, ${colors.primary})`,
        color: colors.accent,
        padding: '32px 24px',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          fontSize: '36px', 
          marginBottom: '12px',
          fontWeight: '700',
          color: colors.accent
        }}>
          {store?.user?.business_name || store?.user?.username}
        </h1>
        <p style={{ 
          opacity: 0.9, 
          fontSize: '14px',
          color: colors.secondary
        }}>
          Tu código de pedido: <strong style={{ fontSize: '18px', letterSpacing: '2px' }}>{code}</strong>
        </p>
      </header>

      {!hasProducts && (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}40)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px'
          }}>
            <FontAwesomeIcon icon={faBox} style={{ fontSize: '60px', color: colors.accent }} />
          </div>
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: colors.primary, 
            marginBottom: '16px' 
          }}>
            Esta tienda aún no tiene productos
          </h2>
          <p style={{ 
            fontSize: '16px', 
            color: '#666', 
            marginBottom: '24px',
            lineHeight: '1.6'
          }}>
            El propietario aún no ha agregado productos a su catálogo. ¡Vuelve pronto!
          </p>
        </div>
      )}

      {hasProducts && (
        <div className="products-grid">
          {Object.entries(groupedProducts).map(([category, products]) => (
            <div key={category}>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                marginBottom: '20px',
                padding: '10px 0',
                borderBottom: `3px solid ${colors.accent}`,
                color: colors.primary
              }}>
                {category}
              </h2>
              {products.map(product => (
                <div 
                  key={product.id} 
                  style={{
                    backgroundColor: colors.secondary,
                    border: `2px solid ${colors.accent}40`,
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    marginBottom: '20px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}
                  onClick={() => openProductModal(product)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = `0 12px 32px ${colors.accent}30`;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderColor = `${colors.accent}40`;
                  }}
                >
                  <div className="product-image" style={{
                    height: '180px',
                    backgroundColor: `${colors.accent}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {product.image ? (
                      <img 
                        src={product.image.startsWith('http') ? product.image : `http://localhost:3001${product.image}`} 
                        alt={product.name} 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    ) : (
                      <FontAwesomeIcon icon={faBox} style={{ fontSize: '64px', color: colors.accent, opacity: 0.6 }} />
                    )}
                  </div>
                  <div className="product-info" style={{ padding: '20px' }}>
                    <h3 style={{ 
                      fontSize: '22px', 
                      fontWeight: '700', 
                      marginBottom: '8px', 
                      color: colors.primary 
                    }}>
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="product-description" style={{
                        color: '#666',
                        marginBottom: '12px',
                        lineHeight: '1.5',
                        fontSize: '14px'
                      }}>{product.description}</p>
                    )}
                    <div style={{ 
                      fontSize: '28px', 
                      fontWeight: '700', 
                      color: colors.accent,
                      marginTop: '8px'
                    }}>
                      {colors.currency.symbol}{Number(product.price).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {hasProducts && (
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: colors.accent,
        color: colors.primary,
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
        zIndex: 1000,
        transition: 'all 0.2s ease'
      }} onClick={() => setCartOpen(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
        }}
      >
        <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: '24px' }} />
        {getCartCount() > 0 && (
          <span style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            backgroundColor: colors.primary,
            color: colors.secondary,
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '700'
          }}>{getCartCount()}</span>
        )}
      </div>
      )}

      {selectedProduct && (
        <div className="modal-overlay" onClick={closeProductModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '500px',
            backgroundColor: colors.secondary,
            border: `3px solid ${colors.primary}`
          }}>
            <div className="modal-header" style={{
              backgroundColor: colors.header,
              color: colors.accent
            }}>
              <h2 className="modal-title">{selectedProduct.name}</h2>
              <button className="modal-close" onClick={closeProductModal} style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: colors.accent,
                fontSize: '24px',
                cursor: 'pointer'
              }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '20px' }}>
              {selectedProduct.description && (
                <p style={{ color: '#666', marginBottom: '20px' }}>
                  {selectedProduct.description}
                </p>
              )}

              {selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                <div className="option-group">
                  <h3 className="option-group-title" style={{ color: colors.primary }}>
                    Ingredientes
                    {selectedProduct.ingredients.some(i => i.is_required) && (
                      <span style={{ color: '#DC3545', fontSize: '14px' }}> (Requerido)</span>
                    )}
                  </h3>
                  {selectedProduct.ingredients.map(ingredient => (
                    <div 
                      key={ingredient.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                          ? colors.accent 
                          : colors.secondary,
                        border: `2px solid ${productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                          ? colors.accent 
                          : colors.primary}`,
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => toggleIngredient(ingredient)}
                    >
                      <input 
                        type="checkbox" 
                        checked={!!productConfig.selectedIngredients.find(i => i.id === ingredient.id)}
                        onChange={() => toggleIngredient(ingredient)}
                        style={{
                          width: '20px',
                          height: '20px',
                          marginRight: '12px',
                          accentColor: colors.accent
                        }}
                      />
                      <div style={{ flex: 1, color: productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                        ? colors.primary 
                        : colors.primary }}>
                        <div style={{ fontWeight: '600', color: productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                          ? colors.primary 
                          : colors.primary }}>
                          {ingredient.name}
                        </div>
                        {Number(ingredient.price) > 0 && (
                          <div style={{ fontSize: '14px', color: productConfig.selectedIngredients.find(i => i.id === ingredient.id) 
                            ? colors.primary 
                            : '#666' }}>
                            +{colors.currency.symbol}{Number(ingredient.price).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedProduct.extras && selectedProduct.extras.length > 0 && (
                <div className="option-group">
                  <h3 className="option-group-title" style={{ color: colors.primary }}>Extras</h3>
                  {selectedProduct.extras.map(extra => (
                    <div 
                      key={extra.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: productConfig.selectedExtras.find(e => e.id === extra.id) 
                          ? colors.accent 
                          : colors.secondary,
                        border: `2px solid ${productConfig.selectedExtras.find(e => e.id === extra.id) 
                          ? colors.accent 
                          : colors.primary}`,
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => toggleExtra(extra)}
                    >
                      <input 
                        type="checkbox" 
                        checked={!!productConfig.selectedExtras.find(e => e.id === extra.id)}
                        onChange={() => toggleExtra(extra)}
                        style={{
                          width: '20px',
                          height: '20px',
                          marginRight: '12px',
                          accentColor: colors.accent
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: colors.primary }}>
                          {extra.name}
                        </div>
                        {Number(extra.price) > 0 && (
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            +{colors.currency.symbol}{Number(extra.price).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="option-group">
                <h3 className="option-group-title" style={{ color: colors.primary }}>Notas</h3>
                <textarea
                  value={productConfig.notes}
                  onChange={(e) => setProductConfig(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Alguna nota especial?"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${colors.primary}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: '16px',
                    minHeight: '80px'
                  }}
                />
              </div>

              <div className="option-group">
                <h3 className="option-group-title" style={{ color: colors.primary }}>Cantidad</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button 
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.secondary,
                      border: 'none',
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setProductConfig(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                    disabled={productConfig.quantity <= 1}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <span style={{ fontSize: '24px', fontWeight: '700', minWidth: '40px', textAlign: 'center', color: colors.primary }}>
                    {productConfig.quantity}
                  </span>
                  <button 
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.secondary,
                      border: 'none',
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setProductConfig(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            </div>

            <button 
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                backgroundColor: colors.accent,
                color: colors.primary,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={addToCart}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
              }}
            >
              Agregar al Carrito - {colors.currency.symbol}{(calculateProductPrice() * productConfig.quantity).toFixed(2)}
            </button>
          </div>
        </div>
      )}

      <div style={{
        position: 'fixed',
        top: 0,
        right: cartOpen ? 0 : '-100%',
        width: '400px',
        maxWidth: '100%',
        height: '100vh',
        backgroundColor: colors.secondary,
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
        transition: 'right 0.3s ease',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `3px solid ${colors.primary}`
      }} className={cartOpen ? 'open' : ''}>
        <div style={{
          backgroundColor: colors.header,
          color: colors.accent,
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Carrito</h2>
          <button 
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: colors.accent,
              fontSize: '24px',
              cursor: 'pointer'
            }} 
            onClick={() => setCartOpen(false)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {cart.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              Tu carrito esta vacio
            </p>
          ) : (
            cart.map(item => (
              <div style={{
                backgroundColor: colors.secondary,
                border: `2px solid ${colors.primary}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '12px'
              }} key={item.id}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '18px', color: colors.primary }}>
                    {item.product_name}
                  </h4>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#DC3545',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                
                {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    {item.selected_ingredients.join(', ')}
                  </div>
                )}
                
                {item.selected_extras && item.selected_extras.length > 0 && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    Extras: {item.selected_extras.join(', ')}
                  </div>
                )}
                
                {item.notes && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontStyle: 'italic' }}>
                    Nota: {item.notes}
                  </div>
                )}
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      style={{
                        backgroundColor: colors.primary,
                        color: colors.secondary,
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <span style={{ fontWeight: '600', color: colors.primary }}>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      style={{
                        backgroundColor: colors.primary,
                        color: colors.secondary,
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: colors.accent }}>
                    {colors.currency.symbol}{Number(item.total).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{
          padding: '24px',
          borderTop: `2px solid ${colors.primary}`,
          backgroundColor: colors.secondary
        }}>
          {cart.length > 0 && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '16px',
                color: colors.primary
              }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: '600' }}>{colors.currency.symbol}{Number(getCartTotal()).toFixed(2)}</span>
              </div>
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Tu nombre"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${colors.primary}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: '16px',
                    backgroundColor: colors.secondary,
                    color: colors.primary
                  }}
                />
              </div>
              
              <button
                onClick={handleCheckout}
                disabled={!customerName.trim()}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '18px',
                  backgroundColor: customerName.trim() ? colors.accent : '#ccc',
                  color: customerName.trim() ? colors.primary : '#666',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '600',
                  cursor: customerName.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  marginBottom: '8px'
                }}
              >
                Confirmar Pedido
              </button>
              
              <button
                onClick={() => setCart([])}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  backgroundColor: 'transparent',
                  color: '#DC3545',
                  border: '2px solid #DC3545',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Vaciar Carrito
              </button>
            </>
          )}
        </div>
      </div>

      {cartOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }}
          onClick={() => setCartOpen(false)}
        />
      )}
    </div>
  );
}

export default Store;
