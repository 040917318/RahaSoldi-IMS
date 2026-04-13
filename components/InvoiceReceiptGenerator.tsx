import React, { useState, useRef, useEffect } from 'react';
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
  
  // Shared State
  const [customerName, setCustomerName] = useState('');
  const [documentItems, setDocumentItems] = useState<{ description: string; quantity: number; price: number }[]>([]);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);
  
  const [discount, setDiscount] = useState<number>(0);
  const [applyTax, setApplyTax] = useState<boolean>(false);

  // Receipt Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const filteredSales = sales.filter(sale => 
    sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
  ).slice(0, 5);

  const handleSelectSale = (sale: SaleRecord) => {
    setSelectedSaleId(sale.id);
    setDocumentItems(sale.items.map(i => ({
      description: i.name,
      quantity: i.quantity,
      price: i.priceAtSale
    })));
    setDiscount(0);
    setApplyTax(false);
    setCustomerName('');
  };

  const handleAddItem = () => {
    if (!newItemDesc) return;
    setDocumentItems([...documentItems, { description: newItemDesc, quantity: newItemQty, price: newItemPrice }]);
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...documentItems];
    newItems.splice(index, 1);
    setDocumentItems(newItems);
  };

  const subtotal = documentItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const totalAfterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = applyTax ? totalAfterDiscount * 0.20 : 0;
  const grandTotal = totalAfterDiscount + taxAmount;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: mode === 'receipt' ? 'Sales_Receipt' : 'Invoice',
  });

  const handleWhatsAppShare = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
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

  useEffect(() => {
    if (mode === 'invoice') {
      setSelectedSaleId(null);
    }
  }, [mode]);

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

        <div className="space-y-6">
          {mode === 'receipt' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Search Past Sale (Optional)</label>
              <div className="relative mb-2">
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
              
              {searchTerm && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-4">
                  {filteredSales.map(sale => (
                    <div 
                      key={sale.id}
                      onClick={() => handleSelectSale(sale)}
                      className={`p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700 last:border-0 ${selectedSaleId === sale.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Customer Name / Details (Optional)</label>
            <input
              type="text"
              className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              placeholder="e.g. John Doe, Acme Corp..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Add Item</h4>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
                onClick={handleAddItem}
                disabled={!newItemDesc}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Discount and Tax Controls */}
            <div className="flex flex-col sm:flex-row gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Discount ({currencySymbol}):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-24 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-2 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                  />
                  Apply 20% Tax
                </label>
              </div>
            </div>
          </div>
        </div>
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
              disabled={isGeneratingPdf || documentItems.length === 0}
              className="w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              Share to WhatsApp
            </button>
            <button
              onClick={handlePrint}
              disabled={documentItems.length === 0}
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
          <div className="text-center mb-8 border-b pb-4 flex flex-col items-center">
            <img src={logoUrl} alt="Raha Soldi Ent. Logo" className="mb-1" style={{ width: 'auto', height: '80px', objectFit: 'contain' }} crossOrigin="anonymous" />
            <p className="text-slate-600 text-sm font-medium mt-1">General Trading & Supplies</p>
            <p className="text-slate-600 text-sm">Loc: Adabraka Adjacent NDC HQ</p>
            <p className="text-slate-600 text-sm">Tel: 0272326845/ 0277317589/ 0208338431</p>
            <h2 className="text-2xl font-bold mt-4 text-slate-800 uppercase tracking-wider">
              {mode === 'receipt' ? 'Sales Receipt' : 'Invoice'}
            </h2>
          </div>

          {documentItems.length > 0 ? (
            <>
              <div className="flex justify-between mb-6 text-sm">
                <div>
                  <p className="text-slate-500 font-medium">{mode === 'invoice' ? 'Bill To:' : 'Customer:'}</p>
                  <p className="font-bold text-base">{customerName || 'Walk-in Customer'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 font-medium">Date:</p>
                  <p>{new Date().toLocaleDateString()}</p>
                  <p className="text-slate-500 font-medium mt-2">{mode === 'invoice' ? 'Invoice No:' : 'Receipt No:'}</p>
                  <p className="font-mono">{selectedSaleId ? selectedSaleId.slice(-8).toUpperCase() : `${mode === 'invoice' ? 'INV' : 'REC'}-${Math.floor(Math.random() * 1000000)}`}</p>
                </div>
              </div>
              <table className="w-full mb-6 text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="text-left py-2 font-bold">Description</th>
                    <th className="text-center py-2 font-bold">Qty</th>
                    <th className="text-right py-2 font-bold">Unit Price</th>
                    <th className="text-right py-2 font-bold">Amount</th>
                    <th className="print:hidden w-8" data-html2canvas-ignore="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {documentItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-2">{item.description}</td>
                      <td className="text-center py-2">{item.quantity}</td>
                      <td className="text-right py-2">{currencySymbol}{item.price.toFixed(2)}</td>
                      <td className="text-right py-2">{currencySymbol}{(item.quantity * item.price).toFixed(2)}</td>
                      <td className="print:hidden text-right" data-html2canvas-ignore="true">
                        <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">Subtotal:</span>
                    <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between py-1 text-red-600">
                      <span>Discount:</span>
                      <span>-{currencySymbol}{discount.toFixed(2)}</span>
                    </div>
                  )}
                  {applyTax && (
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>Tax (20%):</span>
                      <span>{currencySymbol}{taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-slate-800 mt-2">
                    <span>Total:</span>
                    <span>{currencySymbol}{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Add items to preview {mode === 'receipt' ? 'receipt' : 'invoice'}
            </div>
          )}

          <div className="mt-12 text-center text-sm text-slate-500 border-t pt-4">
            <p>Thank you for your business!</p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
