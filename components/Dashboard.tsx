
import React, { useMemo } from 'react';
import { InventoryItem, SaleRecord, UserRole, AuditLog, PendingSale } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Package, TrendingUp, AlertTriangle, ShieldAlert, Clock } from 'lucide-react';

interface DashboardProps {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  pendingSales: PendingSale[];
  auditLogs: AuditLog[];
  currencySymbol: string;
  userRole: UserRole;
}

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

export const Dashboard: React.FC<DashboardProps> = ({ inventory, sales, pendingSales, auditLogs, currencySymbol, userRole }) => {
  
  const allSales = useMemo(() => {
    return [...sales, ...pendingSales];
  }, [sales, pendingSales]);

  const metrics = useMemo(() => {
    const totalRevenue = allSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalProfit = allSales.reduce((acc, sale) => acc + sale.totalProfit, 0);
    const lowStockCount = inventory.filter(i => i.quantity <= i.lowStockThreshold).length;
    const totalInventoryValue = inventory.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);
    const potentialSalesValue = inventory.reduce((acc, i) => acc + (i.salesPrice * i.quantity), 0);

    const totalPendingAmount = pendingSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const pendingCount = pendingSales.length;

    // Calculate discrepancies from audit logs
    const unrecordedSalesLogs = auditLogs.filter(log => 
      log.action === 'adjustment' && 
      log.details.includes('[Reason: Unrecorded Sale]')
    );

    const totalDiscrepancyCount = unrecordedSalesLogs.length;

    return { 
      totalRevenue, 
      totalProfit, 
      lowStockCount, 
      totalInventoryValue, 
      potentialSalesValue, 
      totalDiscrepancyCount,
      totalPendingAmount,
      pendingCount
    };
  }, [inventory, allSales, auditLogs, pendingSales]);

  // Prepare chart data (Last 7 days sales)
  const chartData = useMemo(() => {
    const last7Days = new Array(7).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const daySales = allSales.filter(s => s.timestamp.startsWith(date));
      return {
        date: date.substring(5), // MM-DD for Axis label
        fullDate: date, // Full YYYY-MM-DD for tooltip
        sales: daySales.reduce((acc, s) => acc + s.totalAmount, 0),
        profit: daySales.reduce((acc, s) => acc + s.totalProfit, 0)
      };
    });
  }, [allSales]);

  // Prepare top 5 selling items data
  const topItemsData = useMemo(() => {
    const itemSales: Record<string, { name: string, volume: number, revenue: number }> = {};
    
    allSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!itemSales[item.itemId]) {
          itemSales[item.itemId] = { name: item.name, volume: 0, revenue: 0 };
        }
        itemSales[item.itemId].volume += item.quantity;
        itemSales[item.itemId].revenue += (item.quantity * item.priceAtSale) - (item.discount || 0);
      });
    });

    return Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [allSales]);

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const dateObj = new Date(data.fullDate);
      const formattedDate = dateObj.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700/50 min-w-[200px] z-50">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/50">
            {formattedDate}
          </p>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">Total Sales:</span>
              <span className="font-bold text-blue-600">
                {currencySymbol}{data.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {userRole === 'admin' && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">Net Profit:</span>
                <span className="font-bold text-green-600">
                  {currencySymbol}{data.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  );

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-800 p-5 sm:p-7 rounded-2xl shadow-xl border border-emerald-400/30 flex items-start justify-between relative overflow-hidden group hover:shadow-emerald-500/30 transition-all duration-500 transform hover:-translate-y-1">
          <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 rotate-12">
            <CediSign className="w-32 h-32" />
          </div>
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mt-16 blur-2xl" />
          
          <div className="relative z-10 text-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)] animate-pulse" />
              <p className="text-[11px] sm:text-xs font-bold text-emerald-100 tracking-[0.1em] uppercase">Total Revenue</p>
            </div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tighter drop-shadow-sm">
              {currencySymbol}{metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="mt-3 sm:mt-5 flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md self-start px-3 sm:px-4 py-1.5 rounded-xl border border-white/15 shadow-sm group-hover:bg-white/15 transition-colors">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20">
                  <TrendingUp className="w-3 h-3 text-emerald-300" />
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-50 leading-none">
                Lifetime Sales: <span className="text-white font-bold">100% Growth</span>
              </p>
            </div>
          </div>
          
          <div className="bg-white/15 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-white/25 shadow-lg group-hover:rotate-6 transition-transform duration-300 shrink-0">
            <CediSign className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
        </div>
        {userRole === 'admin' && (
          <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-5 sm:p-7 rounded-2xl shadow-xl border border-blue-400/30 flex items-start justify-between relative overflow-hidden group hover:shadow-blue-500/30 transition-all duration-500 transform hover:-translate-y-1">
            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 rotate-12">
              <TrendingUp size={140} />
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="relative z-10 text-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.8)] animate-pulse" />
                <p className="text-[11px] sm:text-xs font-bold text-blue-100 tracking-[0.1em] uppercase">Net Profit</p>
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tighter drop-shadow-sm">
                {currencySymbol}{metrics.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="mt-3 sm:mt-5 flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md self-start px-3 sm:px-4 py-1.5 rounded-xl border border-white/15 shadow-sm group-hover:bg-white/15 transition-colors">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20">
                    <TrendingUp className="w-3 h-3 text-blue-300" />
                </div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-blue-50 leading-none">
                  Efficiency: <span className="text-white font-bold">Optimized</span>
                </p>
              </div>
            </div>
            
            <div className="bg-white/15 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-white/25 shadow-lg group-hover:rotate-6 transition-transform duration-300 shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
          </div>
        )}
        {userRole === 'admin' && (
          <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-5 sm:p-7 rounded-2xl shadow-xl border border-indigo-400/30 flex items-start justify-between relative overflow-hidden group hover:shadow-indigo-500/30 transition-all duration-500 transform hover:-translate-y-1">
            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 rotate-12">
              <Package size={140} />
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.8)] animate-pulse" />
                <p className="text-[11px] sm:text-xs font-bold text-indigo-100 tracking-[0.1em] uppercase">Inventory Value</p>
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tighter drop-shadow-sm">
                {currencySymbol}{metrics.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="mt-3 sm:mt-5 flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md self-start px-3 sm:px-4 py-1.5 rounded-xl border border-white/15 shadow-sm group-hover:bg-white/15 transition-colors">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-indigo-50 leading-none">
                  Potential: <span className="text-white">{currencySymbol}{metrics.potentialSalesValue.toLocaleString()}</span>
                </p>
              </div>
            </div>
            
            <div className="bg-white/15 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-white/25 shadow-lg group-hover:rotate-6 transition-transform duration-300 shrink-0">
              <Package className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
          </div>
        )}
        <div className="bg-gradient-to-br from-rose-700 via-rose-600 to-red-800 p-5 sm:p-7 rounded-2xl shadow-xl border border-rose-400/30 flex items-start justify-between relative overflow-hidden group hover:shadow-rose-500/30 transition-all duration-500 transform hover:-translate-y-1">
          <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 rotate-12">
            <AlertTriangle size={140} />
          </div>
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mt-16 blur-2xl" />
          
          <div className="relative z-10 text-white w-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-300 shadow-[0_0_8px_rgba(252,165,165,0.8)] animate-pulse" />
              <p className="text-[11px] sm:text-xs font-bold text-rose-100 tracking-[0.1em] uppercase">Low Stock</p>
            </div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tighter drop-shadow-sm">
              {metrics.lowStockCount}
            </h3>
            <div className="mt-3 sm:mt-5 flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md self-start px-3 sm:px-4 py-1.5 rounded-xl border border-white/15 shadow-sm group-hover:bg-white/15 transition-colors">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20">
                  <AlertTriangle className="w-3 h-3 text-rose-300" />
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-rose-50 leading-none">
                Requires: <span className="text-white font-bold">Restock Action</span>
              </p>
            </div>

            {/* Quick View Details for Low Stock */}
            {metrics.lowStockCount > 0 && (
              <div className="mt-3 p-2.5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                {inventory
                  .filter(item => item.quantity <= item.lowStockThreshold)
                  .slice(0, 5)
                  .map(item => (
                    <div key={item.id} className="flex justify-between items-center text-[10px] text-rose-100/80 border-b border-white/5 pb-1 last:border-0 hover:text-white transition-colors">
                      <span className="truncate max-w-[100px]">{item.name}</span>
                      <span className="font-black bg-rose-500/20 px-1.5 py-0.5 rounded text-white">{item.quantity} left</span>
                    </div>
                  ))
                }
                {metrics.lowStockCount > 5 && (
                   <div className="text-[9px] text-rose-200/50 text-center italic pt-1">
                      + {metrics.lowStockCount - 5} more items
                   </div>
                )}
              </div>
            )}
          </div>
          
          <div className="bg-white/15 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-white/25 shadow-lg group-hover:rotate-6 transition-transform duration-300 shrink-0 ml-2">
            <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-700 via-sky-600 to-blue-800 p-5 sm:p-7 rounded-2xl shadow-xl border border-sky-400/30 flex items-start justify-between relative overflow-hidden group hover:shadow-sky-500/30 transition-all duration-500 transform hover:-translate-y-1">
          <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 rotate-12">
            <Clock size={140} />
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          
          <div className="relative z-10 text-white w-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.8)] animate-pulse" />
              <p className="text-[11px] sm:text-xs font-bold text-sky-100 tracking-[0.1em] uppercase">Pending Payments</p>
            </div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tighter drop-shadow-sm">
              {currencySymbol}{metrics.totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            
            {/* Quick View Details for Pending Payments */}
            {metrics.pendingCount > 0 && (
              <div className="mt-3 p-2.5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                {pendingSales
                  .slice(0, 5)
                  .map(sale => (
                    <div key={sale.id} className="flex justify-between items-center text-[10px] text-sky-100/80 border-b border-white/5 pb-1 last:border-0 hover:text-white transition-colors">
                      <span className="truncate max-w-[100px] font-medium">{sale.customerName || 'Unknown'}</span>
                      <span className="font-black bg-sky-500/20 px-1.5 py-0.5 rounded text-white">{currencySymbol}{sale.totalAmount.toFixed(2)}</span>
                    </div>
                  ))
                }
                {metrics.pendingCount > 5 && (
                   <div className="text-[9px] text-sky-200/50 text-center italic pt-1">
                      + {metrics.pendingCount - 5} more loans
                   </div>
                )}
              </div>
            )}

            <div className="mt-3 sm:mt-5 flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md self-start px-3 sm:px-4 py-1.5 rounded-xl border border-white/15 shadow-sm group-hover:bg-white/15 transition-colors">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/20">
                  <Clock className="w-3 h-3 text-sky-300" />
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-sky-50 leading-none">
                Count: <span className="text-white font-bold">{metrics.pendingCount} Active Loans</span>
              </p>
            </div>
          </div>
          
          <div className="bg-white/15 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-white/25 shadow-lg group-hover:rotate-6 transition-transform duration-300 shrink-0 ml-2">
            <Clock className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
        </div>
        {userRole === 'admin' && (
          <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 p-5 sm:p-7 rounded-2xl shadow-xl border border-orange-400/30 flex items-start justify-between relative overflow-hidden group hover:shadow-orange-500/30 transition-all duration-500 transform hover:-translate-y-1">
            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 rotate-12">
              <ShieldAlert size={140} />
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="relative z-10 text-white w-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-300 shadow-[0_0_8px_rgba(253,186,116,0.8)] animate-pulse" />
                <p className="text-[11px] sm:text-xs font-bold text-orange-100 tracking-[0.1em] uppercase">Audit Conflicts</p>
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tighter drop-shadow-sm">
                {metrics.totalDiscrepancyCount}
              </h3>

              {/* Quick View Details for Audit Conflicts */}
              {metrics.totalDiscrepancyCount > 0 && (
                <div className="mt-3 p-2.5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                  {auditLogs
                    .filter(log => log.action === 'adjustment' && log.details.includes('[Reason: Unrecorded Sale]'))
                    .slice(0, 5)
                    .map(log => (
                      <div key={log.id} className="flex justify-between items-start text-[10px] text-amber-100/80 border-b border-white/5 pb-1 last:border-0 hover:text-white transition-colors">
                        <span className="truncate max-w-[120px]">{log.details.split('[Reason:')[0].replace('Stock discrepancy identified for ', '').replace('Manual adjustment for ', '')}</span>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                          <span className="font-bold text-amber-300">Fix Applied</span>
                          <span className="opacity-50 text-[8px]">{new Date(log.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  }
                  {metrics.totalDiscrepancyCount > 5 && (
                     <div className="text-[9px] text-amber-200/50 text-center italic pt-1">
                        + {metrics.totalDiscrepancyCount - 5} more issues
                     </div>
                  )}
                </div>
              )}

              <div className="mt-3 sm:mt-5 flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md self-start px-3 sm:px-4 py-1.5 rounded-xl border border-white/15 shadow-sm group-hover:bg-white/15 transition-colors">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20">
                    <ShieldAlert className="w-3 h-3 text-orange-300" />
                </div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-orange-50 leading-none">
                  Status: <span className="text-white font-bold">Requires Verification</span>
                </p>
              </div>
            </div>
            
            <div className="bg-white/15 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-white/25 shadow-lg group-hover:rotate-6 transition-transform duration-300 shrink-0 ml-2">
              <ShieldAlert className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-white/80 to-slate-50/50 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-white/5 relative overflow-hidden group hover:shadow-indigo-500/10 transition-all duration-500">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Sales Overview <span className="text-xs font-medium text-slate-400 ml-2">(Last 7 Days)</span></h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    stroke="none"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0.05 ? `${name}` : ''}
                    fill="#8884d8"
                    dataKey="sales"
                    nameKey="date"
                    animationDuration={1500}
                    animationBegin={200}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        className="hover:opacity-80 transition-opacity cursor-pointer shadow-lg"
                        style={{ filter: `drop-shadow(0px 4px 12px ${COLORS[index % COLORS.length]}40)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={40} 
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 600, color: '#64748b' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white/80 to-slate-50/50 dark:from-slate-800/80 dark:to-slate-900/80 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-white/5 relative overflow-hidden group hover:shadow-emerald-500/10 transition-all duration-500">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Package className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Revenue Leaders <span className="text-xs font-medium text-slate-400 ml-2">(Top 5 Items)</span></h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topItemsData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    stroke="none"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0.05 ? `${name.length > 8 ? name.substring(0, 8) + '..' : name}` : ''}
                    fill="#8884d8"
                    dataKey="revenue"
                    nameKey="name"
                    animationDuration={1500}
                    animationBegin={400}
                  >
                    {topItemsData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[(index + 2) % COLORS.length]} 
                        className="hover:opacity-80 transition-opacity cursor-pointer shadow-lg"
                        style={{ filter: `drop-shadow(0px 4px 12px ${COLORS[(index + 2) % COLORS.length]}40)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={40} 
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 600, color: '#64748b' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
