import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, ShoppingCart, BrainCircuit, Menu, X, History, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { InventoryManager } from './components/InventoryManager';
import { SalesTerminal } from './components/SalesTerminal';
import { Dashboard } from './components/Dashboard';
import { AIInsights } from './components/AIInsights';
import { SalesHistory } from './components/SalesHistory';
import { InventoryItem, SaleRecord, SaleItem, ViewState } from './types';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  // State Management
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Data State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);

  // Connectivity Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Data from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Inventory
      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('*');
      
      if (invError) throw invError;
      if (invData) setInventory(invData);

      // Fetch Sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('timestamp', { ascending: false });

      if (salesError) throw salesError;
      if (salesData) setSales(salesData);

    } catch (error) {
      console.error("Error fetching data:", error);
      // Fallback to empty if critical failure, or show alert
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers
  const handleAddItem = async (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: crypto.randomUUID(), // Generate UUID
      lastUpdated: new Date().toISOString()
    };

    // Optimistic Update
    setInventory(prev => [...prev, newItem]);

    try {
      const { error } = await supabase.from('inventory').insert([newItem]);
      if (error) throw error;
    } catch (err) {
      console.error("Error adding item:", err);
      alert("Failed to save item to database.");
      fetchData(); // Revert on error
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<InventoryItem>) => {
    const updatedTimestamp = new Date().toISOString();
    const finalUpdates = { ...updates, lastUpdated: updatedTimestamp };

    // Optimistic Update
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...finalUpdates } : item));

    try {
      const { error } = await supabase
        .from('inventory')
        .update(finalUpdates)
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error("Error updating item:", err);
      alert("Failed to update item in database.");
      fetchData(); // Revert
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      // Optimistic Update
      setInventory(prev => prev.filter(item => item.id !== id));

      try {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error("Error deleting item:", err);
        alert("Failed to delete item from database.");
        fetchData(); // Revert
      }
    }
  };

  const handleCompleteSale = async (items: SaleItem[]) => {
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.priceAtSale), 0);
    const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.costAtSale), 0);
    
    const newSale: SaleRecord = {
      id: crypto.randomUUID(),
      items,
      totalAmount,
      totalProfit: totalAmount - totalCost,
      timestamp: new Date().toISOString()
    };

    // Optimistic Update for UI
    const newInventory = [...inventory];
    items.forEach(saleItem => {
      const productIndex = newInventory.findIndex(p => p.id === saleItem.itemId);
      if (productIndex > -1) {
        newInventory[productIndex] = {
            ...newInventory[productIndex],
            quantity: newInventory[productIndex].quantity - saleItem.quantity,
            lastUpdated: new Date().toISOString()
        };
      }
    });

    setInventory(newInventory);
    setSales(prev => [newSale, ...prev]);

    try {
        // 1. Record Sale
        const { error: saleError } = await supabase.from('sales').insert([newSale]);
        if (saleError) throw saleError;

        // 2. Update Inventory Quantities
        // Note: For strict consistency, this should be an RPC or transaction, 
        // but looping updates is acceptable for this scale.
        for (const item of items) {
             const currentItem = inventory.find(i => i.id === item.itemId);
             if (currentItem) {
                 const newQty = currentItem.quantity - item.quantity;
                 await supabase
                    .from('inventory')
                    .update({ quantity: newQty, lastUpdated: new Date().toISOString() })
                    .eq('id', item.itemId);
             }
        }
    } catch (err) {
        console.error("Error processing sale:", err);
        alert("Error saving sale to database. Please check connection.");
        fetchData(); // Revert to server state
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => { setActiveView(view); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center space-x-3 px-6 py-4 transition-colors ${
        activeView === view 
          ? 'bg-blue-900 border-l-4 border-secondary text-white' 
          : 'text-blue-200 hover:bg-blue-800 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  if (loading) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-primary">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <h2 className="text-xl font-bold">Loading Raha Soldi System...</h2>
              <p className="text-slate-500 mt-2">Connecting to Supabase Database</p>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-primary text-white fixed h-full shadow-xl z-20">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Raha Soldi <span className="text-secondary">Ent.</span></h1>
          <p className="text-xs text-blue-300 mt-1 uppercase tracking-wider">Inventory System</p>
        </div>
        <nav className="flex-1 mt-6">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
          <NavItem view="history" icon={History} label="Sales History" />
          <NavItem view="inventory" icon={Package} label="Inventory" />
          <NavItem view="insights" icon={BrainCircuit} label="AI Insights" />
        </nav>
        <div className="p-6">
            <div className={`flex items-center justify-center text-xs px-3 py-2 rounded-lg ${isOnline ? 'bg-blue-800 text-blue-200' : 'bg-red-800 text-red-100'}`}>
                {isOnline ? <Wifi className="w-3 h-3 mr-2" /> : <WifiOff className="w-3 h-3 mr-2" />}
                {isOnline ? 'Database Connected' : 'Offline Mode'}
            </div>
            <div className="text-center text-xs text-blue-400 mt-4">
                 &copy; {new Date().getFullYear()} Raha Soldi Ent.
            </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full bg-primary text-white z-30 flex items-center justify-between p-4 shadow-md">
        <h1 className="text-lg font-bold">Raha Soldi Ent.</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-primary z-20 pt-20">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
          <NavItem view="history" icon={History} label="Sales History" />
          <NavItem view="inventory" icon={Package} label="Inventory" />
          <NavItem view="insights" icon={BrainCircuit} label="AI Insights" />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {activeView === 'dashboard' && 'Business Overview'}
                {activeView === 'inventory' && 'Inventory Management'}
                {activeView === 'pos' && 'New Sale'}
                {activeView === 'history' && 'Transaction History'}
                {activeView === 'insights' && 'Business Intelligence'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {activeView === 'dashboard' && 'Welcome back, Manager.'}
                {activeView === 'inventory' && 'Manage your stock and pricing.'}
                {activeView === 'pos' && 'Process transactions quickly.'}
                {activeView === 'history' && 'Review past sales and performance.'}
                {activeView === 'insights' && 'AI-powered recommendations.'}
              </p>
            </div>
            <div className="text-right hidden sm:block">
               <div className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </header>

          <div className="fade-in">
            {activeView === 'dashboard' && <Dashboard inventory={inventory} sales={sales} currencySymbol="GH₵" />}
            {activeView === 'inventory' && <InventoryManager inventory={inventory} onAdd={handleAddItem} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} currencySymbol="GH₵" />}
            {activeView === 'pos' && <SalesTerminal inventory={inventory} onCompleteSale={handleCompleteSale} currencySymbol="GH₵" />}
            {activeView === 'history' && <SalesHistory sales={sales} currencySymbol="GH₵" />}
            {activeView === 'insights' && <AIInsights inventory={inventory} sales={sales} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;