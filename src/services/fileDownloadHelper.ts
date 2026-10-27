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
    return `https://drive.google.com/uc?export=download&id=${fid}`;
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

/**
 * สร้าง URL สำหรับแสดงผลตัวอย่างไฟล์ (รูปภาพ / PDF / ไฟล์ที่ฝากบนเซิร์ฟเวอร์หรือ Google Drive)
 */
export function getPreviewableFileUrl(urlOrData?: string, fileName?: string): string {
  if (!urlOrData || urlOrData === '#') return '';
  if (urlOrData.startsWith('data:') || urlOrData.startsWith('blob:')) {
    return urlOrData;
  }
  if (urlOrData.startsWith('/api/files/')) {
    return urlOrData;
  }
  const driveId = extractDriveFileId(urlOrData);
  if (driveId) {
    const safeName = (fileName || 'file').trim();
    return `/api/files/download?url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}&inline=1`;
  }
  return urlOrData;
}

/**
 * ดาวน์โหลดไฟล์จริงทุกประเภท (โดยเฉพาะไฟล์ Word ให้เป็นไฟล์ Word แท้ๆ ไม่เพี้ยน รวมถึงรูปภาพและ PDF)
 */
export function downloadRealFile(
  urlOrData?: string,
  fileName?: string,
  defaultExt?: string
): boolean {
  if (!urlOrData || urlOrData === '#' || urlOrData.length < 5) {
    return false;
  }

  let safeName = (fileName || 'download').trim();
  const currentExt = getFileExtension(safeName);

  if (!currentExt && defaultExt) {
    safeName = `${safeName}.${defaultExt.replace(/^\./, '')}`;
  }

  // 1. กรณีเป็น Base64 Data URL หรือ Raw Base64
  if (urlOrData.startsWith('data:') || (!urlOrData.startsWith('http') && !urlOrData.startsWith('/'))) {
    try {
      let base64String = urlOrData;
      let detectedMime = '';

      if (urlOrData.startsWith('data:')) {
        const parts = urlOrData.split(';base64,');
        detectedMime = parts[0].replace('data:', '') || '';
        base64String = parts[1] || '';
      }

      // เลือกระบุ MIME Type ที่ถูกต้องตามนามสกุลไฟล์เพื่อไม่ให้ไฟล์ Word/Excel เสียหาย
      const correctMime = getMimeTypeByExtension(safeName, detectedMime || 'application/octet-stream');

      const byteCharacters = atob(base64String);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const blob = new Blob([byteNumbers], { type: correctMime });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return true;
    } catch (err) {
      console.error('Failed to parse base64 blob:', err);
    }
  }

  // 2. กรณีเป็นไฟล์ที่ฝากบนเซิร์ฟเวอร์ (/api/files/...) หรือลิงก์ Google Drive
  // ใช้ /api/files/download เพื่อส่ง Header Content-Disposition: attachment พร้อมชื่อไฟล์ภาษาไทยที่ถูกต้องโดยไม่ถูกบล็อกใน iframe
  const driveId = extractDriveFileId(urlOrData);
  if (urlOrData.startsWith('/api/files/') || driveId) {
    const proxyDownloadUrl = `/api/files/download?url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}`;
    const link = document.createElement('a');
    link.href = proxyDownloadUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  // 3. กรณีเป็น URL ภายนอกทั่วไป
  const link = document.createElement('a');
  link.href = urlOrData;
  link.download = safeName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

