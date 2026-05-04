
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  costPrice: number;
  salesPrice: number;
  lowStockThreshold: number;
  lastUpdated: string;
}

export interface SaleItem {
  itemId: string;
  name: string;
  quantity: number;
  priceAtSale: number;
  costAtSale: number;
  discount?: number;
}

export interface SaleRecord {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  totalProfit: number;
  recordedBy: string;
  timestamp: string;
}

export interface PendingSale {
  id: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  totalProfit: number;
  recordedBy: string;
  timestamp: string;
  notes?: string;
}

export interface ExpenseRecord {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  recordedAt: string;
}

export interface AuditLog {
  id: string;
  itemId: string;
  itemName: string;
  action: 'create' | 'update' | 'adjustment' | 'sale' | 'restock';
  details: string;
  userId: string;
  timestamp: string;
}

export type ViewState = 'dashboard' | 'inventory' | 'pos' | 'history' | 'financials' | 'insights' | 'invoices' | 'pending';

export type UserRole = 'admin' | 'cashier';

export interface DashboardMetrics {
  totalRevenue: number;
  totalProfit: number;
  lowStockCount: number;
  totalInventoryValue: number;
}
