import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem, SaleRecord, PendingSale, ExpenseRecord } from '../types';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend, 
  ComposedChart, 
  Line, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Wallet, 
  Calendar, 
  Filter, 
  Percent, 
  DollarSign, 
  Activity, 
  Tag, 
  Download, 
  Printer, 
  FileText, 
  Loader2, 
  Package, 
  Plus, 
  Trash2, 
  Sliders, 
  Calculator, 
  ShieldAlert, 
  AlertCircle,
  RefreshCcw,
  Landmark,
  ChevronRight,
  X,
  ExternalLink
} from 'lucide-react';
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

// Default realistic expenditures for initial display (May-June 2026 matches local current time context)
const DEFAULT_EXPENSES: ExpenseRecord[] = [
  { id: 'exp-1', description: 'Monthly Commercial Space Rent', amount: 1200.00, category: 'Rent', date: '2026-05-15', recordedAt: '2026-05-15T12:00:00Z' },
  { id: 'exp-2', description: 'Warehouse Power & Water Utilities', amount: 350.00, category: 'Utilities', date: '2026-05-18', recordedAt: '2026-05-18T14:30:00Z' },
  { id: 'exp-3', description: 'Sales Assistant Transport Subsidy', amount: 480.00, category: 'Salaries', date: '2026-05-24', recordedAt: '2026-05-24T09:00:00Z' },
  { id: 'exp-4', description: 'Custom Cardboard Shipping Cartons', amount: 250.00, category: 'Supplies', date: '2026-05-28', recordedAt: '2026-05-28T16:15:00Z' },
  { id: 'exp-5', description: 'Social Media Sponsored Campaign', amount: 300.00, category: 'Marketing', date: '2026-06-01', recordedAt: '2026-06-01T11:00:00Z' },
  { id: 'exp-6', description: 'Debit Card Terminal Processing Fee', amount: 145.00, category: 'Other', date: '2026-06-03', recordedAt: '2026-06-03T18:45:00Z' },
  { id: 'exp-7', description: 'Store Drinking Water Refill Standard Pack', amount: 85.00, category: 'Utilities', date: '2026-06-04', recordedAt: '2026-06-04T10:20:00Z' }
];

