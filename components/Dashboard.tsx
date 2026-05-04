
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
  
  const metrics = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalProfit = sales.reduce((acc, sale) => acc + sale.totalProfit, 0);
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
  }, [inventory, sales, auditLogs, pendingSales]);

  // Prepare chart data (Last 7 days sales)
  const chartData = useMemo(() => {
    const last7Days = new Array(7).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const daySales = sales.filter(s => s.timestamp.startsWith(date));
      return {
        date: date.substring(5), // MM-DD for Axis label
        fullDate: date, // Full YYYY-MM-DD for tooltip
        sales: daySales.reduce((acc, s) => acc + s.totalAmount, 0),
        profit: daySales.reduce((acc, s) => acc + s.totalProfit, 0)
      };
    });
  }, [sales]);

  // Prepare top 5 selling items data
  const topItemsData = useMemo(() => {
    const itemSales: Record<string, { name: string, volume: number, revenue: number }> = {};
    
    sales.forEach(sale => {
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
  }, [sales]);

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
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`${currencySymbol}${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
          icon={CediSign} 
          color="bg-green-500" 
          subtext="Lifetime sales"
        />
        {userRole === 'admin' && (
          <StatCard 
            title="Total Profit" 
            value={`${currencySymbol}${metrics.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
            icon={TrendingUp} 
            color="bg-blue-500" 
            subtext="Net earnings"
          />
        )}
        {userRole === 'admin' && (
          <StatCard 
            title="Inventory Cost Value" 
            value={`${currencySymbol}${metrics.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
            icon={Package} 
            color="bg-indigo-500" 
            subtext={`Potential: ${currencySymbol}${metrics.potentialSalesValue.toLocaleString()}`}
          />
        )}
        <StatCard 
          title="Low Stock Alerts" 
          value={metrics.lowStockCount} 
          icon={AlertTriangle} 
          color="bg-red-600" 
          subtext="Items below threshold"
        />
        <StatCard 
          title="Outstanding Credit" 
          value={`${currencySymbol}${metrics.totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
          icon={Clock} 
          color="bg-blue-600" 
          subtext={`${metrics.pendingCount} pending payment`}
        />
        {userRole === 'admin' && (
          <StatCard 
            title="Unrecorded Sales" 
            value={metrics.totalDiscrepancyCount} 
            icon={ShieldAlert} 
            color="bg-orange-600" 
            subtext="Identified by audits"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Sales Overview (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  labelLine={true}
                  label={({ name, percent }) => percent > 0.03 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                  fill="#8884d8"
                  dataKey="sales"
                  nameKey="date"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={<CustomTooltip />}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Top 5 Selling Items (Revenue)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topItemsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  labelLine={true}
                  label={({ name, percent }) => percent > 0.03 ? `${name.length > 12 ? name.substring(0, 12) + '...' : name} (${(percent * 100).toFixed(0)}%)` : ''}
                  fill="#8884d8"
                  dataKey="revenue"
                  nameKey="name"
                >
                  {topItemsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
