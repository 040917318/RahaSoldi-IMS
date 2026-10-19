import { jsPDF } from 'jspdf';

export interface ThermalReceiptItem {
  description: string;
  quantity: number;
  price: number;
  discount?: number;
}

export interface Thermal80mmReceiptData {
  receiptNumber: string;
  orderNumber?: string;
  dateTime: string | Date;
  customerName?: string;
  customerPhone?: string;
  cashierName?: string;
  items: ThermalReceiptItem[];
  subtotal: number;
  discount?: number;
  deliveryCharge?: number;
  tax?: number;
  taxLabel?: string;
  grandTotal: number;
  paymentMethod?: string;
  paymentStatus?: 'paid' | 'pending' | 'deferred';
  notes?: string;
  currencySymbol?: string;
}

export interface Thermal80mmConfig {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  receiptHeading: string;
  fontSizeScale: 'compact' | 'standard' | 'relaxed';
  marginMm: number; // default 3mm -> 74mm printable area on 80mm roll
  currencyDisplayMode?: 'GH¢' | 'GHS' | 'GH₵';
  showCustomer: boolean;
  showLogo: boolean;
  footerMessage: string;
}

export const DEFAULT_THERMAL_CONFIG: Thermal80mmConfig = {
  businessName: 'RAHA SOLDI ENTERPRISE',
  businessAddress: 'Adabraka, Adjacent NDC HQ, Accra, Ghana',
  businessPhone: '0272326845 / 0277317589 / 0208338431',
  receiptHeading: 'OFFICIAL SALES RECEIPT',
  fontSizeScale: 'standard',
  marginMm: 3,
  currencyDisplayMode: 'GH¢',
  showCustomer: true,
  showLogo: false,
  footerMessage: 'Thank you for your patronage! Visit again.'
};

export interface GeneratedThermalPdf {
  blob: Blob;
  blobUrl: string;
  fileName: string;
  dimensions: {
    widthMm: number;
    heightMm: number;
  };
}

/**
 * Sanitizes and formats currency symbol for thermal printer PDF output.
 * Standard PDF Helvetica does not support Unicode U+01B5/U+20B5 (which causes '?' or broken glyphs).
 * 'GH¢' (Latin-1 \u00A2 code 162) or 'GHS' prints with 100% crystal-clear fidelity on 203 DPI thermal printers.
 */
export function formatThermalCurrency(
  rawSymbol?: string,
  mode: 'GH¢' | 'GHS' | 'GH₵' = 'GH¢'
): string {
  if (mode === 'GHS') return 'GHS ';
  if (mode === 'GH¢') return 'GH¢ ';
  // If user explicitly configured GH₵, sanitize so Unicode cedi doesn't produce '?' in Helvetica
  const clean = (rawSymbol || 'GH¢').replace(/[\u01B5\u20B5]/g, '¢');
  return clean.trim() + ' ';
}

/**
 * Generates an exact 80mm-wide continuous thermal receipt PDF specifically engineered
 * for import into 4BarCode and printing on the Xprinter XP-420B at 203 DPI.
 */
