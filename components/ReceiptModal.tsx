import React, { useRef } from 'react';
import { SaleRecord } from '../types';
import { X, Printer, MessageCircle } from 'lucide-react';

interface ReceiptModalProps {
  sale: SaleRecord;
  currencySymbol: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, currencySymbol, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=600,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${sale.id.slice(-8)}</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; }
            .text-center { text-align: center; }
            .mb-4 { margin-bottom: 1rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-8 { margin-top: 2rem; }
            .pb-4 { padding-bottom: 1rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .pr-2 { padding-right: 0.5rem; }
            .border-b { border-bottom: 1px solid #ccc; }
            .border-t { border-top: 1px solid #ccc; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .w-full { width: 100%; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .text-xl { font-size: 1.25rem; }
            .text-base { font-size: 1rem; }
            .text-xs { font-size: 0.75rem; }
            .uppercase { text-transform: uppercase; }
            .tracking-wider { letter-spacing: 0.05em; }
            table { border-collapse: collapse; }
            th, td { border-bottom: 1px solid #eee; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleWhatsAppShare = () => {
    let text = `*Raha Soldi Ent. - Receipt*\n`;
    text += `Date: ${new Date(sale.timestamp).toLocaleString()}\n`;
    text += `Receipt ID: ${sale.id.slice(-8)}\n\n`;
    text += `*Items:*\n`;
    
    sale.items.forEach(item => {
      const itemTotal = (item.quantity * item.priceAtSale) - (item.discount || 0);
      text += `- ${item.name} x${item.quantity}: ${currencySymbol}${itemTotal.toFixed(2)}\n`;
    });
    
    text += `\n*Total: ${currencySymbol}${sale.totalAmount.toFixed(2)}*\n`;
    text += `\nThank you for your business!`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
            Receipt
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {/* Printable Area */}
          <div ref={receiptRef} className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 font-mono">
            <div className="text-center mb-4 border-b border-slate-300 dark:border-slate-600 pb-4">
              <h2 className="text-xl font-bold uppercase tracking-wider">Raha Soldi Ent.</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sales Receipt</p>
            </div>
            
            <div className="mb-4 text-xs">
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(sale.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Receipt #:</span>
                <span>{sale.id.slice(-8).toUpperCase()}</span>
              </div>
            </div>
            
            <div className="border-t border-b border-slate-300 dark:border-slate-600 py-2 mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-1">Item</th>
                    <th className="text-right py-1">Qty</th>
                    <th className="text-right py-1">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, idx) => {
                    const itemTotal = (item.quantity * item.priceAtSale) - (item.discount || 0);
                    return (
                      <tr key={idx}>
                        <td className="py-1 pr-2">{item.name}</td>
                        <td className="text-right py-1">{item.quantity}</td>
                        <td className="text-right py-1">{currencySymbol}{itemTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span>{currencySymbol}{sale.totalAmount.toFixed(2)}</span>
            </div>
            
            <div className="text-center mt-8 text-xs text-slate-500 dark:text-slate-400">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex flex-col sm:flex-row gap-3 shrink-0 border-t border-slate-100 dark:border-slate-700/50">
          <button 
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print PDF
          </button>
          <button 
            onClick={handleWhatsAppShare}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#128C7E] font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};
