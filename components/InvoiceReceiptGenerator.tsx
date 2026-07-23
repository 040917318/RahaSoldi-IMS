import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SaleRecord, PendingSale } from '../types';
import { FileText, Printer, Search, Plus, Trash2, MessageCircle, Loader2, X, ExternalLink, Download } from 'lucide-react';
import logoUrl from '../logo.svg';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useReactToPrint } from 'react-to-print';

interface InvoiceReceiptGeneratorProps {
  sales: SaleRecord[];
  pendingSales: PendingSale[];
  currencySymbol: string;
}

export const InvoiceReceiptGenerator: React.FC<InvoiceReceiptGeneratorProps> = ({ sales, pendingSales, currencySymbol }) => {
  const [mode, setMode] = useState<'receipt' | 'invoice'>('receipt');
  
  // Shared State
  const [customerName, setCustomerName] = useState('');
  const [documentDate, setDocumentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [documentItems, setDocumentItems] = useState<{ description: string; quantity: number; price: number }[]>([]);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);
  
  const [discount, setDiscount] = useState<number>(0);
  const [applyTax, setApplyTax] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Combine sales for searching
  const allSalesCombined = useMemo(() => {
    return [
      ...sales.map(s => ({ ...s, isPending: false })),
      ...pendingSales.map(ps => ({ ...ps, isPending: true }))
    ];
  }, [sales, pendingSales]);
  
  // Persistence Logic
  useEffect(() => {
    const savedDraft = localStorage.getItem('invoice_generator_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.mode) setMode(draft.mode);
        if (draft.customerName) setCustomerName(draft.customerName);
        if (draft.documentDate) setDocumentDate(draft.documentDate);
        if (draft.documentItems) setDocumentItems(draft.documentItems);
        if (draft.discount !== undefined) setDiscount(draft.discount);
        if (draft.applyTax !== undefined) setApplyTax(draft.applyTax);
      } catch (e) {
        console.error("Failed to load invoice draft", e);
      }
    }
  }, []);

  useEffect(() => {
    const draft = {
      mode,
      customerName,
      documentDate,
      documentItems,
      discount,
      applyTax
    };
    localStorage.setItem('invoice_generator_draft', JSON.stringify(draft));
  }, [mode, customerName, documentDate, documentItems, discount, applyTax]);

  // Receipt Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const filteredSales = allSalesCombined.filter((sale: any) => 
    sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.items.some((item: any) => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sale.customerName && sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
  ).slice(0, 5);

  const handleSelectSale = (sale: any) => {
    setSelectedSaleId(sale.id);
    setDocumentItems(sale.items.map((i: any) => ({
      description: i.name,
      quantity: i.quantity,
      price: i.priceAtSale
    })));
    setDiscount(0);
    setApplyTax(false);
    setCustomerName(sale.customerName || '');
    if (sale.timestamp) {
      try {
        setDocumentDate(new Date(sale.timestamp).toISOString().split('T')[0]);
      } catch (e) {
        setDocumentDate(new Date().toISOString().split('T')[0]);
      }
    }
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

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 1.5, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const docType = mode === 'receipt' ? 'Receipt' : 'Invoice';
      const safeCustomerName = customerName.trim() 
        ? customerName.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_') 
        : 'Customer';
      const fileName = `${docType}_${safeCustomerName}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Could not generate PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      setShowPrintModal(true);
      return;
    }

    const printElement = printRef.current;
    if (!printElement) return;

    // Create a temporary container for printing to guarantee compatibility on laptop browsers/iframes
    const printContainer = document.createElement('div');
    printContainer.id = 'print-temp-container';
    printContainer.innerHTML = printElement.innerHTML;
    printContainer.className = printElement.className;

    // Inject styles specifically for printing
    const style = document.createElement('style');
    style.id = 'print-temp-styles';
    style.innerHTML = `
      @media print {
        body > *:not(#print-temp-container) {
          display: none !important;
        }
        #print-temp-container {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          background: white !important;
          color: black !important;
          padding: 24px !important;
          margin: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;

    document.body.appendChild(printContainer);
    document.head.appendChild(style);

    // Trigger standard browser print on the window context
    window.print();

    // Clean up DOM elements after the print dialog closes
    setTimeout(() => {
      const container = document.getElementById('print-temp-container');
      if (container) container.remove();
      const styleTag = document.getElementById('print-temp-styles');
      if (styleTag) styleTag.remove();
    }, 500);
  };

  const handleWhatsAppShare = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 1.5, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const pdfBlob = pdf.output('blob');
      const docType = mode === 'receipt' ? 'Receipt' : 'Invoice';
      const safeCustomerName = customerName.trim() 
        ? customerName.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_') 
        : 'Customer';
      const fileName = `${docType}_${safeCustomerName}.pdf`;
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
      <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4 sm:mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('receipt')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${mode === 'receipt' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
            >
              Generate Receipt
            </button>
            <button
              onClick={() => setMode('invoice')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${mode === 'invoice' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
            >
              Create Invoice
            </button>
          </div>
          <button
            onClick={() => {
              if (confirm('Clear all fields in this form?')) {
                setCustomerName('');
                setDocumentDate(new Date().toISOString().split('T')[0]);
                setDocumentItems([]);
                setDiscount(0);
                setApplyTax(false);
                setSelectedSaleId(null);
                setSearchTerm('');
              }
            }}
            className="self-end sm:self-auto text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Clear Form
          </button>
        </div>

        <div className="space-y-4 sm:space-y-6">
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{new Date(sale.timestamp).toLocaleDateString()}</span>
                          {sale.isPending && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-bold uppercase flex items-center">
                              Pending
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-primary">{currencySymbol}{sale.totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {(sale as any).customerName && <span className="font-bold mr-1">{(sale as any).customerName}:</span>}
                        {sale.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Document Date (Calendar Select)</label>
              <input
                type="date"
                className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 bg-slate-50 dark:bg-slate-900">
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Add Item</h4>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mb-4">
              <input
                type="text"
                placeholder="Description"
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
              />
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  className="w-1/2 sm:w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(Number(e.target.value))}
                />
                <input
                  type="number"
                  placeholder="Price"
                  min="0"
                  step="0.01"
                  className="w-1/2 sm:w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(Number(e.target.value))}
                />
              </div>
              <button
                onClick={handleAddItem}
                disabled={!newItemDesc}
                className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center font-medium text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4 mr-1 sm:mr-0" />
                <span className="sm:hidden">Add Item</span>
              </button>
            </div>

            {/* Discount and Tax Controls */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 border-t border-slate-200 dark:border-slate-700 pt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">Discount ({currencySymbol}):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-20 sm:w-24 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center cursor-pointer">
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
      <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 print:hidden">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary" />
            {mode === 'receipt' ? 'Receipt Preview' : 'Invoice Preview'}
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={handleWhatsAppShare}
              disabled={isGeneratingPdf || documentItems.length === 0}
              className="w-full sm:w-auto px-3.5 py-2 text-xs sm:text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center font-medium"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              Share to WhatsApp
            </button>
            <button
              onClick={handlePrint}
              disabled={documentItems.length === 0}
              className="w-full sm:w-auto px-3.5 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center font-medium"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Document
            </button>
          </div>
        </div>

        {/* Printable Document Canvas */}
        <div className="w-full overflow-x-auto">
          <div ref={printRef} className="print:block w-full max-w-2xl mx-auto bg-white text-black p-3.5 sm:p-8 border border-slate-200 rounded-lg print:border-0 print:p-0 shadow-sm min-w-0">
          <div className="text-center mb-6 sm:mb-8 border-b pb-4 flex flex-col items-center">
            <img src={logoUrl} alt="Raha Soldi Ent. Logo" className="mb-1" style={{ width: 'auto', maxHeight: '70px', objectFit: 'contain' }} crossOrigin="anonymous" />
            <p className="text-slate-600 text-xs sm:text-sm font-medium mt-1">General Trading & Supplies</p>
            <p className="text-slate-600 text-xs sm:text-sm">Loc: Adabraka Adjacent NDC HQ</p>
            <p className="text-slate-600 text-xs sm:text-sm">Tel: 0272326845/ 0277317589/ 0208338431</p>
            <h2 className="text-lg sm:text-2xl font-bold mt-3 sm:mt-4 text-slate-800 uppercase tracking-wider">
              {mode === 'receipt' ? 'Sales Receipt' : 'Invoice'}
            </h2>
          </div>

          {documentItems.length > 0 ? (
            <>
              <div className="flex justify-between items-start mb-4 sm:mb-6 text-xs sm:text-sm gap-2">
                <div>
                  <p className="text-slate-500 font-medium">{mode === 'invoice' ? 'Bill To:' : 'Customer:'}</p>
                  <p className="font-bold text-sm sm:text-base">{customerName || 'Walk-in Customer'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 font-medium">Date:</p>
                  <p className="font-semibold">{documentDate ? new Date(documentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString()}</p>
                  <p className="text-slate-500 font-medium mt-1.5">{mode === 'invoice' ? 'Invoice No:' : 'Receipt No:'}</p>
                  <p className="font-mono text-xs sm:text-sm">{selectedSaleId ? selectedSaleId.slice(-8).toUpperCase() : `${mode === 'invoice' ? 'INV' : 'REC'}-${Math.floor(Math.random() * 1000000)}`}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full mb-4 sm:mb-6 text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-800">
                      <th className="text-left py-1.5 sm:py-2 font-bold">Description</th>
                      <th className="text-center py-1.5 sm:py-2 font-bold px-1">Qty</th>
                      <th className="text-right py-1.5 sm:py-2 font-bold px-1">Unit Price</th>
                      <th className="text-right py-1.5 sm:py-2 font-bold">Amount</th>
                      <th className="print:hidden w-6" data-html2canvas-ignore="true"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="py-1.5 sm:py-2 break-words max-w-[120px] sm:max-w-none">{item.description}</td>
                        <td className="text-center py-1.5 sm:py-2 px-1">{item.quantity}</td>
                        <td className="text-right py-1.5 sm:py-2 px-1">{currencySymbol}{item.price.toFixed(2)}</td>
                        <td className="text-right py-1.5 sm:py-2">{currencySymbol}{(item.quantity * item.price).toFixed(2)}</td>
                        <td className="print:hidden text-right pl-1" data-html2canvas-ignore="true">
                          <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700 p-1">
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <div className="w-full sm:w-64 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
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
                  <div className="flex justify-between py-1.5 sm:py-2 font-bold text-base sm:text-lg border-t-2 border-slate-800 mt-2">
                    <span>Total:</span>
                    <span>{currencySymbol}{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 sm:py-12 text-slate-400 text-xs sm:text-sm">
              Add items to preview {mode === 'receipt' ? 'receipt' : 'invoice'}
            </div>
          )}

          <div className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-slate-500 border-t pt-3 sm:pt-4">
            <p>Thank you for your business!</p>
          </div>
        </div>
        </div>
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 relative">
            <button 
              onClick={() => setShowPrintModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
                <Printer className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Print Document</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Since you are viewing this app inside the developer preview iframe, direct print connections may be restricted by your browser.
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={async () => {
                  setShowPrintModal(false);
                  await handleDownloadPdf();
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Save & Print PDF (Compressed)</span>
              </button>
              
              <button
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  setShowPrintModal(false);
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-medium rounded-xl transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in New Tab to Print</span>
              </button>
              
              <button
                onClick={() => {
                  setShowPrintModal(false);
                  setTimeout(() => {
                    const printElement = printRef.current;
                    if (!printElement) return;
                    const printContainer = document.createElement('div');
                    printContainer.id = 'print-temp-container';
                    printContainer.innerHTML = printElement.innerHTML;
                    printContainer.className = printElement.className;
                    const style = document.createElement('style');
                    style.id = 'print-temp-styles';
                    style.innerHTML = `
                      @media print {
                        body > *:not(#print-temp-container) {
                          display: none !important;
                        }
                        #print-temp-container {
                          display: block !important;
                          position: absolute !important;
                          left: 0 !important;
                          top: 0 !important;
                          width: 100% !important;
                          background: white !important;
                          color: black !important;
                          padding: 24px !important;
                          margin: 0 !important;
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                        }
                      }
                    `;
                    document.body.appendChild(printContainer);
                    document.head.appendChild(style);
                    window.print();
                    setTimeout(() => {
                      const container = document.getElementById('print-temp-container');
                      if (container) container.remove();
                      const styleTag = document.getElementById('print-temp-styles');
                      if (styleTag) styleTag.remove();
                    }, 500);
                  }, 100);
                }}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors text-center"
              >
                Try direct browser print anyway
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
};
