
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
}

export interface SaleRecord {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  totalProfit: number;
  timestamp: string;
}

export type ViewState = 'dashboard' | 'inventory' | 'pos' | 'insights' | 'history';

export interface DashboardMetrics {
  totalRevenue: number;
  totalProfit: number;
  lowStockCount: number;
  totalInventoryValue: number;
}
