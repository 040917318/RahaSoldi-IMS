
import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem, SaleItem, SaleRecord, PendingSale } from '../types';
import { ShoppingCart, Plus, Trash2, CheckCircle, Search, Tag, Clock, User, X, Package, Calculator, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SalesTerminalProps {
  inventory: InventoryItem[];
  onCompleteSale: (items: SaleItem[]) => Promise<SaleRecord> | SaleRecord;
  onDeferSale: (items: SaleItem[], customerName: string, notes: string) => Promise<PendingSale> | PendingSale;
  currencySymbol: string;
}

export const SalesTerminal: React.FC<SalesTerminalProps> = ({ inventory, onCompleteSale, onDeferSale, currencySymbol }) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  
  // Load draft from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('pos_cart_draft');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to load cart draft", e);
      }
    }
  }, []);

  // Sync draft to localStorage whenever it changes
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('pos_cart_draft', JSON.stringify(cart));
    } else {
      localStorage.removeItem('pos_cart_draft');
    }
  }, [cart]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState<number>(1);
  const [isAddToCartModalOpen, setIsAddToCartModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Defer Modal State
  const [isDeferModalOpen, setIsDeferModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');

  // Mobile navigation tab state ('products' | 'cart')
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');

  // Load defer draft
  useEffect(() => {
    const savedCustomer = localStorage.getItem('pos_defer_customer');
    const savedNotes = localStorage.getItem('pos_defer_notes');
    if (savedCustomer) setCustomerName(savedCustomer);
    if (savedNotes) setNotes(savedNotes);
  }, []);

  // Sync defer draft
  useEffect(() => {
    localStorage.setItem('pos_defer_customer', customerName);
    localStorage.setItem('pos_defer_notes', notes);
  }, [customerName, notes]);

  // Derive selected product from inventory to ensure we always show current stock levels
  const selectedProduct = useMemo(() => 
    inventory.find(item => item.id === selectedProductId) || null
  , [inventory, selectedProductId]);

  // Auto-clear success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  // Helper to calculate total quantity of an item already in cart
  const itemInCartTotal = (cartItems: SaleItem[], itemId: string): number => {
    return cartItems.filter(i => i.itemId === itemId).reduce((acc, i) => acc + i.quantity, 0);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    
    if (qtyInput <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    if (qtyInput > selectedProduct.quantity) {
      alert(`Not enough stock. Only ${selectedProduct.quantity} available.`);
      return;
    }

    const existingItemIndex = cart.findIndex(item => item.itemId === selectedProduct.id);
    const currentInCart = itemInCartTotal(cart, selectedProduct.id);

    if (currentInCart + qtyInput > selectedProduct.quantity) {
         alert(`Cannot add more. Total in cart (${currentInCart} + ${qtyInput}) would exceed stock (${selectedProduct.quantity}).`);
         return;
    }

    if (existingItemIndex > -1) {
        const newCart = [...cart];
        newCart[existingItemIndex].quantity += qtyInput;
        setCart(newCart);
    } else {
        const newItem: SaleItem = {
            itemId: selectedProduct.id,
            name: selectedProduct.name,
            quantity: qtyInput,
            priceAtSale: selectedProduct.salesPrice,
            costAtSale: selectedProduct.costPrice,
            discount: 0
        };
        setCart([...cart, newItem]);
    }
    
    // Reset selection logic
    setIsAddToCartModalOpen(false);
    setSelectedProductId(null);
    setQtyInput(1);
    setSuccessMsg(`Added ${qtyInput}x ${selectedProduct.name} to cart`);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const updateDiscount = (index: number, discount: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const maxDiscount = item.quantity * item.priceAtSale;
    
    // Validate discount is positive and doesn't exceed total price
    if (discount < 0) discount = 0;
    if (discount > maxDiscount) discount = maxDiscount;
    
    newCart[index].discount = discount;
    setCart(newCart);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    await onCompleteSale(cart);
    setCart([]);
    setSuccessMsg('Sale recorded successfully!');
    setSelectedProductId(null); // Clear selection to prevent showing stale data if quantity drops to 0
  };

  const handleDefer = async () => {
    if (cart.length === 0 || !customerName.trim()) return;
    await onDeferSale(cart, customerName, notes);
    setCart([]);
    setIsDeferModalOpen(false);
    setCustomerName('');
    setNotes('');
    setSuccessMsg('Sale deferred successfully!');
    setSelectedProductId(null);
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.quantity * item.priceAtSale) - (item.discount || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mobile Tab Toggle */}
      <div className="flex lg:hidden bg-slate-200/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-300/50 dark:border-slate-700/50 shadow-sm">
        <button
          onClick={() => setMobileTab('products')}
          className={`flex-1 py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center space-x-2 transition-all ${
            mobileTab === 'products'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products ({filteredInventory.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center space-x-2 transition-all relative ${
            mobileTab === 'cart'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Cart ({cart.length})</span>
          {cart.length > 0 && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${mobileTab === 'cart' ? 'bg-white text-indigo-700' : 'bg-emerald-500 text-white'}`}>
              {currencySymbol}{cartTotal.toFixed(0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8 h-auto lg:h-[calc(100vh-140px)]">
        {/* Left: Product Selection (8 cols) */}
        <div className={`lg:col-span-8 flex-col bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 dark:border-slate-700/50 overflow-hidden ${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'} h-auto min-h-[480px] lg:h-auto`}>
          <div className="p-3.5 sm:p-6 border-b border-slate-100 dark:border-slate-700/30 bg-white/50 dark:bg-slate-900/50 flex-shrink-0">
            <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
              <input
                type="text"
                className="block w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border-0 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs sm:text-base font-medium"
                placeholder="Scan or type product name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 custom-scrollbar-lg">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              <AnimatePresence mode="popLayout">
                {filteredInventory.map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                    whileTap={{ scale: 0.98 }}
                    key={item.id}
                    onClick={() => { 
                      setSelectedProductId(item.id); 
                      setQtyInput(1); 
                      setIsAddToCartModalOpen(true);
                    }}
                    className={`cursor-pointer p-3 sm:p-5 rounded-2xl sm:rounded-[2rem] border transition-all relative overflow-hidden group ${
                      selectedProductId === item.id 
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                        : 'border-slate-100 dark:border-slate-700 hover:border-indigo-300 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 sm:mb-4 relative z-10">
                       <div className="p-1.5 sm:p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl sm:rounded-2xl text-indigo-500 group-hover:scale-110 transition-transform">
                          <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                       </div>
                       <div className={`text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase tracking-wider sm:tracking-widest ${item.quantity > item.lowStockThreshold ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                         Stock: {item.quantity}
                       </div>
                    </div>
                    <div className="relative z-10">
                      <h3 className="font-bold text-slate-800 dark:text-white truncate mb-0.5 sm:mb-1 text-xs sm:text-base">{item.name}</h3>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mb-1.5 sm:mb-3 truncate">{item.category}</p>
                      <div className="text-sm sm:text-xl font-black text-indigo-600 dark:text-indigo-400">{currencySymbol}{item.salesPrice.toFixed(2)}</div>
                    </div>
                    
                    {selectedProductId === item.id && (
                      <motion.div 
                        layoutId="active-bg"
                        className="absolute inset-0 bg-indigo-500/5 pointer-events-none"
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Selected Product Action Area */}
          <div className="p-3.5 sm:p-6 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
             <AnimatePresence mode="wait">
               {selectedProduct ? (
                 <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 10 }}
                   className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6"
                 >
                   <div className="flex flex-col gap-0.5 sm:gap-1 text-center sm:text-left">
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-indigo-500">Configure Order</span>
                      <h4 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white truncate max-w-[260px] sm:max-w-none">{selectedProduct.name}</h4>
                   </div>

                   <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
                     <div className="flex items-center p-1 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700">
                       <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setQtyInput(Math.max(1, qtyInput - 1))}
                        className="p-2 sm:p-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg sm:rounded-xl"
                       >
                         <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                       </motion.button>
                       <input 
                        type="number" 
                        className="w-12 sm:w-16 text-center font-black text-base sm:text-lg focus:outline-none bg-transparent text-slate-900 dark:text-slate-100"
                        value={qtyInput}
                        onChange={(e) => setQtyInput(parseInt(e.target.value) || 0)}
                       />
                        <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setQtyInput(qtyInput + 1)}
                        className="p-2 sm:p-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg sm:rounded-xl"
                       >
                         <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                       </motion.button>
                     </div>

                     <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={addToCart}
                      disabled={itemInCartTotal(cart, selectedProduct.id) + qtyInput > selectedProduct.quantity}
                      className="flex-1 sm:flex-none px-4 sm:px-10 py-3 sm:py-4 bg-indigo-600 text-white font-black rounded-xl sm:rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs sm:text-sm"
                     >
                       <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />
                       Add to Cart
                     </motion.button>
                   </div>
                 </motion.div>
               ) : (
                 <div className="text-center text-slate-400 dark:text-slate-500 py-1.5 sm:py-2 font-medium flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <Calculator className="w-4 h-4 sm:w-5 sm:h-5 opacity-40" />
                    Select a product above to configure order
                 </div>
               )}
             </AnimatePresence>
          </div>
        </div>

        {/* Right: Cart & Checkout (4 cols) */}
        <div className={`lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex-col h-auto lg:h-full relative overflow-hidden ${mobileTab === 'products' ? 'hidden lg:flex' : 'flex'}`}>
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 flex justify-between items-center relative z-10">
          <div>
            <h2 className="font-black text-slate-800 dark:text-white flex items-center text-lg sm:text-xl tracking-tight">
              <div className="p-1.5 sm:p-2 bg-indigo-600/10 rounded-lg sm:rounded-xl mr-2.5 sm:mr-3">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              </div>
              Checkout
            </h2>
          </div>
          <motion.span 
            key={cart.length}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="bg-indigo-600 text-white text-[10px] sm:text-xs font-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl shadow-lg shadow-indigo-600/20"
          >
            {cart.length} ITEMS
          </motion.span>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3 sm:space-y-4 min-h-[250px] lg:min-h-0 custom-scrollbar-lg relative z-10">
          <AnimatePresence mode="popLayout">
            {cart.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-slate-400 py-8 sm:py-10"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] flex items-center justify-center mb-4 sm:mb-6 border border-slate-100 dark:border-slate-700">
                  <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                </div>
                <p className="font-bold text-sm sm:text-base tracking-tight">Your cart is empty</p>
                <p className="text-xs opacity-60 mt-1 sm:mt-2">Start adding products from the menu</p>
              </motion.div>
            ) : (
              cart.map((item, index) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, scale: 0.9 }}
                  key={`${item.itemId}-${index}`} 
                  className="p-3.5 sm:p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl group relative"
                >
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <div className="flex-1 pr-2">
                      <div className="font-bold text-slate-800 dark:text-white text-xs sm:text-base leading-tight mb-0.5">{item.name}</div>
                      <div className="text-[10px] sm:text-sm font-black text-indigo-500/60 uppercase tracking-widest">{item.quantity} units</div>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.1, color: '#ef4444' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeFromCart(index)} 
                      className="p-1.5 sm:p-2 text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg sm:rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </motion.button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2.5 sm:pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 focus-within:ring-2 ring-indigo-500/20 transition-all">
                           <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 mr-1.5 sm:mr-2" />
                           <input 
                              type="number"
                              min="0"
                              placeholder="Discount"
                              className="w-16 sm:w-20 text-xs sm:text-sm font-bold bg-transparent focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-300"
                              value={item.discount || ''}
                              onChange={(e) => updateDiscount(index, parseFloat(e.target.value) || 0)}
                           />
                      </div>

                      <div className="text-right">
                        <div className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Subtotal</div>
                        <div className="font-black text-slate-800 dark:text-white text-sm sm:text-lg">
                            {currencySymbol}{((item.quantity * item.priceAtSale) - (item.discount || 0)).toFixed(2)}
                        </div>
                      </div>
                  </div>
                  
                  {item.discount && item.discount > 0 ? (
                    <div className="absolute -top-2 -left-2 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md sm:rounded-lg shadow-lg rotate-[-5deg]">
                       SAVED {currencySymbol}{(item.discount || 0).toFixed(2)}
                    </div>
                  ) : null}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 sm:p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 relative z-10">
          <div className="flex justify-between items-center mb-4 sm:mb-8">
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Total Payable</span>
              <motion.span 
                key={cartTotal}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter"
              >
                {currencySymbol}{cartTotal.toFixed(2)}
              </motion.span>
            </div>
            {cart.length > 0 && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-500">
                <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-2.5 sm:gap-4">
            <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full py-3.5 sm:py-5 bg-emerald-600 text-white font-black rounded-xl sm:rounded-[2rem] shadow-xl shadow-emerald-500/20 hover:bg-emerald-500 transition-all active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center uppercase tracking-widest text-xs sm:text-sm"
            >
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />
                Complete Transaction
            </motion.button>

            <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => cart.length > 0 && setIsDeferModalOpen(true)}
                disabled={cart.length === 0}
                className="w-full py-3 sm:py-4 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl sm:rounded-[2rem] border-2 border-indigo-500/20 hover:bg-indigo-500/10 transition-all flex items-center justify-center text-xs sm:text-sm"
            >
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                Defer to Credit (Pending)
            </motion.button>
          </div>

          <AnimatePresence>
            {successMsg && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 className="mt-4 sm:mt-6 p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-center rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest"
               >
                 {successMsg}
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>

      {/* Defer Payment Modal */}
      <AnimatePresence>
        {isDeferModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeferModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] w-full max-w-xl max-h-[90vh] overflow-y-auto relative z-10"
            >
              <div className="p-5 sm:p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <div className="p-1.5 sm:p-2 bg-indigo-600/10 rounded-lg">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-indigo-500">Credit Facility</span>
                  </div>
                  <h3 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tighter">Initialize Deferral</h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 sm:mt-2">Record transaction details for outstanding balance recovery.</p>
                </div>
                <motion.button 
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => setIsDeferModalOpen(false)} 
                  className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl sm:rounded-2xl transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                </motion.button>
              </div>

              <div className="p-5 sm:p-10 space-y-4 sm:space-y-8">
                <div className="space-y-2 sm:space-y-3">
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">
                    Debtor Identification
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
                    </div>
                    <input
                      type="text"
                      placeholder="Enter legal or common name..."
                      className="w-full pl-11 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all font-bold text-xs sm:text-base text-slate-800 dark:text-white placeholder-slate-300"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <label className="block text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">
                    Contextual Notes
                  </label>
                  <textarea
                    placeholder="Provide details on repayment terms or collateral..."
                    className="w-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all min-h-[90px] sm:min-h-[120px] font-medium text-xs sm:text-base text-slate-800 dark:text-white placeholder-slate-300"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="bg-indigo-600/5 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-indigo-600/10 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest">Calculated Overdue</span>
                    <span className="text-xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                      {currencySymbol}{cartTotal.toFixed(2)}
                    </span>
                  </div>
                  <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-200 dark:text-indigo-800" />
                </div>
              </div>

              <div className="px-5 sm:px-10 pb-5 sm:pb-10 flex gap-3 sm:gap-4">
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255,255,255,1)' }}
                  onClick={() => setIsDeferModalOpen(false)}
                  className="flex-1 py-3.5 sm:py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl sm:rounded-3xl transition-all text-xs sm:text-base"
                >
                  Discard
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDefer}
                  disabled={!customerName.trim()}
                  className="flex-2 py-3.5 sm:py-5 bg-indigo-600 text-white font-black rounded-xl sm:rounded-3xl shadow-2xl shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-widest text-xs sm:text-sm"
                >
                  Finalize Record
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add To Cart Pop Up Modal */}
      <AnimatePresence>
        {isAddToCartModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4 pt-6 sm:pt-12 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddToCartModalOpen(false);
                setSelectedProductId(null);
              }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 my-0 sm:my-2 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 block mb-0.5">
                      Add To Order
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white leading-tight">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">{selectedProduct.category}</p>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => {
                    setIsAddToCartModalOpen(false);
                    setSelectedProductId(null);
                  }} 
                  className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </motion.button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-4 sm:space-y-5">
                {/* Product Info Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Unit Price</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {currencySymbol}{selectedProduct.salesPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Stock Available</span>
                    <span className={`text-lg font-black ${selectedProduct.quantity > selectedProduct.lowStockThreshold ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                      {selectedProduct.quantity} units
                    </span>
                  </div>
                </div>

                {itemInCartTotal(cart, selectedProduct.id) > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold p-3 rounded-xl flex items-center justify-between">
                    <span>In Cart Currently:</span>
                    <span className="font-mono text-sm">{itemInCartTotal(cart, selectedProduct.id)} units</span>
                  </div>
                )}

                {/* Quantity Selector */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Quantity to Add
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Max: {Math.max(0, selectedProduct.quantity - itemInCartTotal(cart, selectedProduct.id))}
                    </span>
                  </div>
                  
                  <div className="flex items-center p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQtyInput(Math.max(1, qtyInput - 1))}
                      className="p-3 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                      <Minus className="w-5 h-5" />
                    </motion.button>
                    <input 
                      type="number" 
                      min="1"
                      max={selectedProduct.quantity}
                      className="w-full text-center font-black text-xl focus:outline-none bg-transparent text-slate-900 dark:text-slate-100"
                      value={qtyInput}
                      onChange={(e) => setQtyInput(parseInt(e.target.value) || 0)}
                    />
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQtyInput(Math.min(selectedProduct.quantity - itemInCartTotal(cart, selectedProduct.id), qtyInput + 1))}
                      className="p-3 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex gap-2 pt-1">
                    {[1, 2, 5, 10].map((preset) => {
                      const maxAvailable = selectedProduct.quantity - itemInCartTotal(cart, selectedProduct.id);
                      const isDisabled = preset > maxAvailable;
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setQtyInput(preset)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            qtyInput === preset
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          +{preset}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setQtyInput(Math.max(1, selectedProduct.quantity - itemInCartTotal(cart, selectedProduct.id)))}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold border bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Subtotal Calculation */}
                <div className="bg-indigo-600/5 dark:bg-indigo-600/10 p-4 rounded-2xl border border-indigo-600/10 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block">Item Subtotal</span>
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {currencySymbol}{(qtyInput * selectedProduct.salesPrice).toFixed(2)}
                    </span>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-indigo-400/40" />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddToCartModalOpen(false);
                    setSelectedProductId(null);
                  }}
                  className="px-4 sm:px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 text-xs uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={addToCart}
                  disabled={qtyInput <= 0 || (itemInCartTotal(cart, selectedProduct.id) + qtyInput > selectedProduct.quantity)}
                  className="flex-1 py-3.5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs sm:text-sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add To Cart
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

