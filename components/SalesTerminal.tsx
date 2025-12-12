import React, { useState, useEffect } from 'react';
import { InventoryItem, SaleItem } from '../types';
import { ShoppingCart, Plus, Trash2, CheckCircle, Search } from 'lucide-react';

interface SalesTerminalProps {
  inventory: InventoryItem[];
  onCompleteSale: (items: SaleItem[]) => void;
  currencySymbol: string;
}

export const SalesTerminal: React.FC<SalesTerminalProps> = ({ inventory, onCompleteSale, currencySymbol }) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [qtyInput, setQtyInput] = useState<number>(1);
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-clear success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    
    if (existingItemIndex > -1) {
        // Check if total new quantity exceeds stock
        if (cart[existingItemIndex].quantity + qtyInput > selectedProduct.quantity) {
             alert(`Cannot add more. Total in cart would exceed stock (${selectedProduct.quantity}).`);
             return;
        }

        const newCart = [...cart];
        newCart[existingItemIndex].quantity += qtyInput;
        setCart(newCart);
    } else {
        const newItem: SaleItem = {
            itemId: selectedProduct.id,
            name: selectedProduct.name,
            quantity: qtyInput,
            priceAtSale: selectedProduct.salesPrice,
            costAtSale: selectedProduct.costPrice
        };
        setCart([...cart, newItem]);
    }
    
    // Reset selection
    setSelectedProduct(null);
    setQtyInput(1);
    setSearchTerm('');
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    onCompleteSale(cart);
    setCart([]);
    setSuccessMsg('Sale recorded successfully!');
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.quantity * item.priceAtSale), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      {/* Left: Product Selection */}
      <div className="lg:col-span-2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition duration-150 ease-in-out"
              placeholder="Search product to add..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredInventory.map(item => (
              <div 
                key={item.id}
                onClick={() => setSelectedProduct(item)}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  selectedProduct?.id === item.id 
                    ? 'border-primary ring-2 ring-primary ring-opacity-50 bg-indigo-50' 
                    : 'border-slate-200 hover:border-primary hover:shadow-md bg-white'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                   <div className="font-bold text-slate-800 truncate">{item.name}</div>
                   <div className={`text-xs font-bold px-2 py-1 rounded-full ${item.quantity > item.lowStockThreshold ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     Qty: {item.quantity}
                   </div>
                </div>
                <div className="text-sm text-slate-500 mb-1">{item.category}</div>
                <div className="text-lg font-bold text-primary">{currencySymbol}{item.salesPrice.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Product Action Area */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
           {selectedProduct ? (
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4 w-full sm:w-auto">
                 <span className="font-medium text-slate-700 hidden sm:inline">Add {selectedProduct.name}:</span>
                 <div className="flex items-center border border-slate-300 rounded-lg bg-white">
                   <button 
                    onClick={() => setQtyInput(Math.max(1, qtyInput - 1))}
                    className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-l-lg border-r border-slate-300"
                   >-</button>
                   <input 
                    type="number" 
                    className="w-16 text-center py-2 focus:outline-none"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(parseInt(e.target.value) || 0)}
                   />
                    <button 
                    onClick={() => setQtyInput(qtyInput + 1)}
                    className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-r-lg border-l border-slate-300"
                   >+</button>
                 </div>
               </div>
               <button 
                onClick={addToCart}
                disabled={itemInCartTotal(cart, selectedProduct.id) + qtyInput > selectedProduct.quantity}
                className="w-full sm:w-auto px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-blue-800 shadow-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Plus className="w-5 h-5 mr-2" />
                 Add to Cart
               </button>
             </div>
           ) : (
             <div className="text-center text-slate-500 py-3">Select a product above to start adding to cart</div>
           )}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col h-full">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2" />
            Current Sale
          </h2>
          <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">{cart.length} items</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <div className="font-medium text-slate-800">{item.name}</div>
                  <div className="text-sm text-slate-500">{item.quantity} x {currencySymbol}{item.priceAtSale.toFixed(2)}</div>
                </div>
                <div className="flex items-center">
                  <span className="font-bold text-slate-800 mr-4">
                    {currencySymbol}{(item.quantity * item.priceAtSale).toFixed(2)}
                  </span>
                  <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <span className="text-slate-500 font-medium">Total Amount</span>
            <span className="text-3xl font-bold text-slate-900">{currencySymbol}{cartTotal.toFixed(2)}</span>
          </div>
          
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <CheckCircle className="w-6 h-6 mr-2" />
            Complete Sale
          </button>

          {successMsg && (
             <div className="mt-4 p-3 bg-green-100 text-green-800 text-center rounded-lg text-sm font-medium animate-pulse">
               {successMsg}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to calculate total quantity of an item already in cart
const itemInCartTotal = (cart: SaleItem[], itemId: string): number => {
    return cart.filter(i => i.itemId === itemId).reduce((acc, i) => acc + i.quantity, 0);
};