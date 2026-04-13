
import React, { useState, useMemo } from 'react';
import { InventoryItem, PurchaseOrder, PurchaseOrderItem } from '../types';
import { Plus, Search, Truck, CheckCircle, XCircle, FileText, ChevronRight, AlertCircle } from 'lucide-react';

interface PurchaseOrdersManagerProps {
  inventory: InventoryItem[];
  purchaseOrders: PurchaseOrder[];
  onCreateOrder: (order: Omit<PurchaseOrder, 'id'>) => void;
  onUpdateStatus: (id: string, status: 'received' | 'cancelled') => void;
  currencySymbol: string;
}

export const PurchaseOrdersManager: React.FC<PurchaseOrdersManagerProps> = ({ 
  inventory, 
  purchaseOrders, 
  onCreateOrder, 
  onUpdateStatus, 
  currencySymbol 
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Form State
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  
  // Selected item for adding to order
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [addQty, setAddQty] = useState<number>(1);
  const [addCost, setAddCost] = useState<number>(0);

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(po => 
      po.supplier.toLowerCase().includes(searchTerm.toLowerCase()) || 
      po.id.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseOrders, searchTerm]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()));
  }, [inventory, itemSearch]);

  const handleAddItem = () => {
    if (!selectedInventoryItem) return;
    
    const newItem: PurchaseOrderItem = {
      itemId: selectedInventoryItem.id,
      name: selectedInventoryItem.name,
      quantity: addQty,
      unitCost: addCost
    };

    setOrderItems([...orderItems, newItem]);
    
    // Reset selection
    setSelectedInventoryItem(null);
    setAddQty(1);
    setAddCost(0);
    setItemSearch('');
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const handleSubmitOrder = () => {
    if (!supplier || orderItems.length === 0) {
      alert("Please provide a supplier name and add at least one item.");
      return;
    }

    const totalCost = orderItems.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);

    onCreateOrder({
      supplier,
      date: new Date().toISOString(),
      status: 'ordered',
      items: orderItems,
      totalCost,
      notes
    });

    // Reset Form
    setSupplier('');
    setNotes('');
    setOrderItems([]);
    setViewMode('list');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {viewMode === 'list' ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg leading-5 bg-white dark:bg-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition duration-150 ease-in-out"
                placeholder="Search supplier or order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setViewMode('create')}
              className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-blue-800 focus:outline-none shadow-sm transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Purchase Order
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {new Date(po.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-50">
                      {po.supplier}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                       <div className="max-w-xs truncate">
                         {po.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                       </div>
                       <div className="text-xs text-slate-400 mt-1">{po.items.length} items</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100">
                      {currencySymbol}{po.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(po.status)}`}>
                        {po.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {po.status === 'ordered' && (
                        <div className="flex justify-end space-x-2">
                           <button 
                             onClick={() => {
                               if(window.confirm(`Confirm receipt of goods from ${po.supplier}? This will update inventory stocks.`)) {
                                 onUpdateStatus(po.id, 'received');
                               }
                             }}
                             className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-md transition-colors flex items-center"
                           >
                             <CheckCircle className="w-4 h-4 mr-1" /> Receive
                           </button>
                           <button 
                             onClick={() => {
                               if(window.confirm('Cancel this order?')) {
                                 onUpdateStatus(po.id, 'cancelled');
                               }
                             }}
                             className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition-colors flex items-center"
                           >
                             <XCircle className="w-4 h-4 mr-1" /> Cancel
                           </button>
                        </div>
                      )}
                      {po.status !== 'ordered' && (
                        <span className="text-slate-400 text-xs italic">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      <Truck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                      <p>No purchase orders found. Create one to restock inventory.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        // Create Mode
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                    <Truck className="w-5 h-5 mr-2 text-primary" />
                    Create Purchase Order
                </h2>
                <button onClick={() => setViewMode('list')} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 text-sm">
                    Cancel
                </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Supplier & Order Items */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Supplier Name</label>
                        <input
                            type="text"
                            className="block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
                            placeholder="e.g. Accra Wholesalers Ltd"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Notes (Optional)</label>
                        <textarea
                            className="block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-2 border"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                        <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">Add Items to Order</h3>
                        
                        {!selectedInventoryItem ? (
                             <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-primary focus:border-primary"
                                    placeholder="Search inventory to order..."
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                />
                                {itemSearch && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {filteredInventory.length > 0 ? (
                                            filteredInventory.map(item => (
                                                <div 
                                                    key={item.id}
                                                    className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 cursor-pointer text-sm flex justify-between items-center"
                                                    onClick={() => {
                                                        setSelectedInventoryItem(item);
                                                        setAddCost(item.costPrice); // Default to current cost
                                                        setItemSearch('');
                                                    }}
                                                >
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                                                    <span className="text-slate-400 text-xs">Current Stock: {item.quantity}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">No items found</div>
                                        )}
                                    </div>
                                )}
                             </div>
                        ) : (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="font-bold text-blue-900">{selectedInventoryItem.name}</span>
                                    <button onClick={() => setSelectedInventoryItem(null)} className="text-blue-400 hover:text-blue-600">
                                        <span className="text-xl">&times;</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 mb-1">Quantity</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            className="block w-full border-blue-200 rounded-md text-sm p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                            value={addQty}
                                            onChange={(e) => setAddQty(parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 mb-1">Unit Cost ({currencySymbol})</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            className="block w-full border-blue-200 rounded-md text-sm p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                            value={addCost}
                                            onChange={(e) => setAddCost(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={handleAddItem}
                                    className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Add to List
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Order Summary */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-slate-500 dark:text-slate-400" />
                        Order Summary
                    </h3>
                    
                    <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                        {orderItems.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-8">
                                No items added yet.
                            </div>
                        ) : (
                            orderItems.map((item, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                                    <div>
                                        <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{item.name}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.quantity} x {currencySymbol}{item.unitCost.toFixed(2)}</div>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm mr-3">
                                            {currencySymbol}{(item.quantity * item.unitCost).toFixed(2)}
                                        </span>
                                        <button onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500">
                                            <span className="text-lg">&times;</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-auto">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Total Cost</span>
                            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                                {currencySymbol}
                                {orderItems.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <button 
                            onClick={handleSubmitOrder}
                            disabled={orderItems.length === 0}
                            className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-blue-800 shadow-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Place Order <ChevronRight className="w-5 h-5 ml-1" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
