
import React, { useState } from 'react';
import { PendingSale } from '../types';
import { Clock, User, DollarSign, CheckCircle, XCircle, Search, AlertCircle, FileText } from 'lucide-react';

interface PendingSalesManagerProps {
  pendingSales: PendingSale[];
  onComplete: (saleId: string) => void;
  onCancel: (saleId: string) => void;
  currencySymbol: string;
}

export const PendingSalesManager: React.FC<PendingSalesManagerProps> = ({ 
  pendingSales, 
  onComplete, 
  onCancel,
  currencySymbol 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSales = pendingSales.filter(s => 
    s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.recordedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 italic">Pending Sales & Credit</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage goods taken on credit or awaiting payment.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {pendingSales.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
           <div className="bg-blue-50 dark:bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-500" />
           </div>
           <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">No Pending Sales</h3>
           <p className="text-slate-500 dark:text-slate-400 mt-2">Any sales deferred in the POS will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSales.map((sale) => (
            <div key={sale.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{sale.customerName}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" /> {formatDate(sale.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100 font-mono">
                    {currencySymbol}{sale.totalAmount.toFixed(2)}
                  </span>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Outstanding</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mb-4 space-y-2">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{item.quantity}x</span> {item.name}
                    </span>
                    <span className="text-slate-400 font-mono text-xs italic">
                      @{currencySymbol}{item.priceAtSale.toFixed(2)}
                    </span>
                  </div>
                ))}
                {sale.notes && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{sale.notes}"</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-500">
                   By: <span className="font-medium text-slate-700 dark:text-slate-300">{sale.recordedBy}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if(window.confirm('Delete this pending record? Stock will not be returned automatically.')) {
                        onCancel(sale.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Cancel/Delete Record"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onComplete(sale.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-sm shadow-green-200 dark:shadow-none transition-all active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete & Pay
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          <strong>Note:</strong> Items in pending sales have already been deducted from inventory stock to ensure availability. 
          Completing a sale will finalize the revenue and move the record to history.
        </p>
      </div>
    </div>
  );
};
