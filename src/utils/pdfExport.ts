import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface ExportPdfOptions {
  container: HTMLElement | null;
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

const colorCache = new Map<string, string>();
let helperCtx: CanvasRenderingContext2D | null = null;

const getColorContext = (): CanvasRenderingContext2D | null => {
  if (helperCtx) return helperCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  helperCtx = canvas.getContext('2d', { willReadFrequently: true });
  return helperCtx;
};

/**
 * Converts any CSS Color 4/5 expression (oklch, oklab, lab, lch, color-mix, color)
 * into standard rgb()/rgba() using a cached 1x1 canvas pixel lookup.
 * Always returns a valid rgb()/rgba() string so html2canvas never throws on unsupported color functions.
 */
const singleColorToRgb = (cssColor: string): string => {
  const trimmed = cssColor.trim();
  if (!trimmed) return 'rgba(0, 0, 0, 0)';
  const cached = colorCache.get(trimmed);
  if (cached) return cached;

  const ctx = getColorContext();
  if (!ctx) return 'rgb(0, 0, 0)';

  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = trimmed;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const result =
      a === 0
        ? 'rgba(0, 0, 0, 0)'
        : a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
    colorCache.set(trimmed, result);
    return result;
  } catch {
    return 'rgba(0, 0, 0, 0)';
  }
};

/**
 * Resolves all `var(--...)` tokens (including nested fallbacks) using rootComputed.
 */
const resolveCssVariables = (
  expr: string,
  rootComputed: CSSStyleDeclaration | null
): string => {
  if (!expr.includes('var(') || !rootComputed) return expr;
  let current = expr;
  for (let pass = 0; pass < 4; pass++) {
    if (!current.includes('var(')) break;
    const next = current.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]+))?\)/g,
      (_full, varName, fallback) => {
        const val = rootComputed.getPropertyValue(varName).trim();
        if (val) return val;
        return fallback !== undefined ? fallback.trim() : 'transparent';
      }
    );
    if (next === current) break;
    current = next;
  }
  return current;
};

/**
 * Replaces all balanced-parenthesis occurrences of unsupported CSS Color 4/5 functions
 * (color-mix, oklch, oklab, lch, lab, color) with standard rgb()/rgba().
 */
export const sanitizeCssStringFast = (
  cssText: string,
  rootComputed: CSSStyleDeclaration | null
): string => {
  if (!cssText) return cssText;
  let out = cssText;

  // Strip CSS Color 4 gradient interpolation color-space tokens (e.g. `linear-gradient(in oklab, ...)`)
  if (out.includes('in ')) {
    out = out.replace(
      /\bin\s+(?:oklab|oklch|srgb-linear|srgb|hsl|hwb|lab|lch|xyz|xyz-d50|xyz-d65)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\s*,/gi,
      'to bottom,'
    );
    out = out.replace(
      /\s*\bin\s+(?:oklab|oklch|srgb-linear|srgb|hsl|hwb|lab|lch|xyz|xyz-d50|xyz-d65)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\b/gi,
      ''
    );
  }

  const fnRegex = /\b(?:color-mix|oklch|oklab|lch|lab|color)\(/gi;
  if (!fnRegex.test(out)) {
    return out;
  }

  fnRegex.lastIndex = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(out)) !== null) {
    const startIdx = match.index;
    if (startIdx < lastIndex) continue;

    result += out.slice(lastIndex, startIdx);

    const openParenIdx = startIdx + match[0].length - 1;
    let depth = 1;
    let i = openParenIdx + 1;
    while (i < out.length && depth > 0) {
      const ch = out.charCodeAt(i);
      if (ch === 40) depth++; // '('
      else if (ch === 41) depth--; // ')'
      i++;
    }

    const fullCall = out.slice(startIdx, i);
    const withVarsResolved = resolveCssVariables(fullCall, rootComputed);
    // Convert any inner oklch/oklab calls first if this is a color-mix(...)
    const innerCleaned = withVarsResolved.replace(
      /\b(?:oklch|oklab|lch|lab|color)\([^()]+\)/gi,
      (innerMatch) => singleColorToRgb(innerMatch)
    );
    result += singleColorToRgb(innerCleaned);

    lastIndex = i;
    fnRegex.lastIndex = i;
  }

  result += out.slice(lastIndex);
  return result;
};

