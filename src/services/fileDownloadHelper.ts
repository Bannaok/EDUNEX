/**
 * ระบบช่วยจัดการการดาวน์โหลดและตรวจสอบไฟล์ทุกประเภท (Universal File Downloader Helper)
 * รองรับไฟล์ Word (.docx, .doc), Excel (.xlsx, .xls), PowerPoint (.pptx), PDF, รูปภาพ และไฟล์อื่นๆ
 * แก้ปัญหาไฟล์ Word เสียหาย หรือดาวน์โหลดผิดประเภทได้อย่างสมบูรณ์แบบ
 */

export function extractDriveFileId(urlOrId?: string): string {
  if (!urlOrId || typeof urlOrId !== 'string') return '';
  const str = urlOrId.trim();
  if (str.startsWith('data:') || str.startsWith('blob:')) return '';

  const m1 = str.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m1 && m1[1]) return m1[1];

  const m2 = str.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m2 && m2[1]) return m2[1];

  const m3 = str.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m3 && m3[1]) return m3[1];

  const m4 = str.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{20,})/);
  if (m4 && m4[1]) return m4[1];

  if (/^[a-zA-Z0-9_-]{25,60}$/.test(str)) {
    return str;
  }
  return '';
}

export function getDriveDownloadUrl(urlOrId?: string): string {
  const fid = extractDriveFileId(urlOrId);
  if (fid) {
    return `https://drive.usercontent.google.com/download?id=${fid}&export=download&confirm=t`;
  }
  return urlOrId || '';
}

export function getFileExtension(fileName?: string): string {
  if (!fileName) return '';
  const match = fileName.trim().match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : '';
}

export function isWordFile(fileName?: string): boolean {
  const ext = getFileExtension(fileName);
  return ext === 'docx' || ext === 'doc';
}

export function isExcelFile(fileName?: string): boolean {
  const ext = getFileExtension(fileName);
  return ext === 'xlsx' || ext === 'xls' || ext === 'csv';
}

export function isPdfFile(fileName?: string): boolean {
  return getFileExtension(fileName) === 'pdf';
}

export function isImageFile(fileName?: string): boolean {
  const ext = getFileExtension(fileName);
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
}

export function getMimeTypeByExtension(fileName?: string, fallback: string = 'application/octet-stream'): string {
  const ext = getFileExtension(fileName);
  switch (ext) {
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'zip':
      return 'application/zip';
    case 'txt':
      return 'text/plain;charset=utf-8';
    default:
      return fallback;
  }
}

const DEFAULT_GAS_FALLBACK_URL =
  'https://script.google.com/macros/s/AKfycbzol007NNSB5uYI_no15j6GB5Ej3IQ2MuN50Sud7mQKMYloHBYxoxv6N8PVLgSfsNjlZw/exec';

