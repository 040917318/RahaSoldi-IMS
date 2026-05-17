
import React, { useState, useMemo } from 'react';
import { SaleRecord, PendingSale } from '../types';
import { Search, Eye, FileText, X, ArrowUpCircle, Calendar, ChevronRight, Filter, Download, ArrowUpDown, Printer, Clock } from 'lucide-react';

interface SalesHistoryProps {
  sales: SaleRecord[];
  pendingSales: PendingSale[];
  currencySymbol: string;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, pendingSales, currencySymbol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  const combinedSales = useMemo(() => {
    const mappedPending = pendingSales.map(ps => ({
      ...ps,
      status: 'pending' as const,
      isPending: true
    }));
    
    const mappedCompleted = sales.map(s => ({
      ...s,
      status: 'completed' as const,
      isPending: false
    }));

    return [...mappedCompleted, ...mappedPending];
  }, [sales, pendingSales]);

  const filteredSales = useMemo(() => {
    return combinedSales.filter(sale => {
      // Search term filter (check if any item name or Sale ID matches)
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        searchTerm === '' || 
        sale.items.some(item => item.name.toLowerCase().includes(term)) ||
        sale.id.toLowerCase().includes(term) ||
        (('customerName' in sale) && (sale as any).customerName?.toLowerCase().includes(term));

      // Date range filter
      let matchesDate = true;
      if (startDate) {
        // Reset time to start of day for accurate comparison
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && new Date(sale.timestamp) >= start;
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(sale.timestamp) <= end;
      }

      return matchesSearch && matchesDate;
    }).sort((a, b) => {
        switch(sortBy) {
            case 'date-asc': return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            case 'amount-desc': return b.totalAmount - a.totalAmount;
            case 'amount-asc': return a.totalAmount - b.totalAmount;
            case 'date-desc': 
            default:
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }
    });
  }, [combinedSales, searchTerm, startDate, endDate, sortBy]);

  const totalRevenue = filteredSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
  const totalProfit = filteredSales.reduce((acc, sale) => acc + sale.totalProfit, 0);

  // Helper to format date
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const setQuickFilter = (type: 'today' | 'yesterday' | 'week' | 'month') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    let start = new Date();