/**
 * Collects all active CSS rules from both <style> tags and <link rel="stylesheet">
 * sheets (supporting both Vite dev mode and Vite production builds) and sanitizes
 * all CSS Color 4/5 expressions once.
 */
const buildSanitizedDocumentCss = (): string => {
  const rootComputed = window.getComputedStyle(document.documentElement);
  const chunks: string[] = [];

  const sheets = Array.from(document.styleSheets);
  for (const sheet of sheets) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      const ruleTexts: string[] = [];
      for (let i = 0; i < rules.length; i++) {
        ruleTexts.push(rules[i].cssText);
      }
      chunks.push(sanitizeCssStringFast(ruleTexts.join('\n'), rootComputed));
    } catch {
      // Cross-origin stylesheet (e.g. Google Fonts CSS) — handled via <link> in head
      const owner = sheet.ownerNode as HTMLElement | null;
      if (owner && owner.tagName === 'STYLE' && owner.textContent) {
        chunks.push(sanitizeCssStringFast(owner.textContent, rootComputed));
      }
    }
  }

  // Fallback if document.styleSheets was empty
  if (chunks.length === 0) {
    const styleTags = Array.from(document.querySelectorAll('style'));
    for (const tag of styleTags) {
      if (tag.textContent) {
        chunks.push(sanitizeCssStringFast(tag.textContent, rootComputed));
      }
    }
  }

  // Add PDF rendering stabilization rules so Thai words and table borders render 100% sharply
  chunks.push(`
    * {
      letter-spacing: 0px !important;
      transition: none !important;
      animation: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Critical fix for html2canvas FontMetrics: Tailwind Preflight sets img { display: block },
       which pushes html2canvas's 1x1 baseline probe <img> onto a new line and shifts all text down! */
    div[style*="visibility: hidden"],
    div[style*="visibility:hidden"] {
      line-height: normal !important;
    }
    div[style*="visibility: hidden"] > img,
    div[style*="visibility:hidden"] > img,
    body > div > span + img,
    img:not([class]),
    img[width="1"][height="1"] {
      display: inline !important;
      vertical-align: baseline !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .a4-portrait-paper, .a4-landscape-paper, .a4-pp6-page {
      box-sizing: border-box !important;
      padding-left: 20mm !important;
      font-family: 'Sarabun', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
      font-variant-numeric: tabular-nums !important;
      font-feature-settings: "tnum" 1, "zero" 0 !important;
    }
    .a4-portrait-paper *,
    .a4-landscape-paper *,
    .a4-pp6-page *,
    .font-mono,
    .tabular-nums {
      font-family: 'Sarabun', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
      font-variant-numeric: tabular-nums !important;
      font-feature-settings: "tnum" 1, "zero" 0 !important;
    }
    .a4-portrait-paper th,
    .a4-portrait-paper td,
    .a4-landscape-paper th,
    .a4-landscape-paper td,
    .a4-pp6-page th,
    .a4-pp6-page td {
      vertical-align: middle !important;
      overflow: visible !important;
    }
    .a4-portrait-paper .truncate,
    .a4-landscape-paper .truncate,
    .a4-pp6-page .truncate {
      overflow: visible !important;
      text-overflow: clip !important;
    }
    .a4-page-limit-line, .no-print, [data-pdf-ignore="true"] {
      display: none !important;
    }
  `);

  return chunks.join('\n');
};

/**
 * Pre-converts already-loaded <img> elements inside the preview sheets into inline data URLs
 * so html2canvas never waits on network image fetches or CORS checks inside the clone iframe.
 */
const buildLoadedImageCache = (sheets: HTMLElement[]): Map<string, string> => {
  const cache = new Map<string, string>();
  for (const sheet of sheets) {
    const imgs = Array.from(sheet.querySelectorAll<HTMLImageElement>('img'));
    for (const img of imgs) {
      const src = img.currentSrc || img.src;
      if (!src || cache.has(src)) continue;
      if (src.startsWith('data:')) {
        cache.set(src, src);
        continue;
      }
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            cache.set(src, c.toDataURL('image/png'));
          }
        } catch {
          // Cross-origin image without CORS; leave original src
        }
      }
    }
  }
  return cache;
};