export const FinancialReport: React.FC<FinancialReportProps> = ({ inventory, sales, pendingSales, currencySymbol }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [activeTab, setActiveTab] = useState<'executive' | 'pnl' | 'expenses' | 'forecasting'>('executive');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // General Income & Expenses Taxes Rate
  const [taxRate, setTaxRate] = useState<number>(15);

  // 3-Month Simulating Parameters
  const [projectedGrowth, setProjectedGrowth] = useState<number>(15); // Month-over-month growth slider
  const [opexOptimization, setOpexOptimization] = useState<number>(0); // OpEx variance slider

  // Quick disbursement ledger inputs
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<string>('Utilities');
  const [newExpenseDate, setNewExpenseDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Local ledger persistence
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    const saved = localStorage.getItem('pos_financial_expenses');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading expenses:', e);
      }
    }
    localStorage.setItem('pos_financial_expenses', JSON.stringify(DEFAULT_EXPENSES));
    return DEFAULT_EXPENSES;
  });

  const allSalesCombined = useMemo(() => {
    return [...sales, ...pendingSales];
  }, [sales, pendingSales]);

  // Printing engine
  const handlePrint = () => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
      return;
    }

    const printElement = reportRef.current;
    if (!printElement) return;

    // Create a temporary container for printing to guarantee compatibility on laptop browsers/iframes
    const printContainer = document.createElement('div');
    printContainer.id = 'print-temp-container';
    printContainer.innerHTML = printElement.innerHTML;
    printContainer.className = printElement.className;

    // Inject styles specifically for printing
    const style = document.createElement('style');
    style.id = 'print-temp-styles';
    style.innerHTML = `
      @media print {
        body > *:not(#print-temp-container) {
          display: none !important;
        }
        #print-temp-container {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          background: white !important;
          color: black !important;
          padding: 24px !important;
          margin: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;

    document.body.appendChild(printContainer);
    document.head.appendChild(style);

    // Trigger standard browser print on the window context
    window.print();

    // Clean up DOM elements after the print dialog closes
    setTimeout(() => {
      const container = document.getElementById('print-temp-container');
      if (container) container.remove();
      const styleTag = document.getElementById('print-temp-styles');
      if (styleTag) styleTag.remove();
    }, 500);
  };

  // Export to PDF
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      reportRef.current.classList.add('pdf-exporting');
      
      const canvas = await html2canvas(reportRef.current, { 
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      reportRef.current.classList.remove('pdf-exporting');

      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Financial_Performance_Statement_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filter Sales & Expenses by chosen timeRange
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
    const fSales = allSalesCombined.filter(s => new Date(s.timestamp) >= startDate);
    const fExpenses = expenses.filter(e => new Date(e.date) >= startDate);
    
    return { filteredSales: fSales, filteredExpenses: fExpenses };
  }, [allSalesCombined, expenses, timeRange]);

  // Aggregate daily timeline aggregates for Recharts charts
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string; revenue: number; cogs: number; grossProfit: number; expenses: number; netIncome: number }>();
    const getDateKey = (dateStr: string) => dateStr.split('T')[0];

    // Sparse aggregation setup
    filteredSales.forEach(sale => {
      const key = getDateKey(sale.timestamp);
      if (!dataMap.has(key)) {
        dataMap.set(key, { date: key, revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netIncome: 0 });
      }
      const current = dataMap.get(key)!;
      current.revenue += sale.totalAmount;
      current.grossProfit += sale.totalProfit;
      const saleCogs = Math.max(0, sale.totalAmount - sale.totalProfit);
      current.cogs += saleCogs;
      current.netIncome += sale.totalProfit;
    });

    filteredExpenses.forEach(exp => {
      const key = getDateKey(exp.date);
      if (!dataMap.has(key)) {
        dataMap.set(key, { date: key, revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netIncome: 0 });
      }
      const current = dataMap.get(key)!;
      current.expenses += exp.amount;
      current.netIncome -= exp.amount;
    });

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, filteredExpenses]);

  // Advanced financial calculations
  const metrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalDiscount = filteredSales.reduce((acc, s) => acc + s.items.reduce((iAcc, i) => iAcc + (i.discount || 0), 0), 0);
    const totalGrossProfit = filteredSales.reduce((acc, s) => acc + s.totalProfit, 0);
    const totalCOGS = totalRevenue - totalGrossProfit; 
    
    // Operating Overhead sum
    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    
    // EBITDA & Net Operating income after factoring overhead cost
    const ebitda = totalGrossProfit - totalExpenses;
    const estTax = ebitda > 0 ? (ebitda * taxRate) / 100 : 0;
    const netIncome = ebitda - estTax;

    const grossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const operatingMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    // Remaining physical Asset value
    const inventoryValue = inventory.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);
    const inventorySalesValue = inventory.reduce((acc, i) => acc + (i.salesPrice * i.quantity), 0);

    // Dynamic Inventory Turnover & Days Sales Inventory (DSI)
    const averageInventoryVal = Math.max(100, (inventoryValue + (inventoryValue * 1.2)) / 2); // Simple representation
    const annualMultiplier = timeRange === '7d' ? 52 : timeRange === '30d' ? 12 : timeRange === '90d' ? 4 : 1;
    const annualizedCOGS = totalCOGS * annualMultiplier;
    const inventoryTurnover = annualizedCOGS / averageInventoryVal;
    const dsi = inventoryTurnover > 0 ? 365 / inventoryTurnover : 0;

    // Breakeven Point calculation (Breakeven Sales = Operating Expenses / Gross Profit Margin Ratio)
    const grossMarginRatio = grossMargin / 100;
    const breakevenRevenue = grossMarginRatio > 0 ? totalExpenses / grossMarginRatio : 0;

    const topItems: Record<string, { name: string; revenue: number; quantity: number }> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!topItems[item.itemId]) {
          topItems[item.itemId] = { name: item.name, revenue: 0, quantity: 0 };
        }
        topItems[item.itemId].revenue += (item.quantity * item.priceAtSale) - (item.discount || 0);
        topItems[item.itemId].quantity += item.quantity;
      });
    });

    const sortedProducts = Object.values(topItems)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue,
      totalDiscount,
      totalGrossProfit,
      totalCOGS,
      totalExpenses,
      ebitda,
      estTax,
      netIncome,
      grossMargin,
      operatingMargin,
      netMargin,
      inventoryValue,
      inventorySalesValue,
      inventoryTurnover,
      dsi,
      breakevenRevenue,
      topItems: sortedProducts
    };
  }, [filteredSales, filteredExpenses, inventory, taxRate, timeRange]);

  // Group expenses by category for formal P&L presentation
  const expensesByCategory = useMemo(() => {
    const summary: Record<string, number> = {
      Rent: 0,
      Salaries: 0,
      Utilities: 0,
      Marketing: 0,
      Logistics: 0,
      Supplies: 0,
      Other: 0
    };
    filteredExpenses.forEach(exp => {
      const cat = exp.category || 'Other';
      if (summary[cat] !== undefined) {
        summary[cat] += exp.amount;
      } else {
        summary.Other += exp.amount;
      }
    });
    return summary;
  }, [filteredExpenses]);

  // Expenses disbursement ledger action triggers
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseDesc.trim() || !newExpenseAmount || parseFloat(newExpenseAmount) <= 0) {
      alert('Please fill out a valid expense description and positive monetary value.');
      return;
    }

    const newExp: ExpenseRecord = {
      id: `exp-${Date.now()}`,
      description: newExpenseDesc.trim(),
      amount: parseFloat(newExpenseAmount),
      category: newExpenseCategory,
      date: newExpenseDate,
      recordedAt: new Date().toISOString()
    };

    const updated = [newExp, ...expenses];
    setExpenses(updated);
    localStorage.setItem('pos_financial_expenses', JSON.stringify(updated));

    // Reset fields
    setNewExpenseDesc('');
    setNewExpenseAmount('');
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Are you sure you want to log-out this operating disbursement?')) {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      localStorage.setItem('pos_financial_expenses', JSON.stringify(updated));
    }
  };

  // CFO month pro-rata logic to predict future run rates
  const proRataSpanMonths = useMemo(() => {
    switch(timeRange) {
      case '7d': return 7 / 30;
      case '30d': return 1;
      case '90d': return 3;
      case '1y': return 12;
      case 'all': {
        if (filteredSales.length === 0) return 1;
        const dates = filteredSales.map(s => new Date(s.timestamp).getTime());
        const maxD = Math.max(...dates);
        const minD = Math.min(...dates);
        const diffDays = Math.max(1, (maxD - minD) / (1000 * 60 * 60 * 24));
        return Math.max(0.5, diffDays / 30);
      }
    }
  }, [timeRange, filteredSales]);

  const baseMonthlySales = useMemo(() => metrics.totalRevenue / proRataSpanMonths, [metrics.totalRevenue, proRataSpanMonths]);
  const baseMonthlyCOGS = useMemo(() => metrics.totalCOGS / proRataSpanMonths, [metrics.totalCOGS, proRataSpanMonths]);
  const baseMonthlyOpEx = useMemo(() => metrics.totalExpenses / proRataSpanMonths, [metrics.totalExpenses, proRataSpanMonths]);

  // 3-Month simulation modeling (Compounded revenue growth)
  const simulationChartData = useMemo(() => {
    const data = [];
    const gr = projectedGrowth / 100;
    const ov = opexOptimization / 100;
    
    // Period base reference
    data.push({
      name: 'Current Baseline',
      Revenue: Math.round(baseMonthlySales),
      Overhead: Math.round(baseMonthlyCOGS + baseMonthlyOpEx),
      NetProfit: Math.round(baseMonthlySales - baseMonthlyCOGS - baseMonthlyOpEx)
    });

    for (let k = 1; k <= 3; k++) {
      const rev = baseMonthlySales * Math.pow(1 + gr, k);
      const cogs = rev * (baseMonthlyCOGS / (baseMonthlySales || 1));
      const opex = baseMonthlyOpEx * (1 + ov);
      const net = rev - cogs - opex;
      
      data.push({
        name: `Month +${k}`,
        Revenue: Math.round(rev),
        Overhead: Math.round(cogs + opex),
        NetProfit: Math.round(net)
      });
    }
    return data;
  }, [baseMonthlySales, baseMonthlyCOGS, baseMonthlyOpEx, projectedGrowth, opexOptimization]);

  // Automated Consultant CFO recommendations engine
  const cfoRecommendations = useMemo(() => {
    const list = [];
    const margin = metrics.grossMargin;
    const opMargin = metrics.operatingMargin;
    const ratioOpEx = metrics.totalGrossProfit > 0 ? (metrics.totalExpenses / metrics.totalGrossProfit) * 100 : 0;

    if (margin < 35 && margin > 0) {
      list.push({
        type: 'warning',
        title: 'Depressed Gross Product Margins',
        desc: `Your current product markup yields a low ${margin.toFixed(1)}% Gross Margin. As your Chief Accountant, I recommend raising listing prices on core categories of products, or renegotiating bulk purchase costs from vendors to reach your safety mark (>40%).`
      });
    } else if (margin >= 40) {
      list.push({
        type: 'success',
        title: 'Strong Retail Markups',
        desc: `Outstanding pricing power! Your Gross Margin is running high at ${margin.toFixed(1)}%, giving you plenty of room to cover overheads and run seasonal sales Terminal discounts.`
      });
    }

    if (ratioOpEx > 60) {
      list.push({
        type: 'danger',
        title: 'Heavy Overhead Consumption',
        desc: `Overhead expenditures consume a massive ${ratioOpEx.toFixed(1)}% of gross store profits. Your operating expenses are too heavy compared to sales volumes. Reduce discretionary marketing or logistics costs immediately to secure cash flow.`
      });
    }

    if (metrics.inventoryTurnover < 0.8 && metrics.inventoryTurnover > 0) {
      list.push({
        type: 'warning',
        title: 'Slow Asset Liquidation (Overstock Risk)',
        desc: `An inventory turnover rate of ${metrics.inventoryTurnover.toFixed(2)}x indicates slow sales rates. Capital is trapped in stock shelves (DSI of ${Math.round(metrics.dsi)} days). Standardize stock-clearance campaigns on slow inventory categories.`
      });
    } else if (metrics.inventoryTurnover >= 1.5) {
      list.push({
        type: 'success',
        title: 'Efficient Capital Circulation',
        desc: `Fantastic asset velocity! Your stock is turning over at ${metrics.inventoryTurnover.toFixed(2)}x, indicating rapid cash conversion cycles and low warehouse obsolescence risk.`
      });
    }

    if (metrics.ebitda < 0 && metrics.totalRevenue > 0) {
      list.push({
        type: 'danger',
        title: 'Operating Deficit (EBITDA Deficit)',
        desc: `The shop is currently running at a net loss of ${currencySymbol}${Math.abs(metrics.ebitda).toFixed(2)} after bills. You must cross a breakeven turnover threshold of ${currencySymbol}${metrics.breakevenRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} to stay sustainable.`
      });
    }

    // Default recommendation if list is clean
    if (list.length === 0) {
      list.push({
        type: 'success',
        title: 'Stable Financial Runway',
        desc: 'All corporate health ratios are in line with target markers. Cash flows, markup markdowns, and inventory circulation numbers present a robust operational outlook.'
      });
    }

    return list;
  }, [metrics, currencySymbol]);

  // Pivot charts layout datasets
  const profitAndLossChartData = [
    { name: 'Revenue', amount: metrics.totalRevenue, fill: '#3b82f6' },
    { name: 'COGS', amount: metrics.totalCOGS, fill: '#f59e0b' },
    { name: 'OpEx Overheads', amount: metrics.totalExpenses, fill: '#a855f7' },
    { name: 'Est. Net Income', amount: Math.max(0, metrics.netIncome), fill: metrics.netIncome >= 0 ? '#10b981' : '#ef4444' }
  ];

  const assetCompositionData = [
    { name: 'Wholesale Inventory Value', value: metrics.inventoryValue },
    { name: 'Net Profit Earnings', value: Math.max(0, metrics.netIncome) },
    { name: 'Potential Unearned Margin', value: Math.max(0, metrics.inventorySalesValue - metrics.inventoryValue) }
  ];

  const ASSET_COLORS = ['#6366f1', '#10b981', '#f59e0b'];

  const tabList = [
    { id: 'executive', name: 'Executive Overview', icon: Scale },
    { id: 'pnl', name: 'Profit & Loss Statement', icon: Landmark },
    { id: 'expenses', name: 'Overhead Expenses Ledger', icon: Wallet },
    { id: 'forecasting', name: 'CFO Strategy Simulator', icon: Sliders }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Top Controller Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
        <div>
           <div className="flex items-center gap-2">
             <div className="p-1.5 sm:p-2 bg-emerald-500/10 rounded-lg shrink-0">
               <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
             </div>
             <div>
               <h2 className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                 Executive Financial Center
               </h2>
               <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                 Detailed cash flow performance, overhead disbursements ledger, estimated taxes, and dynamic CFO forecast simulation.
               </p>
             </div>
           </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full xl:w-auto">
          {/* Time range switch */}
          <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
             {(['7d', '30d', '90d', '1y', 'all'] as const).map(range => (
               <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    timeRange === range 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-amber-200'
                  }`}
               >
                  {range === 'all' ? 'All Time' : range.toUpperCase()}
               </button>
             ))}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-3 sm:flex gap-1.5 sm:gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center px-2 sm:px-4 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center justify-center px-2 sm:px-4 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {isGeneratingPdf ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />}
              <span className="hidden sm:inline">PDF Statement</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              onClick={() => {
                const rows: (string | number)[][] = [
                  ['Corporate Financial Summary Report', ''],
                  ['Period Covered', timeRange === 'all' ? 'All historical records' : `Last ${timeRange}`],
                  ['Generation Time', new Date().toISOString()],
                  ['Currency Token', currencySymbol],
                  [],
                  ['Metric Key', 'Financial Value'],
                  ['Gross Revenue Receipts', metrics.totalRevenue.toFixed(2)],
                  ['Discounts Granted To Customers', metrics.totalDiscount.toFixed(2)],
                  ['Cost of Goods Sold (COGS)', metrics.totalCOGS.toFixed(2)],
                  ['Gross profit margin (%)', metrics.grossMargin.toFixed(2)],
                  ['Total Operating Overhead Expenses', metrics.totalExpenses.toFixed(2)],
                  ['EBITDA', metrics.ebitda.toFixed(2)],
                  ['Self-Assessed Tax Rate (%)', `${taxRate}%`],
                  ['Corporate Tax Estimate', metrics.estTax.toFixed(2)],
                  ['Net Profit Surplus', metrics.netIncome.toFixed(2)],
                  ['Operating Profit Margin (%)', metrics.operatingMargin.toFixed(2)],
                  [],
                  ['Current Inventory Asset Valuation (Cost-Price based)', metrics.inventoryValue.toFixed(2)],
                  ['Current Inventory Sticker Value (Sales-Price based)', metrics.inventorySalesValue.toFixed(2)],
                  [],
                  ['Operating Expenses Ledger Records', ''],
                  ['ID', 'Date', 'Category', 'Description', 'Amount']
                ];

                expenses.forEach(e => {
                  rows.push([e.id, e.date, e.category, e.description, e.amount.toFixed(2)]);
                });

                exportToCSV(`accounting_master_report_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`, rows);
              }}
              className="flex items-center justify-center px-2 sm:px-4 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span className="hidden sm:inline">CSV Excel</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* CFO Tab Navigation Row */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-3 sm:mb-6 bg-slate-50 dark:bg-slate-900/50 p-1 sm:p-1.5 rounded-xl gap-1 sm:gap-2 overflow-x-auto no-scrollbar print:hidden">
        {tabList.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Main Core View Area */}
      <div ref={reportRef} className="print:block bg-slate-50 dark:bg-slate-900 print:bg-white print:text-black space-y-6">
        
        {/* Formal PDF Report Header Brand */}
        <div className="hidden print:block text-center border-b border-slate-200 pb-6 mb-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Corporate Financial Report</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Operational Period Segment: {timeRange === 'all' ? 'All System History' : `Last ${timeRange.replace('d', ' Days').replace('1y', '1 Year')}`}
          </p>
          <div className="flex justify-center gap-8 mt-3 text-xs text-slate-400 font-mono">
            <span>Corporate Tax Baseline: {taxRate}%</span>
            <span>Recorded Expenses count: {expenses.length} lines</span>
            <span>Date Generated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* =======================================================
            TAB 1: EXECUTIVE BRIEFING & CORE ACCOUNTING RATIOS
            ======================================================= */}
        {activeTab === 'executive' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Visual KPI Board */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              
              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition hover:shadow-md border-l-4 border-l-blue-500">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 block mb-0.5 sm:mb-1">Gross Revenue</span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      {currencySymbol}{metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl shrink-0"><DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /></div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-700/50 pt-2 text-slate-400">
                  <span>Gross Margin</span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400">{metrics.grossMargin.toFixed(1)}%</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition hover:shadow-md border-l-4 border-l-purple-500">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 block mb-0.5 sm:mb-1">Operating Expenses (OpEx)</span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      {currencySymbol}{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl shrink-0"><Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" /></div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-700/50 pt-2 text-slate-400">
                  <span>Discounts Absorbed</span>
                  <span className="font-extrabold text-purple-600 dark:text-purple-400">{currencySymbol}{metrics.totalDiscount.toFixed(0)}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition hover:shadow-md border-l-4 border-l-emerald-500">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 block mb-0.5 sm:mb-1">Real Net profit (After Taxes)</span>
                    <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${metrics.netIncome >= 0 ? 'text-green-600 dark:text-emerald-400' : 'text-red-500 rgb:text-red-400'}`}>
                      {currencySymbol}{metrics.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl shrink-0">
                    {metrics.netIncome >= 0 ? (
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-700/50 pt-2 text-slate-400">
                  <span>Net Profit Margin</span>
                  <span className={`font-extrabold ${metrics.netMargin >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{metrics.netMargin.toFixed(1)}%</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition hover:shadow-md border-l-4 border-l-indigo-500">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 block mb-0.5 sm:mb-1">Liquid Inventory Assets</span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      {currencySymbol}{metrics.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="p-2 sm:p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl shrink-0"><Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" /></div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-700/50 pt-2 text-slate-400">
                  <span>Gross Stock Sticker Value</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{currencySymbol}{metrics.inventorySalesValue.toFixed(0)}</span>
                </div>
              </div>

            </div>

            {/* DuPont Health Ratios Block */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
              
              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Scale className="w-5 h-5 text-indigo-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Dupont margins assessment</h4>
                  </div>
                  <p className="text-xs text-slate-400 mb-6 font-medium">Evaluation of retail markup efficiency and conversion margins.</p>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-500">Gross Margin Markups</span>
                        <span className="text-slate-800 dark:text-slate-200">{metrics.grossMargin.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, metrics.grossMargin))}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-500">Operating Net Margin</span>
                        <span className="text-slate-800 dark:text-slate-200">{metrics.operatingMargin.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, metrics.operatingMargin))}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Operating Profit Health</div>
                  <span className={`text-xs inline-flex items-center px-2.5 py-1 rounded-full font-bold ${
                    metrics.operatingMargin > 25 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                      : metrics.operatingMargin > 15 
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                      : metrics.operatingMargin > 0
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  }`}>
                    {metrics.operatingMargin > 25 
                      ? '● Premium Operational Health' 
                      : metrics.operatingMargin > 15 
                      ? '● Healthy Standard Margin'
                      : metrics.operatingMargin > 0
                      ? '● Slim Margin Operation'
                      : '● Operating Under Deficit'}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Asset velocity & turnover</h4>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 mb-4 sm:mb-6 font-medium">Annualized pace of stock clearance relative to average capital lockups.</p>
                  
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Inventory Turnover</span>
                      <span className="text-lg sm:text-xl font-bold font-mono text-slate-800 dark:text-slate-200">
                        {metrics.inventoryTurnover > 0 ? `${metrics.inventoryTurnover.toFixed(2)}x` : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">DSI (Shelf Days)</span>
                      <span className="text-lg sm:text-xl font-bold font-mono text-slate-800 dark:text-slate-200">
                        {metrics.dsi > 0 ? `${Math.round(metrics.dsi)} Days` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 text-[11px] sm:text-xs text-slate-400 italic">
                  {metrics.inventoryTurnover >= 1.5 
                    ? '⚡ Capital circulates swiftly, mitigating risk of physical asset decay.' 
                    : '⏳ Capital circulation is sluggish; recommend liquidation discounts.'}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Revenues breakeven tracker</h4>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 mb-3 sm:mb-4 font-medium">Revenues required in order to make zero operating loss after factoring product costs and overhead.</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Breakeven Threshold:</span>
                      <span className="text-slate-800 dark:text-slate-200">{currencySymbol}{metrics.breakevenRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Current Billings:</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{currencySymbol}{metrics.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 sm:h-3 rounded-full overflow-hidden mt-2 relative">
                      <div className="bg-purple-500 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, (metrics.totalRevenue / (metrics.breakevenRevenue || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  {metrics.totalRevenue >= metrics.breakevenRevenue ? (
                    <span className="text-[10px] text-green-700 dark:text-emerald-400 bg-green-500/10 px-2 py-1 rounded font-black flex items-center gap-1">
                      🎉 BREAKEVEN SURPASS VALUE GENERATED
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded font-black flex items-center gap-1">
                      ⚠️ CURRENT INFLOWS SHORT OF BREAKEVEN GOAL
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Financial Performance Timeline & P&L Allocation Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
              
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Revenues & Cash Income trend</h4>
                    <span className="text-[10px] sm:text-xs text-slate-400">Daily gross revenue receipts versus real net operating surpluses.</span>
                  </div>
                </div>
                <div className="h-60 sm:h-80">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            return `${d.getDate()}/${d.getMonth()+1}`;
                          }}
                        />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', background: '#1e293b', color: '#fff' }}
                          formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '']}
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                        <Bar dataKey="revenue" name="Sales Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                        <Area type="monotone" dataKey="expenses" name="OpEx bills" fill="#f87171" fillOpacity={0.15} stroke="#ef4444" strokeWidth={1} />
                        <Line type="monotone" dataKey="netIncome" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={true} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <AlertCircle className="w-8 h-8 opacity-30 mb-2" />
                      <span className="text-xs">No ledger records generated for the selected scale.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1 sm:mb-2">Corporate ledger overview</h4>
                <span className="text-[10px] sm:text-xs text-slate-400 block mb-4 sm:mb-6">Aggregate breakdown of gross intake, product costs, and operating overheads.</span>
                
                <div className="h-52 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitAndLossChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" width={75} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Amount']}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', background: '#1e293b', color: '#fff' }}
                      />
                      <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={18}>
                        {profitAndLossChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Asset Distribution Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
              
              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Asset Distribution (Snapshot)</h4>
                    <span className="text-[10px] sm:text-xs text-slate-400">Total physical inventory investment vs current liquid period earnings.</span>
                  </div>
                </div>
                <div className="h-56 sm:h-64 flex flex-col sm:flex-row items-center justify-center">
                  <div className="flex-1 w-full h-full min-h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assetCompositionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {assetCompositionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${currencySymbol}${value.toLocaleString()}`} />
                        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingLeft: '5px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Top Selling Products Table */}
              <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Primary Product Revenue Drivers</h4>
                    <span className="text-[10px] sm:text-xs text-slate-400">Top 5 inventory stock categories by billing volume.</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="pb-3 text-left">Product Name</th>
                        <th className="pb-3 text-right">Qty Cleared</th>
                        <th className="pb-3 text-right">Inflow billing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-700/50">
                      {metrics.topItems.length > 0 ? (
                        metrics.topItems.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all">
                            <td className="py-3 font-semibold text-slate-700 dark:text-slate-250">{item.name}</td>
                            <td className="py-3 text-right font-mono text-slate-500 font-bold">x{item.quantity}</td>
                            <td className="py-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-450">
                              {currencySymbol}{item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-450">No retail transactions processed for this query scale.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* =======================================================
            TAB 2: FORMAL PROFIT & LOSS STATEMENT 
            ======================================================= */}
        {activeTab === 'pnl' && (
          <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 lg:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in max-w-4xl mx-auto overflow-hidden">
            
            {/* Tax Settings Controls Panel (Print hidden) */}
            <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 block">Baseline Tax Assessor</span>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">Configure corporate tax estimations instantly on the statement sheet.</p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto">
                <span className="text-xs font-extrabold text-slate-500">Tax Coefficient:</span>
                <input 
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-24 sm:w-32 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-black font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-indigo-100 dark:border-indigo-850">
                  {taxRate}%
                </span>
              </div>
            </div>

            {/* Structured General Ledger Sheet */}
            <div className="font-sans text-slate-850 dark:text-slate-100 overflow-x-auto">
              
              <div className="border-b-2 border-slate-800 dark:border-slate-300 pb-3 mb-4 sm:mb-6 text-center">
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-widest">Condensed Income Statement</h3>
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 font-mono">
                  Scale: {timeRange === 'all' ? 'Primary Inception' : `Last ${timeRange.replace('d', ' Days').replace('1y', 'Yearly Segment')}`} | Unaudited
                </span>
              </div>

              <table className="w-full text-[11px] sm:text-xs font-mono border-collapse min-w-[320px]">
                <tbody>
                  
                  {/* REVENUE LINES */}
                  <tr className="border-b border-slate-150 dark:border-slate-700/50">
                    <td className="py-2.5 font-black uppercase text-slate-500 text-[10px]">Operating Income Lines</td>
                    <td className="py-2.5 text-right"></td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Gross Sales Receipts</td>
                    <td className="py-2 text-right font-bold text-slate-800 dark:text-slate-100">
                      {currencySymbol}{(metrics.totalRevenue + metrics.totalDiscount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700">
                    <td className="py-2 pl-4 text-rose-500">Less: Markdown Discounts Allowed</td>
                    <td className="py-2 text-right font-bold text-rose-500">
                      ({currencySymbol}{metrics.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 font-bold border-b-2 border-slate-200 dark:border-slate-700">
                    <td className="py-2.5 pl-2 font-extrabold uppercase">Total Net Revenue</td>
                    <td className="py-2.5 text-right font-black font-mono text-slate-900 dark:text-white">
                      {currencySymbol}{metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* COGS LINES */}
                  <tr className="border-b border-slate-150 dark:border-slate-700/50">
                    <td className="py-2.5 pt-6 font-black uppercase text-slate-500 text-[10px]">Revenues Costs (COGS)</td>
                    <td className="py-2.5 text-right"></td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Procurement Product Cost Base</td>
                    <td className="py-2 text-right font-bold text-slate-800 dark:text-slate-100">
                      {currencySymbol}{metrics.totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr className="bg-slate-100 dark:bg-slate-900 font-bold border-b-2 border-slate-350 dark:border-slate-700 text-sm">
                    <td className="py-2.5 pl-2 font-extrabold uppercase">Gross Business Profit Margin</td>
                    <td className="py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {currencySymbol}{metrics.totalGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* OPERATING OVERHEAD (OPEX) */}
                  <tr className="border-b border-slate-150 dark:border-slate-700/50">
                    <td className="py-2.5 pt-6 font-black uppercase text-slate-500 text-[10px]">Operating Expenses (OpEx) Ledger Items</td>
                    <td className="py-2.5 text-right"></td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Space Leases & Rent</td>
                    <td className="py-2 text-right font-extrabold">{currencySymbol}{expensesByCategory.Rent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Staff Salaries & Commissions</td>
                    <td className="py-2 text-right font-extrabold">{currencySymbol}{expensesByCategory.Salaries.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Power, Water & Connectivity Utilities</td>
                    <td className="py-2 text-right font-extrabold">{currencySymbol}{expensesByCategory.Utilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Advertising & Marketing Sponsored Campaigns</td>
                    <td className="py-2 text-right font-extrabold">{currencySymbol}{expensesByCategory.Marketing.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Shipping & Store Logistics Disbursements</td>
                    <td className="py-2 text-right font-extrabold">{currencySymbol}{expensesByCategory.Logistics.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Store Materials & Supplies</td>
                    <td className="py-2 text-right font-extrabold">{currencySymbol}{expensesByCategory.Supplies.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700">
                    <td className="py-2 pl-4 text-slate-700 dark:text-slate-300">Miscellaneous & Gen. Other</td>
                    <td className="py-2 text-right font-extrabold">{currencySymbol}{expensesByCategory.Other.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-900 font-bold border-b-2 border-slate-200 dark:border-slate-700 text-xs">
                    <td className="py-2.5 pl-2 font-extrabold uppercase text-slate-500">Total Operating Expenses (OpEx)</td>
                    <td className="py-2.5 text-right font-black">
                      ({currencySymbol}{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </td>
                  </tr>

                  {/* EBITDA */}
                  <tr className="bg-slate-100 dark:bg-slate-900/80 font-bold border-b border-slate-300 dark:border-slate-700 text-sm">
                    <td className="py-3 pl-2 font-extrabold uppercase">Earnings Before Interest & Tax (EBITDA)</td>
                    <td className="py-3 text-right font-black text-slate-900 dark:text-white">
                      {currencySymbol}{metrics.ebitda.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* TAX ASSESSMENTS */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 border-b border-slate-200 dark:border-slate-700 text-xs">
                    <td className="py-2.5 pl-4 text-slate-500 italic">Estimated Income Tax Holdback ({taxRate}%)</td>
                    <td className="py-2.5 text-right font-bold text-red-500">
                      ({currencySymbol}{metrics.estTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </td>
                  </tr>

                  {/* NET NET INTAKE */}
                  <tr className="bg-slate-950 text-white font-bold border-b-4 double border-slate-900 text-sm">
                    <td className="py-3.5 pl-3 font-extrabold uppercase tracking-widest rounded-l-xl">Net Business Income Surplus</td>
                    <td className="py-3.5 pr-3 text-right font-black font-mono rounded-r-xl">
                      {currencySymbol}{metrics.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                </tbody>
              </table>

              <div className="mt-8 border-t border-dashed border-slate-200 dark:border-slate-700 pt-4 text-[10px] text-slate-400 font-medium italic text-center">
                This report represents a condensed management statement of operating accounts utilizing internal ledger records. It is intended for internal decision planning and strategy simulations and has not been certified by an independent audit partner.
              </div>

            </div>

          </div>
        )}

        {/* =======================================================
            TAB 3: COMPREHENSIVE OPERATING EXPENSES (OPEX) LEDGER
            ======================================================= */}
        {activeTab === 'expenses' && (
          <div className="space-y-6 animate-fade-in print:hidden">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Quick Disbursement Invoice Receipt Form */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                    <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Disburse Quick Payment</h4>
                    <p className="text-[10px] text-slate-400">Log immediate cash/bank store expenditures.</p>
                  </div>
                </div>

                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Receipt Category</label>
                    <select 
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value)}
                      className="block w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Rent">Rent & Overhead</option>
                      <option value="Salaries">Salaries & Transport</option>
                      <option value="Utilities">Utilities & Services</option>
                      <option value="Marketing">Marketing & Ads</option>
                      <option value="Logistics">Shipping & Delivery</option>
                      <option value="Supplies">Store Supplies</option>
                      <option value="Other">Miscellaneous General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Disbursement Date</label>
                    <input 
                      type="date"
                      value={newExpenseDate}
                      onChange={(e) => setNewExpenseDate(e.target.value)}
                      className="block w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Payee or Invoice Decription</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Electricity bill pay, staff helper cash"
                      value={newExpenseDesc}
                      onChange={(e) => setNewExpenseDesc(e.target.value)}
                      className="block w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Monetary Amount ({currencySymbol})</label>
                    <input 
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(e.target.value)}
                      className="block w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl transition duration-300 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Log Operating Disbursement
                  </button>
                </form>
              </div>

              {/* Categorization allocation ledger pie */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-250 mb-1">Operational Expenditures breakdown</h4>
                  <span className="text-xs text-slate-400 block mb-6">Distribution of logged operating expenses across defined corporate categories.</span>
                  
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(expensesByCategory).map(([k, v]) => ({ name: k, Amount: v }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value: number) => `${currencySymbol}${value.toFixed(2)}`} />
                        <Bar dataKey="Amount" fill="#818cf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Rent overhead</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{currencySymbol}{expensesByCategory.Rent.toFixed(0)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Salaries overhead</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{currencySymbol}{expensesByCategory.Salaries.toFixed(0)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Services billings</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{currencySymbol}{expensesByCategory.Utilities.toFixed(0)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">Logistics & other</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{currencySymbol}{(expensesByCategory.Logistics + expensesByCategory.Other + expensesByCategory.Marketing + expensesByCategory.Supplies).toFixed(0)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Itemized general expenses table */}
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-4">Itemized Operating disbursements ledger</h4>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs text-left border-collapse min-w-[480px]">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-wider sticky top-0 bg-white dark:bg-slate-800 z-10 pb-3">
                      <th className="pb-3 pl-2">Transaction Date</th>
                      <th className="pb-3">Ledger Category</th>
                      <th className="pb-3">Expenditure Description</th>
                      <th className="pb-3 text-right pr-4">Monetary Value</th>
                      <th className="pb-3 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-705/10 bg-white dark:bg-slate-800">
                    {expenses.length > 0 ? (
                      expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all">
                          <td className="py-3 pl-2 font-mono text-slate-500 dark:text-slate-400 font-bold">{new Date(exp.date).toLocaleDateString()}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              exp.category === 'Rent' 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' 
                                : exp.category === 'Salaries' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                : exp.category === 'Utilities' 
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-450' 
                                : exp.category === 'Marketing' 
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-350'
                            }`}>
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3 font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[250px]">{exp.description}</td>
                          <td className="py-3 text-right font-bold pr-4 font-mono text-rose-500">
                            {currencySymbol}{exp.amount.toFixed(2)}
                          </td>
                          <td className="py-3 text-right pr-2">
                            <button 
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                              title="Delete core expense record"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-450">No operating overhead ledger entries logged yet. Ensure you record expenses above!</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =======================================================
            TAB 4: CFO SCENARIO STRATEGY SIMULATOR & FORECASTS
            ======================================================= */}
        {activeTab === 'forecasting' && (
          <div className="space-y-6 animate-fade-in print:hidden">
            
            {/* Simulation controls panel */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Sliders className="w-5 h-5 text-indigo-500" />
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Scenario Forecasting Dashboard</h4>
                  <span className="text-xs text-slate-400">Tweak operational multipliers to test-drive compound business expansions and optimized run rates over the next 90 days.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 block">Expected monthly growth volume</span>
                      <p className="text-[10px] text-slate-400">Compound monthly growth in transactions volume.</p>
                    </div>
                    <span className="text-sm font-extrabold font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-md border border-indigo-150">
                      {projectedGrowth}% MoM
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="-20"
                    max="100"
                    step="5"
                    value={projectedGrowth}
                    onChange={(e) => setProjectedGrowth(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>-20% (Recession)</span>
                    <span>0% (Steady)</span>
                    <span>+100% (Rapid Scale)</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 block">Fixed Overhead Optimization</span>
                      <p className="text-[10px] text-slate-400">Increase or decrease corporate operating disbursements.</p>
                    </div>
                    <span className="text-sm font-extrabold font-mono text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-md border border-purple-150">
                      {opexOptimization >= 0 ? `+${opexOptimization}` : opexOptimization}%
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="-50"
                    max="50"
                    step="5"
                    value={opexOptimization}
                    onChange={(e) => setOpexOptimization(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>-50% Cost-Cutting</span>
                    <span>0% Neutral</span>
                    <span>+50% aggressive Expansion</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Simulation trends bars */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-250 mb-1">Simulated Profit Outcomes over the next 3 Months</h4>
                <span className="text-xs text-slate-400 block mb-6">Financial forecast projection based on growth rate: {projectedGrowth}% MoM and expense changes: {opexOptimization}%.</span>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={simulationChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{ fontWeight: 'bold' }} />
                      <YAxis fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '']} />
                      <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                      <Bar dataKey="Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Overhead" fill="#9333ea" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="NetProfit" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CFO Boardroom Analysis & Tactical Action Items */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-5 h-5 text-indigo-500 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Boardroom Tactical Directives</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-6">Dynamic, automated Chief Accountant advisory counsel built directly on your store performance margins.</p>
                  
                  <div className="space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                    {cfoRecommendations.map((rec, i) => (
                      <div key={i} className={`p-4 rounded-xl border text-xs space-y-1 ${
                        rec.type === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-slate-800 dark:text-emerald-200' 
                          : rec.type === 'warning' 
                          ? 'bg-amber-500/10 border-amber-500/20 text-slate-800 dark:text-amber-200' 
                          : 'bg-rose-500/10 border-rose-500/20 text-slate-800 dark:text-rose-200'
                      }`}>
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                          {rec.type === 'success' ? '✔ HEALTHY INDEX' : rec.type === 'warning' ? '⚠ MARGIN WARNING' : '🚨 CRITICAL RUNWAY ALERT'}
                        </div>
                        <h5 className="font-extrabold text-[11px]">{rec.title}</h5>
                        <p className="opacity-80 text-[10px] leading-relaxed">{rec.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-mono italic pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/50">
                  Forecast modeling scales on linear-projections and does not replace professional CPA guidance.
                </div>
              </div>

            </div>

          </div>
        )}

      </div> {/* End of Printable Container */}

      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 relative">
            <button 
              onClick={() => setShowPrintModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
                <Printer className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Print Report</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Since you are viewing this app inside the developer preview iframe, direct print connections may be restricted by your browser.
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={async () => {
                  setShowPrintModal(false);
                  await handleDownloadPdf();
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Save & Print PDF (Compressed)</span>
              </button>
              
              <button
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  setShowPrintModal(false);
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium rounded-xl transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in New Tab to Print</span>
              </button>
              
              <button
                onClick={() => {
                  setShowPrintModal(false);
                  setTimeout(() => {
                    const printElement = reportRef.current;
                    if (!printElement) return;
                    const printContainer = document.createElement('div');
                    printContainer.id = 'print-temp-container';
                    printContainer.innerHTML = printElement.innerHTML;
                    printContainer.className = printElement.className;
                    const style = document.createElement('style');
                    style.id = 'print-temp-styles';
                    style.innerHTML = `
                      @media print {
                        body > *:not(#print-temp-container) {
                          display: none !important;
                        }
                        #print-temp-container {
                          display: block !important;
                          position: absolute !important;
                          left: 0 !important;
                          top: 0 !important;
                          width: 100% !important;
                          background: white !important;
                          color: black !important;
                          padding: 24px !important;
                          margin: 0 !important;
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                        }
                      }
                    `;
                    document.body.appendChild(printContainer);
                    document.head.appendChild(style);
                    window.print();
                    setTimeout(() => {
                      const container = document.getElementById('print-temp-container');
                      if (container) container.remove();
                      const styleTag = document.getElementById('print-temp-styles');
                      if (styleTag) styleTag.remove();
                    }, 500);
                  }, 100);
                }}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors text-center"
              >
                Try direct browser print anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
