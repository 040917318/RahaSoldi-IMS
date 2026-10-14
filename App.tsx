
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Package, ShoppingCart, BrainCircuit, Menu, X, History, Wifi, WifiOff, Loader2, PieChart, Truck, LogOut, Shield, RefreshCw, Moon, Sun, FileText, Clock, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InventoryItem, SaleRecord, SaleItem, ViewState, ExpenseRecord, UserRole, AuditLog, PendingSale } from './types';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { 
  initImageCache, 
  saveCachedImage, 
  getCachedImageSync, 
  removeCachedImage, 
  mergeInventoryWithLocalCache 
} from './services/imageCache';
import { 
  checkImageUrlColumnSupport, 
  pushLocalImagesToDatabase 
} from './services/databaseSchemaHelper';

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
  const [activeView, setActiveView] = useState<ViewState>(() => {
    try {
      const saved = localStorage.getItem('activeView') as ViewState;
      return saved || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  useEffect(() => {
    try {
      if (activeView) localStorage.setItem('activeView', activeView);
    } catch (e) {
      console.error('Failed to save activeView', e);
    }
  }, [activeView]);

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

  // Inventory Instant Deletion & Undo State
  const [pendingDelete, setPendingDelete] = useState<{
    item: InventoryItem;
    index: number;
    timerId: ReturnType<typeof setTimeout>;
  } | null>(null);

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
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const local = localStorage.getItem('inventory');
      return local ? JSON.parse(local) : [];
    } catch { return []; }
  });
  const [dbKeys, setDbKeys] = useState<{ [key: string]: string }>({});
  const [hasDbImageSupport, setHasDbImageSupport] = useState<boolean | null>(null);
  const [isSyncingImages, setIsSyncingImages] = useState(false);

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

      if (item.imageUrl !== undefined) {
        if (keys.imageUrl) mapped[keys.imageUrl] = item.imageUrl || null;
        else mapped.image_url = item.imageUrl || null;
      }

      return mapped;
    }
    return item;
  };
  const [sales, setSales] = useState<SaleRecord[]>(() => {
    try {
      const local = localStorage.getItem('sales');
      return local ? JSON.parse(local) : [];
    } catch { return []; }
  });
  const [pendingSales, setPendingSales] = useState<PendingSale[]>(() => {
    try {
      const local = localStorage.getItem('pendingSales');
      return local ? JSON.parse(local) : [];
    } catch { return []; }
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const local = localStorage.getItem('auditLogs');
      return local ? JSON.parse(local) : [];
    } catch { return []; }
  });
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Only reset to dashboard when explicitly signing in, not on TOKEN_REFRESHED or tab focus
      if (event === 'SIGNED_IN') {
        const savedView = localStorage.getItem('activeView') as ViewState;
        if (!savedView) setActiveView('dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load Cached Data on Mount
  useEffect(() => {
    const loadLocal = (key: string, setter: any) => {
        const local = localStorage.getItem(key);
        if(local) {
          try {
            const parsed = JSON.parse(local);
            if (key === 'inventory') {
              initImageCache(parsed);
              setter(mergeInventoryWithLocalCache(parsed));
            } else {
              setter(parsed);
            }
          } catch (e) {
            console.error(`Error loading cached ${key}:`, e);
          }
        }
    };
    loadLocal('inventory', setInventory);
    loadLocal('sales', setSales);
    loadLocal('pendingSales', setPendingSales);
    loadLocal('auditLogs', setAuditLogs);
    
    // Check pending actions
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    setPendingActions(queue.length);
  }, []);

  // Resilient Persist Helper (Protects against DOMException QuotaExceededError)
  const persist = (key: string, data: any) => {
    try {
      if (key === 'sales' && Array.isArray(data)) {
        // Strip heavy base64 images from sales items and cap local storage to most recent 100 sales
        const sanitized = data.slice(0, 100).map(sale => ({
          ...sale,
          items: Array.isArray(sale.items)
            ? sale.items.map((i: any) => ({
                itemId: i.itemId,
                name: i.name || 'Unnamed Item',
                quantity: Number(i.quantity) || 1,
                priceAtSale: Number(i.priceAtSale) || 0,
                costAtSale: Number(i.costAtSale) || 0,
                discount: Number(i.discount) || 0,
                imageUrl: (typeof i.imageUrl === 'string' && !i.imageUrl.startsWith('data:')) ? i.imageUrl : undefined
              }))
            : []
        }));
        localStorage.setItem(key, JSON.stringify(sanitized));
        return;
      }

      if (key === 'inventory' && Array.isArray(data)) {
        // Strip base64 images from local storage copy; images are securely in IndexedDB via imageCache
        const sanitized = data.map(item => ({
          ...item,
          imageUrl: (typeof item.imageUrl === 'string' && !item.imageUrl.startsWith('data:')) ? item.imageUrl : undefined
        }));
        localStorage.setItem(key, JSON.stringify(sanitized));
        return;
      }

      if (key === 'pendingSales' && Array.isArray(data)) {
        const sanitized = data.map(ps => ({
          ...ps,
          items: Array.isArray(ps.items)
            ? ps.items.map((i: any) => ({
                itemId: i.itemId,
                name: i.name || 'Unnamed Item',
                quantity: Number(i.quantity) || 1,
                priceAtSale: Number(i.priceAtSale) || 0,
                costAtSale: Number(i.costAtSale) || 0,
                discount: Number(i.discount) || 0,
                imageUrl: (typeof i.imageUrl === 'string' && !i.imageUrl.startsWith('data:')) ? i.imageUrl : undefined
              }))
            : []
        }));
        localStorage.setItem(key, JSON.stringify(sanitized));
        return;
      }

      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn(`[Storage] Failed to persist ${key} to localStorage:`, err);
      // Secondary fallback attempt: prune older sales
      try {
        if (key === 'sales' && Array.isArray(data)) {
          const minimal = data.slice(0, 30).map(s => ({
            id: s.id,
            totalAmount: Number(s.totalAmount) || 0,
            totalProfit: Number(s.totalProfit) || 0,
            recordedBy: s.recordedBy,
            timestamp: s.timestamp,
            items: (s.items || []).map((i: any) => ({
              itemId: i.itemId,
              name: i.name,
              quantity: i.quantity,
              priceAtSale: i.priceAtSale
            }))
          }));
          localStorage.setItem(key, JSON.stringify(minimal));
        }
      } catch (inner) {
        console.warn(`[Storage] Quota exceeded recovery failed for ${key}`, inner);
      }
    }
  };

  // Schema-Adaptive Cloud Helpers for Sales and Pending Sales
  const saveSaleToCloud = async (sale: SaleRecord): Promise<void> => {
    const cleanItems = (sale.items || []).map(i => ({
      itemId: i.itemId,
      name: i.name || 'Unnamed Item',
      quantity: Number(i.quantity) || 1,
      priceAtSale: Number(i.priceAtSale) || 0,
      costAtSale: Number(i.costAtSale) || 0,
      discount: Number(i.discount) || 0,
      imageUrl: (typeof i.imageUrl === 'string' && !i.imageUrl.startsWith('data:')) ? i.imageUrl : undefined
    }));

    // Primary Attempt: standard columns with timestamp
    const primaryPayload = {
      id: sale.id,
      items: cleanItems,
      total_amount: Number(sale.totalAmount) || 0,
      total_profit: Number(sale.totalProfit) || 0,
      recorded_by: sale.recordedBy || 'Staff',
      timestamp: sale.timestamp
    };

    const { error: err1 } = await supabase.from('sales').insert([primaryPayload]);
    if (!err1) return;

    console.warn("Primary sale insert failed, trying schema-adaptive fallbacks:", err1);

    // Fallback 1: Try with created_at instead of timestamp (frequent Supabase table default)
    const { error: err2 } = await supabase.from('sales').insert([{
      id: sale.id,
      items: cleanItems,
      total_amount: Number(sale.totalAmount) || 0,
      total_profit: Number(sale.totalProfit) || 0,
      recorded_by: sale.recordedBy || 'Staff',
      created_at: sale.timestamp
    }]);
    if (!err2) return;

    // Fallback 2: Try minimal with created_at (no recorded_by / total_profit)
    const { error: err3 } = await supabase.from('sales').insert([{
      id: sale.id,
      items: cleanItems,
      total_amount: Number(sale.totalAmount) || 0,
      created_at: sale.timestamp
    }]);
    if (!err3) return;

    // Fallback 3: Try minimal with timestamp
    const { error: err4 } = await supabase.from('sales').insert([{
      id: sale.id,
      items: cleanItems,
      total_amount: Number(sale.totalAmount) || 0,
      timestamp: sale.timestamp
    }]);
    if (!err4) return;

    // Fallback 4: Try stringified items if the items column in Postgres is TEXT instead of JSONB
    const { error: err5 } = await supabase.from('sales').insert([{
      id: sale.id,
      items: JSON.stringify(cleanItems),
      total_amount: Number(sale.totalAmount) || 0,
      created_at: sale.timestamp
    }]);
    if (!err5) return;

    // Fallback 5: CamelCase totalAmount
    const { error: err6 } = await supabase.from('sales').insert([{
      id: sale.id,
      items: cleanItems,
      totalAmount: Number(sale.totalAmount) || 0
    }]);
    if (!err6) return;

    // If all attempts failed, throw so the caller can queue it for offline/background sync
    throw err1;
  };

  const savePendingSaleToCloud = async (pendingSale: PendingSale): Promise<void> => {
    const cleanItems = (pendingSale.items || []).map(i => ({
      itemId: i.itemId,
      name: i.name || 'Unnamed Item',
      quantity: Number(i.quantity) || 1,
      priceAtSale: Number(i.priceAtSale) || 0,
      costAtSale: Number(i.costAtSale) || 0,
      discount: Number(i.discount) || 0,
      imageUrl: (typeof i.imageUrl === 'string' && !i.imageUrl.startsWith('data:')) ? i.imageUrl : undefined
    }));

    const primaryPayload = {
      id: pendingSale.id,
      customer_name: pendingSale.customerName,
      items: cleanItems,
      total_amount: Number(pendingSale.totalAmount) || 0,
      total_profit: Number(pendingSale.totalProfit) || 0,
      recorded_by: pendingSale.recordedBy || 'Staff',
      timestamp: pendingSale.timestamp,
      notes: pendingSale.notes || ''
    };

    const { error: err1 } = await supabase.from('pending_sales').insert([primaryPayload]);
    if (!err1) return;

    console.warn("Primary pending sale insert failed, trying schema-adaptive fallbacks:", err1);

    // Fallback 1: created_at instead of timestamp
    const { error: err2 } = await supabase.from('pending_sales').insert([{
      id: pendingSale.id,
      customer_name: pendingSale.customerName,
      items: cleanItems,
      total_amount: Number(pendingSale.totalAmount) || 0,
      total_profit: Number(pendingSale.totalProfit) || 0,
      created_at: pendingSale.timestamp,
      notes: pendingSale.notes || ''
    }]);
    if (!err2) return;

    // Fallback 2: minimal fields
    const { error: err3 } = await supabase.from('pending_sales').insert([{
      id: pendingSale.id,
      customer_name: pendingSale.customerName,
      items: cleanItems,
      total_amount: Number(pendingSale.totalAmount) || 0
    }]);
    if (!err3) return;

    throw err1;
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
                        await saveSaleToCloud(sale);
                        await updateSupabaseInventory(items);
                        break;
                    }
                    case 'DEFER_SALE': {
                        const { pendingSale: pSale, items: deferredItems } = action.payload;
                        await savePendingSaleToCloud(pSale);
                        await updateSupabaseInventory(deferredItems);
                        break;
                    }
                    case 'COMPLETE_PENDING': {
                        const { saleId, finalizedSale } = action.payload;
                        await saveSaleToCloud(finalizedSale);
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
    try {
      for (const item of items) {
        const qtyKey = dbKeys.quantity || 'quantity';
        const updateKey = dbKeys.lastUpdated || 'last_updated';
        
        const { data: curr, error: selErr } = await supabase.from('inventory').select(qtyKey).eq('id', item.itemId).maybeSingle();
        if (curr) {
            const currentQty = Number((curr as any)[qtyKey] ?? 0);
            const newQty = isRestock ? currentQty + item.quantity : currentQty - item.quantity;
            const payload: any = {};
            payload[qtyKey] = newQty;
            payload[updateKey] = new Date().toISOString();
            
            const { error: updErr } = await supabase.from('inventory').update(payload).eq('id', item.itemId);
            if (updErr) {
              // Try fallback with only quantity update if last_updated column differs
              await supabase.from('inventory').update({ [qtyKey]: newQty }).eq('id', item.itemId);
            }
        }
      }
    } catch (e) {
      console.warn("Could not sync inventory quantity to supabase:", e);
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
      // Proactively check schema image support
      checkImageUrlColumnSupport().then(res => {
        setHasDbImageSupport(res.hasImageUrlColumn);
      }).catch(e => console.warn('Schema check notice:', e));

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
          
          const imageKeys = ['image_url', 'imageUrl', 'image', 'photo_url', 'photo'];
          detected.imageUrl = imageKeys.find(k => k in first) || 'image_url';
          
          setDbKeys(detected);

          const formattedInv: InventoryItem[] = invData.map((i: any) => {
              const costPrice = Number(i[detected.costPrice] ?? 0);
              const salesPrice = Number(i[detected.salesPrice] ?? 0);
              const dbImg = i[detected.imageUrl] || i.image_url || i.imageUrl || i.image;
              
              // Resilient local cache merge: if DB doesn't have an image, preserve existing local cached image
              const cachedImg = getCachedImageSync(i.id);
              const finalImg = (typeof dbImg === 'string' && dbImg.trim().length > 0)
                ? dbImg
                : cachedImg;

              if (finalImg && i.id) {
                saveCachedImage(i.id, finalImg);
              }

              return {
                  id: i.id,
                  name: i.name,
                  category: i.category,
                  quantity: Number(i[detected.quantity] ?? 0),
                  costPrice: isNaN(costPrice) ? 0 : costPrice,
                  salesPrice: isNaN(salesPrice) ? 0 : salesPrice,
                  lowStockThreshold: Number(i[detected.lowStockThreshold] ?? 5),
                  lastUpdated: i[detected.lastUpdated] ?? new Date().toISOString(),
                  imageUrl: finalImg || undefined
              };
          });
          const mergedInv = mergeInventoryWithLocalCache(formattedInv);
          setInventory(mergedInv);
          persist('inventory', mergedInv);
      } else if (invData) {
          setInventory([]);
          persist('inventory', []);
      }
    } catch (error: any) {
      console.error("Inventory fetch error:", error);
      // We don't block the whole app for one table failure
    }

    // Fetch Sales separately with resilient parsing
    try {
      const { data: salesData, error: salesErr } = await supabase.from('sales').select('*');
      if (salesErr) throw salesErr;
      if (salesData) {
          const formattedSales: SaleRecord[] = salesData.map(s => {
              let parsedItems = s.items;
              if (typeof parsedItems === 'string') {
                try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; }
              }
              if (!Array.isArray(parsedItems)) parsedItems = [];

              const totalAmount = Number(s.total_amount ?? s.totalAmount ?? 0);
              const totalProfit = Number(s.total_profit ?? s.totalProfit ?? 0);
              return {
                  id: s.id || crypto.randomUUID(),
                  items: parsedItems,
                  totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
                  totalProfit: isNaN(totalProfit) ? 0 : totalProfit,
                  recordedBy: s.recorded_by ?? s.recordedBy ?? 'Staff',
                  timestamp: s.timestamp ?? s.created_at ?? s.createdAt ?? new Date().toISOString()
              };
          }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          setSales(formattedSales);
          persist('sales', formattedSales);
      }
    } catch (error: any) {
      console.error("Sales fetch error:", error);
    }

    // Fetch Pending Sales separately with resilient parsing
    try {
      const { data: pendingData, error: pendingErr } = await supabase.from('pending_sales').select('*');
      if (pendingErr) throw pendingErr;

      if (pendingData) {
          const formattedPending: PendingSale[] = pendingData.map(p => {
              let parsedItems = p.items;
              if (typeof parsedItems === 'string') {
                try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; }
              }
              if (!Array.isArray(parsedItems)) parsedItems = [];

              const totalAmount = Number(p.total_amount ?? p.totalAmount ?? 0);
              const totalProfit = Number(p.total_profit ?? p.totalProfit ?? 0);
              return {
                  id: p.id || crypto.randomUUID(),
                  customerName: p.customer_name ?? p.customerName ?? 'Guest',
                  items: parsedItems,
                  totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
                  totalProfit: isNaN(totalProfit) ? 0 : totalProfit,
                  recordedBy: p.recorded_by ?? p.recordedBy ?? 'Staff',
                  timestamp: p.timestamp ?? p.created_at ?? p.createdAt ?? new Date().toISOString(),
                  notes: p.notes
              };
          }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
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

    // Cache image locally immediately so it is NEVER lost
    if (newItem.imageUrl) {
      saveCachedImage(newItem.id, newItem.imageUrl);
    }

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
      let { error } = await supabase.from('inventory').insert([dbItem]);
      // If remote table doesn't have image_url column yet, retry without it
      if (error && (error.message?.includes('image_url') || error.message?.includes('imageUrl') || error.code === 'PGRST204')) {
        setHasDbImageSupport(false);
        const { image_url, imageUrl, ...fallbackDbItem } = dbItem;
        const retry = await supabase.from('inventory').insert([fallbackDbItem]);
        error = retry.error;
      } else if (!error && newItem.imageUrl) {
        setHasDbImageSupport(true);
      }

      if (error) {
          console.error("Error adding item to DB:", error);
          setFetchError(`Database sync notice: ${error.message}. Product & image preserved locally.`);
      }
    } catch (err: any) {
      console.error("Fatal error adding item:", err);
      setFetchError(`Connection notice: ${err.message}. Saved locally.`);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<InventoryItem>, reason?: string) => {
    const oldItem = inventory.find(i => i.id === id);
    if (!oldItem) return;

    const updatedTimestamp = new Date().toISOString();
    const finalUpdates = { ...updates, lastUpdated: updatedTimestamp };

    // Update local image cache immediately
    if (updates.imageUrl) {
      saveCachedImage(id, updates.imageUrl);
    } else if (updates.imageUrl === null || updates.imageUrl === '') {
      removeCachedImage(id);
    }

    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.quantity !== undefined) payload[dbKeys.quantity || 'quantity'] = updates.quantity;
    if (updates.costPrice !== undefined) payload[dbKeys.costPrice || 'cost_price'] = updates.costPrice;
    if (updates.salesPrice !== undefined) payload[dbKeys.salesPrice || 'sales_price'] = updates.salesPrice;
    if (updates.lowStockThreshold !== undefined) payload[dbKeys.lowStockThreshold || 'low_stock_threshold'] = updates.lowStockThreshold;
    if (updates.imageUrl !== undefined) payload[dbKeys.imageUrl || 'image_url'] = updates.imageUrl || null;
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
      let { error } = await supabase.from('inventory').update(payload).eq('id', id);
      // If remote table doesn't have image_url column yet, retry without it
      if (error && (error.message?.includes('image_url') || error.message?.includes('imageUrl') || error.code === 'PGRST204')) {
        setHasDbImageSupport(false);
        const { image_url, imageUrl, ...fallbackPayload } = payload;
        const retry = await supabase.from('inventory').update(fallbackPayload).eq('id', id);
        error = retry.error;
      } else if (!error && updates.imageUrl) {
        setHasDbImageSupport(true);
      }

      if (error) {
           console.error("Error updating item in DB:", error);
           setFetchError(`Cloud update: ${error.message}. Local changes & photo are intact.`);
      }
    } catch (err: any) {
      console.error("Fatal error updating item:", err);
      setFetchError(`Cloud sync: ${err.message}`);
    }
  };

  const commitPermanentDelete = async (id: string) => {
    removeCachedImage(id);

    if (!isOnline) {
      queueAction({ type: 'DELETE_ITEM', payload: { id } });
      return;
    }

    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) console.error("Error permanently deleting item from DB:", error);
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const handleDeleteItem = (id: string) => {
    // If another deletion was already pending undo, commit it now
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      commitPermanentDelete(pendingDelete.item.id);
    }

    const itemIndex = inventory.findIndex(item => item.id === id);
    if (itemIndex === -1) return;
    const deletedItem = inventory[itemIndex];

    // Instantly remove from inventory UI & local persistence
    const updatedInventory = inventory.filter(item => item.id !== id);
    setInventory(updatedInventory);
    persist('inventory', updatedInventory);
    logAction(deletedItem.id, deletedItem.name, 'adjustment', `Item removed from inventory`);

    // 6 second timer before permanently committing deletion to cloud database
    const timer = setTimeout(() => {
      commitPermanentDelete(id);
      setPendingDelete(null);
    }, 6000);

    setPendingDelete({
      item: deletedItem,
      index: itemIndex,
      timerId: timer
    });
  };

  const handleUndoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    const restoredItem = pendingDelete.item;
    const restoredIndex = pendingDelete.index;

    setInventory(prev => {
      const next = [...prev];
      if (restoredIndex >= 0 && restoredIndex <= next.length) {
        next.splice(restoredIndex, 0, restoredItem);
      } else {
        next.push(restoredItem);
      }
      persist('inventory', next);
      return next;
    });

    logAction(restoredItem.id, restoredItem.name, 'create', `Item restored via Undo`);
    setPendingDelete(null);
  };

  const handleDismissDeleteToast = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    commitPermanentDelete(pendingDelete.item.id);
    setPendingDelete(null);
  };

  const handleRecheckDbSchema = async () => {
    const res = await checkImageUrlColumnSupport();
    setHasDbImageSupport(res.hasImageUrlColumn);
    return res;
  };

  const handlePushImagesToCloud = async () => {
    setIsSyncingImages(true);
    try {
      const res = await pushLocalImagesToDatabase(inventory);
      if (res.syncedCount > 0) {
        setHasDbImageSupport(true);
        fetchData();
      }
      return res;
    } finally {
      setIsSyncingImages(false);
    }
  };

  const handleCompleteSale = async (items: SaleItem[]): Promise<SaleRecord> => {
    // Sanitize sale items: ensure proper numbers and strip out any base64 data URLs to prevent storage/payload errors
    const sanitizedItems: SaleItem[] = (items || []).map(item => ({
      itemId: item.itemId,
      name: item.name || 'Unnamed Item',
      quantity: Number(item.quantity) || 1,
      priceAtSale: Number(item.priceAtSale) || 0,
      costAtSale: Number(item.costAtSale) || 0,
      discount: Number(item.discount) || 0,
      imageUrl: (typeof item.imageUrl === 'string' && !item.imageUrl.startsWith('data:')) ? item.imageUrl : undefined
    }));

    const totalAmount = sanitizedItems.reduce((sum, item) => sum + ((item.quantity * item.priceAtSale) - (item.discount || 0)), 0);
    const totalCost = sanitizedItems.reduce((sum, item) => sum + (item.quantity * item.costAtSale), 0);
    const nowIso = new Date().toISOString();
    
    const newSale: SaleRecord = {
      id: crypto.randomUUID(),
      items: sanitizedItems,
      totalAmount,
      totalProfit: totalAmount - totalCost,
      recordedBy: session?.user?.email || 'Staff',
      timestamp: nowIso
    };

    // Update Local Inventory & Sales state
    const newInventory = [...inventory];
    sanitizedItems.forEach(saleItem => {
      const productIndex = newInventory.findIndex(p => p.id === saleItem.itemId);
      if (productIndex > -1) {
        const oldQty = newInventory[productIndex].quantity;
        const newQty = oldQty - saleItem.quantity;
        newInventory[productIndex] = { ...newInventory[productIndex], quantity: newQty, lastUpdated: nowIso };
        logAction(saleItem.itemId, saleItem.name, 'sale', `Sold ${saleItem.quantity} units. Stock: ${oldQty} -> ${newQty}`);
      }
    });

    setInventory(newInventory);
    persist('inventory', newInventory);
    
    const newSales = [newSale, ...sales];
    setSales(newSales);
    persist('sales', newSales);

    if (!isOnline) {
      queueAction({ type: 'SALE', payload: { sale: newSale, items: sanitizedItems } });
      return newSale;
    }

    try {
      await saveSaleToCloud(newSale);
      await updateSupabaseInventory(sanitizedItems);
    } catch (err: any) {
      console.warn("Sale cloud sync failed; safely queued for offline/background sync:", err);
      queueAction({ type: 'SALE', payload: { sale: newSale, items: sanitizedItems } });
      setFetchError(`Cloud sync: ${err?.message || 'Queued for background sync'}`);
    }
    
    return newSale;
  };

  const handleDeferSale = async (items: SaleItem[], customerName: string, notes: string): Promise<PendingSale> => {
    const sanitizedItems: SaleItem[] = (items || []).map(item => ({
      itemId: item.itemId,
      name: item.name || 'Unnamed Item',
      quantity: Number(item.quantity) || 1,
      priceAtSale: Number(item.priceAtSale) || 0,
      costAtSale: Number(item.costAtSale) || 0,
      discount: Number(item.discount) || 0,
      imageUrl: (typeof item.imageUrl === 'string' && !item.imageUrl.startsWith('data:')) ? item.imageUrl : undefined
    }));

    const totalAmount = sanitizedItems.reduce((sum, item) => sum + ((item.quantity * item.priceAtSale) - (item.discount || 0)), 0);
    const totalCost = sanitizedItems.reduce((sum, item) => sum + (item.quantity * item.costAtSale), 0);
    const nowIso = new Date().toISOString();
    
    const pendingSale: PendingSale = {
      id: crypto.randomUUID(),
      customerName: (customerName || 'Guest').trim(),
      items: sanitizedItems,
      totalAmount,
      totalProfit: totalAmount - totalCost,
      recordedBy: session?.user?.email || 'Staff',
      timestamp: nowIso,
      notes: notes || ''
    };

    // Update Local Inventory & Pending Sales state
    const newInventory = [...inventory];
    sanitizedItems.forEach(saleItem => {
      const productIndex = newInventory.findIndex(p => p.id === saleItem.itemId);
      if (productIndex > -1) {
        const oldQty = newInventory[productIndex].quantity;
        const newQty = oldQty - saleItem.quantity;
        newInventory[productIndex] = { ...newInventory[productIndex], quantity: newQty, lastUpdated: nowIso };
        logAction(saleItem.itemId, saleItem.name, 'sale', `Deferred sale to ${customerName}. Stock: ${oldQty} -> ${newQty}`);
      }
    });

    setInventory(newInventory);
    persist('inventory', newInventory);
    
    const newPending = [pendingSale, ...pendingSales];
    setPendingSales(newPending);
    persist('pendingSales', newPending);

    if (!isOnline) {
      queueAction({ type: 'DEFER_SALE', payload: { pendingSale, items: sanitizedItems } });
      return pendingSale;
    }

    try {
      await savePendingSaleToCloud(pendingSale);
      await updateSupabaseInventory(sanitizedItems);
    } catch (err: any) {
      console.warn("Deferred sale cloud sync failed; safely queued for background sync:", err);
      queueAction({ type: 'DEFER_SALE', payload: { pendingSale, items: sanitizedItems } });
      setFetchError(`Cloud sync: ${err?.message || 'Queued for background sync'}`);
    }
    
    return pendingSale;
  };

  const handleCompletePendingSale = async (saleId: string) => {
    const pendingSale = pendingSales.find(s => s.id === saleId);
    if (!pendingSale) return;

    const sanitizedItems: SaleItem[] = (pendingSale.items || []).map(item => ({
      itemId: item.itemId,
      name: item.name || 'Unnamed Item',
      quantity: Number(item.quantity) || 1,
      priceAtSale: Number(item.priceAtSale) || 0,
      costAtSale: Number(item.costAtSale) || 0,
      discount: Number(item.discount) || 0,
      imageUrl: (typeof item.imageUrl === 'string' && !item.imageUrl.startsWith('data:')) ? item.imageUrl : undefined
    }));

    const finalizedSale: SaleRecord = {
      id: crypto.randomUUID(),
      items: sanitizedItems,
      totalAmount: Number(pendingSale.totalAmount) || 0,
      totalProfit: Number(pendingSale.totalProfit) || 0,
      recordedBy: session?.user?.email || 'Staff',
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
      await saveSaleToCloud(finalizedSale);
      const { error: deleteError } = await supabase.from('pending_sales').delete().eq('id', saleId);
      if (deleteError) {
        console.warn("Error deleting finalized pending sale from DB:", deleteError);
      }
    } catch (err: any) {
      console.warn("Complete pending sale cloud sync failed; safely queued for background sync:", err);
      queueAction({ type: 'COMPLETE_PENDING', payload: { saleId, finalizedSale } });
      setFetchError(`Cloud sync: ${err?.message || 'Queued for background sync'}`);
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
                     {activeView === 'inventory' && (
                       <InventoryManager 
                         inventory={inventory} 
                         onAdd={handleAddItem} 
                         onUpdate={handleUpdateItem} 
                         onDelete={handleDeleteItem} 
                         currencySymbol="GH₵" 
                         userRole={userRole} 
                         auditLogs={auditLogs}
                         hasDbImageSupport={hasDbImageSupport}
                         onRecheckDbSchema={handleRecheckDbSchema}
                         onPushImagesToCloud={handlePushImagesToCloud}
                         isSyncingImages={isSyncingImages}
                       />
                     )}
                    {activeView === 'pos' && (
                      <ErrorBoundary fallbackTitle="Sales Terminal encountered an issue" onReset={() => {
                        try { localStorage.removeItem('pos_cart_draft'); } catch {}
                      }}>
                        <SalesTerminal inventory={inventory} onCompleteSale={handleCompleteSale} onDeferSale={handleDeferSale} currencySymbol="GH₵" />
                      </ErrorBoundary>
                    )}
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

      {/* Floating Undo Toast for Instant Inventory Deletion */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold truncate">
                  Deleted &ldquo;{pendingDelete.item.name}&rdquo;
                </p>
                <p className="text-[11px] text-slate-400">
                  Tap Undo within 6s to restore
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleUndoDelete}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={handleDismissDeleteToast}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Dismiss and commit deletion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