    switch(type) {
        case 'today':
            setStartDate(todayStr);
            setEndDate(todayStr);
            break;
        case 'yesterday':
            start.setDate(now.getDate() - 1);
            const yestStr = start.toISOString().split('T')[0];
            setStartDate(yestStr);
            setEndDate(yestStr);
            break;
        case 'week': // Last 7 days
            start.setDate(now.getDate() - 7);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(todayStr);
            break;
        case 'month': // This month
            start.setDate(1); // 1st of month
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(todayStr);
            break;
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Recorded By', 'Items', 'Total Amount', 'Total Profit'];
    const rows = filteredSales.map(s => [
        new Date(s.timestamp).toLocaleString(),
        s.id,
        s.recordedBy || 'N/A',
        `"${s.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}"`,
        s.totalAmount.toFixed(2),
        s.totalProfit.toFixed(2)
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters & Stats Header */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
            {/* Top Row: Search & Sort */}
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        placeholder="Search item name or Transaction ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="w-full md:w-48 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ArrowUpDown className="h-4 w-4 text-slate-400" />
                    </div>
                    <select
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-primary focus:border-primary appearance-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="amount-desc">Highest Amount</option>
                        <option value="amount-asc">Lowest Amount</option>
                    </select>
                </div>
            </div>

            {/* Bottom Row: Date Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-4">
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button onClick={() => setQuickFilter('today')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-full transition-colors">Today</button>
                    <button onClick={() => setQuickFilter('yesterday')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-full transition-colors">Yesterday</button>
                    <button onClick={() => setQuickFilter('week')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-full transition-colors">Last 7 Days</button>
                    <button onClick={() => setQuickFilter('month')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-full transition-colors">This Month</button>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                     <div className="flex items-center gap-2 flex-1">
                        <input
                            type="date"
                            className="block w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-xs focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            className="block w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-xs focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                     </div>
                     {(searchTerm || startDate || endDate) && (
                        <button 
                            onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Clear Filters"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Revenue (Filtered)</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{currencySymbol}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs text-green-600 flex items-center mt-1">
                    <ArrowUpCircle className="w-3 h-3 mr-1" />
                    Profit: {currencySymbol}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </div>
            <button 
                onClick={handleExportCSV}
                disabled={filteredSales.length === 0}
                className="w-full mt-4 flex items-center justify-center px-3 py-2 border border-slate-300 dark:border-slate-600 shadow-sm text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 disabled:opacity-50 transition-colors"
            >
                <Download className="w-3 h-3 mr-2" />
                Export CSV
            </button>
        </div>
      </div>

      {/* Sales Table (Desktop) */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recorded By</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Items Summary</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                            {formatDate(sale.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                                {sale.recordedBy || 'N/A'}
                            </div>
                            {sale.isPending && (sale as any).customerName && (
                                <div className="text-[10px] font-bold text-blue-500 uppercase mt-0.5">
                                    Customer: {(sale as any).customerName}
                                </div>
                            )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="font-medium">{sale.items[0]?.name} {sale.items.length > 1 && `+ ${sale.items.length - 1} others`}</div>
                                {sale.isPending && (
                                    <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold uppercase">
                                        <Clock className="w-3 h-3 mr-1" /> Pending
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{sale.items.reduce((sum: number, i: any) => sum + i.quantity, 0)} items total</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100">
                            {currencySymbol}{sale.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button 
                                onClick={() => setSelectedSale(sale)}
                                className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center ml-auto shadow-sm hover:shadow-indigo-500/20 active:scale-95 border border-indigo-200 dark:border-indigo-500/20"
                            >
                                <Eye className="w-4 h-4 mr-2" /> View Details
                            </button>
                        </td>
                    </tr>
                ))}
                {filteredSales.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                            No sales records found matching your filters.
                        </td>
                    </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-4">
        {filteredSales.map((sale) => (
            <div key={sale.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border ${sale.isPending ? 'border-blue-200 dark:border-blue-800/50' : 'border-slate-200 dark:border-slate-700'} shadow-sm relative overflow-hidden`} onClick={() => setSelectedSale(sale)}>
                {sale.isPending && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg uppercase">
                        Pending
                    </div>
                )}
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(sale.timestamp)}
                        <span className="ml-2 italic opacity-75">({sale.recordedBy || 'N/A'})</span>
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                        {currencySymbol}{sale.totalAmount.toFixed(2)}
                    </span>
                </div>
                <div className="mb-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                        {sale.items[0]?.name}
                    </div>
                    {sale.items.length > 1 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            + {sale.items.length - 1} other items
                        </div>
                    )}
                    {sale.isPending && (sale as any).customerName && (
                        <div className="text-xs font-bold text-blue-500 mt-1">
                            Customer: {(sale as any).customerName}
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs text-slate-400">
                        {sale.items.reduce((sum, i) => sum + i.quantity, 0)} items
                    </span>
                    <div className="flex items-center space-x-4">
                        <button className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center border border-indigo-100 dark:border-indigo-500/20">
                            Details <ChevronRight className="w-3 h-3 ml-1" />
                        </button>
                    </div>
                </div>
            </div>
        ))}
        {filteredSales.length === 0 && (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                No sales records found.
            </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-start justify-center p-4 backdrop-blur-sm sm:pt-10 md:pt-20">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in relative mt-4 md:mt-0">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-primary" />
                        {selectedSale.isPending ? 'Pending Sale Details' : 'Sale Details'}
                    </h3>
                    <div className="flex items-center gap-2">
                        {selectedSale.isPending && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-bold uppercase">
                                Pending
                            </span>
                        )}
                        <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                <div className="p-6">
                    {/* First View Summary Section */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                           <span className="text-[10px] uppercase font-black tracking-widest opacity-80 block mb-1">Total Amount</span>
                           <span className="text-2xl font-black tracking-tighter drop-shadow-md">{currencySymbol}{selectedSale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-xl text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                           <span className="text-[10px] uppercase font-black tracking-widest opacity-80 block mb-1">Net Profit</span>
                           <span className="text-2xl font-black tracking-tighter drop-shadow-md">{currencySymbol}{selectedSale.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {selectedSale.isPending && (selectedSale as any).customerName && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg">
                            <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Customer</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{(selectedSale as any).customerName}</div>
                            {(selectedSale as any).notes && (
                                <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-800/50 italic text-xs text-slate-500 dark:text-slate-400">
                                    <span className="font-bold non-italic mr-1">Notes:</span> {(selectedSale as any).notes}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-6 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        <div>
                            <span className="text-slate-500 dark:text-slate-400 block pb-0.5">Date & Time</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{formatDate(selectedSale.timestamp)}</span>
                        </div>
                        <div className="text-right">
                             <span className="text-slate-500 dark:text-slate-400 block pb-0.5">Transaction ID</span>
                             <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-2 py-1 rounded">{selectedSale.id}</span>
                        </div>
                    </div>

                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Itemized List</div>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                {selectedSale.items.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                            {item.name}
                                            {item.discount > 0 && <span className="block text-[10px] text-rose-500">Disc: -{currencySymbol}{item.discount}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-right">{currencySymbol}{item.priceAtSale.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 text-right font-bold">x{item.quantity}</td>
                                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100 font-bold text-right">
                                            {currencySymbol}{((item.quantity * item.priceAtSale) - (item.discount || 0)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center text-xs mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1.5 opacity-50" />
                            Processed By
                        </span>
                        <span className="text-slate-800 dark:text-slate-100 font-bold bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">{selectedSale.recordedBy || 'Unknown'}</span>
                    </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex justify-end">
                    <button 
                        onClick={() => setSelectedSale(null)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 text-sm font-medium shadow-sm transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
