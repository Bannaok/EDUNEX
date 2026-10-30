import { domToCanvas } from 'modern-screenshot';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { sanitizeOklchForHtml2Canvas } from '../components/StudentCardBatchModal';

export interface ExportPdfOptions {
  container: HTMLElement | null;
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Captures all A4 preview sheet elements (.a4-portrait-paper, .a4-landscape-paper, .a4-pp6-page)
 * inside `container` at ultra-high DPI and saves them directly as a multi-page A4 PDF file.
 * - Matches the on-screen preview 100%
 * - Automatically strips out the dashed page-end indicator (.a4-page-limit-line)
 * - Uses lossless high-DPI rendering so Thai text and table borders are razor-sharp
 */
export const exportSheetsToPdf = async ({
  container,
  filename,
  orientation = 'portrait',
}: ExportPdfOptions): Promise<boolean> => {
  if (!container) return false;

  const sheets = Array.from(
    container.querySelectorAll<HTMLElement>(
      '.a4-portrait-paper, .a4-landscape-paper, .a4-pp6-page'
    )
  );

  if (sheets.length === 0) return false;

  // Ensure web fonts (Sarabun, etc.) are completely ready
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  // Wait for any images inside the sheets to finish loading
  const allImgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    allImgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );

  // High-DPI scale factor (384 DPI for 1-3 sheets, 320 DPI for 4+ sheets)
  const scale = sheets.length > 3 ? 3.3 : 4;

  const firstSheetLandscape =
    sheets[0].classList.contains('a4-landscape-paper') || orientation === 'landscape';

  const pdf = new jsPDF({
    orientation: firstSheetLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const isLandscape =
      sheet.classList.contains('a4-landscape-paper') ||
      (!sheet.classList.contains('a4-portrait-paper') &&
        !sheet.classList.contains('a4-pp6-page') &&
        orientation === 'landscape');

    const pageW = isLandscape ? 297 : 210;
    const pageH = isLandscape ? 210 : 297;
    const targetCssWidth = isLandscape ? '297mm' : '210mm';

    if (i > 0) {
      pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }

    // 1. Temporarily hide all page-limit indicator lines and .no-print elements inside this sheet
    const ignoredElements = Array.from(
      sheet.querySelectorAll<HTMLElement>('.a4-page-limit-line, .no-print, [data-pdf-ignore="true"]')
    );
    const savedDisplays = ignoredElements.map((el) => ({
      el,
      display: el.style.display,
    }));
    for (const item of savedDisplays) {
      item.el.style.display = 'none';
    }

    // 2. Temporarily ensure scrollable table wrappers don't clip or show scrollbars
    const scrollWrappers = Array.from(
      sheet.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-auto')
    );
    const savedOverflows = scrollWrappers.map((el) => ({
      el,
      overflow: el.style.overflow,
      overflowX: el.style.overflowX,
    }));
    for (const item of savedOverflows) {
      item.el.style.overflow = 'visible';
      item.el.style.overflowX = 'visible';
    }

    // 3. Save and clean outer sheet decoration so PDF page has clean white edges
    const origShadow = sheet.style.boxShadow;
    const origBorder = sheet.style.border;
    const origRadius = sheet.style.borderRadius;
    const origMargin = sheet.style.margin;
    const origWidth = sheet.style.width;
    const origMaxWidth = sheet.style.maxWidth;
    const origMinWidth = sheet.style.minWidth;
    const origMinHeight = sheet.style.minHeight;

    sheet.style.boxShadow = 'none';
    sheet.style.border = 'none';
    sheet.style.borderRadius = '0';
    sheet.style.margin = '0';
    sheet.style.width = targetCssWidth;
    sheet.style.maxWidth = targetCssWidth;
    sheet.style.minWidth = targetCssWidth;
    if (!sheet.classList.contains('justify-between')) {
      sheet.style.minHeight = 'auto';
    }

    let canvas: HTMLCanvasElement;
    try {
      try {
        canvas = await domToCanvas(sheet, {
          scale,
          backgroundColor: '#ffffff',
          style: {
            boxShadow: 'none',
            border: 'none',
            borderRadius: '0',
            margin: '0',
            transform: 'none',
          },
          filter: (node) => {
            if (
              node instanceof HTMLElement &&
              (node.classList.contains('a4-page-limit-line') ||
                node.classList.contains('no-print') ||
                node.getAttribute('data-pdf-ignore') === 'true')
            ) {
              return false;
            }
            return true;
          },
        });
      } catch (err) {
        console.warn('domToCanvas fallback to html2canvas:', err);
        canvas = await html2canvas(sheet, {
          scale: Math.min(scale, 3),
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          ignoreElements: (el) =>
            Boolean(
              el.classList &&
                (el.classList.contains('a4-page-limit-line') ||
                  el.classList.contains('no-print') ||
                  el.getAttribute?.('data-pdf-ignore') === 'true')
            ),
          onclone: (clonedDoc) => sanitizeOklchForHtml2Canvas(clonedDoc),
        });
      }
    } finally {
      // Restore all original DOM styles
      sheet.style.boxShadow = origShadow;
      sheet.style.border = origBorder;
      sheet.style.borderRadius = origRadius;
      sheet.style.margin = origMargin;
      sheet.style.width = origWidth;
      sheet.style.maxWidth = origMaxWidth;
      sheet.style.minWidth = origMinWidth;
      sheet.style.minHeight = origMinHeight;

      for (const item of savedOverflows) {
        item.el.style.overflow = item.overflow;
        item.el.style.overflowX = item.overflowX;
      }

      for (const item of savedDisplays) {
        item.el.style.display = item.display;
      }
    }

    const imgData = canvas.toDataURL('image/png');
    const naturalHeightMm = (canvas.height / canvas.width) * pageW;

    if (naturalHeightMm <= pageH + 1.5) {
      // 1:1 exact match with preview width & aspect ratio
      pdf.addImage(
        imgData,
        'PNG',
        0,
        0,
        pageW,
        Math.min(naturalHeightMm, pageH),
        undefined,
        'FAST'
      );
    } else {
      // Uniformly fit within A4 height while preserving 100% exact aspect ratio
      const ratio = pageH / naturalHeightMm;
      const drawW = pageW * ratio;
      const drawH = pageH;
      const drawX = (pageW - drawW) / 2;
      pdf.addImage(imgData, 'PNG', drawX, 0, drawW, drawH, undefined, 'FAST');
    }
  }

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  pdf.save(cleanFilename);
  return true;
};
