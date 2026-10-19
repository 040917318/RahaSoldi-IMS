import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  X, 
  Download, 
  Share2, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { 
  Thermal80mmReceiptData, 
  Thermal80mmConfig, 
  DEFAULT_THERMAL_CONFIG, 
  generate80mmThermalPdf,
  formatThermalCurrency,
  GeneratedThermalPdf
} from '../utils/thermal80mmPdfGenerator';

interface FourBarCodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: Thermal80mmReceiptData | null;
}

export const FourBarCodeExportModal: React.FC<FourBarCodeExportModalProps> = ({
  isOpen,
  onClose,
  receiptData
}) => {
  // Load saved administrator thermal receipt preferences
  const [config, setConfig] = useState<Thermal80mmConfig>(() => {
    try {
      const saved = localStorage.getItem('xp420b_4barcode_config');
      if (saved) {
        return { ...DEFAULT_THERMAL_CONFIG, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_THERMAL_CONFIG;
  });

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [lastGeneratedPdf, setLastGeneratedPdf] = useState<GeneratedThermalPdf | null>(null);
  const [mobileTab, setMobileTab] = useState<'actions' | 'preview'>('actions');

  // Persist configuration changes
  useEffect(() => {
    try {
      localStorage.setItem('xp420b_4barcode_config', JSON.stringify(config));
    } catch {}
  }, [config]);

  // Generate / regenerate PDF whenever receiptData or config changes
  useEffect(() => {
    if (!isOpen || !receiptData) {
      setLastGeneratedPdf(null);
      return;
    }

    try {
      const result = generate80mmThermalPdf(receiptData, config);
      setLastGeneratedPdf(result);
      return () => {
        if (result.blobUrl) {
          URL.revokeObjectURL(result.blobUrl);
        }
      };
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setExportNotice({
        type: 'error',
        message: 'Could not generate receipt PDF. Please check order items.'
      });
    }
  }, [isOpen, receiptData, config]);

  const updateConfig = (updates: Partial<Thermal80mmConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_THERMAL_CONFIG);
  };

  if (!isOpen || !receiptData) return null;

  // Handle Import into 4BarCode (Web Share API for Android)
  const handleImportInto4BarCode = async () => {
    if (!lastGeneratedPdf) return;
    setIsExporting(true);
    setExportNotice(null);

    const file = new File([lastGeneratedPdf.blob], lastGeneratedPdf.fileName, {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    let shared = false;

    // 1. Try native Web Share API with file (Standard on Android Chrome / Edge)
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `80mm Receipt #${receiptData.receiptNumber}`,
            text: `Open with 4BarCode to print on Xprinter XP-420B (80mm Continuous Roll)`
          });
          shared = true;
          setExportNotice({
            type: 'success',
            message: 'Shared to Android. Select "4BarCode" to print directly to your XP-420B.'
          });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setIsExporting(false);
          return; // User cancelled share sheet
        }
        console.warn('Web Share failed, falling back to download:', err);
      }
    }

    // 2. Fallback: Download file directly and show import instructions
    if (!shared) {
      downloadPdfFile(lastGeneratedPdf);
      setExportNotice({
        type: 'info',
        message: 'Receipt downloaded! Open 4BarCode on your phone -> tap "PDF Print" -> select this file to print.'
      });
    }

    setIsExporting(false);
  };

  const downloadPdfFile = (pdf: GeneratedThermalPdf) => {
    const a = document.createElement('a');
    a.href = pdf.blobUrl;
    a.download = pdf.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadOnly = () => {
    if (!lastGeneratedPdf) return;
    downloadPdfFile(lastGeneratedPdf);
    setExportNotice({
      type: 'success',
      message: `Downloaded "${lastGeneratedPdf.fileName}" (80mm × ${lastGeneratedPdf.dimensions.heightMm}mm)`
    });
  };

  const handleBrowserPrint = () => {
    if (!lastGeneratedPdf) return;
    const printWindow = window.open(lastGeneratedPdf.blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  const formattedDate = receiptData.dateTime instanceof Date
    ? receiptData.dateTime.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : String(receiptData.dateTime);

  // Ensure Cedi symbol is formatted safely for 203 DPI thermal print & PDF rendering
  const currency = formatThermalCurrency(receiptData.currencySymbol, config.currencyDisplayMode);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 md:p-5 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                  80mm Thermal Receipt (4BarCode & XP-420B)
                </h2>
                {lastGeneratedPdf && (
                  <span className="text-[10px] sm:text-[11px] font-mono font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    80mm × {lastGeneratedPdf.dimensions.heightMm}mm
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Continuous roll formatting · Single page with zero waste · Ready for 4BarCode Android import
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile View Switcher (Visible on smartphone screens < 1024px) */}
        <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 px-3 py-1.5 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('actions')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileTab === 'actions'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Print & Actions</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              mobileTab === 'preview'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Receipt Preview</span>
          </button>
        </div>

        {/* Modal Body: Split view on desktop, responsive tabbed view on mobile */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* Left Column: Visual 80mm Continuous Roll Preview */}
          <div className={`lg:col-span-6 p-3 sm:p-5 lg:p-6 bg-slate-100/70 dark:bg-slate-950/40 flex flex-col items-center justify-start overflow-y-auto ${
            mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
          }`}>
            <div className="w-full max-w-sm mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Continuous Thermal Preview
              </span>
              <span className="font-mono text-[10px] sm:text-[11px]">
                Width: 80 mm ({80 - (config.marginMm * 2)} mm printable)
              </span>
            </div>

            {/* Receipt Simulation Card */}
            <div 
              className="bg-white text-black p-5 rounded-lg shadow-md border border-slate-300 w-full max-w-sm font-mono text-[11px] leading-tight select-text"
              style={{
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.05))',
                minHeight: '260px'
              }}
            >
              {/* Store Header */}
              <div className="text-center space-y-0.5 pb-2">
                <h3 className="font-bold text-sm text-black tracking-tight uppercase">
                  {config.businessName}
                </h3>
                {config.receiptHeading && (
                  <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    {config.receiptHeading}
                  </p>
                )}
                <p className="text-[10px] text-slate-700">{config.businessAddress}</p>
                {config.businessPhone && (
                  <p className="text-[10px] text-slate-700">Tel: {config.businessPhone}</p>
                )}
              </div>

              <div className="border-t border-dashed border-black/40 my-2" />

              {/* Order Metadata */}
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Receipt No:</span>
                  <span className="font-bold">{receiptData.receiptNumber}</span>
                </div>
                {receiptData.orderNumber && receiptData.orderNumber !== receiptData.receiptNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Order ID:</span>
                    <span>{receiptData.orderNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Date/Time:</span>
                  <span>{formattedDate}</span>
                </div>
                {receiptData.cashierName && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cashier:</span>
                    <span>{receiptData.cashierName}</span>
                  </div>
                )}
                {config.showCustomer && (receiptData.customerName || receiptData.customerPhone) && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Customer:</span>
                    <span className="font-bold">
                      {[receiptData.customerName, receiptData.customerPhone].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-solid border-black/60 my-2" />

              {/* Item Table Header */}
              <div className="grid grid-cols-12 gap-1 font-bold text-[10px] pb-1 border-b border-dashed border-black/40">
                <span className="col-span-6">ITEM</span>
                <span className="col-span-2 text-right">QTY</span>
                <span className="col-span-2 text-right">PRICE</span>
                <span className="col-span-2 text-right">TOTAL</span>
              </div>

              {/* Item Rows */}
              <div className="py-1 space-y-1.5">
                {(receiptData.items || []).map((item, idx) => {
                  const qty = Number(item.quantity) || 1;
                  const price = Number(item.price) || 0;
                  const itemDiscount = Number(item.discount) || 0;
                  const lineTotal = (qty * price) - itemDiscount;
                  return (
                    <div key={idx} className="text-[10px]">
                      <div className="grid grid-cols-12 gap-1 items-start">
                        <span className="col-span-6 font-medium break-words leading-tight">
                          {item.description || 'Item'}
                        </span>
                        <span className="col-span-2 text-right">{qty}</span>
                        <span className="col-span-2 text-right">{price.toFixed(2)}</span>
                        <span className="col-span-2 text-right font-bold">{lineTotal.toFixed(2)}</span>
                      </div>
                      {itemDiscount > 0 && (
                        <div className="text-[9px] text-slate-600 pl-1">
                          (Disc: -{currency}{itemDiscount.toFixed(2)})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-solid border-black/60 my-2" />

              {/* Totals Section */}
              <div className="space-y-0.5 text-[10px]">
                {((receiptData.discount && receiptData.discount > 0) || 
                  (receiptData.tax && receiptData.tax > 0) || 
                  (receiptData.deliveryCharge && receiptData.deliveryCharge > 0)) && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal:</span>
                      <span>{currency}{receiptData.subtotal.toFixed(2)}</span>
                    </div>
                    {receiptData.discount && receiptData.discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Discount:</span>
                        <span>-{currency}{receiptData.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {receiptData.deliveryCharge && receiptData.deliveryCharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Delivery:</span>
                        <span>{currency}{receiptData.deliveryCharge.toFixed(2)}</span>
                      </div>
                    )}
                    {receiptData.tax && receiptData.tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">{receiptData.taxLabel || 'VAT / Tax'}:</span>
                        <span>{currency}{receiptData.tax.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}

                <div className="border-t border-double border-black my-1" />

                <div className="flex justify-between font-bold text-xs py-0.5">
                  <span>TOTAL:</span>
                  <span>{currency}{receiptData.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-solid border-black/60 my-2" />

              {/* Payment Details & Notes */}
              <div className="text-center space-y-1 text-[9.5px]">
                <p className="font-semibold uppercase">
                  Payment: {receiptData.paymentMethod || 'Cash'} [{receiptData.paymentStatus || 'PAID'}]
                </p>
                {receiptData.notes && (
                  <p className="italic text-slate-700">Note: {receiptData.notes}</p>
                )}
              </div>

              <div className="border-t border-dashed border-black/40 my-2" />

              {/* Footer */}
              <div className="text-center space-y-0.5 text-[9px] text-slate-700">
                <p>{config.footerMessage}</p>
                <p className="italic">Goods sold in good condition are not returnable.</p>
              </div>

              {/* Bottom Cut / Tear Guideline */}
              <div className="mt-3 pt-1 border-t border-dotted border-slate-300 text-center text-[8px] text-slate-400">
                --- XP-420B Physical Tear Bar ---
              </div>
            </div>
          </div>

          {/* Right Column: Workflow Actions & Administrator Layout Settings */}
          <div className={`lg:col-span-6 p-4 sm:p-5 lg:p-6 flex flex-col justify-between space-y-4 sm:space-y-5 overflow-y-auto ${
            mobileTab === 'actions' ? 'flex' : 'hidden lg:flex'
          }`}>
            
            {/* Action Buttons Section */}
            <div className="space-y-3.5">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Export to 4BarCode
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  4BarCode is the recommended Android utility for Xprinter thermal printers.
                </p>
              </div>

              {/* Primary Action: Import into 4BarCode */}
              <button
                type="button"
                onClick={handleImportInto4BarCode}
                disabled={isExporting || !lastGeneratedPdf}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 active:scale-[0.99]"
              >
                <Share2 className="w-4 h-4" />
                <span>Import into 4BarCode</span>
              </button>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadOnly}
                  disabled={!lastGeneratedPdf}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                  title="Directly download 80mm PDF file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  disabled={!lastGeneratedPdf}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                  title="Open PDF in new tab or trigger browser print"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </button>
              </div>

              {/* Export Status Notification */}
              {exportNotice && (
                <div 
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    exportNotice.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900'
                      : exportNotice.type === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900'
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-900'
                  }`}
                >
                  {exportNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <p>{exportNotice.message}</p>
                </div>
              )}

              {/* 4BarCode 3-Step Walkthrough Guide */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 space-y-1.5 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block">
                  Quick 4BarCode Instructions:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <li>
                    Tap <strong>Import into 4BarCode</strong> above (or select 4BarCode from Android share menu).
                  </li>
                  <li>
                    In the 4BarCode app, select <strong>PDF Print</strong> and choose this file.
                  </li>
                  <li>
                    The app recognizes the exact 80mm continuous width. Tap <strong>Print</strong> to feed smoothly to your XP-420B!
                  </li>
                </ol>
              </div>
            </div>

            {/* Administrator Layout Customization Toggle & Form */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Configure Receipt Layout & Heading</span>
                </div>
                {showConfigPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showConfigPanel && (
                <div className="mt-3.5 space-y-3 text-xs animate-fade-in">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={config.businessName}
                      onChange={e => updateConfig({ businessName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                        Address Line
                      </label>
                      <input
                        type="text"
                        value={config.businessAddress}
                        onChange={e => updateConfig({ businessAddress: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                        Phone Numbers
                      </label>
                      <input
                        type="text"
                        value={config.businessPhone}
                        onChange={e => updateConfig({ businessPhone: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      Receipt Heading
                    </label>
                    <input
                      type="text"
                      value={config.receiptHeading}
                      onChange={e => updateConfig({ receiptHeading: e.target.value })}
                      placeholder="e.g. OFFICIAL SALES RECEIPT"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  {/* Cedi Currency Symbol Print Mode Selector */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] flex items-center justify-between">
                      <span>Cedi Currency Print Format</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Fixes Missing/Broken Glyphs</span>
                    </label>
                    <select
                      value={config.currencyDisplayMode || 'GH¢'}
                      onChange={e => updateConfig({ currencyDisplayMode: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                    >
                      <option value="GH¢">GH¢ (Recommended: Sharp & Clear on Thermal XP-420B)</option>
                      <option value="GHS">GHS (Standard Banking ISO Code: 100% Universal)</option>
                      <option value="GH₵">GH₵ (Unicode Cedi Glyph)</option>
                    </select>
                    <p className="text-[10px] text-slate-500">
                      XP-420B and 4BarCode rasterize &ldquo;GH¢&rdquo; and &ldquo;GHS&rdquo; with 100% clean output without question marks.
                    </p>
                  </div>

                  {/* Font Scale & Margins */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                        Font Scale
                      </label>
                      <select
                        value={config.fontSizeScale}
                        onChange={e => updateConfig({ fontSizeScale: e.target.value as any })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      >
                        <option value="compact">Compact (More items/roll)</option>
                        <option value="standard">Standard (Recommended)</option>
                        <option value="relaxed">Relaxed (Large font)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                        Side Margins
                      </label>
                      <select
                        value={config.marginMm}
                        onChange={e => updateConfig({ marginMm: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      >
                        <option value={2}>2 mm (76mm printable)</option>
                        <option value={3}>3 mm (74mm printable - Recommended)</option>
                        <option value={4}>4 mm (72mm printable)</option>
                        <option value={5}>5 mm (70mm printable)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      Footer Message
                    </label>
                    <input
                      type="text"
                      value={config.footerMessage}
                      onChange={e => updateConfig({ footerMessage: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 text-[11px]">
                      <input
                        type="checkbox"
                        checked={config.showCustomer}
                        onChange={e => updateConfig({ showCustomer: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Include customer details</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleResetConfig}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Target: <strong>Xprinter XP-420B</strong> · Continuous 80mm Roll (203 DPI)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
