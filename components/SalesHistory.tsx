import React, { useState, useMemo } from 'react';
import { SaleRecord, PendingSale, SaleItem } from '../types';
import { 
  Search, Eye, FileText, X, Calendar, ChevronRight, 
  ChevronLeft, Download, ArrowUpDown, Clock, User, 
  CheckCircle2, ShoppingBag, Tag
} from 'lucide-react';

interface SalesHistoryProps {
  sales: SaleRecord[];
  pendingSales: PendingSale[];
  currencySymbol: string;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, pendingSales, currencySymbol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Clean, safe Ghana Cedi symbol that never renders corrupted characters
  const safeCurrency = (currencySymbol || 'GH¢').replace(/[\u01B5\u20B5]/g, '¢');
  const formatMoney = (val: number) => `${safeCurrency}\u00A0${(Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Normalization logic to handle differences between local state, schema keys, and JSON payloads
  const combinedSales = useMemo(() => {
    const normalizeItems = (rawItems: any): SaleItem[] => {
      let list: any[] = [];
      if (Array.isArray(rawItems)) list = rawItems;
      else if (typeof rawItems === 'string') {
        try {
          const parsed = JSON.parse(rawItems);
          if (Array.isArray(parsed)) list = parsed;
        } catch {}
      }
      return list.map((i: any) => {
        const qty = Number(i?.quantity ?? i?.qty ?? 1);
        const price = Number(i?.priceAtSale ?? i?.price ?? i?.salesPrice ?? i?.unit_price ?? 0);
        const cost = Number(i?.costAtSale ?? i?.cost ?? i?.costPrice ?? i?.unit_cost ?? 0);
        const disc = Number(i?.discount ?? 0);
        const itemId = String(i?.itemId ?? i?.id ?? '');
        return {
          itemId,
          name: String(i?.name ?? i?.itemName ?? 'Product Item'),
          quantity: isNaN(qty) || qty <= 0 ? 1 : qty,
          priceAtSale: isNaN(price) ? 0 : price,
          costAtSale: isNaN(cost) ? 0 : cost,
          discount: isNaN(disc) ? 0 : disc
        };
      });
    };

    const mappedPending = (pendingSales || []).map(ps => {
      const items = normalizeItems(ps.items);
      const computedTotal = items.reduce((sum, i) => sum + (i.quantity * i.priceAtSale - (i.discount || 0)), 0);
      const computedCost = items.reduce((sum, i) => sum + (i.quantity * i.costAtSale), 0);
      const rawTotal = Number(ps.totalAmount ?? (ps as any).total_amount);
      const rawProfit = Number(ps.totalProfit ?? (ps as any).total_profit);
      const totalAmount = !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : (computedTotal || 0);
      const totalProfit = !isNaN(rawProfit) ? rawProfit : (totalAmount - computedCost);

      return {
        ...ps,
        id: ps.id || (ps as any).pending_id || '',
        items,
        totalAmount,
        totalProfit,
        customerName: (ps as any).customerName ?? (ps as any).customer_name ?? 'Deferred Customer',
        recordedBy: ps.recordedBy ?? (ps as any).recorded_by ?? 'Cashier',
        timestamp: ps.timestamp ?? (ps as any).created_at ?? (ps as any).createdAt ?? new Date().toISOString(),
        status: 'pending' as const,
        isPending: true
      };
    });
    
    const mappedCompleted = (sales || []).map(s => {
      const items = normalizeItems(s.items);
      const computedTotal = items.reduce((sum, i) => sum + (i.quantity * i.priceAtSale - (i.discount || 0)), 0);
      const computedCost = items.reduce((sum, i) => sum + (i.quantity * i.costAtSale), 0);
      const rawTotal = Number(s.totalAmount ?? (s as any).total_amount);
      const rawProfit = Number(s.totalProfit ?? (s as any).total_profit);
      const totalAmount = !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : (computedTotal || 0);
      const totalProfit = !isNaN(rawProfit) ? rawProfit : (totalAmount - computedCost);

      return {
        ...s,
        id: s.id || (s as any).sale_id || '',
        items,
        totalAmount,
        totalProfit,
        recordedBy: s.recordedBy ?? (s as any).recorded_by ?? 'Cashier',
        timestamp: s.timestamp ?? (s as any).created_at ?? (s as any).createdAt ?? new Date().toISOString(),
        status: 'completed' as const,
        isPending: false
      };
    });

    return [...mappedCompleted, ...mappedPending];
  }, [sales, pendingSales]);

  // Status counts
  const counts = useMemo(() => {
    return {
      all: combinedSales.length,
      completed: combinedSales.filter(s => !s.isPending).length,
      pending: combinedSales.filter(s => s.isPending).length
    };
  }, [combinedSales]);

  const filteredSales = useMemo(() => {
    return combinedSales.filter(sale => {
      // 1. Status Filter
      if (statusFilter === 'completed' && sale.isPending) return false;
      if (statusFilter === 'pending' && !sale.isPending) return false;

      // 2. Search term filter
      const term = (searchTerm || '').trim().toLowerCase();
      const itemsList = Array.isArray(sale.items) ? sale.items : [];
      const matchesSearch = 
        term === '' || 
        itemsList.some((item: any) => (item?.name || '').toLowerCase().includes(term)) ||
        (sale.id || '').toLowerCase().includes(term) ||
        (('customerName' in sale) && String((sale as any).customerName || '').toLowerCase().includes(term)) ||
        (sale.recordedBy && String(sale.recordedBy).toLowerCase().includes(term));

      // 3. Date range filter
      let matchesDate = true;
      const saleDate = sale.timestamp ? new Date(sale.timestamp) : new Date();
      if (!isNaN(saleDate.getTime())) {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && saleDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && saleDate <= end;
        }
      }

      return matchesSearch && matchesDate;
    }).sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        switch(sortBy) {
            case 'date-asc': return timeA - timeB;
            case 'amount-desc': return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
            case 'amount-asc': return (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0);
            case 'date-desc': 
            default:
                return timeB - timeA;
        }
    });
  }, [combinedSales, statusFilter, searchTerm, startDate, endDate, sortBy]);

  // Reset pagination on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, startDate, endDate, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSales.slice(start, start + PAGE_SIZE);
  }, [filteredSales, currentPage]);

  // Safe helper to format date
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-GB', {
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
        case 'week':
            start.setDate(now.getDate() - 7);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(todayStr);
            break;
        case 'month':
            start.setDate(1);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(todayStr);
            break;
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Status', 'Recorded By', 'Customer', 'Items', 'Total Amount', 'Total Profit'];
    const rows = filteredSales.map(s => {
      const items = Array.isArray(s.items) ? s.items : [];
      const itemsText = items.map(i => `${Number(i.quantity) || 1}x ${i.name || 'Item'}`).join(', ');
      return [
        s.timestamp ? new Date(s.timestamp).toLocaleString('en-GB') : 'N/A',
        s.id || '',
        s.isPending ? 'Pending Credit' : 'Completed',
        s.recordedBy || 'N/A',
        (s as any).customerName || 'N/A',
        `"${itemsText.replace(/"/g, '""')}"`,
        (Number(s.totalAmount) || 0).toFixed(2),
        (Number(s.totalProfit) || 0).toFixed(2)
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
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
    <div className="space-y-4 animate-fade-in">
      {/* Top Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/80 space-y-4">
        
        {/* Status Segment Tabs & Export CSV */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>All Records</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                {counts.completed}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending / Credit</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                {counts.pending}
              </span>
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 disabled:opacity-40 transition-all cursor-pointer"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              placeholder="Search item, transaction ID, customer, staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="w-full sm:w-52 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="block w-full pl-10 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 cursor-pointer"
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

        {/* Date Presets & Range Picker */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between pt-1">
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            <button onClick={() => setQuickFilter('today')} className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer">Today</button>
            <button onClick={() => setQuickFilter('yesterday')} className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer">Yesterday</button>
            <button onClick={() => setQuickFilter('week')} className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer">Last 7 Days</button>
            <button onClick={() => setQuickFilter('month')} className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer">This Month</button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="date"
                className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Start Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                className="block w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="End Date"
              />
            </div>
            {(searchTerm || startDate || endDate || statusFilter !== 'all') && (
              <button 
                onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setStatusFilter('all'); }}
                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Reset all filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sales Table (Desktop / Tablet View) */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700/60">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-wider">Date & Time</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-wider">Status / Customer</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-wider">Items Summary</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-black uppercase tracking-wider">Total Amount</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-black uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm">
              {paginatedSales.map((sale) => {
                const items = Array.isArray(sale.items) ? sale.items : [];
                const totalItemQty = items.reduce((sum: number, i: any) => sum + (Number(i?.quantity) || 1), 0);
                const firstItemName = items[0]?.name || 'Transaction Item';

                return (
                  <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <div className="font-medium text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        {formatDate(sale.timestamp)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: {(sale.id || '').slice(0, 8).toUpperCase()}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {sale.isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Pending Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        )}
                      </div>
                      {sale.isPending && (sale as any).customerName && (
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-500" />
                          <span>{(sale as any).customerName}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                        By: {sale.recordedBy || 'Cashier'}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-800 dark:text-slate-100">
                      <div className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{firstItemName}</span>
                        {items.length > 1 && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-normal shrink-0">
                            +{items.length - 1} more
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {totalItemQty} unit{totalItemQty === 1 ? '' : 's'} across {items.length} item{items.length === 1 ? '' : 's'}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="font-mono font-bold text-base text-slate-900 dark:text-white">
                        {formatMoney(sale.totalAmount)}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Profit: {formatMoney(sale.totalProfit)}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => setSelectedSale(sale)}
                        className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-indigo-200/80 dark:border-indigo-500/20 shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No sales records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List (Smartphone Responsive) */}
      <div className="md:hidden space-y-3">
        {paginatedSales.map((sale) => {
          const items = Array.isArray(sale.items) ? sale.items : [];
          const totalUnits = items.reduce((sum: number, i: any) => sum + (Number(i?.quantity) || 1), 0);

          return (
            <div 
              key={sale.id} 
              className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border ${
                sale.isPending 
                  ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/10' 
                  : 'border-slate-200 dark:border-slate-700/80'
              } shadow-sm space-y-3 transition-all`}
            >
              {/* Header: Date, Status, and Total Amount */}
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    {sale.isPending ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" /> Pending Credit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{formatDate(sale.timestamp)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-base sm:text-lg text-slate-900 dark:text-white whitespace-nowrap">
                    {formatMoney(sale.totalAmount)}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Profit: {formatMoney(sale.totalProfit)}
                  </div>
                </div>
              </div>

              {/* Customer details for pending sales */}
              {sale.isPending && (sale as any).customerName && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/50 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    Customer: {(sale as any).customerName}
                  </span>
                  {(sale as any).notes && (
                    <span className="text-[10px] opacity-75 truncate max-w-[120px]">{(sale as any).notes}</span>
                  )}
                </div>
              )}

              {/* Items List Preview */}
              <div className="space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/40">
                {items.slice(0, 2).map((item: any, iIdx: number) => (
                  <div key={iIdx} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300">
                    <span className="truncate pr-2 font-medium">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1">{Number(item.quantity) || 1}x</span>
                      {item.name || 'Product Item'}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {formatMoney((Number(item.quantity) || 1) * (Number(item.priceAtSale) || 0) - (Number(item.discount) || 0))}
                    </span>
                  </div>
                ))}
                {items.length > 2 && (
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium pt-0.5">
                    +{items.length - 2} additional items in sale
                  </div>
                )}
              </div>

              {/* Bottom Card Controls */}
              <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-700/50">
                <span className="text-[11px] text-slate-400">
                  {totalUnits} unit{totalUnits === 1 ? '' : 's'} • Staff: {sale.recordedBy || 'Cashier'}
                </span>

                <button 
                  onClick={() => setSelectedSale(sale)}
                  className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center border border-indigo-200/80 dark:border-indigo-500/20 active:scale-95 cursor-pointer"
                >
                  Details <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          );
        })}

        {paginatedSales.length === 0 && (
          <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-sm">
            No sales records found matching your filters.
          </div>
        )}
      </div>

      {/* Responsive Pagination Bar */}
      {filteredSales.length > PAGE_SIZE && (
        <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-slate-700 dark:text-slate-200">{(currentPage - 1) * PAGE_SIZE + 1}</span> to <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(currentPage * PAGE_SIZE, filteredSales.length)}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{filteredSales.length}</span> transactions
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in relative max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                  {selectedSale.isPending ? 'Pending Credit Record' : 'Transaction Details'}
                </h3>
                {selectedSale.isPending ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Pending
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Paid
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSelectedSale(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {/* Financial Highlight Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-3 sm:p-4 rounded-xl text-white shadow-md">
                  <span className="text-[10px] uppercase font-black tracking-wider opacity-80 block mb-0.5">Total Amount</span>
                  <span className="text-lg sm:text-xl font-black font-mono tracking-tight whitespace-nowrap block">
                    {formatMoney(selectedSale.totalAmount)}
                  </span>
                </div>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-3 sm:p-4 rounded-xl text-white shadow-md">
                  <span className="text-[10px] uppercase font-black tracking-wider opacity-80 block mb-0.5">Net Profit</span>
                  <span className="text-lg sm:text-xl font-black font-mono tracking-tight whitespace-nowrap block">
                    {formatMoney(selectedSale.totalProfit)}
                  </span>
                </div>
              </div>

              {/* Customer / Credit Details */}
              {selectedSale.isPending && (selectedSale as any).customerName && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-xl space-y-1">
                  <div className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">Customer</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{(selectedSale as any).customerName}</div>
                  {(selectedSale as any).notes && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 italic pt-1 border-t border-amber-200/40 dark:border-amber-800/20">
                      Note: {(selectedSale as any).notes}
                    </div>
                  )}
                </div>
              )}
              
              {/* Metadata strip */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div>
                  <span className="text-slate-400 text-[10px] block">Date & Time</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{formatDate(selectedSale.timestamp)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Transaction ID</span>
                  <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                    {selectedSale.id}
                  </span>
                </div>
              </div>

              {/* Itemized Table */}
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">
                  Itemized Breakdown ({Array.isArray(selectedSale.items) ? selectedSale.items.length : 0})
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-2 py-2 text-right">Price</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                      {(Array.isArray(selectedSale.items) ? selectedSale.items : []).map((item: any, idx: number) => {
                        const qty = Number(item.quantity) || 1;
                        const price = Number(item.priceAtSale) || 0;
                        const disc = Number(item.discount) || 0;
                        const total = (qty * price) - disc;

                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                            <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/30">
                                  <Tag className="w-3 h-3" />
                                </div>
                                <div>
                                  <div>{item.name || 'Item'}</div>
                                  {disc > 0 && <span className="text-[10px] text-rose-500 font-bold block">Disc: -{formatMoney(disc)}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-slate-500 whitespace-nowrap">{formatMoney(price)}</td>
                            <td className="px-2 py-2 text-right font-bold whitespace-nowrap">x{qty}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatMoney(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Staff signature info */}
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100 dark:border-slate-700/50 text-slate-500">
                <span>Processed By:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedSale.recordedBy || 'Cashier'}</span>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-900 px-4 sm:px-6 py-3 flex justify-end items-center border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
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

export default SalesHistory;
