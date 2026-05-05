
import React, { useState, useMemo } from 'react';
import { InventoryItem, UserRole, AuditLog } from '../types';
import { Plus, Search, Edit2, Trash2, AlertCircle, Check, ClipboardEdit, X, History as HistoryIcon, User, Clock, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { exportToCSV } from '../utils';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  onAdd: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  onUpdate: (id: string, item: Partial<InventoryItem>, reason?: string) => void;
  onDelete: (id: string) => void;
  currencySymbol: string;
  userRole: UserRole;
  auditLogs: AuditLog[];
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ inventory, onAdd, onUpdate, onDelete, currencySymbol, userRole, auditLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Stock Adjust Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    costPrice: '' as string | number,
    salesPrice: '' as string | number,
    lowStockThreshold: 5
  });

  const categories = useMemo(() => {
    return Array.from(new Set(inventory.map(i => i.category))).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  // Filter logs for the specific item in the history modal
  const itemLogs = useMemo(() => {
    if (!historyItem) return [];
    return auditLogs.filter(log => log.itemId === historyItem.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, historyItem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onUpdate(editingId, {
        ...formData,
        costPrice: typeof formData.costPrice === 'string' ? parseFloat(formData.costPrice) || 0 : formData.costPrice,
        salesPrice: typeof formData.salesPrice === 'string' ? parseFloat(formData.salesPrice) || 0 : formData.salesPrice
      });
    } else {
      onAdd({
        ...formData,
        costPrice: typeof formData.costPrice === 'string' ? parseFloat(formData.costPrice) || 0 : formData.costPrice,
        salesPrice: typeof formData.salesPrice === 'string' ? parseFloat(formData.salesPrice) || 0 : formData.salesPrice
      });
    }
    resetForm();
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      costPrice: item.costPrice.toString(),
      salesPrice: item.salesPrice.toString(),
      lowStockThreshold: item.lowStockThreshold
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      quantity: 0,
      costPrice: '',
      salesPrice: '',
      lowStockThreshold: 5
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  // Stock Adjustment Handlers
  const openAdjustModal = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustQty('');
    setAdjustmentType('add');
    setAdjustmentReason('');
    setIsAdjustModalOpen(true);
  };

  const closeAdjustModal = () => {
    setAdjustItem(null);
    setAdjustQty('');
    setAdjustmentReason('');
    setIsAdjustModalOpen(false);
  };

  const openHistoryModal = (item: InventoryItem) => {
    setHistoryItem(item);
    setIsHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setHistoryItem(null);
    setIsHistoryModalOpen(false);
  };

  const getResultingQty = () => {
    if (!adjustItem) return 0;
    const current = adjustItem.quantity;
    const input = parseInt(adjustQty) || 0;
    
    if (adjustmentType === 'add') return current + input;
    if (adjustmentType === 'remove') return Math.max(0, current - input);
    return input; // set
  };

  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    
    const inputVal = parseInt(adjustQty);
    if (isNaN(inputVal) || inputVal < 0) {
        alert("Please enter a valid non-negative quantity.");
        return;
    }

    if (adjustmentType === 'remove' && inputVal > adjustItem.quantity) {
        alert(`Cannot remove ${inputVal} units. Only ${adjustItem.quantity} units available.`);
        return;
    }

    const finalQty = getResultingQty();
    
    let message = '';
    const reasonText = adjustmentReason.trim() ? ` (Reason: ${adjustmentReason})` : '';

    if (adjustmentType === 'add') message = `Confirm adding ${inputVal} units to ${adjustItem.name}?\nNew Total: ${finalQty}${reasonText}`;
    else if (adjustmentType === 'remove') message = `Confirm removing ${inputVal} units from ${adjustItem.name}?\nNew Total: ${finalQty}${reasonText}`;
    else message = `Confirm setting stock for ${adjustItem.name} to ${finalQty}?${reasonText}`;

    if (window.confirm(message)) {
        onUpdate(adjustItem.id, { quantity: finalQty }, adjustmentReason);
        setIsAdjustModalOpen(false);
    }
  };

  const getLogBadgeColor = (action: string) => {
    switch (action) {
        case 'create': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'restock': return 'bg-green-100 text-green-800 border-green-200';
        case 'adjustment': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'sale': return 'bg-red-100 text-red-800 border-red-200';
        case 'update': return 'bg-orange-100 text-orange-800 border-orange-200';
        default: return 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg leading-5 bg-white dark:bg-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition duration-150 ease-in-out"
            placeholder="Search products or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              const rows: (string | number)[][] = [
                ['Name', 'Category', 'Quantity', 'Low Stock Threshold', 'Cost Price', 'Sales Price', 'Last Updated']
              ];
              inventory.forEach(item => {
                rows.push([
                  item.name,
                  item.category,
                  item.quantity,
                  item.lowStockThreshold,
                  item.costPrice,
                  item.salesPrice,
                  new Date(item.lastUpdated).toLocaleString()
                ]);
              });
              exportToCSV(`inventory_export_${new Date().toISOString().split('T')[0]}.csv`, rows);
            }}
            className="flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm w-full sm:w-auto"
          >
            <Download className="h-5 w-5 mr-2" />
            Export CSV
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm w-full sm:w-auto"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pricing</th>
                {userRole === 'admin' && (
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${item.quantity <= item.lowStockThreshold ? 'text-red-600' : 'text-slate-900 dark:text-slate-50'}`}>
                        {item.quantity} Units
                      </span>
                      {item.quantity <= item.lowStockThreshold && (
                        <AlertCircle className="w-4 h-4 text-red-600 ml-2" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-slate-50 font-medium">
                        Sell: {currencySymbol}{(Number(item.salesPrice) || 0).toFixed(2)}
                      </span>
                      {userRole === 'admin' && (
                        <span className="text-xs">
                          Cost: {currencySymbol}{(Number(item.costPrice) || 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </td>
                  {userRole === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                          <button 
                              onClick={() => openHistoryModal(item)} 
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="View Audit Trail"
                          >
                            <HistoryIcon className="w-5 h-5" />
                          </button>
                          <button 
                              onClick={() => openAdjustModal(item)} 
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Adjust Stock"
                          >
                            <ClipboardEdit className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleEdit(item)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Edit Details">
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => onDelete(item.id)} className="text-slate-400 hover:text-red-600 transition-colors" title="Delete Product">
                            <Trash2 className="w-5 h-5" />
                          </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={userRole === 'admin' ? 5 : 4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredInventory.map(item => (
          <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg mr-3">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">{item.name}</div>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {item.category}
                  </span>
                </div>
              </div>
              <div className="text-right">
                  <div className={`font-bold flex items-center justify-end ${item.quantity <= item.lowStockThreshold ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'}`}>
                    {item.quantity} Units
                    {item.quantity <= item.lowStockThreshold && (
                        <AlertCircle className="w-3 h-3 text-red-600 ml-1" />
                      )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Stock Level</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center py-2 border-t border-b border-slate-100 dark:border-slate-700/50 mb-3">
               <div>
                 <span className="text-xs text-slate-400 block">Selling Price</span>
                 <span className="font-bold text-primary">{currencySymbol}{(Number(item.salesPrice) || 0).toFixed(2)}</span>
               </div>
               {userRole === 'admin' && (
                <div className="text-right">
                   <span className="text-xs text-slate-400 block">Cost Price</span>
                   <span className="font-medium text-slate-600 dark:text-slate-300">{currencySymbol}{(Number(item.costPrice) || 0).toFixed(2)}</span>
                </div>
               )}
             </div>

            {userRole === 'admin' && (
              <div className="flex justify-between items-center pt-1">
                 <button 
                    onClick={() => openHistoryModal(item)} 
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 rounded-lg"
                 >
                   <HistoryIcon className="w-5 h-5" />
                 </button>
                 <div className="flex space-x-2">
                    <button 
                      onClick={() => openAdjustModal(item)} 
                      className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-medium flex items-center"
                    >
                      <ClipboardEdit className="w-4 h-4 mr-1" /> Adjust
                    </button>
                    <button 
                      onClick={() => handleEdit(item)} 
                      className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-600 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(item.id)} 
                      className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            )}
          </div>
        ))}
        {filteredInventory.length === 0 && (
           <div className="text-center py-10 text-slate-500 dark:text-slate-400">
              No products found.
           </div>
        )}
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Category</label>
                <input
                  type="text"
                  required
                  list="category-options"
                  className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Type or select a category"
                />
                <datalist id="category-options">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Sales Price ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={formData.salesPrice}
                    onChange={(e) => setFormData({ ...formData, salesPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {editingId ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in">
                 <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                        <ClipboardEdit className="w-5 h-5 mr-2 text-primary" />
                        Adjust Stock
                    </h3>
                    <button onClick={closeAdjustModal} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <form onSubmit={handleStockAdjustment} className="p-6">
                    <div className="mb-6 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Product</div>
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{adjustItem.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Current Stock: <span className="font-bold text-slate-800 dark:text-slate-100">{adjustItem.quantity}</span></div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Action</label>
                        <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('add')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'add' ? 'bg-white dark:bg-slate-800 text-green-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
                            >
                                Add (+)
                            </button>
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('remove')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'remove' ? 'bg-white dark:bg-slate-800 text-red-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
                            >
                                Remove (-)
                            </button>
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('set')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'set' ? 'bg-white dark:bg-slate-800 text-blue-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
                            >
                                Set Total
                            </button>
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                            {adjustmentType === 'set' ? 'New Total Quantity' : 'Quantity to ' + (adjustmentType === 'add' ? 'Add' : 'Remove')}
                        </label>
                        <input
                            type="number"
                            min="0"
                            required
                            autoFocus
                            className="block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-3 border text-lg"
                            value={adjustQty}
                            onChange={(e) => setAdjustQty(e.target.value)}
                            placeholder="0"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                            Reason for Adjustment (Optional)
                        </label>
                        <select
                            className="block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border mb-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                        >
                            <option value="">Select a reason...</option>
                            <option value="Restock / Purchase">Restock / Purchase</option>
                            <option value="Physical Audit Discrepancy">Physical Audit Discrepancy</option>
                            <option value="Unrecorded Sale">Unrecorded Sale</option>
                            <option value="Damage / Expiry">Damage / Expiry</option>
                            <option value="Theft">Theft</option>
                            <option value="Return to Supplier">Return to Supplier</option>
                            <option value="Other">Other</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Additional details..."
                            className="block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            value={adjustmentReason.startsWith('Other:') ? adjustmentReason.replace('Other: ', '') : (['Restock / Purchase', 'Physical Audit Discrepancy', 'Unrecorded Sale', 'Damage / Expiry', 'Theft', 'Return to Supplier', ''].includes(adjustmentReason) ? '' : adjustmentReason)}
                            onChange={(e) => {
                                if (adjustmentReason === 'Other' || !['Restock / Purchase', 'Physical Audit Discrepancy', 'Unrecorded Sale', 'Damage / Expiry', 'Theft', 'Return to Supplier', ''].includes(adjustmentReason)) {
                                    setAdjustmentReason(e.target.value);
                                }
                            }}
                            disabled={['Restock / Purchase', 'Physical Audit Discrepancy', 'Unrecorded Sale', 'Damage / Expiry', 'Theft', 'Return to Supplier', ''].includes(adjustmentReason) && adjustmentReason !== ''}
                        />
                    </div>

                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700/50 mb-6">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Resulting Stock:</span>
                        <span className={`text-lg font-bold ${getResultingQty() < (adjustItem.lowStockThreshold || 0) ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'}`}>
                            {getResultingQty()}
                        </span>
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={closeAdjustModal}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:bg-slate-600 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors font-medium"
                        >
                            Confirm Change
                        </button>
                    </div>
                </form>
             </div>
        </div>
      )}

      {/* Audit Log / History Modal */}
      {isHistoryModalOpen && historyItem && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[80vh]">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                            <HistoryIcon className="w-5 h-5 mr-2 text-primary" />
                            Audit Trail
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{historyItem.name} ({historyItem.category})</p>
                    </div>
                    <button onClick={closeHistoryModal} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto flex-1">
                    {itemLogs.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {itemLogs.map((log) => (
                                <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center">
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded border uppercase ${getLogBadgeColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-3 flex items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {new Date(log.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-slate-800 dark:text-slate-100 text-sm font-medium mt-1">{log.details}</p>
                                    <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
                                        <User className="w-3 h-3 mr-1" />
                                        {log.userId}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <HistoryIcon className="w-12 h-12 mb-2 opacity-20" />
                            <p>No history records found for this item.</p>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button 
                        onClick={closeHistoryModal}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-700 text-sm font-medium shadow-sm transition-colors"
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
