
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, ShoppingCart, BrainCircuit, Menu, X, History, Wifi, WifiOff, Loader2, PieChart, Truck, LogOut, Shield } from 'lucide-react';
import { InventoryManager } from './components/InventoryManager';
import { SalesTerminal } from './components/SalesTerminal';
import { Dashboard } from './components/Dashboard';
import { AIInsights } from './components/AIInsights';
import { SalesHistory } from './components/SalesHistory';
import { ExpensesManager } from './components/ExpensesManager';
import { FinancialReport } from './components/FinancialReport';
import { PurchaseOrdersManager } from './components/PurchaseOrdersManager';
import { Auth } from './components/Auth';
import { InventoryItem, SaleRecord, SaleItem, ViewState, ExpenseRecord, PurchaseOrder, UserRole, AuditLog } from './types';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

// Custom Cedi Icon Component
const CediSign = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M16 7a6 6 0 1 0 0 10" />
    <path d="M10 3v18" />
  </svg>
);

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // State Management
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Data State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

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

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Reset view to dashboard on login
      if (session) setActiveView('dashboard');
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data from Supabase
  const fetchData = async () => {
    if (!session) return; // Don't fetch if not logged in

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

      // Fetch Expenses
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (expError) throw expError;
      if (expData) setExpenses(expData);

      // Fetch Purchase Orders
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('date', { ascending: false });

      if (poError) {
         console.warn("Could not fetch purchase orders. Table might not exist yet.");
      } else if (poData) {
         setPurchaseOrders(poData);
      }
      
      // Fetch Audit Logs (Simulated for this demo as we can't create new tables in this environment)
      // In a real app: const { data: logData } = await supabase.from('audit_logs').select('*');
      // For now, we keep auditLogs in local state but don't overwrite it on fetch to maintain history during session
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when session becomes available
  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  // Helper: Create Audit Log
  const logAction = (
    itemId: string, 
    itemName: string, 
    action: AuditLog['action'], 
    details: string
  ) => {
    if (!session?.user) return;

    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      itemId,
      itemName,
      action,
      details,
      userId: session.user.email || 'Unknown User',
      timestamp: new Date().toISOString()
    };
    
    setAuditLogs(prev => [newLog, ...prev]);
    // In real app: await supabase.from('audit_logs').insert([newLog]);
  };

  // Handlers
  const handleAddItem = async (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: crypto.randomUUID(), // Generate UUID
      lastUpdated: new Date().toISOString()
    };

    // Optimistic Update
    setInventory(prev => [...prev, newItem]);
    logAction(newItem.id, newItem.name, 'create', `Item created. Initial Stock: ${newItem.quantity}`);

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
    const oldItem = inventory.find(i => i.id === id);
    if (!oldItem) return;

    const updatedTimestamp = new Date().toISOString();
    const finalUpdates = { ...updates, lastUpdated: updatedTimestamp };

    // Determine what changed for the log
    if (updates.quantity !== undefined && updates.quantity !== oldItem.quantity) {
       logAction(id, oldItem.name, 'adjustment', `Stock adjusted from ${oldItem.quantity} to ${updates.quantity}`);
    }
    if (updates.costPrice !== undefined && updates.costPrice !== oldItem.costPrice) {
       logAction(id, oldItem.name, 'update', `Cost price changed from ${oldItem.costPrice} to ${updates.costPrice}`);
    }
    if (updates.salesPrice !== undefined && updates.salesPrice !== oldItem.salesPrice) {
       logAction(id, oldItem.name, 'update', `Sales price changed from ${oldItem.salesPrice} to ${updates.salesPrice}`);
    }

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
    // Calculate total amount considering discounts
    const totalAmount = items.reduce((sum, item) => 
      sum + ((item.quantity * item.priceAtSale) - (item.discount || 0)), 0
    );
    
    // Total cost is purely COGS
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
        const oldQty = newInventory[productIndex].quantity;
        const newQty = oldQty - saleItem.quantity;
        
        newInventory[productIndex] = {
            ...newInventory[productIndex],
            quantity: newQty,
            lastUpdated: new Date().toISOString()
        };
        
        logAction(saleItem.itemId, saleItem.name, 'sale', `Sold ${saleItem.quantity} units. Stock: ${oldQty} -> ${newQty}`);
      }
    });

    setInventory(newInventory);
    setSales(prev => [newSale, ...prev]);

    try {
        // 1. Record Sale
        const { error: saleError } = await supabase.from('sales').insert([newSale]);
        if (saleError) throw saleError;

        // 2. Update Inventory Quantities
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

  const handleAddExpense = async (expense: Omit<ExpenseRecord, 'id' | 'recordedAt'>) => {
    const newExpense: ExpenseRecord = {
      ...expense,
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString()
    };

    setExpenses(prev => [newExpense, ...prev]);

    try {
      const { error } = await supabase.from('expenses').insert([newExpense]);
      if (error) throw error;
    } catch (err) {
      console.error("Error adding expense:", err);
      alert("Failed to save expense.");
      fetchData();
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('Delete this expense record?')) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error("Error deleting expense:", err);
        fetchData();
      }
    }
  };

  const handleCreatePO = async (po: Omit<PurchaseOrder, 'id'>) => {
    const newPO: PurchaseOrder = {
      ...po,
      id: crypto.randomUUID(),
    };

    setPurchaseOrders(prev => [newPO, ...prev]);

    try {
      const { error } = await supabase.from('purchase_orders').insert([newPO]);
      if (error) throw error;
    } catch (err) {
      console.error("Error creating PO:", err);
      alert("Failed to save Purchase Order.");
      fetchData();
    }
  };

  const handleUpdatePOStatus = async (id: string, status: 'received' | 'cancelled') => {
    const po = purchaseOrders.find(p => p.id === id);
    if (!po) return;

    // Optimistic Update
    setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, status } : p));

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Logic: If marking as RECEIVED, update inventory stock
      if (status === 'received' && po.status !== 'received') {
        const updatedInventory = [...inventory];
        
        for (const item of po.items) {
           const invIndex = updatedInventory.findIndex(i => i.id === item.itemId);
           if (invIndex > -1) {
             const currentInv = updatedInventory[invIndex];
             const newQty = currentInv.quantity + item.quantity;
             
             // Update local state
             updatedInventory[invIndex] = {
               ...currentInv,
               quantity: newQty,
               lastUpdated: new Date().toISOString()
             };
             
             logAction(item.itemId, item.name, 'restock', `PO Received (${po.supplier}). Added ${item.quantity} units. Stock: ${currentInv.quantity} -> ${newQty}`);

             // Update Database
             await supabase
               .from('inventory')
               .update({ quantity: newQty, lastUpdated: new Date().toISOString() })
               .eq('id', item.itemId);
           }
        }
        setInventory(updatedInventory);
      }

    } catch (err) {
      console.error("Error updating PO status:", err);
      alert("Failed to update order status.");
      fetchData();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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

  // 1. Initial Loading State
  if (authLoading) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-primary">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <h2 className="text-xl font-bold">Raha Soldi System</h2>
              <p className="text-slate-500 mt-2">Checking secure session...</p>
          </div>
      );
  }

  // 2. Auth Guard
  if (!session) {
    return <Auth />;
  }

  // Extract Role
  // In a real app we might fetch this from a 'profiles' table, but for this prototype we rely on metadata
  const userRole = (session.user.user_metadata?.role as UserRole) || 'cashier';

  // 3. Main Application
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-primary text-white fixed h-full shadow-xl z-20">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Raha Soldi <span className="text-secondary">Ent.</span></h1>
          <p className="text-xs text-blue-300 mt-1 uppercase tracking-wider">Inventory System</p>
        </div>
        <nav className="flex-1 mt-6 overflow-y-auto">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
          <NavItem view="history" icon={History} label="Sales History" />
          <NavItem view="inventory" icon={Package} label="Inventory" />
          
          {/* Admin Only Links */}
          {userRole === 'admin' && (
            <>
              <NavItem view="purchases" icon={Truck} label="Purchase Orders" />
              <NavItem view="expenses" icon={CediSign} label="Expenses" />
              <NavItem view="financials" icon={PieChart} label="Financial Reports" />
              <NavItem view="insights" icon={BrainCircuit} label="AI Insights" />
            </>
          )}
        </nav>
        <div className="p-6 border-t border-blue-800">
             <div className="mb-4">
                 <div className="flex items-center space-x-2 mb-1">
                   <Shield className="w-3 h-3 text-secondary" />
                   <p className="text-xs text-blue-300 uppercase">{userRole}</p>
                 </div>
                 <p className="text-sm font-medium truncate" title={session.user.email}>{session.user.email}</p>
             </div>
            <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-center space-x-2 bg-blue-900 hover:bg-blue-800 text-white py-2 rounded-lg transition-colors text-sm"
            >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
            </button>
            <div className={`mt-4 flex items-center justify-center text-xs px-3 py-2 rounded-lg ${isOnline ? 'bg-blue-800 text-blue-200' : 'bg-red-800 text-red-100'}`}>
                {isOnline ? <Wifi className="w-3 h-3 mr-2" /> : <WifiOff className="w-3 h-3 mr-2" />}
                {isOnline ? 'Online' : 'Offline Mode'}
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
        <div className="lg:hidden fixed inset-0 bg-primary z-20 pt-20 overflow-y-auto">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
          <NavItem view="history" icon={History} label="Sales History" />
          <NavItem view="inventory" icon={Package} label="Inventory" />
          
          {userRole === 'admin' && (
            <>
              <NavItem view="purchases" icon={Truck} label="Purchase Orders" />
              <NavItem view="expenses" icon={CediSign} label="Expenses" />
              <NavItem view="financials" icon={PieChart} label="Financial Reports" />
              <NavItem view="insights" icon={BrainCircuit} label="AI Insights" />
            </>
          )}

          <div className="p-4 border-t border-blue-800 mt-4">
             <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-center space-x-2 bg-blue-900 text-white py-3 rounded-lg"
            >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
            </button>
          </div>
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
                {activeView === 'expenses' && 'Expense Management'}
                {activeView === 'financials' && 'Financial Health'}
                {activeView === 'insights' && 'Business Intelligence'}
                {activeView === 'purchases' && 'Supplier Purchase Orders'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {activeView === 'dashboard' && 'Welcome back.'}
                {activeView === 'inventory' && 'Manage your stock and pricing.'}
                {activeView === 'pos' && 'Process transactions quickly.'}
                {activeView === 'history' && 'Review past sales and performance.'}
                {activeView === 'expenses' && 'Track operational costs.'}
                {activeView === 'financials' && 'Analyze Profit & Loss and Balance Sheet.'}
                {activeView === 'insights' && 'AI-powered recommendations.'}
                {activeView === 'purchases' && 'Create orders and restock inventory.'}
              </p>
            </div>
            <div className="text-right hidden sm:block">
               <div className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </header>

          <div className="fade-in">
             {loading ? (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                     <Loader2 className="w-10 h-10 animate-spin mb-4" />
                     <p>Loading data...</p>
                 </div>
             ) : (
                <>
                    {activeView === 'dashboard' && <Dashboard inventory={inventory} sales={sales} currencySymbol="GH₵" userRole={userRole} />}
                    {activeView === 'inventory' && <InventoryManager inventory={inventory} onAdd={handleAddItem} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} currencySymbol="GH₵" userRole={userRole} auditLogs={auditLogs} />}
                    {activeView === 'pos' && <SalesTerminal inventory={inventory} onCompleteSale={handleCompleteSale} currencySymbol="GH₵" />}
                    {activeView === 'history' && <SalesHistory sales={sales} currencySymbol="GH₵" />}
                    {userRole === 'admin' && activeView === 'expenses' && <ExpensesManager expenses={expenses} onAdd={handleAddExpense} currencySymbol="GH₵" />}
                    {userRole === 'admin' && activeView === 'financials' && <FinancialReport inventory={inventory} sales={sales} expenses={expenses} currencySymbol="GH₵" />}
                    {userRole === 'admin' && activeView === 'insights' && <AIInsights inventory={inventory} sales={sales} />}
                    {userRole === 'admin' && activeView === 'purchases' && (
                    <PurchaseOrdersManager 
                        inventory={inventory} 
                        purchaseOrders={purchaseOrders} 
                        onCreateOrder={handleCreatePO} 
                        onUpdateStatus={handleUpdatePOStatus} 
                        currencySymbol="GH₵" 
                    />
                    )}
                </>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
