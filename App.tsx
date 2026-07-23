
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Package, ShoppingCart, BrainCircuit, Menu, X, History, Wifi, WifiOff, Loader2, PieChart, Truck, LogOut, Shield, RefreshCw, Moon, Sun, FileText, Clock, ChevronRight } from 'lucide-react';
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

  // Inactivity Timeout Logic
  useEffect(() => {
    if (!session) return;

    const INACTIVITY_TIMEOUT = 1 * 60 * 60 * 1000; // 1 hour

    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed > INACTIVITY_TIMEOUT) {
          handleSignOut();
          return true; // Was inactive
        }
      }
      return false; // Still active
    };

    // Immediate check on session load
    const wasInactive = checkInactivity();
    if (!wasInactive) {
      // If we are here, we are active, so update it
      updateActivity();
    }

    // Listen for events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => window.addEventListener(name, updateActivity));

    // Periodic check every minute
    const interval = setInterval(checkInactivity, 60000);

    return () => {
      events.forEach(name => window.removeEventListener(name, updateActivity));
      clearInterval(interval);
    };
  }, [session]);

  // Data State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dbKeys, setDbKeys] = useState<{ [key: string]: string }>({});

  const mapToDb = (item: any, table: 'inventory' | 'sales' | 'pending_sales') => {
    if (table === 'inventory') {
      const mapped: any = {};
      const keys = dbKeys;
      
      // Essential core keys
      mapped.id = item.id;
      mapped.name = item.name;
      mapped.category = item.category;
      mapped.quantity = item.quantity;
      mapped.last_updated = item.lastUpdated;

      // Dynamic mapping for prices and thresholds based on detected keys
      if (keys.costPrice) mapped[keys.costPrice] = item.costPrice;
      else mapped.cost_price = item.costPrice; // Fallback

      if (keys.salesPrice) mapped[keys.salesPrice] = item.salesPrice;
      else mapped.sales_price = item.salesPrice; // Fallback

      if (keys.lowStockThreshold) mapped[keys.lowStockThreshold] = item.lowStockThreshold;
      else mapped.low_stock_threshold = item.lowStockThreshold; // Fallback

      return mapped;
    }
    return item;
  };
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    loadLocal('auditLogs', setAuditLogs);
    
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
    if (isSyncing || !session) return;
    
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (queue.length === 0) return;

    setIsSyncing(true);
    const newQueue = [...queue];
    let processedCount = 0;

    try {
        // Try to process up to 10 items per batch to avoid blocking
        const batchSize = Math.min(newQueue.length, 10);
        
        for (let i = 0; i < batchSize; i++) {
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
                    case 'SALE': {
                        const { sale, items } = action.payload;
                        const { error: saleErr } = await supabase.from('sales').insert([{
                            id: sale.id,
                            items: sale.items,
                            total_amount: sale.totalAmount,
                            total_profit: sale.totalProfit,
                            recorded_by: sale.recordedBy,
                            timestamp: sale.timestamp
                        }]);
                        
                        if (saleErr) {
                            // Try fallback without recorded_by
                            const { error: fErr } = await supabase.from('sales').insert([{
                                id: sale.id,
                                items: sale.items,
                                total_amount: sale.totalAmount,
                                total_profit: sale.totalProfit,
                                timestamp: sale.timestamp
                            }]);
                            if (fErr) throw fErr;
                        }
                        await updateSupabaseInventory(items);
                        break;
                    }
                    case 'DEFER_SALE': {
                        const { pendingSale: pSale, items: deferredItems } = action.payload;
                        const { error: deferErr } = await supabase.from('pending_sales').insert([{
                            id: pSale.id,
                            customer_name: pSale.customerName,
                            items: pSale.items,
                            total_amount: pSale.totalAmount,
                            total_profit: pSale.totalProfit,
                            recorded_by: pSale.recordedBy,
                            timestamp: pSale.timestamp,
                            notes: pSale.notes
                        }]);
                        
                        if (deferErr) {
                            // Try fallback
                            const { error: fErr } = await supabase.from('pending_sales').insert([{
                                id: pSale.id,
                                customer_name: pSale.customerName,
                                items: pSale.items,
                                total_amount: pSale.totalAmount,
                                total_profit: pSale.totalProfit,
                                timestamp: pSale.timestamp
                            }]);
                            if (fErr) throw fErr;
                        }
                        await updateSupabaseInventory(deferredItems);
                        break;
                    }
                    case 'COMPLETE_PENDING': {
                        const { saleId, finalizedSale } = action.payload;
                        const { error: cpErr } = await supabase.from('sales').insert([{
                            id: finalizedSale.id,
                            items: finalizedSale.items,
                            total_amount: finalizedSale.totalAmount,
                            total_profit: finalizedSale.totalProfit,
                            recorded_by: finalizedSale.recordedBy,
                            timestamp: finalizedSale.timestamp
                        }]);
                        
                        if (cpErr) {
                            // Try fallback
                            const { error: fErr } = await supabase.from('sales').insert([{
                                id: finalizedSale.id,
                                items: finalizedSale.items,
                                total_amount: finalizedSale.totalAmount,
                                total_profit: finalizedSale.totalProfit,
                                timestamp: finalizedSale.timestamp
                            }]);
                            if (fErr) throw fErr;
                        }
                        await supabase.from('pending_sales').delete().eq('id', saleId);
                        break;
                    }
                    case 'CANCEL_PENDING': {
                        const { error: cancelErr } = await supabase.from('pending_sales').delete().eq('id', action.payload.id);
                        if (cancelErr) {
                            console.error("Queue sync error (Cancel Pending):", cancelErr);
                            throw cancelErr;
                        }
                        break;
                    }
                }
                success = true;
            } catch (err: any) {
                console.error(`Sync failed for ${action.type}:`, err);
                // If it's a schema error (PGRST204) or bad request (400), we might need to skip it
                // to avoid blocking the whole app. For now, we'll log it and move it to the back
                // if it's the first time failing, or drop it if it keeps failing.
                if (err.code === 'PGRST204' || err.status === 400) {
                   console.error("Permanent sync error, skipping item to unblock queue.");
                   success = true; // Mark as "processed" so it's removed
                } else {
                   // Network error or temporary issue - stop for now
                   break;
                }
            }

            if (success) {
                newQueue.shift();
                processedCount++;
                localStorage.setItem('offlineQueue', JSON.stringify(newQueue));
                setPendingActions(newQueue.length);
            } else {
                break;
            }
        }
    } finally {
        setIsSyncing(false);
        if (processedCount > 0) fetchData(); // Refresh data if anything changed
    }
  };

  // Trigger Sync when Online
  useEffect(() => {
    if (isOnline && pendingActions > 0 && !isSyncing) {
        processOfflineQueue();
    }
  }, [isOnline, pendingActions]);


  const updateSupabaseInventory = async (items: SaleItem[], isRestock = false) => {
    for (const item of items) {
      const qtyKey = dbKeys.quantity || 'quantity';
      const updateKey = dbKeys.lastUpdated || 'last_updated';
      
      const { data: curr } = await supabase.from('inventory').select(qtyKey).eq('id', item.itemId).single();
      if (curr) {
          const currentQty = Number((curr as any)[qtyKey] ?? 0);
          const newQty = isRestock ? currentQty + item.quantity : currentQty - item.quantity;
          const payload: any = {};
          payload[qtyKey] = newQty;
          payload[updateKey] = new Date().toISOString();
          
          await supabase.from('inventory').update(payload).eq('id', item.itemId);
      }
    }
  };

  // Fetch Data from Supabase
  const fetchData = async () => {
    if (!session) return;
    if (!isOnline) return; 

    setLoading(true);
    setFetchError(null);
    
    // Fetch Inventory separately
    try {
      const { data: invData, error: invErr } = await supabase.from('inventory').select('*').limit(1000);
      if (invErr) throw invErr;
      if (invData && invData.length > 0) {
          // Detect actual DB keys from the first record
          const first = invData[0];
          const detected: { [key: string]: string } = {};
          
          const costKeys = ['cost_price', 'costPrice', 'cost', 'unit_cost', 'buying_price', 'buyingPrice', 'purchase_price'];
          const salesKeys = ['sales_price', 'salesPrice', 'price', 'sell_price', 'sellPrice', 'unit_price', 'selling_price', 'sellingPrice'];
          const thresholdKeys = ['low_stock_threshold', 'lowStockThreshold'];
          const qtyKeys = ['quantity', 'stock', 'qty'];
          const updateKeys = ['last_updated', 'lastUpdated', 'updated_at', 'updatedAt'];

          detected.costPrice = costKeys.find(k => k in first) || 'cost_price';
          detected.salesPrice = salesKeys.find(k => k in first) || 'sales_price';
          detected.lowStockThreshold = thresholdKeys.find(k => k in first) || 'low_stock_threshold';
          detected.quantity = qtyKeys.find(k => k in first) || 'quantity';
          detected.lastUpdated = updateKeys.find(k => k in first) || 'last_updated';
          
          setDbKeys(detected);

          const formattedInv: InventoryItem[] = invData.map((i: any) => {
              const costPrice = Number(i[detected.costPrice] ?? 0);
              const salesPrice = Number(i[detected.salesPrice] ?? 0);
              return {
                  id: i.id,
                  name: i.name,
                  category: i.category,
                  quantity: Number(i[detected.quantity] ?? 0),
                  costPrice: isNaN(costPrice) ? 0 : costPrice,
                  salesPrice: isNaN(salesPrice) ? 0 : salesPrice,
                  lowStockThreshold: Number(i[detected.lowStockThreshold] ?? 5),
                  lastUpdated: i[detected.lastUpdated] ?? new Date().toISOString()
              };
          });
          setInventory(formattedInv);
          persist('inventory', formattedInv);
      } else if (invData) {
          setInventory([]);
          persist('inventory', []);
      }
    } catch (error: any) {
      console.error("Inventory fetch error:", error);
      // We don't block the whole app for one table failure
    }

    // Fetch Sales separately
    try {
      const { data: salesData, error: salesErr } = await supabase.from('sales').select('*');
      if (salesErr) throw salesErr;
      if (salesData) {
          const formattedSales: SaleRecord[] = salesData.map(s => {
              const totalAmount = Number(s.total_amount ?? s.totalAmount ?? 0);
              const totalProfit = Number(s.total_profit ?? s.totalProfit ?? 0);
              return {
                  id: s.id,
                  items: s.items || [],
                  totalAmount,
                  totalProfit,
                  recordedBy: s.recorded_by ?? s.recordedBy ?? 'N/A',
                  timestamp: s.timestamp ?? s.created_at ?? s.createdAt ?? new Date().toISOString()
              };
          }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          setSales(formattedSales);
          persist('sales', formattedSales);
      }
    } catch (error: any) {
      console.error("Sales fetch error:", error);
    }

    // Fetch Pending Sales separately
    try {
      const { data: pendingData, error: pendingErr } = await supabase.from('pending_sales').select('*');
      if (pendingErr) throw pendingErr;

      if (pendingData) {
          const formattedPending: PendingSale[] = pendingData.map(p => ({
              id: p.id,
              customerName: p.customer_name ?? p.customerName ?? 'Guest',
              items: p.items || [],
              totalAmount: Number(p.total_amount ?? p.totalAmount ?? 0),
              totalProfit: Number(p.total_profit ?? p.totalProfit ?? 0),
              recordedBy: p.recorded_by ?? p.recordedBy ?? 'N/A',
              timestamp: p.timestamp ?? p.created_at ?? p.createdAt ?? new Date().toISOString(),
              notes: p.notes
          })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          setPendingSales(formattedPending);
          persist('pendingSales', formattedPending);
      }
    } catch (error: any) {
      console.error("Pending sales fetch error:", error);
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
      const dbItem = mapToDb(newItem, 'inventory');
      const { error } = await supabase.from('inventory').insert([dbItem]);
      if (error) {
          console.error("Error adding item to DB:", error);
          setFetchError(`Database error: ${error.message}. Changes saved locally only.`);
      }
    } catch (err: any) {
      console.error("Fatal error adding item:", err);
      setFetchError(`Connection error: ${err.message}. Changes saved locally only.`);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<InventoryItem>, reason?: string) => {
    const oldItem = inventory.find(i => i.id === id);
    if (!oldItem) return;

    const updatedTimestamp = new Date().toISOString();
    const finalUpdates = { ...updates, lastUpdated: updatedTimestamp };

    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.quantity !== undefined) payload[dbKeys.quantity || 'quantity'] = updates.quantity;
    if (updates.costPrice !== undefined) payload[dbKeys.costPrice || 'cost_price'] = updates.costPrice;
    if (updates.salesPrice !== undefined) payload[dbKeys.salesPrice || 'sales_price'] = updates.salesPrice;
    if (updates.lowStockThreshold !== undefined) payload[dbKeys.lowStockThreshold || 'low_stock_threshold'] = updates.lowStockThreshold;
    payload[dbKeys.lastUpdated || 'last_updated'] = updatedTimestamp;

    if (updates.quantity !== undefined && updates.quantity !== oldItem.quantity) {
       const reasonText = reason ? ` [Reason: ${reason}]` : '';
       logAction(id, oldItem.name, 'adjustment', `Stock adjusted from ${oldItem.quantity} to ${updates.quantity}${reasonText}`);
    }

    const updatedInventory = inventory.map(item => item.id === id ? { ...item, ...finalUpdates } : item);
    setInventory(updatedInventory);
    persist('inventory', updatedInventory);

    if (!isOnline) {
        queueAction({ type: 'UPDATE_ITEM', payload: { id, updates: payload } });
        return;
    }

    try {
      const { error } = await supabase.from('inventory').update(payload).eq('id', id);
      if (error) {
           console.error("Error updating item in DB:", error);
           setFetchError(`Update failed in cloud: ${error.message}. Local state is correct.`);
      }
    } catch (err: any) {
      console.error("Fatal error updating item:", err);
      setFetchError(`Cloud sync failed: ${err.message}`);
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
        const saleData = {
            id: newSale.id,
            items: newSale.items,
            total_amount: newSale.totalAmount, 
            total_profit: newSale.totalProfit,
            recorded_by: newSale.recordedBy,
            timestamp: newSale.timestamp
        };

        const { error: saleError } = await supabase.from('sales').insert([saleData]);
        
        if (saleError) {
             console.warn("Primary sale insert failed, trying minimal fallback:", saleError);
             // Fallback: Try without recorded_by or other potentially missing columns
             const { error: fallbackError } = await supabase.from('sales').insert([{
                 id: newSale.id,
                 items: newSale.items,
                 total_amount: newSale.totalAmount,
                 total_profit: newSale.totalProfit,
                 timestamp: newSale.timestamp
             }]);
             
             if (fallbackError) throw fallbackError;
        }

        await updateSupabaseInventory(items);
    } catch (err) {
        console.error("Error in handleCompleteSale:", err);
        // Don't set error if it's a known schema issue we can live with, 
        // but tell user we couldn't save to cloud
        setFetchError(err instanceof Error ? err.message : "Failed to sync sale to cloud");
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
        const pendingSaleDto = {
          id: pendingSale.id,
          customer_name: pendingSale.customerName,
          items: pendingSale.items,
          total_amount: pendingSale.totalAmount,
          total_profit: pendingSale.totalProfit,
          recorded_by: pendingSale.recordedBy,
          timestamp: pendingSale.timestamp,
          notes: pendingSale.notes
        };

        const { error: deferError } = await supabase.from('pending_sales').insert([pendingSaleDto]);
        
        if (deferError) {
            console.warn("Primary pending sale insert failed, trying minimal fallback:", deferError);
            const { error: fallbackError } = await supabase.from('pending_sales').insert([{
                id: pendingSale.id,
                customer_name: pendingSale.customerName,
                items: pendingSale.items,
                total_amount: pendingSale.totalAmount,
                total_profit: pendingSale.totalProfit,
                timestamp: pendingSale.timestamp
            }]);
            
            if (fallbackError) throw fallbackError;
        }
        
        await updateSupabaseInventory(items);
    } catch (err) {
        console.error("Error in handleDeferSale:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to defer sale to cloud");
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
        const saleData = {
            id: finalizedSale.id,
            items: finalizedSale.items,
            total_amount: finalizedSale.totalAmount,
            total_profit: finalizedSale.totalProfit,
            recorded_by: finalizedSale.recordedBy,
            timestamp: finalizedSale.timestamp
        };

        const { error: saleError } = await supabase.from('sales').insert([saleData]);
        if (saleError) {
            console.warn("Finalizing pending sale failed, trying minimal fallback:", saleError);
            const { error: fallbackError } = await supabase.from('sales').insert([{
                id: finalizedSale.id,
                items: finalizedSale.items,
                total_amount: finalizedSale.totalAmount,
                total_profit: finalizedSale.totalProfit,
                timestamp: finalizedSale.timestamp
            }]);
            
            if (fallbackError) throw fallbackError;
        }
        const { error: deleteError } = await supabase.from('pending_sales').delete().eq('id', saleId);
        if (deleteError) {
            console.error("Error deleting from pending_sales after completion:", deleteError);
            throw new Error(`Sale finalized but could not remove from pending: ${deleteError.message}`);
        }
    } catch (err) {
        console.error("Error in handleCompletePendingSale:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to complete pending sale in cloud");
    }
  };

  const handleCancelPendingSale = async (saleId: string | number) => {
    console.log("Delete button clicked for saleId:", saleId);
    
    const saleToCancel = pendingSales.find(s => String(s.id) === String(saleId));
    if (!saleToCancel) return;

    // 1. Restore Inventory Stock
    const newInventory = [...inventory];
    saleToCancel.items.forEach(saleItem => {
      const productIndex = newInventory.findIndex(p => p.id === saleItem.itemId);
      if (productIndex > -1) {
        const oldQty = newInventory[productIndex].quantity;
        const newQty = oldQty + saleItem.quantity;
        newInventory[productIndex] = { 
          ...newInventory[productIndex], 
          quantity: newQty, 
          lastUpdated: new Date().toISOString() 
        };
        
        logAction(
          saleItem.itemId, 
          saleItem.name, 
          'adjustment', 
          `Cancelled pending sale for ${saleToCancel.customerName}. Stock returned: ${oldQty} -> ${newQty}`
        );

        // If offline, queue the inventory update specifically for this item
        if (!isOnline) {
          const updatedTimestamp = new Date().toISOString();
          const payload: any = {};
          payload[dbKeys.quantity || 'quantity'] = newQty;
          payload[dbKeys.lastUpdated || 'last_updated'] = updatedTimestamp;
          queueAction({ type: 'UPDATE_ITEM', payload: { id: saleItem.itemId, updates: payload } });
        }
      }
    });

    setInventory(newInventory);
    persist('inventory', newInventory);

    // 2. Remove Pending Sale from state
    const newPending = pendingSales.filter(s => String(s.id) !== String(saleId));
    setPendingSales(newPending);
    persist('pendingSales', newPending);

    if (!isOnline) {
        console.log("Offline: Queueing delete action");
        queueAction({ type: 'CANCEL_PENDING', payload: { id: saleId } });
        return;
    }

    try {
        console.log("Online: Sending delete and restock requests...");
        
        // Update Supabase Inventory (Restock)
        await updateSupabaseInventory(saleToCancel.items, true);
        
        // Delete the record
        const { error: deleteError } = await supabase.from('pending_sales').delete().eq('id', saleId);
        
        if (deleteError) {
            console.error("Database delete failed:", deleteError);
            queueAction({ type: 'CANCEL_PENDING', payload: { id: saleId } });
            setFetchError(`Cloud delete failed: ${deleteError.message}. Action queued for retry.`);
        } else {
            console.log("Successfully deleted and restocked in cloud database");
        }
    } catch (err: any) {
        console.error("Error in handleCancelPendingSale:", err);
        setFetchError(err.message || "Failed to process cancellation in cloud");
        queueAction({ type: 'CANCEL_PENDING', payload: { id: saleId } });
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem('lastActivity');
    await supabase.auth.signOut();
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => {
    const isActive = activeView === view;
    
    return (
      <motion.button
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => { setActiveView(view); setIsMobileMenuOpen(false); }}
        className={`w-[calc(100%-1.5rem)] mx-3 flex items-center justify-between px-4 py-3.5 mb-1 rounded-xl transition-all duration-300 relative group overflow-hidden ${
          isActive 
            ? 'bg-white/15 text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-white/20' 
            : 'text-indigo-100/60 hover:text-white hover:bg-white/5'
        }`}
      >
        {isActive && (
          <motion.div 
            layoutId="activeNav"
            className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-transparent pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
        <div className="flex items-center space-x-3 relative z-10">
          <div className={`p-2 rounded-lg transition-colors duration-300 ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-indigo-200/50 group-hover:bg-white/10 group-hover:text-white'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className={`font-semibold tracking-tight transition-all duration-300 ${isActive ? 'text-[15px]' : 'text-sm text-indigo-100/70'}`}>{label}</span>
        </div>
        {isActive && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative z-10"
            >
                <ChevronRight className="w-4 h-4 text-white/50" />
            </motion.div>
        )}
      </motion.button>
    );
  };

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
      <aside className="hidden lg:flex flex-col w-72 bg-gradient-to-b from-indigo-900 via-indigo-900 to-indigo-950 text-white fixed h-full shadow-2xl z-20 border-r border-white/5 overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-blue-500 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[30%] bg-indigo-500 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="p-8 flex flex-col items-start relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-3 group cursor-pointer"
          >
             <div className="bg-gradient-to-tr from-indigo-500 to-violet-500 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/30 group-hover:rotate-12 transition-transform duration-500">
               <LayoutDashboard className="w-6 h-6 text-white" />
             </div>
             <div>
                <h1 className="text-xl font-black tracking-tighter text-white leading-none">RAHA SOLDI</h1>
                <p className="text-[10px] text-indigo-300/60 uppercase tracking-[0.2em] font-bold mt-1">Enterprise Systems</p>
             </div>
          </motion.div>
        </div>

        <nav className="flex-1 mt-4 overflow-y-auto custom-scrollbar relative z-10 px-2">
          <div className="px-6 mb-4">
             <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.15em]">Main Navigation</p>
          </div>
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
          <NavItem view="pending" icon={Clock} label="Pending Sales" />
          <NavItem view="history" icon={History} label="Sales History" />
          <NavItem view="inventory" icon={Package} label="Inventory" />
          
          {userRole === 'admin' && (
            <>
              <div className="px-6 mt-8 mb-4">
                 <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.15em]">Admin Modules</p>
              </div>
              <NavItem view="invoices" icon={FileText} label="Invoices & Receipts" />
              <NavItem view="financials" icon={PieChart} label="Financial Reports" />
              <NavItem view="insights" icon={BrainCircuit} label="AI Insights" />
            </>
          )}
        </nav>
        
        <AnimatePresence>
          {fetchError && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mx-4 my-2 p-4 bg-rose-500/10 backdrop-blur-md border border-rose-500/20 rounded-2xl text-[11px] text-rose-100 flex flex-col gap-2 relative group shadow-lg"
            >
              <button 
                onClick={() => setFetchError(null)}
                className="absolute top-3 right-3 p-1.5 hover:bg-rose-500/20 rounded-full transition-colors"
                title="Clear Error"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-rose-500/20 rounded-lg">
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-rose-200">Sync Notice</p>
                  <p className="opacity-70 pr-4 mt-0.5 line-clamp-2">{fetchError}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button 
                      onClick={() => fetchData()} 
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 transition-all font-semibold border border-rose-500/30"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Sync
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 mt-2 relative z-10">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-4 shadow-inner">
                <div className="flex items-center space-x-3 mb-4">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg">
                      {session.user.email?.[0].toUpperCase()}
                   </div>
                   <div className="overflow-hidden">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <p className="text-[10px] text-indigo-300 uppercase font-black tracking-widest">{userRole}</p>
                      </div>
                      <p className="text-sm font-bold text-white truncate" title={session.user.email}>{session.user.email}</p>
                   </div>
                </div>
                
                <div className="flex gap-2">
                    <div className={`flex-1 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider py-1.5 px-2 rounded-lg border transition-all duration-300 ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                    {pendingActions > 0 && (
                        <div className="flex-1 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider py-1.5 px-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 animate-pulse">
                            {pendingActions} Sync
                        </div>
                    )}
                </div>

                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSignOut}
                    className="w-full mt-4 flex items-center justify-center space-x-2 bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 font-bold text-xs"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Terminate Session</span>
                </motion.button>
            </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full bg-indigo-900/90 backdrop-blur-md text-white z-30 flex items-center justify-between p-4 shadow-lg border-b border-white/10">
        <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-violet-500 p-2 rounded-xl shadow-lg">
                <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
               <span className="font-black text-base tracking-tighter leading-none">RAHA SOLDI</span>
               <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-transparent rounded-full mt-0.5" />
            </div>
        </div>
        <div className="flex items-center space-x-2">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-indigo-100 transition-colors"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2.5 rounded-xl bg-[#228B22] text-white shadow-lg shadow-[#228B22]/30"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-0 bg-indigo-950 z-20 pt-24 overflow-y-auto px-4 pb-10"
          >
            {/* Background Orbs for Mobile */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
                <div className="absolute top-[20%] left-[20%] w-[60%] h-[40%] bg-blue-500 rounded-full blur-[80px]" />
            </div>

            <div className="space-y-1 relative z-10">
                <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
                <NavItem view="pos" icon={ShoppingCart} label="Point of Sale" />
                <NavItem view="pending" icon={Clock} label="Pending Sales" />
                <NavItem view="history" icon={History} label="Sales History" />
                <NavItem view="inventory" icon={Package} label="Inventory" />
                
                {userRole === 'admin' && (
                  <>
                    <div className="px-6 py-4">
                       <div className="h-px w-full bg-white/10" />
                    </div>
                    <NavItem view="invoices" icon={FileText} label="Invoices & Receipts" />
                    <NavItem view="financials" icon={PieChart} label="Financial Reports" />
                    <NavItem view="insights" icon={BrainCircuit} label="AI Insights" />
                  </>
                )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5 relative z-10 px-2">
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-lg">
                   <div className="flex items-center space-x-3 mb-3">
                       <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-lg font-bold shadow-md text-white">
                          {session.user.email?.[0].toUpperCase()}
                       </div>
                       <div className="overflow-hidden">
                          <div className="flex items-center space-x-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <p className="text-[9px] text-indigo-300 uppercase font-black tracking-widest leading-none">{userRole}</p>
                          </div>
                          <p className="text-xs font-bold text-white truncate max-w-[180px] mt-0.5" title={session.user.email}>{session.user.email}</p>
                       </div>
                   </div>
                   
                   <div className="flex gap-2 mb-3">
                       <div className={`flex-1 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider py-1 px-2 rounded-lg border transition-all duration-300 ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                           {isOnline ? 'Online' : 'Offline'}
                       </div>
                       {pendingActions > 0 && (
                           <div className="flex-1 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider py-1 px-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 animate-pulse">
                               {pendingActions} Sync
                           </div>
                       )}
                   </div>

                   <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center space-x-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-300 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm"
                  >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Terminate Session</span>
                  </motion.button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 p-3 sm:p-6 lg:p-8 pt-16 sm:pt-20 lg:pt-8 pb-24 lg:pb-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6 lg:mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                {activeView === 'dashboard' && 'Business Overview'}
                {activeView === 'inventory' && 'Inventory Management'}
                {activeView === 'pos' && 'New Sale'}
                {activeView === 'pending' && 'Pending Sales'}
                {activeView === 'history' && 'Transaction History'}
                {activeView === 'financials' && 'Financial Health'}
                {activeView === 'insights' && 'Business Intelligence'}
                {activeView === 'invoices' && 'Invoices & Receipts'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1">
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
               <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
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
                    {activeView === 'history' && <SalesHistory sales={sales} pendingSales={pendingSales} currencySymbol="GH₵" />}
                    {userRole === 'admin' && activeView === 'financials' && <FinancialReport inventory={inventory} sales={sales} pendingSales={pendingSales} currencySymbol="GH₵" />}
                    {userRole === 'admin' && activeView === 'insights' && <AIInsights inventory={inventory} sales={sales} pendingSales={pendingSales} />}
                    {userRole === 'admin' && activeView === 'invoices' && (
                      <InvoiceReceiptGenerator 
                        sales={sales} 
                        pendingSales={pendingSales}
                        currencySymbol="GH₵" 
                      />
                    )}
                </Suspense>
             )}
          </div>
        </div>
      </main>

      {/* Mobile Quick Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 text-slate-300 z-30 px-2 py-1.5 flex justify-around items-center shadow-2xl">
        <button 
          onClick={() => { setActiveView('dashboard'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${activeView === 'dashboard' ? 'text-indigo-400 bg-indigo-500/15' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Overview</span>
        </button>
        <button 
          onClick={() => { setActiveView('pos'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${activeView === 'pos' ? 'text-indigo-400 bg-indigo-500/15' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span>POS</span>
        </button>
        <button 
          onClick={() => { setActiveView('pending'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all relative ${activeView === 'pending' ? 'text-indigo-400 bg-indigo-500/15' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span>Pending</span>
          {pendingSales.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
        <button 
          onClick={() => { setActiveView('inventory'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${activeView === 'inventory' ? 'text-indigo-400 bg-indigo-500/15' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>Stock</span>
        </button>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${isMobileMenuOpen ? 'text-indigo-400 bg-indigo-500/15' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </div>
    </div>
  );
};

export default App;
