
import React, { useState, useMemo } from 'react';
import { SaleRecord } from '../types';
import { Search, Eye, FileText, X, ArrowUpCircle } from 'lucide-react';

interface SalesHistoryProps {
  sales: SaleRecord[];
  currencySymbol: string;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, currencySymbol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Search term filter (check if any item name matches)
      const matchesSearch = searchTerm === '' || sale.items.some(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

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
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first
  }, [sales, searchTerm, startDate, endDate]);

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters & Stats Header */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end md:items-center">
            <div className="w-full md:w-1/3 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
                    placeholder="Search item name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Start Date</label>
                    <input
                        type="date"
                        className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="relative flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">End Date</label>
                    <input
                        type="date"
                        className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </div>

            {(searchTerm || startDate || endDate) && (
                <button 
                    onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                    className="text-sm text-red-500 hover:text-red-700 font-medium whitespace-nowrap mb-1"
                >
                    Clear Filters
                </button>
            )}
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
            <div className="text-xs text-slate-500 uppercase font-semibold">Revenue (Filtered)</div>
            <div className="text-xl font-bold text-slate-800">{currencySymbol}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
             <div className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpCircle className="w-3 h-3 mr-1" />
                Profit: {currencySymbol}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                                    <th className="px-4 py-2 text-right text-xs font-bold text-slate-500">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {selectedSale.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2 text-sm text-slate-800">{item.name}</td>
                                        <td className="px-4 py-2 text-sm text-slate-600 text-right">{item.quantity}</td>
                                        <td className="px-4 py-2 text-sm text-slate-800 font-medium text-right">
                                            {currencySymbol}{(item.quantity * item.priceAtSale).toFixed(2)}
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
