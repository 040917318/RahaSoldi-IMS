import React, { useMemo } from 'react';
import { InventoryItem, SaleRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, Package, TrendingUp, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  currencySymbol: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ inventory, sales, currencySymbol }) => {
  
  const metrics = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalProfit = sales.reduce((acc, sale) => acc + sale.totalProfit, 0);
    const lowStockCount = inventory.filter(i => i.quantity <= i.lowStockThreshold).length;
    const totalInventoryValue = inventory.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);
    const potentialSalesValue = inventory.reduce((acc, i) => acc + (i.salesPrice * i.quantity), 0);

    return { totalRevenue, totalProfit, lowStockCount, totalInventoryValue, potentialSalesValue };
  }, [inventory, sales]);

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
        <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 min-w-[200px] z-50">
          <p className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">
            {formattedDate}
          </p>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Total Sales:</span>
              <span className="font-bold text-blue-600">
                {currencySymbol}{data.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Net Profit:</span>
              <span className="font-bold text-green-600">
                {currencySymbol}{data.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`${currencySymbol}${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
          icon={DollarSign} 
          color="bg-green-500" 
          subtext="Lifetime sales"
        />
        <StatCard 
          title="Total Profit" 
          value={`${currencySymbol}${metrics.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
          icon={TrendingUp} 
          color="bg-blue-500" 
          subtext="Net earnings"
        />
        <StatCard 
          title="Inventory Cost Value" 
          value={`${currencySymbol}${metrics.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
          icon={Package} 
          color="bg-indigo-500" 
          subtext={`Potential: ${currencySymbol}${metrics.potentialSalesValue.toLocaleString()}`}
        />
        <StatCard 
          title="Low Stock Alerts" 
          value={metrics.lowStockCount} 
          icon={AlertTriangle} 
          color="bg-red-600" 
          subtext="Items below threshold"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Sales Overview (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Profit Trend</h3>
           <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};