/**
 * Encodes an HTMLCanvasElement to ultra-high-quality JPEG (quality = 0.98, 4:4:4 chroma)
 * asynchronously in the browser's native C++ background thread.
 * jsPDF embeds JPEG Uint8Arrays directly into the PDF stream (/DCTDecode) in <0.5ms
 * with zero main-thread JS pixel loops.
 */
const canvasToHighResJpegBytes = async (
  canvas: HTMLCanvasElement
): Promise<Uint8Array | string> => {
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.98)
    );
    if (blob) {
      const buffer = await blob.arrayBuffer();
      return new Uint8Array(buffer);
    }
  } catch {
    // fallback below
  }
  return canvas.toDataURL('image/jpeg', 0.98);
};

/**
 * Captures all A4 preview sheet elements (.a4-portrait-paper, .a4-landscape-paper, .a4-pp6-page)
 * inside `container` and saves them directly as a multi-page A4 PDF file.
 * - Zero live-DOM mutation: the visible preview on screen never moves, shifts, or flickers.
 * - Uses integer 3x scaling (288 DPI) + native C++ 0.98 JPEG encoding + direct /DCTDecode PDF embedding
 *   for instant, non-blocking execution and razor-sharp Thai text & table borders.
 * - Automatically strips .a4-page-limit-line from the downloaded PDF.
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

  // Yield 1 frame so React immediately renders the loading spinner on the download button
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 16))
  );

  // Ensure web fonts are ready (strict 400ms max wait)
  if (document.fonts && document.fonts.ready) {
    await Promise.race([
      document.fonts.ready.catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, 400)),
    ]);
  }

  // Pre-build sanitized CSS and inline image cache ONCE before iterating pages
  const combinedSanitizedCss = buildSanitizedDocumentCss();
  const imageCache = buildLoadedImageCache(sheets);

  // Strict integer 3x scale (288 DPI: 2382 x 3369 px per A4 page)
  // Aligns 1px borders to exact 3px integer boundaries with zero sub-pixel blur
  const scale = 3;

  const firstSheetLandscape =
    sheets[0].classList.contains('a4-landscape-paper') || orientation === 'landscape';

  const pdf = new jsPDF({
    orientation: firstSheetLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < sheets.length; i++) {
    const origSheet = sheets[i];

    // Yield between pages so the browser UI & spinner remain 100% responsive
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 16));
    }

    const isLandscape =
      origSheet.classList.contains('a4-landscape-paper') ||
      (!origSheet.classList.contains('a4-portrait-paper') &&
        !origSheet.classList.contains('a4-pp6-page') &&
        orientation === 'landscape');

    const pageW = isLandscape ? 297 : 210;
    const pageH = isLandscape ? 210 : 297;

    if (i > 0) {
      pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }

    // Read live dimensions and textarea values WITHOUT mutating the live DOM
    const liveRect = origSheet.getBoundingClientRect();
    const exactWidthPx = Math.round(liveRect.width) || (isLandscape ? 1123 : 794);
    const liveTextareaValues = Array.from(origSheet.querySelectorAll('textarea')).map(
      (ta) => ({
        value: ta.value,
        placeholder: ta.getAttribute('placeholder') || '',
      })
    );

    // Build O(1) ancestor set so html2canvas skips all sibling pages and background UI
    const ancestors = new Set<Element>();
    let curr: Element | null = origSheet.parentElement;
    while (curr) {
      ancestors.add(curr);
      curr = curr.parentElement;
    }

    const canvas = await html2canvas(origSheet, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 1000,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(1280, exactWidthPx + 80),
      ignoreElements: (el) => {
        const tag = el.tagName;
        if (tag === 'HEAD' || tag === 'STYLE') return false;
        if (tag === 'LINK') {
          const rel = (el as HTMLLinkElement).rel || '';
          const href = (el as HTMLLinkElement).href || '';
          // Keep only Google Fonts stylesheet link; local CSS is injected via combinedSanitizedCss
          return !(rel === 'stylesheet' && href.includes('fonts.googleapis.com'));
        }
        if (
          el.classList?.contains('a4-page-limit-line') ||
          el.classList?.contains('no-print') ||
          el.getAttribute('data-pdf-ignore') === 'true'
        ) {
          return true;
        }
        if (el !== origSheet && !ancestors.has(el) && !origSheet.contains(el)) {
          return true;
        }
        return false;
      },
      onclone: (clonedDoc, clonedSheet) => {
        // 1. Replace all styles in clonedDoc with the pre-sanitized CSS bundle
        const oldStyles = Array.from(
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]:not([href*="fonts.googleapis.com"])')
        );
        for (const s of oldStyles) {
          s.remove();
        }
        const styleEl = clonedDoc.createElement('style');
        styleEl.textContent = combinedSanitizedCss;
        clonedDoc.head.appendChild(styleEl);

        // 2. Mount clonedSheet directly onto clonedDoc.body at (0, 0)
        // Eliminates all modal scroll containers, max-h-[96vh] ClipEffects, and scroll offsets
        clonedDoc.documentElement.style.cssText =
          'margin:0 !important;padding:0 !important;background:#ffffff !important;overflow:visible !important;';
        clonedDoc.body.style.cssText =
          'margin:0 !important;padding:0 !important;background:#ffffff !important;overflow:visible !important;';
        clonedDoc.body.replaceChildren(clonedSheet);

        // 3. Lock clonedSheet to the exact pixel width of the live preview sheet and 20mm (2cm) left padding
        clonedSheet.style.boxSizing = 'border-box';
        clonedSheet.style.margin = '0';
        clonedSheet.style.paddingLeft = '20mm';
        clonedSheet.style.boxShadow = 'none';
        clonedSheet.style.borderRadius = '0';
        clonedSheet.style.border = 'none';
        clonedSheet.style.width = `${exactWidthPx}px`;
        clonedSheet.style.maxWidth = `${exactWidthPx}px`;
        clonedSheet.style.minWidth = `${exactWidthPx}px`;
        if (!clonedSheet.classList.contains('justify-between')) {
          clonedSheet.style.minHeight = 'auto';
        }

        // 4. Remove any remaining page-limit lines or no-print elements inside clonedSheet
        const ignored = Array.from(
          clonedSheet.querySelectorAll(
            '.a4-page-limit-line, .no-print, [data-pdf-ignore="true"]'
          )
        );
        for (const node of ignored) {
          node.remove();
        }

        // 5. Ensure table wrappers and .truncate elements never clip text or top rows
        const scrollWrappers = Array.from(
          clonedSheet.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-auto')
        );
        for (const wrap of scrollWrappers) {
          wrap.style.overflow = 'visible';
          wrap.style.overflowX = 'visible';
          wrap.style.overflowY = 'visible';
          wrap.style.borderRadius = '0';
        }
        const truncatedEls = Array.from(
          clonedSheet.querySelectorAll<HTMLElement>('.truncate')
        );
        for (const el of truncatedEls) {
          el.style.overflow = 'visible';
          el.style.textOverflow = 'clip';
        }

        // Prevent html2canvas from painting <tr> backgrounds or borders across rowSpan cells
        const allRows = Array.from(clonedSheet.querySelectorAll<HTMLTableRowElement>('tr'));
        for (const tr of allRows) {
          const trComputed = clonedDoc.defaultView?.getComputedStyle(tr);
          const trBg = trComputed?.backgroundColor;
          const hasOpaqueTrBg =
            trBg && trBg !== 'rgba(0, 0, 0, 0)' && trBg !== 'transparent';
          if (hasOpaqueTrBg) {
            const cells = Array.from(tr.children) as HTMLElement[];
            for (const cell of cells) {
              const cellComputed = clonedDoc.defaultView?.getComputedStyle(cell);
              const cellBg = cellComputed?.backgroundColor;
              if (!cellBg || cellBg === 'rgba(0, 0, 0, 0)' || cellBg === 'transparent') {
                cell.style.backgroundColor = trBg;
              }
            }
            tr.style.backgroundColor = 'transparent';
          }
        }

        // Convert vertical rotated labels ([data-vertical-label], .-rotate-90) into crisp 4x DPI images
        // so html2canvas never scrambles rotated Thai text glyphs (e.g. วันเสาร์ / วันอาทิตย์)
        const verticalLabels = Array.from(
          clonedSheet.querySelectorAll<HTMLElement>('[data-vertical-label], .-rotate-90')
        );
        for (const vEl of verticalLabels) {
          const labelText = (vEl.getAttribute('data-vertical-label') || vEl.textContent || '').trim();
          if (!labelText) continue;

          const vComputed = clonedDoc.defaultView?.getComputedStyle(vEl);
          const fontSizePx = parseFloat(vComputed?.fontSize || '9') || 9;
          const fontColor = vComputed?.color || '#be123c';
          const fontWeight = vComputed?.fontWeight || '700';
          const dpr = 4;

          const vCanvas = document.createElement('canvas');
          const vCtx = vCanvas.getContext('2d');
          if (vCtx) {
            const fontSpec = `${fontWeight} ${fontSizePx * dpr}px 'Sarabun', 'Plus Jakarta Sans', sans-serif`;
            vCtx.font = fontSpec;
            const measuredWidth = Math.ceil(vCtx.measureText(labelText).width / dpr) + 6;
            const boxWidthPx = Math.max(14, Math.ceil(fontSizePx * 1.55));
            const boxHeightPx = Math.max(24, measuredWidth);

            vCanvas.width = boxWidthPx * dpr;
            vCanvas.height = boxHeightPx * dpr;

            vCtx.font = fontSpec;
            vCtx.fillStyle = fontColor;
            vCtx.textAlign = 'center';
            vCtx.textBaseline = 'middle';
            vCtx.translate(vCanvas.width / 2, vCanvas.height / 2);
            vCtx.rotate(-Math.PI / 2);
            vCtx.fillText(labelText, 0, 0);

            const vImg = clonedDoc.createElement('img');
            vImg.className = 'pdf-vertical-label-img';
            vImg.src = vCanvas.toDataURL('image/png');
            vImg.style.width = `${boxWidthPx}px`;
            vImg.style.height = `${boxHeightPx}px`;
            vImg.style.maxWidth = 'none';
            vImg.style.display = 'block';
            vImg.style.margin = '0 auto';
            vEl.replaceWith(vImg);
          }
        }

        // 6. Replace <textarea> elements in clonedSheet with clean multi-line <div> blocks
        const clonedTextareas = Array.from(clonedSheet.querySelectorAll('textarea'));
        for (let tIdx = 0; tIdx < clonedTextareas.length; tIdx++) {
          const ta = clonedTextareas[tIdx];
          const info = liveTextareaValues[tIdx];
          const div = clonedDoc.createElement('div');
          div.className = ta.className.replace(/\bprint:hidden\b/g, '');
          div.style.minHeight = '64px';
          div.style.whiteSpace = 'pre-wrap';
          div.style.wordBreak = 'break-word';
          if (info && info.value.trim()) {
            div.textContent = info.value;
          } else {
            div.textContent = '';
          }
          ta.replaceWith(div);
        }

        // 7. Swap <img> src with pre-cached data URLs for 0ms instant rendering
        const clonedImgs = Array.from(clonedSheet.querySelectorAll<HTMLImageElement>('img'));
        for (const img of clonedImgs) {
          const src = img.getAttribute('src') || img.src;
          const cached = imageCache.get(src) || imageCache.get(img.src);
          if (cached) {
            img.src = cached;
          }
        }
      },
    });

    const jpegData = await canvasToHighResJpegBytes(canvas);
    const naturalHeightMm = (canvas.height / canvas.width) * pageW;

    // Always place at x = 0 with full width = pageW so the 20mm (2cm) left margin is 100% exact
    pdf.addImage(
      jpegData as any,
      'JPEG',
      0,
      0,
      pageW,
      Math.min(naturalHeightMm, pageH),
      undefined,
      'FAST'
    );
  }

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  pdf.save(cleanFilename);
  return true;
};
