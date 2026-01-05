
import React, { useState, useMemo } from 'react';
import { InventoryItem, SaleRecord, ExpenseRecord } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Scale, Wallet, Calendar, Filter, Percent, DollarSign, Activity, Tag } from 'lucide-react';

interface FinancialReportProps {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  currencySymbol: string;
}

export const FinancialReport: React.FC<FinancialReportProps> = ({ inventory, sales, expenses, currencySymbol }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');

  // 1. Filter Data based on Time Range
  const { filteredSales, filteredExpenses } = useMemo(() => {
    const now = new Date();
    const getStartDate = () => {
      const d = new Date();
      switch(timeRange) {
        case '7d': d.setDate(now.getDate() - 7); break;
        case '30d': d.setDate(now.getDate() - 30); break;
        case '90d': d.setDate(now.getDate() - 90); break;
        case '1y': d.setFullYear(now.getFullYear() - 1); break;
        case 'all': return new Date(0); // Epoch
      }
      d.setHours(0,0,0,0);
      return d;
    };
    
    const startDate = getStartDate();
    
    const fSales = sales.filter(s => new Date(s.timestamp) >= startDate);
    const fExpenses = expenses.filter(e => new Date(e.date) >= startDate);
    
    return { filteredSales: fSales, filteredExpenses: fExpenses };
  }, [sales, expenses, timeRange]);

  // 2. Aggregate Data for Timeline Charts
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string, revenue: number, expense: number, grossProfit: number, netIncome: number, discount: number }>();
    
    // Helper to format date key (YYYY-MM-DD)
    const getDateKey = (dateStr: string) => dateStr.split('T')[0];

    // Initialize map with all dates in range if needed, or just build sparsely
    // Sparse build is easier for now.

    // Process Sales
    filteredSales.forEach(sale => {
      const key = getDateKey(sale.timestamp);
      if (!dataMap.has(key)) dataMap.set(key, { date: key, revenue: 0, expense: 0, grossProfit: 0, netIncome: 0, discount: 0 });
      
      const current = dataMap.get(key)!;
      const saleDiscount = sale.items.reduce((sum, i) => sum + (i.discount || 0), 0);
      
      current.revenue += sale.totalAmount;
      current.grossProfit += sale.totalProfit;
      current.discount += saleDiscount;
      // Net Income calc starts with Gross Profit, subtracts expenses later
      current.netIncome += sale.totalProfit; 
    });

    // Process Expenses
    filteredExpenses.forEach(exp => {
      const key = getDateKey(exp.date);
      if (!dataMap.has(key)) dataMap.set(key, { date: key, revenue: 0, expense: 0, grossProfit: 0, netIncome: 0, discount: 0 });
      
      const current = dataMap.get(key)!;
      current.expense += exp.amount;
      current.netIncome -= exp.amount; // Subtract expenses from net income accumulator
    });

    // Convert to array and sort
    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, filteredExpenses]);

  // 3. Calculate Summary Metrics for the period
  const metrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalDiscount = filteredSales.reduce((acc, s) => acc + s.items.reduce((iAcc, i) => iAcc + (i.discount || 0), 0), 0);
    
    // COGS = Revenue - Gross Profit (in our app Sale.totalProfit is actually Gross Profit: Price - Cost)
    const totalGrossProfit = filteredSales.reduce((acc, s) => acc + s.totalProfit, 0);
    const totalCOGS = totalRevenue - totalGrossProfit; 
    
    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netIncome = totalGrossProfit - totalExpenses;

    const grossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

    // Static Asset Value (Current Inventory)
    const inventoryValue = inventory.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);

    return {
      totalRevenue,
      totalDiscount,
      totalGrossProfit,
      totalCOGS,
      totalExpenses,
      netIncome,
      grossMargin,
      netMargin,
      expenseRatio,
      inventoryValue
    };
  }, [filteredSales, filteredExpenses, inventory]);

  const pnlData = [
    { name: 'Revenue', amount: metrics.totalRevenue, fill: '#3b82f6' },
    { name: 'COGS', amount: metrics.totalCOGS, fill: '#f59e0b' },
    { name: 'Expenses', amount: metrics.totalExpenses, fill: '#ef4444' },
    { name: 'Net Profit', amount: metrics.netIncome, fill: metrics.netIncome >= 0 ? '#10b981' : '#dc2626' }
  ];

  const assetsData = [
    { name: 'Inventory Assets', value: metrics.inventoryValue },
    { name: 'Est. Cash (Period)', value: Math.max(0, metrics.netIncome) } // Simplified cash
  ];

  const ASSET_COLORS = ['#6366f1', '#10b981'];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
           <h2 className="text-xl font-bold text-slate-800 flex items-center">
             <Activity className="w-6 h-6 mr-2 text-primary" />
             Financial Performance
           </h2>
           <p className="text-sm text-slate-500">Analyze revenue, expenses, and profitability trends.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
           {(['7d', '30d', '90d', '1y', 'all'] as const).map(range => (
             <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  timeRange === range 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
             >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
             </button>
           ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-500">Total Revenue</p>
                <h3 className="text-2xl font-bold text-slate-800">{currencySymbol}{metrics.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg"><DollarSign className="w-5 h-5 text-blue-600" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Gross Margin: {metrics.grossMargin.toFixed(1)}%</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-sm font-medium text-slate-500">Net Income</p>
                <h3 className={`text-2xl font-bold ${metrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currencySymbol}{metrics.netIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}
                </h3>
             </div>
             <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
          </div>
           <p className="text-xs text-slate-400 mt-2">Net Margin: {metrics.netMargin.toFixed(1)}%</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-sm font-medium text-slate-500">Op. Expenses</p>
                <h3 className="text-2xl font-bold text-slate-800">{currencySymbol}{metrics.totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
             </div>
             <div className="p-2 bg-red-50 rounded-lg"><Wallet className="w-5 h-5 text-red-600" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Ratio to Rev: {metrics.expenseRatio.toFixed(1)}%</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-sm font-medium text-slate-500">Discounts Given</p>
                <h3 className="text-2xl font-bold text-slate-800">{currencySymbol}{metrics.totalDiscount.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
             </div>
             <div className="p-2 bg-purple-50 rounded-lg"><Tag className="w-5 h-5 text-purple-600" /></div>
          </div>
           <p className="text-xs text-slate-400 mt-2">Impact: -{((metrics.totalDiscount / (metrics.totalRevenue + metrics.totalDiscount)) * 100).toFixed(1)}% of Potential</p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue vs Expense vs Profit Trend */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h3 className="text-lg font-bold text-slate-800 mb-6">Financial Trends</h3>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                            dataKey="date" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(val) => {
                                const d = new Date(val);
                                return `${d.getDate()}/${d.getMonth()+1}`;
                            }}
                        />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '']}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                        <Line type="monotone" dataKey="netIncome" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Income Statement Breakdown */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h3 className="text-lg font-bold text-slate-800 mb-6">P&L Summary</h3>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pnlData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Amount']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                            {pnlData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Discount Trend */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <Tag className="w-5 h-5 mr-2 text-purple-500" />
                  Discount Usage
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" hide />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                             formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Discount']}
                             labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Area type="monotone" dataKey="discount" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                    </AreaChart>
                </ResponsiveContainer>
              </div>
          </div>

          {/* Balance Sheet Asset View */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                    <Scale className="w-5 h-5 mr-2 text-primary" />
                    Asset Distribution (Snapshot)
                </h3>
             </div>
             <div className="h-64 flex">
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={assetsData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                            >
                            {assetsData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                            ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${currencySymbol}${value.toLocaleString()}`} />
                            <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};
