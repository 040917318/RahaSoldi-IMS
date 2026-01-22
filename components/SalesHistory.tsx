
import React, { useState, useMemo } from 'react';
import { SaleRecord } from '../types';
import { Search, Eye, FileText, X, ArrowUpCircle, Calendar, ChevronRight, Filter, Download, ArrowUpDown } from 'lucide-react';

interface SalesHistoryProps {
  sales: SaleRecord[];
  currencySymbol: string;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, currencySymbol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Search term filter (check if any item name or Sale ID matches)
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        searchTerm === '' || 
        sale.items.some(item => item.name.toLowerCase().includes(term)) ||
        sale.id.toLowerCase().includes(term);

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
  }, [sales, searchTerm, startDate, endDate, sortBy]);

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
    const headers = ['Date', 'Transaction ID', 'Items', 'Total Amount', 'Total Profit'];
    const rows = filteredSales.map(s => [
        new Date(s.timestamp).toLocaleString(),
        s.id,
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
        <div className="lg:col-span-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
            {/* Top Row: Search & Sort */}
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
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
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary focus:border-primary appearance-none bg-white"
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
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button onClick={() => setQuickFilter('today')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors">Today</button>
                    <button onClick={() => setQuickFilter('yesterday')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors">Yesterday</button>
                    <button onClick={() => setQuickFilter('week')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors">Last 7 Days</button>
                    <button onClick={() => setQuickFilter('month')} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors">This Month</button>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                     <div className="flex items-center gap-2 flex-1">
                        <input
                            type="date"
                            className="block w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-primary focus:border-primary"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            className="block w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-primary focus:border-primary"
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

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
                <div className="text-xs text-slate-500 uppercase font-semibold">Revenue (Filtered)</div>
                <div className="text-xl font-bold text-slate-800">{currencySymbol}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs text-green-600 flex items-center mt-1">
                    <ArrowUpCircle className="w-3 h-3 mr-1" />
                    Profit: {currencySymbol}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </div>
            <button 
                onClick={handleExportCSV}
                disabled={filteredSales.length === 0}
                className="w-full mt-4 flex items-center justify-center px-3 py-2 border border-slate-300 shadow-sm text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
                <Download className="w-3 h-3 mr-2" />
                Export CSV
            </button>
        </div>
      </div>

      {/* Sales Table (Desktop) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Items Summary</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
                {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {formatDate(sale.timestamp)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800">
                            <div className="font-medium">{sale.items[0]?.name} {sale.items.length > 1 && `+ ${sale.items.length - 1} others`}</div>
                            <div className="text-xs text-slate-500">{sale.items.reduce((sum, i) => sum + i.quantity, 0)} items total</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                            {currencySymbol}{sale.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button 
                                onClick={() => setSelectedSale(sale)}
                                className="text-primary hover:text-blue-800 inline-flex items-center font-medium"
                            >
                                <Eye className="w-4 h-4 mr-1" /> View
                            </button>
                        </td>
                    </tr>
                ))}
                {filteredSales.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
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
            <div key={sale.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm" onClick={() => setSelectedSale(sale)}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(sale.timestamp)}
                    </span>
                    <span className="font-bold text-slate-800 text-lg">
                        {currencySymbol}{sale.totalAmount.toFixed(2)}
                    </span>
                </div>
                <div className="mb-3">
                    <div className="font-medium text-slate-800 text-sm">
                        {sale.items[0]?.name}
                    </div>
                    {sale.items.length > 1 && (
                        <div className="text-xs text-slate-500 mt-0.5">
                            + {sale.items.length - 1} other items
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                        {sale.items.reduce((sum, i) => sum + i.quantity, 0)} items
                    </span>
                    <button className="text-primary text-sm font-medium flex items-center">
                        Details <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                </div>
            </div>
        ))}
        {filteredSales.length === 0 && (
            <div className="text-center py-10 text-slate-500">
                No sales records found.
            </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-primary" />
                        Sale Details
                    </h3>
                    <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6 text-sm">
                        <div>
                            <span className="text-slate-500 block">Date</span>
                            <span className="font-medium text-slate-800">{formatDate(selectedSale.timestamp)}</span>
                        </div>
                        <div className="text-right">
                             <span className="text-slate-500 block">Transaction ID</span>
                             <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">{selectedSale.id.slice(-8)}</span>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">Item</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold text-slate-500">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold text-slate-500">Discount</th>
                                    <th className="px-4 py-2 text-right text-xs font-bold text-slate-500">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {selectedSale.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2 text-sm text-slate-800">{item.name}</td>
                                        <td className="px-4 py-2 text-sm text-slate-600 text-right">{item.quantity}</td>
                                        <td className="px-4 py-2 text-sm text-red-500 text-right">
                                            {item.discount ? `-${currencySymbol}${item.discount}` : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-slate-800 font-medium text-right">
                                            {currencySymbol}{((item.quantity * item.priceAtSale) - (item.discount || 0)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-sm">Total Amount</span>
                            <span className="text-xl font-bold text-slate-800">{currencySymbol}{selectedSale.totalAmount.toFixed(2)}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Net Profit</span>
                            <span className="text-green-600 font-medium">{currencySymbol}{selectedSale.totalProfit.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div className="bg-slate-50 px-6 py-4 flex justify-end">
                    <button 
                        onClick={() => setSelectedSale(null)}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm transition-colors"
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
