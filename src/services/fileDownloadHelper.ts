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
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
}

export async function resolveDriveIdByFileNameFromGas(fileName: string, schoolId?: string): Promise<string> {
  if (!fileName) return '';
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

    const cleanTarget = fileName.trim().toLowerCase();
    for (let i = json.data.length - 1; i >= 0; i--) {
      const row = json.data[i];
      if (!row) continue;
      const rowName = String(row.fileName || '').trim().toLowerCase();
      if (rowName === cleanTarget || rowName.endsWith('_' + cleanTarget) || rowName.includes(cleanTarget)) {
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
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }
  if (urlOrData.startsWith('/api/files/')) {
    return `/api/files/download?url=${encodeURIComponent(urlOrData)}&name=${encodeURIComponent(safeName)}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}&inline=1`;
  }
  return urlOrData;
}

/**
 * ดาวน์โหลดไฟล์ต้นฉบับจริงจาก Google Drive โดยตรง (เร็วที่สุด ได้ไฟล์ต้นฉบับ 100% ทุกสกุลไฟล์)
 */
export function downloadRealFile(
  urlOrData?: string,
  fileName?: string,
  defaultExt?: string,
  schoolId?: string
): boolean {
  const cleanUrl = !urlOrData || urlOrData === '#' ? '' : urlOrData.trim();
  if (!cleanUrl && (!fileName || !fileName.trim())) {
    return false;
  }

  let safeName = (fileName || 'download').trim();
  const currentExt = getFileExtension(safeName);

  if (!currentExt && defaultExt) {
    safeName = `${safeName}.${defaultExt.replace(/^\./, '')}`;
  }

  // 1. กรณีเป็น Base64 Data URL หรือ Raw Base64 (กรณีเพิ่งเลือกไฟล์ในเครื่อง)
  if (cleanUrl && (cleanUrl.startsWith('data:') || (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('/')))) {
    // ตรวจสอบก่อนว่าไม่ใช่ Drive File ID ล้วน
    const possibleDriveId = extractDriveFileId(cleanUrl);
    if (!possibleDriveId) {
      try {
        let base64String = cleanUrl;
        let detectedMime = '';

        if (cleanUrl.startsWith('data:')) {
          const parts = cleanUrl.split(';base64,');
          detectedMime = parts[0].replace('data:', '') || '';
          base64String = parts[1] || '';
        }

        const correctMime = getMimeTypeByExtension(safeName, detectedMime || 'application/octet-stream');
        const byteCharacters = atob(base64String);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const blob = new Blob([byteNumbers], { type: correctMime });
        triggerBrowserBlobDownload(blob, safeName);
        return true;
      } catch (err) {
        console.error('Failed to parse base64 blob:', err);
      }
    }
  }

  // 2. ดึงไฟล์ต้นฉบับจาก Google Drive โดยตรงเป็นอันดับแรก (Direct Google Drive Original File)
  (async () => {
    try {
      let driveId = extractDriveFileId(cleanUrl);
      if (!driveId && safeName && (!cleanUrl || cleanUrl.startsWith('/api/files/'))) {
        driveId = await resolveDriveIdByFileNameFromGas(safeName, schoolId);
      }

      if (driveId) {
        // Tier 1: ดึงไฟล์ต้นฉบับโดยตรงจาก Google Drive Direct Content Endpoint (รองรับ CORS * และได้ไฟล์ต้นฉบับแท้ 100% ทันที)
        const directUserContentUrl = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;
        try {
          const driveRes = await fetch(directUserContentUrl);
          const driveType = String(driveRes.headers.get('content-type') || '').toLowerCase();
          if (driveRes.ok && !driveType.includes('text/html')) {
            const blob = await driveRes.blob();
            if (blob.size > 0) {
              triggerBrowserBlobDownload(blob, safeName);
              return;
            }
          }
        } catch {
          // Fallback to Tier 2
        }

        // Tier 2: ดึงผ่าน Google Drive High-Speed CDN (lh3.googleusercontent.com)
        try {
          const cdnRes = await fetch(`https://lh3.googleusercontent.com/d/${driveId}`);
          const cdnType = String(cdnRes.headers.get('content-type') || '').toLowerCase();
          if (cdnRes.ok && !cdnType.includes('text/html')) {
            const blob = await cdnRes.blob();
            if (blob.size > 0) {
              triggerBrowserBlobDownload(blob, safeName);
              return;
            }
          }
        } catch {
          // Fallback to Tier 3
        }

        // Tier 3: สั่งเบราว์เซอร์ดาวน์โหลดตรงจาก Google Drive Content-Disposition attachment
        const link = document.createElement('a');
        link.href = directUserContentUrl;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Tier 4: กรณีไม่มี Drive ID ในฝั่ง Client ให้ดึงผ่าน /api/files/download ซึ่งจะค้นหา Drive ID จาก Google Sheets ให้โดยอัตโนมัติ
      const proxyUrl = `/api/files/download?url=${encodeURIComponent(cleanUrl)}&name=${encodeURIComponent(safeName)}${
        schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''
      }`;
      try {
        const res = await fetch(proxyUrl);
        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        if (res.ok && !contentType.includes('text/html') && !contentType.includes('application/json')) {
          const blob = await res.blob();
          if (blob.size > 0) {
            triggerBrowserBlobDownload(blob, safeName);
            return;
          }
        }
      } catch {
        // Fallback to external URL
      }

      if (cleanUrl.startsWith('http')) {
        const link = document.createElement('a');
        link.href = cleanUrl;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  })();

  return true;
}