export function generate80mmThermalPdf(
  data: Thermal80mmReceiptData,
  userConfig?: Partial<Thermal80mmConfig>
): GeneratedThermalPdf {
  const config: Thermal80mmConfig = { ...DEFAULT_THERMAL_CONFIG, ...userConfig };

  const pageWidthMm = 80; // Exactly 80mm roll width
  const marginMm = Math.max(1.5, Math.min(6, config.marginMm));
  const printableWidthMm = pageWidthMm - (marginMm * 2);

  // Font scale multipliers
  const scale = config.fontSizeScale === 'compact' ? 0.9 : config.fontSizeScale === 'relaxed' ? 1.1 : 1.0;

  // Font sizes in points
  const titleFontSize = 12 * scale;
  const headingFontSize = 8.5 * scale;
  const regularFontSize = 8.0 * scale;
  const boldFontSize = 8.5 * scale;
  const smallFontSize = 7.0 * scale;
  const totalFontSize = 10.5 * scale;

  // Use thermal-safe currency formatting (GH¢ or GHS)
  const currency = formatThermalCurrency(data.currencySymbol, config.currencyDisplayMode || 'GH¢');

  // Format date
  const dateObj = data.dateTime instanceof Date ? data.dateTime : new Date(data.dateTime);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : String(data.dateTime);

  // Column layout math (in mm)
  // Left col: Item description ~42mm
  // Qty col: ~8mm (centered or right-aligned)
  // Price col: ~11mm (right-aligned)
  // Total col: ~13mm (right-aligned)
  const colDescWidth = printableWidthMm * 0.55;
  const colQtyWidth = printableWidthMm * 0.12;
  const colPriceWidth = printableWidthMm * 0.15;
  const colTotalWidth = printableWidthMm * 0.18;

  const colDescX = marginMm;
  const colQtyX = marginMm + colDescWidth + colQtyWidth;
  const colPriceX = colQtyX + colPriceWidth;
  const colTotalX = marginMm + printableWidthMm;

  // -------------------------------------------------------------
  // PASS 1: Dynamic Height Simulation
  // Measure exact vertical space needed to avoid any page overflow
  // -------------------------------------------------------------
  const dummyDoc = new jsPDF({ unit: 'mm', format: [pageWidthMm, 300] });
  dummyDoc.setFont('helvetica', 'normal');

  let simY = marginMm + 3; // Top padding

  if (config.showLogo) {
    simY += 12; // Space for logo icon / mark
  }

  // Business Name (wrapped if long)
  dummyDoc.setFontSize(titleFontSize);
  dummyDoc.setFont('helvetica', 'bold');
  const bNameLines = dummyDoc.splitTextToSize(config.businessName, printableWidthMm);
  simY += bNameLines.length * (titleFontSize * 0.42) + 2;

  // Heading badge/label
  if (config.receiptHeading) {
    simY += (headingFontSize * 0.45) + 2;
  }

  // Address and contact
  dummyDoc.setFontSize(smallFontSize);
  dummyDoc.setFont('helvetica', 'normal');
  const bAddrLines = dummyDoc.splitTextToSize(config.businessAddress, printableWidthMm);
  simY += bAddrLines.length * (smallFontSize * 0.4) + 1;

  if (config.businessPhone) {
    const bPhoneLines = dummyDoc.splitTextToSize(`Tel: ${config.businessPhone}`, printableWidthMm);
    simY += bPhoneLines.length * (smallFontSize * 0.4) + 1;
  }

  simY += 3; // Divider space

  // Metadata block (Receipt #, Order #, Date, Cashier, Customer)
  dummyDoc.setFontSize(regularFontSize);
  simY += (regularFontSize * 0.4) + 1.2; // Receipt #
  if (data.orderNumber && data.orderNumber !== data.receiptNumber) {
    simY += (regularFontSize * 0.4) + 1.2;
  }
  simY += (regularFontSize * 0.4) + 1.2; // Date

  if (data.cashierName) {
    simY += (regularFontSize * 0.4) + 1.2;
  }

  if (config.showCustomer && (data.customerName || data.customerPhone)) {
    const custStr = [data.customerName, data.customerPhone].filter(Boolean).join(' • ');
    const custLines = dummyDoc.splitTextToSize(`Customer: ${custStr}`, printableWidthMm);
    simY += custLines.length * (regularFontSize * 0.4) + 1.2;
  }

  simY += 3; // Divider space

  // Table Header
  simY += (boldFontSize * 0.4) + 3;

  // Items calculation with accurate word wrapping
  dummyDoc.setFontSize(regularFontSize);
  dummyDoc.setFont('helvetica', 'normal');

  for (const item of data.items) {
    const nameLines = dummyDoc.splitTextToSize(item.description || 'Item', colDescWidth);
    const itemHeight = Math.max(nameLines.length * (regularFontSize * 0.38), (regularFontSize * 0.4));
    simY += itemHeight + 1.5;

    if (item.discount && item.discount > 0) {
      simY += (smallFontSize * 0.38) + 1.0;
    }
  }

  simY += 2; // Divider space

  // Totals Section
  dummyDoc.setFontSize(regularFontSize);
  if (
    (data.discount && data.discount > 0) ||
    (data.tax && data.tax > 0) ||
    (data.deliveryCharge && data.deliveryCharge > 0)
  ) {
    simY += (regularFontSize * 0.4) + 1.5; // Subtotal

    if (data.discount && data.discount > 0) {
      simY += (regularFontSize * 0.4) + 1.5;
    }
    if (data.deliveryCharge && data.deliveryCharge > 0) {
      simY += (regularFontSize * 0.4) + 1.5;
    }
    if (data.tax && data.tax > 0) {
      simY += (regularFontSize * 0.4) + 1.5;
    }
  }

  // Grand Total line
  simY += (totalFontSize * 0.45) + 3;

  // Payment status & method
  if (data.paymentMethod || data.paymentStatus) {
    simY += 2;
    simY += (smallFontSize * 0.4) + 1.5;
  }

  if (data.notes) {
    dummyDoc.setFontSize(smallFontSize);
    const noteLines = dummyDoc.splitTextToSize(`Note: ${data.notes}`, printableWidthMm);
    simY += noteLines.length * (smallFontSize * 0.38) + 1.5;
  }

  // Footer message
  if (config.footerMessage) {
    simY += 3;
    dummyDoc.setFontSize(smallFontSize);
    const footLines = dummyDoc.splitTextToSize(config.footerMessage, printableWidthMm);
    simY += footLines.length * (smallFontSize * 0.38) + 2;
  }

  // Return policy
  simY += (smallFontSize * 0.35) + 2;

  // Tear buffer (ensures text clears the XP-420B physical cutter/tear bar)
  const tearBufferMm = 6.0;
  simY += tearBufferMm;

  const calculatedHeightMm = Math.max(65, Math.ceil(simY));

  // -------------------------------------------------------------
  // PASS 2: Real Document Construction with Exact Continuous Size
  // -------------------------------------------------------------
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidthMm, calculatedHeightMm]
  });

  // Enable high-contrast monochrome rendering
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);

  let curY = marginMm + 3;
  const centerX = pageWidthMm / 2;

  // Helper to draw clean divider
  const drawDivider = (yPos: number, dashed = false) => {
    if (dashed) {
      doc.setLineDashPattern([1.2, 0.8], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }
    doc.line(marginMm, yPos, marginMm + printableWidthMm, yPos);
    doc.setLineDashPattern([], 0); // reset
  };

  // 1. Business Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleFontSize);
  for (const line of bNameLines) {
    doc.text(line, centerX, curY, { align: 'center' });
    curY += titleFontSize * 0.42;
  }
  curY += 1.0;

  // Receipt Heading
  if (config.receiptHeading) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(headingFontSize);
    doc.text(config.receiptHeading, centerX, curY, { align: 'center' });
    curY += headingFontSize * 0.45 + 1.0;
  }

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(smallFontSize);
  for (const line of bAddrLines) {
    doc.text(line, centerX, curY, { align: 'center' });
    curY += smallFontSize * 0.4;
  }

  // Phone
  if (config.businessPhone) {
    doc.text(`Tel: ${config.businessPhone}`, centerX, curY, { align: 'center' });
    curY += smallFontSize * 0.4 + 1.0;
  }

  // Divider
  curY += 1.5;
  drawDivider(curY, true);
  curY += 3.0;

  // 2. Metadata Section
  doc.setFontSize(regularFontSize);
  doc.setFont('helvetica', 'normal');

  doc.text('Receipt No:', marginMm, curY);
  doc.setFont('helvetica', 'bold');
  doc.text(data.receiptNumber || 'N/A', marginMm + printableWidthMm, curY, { align: 'right' });
  curY += regularFontSize * 0.4 + 1.2;

  if (data.orderNumber && data.orderNumber !== data.receiptNumber) {
    doc.setFont('helvetica', 'normal');
    doc.text('Order ID:', marginMm, curY);
    doc.text(data.orderNumber, marginMm + printableWidthMm, curY, { align: 'right' });
    curY += regularFontSize * 0.4 + 1.2;
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Date & Time:', marginMm, curY);
  doc.text(formattedDate, marginMm + printableWidthMm, curY, { align: 'right' });
  curY += regularFontSize * 0.4 + 1.2;

  if (data.cashierName) {
    doc.text('Cashier:', marginMm, curY);
    doc.text(data.cashierName, marginMm + printableWidthMm, curY, { align: 'right' });
    curY += regularFontSize * 0.4 + 1.2;
  }

  if (config.showCustomer && (data.customerName || data.customerPhone)) {
    doc.text('Customer:', marginMm, curY);
    const custStr = [data.customerName, data.customerPhone].filter(Boolean).join(' • ');
    doc.setFont('helvetica', 'bold');
    doc.text(custStr, marginMm + printableWidthMm, curY, { align: 'right' });
    curY += regularFontSize * 0.4 + 1.2;
  }

  // Divider before items
  curY += 1.5;
  drawDivider(curY, false);
  curY += 3.0;

  // 3. Table Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(boldFontSize);
  doc.text('ITEM', colDescX, curY);
  doc.text('QTY', colQtyX, curY, { align: 'right' });
  doc.text('PRICE', colPriceX, curY, { align: 'right' });
  doc.text('TOTAL', colTotalX, curY, { align: 'right' });

  curY += 2.2;
  drawDivider(curY, true);
  curY += 3.0;

  // 4. Line Items
  doc.setFontSize(regularFontSize);

  for (const item of data.items) {
    doc.setFont('helvetica', 'normal');
    const nameLines = doc.splitTextToSize(item.description || 'Item', colDescWidth);
    const startLineY = curY;

    // First line of item description
    doc.text(nameLines[0] || '', colDescX, startLineY);

    // Qty, Unit Price, Line Total aligned with first line
    const itemQty = Number(item.quantity) || 1;
    const itemPrice = Number(item.price) || 0;
    const itemDisc = Number(item.discount) || 0;
    const itemTotal = (itemQty * itemPrice) - itemDisc;

    doc.text(String(itemQty), colQtyX, startLineY, { align: 'right' });
    doc.text(itemPrice.toFixed(2), colPriceX, startLineY, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(itemTotal.toFixed(2), colTotalX, startLineY, { align: 'right' });

    // Print wrapped description lines
    let nextY = startLineY + (regularFontSize * 0.38);
    for (let l = 1; l < nameLines.length; l++) {
      doc.setFont('helvetica', 'normal');
      doc.text(nameLines[l], colDescX, nextY);
      nextY += regularFontSize * 0.38;
    }

    if (itemDisc > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(smallFontSize);
      doc.text(`(Disc: -${currency}${itemDisc.toFixed(2)})`, colDescX + 2, nextY);
      nextY += smallFontSize * 0.38;
      doc.setFontSize(regularFontSize);
    }

    curY = Math.max(nextY, startLineY + 3.8);
  }

  // Divider after items
  curY += 1.5;
  drawDivider(curY, false);
  curY += 3.0;

  // 5. Financial Totals
  doc.setFontSize(regularFontSize);
  const totalsLabelX = colDescX + 12;

  if (
    (data.discount && data.discount > 0) ||
    (data.tax && data.tax > 0) ||
    (data.deliveryCharge && data.deliveryCharge > 0)
  ) {
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsLabelX, curY);
    doc.text(`${currency}${(Number(data.subtotal) || 0).toFixed(2)}`, colTotalX, curY, { align: 'right' });
    curY += regularFontSize * 0.4 + 1.2;

    if (data.discount && data.discount > 0) {
      doc.text('Discount:', totalsLabelX, curY);
      doc.text(`-${currency}${(Number(data.discount) || 0).toFixed(2)}`, colTotalX, curY, { align: 'right' });
      curY += regularFontSize * 0.4 + 1.2;
    }

    if (data.deliveryCharge && data.deliveryCharge > 0) {
      doc.text('Delivery Fee:', totalsLabelX, curY);
      doc.text(`${currency}${(Number(data.deliveryCharge) || 0).toFixed(2)}`, colTotalX, curY, { align: 'right' });
      curY += regularFontSize * 0.4 + 1.2;
    }

    if (data.tax && data.tax > 0) {
      doc.text(data.taxLabel || 'VAT / Tax:', totalsLabelX, curY);
      doc.text(`${currency}${(Number(data.tax) || 0).toFixed(2)}`, colTotalX, curY, { align: 'right' });
      curY += regularFontSize * 0.4 + 1.2;
    }
  }

  // Double line / bold divider for Grand Total
  curY += 1.0;
  drawDivider(curY, false);
  curY += 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(totalFontSize);
  doc.text('TOTAL:', totalsLabelX, curY);
  doc.text(`${currency}${(Number(data.grandTotal) || 0).toFixed(2)}`, colTotalX, curY, { align: 'right' });
  curY += totalFontSize * 0.45 + 2.0;

  drawDivider(curY, false);
  curY += 3.0;

  // 6. Payment & Notes
  doc.setFontSize(smallFontSize);
  doc.setFont('helvetica', 'normal');

  const pMethod = data.paymentMethod || 'Cash';
  const pStatus = (data.paymentStatus || 'paid').toUpperCase();
  doc.text(`Payment: ${pMethod} [${pStatus}]`, centerX, curY, { align: 'center' });
  curY += smallFontSize * 0.4 + 1.5;

  if (data.notes) {
    const noteLines = doc.splitTextToSize(`Note: ${data.notes}`, printableWidthMm);
    for (const nl of noteLines) {
      doc.text(nl, centerX, curY, { align: 'center' });
      curY += smallFontSize * 0.38;
    }
    curY += 1.0;
  }

  // 7. Footer & Return policy
  curY += 1.5;
  drawDivider(curY, true);
  curY += 3.0;

  if (config.footerMessage) {
    doc.setFont('helvetica', 'normal');
    doc.text(config.footerMessage, centerX, curY, { align: 'center' });
    curY += smallFontSize * 0.38 + 1.5;
  }

  doc.setFont('helvetica', 'italic');
  doc.text('Goods sold in good condition are not returnable.', centerX, curY, { align: 'center' });
  curY += smallFontSize * 0.35 + 2;

  // Safe file naming
  const safeNum = (data.receiptNumber || 'RECEIPT').replace(/[/\\?%*:|"<>]/g, '_');
  const fileName = `Receipt_${safeNum}_80mm.pdf`;

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  return {
    blob,
    blobUrl,
    fileName,
    dimensions: {
      widthMm: pageWidthMm,
      heightMm: calculatedHeightMm
    }
  };
}
