
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { LayoutDashboard, Package, ShoppingCart, BrainCircuit, Menu, X, History, Wifi, WifiOff, Loader2, PieChart, Truck, LogOut, Shield, RefreshCw, Moon, Sun, FileText, Clock } from 'lucide-react';
import { Auth } from './components/Auth';
import { InventoryItem, SaleRecord, SaleItem, ViewState, ExpenseRecord, UserRole, AuditLog, PendingSale } from './types';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const InventoryManager = lazy(() => import('./components/InventoryManager').then(module => ({ default: module.InventoryManager })));
const SalesTerminal = lazy(() => import('./components/SalesTerminal').then(module => ({ default: module.SalesTerminal })));
const SalesHistory = lazy(() => import('./components/SalesHistory').then(module => ({ default: module.SalesHistory })));
const FinancialReport = lazy(() => import('./components/FinancialReport').then(module => ({ default: module.FinancialReport })));
const AIInsights = lazy(() => import('./components/AIInsights').then(module => ({ default: module.AIInsights })));
const InvoiceReceiptGenerator = lazy(() => import('./components/InvoiceReceiptGenerator').then(module => ({ default: module.InvoiceReceiptGenerator })));
const PendingSalesManager = lazy(() => import('./components/PendingSalesManager').then(module => ({ default: module.PendingSalesManager })));

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
  
  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Offline / Sync State
  const [pendingActions, setPendingActions] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Data State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  // Listen for system theme changes if no explicit preference is set
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if the user hasn't explicitly toggled it in this session
      // For a more robust solution, we'd need a 'system' state, but this helps
      // if they just open the app and change their OS theme.
      if (localStorage.getItem('darkMode') === null) {
        setIsDarkMode(e.matches);
      }
    };
    
    // Modern browsers use addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

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
      if (session) setActiveView('dashboard');
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load Cached Data on Mount
  useEffect(() => {
    const loadLocal = (key: string, setter: any) => {
        const local = localStorage.getItem(key);
        if(local) setter(JSON.parse(local));
    };
    loadLocal('inventory', setInventory);
    loadLocal('sales', setSales);
    loadLocal('pendingSales', setPendingSales);
    
    // Check pending actions
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    setPendingActions(queue.length);
  }, []);

  // Persist Helper
  const persist = (key: string, data: any) => {
      localStorage.setItem(key, JSON.stringify(data));
  };

  // Queue Action Helper
  const queueAction = (action: any) => {
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push(action);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    setPendingActions(queue.length);
  };

  // Process Offline Queue (Sync)
  const processOfflineQueue = async () => {
    if (isSyncing) return;
    
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (queue.length === 0) return;

    setIsSyncing(true);
    const newQueue = [...queue];

    try {
        while (newQueue.length > 0) {
            const action = newQueue[0];
            let success = false;

            try {
                switch (action.type) {
                    case 'ADD_ITEM':
                        await supabase.from('inventory').insert([action.payload]);
                        break;
                    case 'UPDATE_ITEM':
                        await supabase.from('inventory').update(action.payload.updates).eq('id', action.payload.id);
                        break;
                    case 'DELETE_ITEM':
                        await supabase.from('inventory').delete().eq('id', action.payload.id);
                        break;
                    case 'SALE':
                        const { sale, items } = action.payload;
                        const { error: saleErr } = await supabase.from('sales').insert([sale]);
                        if(saleErr) throw saleErr;
                        
                        await updateSupabaseInventory(items);
                        break;
                    case 'DEFER_SALE':
                        const { pendingSale, items: deferredItems } = action.payload;
                        await supabase.from('pending_sales').insert([pendingSale]);
                        await updateSupabaseInventory(deferredItems);
                        break;
                    case 'COMPLETE_PENDING':
                        const { saleId, finalizedSale } = action.payload;
                        await supabase.from('sales').insert([finalizedSale]);
                        await supabase.from('pending_sales').delete().eq('id', saleId);
                        break;
                    case 'CANCEL_PENDING':
                        await supabase.from('pending_sales').delete().eq('id', action.payload.id);
                        break;
                }
                success = true;
            } catch (err) {
                console.error("Error syncing action:", action, err);
                // If permanent error, maybe remove? For now, we abort sync loop
                break;
            }

            if (success) {
                newQueue.shift();
                localStorage.setItem('offlineQueue', JSON.stringify(newQueue));
                setPendingActions(newQueue.length);
            }
        }
    } finally {
        setIsSyncing(false);
        if (newQueue.length === 0) fetchData(); // Refresh data after successful sync
    }
  };

  // Trigger Sync when Online
  useEffect(() => {
    if (isOnline && pendingActions > 0 && !isSyncing) {
        processOfflineQueue();
    }
  }, [isOnline, pendingActions]);


  const updateSupabaseInventory = async (items: SaleItem[]) => {
    for (const item of items) {
      const { data: curr } = await supabase.from('inventory').select('quantity').eq('id', item.itemId).single();
      if (curr) {
          const newQty = curr.quantity - item.quantity;
          await supabase.from('inventory').update({ 
              quantity: newQty, 
              lastUpdated: new Date().toISOString() 
          }).eq('id', item.itemId);
      }
    }
  };

  // Fetch Data from Supabase
  const fetchData = async () => {
    if (!session) return;
    if (!isOnline) return; // Rely on cache if offline

    setLoading(true);
    try {
      // Fetch Inventory
      const { data: invData } = await supabase.from('inventory').select('*');
      if (invData) {
          setInventory(invData);
          persist('inventory', invData);
      }

      // Fetch Sales
      const { data: salesData } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });
      if (salesData) {
          setSales(salesData);
          persist('sales', salesData);
      }

      // Fetch Pending Sales
      const { data: pendingData } = await supabase.from('pending_sales').select('*').order('timestamp', { ascending: false });
      if (pendingData) {
          setPendingSales(pendingData);
          persist('pendingSales', pendingData);
      }
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  const logAction = (itemId: string, itemName: string, action: AuditLog['action'], details: string) => {
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
  };

  // Handlers with Offline Support
  const handleAddItem = async (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: crypto.randomUUID(),
      lastUpdated: new Date().toISOString()
    };

    const newInventory = [...inventory, newItem];
    setInventory(newInventory);
    persist('inventory', newInventory);
    logAction(newItem.id, newItem.name, 'create', `Item created. Initial Stock: ${newItem.quantity}`);

    if (!isOnline) {
        queueAction({ type: 'ADD_ITEM', payload: newItem });
        return;
    }

    try {
      const { error } = await supabase.from('inventory').insert([newItem]);
      if (error) throw error;
    } catch (err) {
      console.error("Error adding item:", err);
      // Fallback behavior could be added here
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<InventoryItem>, reason?: string) => {
    const oldItem = inventory.find(i => i.id === id);
    if (!oldItem) return;

    const updatedTimestamp = new Date().toISOString();
    const finalUpdates = { ...updates, lastUpdated: updatedTimestamp };

    if (updates.quantity !== undefined && updates.quantity !== oldItem.quantity) {
       const reasonText = reason ? ` [Reason: ${reason}]` : '';
       logAction(id, oldItem.name, 'adjustment', `Stock adjusted from ${oldItem.quantity} to ${updates.quantity}${reasonText}`);
    }

    const updatedInventory = inventory.map(item => item.id === id ? { ...item, ...finalUpdates } : item);
    setInventory(updatedInventory);
    persist('inventory', updatedInventory);

    if (!isOnline) {
        queueAction({ type: 'UPDATE_ITEM', payload: { id, updates: finalUpdates } });
        return;
    }

    try {
      const { error } = await supabase.from('inventory').update(finalUpdates).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error("Error updating item:", err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      const updatedInventory = inventory.filter(item => item.id !== id);
      setInventory(updatedInventory);
      persist('inventory', updatedInventory);

      if (!isOnline) {
          queueAction({ type: 'DELETE_ITEM', payload: { id } });
          return;
      }

      try {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error("Error deleting item:", err);
      }
    }
  };

  const handleCompleteSale = async (items: SaleItem[]): Promise<SaleRecord> => {
    const totalAmount = items.reduce((sum, item) => sum + ((item.quantity * item.priceAtSale) - (item.discount || 0)), 0);
    const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.costAtSale), 0);
    
    const newSale: SaleRecord = {
      id: crypto.randomUUID(),
      items,
      totalAmount,
      totalProfit: totalAmount - totalCost,
      recordedBy: session?.user?.email || 'Unknown',
      timestamp: new Date().toISOString()
    };

    // Update Local Inventory & Sales
    const newInventory = [...inventory];
    items.forEach(saleItem => {
      const productIndex = newInventory.findIndex(p => p.id === saleItem.itemId);
      if (productIndex > -1) {
        const oldQty = newInventory[productIndex].quantity;
        const newQty = oldQty - saleItem.quantity;
        newInventory[productIndex] = { ...newInventory[productIndex], quantity: newQty, lastUpdated: new Date().toISOString() };
        logAction(saleItem.itemId, saleItem.name, 'sale', `Sold ${saleItem.quantity} units. Stock: ${oldQty} -> ${newQty}`);
      }
    });

    setInventory(newInventory);
    persist('inventory', newInventory);
    
    const newSales = [newSale, ...sales];
    setSales(newSales);
    persist('sales', newSales);

    if (!isOnline) {
        queueAction({ type: 'SALE', payload: { sale: newSale, items } });
        return newSale;
    }

    try {
        const { error: saleError } = await supabase.from('sales').insert([newSale]);
        if (saleError) throw saleError;

        for (const item of items) {
             // Fetch current DB quantity to prevent race conditions
             const { data: curr } = await supabase.from('inventory').select('quantity').eq('id', item.itemId).single();
             if (curr) {
                 const newQty = curr.quantity - item.quantity;
                 await supabase.from('inventory').update({ 
                     quantity: newQty, 
                     lastUpdated: new Date().toISOString() 
                 }).eq('id', item.itemId);
             }
        }
    } catch (err) {
        console.error("Error processing sale:", err);
    }
    
    return newSale;
  };

  const handleDeferSale = async (items: SaleItem[], customerName: string, notes: string): Promise<PendingSale> => {
    const totalAmount = items.reduce((sum, item) => sum + ((item.quantity * item.priceAtSale) - (item.discount || 0)), 0);
    const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.costAtSale), 0);
    
    const pendingSale: PendingSale = {
      id: crypto.randomUUID(),
      customerName,
      items,
      totalAmount,
      totalProfit: totalAmount - totalCost,
      recordedBy: session?.user?.email || 'Unknown',
      timestamp: new Date().toISOString(),
      notes
    };

    // Update Local Inventory & Pending Sales
    const newInventory = [...inventory];
    items.forEach(saleItem => {
      const productIndex = newInventory.findIndex(p => p.id === saleItem.itemId);
      if (productIndex > -1) {
        const oldQty = newInventory[productIndex].quantity;
        const newQty = oldQty - saleItem.quantity;
        newInventory[productIndex] = { ...newInventory[productIndex], quantity: newQty, lastUpdated: new Date().toISOString() };
        logAction(saleItem.itemId, saleItem.name, 'sale', `Deferred sale to ${customerName}. Stock: ${oldQty} -> ${newQty}`);
      }
    });

    setInventory(newInventory);
    persist('inventory', newInventory);
    
    const newPending = [pendingSale, ...pendingSales];
    setPendingSales(newPending);
    persist('pendingSales', newPending);

    if (!isOnline) {
        queueAction({ type: 'DEFER_SALE', payload: { pendingSale, items } });
        return pendingSale;
    }

    try {
        await supabase.from('pending_sales').insert([pendingSale]);
        await updateSupabaseInventory(items);
    } catch (err) {
        console.error("Error processing defer sale:", err);
    }
    
    return pendingSale;
  };

  const handleCompletePendingSale = async (saleId: string) => {
    const pendingSale = pendingSales.find(s => s.id === saleId);
    if (!pendingSale) return;

    const finalizedSale: SaleRecord = {
      id: crypto.randomUUID(),
      items: pendingSale.items,
      totalAmount: pendingSale.totalAmount,
      totalProfit: pendingSale.totalProfit,
      recordedBy: session?.user?.email || 'Unknown',
      timestamp: new Date().toISOString()
    };

    // Update Local Sales & Remove from Pending
    const newSales = [finalizedSale, ...sales];
    setSales(newSales);
    persist('sales', newSales);

    const newPending = pendingSales.filter(s => s.id !== saleId);
    setPendingSales(newPending);
    persist('pendingSales', newPending);

    if (!isOnline) {
        queueAction({ type: 'COMPLETE_PENDING', payload: { saleId, finalizedSale } });
        return;
    }

    try {
        await supabase.from('sales').insert([finalizedSale]);
        await supabase.from('pending_sales').delete().eq('id', saleId);
    } catch (err) {
        console.error("Error completing pending sale:", err);
    }
  };

  const handleCancelPendingSale = async (saleId: string) => {
    const newPending = pendingSales.filter(s => s.id !== saleId);
    setPendingSales(newPending);
    persist('pendingSales', newPending);

    if (!isOnline) {
        queueAction({ type: 'CANCEL_PENDING', payload: { id: saleId } });
        return;
    }

    try {
        await supabase.from('pending_sales').delete().eq('id', saleId);
    } catch (err) {
        console.error("Error cancelling pending sale:", err);
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

  if (authLoading) {
      return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center text-primary">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Raha Soldi Ent.</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Checking secure session...</p>
          </div>
      );
  }

  if (!session) {
    return <Auth />;
  }

  const userRole = (session.user.user_metadata?.role as UserRole) || 'cashier';

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-primary text-white fixed h-full shadow-xl z-20">
        <div className="p-6 flex flex-col items-center border-b border-blue-800">
          <div className="flex items-center space-x-2 mb-2">
             <div className="bg-blue-800 p-2 rounded-lg">
               <LayoutDashboard className="w-6 h-6 text-white" />
             </div>
             <span className="text-lg font-bold">Raha Soldi Ent.</span>
          </div>
          <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold">Inventory System</p>
        </div>
        <nav className="flex-1 mt-6 overflow-y-auto">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
          <NavItem view="pending" icon={Clock} label="Pending Sales" />
          <NavItem view="history" icon={History} label="Sales History" />
          <NavItem view="inventory" icon={Package} label="Inventory" />
          
          {userRole === 'admin' && (
            <>
              <NavItem view="invoices" icon={FileText} label="Invoices & Receipts" />
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
            <div className="mt-4 space-y-2">
                <div className={`flex items-center justify-center text-xs px-3 py-2 rounded-lg ${isOnline ? 'bg-blue-800 text-blue-200' : 'bg-red-800 text-red-100'}`}>
                    {isOnline ? <Wifi className="w-3 h-3 mr-2" /> : <WifiOff className="w-3 h-3 mr-2" />}
                    {isOnline ? 'Online' : 'Offline Mode'}
                </div>
                {pendingActions > 0 && (
                    <div className="flex items-center justify-center text-xs px-3 py-2 rounded-lg bg-yellow-600 text-white animate-pulse">
                        <RefreshCw className={`w-3 h-3 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : `${pendingActions} Pending`}
                    </div>
                )}
            </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full bg-primary text-white z-30 flex items-center justify-between p-4 shadow-md">
        <div className="flex items-center space-x-2">
            <div className="bg-blue-800 p-1.5 rounded-lg">
                <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">Raha Soldi</span>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-blue-800 transition-colors"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-full hover:bg-blue-800 transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-primary z-20 pt-20 overflow-y-auto">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
          <NavItem view="pending" icon={Clock} label="Pending Sales" />
          <NavItem view="history" icon={History} label="Sales History" />
          <NavItem view="inventory" icon={Package} label="Inventory" />
          
          {userRole === 'admin' && (
            <>
              <NavItem view="invoices" icon={FileText} label="Invoices & Receipts" />
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
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {activeView === 'dashboard' && 'Business Overview'}
                {activeView === 'inventory' && 'Inventory Management'}
                {activeView === 'pos' && 'New Sale'}
                {activeView === 'pending' && 'Pending Sales'}
                {activeView === 'history' && 'Transaction History'}
                {activeView === 'financials' && 'Financial Health'}
                {activeView === 'insights' && 'Business Intelligence'}
                {activeView === 'invoices' && 'Invoices & Receipts'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {activeView === 'dashboard' && 'Welcome back.'}
                {activeView === 'inventory' && 'Manage your stock and pricing.'}
                {activeView === 'pos' && 'Process transactions quickly.'}
                {activeView === 'pending' && 'Manage credit/deferred records.'}
                {activeView === 'history' && 'Review past sales and performance.'}
                {activeView === 'financials' && 'Analyze Profit & Loss and Balance Sheet.'}
                {activeView === 'insights' && 'AI-powered recommendations.'}
                {activeView === 'invoices' && 'Generate custom invoices and receipts.'}
              </p>
            </div>
            <div className="text-right hidden lg:flex items-center space-x-4">
               <button
                 onClick={() => setIsDarkMode(!isDarkMode)}
                 className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm border border-slate-200 dark:border-slate-700"
                 title="Toggle Dark Mode"
               >
                 {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
               </button>
               <div className="text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </header>

          <div className="fade-in">
             {loading ? (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                     <Loader2 className="w-10 h-10 animate-spin mb-4" />
                     <p>Loading data...</p>
                 </div>
             ) : (
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p>Loading view...</p>
                  </div>
                }>
                    {activeView === 'dashboard' && <Dashboard inventory={inventory} sales={sales} pendingSales={pendingSales} auditLogs={auditLogs} currencySymbol="GH₵" userRole={userRole} />}
                    {activeView === 'inventory' && <InventoryManager inventory={inventory} onAdd={handleAddItem} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} currencySymbol="GH₵" userRole={userRole} auditLogs={auditLogs} />}
                    {activeView === 'pos' && <SalesTerminal inventory={inventory} onCompleteSale={handleCompleteSale} onDeferSale={handleDeferSale} currencySymbol="GH₵" />}
                    {activeView === 'pending' && <PendingSalesManager pendingSales={pendingSales} onComplete={handleCompletePendingSale} onCancel={handleCancelPendingSale} currencySymbol="GH₵" />}
                    {activeView === 'history' && <SalesHistory sales={sales} currencySymbol="GH₵" />}
                    {userRole === 'admin' && activeView === 'financials' && <FinancialReport inventory={inventory} sales={sales} currencySymbol="GH₵" />}
                    {userRole === 'admin' && activeView === 'insights' && <AIInsights inventory={inventory} sales={sales} />}
                    {userRole === 'admin' && activeView === 'invoices' && (
                      <InvoiceReceiptGenerator 
                        sales={sales} 
                        currencySymbol="GH₵" 
                      />
                    )}
                </Suspense>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
