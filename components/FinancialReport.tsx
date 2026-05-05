
import React, { useState, useMemo, useRef } from 'react';
import { InventoryItem, SaleRecord, PendingSale } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Scale, Wallet, Calendar, Filter, Percent, DollarSign, Activity, Tag, Download, Printer, FileText, Loader2, Package } from 'lucide-react';
import { exportToCSV } from '../utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useReactToPrint } from 'react-to-print';

interface FinancialReportProps {
  inventory: InventoryItem[];
  sales: SaleRecord[];
  pendingSales: PendingSale[];
  currencySymbol: string;
}

export const FinancialReport: React.FC<FinancialReportProps> = ({ inventory, sales, pendingSales, currencySymbol }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const allSalesCombined = useMemo(() => {
    return [...sales, ...pendingSales];
  }, [sales, pendingSales]);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Financial_Report_${timeRange}`,
  });

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      // Temporarily add a class to adjust layout for PDF if needed
      reportRef.current.classList.add('pdf-exporting');
      
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      reportRef.current.classList.remove('pdf-exporting');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If the content is taller than one page, it will scale down to fit width, 
      // which might make it long. For a simple report, this is usually acceptable.
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Financial_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 1. Filter Data based on Time Range
  const { filteredSales } = useMemo(() => {
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
    
    const fSales = allSalesCombined.filter(s => new Date(s.timestamp) >= startDate);
    
    return { filteredSales: fSales };
  }, [allSalesCombined, timeRange]);

  // 2. Aggregate Data for Timeline Charts
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string, revenue: number, grossProfit: number, netIncome: number, discount: number }>();
    
    // Helper to format date key (YYYY-MM-DD)
    const getDateKey = (dateStr: string) => dateStr.split('T')[0];

    // Initialize map with all dates in range if needed, or just build sparsely
    // Sparse build is easier for now.

    // Process Sales
    filteredSales.forEach(sale => {
      const key = getDateKey(sale.timestamp);
      if (!dataMap.has(key)) dataMap.set(key, { date: key, revenue: 0, grossProfit: 0, netIncome: 0, discount: 0 });
      
      const current = dataMap.get(key)!;
      const saleDiscount = sale.items.reduce((sum: number, i) => sum + (i.discount || 0), 0);
      
      current.revenue += sale.totalAmount;
      current.grossProfit += sale.totalProfit;
      current.discount += saleDiscount;
      current.netIncome += sale.totalProfit; 
    });

    // Convert to array and sort
    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales]);

  // 3. Calculate Summary Metrics for the period
  const metrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalDiscount = filteredSales.reduce((acc, s) => acc + s.items.reduce((iAcc: number, i) => iAcc + (i.discount || 0), 0), 0);
    
    // COGS = Revenue - Gross Profit (in our app Sale.totalProfit is actually Gross Profit: Price - Cost)
    const totalGrossProfit = filteredSales.reduce((acc, s) => acc + s.totalProfit, 0);
    const totalCOGS = totalRevenue - totalGrossProfit; 
    
    const netIncome = totalGrossProfit;

    const grossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    // Static Asset Value (Current Inventory)
    const inventoryValue = inventory.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);

    // Top Selling Items
    const itemSales: Record<string, { name: string, revenue: number, quantity: number }> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach((item: any) => {
        if (!itemSales[item.itemId]) {
          itemSales[item.itemId] = { name: item.name, revenue: 0, quantity: 0 };
        }
        itemSales[item.itemId].revenue += (item.quantity * item.priceAtSale) - (item.discount || 0);
        itemSales[item.itemId].quantity += item.quantity;
      });
    });

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue,
      totalDiscount,
      totalGrossProfit,
      totalCOGS,
      netIncome,
      grossMargin,
      netMargin,
      inventoryValue,
      topItems
    };
  }, [filteredSales, inventory]);

  const pnlData = [
    { name: 'Revenue', amount: metrics.totalRevenue, fill: '#3b82f6' },
    { name: 'COGS', amount: metrics.totalCOGS, fill: '#f59e0b' },
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
        <div>
           <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
             <Activity className="w-6 h-6 mr-2 text-primary" />
             Financial Performance
           </h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">Analyze revenue, expenses, and profitability trends.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-1.5 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-1.5 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              PDF
            </button>
            <button
              onClick={() => {
                const rows: (string | number)[][] = [
                  ['Metric', 'Amount'],
                  ['Total Revenue', metrics.totalRevenue.toFixed(2)],
                  ['Total Discounts', metrics.totalDiscount.toFixed(2)],
                  ['Gross Profit', metrics.totalGrossProfit.toFixed(2)],
                  ['Cost of Goods Sold (COGS)', metrics.totalCOGS.toFixed(2)],
                  ['Net Income', metrics.netIncome.toFixed(2)],
                  ['Gross Margin (%)', metrics.grossMargin.toFixed(2)],
                  ['Net Margin (%)', metrics.netMargin.toFixed(2)],
                  ['Inventory Value', metrics.inventoryValue.toFixed(2)]
                ];
                exportToCSV(`financial_report_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`, rows);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-1.5 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </button>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
             {(['7d', '30d', '90d', '1y', 'all'] as const).map(range => (
               <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                    timeRange === range 
                      ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'
                  }`}
               >
                  {range === 'all' ? 'All Time' : range.toUpperCase()}
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Printable Report Container */}
      <div ref={reportRef} className="print:block bg-slate-50 dark:bg-slate-900 print:bg-white print:text-black space-y-6">
        
        {/* Print Header (Only visible in print/pdf) */}
        <div className="hidden print:block text-center border-b pb-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Financial Report</h1>
          <p className="text-slate-500 mt-2">
            Period: {timeRange === 'all' ? 'All Time' : `Last ${timeRange.replace('d', ' Days').replace('1y', '1 Year')}`}
          </p>
          <p className="text-slate-500">Generated on: {new Date().toLocaleDateString()}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{currencySymbol}{metrics.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg"><DollarSign className="w-5 h-5 text-blue-600" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Gross Margin: {metrics.grossMargin.toFixed(1)}%</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Income</p>
                <h3 className={`text-2xl font-bold ${metrics.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currencySymbol}{metrics.netIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}
                </h3>
             </div>
             <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
          </div>
           <p className="text-xs text-slate-400 mt-2">Net Margin: {metrics.netMargin.toFixed(1)}%</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Discounts Given</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{currencySymbol}{metrics.totalDiscount.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
             </div>
             <div className="p-2 bg-purple-50 rounded-lg"><Tag className="w-5 h-5 text-purple-600" /></div>
          </div>
           <p className="text-xs text-slate-400 mt-2">Impact: -{((metrics.totalDiscount / (metrics.totalRevenue + metrics.totalDiscount)) * 100).toFixed(1)}% of Potential</p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue vs Expense vs Profit Trend */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
             <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">Financial Trends</h3>
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
                        <Line type="monotone" dataKey="netIncome" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Income Statement Breakdown */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
             <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">P&L Summary</h3>
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
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
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
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
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

      {/* Top Selling Products Table */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
            <Package className="w-5 h-5 mr-2 text-primary" />
            Top 5 Products by Revenue
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                <th className="pb-3 font-medium">Product Name</th>
                <th className="pb-3 font-medium text-right">Units Sold</th>
                <th className="pb-3 font-medium text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topItems.length > 0 ? (
                metrics.topItems.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                    <td className="py-3 text-slate-800 dark:text-slate-200 font-medium">{item.name}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-300">{item.quantity}</td>
                    <td className="py-3 text-right text-slate-800 dark:text-slate-200 font-bold">
                      {currencySymbol}{item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-500">No sales data for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      </div> {/* End of Printable Container */}
    </div>
  );
};
