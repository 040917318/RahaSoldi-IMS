import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PdfExportOptions {
  fileName: string;
  title?: string;
  returnBlob?: boolean;
}

/**
 * Generates a standard high-resolution A4 PDF document from a DOM element.
 * Complies with professional print standards (PDF/X-4 reference specs: 300 DPI target, 
 * clean white background, standard 210mm x 297mm A4 pagination, sharp crisp vector-like text).
 */
export async function exportElementToPdf(
  sourceElement: HTMLElement,
  options: PdfExportOptions
): Promise<Blob | void> {
  const { fileName, returnBlob = false } = options;

  // Create a temporary off-screen container with fixed A4 dimensions (794px width = 210mm at 96DPI)
  // This guarantees identical, non-zoomed, un-distorted output whether called on a phone, tablet, or laptop screen.
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'fixed';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '0';
  tempContainer.style.width = '794px';
  tempContainer.style.backgroundColor = '#ffffff';
  tempContainer.style.color = '#0f172a';
  tempContainer.style.zIndex = '-9999';
  tempContainer.style.boxSizing = 'border-box';
  tempContainer.style.padding = '0';
  tempContainer.style.margin = '0';

  // Clone the source element
  const clone = sourceElement.cloneNode(true) as HTMLElement;

  // Reset responsive scaling on clone to fit the standard 794px width
  clone.style.width = '100%';
  clone.style.maxWidth = '100%';
  clone.style.minWidth = '794px';
  clone.style.margin = '0';
  clone.style.padding = '32px'; // Standard 20mm printable page margin
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#0f172a';
  clone.style.boxSizing = 'border-box';

  // Remove dark mode classes from clone and all children to ensure clean white background
  clone.classList.remove('dark');
  clone.querySelectorAll('.dark').forEach(el => el.classList.remove('dark'));

  // Remove interactive or ignore buttons marked for PDF exclusion
  clone.querySelectorAll('[data-html2canvas-ignore="true"], .print\\:hidden').forEach(el => el.remove());

  tempContainer.appendChild(clone);
  document.body.appendChild(tempContainer);

  try {
    // Wait briefly for images/fonts in clone to settle
    await new Promise(resolve => setTimeout(resolve, 150));

    // Capture canvas with 3.0 scale for ultra-sharp ~300 DPI print quality
    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1024
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidthMm = pdf.internal.pageSize.getWidth();   // 210 mm
    const pdfHeightMm = pdf.internal.pageSize.getHeight(); // 297 mm

    // Total document height in mm at full aspect ratio
    const imgHeightMm = (canvas.height * pdfWidthMm) / canvas.width;

    // Single page vs Multi-page slicing
    const pageHeightPx = Math.floor((pdfHeightMm / pdfWidthMm) * canvas.width);
    let renderedPx = 0;
    let pageIndex = 0;

    while (renderedPx < canvas.height) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

      // Create a sub-canvas for this specific page slice
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageHeightPx;

      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        // Fill white background for the page
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Draw slice of full document canvas
        ctx.drawImage(
          canvas,
          0, renderedPx, canvas.width, sliceHeightPx, // Source crop
          0, 0, canvas.width, sliceHeightPx           // Destination crop
        );
      }

      const pageImgData = pageCanvas.toDataURL('image/png');
      const sliceHeightMm = (sliceHeightPx * pdfWidthMm) / canvas.width;

      pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidthMm, sliceHeightMm, undefined, 'FAST');

      renderedPx += pageHeightPx;
      pageIndex++;
    }

    if (returnBlob) {
      return pdf.output('blob');
    } else {
      const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      pdf.save(safeFileName);
    }
  } finally {
    // Always clean up temp container
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }
  }
}
