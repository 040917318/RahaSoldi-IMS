import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { Plus, Search, Edit2, Trash2, AlertCircle, Check, ClipboardEdit, X } from 'lucide-react';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  onAdd: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  onUpdate: (id: string, item: Partial<InventoryItem>) => void;
  onDelete: (id: string) => void;
  currencySymbol: string;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ inventory, onAdd, onUpdate, onDelete, currencySymbol }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Stock Adjust Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');

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
    setAdjustQty(item.quantity.toString());
    setIsAdjustModalOpen(true);
  };

  const closeAdjustModal = () => {
    setAdjustItem(null);
    setAdjustQty('');
    setIsAdjustModalOpen(false);
  };

  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustItem) {
        const newQty = parseInt(adjustQty);
        if (!isNaN(newQty) && newQty >= 0) {
            onUpdate(adjustItem.id, { quantity: newQty });
            closeAdjustModal();
        } else {
            alert("Please enter a valid non-negative quantity.");
        }
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Product
        </button>
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
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
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
                      <span className="text-xs">Cost: {currencySymbol}{item.costPrice.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                        <button 
                            onClick={() => openAdjustModal(item)} 
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Quick Stock Adjustment"
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
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No products found. Add some inventory to get started!
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
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all animate-fade-in">
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
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-500 mb-1">Product</label>
                        <div className="text-lg font-bold text-slate-800">{adjustItem.name}</div>
                    </div>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">New Total Quantity</label>
                        <div className="flex items-center">
                            <input
                                type="number"
                                min="0"
                                required
                                autoFocus
                                className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-3 border text-lg"
                                value={adjustQty}
                                onChange={(e) => setAdjustQty(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Current Stock: <span className="font-semibold">{adjustItem.quantity}</span>
                        </p>
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
                            Update Stock
                        </button>
                    </div>
                </form>
             </div>
        </div>
      )}
    </div>
  );
};