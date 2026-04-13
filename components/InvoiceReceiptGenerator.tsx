import React, { useState, useRef } from 'react';
import { SaleRecord } from '../types';
import { FileText, Printer, Search, Plus, Trash2, MessageCircle, Loader2 } from 'lucide-react';
import logoUrl from '../logo.svg';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useReactToPrint } from 'react-to-print';

interface InvoiceReceiptGeneratorProps {
  sales: SaleRecord[];
  currencySymbol: string;
}

export const InvoiceReceiptGenerator: React.FC<InvoiceReceiptGeneratorProps> = ({ sales, currencySymbol }) => {
  const [mode, setMode] = useState<'receipt' | 'invoice'>('receipt');
  
  // Receipt Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  // Invoice Mode State
  const [customerName, setCustomerName] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<{ description: string; quantity: number; price: number }[]>([]);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const filteredSales = sales.filter(sale => 
    sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
  ).slice(0, 5); // Show top 5 matches

  const handleAddInvoiceItem = () => {
    if (!newItemDesc) return;
    setInvoiceItems([...invoiceItems, { description: newItemDesc, quantity: newItemQty, price: newItemPrice }]);
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const handleRemoveInvoiceItem = (index: number) => {
    const newItems = [...invoiceItems];
    newItems.splice(index, 1);
    setInvoiceItems(newItems);
  };

  const invoiceTotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: mode === 'receipt' ? 'Sales_Receipt' : 'Invoice',
  });

  const handleWhatsAppShare = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output('blob');
      const fileName = `${mode === 'receipt' ? 'Receipt' : 'Invoice'}_${new Date().getTime()}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: mode === 'receipt' ? 'Sales Receipt' : 'Invoice',
          text: 'Please find the attached document.',
          files: [file]
        });
      } else {
        // Fallback: download and open WhatsApp
        pdf.save(fileName);
        alert('PDF downloaded! Please attach it in the WhatsApp window that opens.');
        window.open('https://wa.me/?text=Please+find+the+attached+document', '_blank');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Could not generate PDF for sharing.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls (Hidden during print) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setMode('receipt')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'receipt' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
          >
            Generate Receipt
          </button>
          <button
            onClick={() => setMode('invoice')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'invoice' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
          >
            Create Invoice
          </button>
        </div>

        {mode === 'receipt' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Search Past Sale</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="Search by Transaction ID or Item Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {searchTerm && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                {filteredSales.map(sale => (
                  <div 
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className={`p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700 last:border-0 ${selectedSale?.id === sale.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{new Date(sale.timestamp).toLocaleDateString()}</span>
                      <span className="font-bold text-primary">{currencySymbol}{sale.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>
                  </div>
                ))}
                {filteredSales.length === 0 && (
                  <div className="p-3 text-center text-slate-500 dark:text-slate-400 text-sm">No sales found.</div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'invoice' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Customer Name / Details</label>
              <input
                type="text"
                className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="e.g. John Doe, Acme Corp..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Add Invoice Item</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Description"
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  className="w-full sm:w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(Number(e.target.value))}
                />
                <input
                  type="number"
                  placeholder="Price"
                  min="0"
                  step="0.01"
                  className="w-full sm:w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(Number(e.target.value))}
                />
                <button
                  onClick={handleAddInvoiceItem}
                  disabled={!newItemDesc}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 print:hidden">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary" />
            {mode === 'receipt' ? 'Receipt Preview' : 'Invoice Preview'}
          </h3>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <button
              onClick={handleWhatsAppShare}
              disabled={isGeneratingPdf || (mode === 'receipt' ? !selectedSale : invoiceItems.length === 0)}
              className="w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              Share to WhatsApp
            </button>
            <button
              onClick={handlePrint}
              disabled={mode === 'receipt' ? !selectedSale : invoiceItems.length === 0}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Document
            </button>
          </div>
        </div>

        {/* Printable Document */}
        <div className="overflow-x-auto">
          <div ref={printRef} className="print:block min-w-[600px] max-w-2xl mx-auto bg-white text-black p-4 sm:p-8 border border-slate-200 rounded-lg print:border-0 print:p-0">
          <div className="text-center mb-8 border-b pb-6 flex flex-col items-center">
            <img src={logoUrl} alt="Raha Soldi Ent. Logo" className="h-20 mb-4" />
            <p className="text-slate-600">General Trading & Supplies</p>
            <p className="text-slate-600">Loc: Adabraka Adjacent NDC HQ</p>
            <p className="text-slate-600">Tel: 0272326845/ 0277317589/ 0208338431</p>
            <h2 className="text-2xl font-bold mt-6 text-slate-800 uppercase tracking-wider">
              {mode === 'receipt' ? 'Sales Receipt' : 'Invoice'}
            </h2>
          </div>

          {mode === 'receipt' && selectedSale ? (
            <>
              <div className="flex justify-between mb-8 text-sm">
                <div>
                  <p className="text-slate-500 font-medium">Receipt No:</p>
                  <p className="font-mono">{selectedSale.id.slice(-8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 font-medium">Date:</p>
                  <p>{new Date(selectedSale.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <table className="w-full mb-8 text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="text-left py-2 font-bold">Item</th>
                    <th className="text-center py-2 font-bold">Qty</th>
                    <th className="text-right py-2 font-bold">Price</th>
                    <th className="text-right py-2 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-3">{item.name}</td>
                      <td className="text-center py-3">{item.quantity}</td>
                      <td className="text-right py-3">{currencySymbol}{item.priceAtSale.toFixed(2)}</td>
                      <td className="text-right py-3">{currencySymbol}{(item.quantity * item.priceAtSale).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-slate-800">
                    <span>Total:</span>
                    <span>{currencySymbol}{selectedSale.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : mode === 'invoice' && invoiceItems.length > 0 ? (
            <>
              <div className="flex justify-between mb-8 text-sm">
                <div>
                  <p className="text-slate-500 font-medium">Bill To:</p>
                  <p className="font-bold text-lg">{customerName || 'Walk-in Customer'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 font-medium">Date:</p>
                  <p>{new Date().toLocaleDateString()}</p>
                  <p className="text-slate-500 font-medium mt-2">Invoice No:</p>
                  <p className="font-mono">INV-{Math.floor(Math.random() * 1000000)}</p>
                </div>
              </div>
              <table className="w-full mb-8 text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="text-left py-2 font-bold">Description</th>
                    <th className="text-center py-2 font-bold">Qty</th>
                    <th className="text-right py-2 font-bold">Unit Price</th>
                    <th className="text-right py-2 font-bold">Amount</th>
                    <th className="print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-3">{item.description}</td>
                      <td className="text-center py-3">{item.quantity}</td>
                      <td className="text-right py-3">{currencySymbol}{item.price.toFixed(2)}</td>
                      <td className="text-right py-3">{currencySymbol}{(item.quantity * item.price).toFixed(2)}</td>
                      <td className="print:hidden text-right">
                        <button onClick={() => handleRemoveInvoiceItem(idx)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-slate-800">
                    <span>Total Due:</span>
                    <span>{currencySymbol}{invoiceTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              {mode === 'receipt' ? 'Select a sale to preview receipt' : 'Add items to preview invoice'}
            </div>
          )}

          <div className="mt-16 text-center text-sm text-slate-500 border-t pt-4">
            <p>Thank you for your business!</p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
