import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SaleRecord, PendingSale } from '../types';
import { FileText, Printer, Search, Plus, Trash2, MessageCircle, Loader2, X, ExternalLink, Download } from 'lucide-react';
import logoUrl from '../logo.svg';
import { exportElementToPdf } from '../utils/pdfGenerator';

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
      const docType = mode === 'receipt' ? 'Receipt' : 'Invoice';
      const safeCustomerName = customerName.trim() 
        ? customerName.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_') 
        : 'Customer';
      const fileName = `${docType}_${safeCustomerName}.pdf`;

      await exportElementToPdf(printRef.current, { fileName });
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
      const docType = mode === 'receipt' ? 'Receipt' : 'Invoice';
      const safeCustomerName = customerName.trim() 
        ? customerName.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_') 
        : 'Customer';
      const fileName = `${docType}_${safeCustomerName}.pdf`;

      const pdfBlob = (await exportElementToPdf(printRef.current, {
        fileName,
        returnBlob: true
      })) as Blob;

      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: mode === 'receipt' ? 'Sales Receipt' : 'Invoice',
          text: 'Please find the attached document.',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
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
          <div ref={printRef} className="print:block w-full max-w-3xl mx-auto bg-white text-slate-900 p-8 sm:p-12 border border-slate-200 rounded-2xl print:border-0 print:p-0 shadow-sm min-w-0 font-sans flex flex-col justify-between min-h-[960px]">
            
            <div>
              {/* DHL/Amazon Corporate Accent Top Strip */}
              <div className="h-2.5 w-full bg-slate-900 rounded-t-sm mb-7" />

              {/* Header: Document Badge Left, Logo Center, Company Name Right */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center pb-6 mb-7 border-b-2 border-slate-900/10 gap-6">
                {/* Left Column: Document Type Badge */}
                <div className="flex justify-start">
                  <div className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm tracking-widest uppercase shadow-sm">
                    {mode === 'receipt' ? 'OFFICIAL SALES RECEIPT' : 'PRO-FORMA INVOICE'}
                  </div>
                </div>

                {/* Center Column: Logo */}
                <div className="flex justify-center">
                  <img src={logoUrl} alt="Raha Soldi Ent. Logo" className="h-16 w-auto object-contain" crossOrigin="anonymous" />
                </div>

                {/* Right Column: Company Name & Tagline */}
                <div className="text-left sm:text-right">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase leading-snug">RAHA SOLDI ENTERPRISE</h1>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1.5">General Trading & Supplies</p>
                </div>
              </div>

              {documentItems.length > 0 ? (
                <>
                  {/* 2-Column Balanced Information Grid: Issuer Info Box & Billed To/Metadata Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                    {/* Issuer Box */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">ISSUED BY / SUPPLIER</p>
                      <p className="font-black text-base text-slate-900">RAHA SOLDI ENTERPRISE</p>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1.5">📍 Adabraka, Adjacent NDC HQ, Accra, Ghana</p>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5">📞 0272326845 / 0277317589 / 0208338431</p>
                    </div>

                    {/* Customer / Billed To & Document Details Box */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">CUSTOMER / BILLED TO</p>
                        <p className="font-extrabold text-base text-slate-900 break-words leading-snug whitespace-normal">{customerName || 'Walk-in Retail Customer'}</p>
                      </div>

                      <div className="text-right text-xs sm:text-sm space-y-1.5 font-medium shrink-0">
                        <p><span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{mode === 'invoice' ? 'INV:' : 'REC:'}</span> <span className="font-mono font-bold text-slate-900">{selectedSaleId ? selectedSaleId.slice(-8).toUpperCase() : `${mode === 'invoice' ? 'INV' : 'REC'}-${Math.floor(Math.random() * 899999 + 100000)}`}</span></p>
                        <p><span className="text-slate-400 text-xs font-bold uppercase tracking-wider">DATE:</span> <span className="font-bold text-slate-800">{documentDate ? new Date(documentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200/90 mb-8 shadow-2xs min-h-[220px]">
                    <table className="w-full text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white font-black text-xs uppercase tracking-wider h-12">
                          <th className="py-3.5 px-4 text-center w-12 border-b border-slate-900">#</th>
                          <th className="py-3.5 px-5 text-left border-b border-slate-900">Item Description</th>
                          <th className="py-3.5 px-4 text-center w-24 border-b border-slate-900">Qty</th>
                          <th className="py-3.5 px-5 text-right w-36 border-b border-slate-900">Unit Price</th>
                          <th className="py-3.5 px-5 text-right w-40 border-b border-slate-900">Total</th>
                          <th className="print:hidden w-8 border-b border-slate-900" data-html2canvas-ignore="true"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/90">
                        {documentItems.map((item, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="py-4 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="py-4 px-5 font-semibold text-slate-800 break-words">{item.description}</td>
                            <td className="py-4 px-4 text-center font-extrabold text-slate-700">{item.quantity}</td>
                            <td className="py-4 px-5 text-right font-mono font-medium text-slate-700">{currencySymbol}{item.price.toFixed(2)}</td>
                            <td className="py-4 px-5 text-right font-mono font-bold text-slate-900">{currencySymbol}{(item.quantity * item.price).toFixed(2)}</td>
                            <td className="print:hidden text-center pr-2" data-html2canvas-ignore="true">
                              <button onClick={() => handleRemoveItem(idx)} className="text-rose-500 hover:text-rose-700 p-1 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Totals & Payment Details 2-Column */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-8 items-start mb-8">
                    {/* Left Column: Terms & Return Policy */}
                    <div className="sm:col-span-7 space-y-3">
                      <div className="text-xs text-slate-500 leading-relaxed space-y-1.5 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                        <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">TERMS & RETURN POLICY:</p>
                        <p>All items supplied are verified against strict quality checks. Eligible exchange or warranty requests accepted within 7 days upon presentation of this original document.</p>
                      </div>
                    </div>

                    {/* Right Column: Calculations Card */}
                    <div className="sm:col-span-5">
                      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-3 text-xs sm:text-sm">
                        <div className="flex justify-between text-slate-600 font-medium">
                          <span>Subtotal:</span>
                          <span className="font-mono font-bold text-slate-800">{currencySymbol}{subtotal.toFixed(2)}</span>
                        </div>
                        
                        {discount > 0 && (
                          <div className="flex justify-between text-rose-600 font-medium">
                            <span>Discount Applied:</span>
                            <span className="font-mono font-bold">-{currencySymbol}{discount.toFixed(2)}</span>
                          </div>
                        )}
                        
                        {applyTax && (
                          <div className="flex justify-between text-slate-600 font-medium">
                            <span>VAT / Tax (20%):</span>
                            <span className="font-mono font-bold text-slate-800">{currencySymbol}{taxAmount.toFixed(2)}</span>
                          </div>
                        )}

                        <div className="border-t-2 border-slate-900 pt-3 mt-2">
                          <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex justify-between items-center shadow-md">
                            <span className="font-black text-xs sm:text-sm uppercase tracking-wider">TOTAL PAID:</span>
                            <span className="font-mono text-lg sm:text-xl font-black tracking-tight">{currencySymbol}{grandTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-slate-400 text-sm font-medium">
                  Add items to preview enterprise {mode === 'receipt' ? 'receipt' : 'invoice'}
                </div>
              )}
            </div>

            {/* Bottom Footer & Official Computer Generated Seal */}
            <div className="mt-auto pt-7 border-t-2 border-slate-900/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs" />
                <span className="font-bold text-slate-700">Official Computer Generated Document</span>
                <span className="text-slate-400">| Valid without physical signature</span>
              </div>
              
              <div className="text-center sm:text-right font-mono text-xs font-semibold text-slate-400">
                Page 1 of 1 • Raha Soldi Enterprise • Accra, Ghana
              </div>
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
