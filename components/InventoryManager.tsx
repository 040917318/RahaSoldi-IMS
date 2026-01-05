
import React, { useState, useMemo } from 'react';
import { InventoryItem, UserRole, AuditLog } from '../types';
import { Plus, Search, Edit2, Trash2, AlertCircle, Check, ClipboardEdit, X, History as HistoryIcon, User, Clock } from 'lucide-react';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  onAdd: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  onUpdate: (id: string, item: Partial<InventoryItem>) => void;
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

  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    costPrice: 0,
    salesPrice: 0,
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
      onUpdate(editingId, formData);
    } else {
      onAdd(formData);
    }
    resetForm();
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      costPrice: item.costPrice,
      salesPrice: item.salesPrice,
      lowStockThreshold: item.lowStockThreshold
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      quantity: 0,
      costPrice: 0,
      salesPrice: 0,
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
    setIsAdjustModalOpen(true);
  };

  const closeAdjustModal = () => {
    setAdjustItem(null);
    setAdjustQty('');
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

    const finalQty = getResultingQty();
    
    let message = '';
    if (adjustmentType === 'add') message = `Confirm adding ${inputVal} units to ${adjustItem.name}?\nNew Total: ${finalQty}`;
    else if (adjustmentType === 'remove') message = `Confirm removing ${inputVal} units from ${adjustItem.name}?\nNew Total: ${finalQty}`;
    else message = `Confirm setting stock for ${adjustItem.name} to ${finalQty}?`;

    if (window.confirm(message)) {
        onUpdate(adjustItem.id, { quantity: finalQty });
        closeAdjustModal();
    }
  };

  const getLogBadgeColor = (action: string) => {
    switch (action) {
        case 'create': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'restock': return 'bg-green-100 text-green-800 border-green-200';
        case 'adjustment': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'sale': return 'bg-red-100 text-red-800 border-red-200';
        case 'update': return 'bg-orange-100 text-orange-800 border-orange-200';
        default: return 'bg-slate-100 text-slate-800 border-slate-200';
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
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition duration-150 ease-in-out"
            placeholder="Search products or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {userRole === 'admin' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Product
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pricing</th>
                {userRole === 'admin' && (
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">{item.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${item.quantity <= item.lowStockThreshold ? 'text-red-600' : 'text-slate-900'}`}>
                        {item.quantity} Units
                      </span>
                      {item.quantity <= item.lowStockThreshold && (
                        <AlertCircle className="w-4 h-4 text-red-600 ml-2" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div className="flex flex-col">
                      <span className="text-slate-900 font-medium">Sell: {currencySymbol}{item.salesPrice.toFixed(2)}</span>
                      {userRole === 'admin' && (
                        <span className="text-xs">Cost: {currencySymbol}{item.costPrice.toFixed(2)}</span>
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
                  <td colSpan={userRole === 'admin' ? 5 : 4} className="px-6 py-12 text-center text-slate-500">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  required
                  list="category-options"
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Price ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
                    value={formData.salesPrice}
                    onChange={(e) => setFormData({ ...formData, salesPrice: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
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
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in">
                 <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <ClipboardEdit className="w-5 h-5 mr-2 text-primary" />
                        Adjust Stock
                    </h3>
                    <button onClick={closeAdjustModal} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <form onSubmit={handleStockAdjustment} className="p-6">
                    <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="text-sm text-slate-500 mb-1">Product</div>
                        <div className="text-lg font-bold text-slate-800">{adjustItem.name}</div>
                        <div className="text-sm text-slate-500 mt-1">Current Stock: <span className="font-bold text-slate-800">{adjustItem.quantity}</span></div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Action</label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('add')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'add' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Add (+)
                            </button>
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('remove')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'remove' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Remove (-)
                            </button>
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('set')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'set' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Set Total
                            </button>
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {adjustmentType === 'set' ? 'New Total Quantity' : 'Quantity to ' + (adjustmentType === 'add' ? 'Add' : 'Remove')}
                        </label>
                        <input
                            type="number"
                            min="0"
                            required
                            autoFocus
                            className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-3 border text-lg"
                            value={adjustQty}
                            onChange={(e) => setAdjustQty(e.target.value)}
                            placeholder="0"
                        />
                    </div>

                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg border border-slate-100 mb-6">
                        <span className="text-sm text-slate-500">Resulting Stock:</span>
                        <span className={`text-lg font-bold ${getResultingQty() < (adjustItem.lowStockThreshold || 0) ? 'text-red-600' : 'text-slate-800'}`}>
                            {getResultingQty()}
                        </span>
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={closeAdjustModal}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[80vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <HistoryIcon className="w-5 h-5 mr-2 text-primary" />
                            Audit Trail
                        </h3>
                        <p className="text-sm text-slate-500">{historyItem.name} ({historyItem.category})</p>
                    </div>
                    <button onClick={closeHistoryModal} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto flex-1">
                    {itemLogs.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {itemLogs.map((log) => (
                                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
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
                                    <p className="text-slate-800 text-sm font-medium mt-1">{log.details}</p>
                                    <div className="mt-2 flex items-center text-xs text-slate-500">
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

                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                    <button 
                        onClick={closeHistoryModal}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-sm font-medium shadow-sm transition-colors"
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