function triggerBrowserBlobDownload(blob: Blob, fileName: string) {
  const correctMime = getMimeTypeByExtension(fileName, blob.type || 'application/octet-stream');
  const typedBlob = blob.type === correctMime ? blob : new Blob([blob], { type: correctMime });
  const blobUrl = URL.createObjectURL(typedBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

function detectFormatFromBytesClient(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (!bytes || bytes.length < 4) return null;
  // 1. PDF (%PDF-)
  const headLen = Math.min(bytes.length, 1024);
  let headStr = '';
  for (let i = 0; i < headLen; i++) headStr += String.fromCharCode(bytes[i]);
  if (headStr.includes('%PDF-')) {
    return { ext: 'pdf', mime: 'application/pdf' };
  }
  // 2. PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  // 3. JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // 4. GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  // 5. WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  // 6. ZIP / Office Open XML (.docx, .xlsx, .pptx, .zip)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    const scanLen = Math.min(bytes.length, 65536);
    let sample = '';
    for (let i = 0; i < scanLen; i++) sample += String.fromCharCode(bytes[i]);
    if (sample.includes('word/document.xml') || sample.includes('word/')) {
      return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    if (sample.includes('xl/workbook.xml') || sample.includes('xl/')) {
      return { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    if (sample.includes('ppt/presentation.xml') || sample.includes('ppt/')) {
      return { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
    }
    return { ext: 'zip', mime: 'application/zip' };
  }
  // 7. Legacy OLE2 Office (.doc, .xls, .ppt)
  if (bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return { ext: 'doc', mime: 'application/msword' };
  }
  // 8. RAR
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
    return { ext: 'rar', mime: 'application/vnd.rar' };
  }
  return null;
}

export async function resolveDriveIdByFileNameFromGas(
  fileName: string,
  schoolId?: string,
  taskId?: string,
  memberId?: string
): Promise<string> {
  if (!fileName && !taskId) return '';
  try {
    let targetSchoolId = schoolId || '';
    let spreadsheetId = '';
    if (typeof window !== 'undefined') {
      try {
        const rawSession = sessionStorage.getItem('ams_session');
        if (rawSession) {
          const sess = JSON.parse(rawSession);
          if (!targetSchoolId && sess?.schoolId) targetSchoolId = sess.schoolId;
        }
        const rawAdmins = localStorage.getItem('ams_school_admins');
        if (rawAdmins && targetSchoolId) {
          const admins = JSON.parse(rawAdmins);
          const matched = Array.isArray(admins) ? admins.find((a: any) => a && a.id === targetSchoolId) : null;
          if (matched?.googleSheetId) spreadsheetId = matched.googleSheetId;
        }
      } catch {
        // ignore storage read error
      }
    }

    const cleanTarget = (fileName || '').trim().toLowerCase();
    const targetExt = getFileExtension(cleanTarget);

    // 1. Check TaskSubmissions sheet first if taskId or memberId is known
    if (taskId || memberId || cleanTarget) {
      try {
        const qSub = new URLSearchParams({
          action: 'getSheet',
          sheet: 'TaskSubmissions',
          ...(spreadsheetId ? { spreadsheetId } : {}),
          ...(targetSchoolId ? { schoolId: targetSchoolId } : {}),
          _t: String(Date.now())
        });
        const resSub = await fetch(`${DEFAULT_GAS_FALLBACK_URL}?${qSub.toString()}`);
        if (resSub.ok) {
          const jsonSub = await resSub.json();
          if (jsonSub && jsonSub.status === 'success' && Array.isArray(jsonSub.data)) {
            for (let i = jsonSub.data.length - 1; i >= 0; i--) {
              const row = jsonSub.data[i];
              if (!row) continue;
              const matchTM =
                taskId &&
                memberId &&
                String(row.taskId || '') === taskId &&
                (String(row.memberId || '') === memberId || String(row.memberName || '') === memberId);
              const rowName = String(row.fileName || '').trim().toLowerCase();
              const rowExt = getFileExtension(rowName);
              const extCompatible = !targetExt || !rowExt || targetExt === rowExt;
              const matchName =
                cleanTarget &&
                extCompatible &&
                (rowName === cleanTarget || rowName.endsWith('_' + cleanTarget));
              if (matchTM || matchName) {
                const fid = extractDriveFileId(row.fileUrl || row.driveFileId);
                if (fid) return fid;
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Check DriveFiles sheet
    const q = new URLSearchParams({
      action: 'getSheet',
      sheet: 'DriveFiles',
      ...(spreadsheetId ? { spreadsheetId } : {}),
      ...(targetSchoolId ? { schoolId: targetSchoolId } : {}),
      _t: String(Date.now())
    });

    const res = await fetch(`${DEFAULT_GAS_FALLBACK_URL}?${q.toString()}`);
    if (!res.ok) return '';
    const json = await res.json();
    if (!json || json.status !== 'success' || !Array.isArray(json.data)) return '';

    for (let i = json.data.length - 1; i >= 0; i--) {
      const row = json.data[i];
      if (!row) continue;
      const rowName = String(row.fileName || '').trim().toLowerCase();
      const rowExt = getFileExtension(rowName);
      if (targetExt && rowExt && targetExt !== rowExt) continue;
      if (
        rowName === cleanTarget ||
        rowName.endsWith('_' + cleanTarget) ||
        (cleanTarget.length >= 5 && rowName.includes(cleanTarget))
      ) {
        const fid = String(row.driveFileId || '').trim() || extractDriveFileId(row.driveViewUrl || row.driveDownloadUrl);
        if (fid) return fid;
      }
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * สร้าง URL สำหรับแสดงผลตัวอย่างไฟล์จาก Google Drive โดยตรง (รูปภาพ / PDF / เอกสาร)
 */
export function getPreviewableFileUrl(urlOrData?: string, fileName?: string, schoolId?: string): string {
  const safeName = (fileName || 'file').trim();
  if (!urlOrData || urlOrData === '#') {
    if (fileName && fileName.trim()) {
      return `/api/files/download?url=&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}&inline=1`;
    }
    return '';
  }
  if (urlOrData.startsWith('data:') || urlOrData.startsWith('blob:')) {
    return urlOrData;
  }
  const driveId = extractDriveFileId(urlOrData);
  if (driveId) {
    const ext = getFileExtension(safeName);
    if (isImageFile(safeName) || (!ext && urlOrData.includes('lh3.googleusercontent.com'))) {
      return `https://lh3.googleusercontent.com/d/${driveId}`;
    }
    return `/api/files/download?id=${encodeURIComponent(driveId)}&url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}&inline=1`;
  }
  if (urlOrData.startsWith('/api/files/')) {
    return `/api/files/download?url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}&inline=1`;
  }
  return urlOrData;
}

function isValidDownloadedBinary(bytes: Uint8Array, fileName: string): boolean {
  if (!bytes || bytes.byteLength === 0) return false;
  const headSlice = bytes.subarray(0, Math.min(bytes.length, 256));
  let asciiHead = '';
  for (let i = 0; i < headSlice.length; i++) {
    asciiHead += String.fromCharCode(headSlice[i]);
  }
  const trimmedLower = asciiHead.trimStart().toLowerCase();
  if (
    trimmedLower.startsWith('<!doctype') ||
    trimmedLower.startsWith('<html') ||
    trimmedLower.startsWith('<head') ||
    trimmedLower.startsWith('<script') ||
    trimmedLower.startsWith('{"status":"error')
  ) {
    return false;
  }
  const ext = getFileExtension(fileName);
  // ป้องกันกรณี Google Drive lh3 ส่งรูป Thumbnail (PNG) กลับมาแทนไฟล์เอกสาร PDF / Word / Excel
  if (!isImageFile(fileName) && ext) {
    const isPngHeader = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (isPngHeader) {
      return false;
    }
  }
  if (ext === 'pdf') {
    const pdfLen = Math.min(bytes.length, 1024);
    let pdfHead = '';
    for (let i = 0; i < pdfLen; i++) pdfHead += String.fromCharCode(bytes[i]);
    if (!pdfHead.includes('%PDF-')) return false;
  }
  if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx' || ext === 'zip') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  }
  return true;
}

export function getDirectFileDownloadUrl(urlOrData?: string, fileName?: string, schoolId?: string): string {
  const safeName = (fileName || 'download').trim();
  if (!urlOrData || urlOrData === '#') {
    if (fileName && fileName.trim()) {
      return `/api/files/download?name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}`;
    }
    return '#';
  }
  if (urlOrData.startsWith('data:')) {
    return urlOrData;
  }
  const driveId = extractDriveFileId(urlOrData);
  if (driveId) {
    return `/api/files/download?id=${encodeURIComponent(driveId)}&url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}`;
  }
  if (urlOrData.startsWith('/api/files/')) {
    return `/api/files/download?url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}`;
  }
  if (urlOrData.startsWith('http')) {
    return `/api/files/download?url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}`;
  }
  return `/api/files/download?url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}`;
}

export function getGoogleDriveViewUrl(urlOrData?: string): string {
  const driveId = extractDriveFileId(urlOrData);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/view?usp=sharing`;
  }
  return urlOrData && urlOrData.startsWith('http') ? urlOrData : '';
}

async function fetchAndValidateDownloadStream(
  targetUrl: string,
  safeName: string,
  onProgress?: (percent: number) => void
): Promise<{ bytes: Uint8Array; resolvedName: string; mime: string } | null> {
  const res = await fetch(targetUrl);
  if (!res.ok) return null;
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  const ext = getFileExtension(safeName);
  if (contentType.includes('text/html') && ext !== 'html' && ext !== 'htm') {
    return null;
  }
  if (contentType.includes('application/json') && ext !== 'json') {
    return null;
  }

  let resolvedName = safeName;
  const headerResolved = res.headers.get('x-resolved-filename');
  if (headerResolved) {
    try {
      const decoded = decodeURIComponent(headerResolved);
      if (decoded && (!ext || safeName === 'download' || safeName === 'task-attachment' || safeName === 'announcement-attachment' || safeName === 'ไฟล์งานที่ส่ง')) {
        resolvedName = decoded;
      }
    } catch {
      // ignore
    }
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  let combined: Uint8Array;

  if (res.body && typeof ReadableStream !== 'undefined') {
    const reader = res.body.getReader();
    let receivedBytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        chunks.push(value);
        receivedBytes += value.byteLength;
        if (onProgress && contentLength > 0) {
          const pct = Math.min(98, Math.max(25, Math.round((receivedBytes / contentLength) * 100)));
          onProgress(pct);
        }
      }
    }
    combined = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.byteLength;
    }
  } else {
    if (onProgress) onProgress(65);
    const arrayBuf = await res.arrayBuffer();
    combined = new Uint8Array(arrayBuf);
  }

  if (combined.byteLength === 0) return null;

  const detected = detectFormatFromBytesClient(combined);
  if (!getFileExtension(resolvedName) && detected?.ext) {
    resolvedName = `${resolvedName}.${detected.ext}`;
  }

  if (!isValidDownloadedBinary(combined, resolvedName)) {
    return null;
  }

  const finalMime = getMimeTypeByExtension(resolvedName, detected?.mime || contentType || 'application/octet-stream');
  return { bytes: combined, resolvedName, mime: finalMime };
}

/**
 * ดาวน์โหลดไฟล์ต้นฉบับจริงจาก Google Drive (ได้ไฟล์ต้นฉบับแท้ 100% อยู่ในหน้าเดิม ไม่เปิดแท็บใหม่ และแสดงสถานะตามจริง)
 */
export async function downloadRealFile(
  urlOrData?: string,
  fileName?: string,
  defaultExt?: string,
  schoolId?: string,
  onProgress?: (percent: number) => void,
  taskId?: string,
  memberId?: string
): Promise<boolean> {
  const cleanUrl = !urlOrData || urlOrData === '#' ? '' : urlOrData.trim();
  if (!cleanUrl && (!fileName || !fileName.trim()) && (!taskId || !memberId)) {
    return false;
  }

  let safeName = (fileName || 'download').trim();
  const currentExt = getFileExtension(safeName);

  if (!currentExt && defaultExt) {
    safeName = `${safeName}.${defaultExt.replace(/^\./, '')}`;
  }

  if (onProgress) onProgress(10);

  // 1. กรณีเป็น Base64 Data URL หรือ Raw Base64 (กรณีเพิ่งเลือกไฟล์ในเครื่องก่อนบันทึก)
  if (cleanUrl && (cleanUrl.startsWith('data:') || (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('/')))) {
    const possibleDriveId = extractDriveFileId(cleanUrl);
    if (!possibleDriveId) {
      try {
        let base64String = cleanUrl;
        let detectedMime = '';

        if (cleanUrl.startsWith('data:')) {
          const parts = cleanUrl.split(';base64,');
          detectedMime = parts[0].replace('data:', '').split(';')[0] || '';
          base64String = parts[1] || '';
        }

        const cleanBase64 = base64String.replace(/\s+/g, '');
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const detectedFmt = detectFormatFromBytesClient(byteNumbers);
        if (!getFileExtension(safeName) && detectedFmt?.ext) {
          safeName = `${safeName}.${detectedFmt.ext}`;
        }

        const finalMime = getMimeTypeByExtension(safeName, detectedFmt?.mime || detectedMime || 'application/octet-stream');
        const blob = new Blob([byteNumbers], { type: finalMime });
        if (onProgress) onProgress(100);
        triggerBrowserBlobDownload(blob, safeName);
        return true;
      } catch (err) {
        console.error('Failed to parse base64 blob:', err);
      }
    }
  }

  // 2. ดึงไฟล์ต้นฉบับแท้ผ่าน Proxy Server Stream ภายในหน้าเดิม พร้อมตรวจสอบ Magic Bytes 100%
  const driveId = extractDriveFileId(cleanUrl);
  const queryParams = new URLSearchParams();
  if (driveId) queryParams.set('id', driveId);
  if (cleanUrl) queryParams.set('url', cleanUrl);
  queryParams.set('name', safeName);
  if (schoolId) queryParams.set('schoolId', schoolId);
  if (taskId) queryParams.set('taskId', taskId);
  if (memberId) queryParams.set('memberId', memberId);

  const targetDownloadUrl = `/api/files/download?${queryParams.toString()}`;

  try {
    if (onProgress) onProgress(25);
    const validated = await fetchAndValidateDownloadStream(targetDownloadUrl, safeName, onProgress);
    if (validated) {
      const blob = new Blob([validated.bytes as unknown as BlobPart], { type: validated.mime });
      if (onProgress) onProgress(100);
      triggerBrowserBlobDownload(blob, validated.resolvedName);
      return true;
    }
  } catch (fetchErr) {
    console.warn('Primary proxy stream fetch failed:', fetchErr);
  }

  // 3. หากยังไม่พบ Drive ID หรือดึงไม่สำเร็จ ให้ค้นหา Drive ID จาก Google Sheets (TaskSubmissions & DriveFiles) โดยตรงแล้วดึงใหม่
  try {
    if (onProgress) onProgress(50);
    const recoveredDriveId = await resolveDriveIdByFileNameFromGas(safeName, schoolId, taskId, memberId);
    if (recoveredDriveId && recoveredDriveId !== driveId) {
      const retryParams = new URLSearchParams();
      retryParams.set('id', recoveredDriveId);
      retryParams.set('name', safeName);
      if (schoolId) retryParams.set('schoolId', schoolId);
      if (taskId) retryParams.set('taskId', taskId);
      if (memberId) retryParams.set('memberId', memberId);

      const retryValidated = await fetchAndValidateDownloadStream(
        `/api/files/download?${retryParams.toString()}`,
        safeName,
        onProgress
      );
      if (retryValidated) {
        const blob = new Blob([retryValidated.bytes as unknown as BlobPart], { type: retryValidated.mime });
        if (onProgress) onProgress(100);
        triggerBrowserBlobDownload(blob, retryValidated.resolvedName);
        return true;
      }
    }

    // 4. Fallback สุดท้ายเฉพาะกรณีมี Drive ID จริงเท่านั้น: ดาวน์โหลดผ่าน hidden iframe จาก Google Drive โดยตรง
    const finalDriveId = driveId || recoveredDriveId;
    if (finalDriveId) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `https://drive.usercontent.google.com/download?id=${finalDriveId}&export=download&confirm=t`;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch {}
      }, 45000);
      if (onProgress) onProgress(100);
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}




