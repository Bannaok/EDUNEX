/**
 * รหัสต้นฉบับ Google Apps Script (Code.gs) - Version 5.0
 * 1. 1 Admin = ONLY 1 Single School Folder in Google Drive (ห้ามสร้างโฟลเดอร์หน้าอื่นๆ หรือโฟลเดอร์ย่อยเด็ดขาด)
 * 2. ทุกการอัปโหลดไฟล์ในเว็บ (หน้ามอบหมาย, ศูนย์เอกสาร, ตั้งค่า, Website แนะนำ ฯลฯ) เก็บตรงเข้าโฟลเดอร์โรงเรียน
 * 3. เก็บข้อมูลจริง 1 อัปโหลด = 1 ไฟล์ใน Google Drive (Zero Duplicate Files Engine)
 * 4. เมื่อหน้าเว็ปลบรายการ/ไฟล์ ให้ลบไฟล์ใน Google Drive ด้วยอัตโนมัติ (ห้ามลบโฟลเดอร์โรงเรียนเด็ดขาด)
 * 5. Google Sheets แยกข้อมูลโรงเรียนชัดเจน เมื่อหน้าเว็ปลบข้อมูล แถวใน Google Sheets ก็จะถูกลบด้วย
 */

export const CODE_GS_SOURCE = `/**
 * ============================================================================
 * ระบบบริหารจัดการงานวิชาการและธุรการโรงเรียน (School Management System)
 * Google Apps Script Backend (Code.gs) - Version 5.0
 * (Strict 1 Admin = ONLY 1 Single School Folder, No Subfolders, Zero Duplicate Files,
 *  Automatic Drive File Deletion on Web Deletion, Automatic Google Sheets Row Deletion,
 *  Strict No Deletion of School Folder)
 * ============================================================================
 * ข้อกำหนดและคุณสมบัติหลัก (Version 5.0):
 * 1. เมื่อ Developer สร้าง ID Admin ใหม่:
 *    - ระบบจะสร้าง Google Sheets ของโรงเรียนนั้น 1 ไฟล์
 *    - และสร้างโฟลเดอร์ Google Drive ประจำโรงเรียน 1 อันเท่านั้น (ชื่อ "[โรงเรียน] <ชื่อโรงเรียน>")
 *    - ห้ามสร้างโฟลเดอร์หน้าอื่นๆ หรือโฟลเดอร์ย่อยใดๆ ทั้งสิ้นใน Google Drive อย่างเด็ดขาด!
 * 2. ทุกการอัปโหลดไฟล์ในเว็บไซต์ (หน้ามอบหมายงาน, หน้าศูนย์เอกสาร, หน้าตั้งค่า/โลโก้,
 *    หน้า Website แนะนำ, รูปนักเรียน, รูปบุคลากร ฯลฯ):
 *    - เก็บไว้ใน "โฟลเดอร์โรงเรียนนั้นๆ" เพียงโฟลเดอร์เดียวเท่านั้น
 *    - เก็บข้อมูลจริง: หากอัปโหลดในเว็บ 1 ไฟล์ ก็จะอยู่ในโฟลเดอร์ Google Drive 1 ไฟล์ตามจริง
 *    - ห้ามสร้างไฟล์ซ้ำซ้อนเด็ดขาด (Zero Duplicate Files Engine) เพื่อประหยัดพื้นที่ Google Drive สูงสุด
 * 3. เมื่อลบไฟล์หรือลบรายการต่างๆ ในหน้าเว็บ (หน้ามอบหมาย, ศูนย์เอกสาร, นักเรียน, บุคลากร, เว็บไซต์ ฯลฯ):
 *    - ไฟล์ที่เกี่ยวข้องในโฟลเดอร์ Google Drive จะถูกลบ (ย้ายลงถังขยะ) โดยอัตโนมัติทันที
 *    - **ข้อบังคับเด็ดขาด**: ห้ามลบโฟลเดอร์โรงเรียนเด็ดขาด! ลบเฉพาะไฟล์ข้างในเท่านั้น
 * 4. Google Sheets แยกข้อมูลโรงเรียนชัดเจน ไม่ปะปนกัน:
 *    - ข้อมูลทุกอย่างจัดเก็บใน Google Sheets ของโรงเรียนนั้นๆ
 *    - เมื่อในเว็บลบข้อมูล แถวใน Google Sheets ประจำโรงเรียนก็จะถูกลบโดยอัตโนมัติ
 * ============================================================================
 */

var MASTER_SPREADSHEET_ID = '1mVJl2FSHiJmQlOR8t-7h1Z4wXfbMWepUU_Qzkd1FSAM';
var DEFAULT_DRIVE_FOLDER_ID = '11IXjrNHXyGpf3A-7ZT38t8B_jXtoFGS9';
var KV_CHUNK_SIZE = 38000;
var KV_MAX_CHUNKS = 12;

/**
 * 1. จัดการคำขอแบบ GET (ดึงข้อมูล / ตรวจสอบสถานะการเชื่อมต่อ)
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'ping';
    var spreadsheetId = (e && e.parameter && e.parameter.spreadsheetId) ? e.parameter.spreadsheetId : '';
    var schoolId = (e && e.parameter && e.parameter.schoolId) ? e.parameter.schoolId : '';
    var schoolName = (e && e.parameter && e.parameter.schoolName) ? e.parameter.schoolName : '';

    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'เชื่อมต่อ Google Apps Script (v5.0 1-Admin-1-School-Folder, Zero Duplication & Auto-Deletion) สำเร็จ!',
        timestamp: new Date().toISOString(),
        version: '5.0',
        masterSpreadsheetId: MASTER_SPREADSHEET_ID,
        driveFolderId: DEFAULT_DRIVE_FOLDER_ID
      });
    }

    if (action === 'getAll') {
      var data = getAllDataFromSheets({
        spreadsheetId: spreadsheetId,
        schoolId: schoolId,
        schoolName: schoolName
      });
      return jsonResponse({
        status: 'success',
        data: data
      });
    }

    if (action === 'getSheet') {
      var sheetName = e.parameter.sheet || 'Students';
      var ss = getTargetSpreadsheet({
        spreadsheetId: spreadsheetId,
        schoolId: schoolId,
        schoolName: schoolName
      });
      var sheetData = getSheetDataAsObjects(ss, sheetName);
      return jsonResponse({
        status: 'success',
        sheet: sheetName,
        data: sheetData
      });
    }

    return jsonResponse({
      status: 'error',
      message: 'ไม่รู้จักคำสั่ง GET action: ' + action
    });
  } catch (err) {
    return jsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

/**
 * 2. จัดการคำขอแบบ POST (บันทึก / แก้ไข / ลบ / ซิงค์ข้อมูลแยกตามโรงเรียน / อัปโหลดไฟล์ลง Drive)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: 'error', message: 'ไม่พบข้อมูล JSON Payload ที่ส่งมา' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || '';
    var result = {};

    switch (action) {
      // --- สร้างและลบไฟล์ Google Sheets ประจำโรงเรียน (Multi-School Isolation) ---
      case 'createSchoolSheet':
        result = handleCreateSchoolSheet(payload);
        break;
      case 'deleteSchoolSheet':
        result = handleDeleteSchoolSheet(payload);
        break;

      // --- ระงับ / ยกเลิกการระงับ Admin โรงเรียน และสมาชิก ---
      case 'toggleSuspendAdmin':
        result = handleToggleSuspendAdmin(payload);
        break;
      case 'toggleSuspendMember':
        result = handleToggleSuspendMember(payload);
        break;

      // --- อัปโหลดไฟล์ทุกประเภทลง Google Drive เข้าโฟลเดอร์โรงเรียนโดยตรง ---
      case 'uploadDriveFile':
        result = handleUploadDriveFile(payload);
        break;
      case 'deleteDriveFile':
        result = {
          status: 'success',
          trashed: deleteDriveFileByUrlOrId(payload.fileUrl || payload.fileId || payload.driveFileId, payload),
          message: 'ลบไฟล์ใน Google Drive สำเร็จ'
        };
        break;

      // --- ซิงค์ข้อมูลทั้งหมดหรือซิงค์ตามคีย์ของโรงเรียนอัตโนมัติ ---
      case 'syncAll':
        result = handleSyncAll(payload);
        break;
      case 'syncTenantKey':
        result = handleSyncTenantKey(payload);
        break;

      // --- ข้อมูลโรงเรียนและการตั้งค่า (พร้อมอัปโหลดโลโก้โรงเรียนลง Google Drive) ---
      case 'saveSchoolInfo':
        result = handleSaveSchoolInfo(payload);
        break;

      // --- นักเรียน (Students) พร้อมรูปภาพลง Google Drive & ลบรูปภาพเมื่อลบนักเรียน ---
      case 'saveStudent':
        result = handleSaveStudent(payload);
        break;
      case 'deleteStudent':
        result = handleDeleteRowById('Students', payload.id, 'id', payload);
        break;

      // --- บุคลากร (Personnel) พร้อมรูปภาพลง Google Drive & ลบรูปภาพเมื่อลบบุคลากร ---
      case 'savePersonnel':
        result = handleSavePersonnel(payload);
        break;
      case 'deletePersonnel':
        result = handleDeleteRowById('Personnel', payload.id, 'id', payload);
        break;

      // --- สมาชิกผู้ใช้งาน (Members) พร้อมรูปโปรไฟล์ลง Google Drive & ลบรูปเมื่อลบสมาชิก ---
      case 'saveMember':
        result = handleSaveMember(payload);
        break;
      case 'deleteMember':
        result = handleDeleteRowById('Members', payload.id, 'id', payload);
        break;

      // --- บันทึกการดื่มนม/แปรงฟันประจำวัน (DailyTracking) ---
      case 'saveDailyTracking':
        result = handleSaveDailyTracking(payload);
        break;
      case 'deleteDailyTracking':
        result = handleDeleteRowById('DailyTracking', payload.id, 'id', payload);
        break;

      // --- รายวิชา (Subjects) ---
      case 'saveSubject':
        result = handleSaveSubject(payload);
        break;
      case 'deleteSubject':
        result = handleDeleteRowById('Subjects', payload.id, 'id', payload);
        break;

      // --- ผลการเรียน / เกรด (Grades) ---
      case 'saveGrades':
        result = handleSaveGrades(payload);
        break;
      case 'deleteGrade':
        result = handleDeleteRowById('Grades', payload.id, 'id', payload);
        break;

      // --- เวลาเรียน (Attendance & AttendanceConfig) ---
      case 'saveAttendance':
        result = handleSaveAttendance(payload);
        break;
      case 'deleteAttendance':
        result = handleDeleteRowById('Attendance', payload.id, 'id', payload);
        break;
      case 'saveAttendanceConfig':
        result = handleSaveAttendanceConfig(payload);
        break;

      // --- เงินออมทรัพย์ (Savings) ---
      case 'saveSavings':
        result = handleSaveSavings(payload);
        break;
      case 'setAllSavings':
        result = handleSetAllSavings(payload);
        break;
      case 'deleteSavings':
        result = handleDeleteRowById('Savings', payload.id, 'id', payload);
        break;

      // --- มอบหมายงาน & แจ้งให้ทราบ (Tasks & TaskSubmissions) พร้อมลบไฟล์ใน Drive อัตโนมัติเมื่อลบงาน ---
      case 'saveTask':
        result = handleSaveTask(payload);
        break;
      case 'completeTask':
        result = handleCompleteTask(payload);
        break;
      case 'deleteTask':
        result = handleDeleteTask(payload);
        break;
      case 'saveAllTasks':
        result = handleSaveAllTasks(payload);
        break;

      // --- ศูนย์เอกสารและหนังสือคำสั่ง (Documents) พร้อมลบไฟล์ใน Drive อัตโนมัติเมื่อลบเอกสาร ---
      case 'uploadDocument':
        result = handleUploadDocument(payload);
        break;
      case 'deleteDocument':
        result = handleDeleteDocument(payload);
        break;
      case 'saveAllDocuments':
        result = handleSaveAllDocuments(payload);
        break;

      // --- เว็บไซต์แนะนำ (Websites) พร้อมเก็บโลโก้เว็บไซต์ & ลบโลโก้เมื่อลบเว็บไซต์ ---
      case 'saveWebsite':
        result = handleSaveWebsite(payload);
        break;
      case 'deleteWebsite':
        result = handleDeleteRowById('Websites', payload.id, 'id', payload);
        break;
      case 'saveAllWebsites':
        result = handleSaveAllWebsites(payload);
        break;

      // --- ปฏิทินวิชาการ (Calendar) ---
      case 'saveCalendarEvent':
        result = handleSaveCalendarEvent(payload);
        break;
      case 'deleteCalendarEvent':
        result = handleDeleteRowById('Calendar', payload.id, 'id', payload);
        break;

      // --- ปุ่มลัดและหน้าเพจ (CustomButtons & CustomPages) ---
      case 'saveCustomButton':
        result = handleSaveGenericEntity('CustomButtons', payload.button || payload.data, 'id', payload);
        break;
      case 'deleteCustomButton':
        result = handleDeleteRowById('CustomButtons', payload.id, 'id', payload);
        break;
      case 'saveCustomPage':
        result = handleSaveGenericEntity('CustomPages', payload.page || payload.data, 'id', payload);
        break;
      case 'deleteCustomPage':
        result = handleDeleteRowById('CustomPages', payload.id, 'id', payload);
        break;

      // --- ระบบการลา & ครูเวร (LeaveRequests, DutyAssignments, DailyDutyLogs) ---
      case 'saveLeaveRequest':
        result = handleSaveGenericEntity('LeaveRequests', payload.record || payload.data, 'id', payload);
        break;
      case 'deleteLeaveRequest':
        result = handleDeleteRowById('LeaveRequests', payload.id, 'id', payload);
        break;
      case 'saveDutyAssignment':
        result = handleSaveGenericEntity('DutyAssignments', payload.record || payload.data, 'id', payload);
        break;
      case 'deleteDutyAssignment':
        result = handleDeleteRowById('DutyAssignments', payload.id, 'id', payload);
        break;
      case 'saveDutyLog':
        result = handleSaveGenericEntity('DailyDutyLogs', payload.record || payload.data, 'id', payload);
        break;
      case 'deleteDutyLog':
        result = handleDeleteRowById('DailyDutyLogs', payload.id, 'id', payload);
        break;

      // --- ลบปีการศึกษาแบบ Cascade ---
      case 'deleteAcademicYearCascade':
        result = handleDeleteAcademicYearCascade(payload.academicYear, payload);
        break;

      // --- Generic Entity Handlers ---
      case 'saveEntity':
        result = handleSaveGenericEntity(payload.sheetName || 'CustomEntities', payload.data, payload.keyField || 'id', payload);
        break;
      case 'batchSaveEntities':
        result = handleBatchSaveGenericEntities(payload.sheetName || 'RealtimeCloudKV', payload.records || [], payload.keyField || 'id', payload);
        break;
      case 'deleteEntity':
        result = handleDeleteRowById(payload.sheetName || 'CustomEntities', payload.id, payload.keyField || 'id', payload);
        break;

      default:
        result = handleSaveGenericEntity(action || 'Uncategorized', payload, 'id', payload);
        break;
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

/**
 * ============================================================================
 * SECTION A: ระบบแยกไฟล์ Google Sheets ตามโรงเรียน (Per-School Spreadsheet Resolver)
 * ============================================================================
 */

function isRealSpreadsheetId(id) {
  if (!id || typeof id !== 'string') return false;
  var trimmed = id.trim();
  if (!trimmed || trimmed.indexOf('sheet_') === 0 || trimmed.length < 15) return false;
  return true;
}

function cleanSchoolName(name) {
  if (!name) return '';
  return String(name).replace(/^โรงเรียน/, '').replace(/\\s+/g, '').trim().toLowerCase();
}

/**
 * ค้นหาหรือเปิด Google Spreadsheet ประจำโรงเรียนโดยอัตโนมัติ
 */
function getTargetSpreadsheet(payloadOrId) {
  var spreadsheetId = '';
  var schoolId = '';
  var schoolName = '';
  var forceMaster = false;

  if (typeof payloadOrId === 'string') {
    spreadsheetId = payloadOrId;
  } else if (payloadOrId && typeof payloadOrId === 'object') {
    spreadsheetId = payloadOrId.spreadsheetId || payloadOrId.schoolSpreadsheetId || '';
    schoolId = payloadOrId.schoolId || payloadOrId.adminId || '';
    schoolName = payloadOrId.schoolName || '';
    forceMaster = Boolean(payloadOrId.forceMaster);
  }

  // 1. หากระบุ forceMaster ให้เปิด Master Spreadsheet
  if (forceMaster && MASTER_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    } catch (e) {}
  }

  // 2. หากระบุ spreadsheetId ที่ถูกต้องมาโดยตรง ให้เปิดทันที
  if (isRealSpreadsheetId(spreadsheetId)) {
    try {
      return SpreadsheetApp.openById(spreadsheetId.trim());
    } catch (err1) {}
  }

  // 3. ค้นหา Google Sheet ของโรงเรียนนี้จาก Master Spreadsheet (ชีต Admins)
  if (MASTER_SPREADSHEET_ID && (schoolId || schoolName)) {
    try {
      var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
      var adminsData = getSheetDataAsObjects(masterSS, 'Admins');
      var cleanTarget = cleanSchoolName(schoolName);
      var matchedAdmin = null;

      for (var i = 0; i < adminsData.length; i++) {
        var adm = adminsData[i];
        if (schoolId && String(adm.id) === String(schoolId)) {
          matchedAdmin = adm;
          break;
        }
        if (cleanTarget && cleanSchoolName(adm.schoolName) === cleanTarget) {
          matchedAdmin = adm;
          break;
        }
      }

      if (matchedAdmin && isRealSpreadsheetId(matchedAdmin.googleSheetId)) {
        try {
          return SpreadsheetApp.openById(String(matchedAdmin.googleSheetId).trim());
        } catch (openErr) {}
      }

      // หากยังไม่มี ให้สร้าง Google Sheet ใหม่และโฟลเดอร์ Google Drive ประจำโรงเรียนให้ทันที
      if (schoolName) {
        var created = handleCreateSchoolSheet({
          schoolName: schoolName,
          adminId: schoolId,
          schoolCode: (matchedAdmin && matchedAdmin.schoolCode) || '',
          affiliation: (matchedAdmin && matchedAdmin.affiliation) || '',
          directorName: (matchedAdmin && matchedAdmin.directorName) || ''
        });
        if (created && created.status === 'success' && isRealSpreadsheetId(created.spreadsheetId)) {
          return SpreadsheetApp.openById(created.spreadsheetId);
        }
      }
    } catch (lookupErr) {}
  }

  // 4. Fallback ไปที่ Master Spreadsheet
  try {
    if (MASTER_SPREADSHEET_ID) {
      return SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    }
  } catch (err2) {}

  return SpreadsheetApp.getActiveSpreadsheet();
}

function isRealDriveFolderId(id) {
  if (!id || typeof id !== 'string') return false;
  var trimmed = id.trim();
  if (!trimmed || trimmed.indexOf('folder_') === 0 || trimmed.length < 15) return false;
  return true;
}

/**
 * ย้ายไฟล์ (เช่น Google Sheet ที่เพิ่งสร้าง) เข้าสู่โฟลเดอร์โรงเรียนโดยรองรับทั้ง Google Apps Script V8 (file.moveTo) และรุ่นเก่า
 */
function moveFileToFolderSafe(fileId, targetFolder) {
  if (!fileId || !targetFolder) return false;
  try {
    var file = DriveApp.getFileById(String(fileId).trim());
    if (!file) return false;
    // ตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์เป้าหมายแล้วหรือยัง
    try {
      var parents = file.getParents();
      var targetId = targetFolder.getId();
      while (parents.hasNext()) {
        if (parents.next().getId() === targetId) {
          return true;
        }
      }
    } catch (pErr) {}

    if (typeof file.moveTo === 'function') {
      file.moveTo(targetFolder);
      return true;
    } else if (typeof targetFolder.addFile === 'function') {
      targetFolder.addFile(file);
      try {
        DriveApp.getRootFolder().removeFile(file);
      } catch (rmErr) {}
      return true;
    }
  } catch (err) {}
  return false;
}

/**
 * สร้าง Google Sheet ใหม่แยกเฉพาะโรงเรียน พร้อมโฟลเดอร์ Google Drive ประจำโรงเรียน
 * ข้อบังคับ Version 5.0:
 * - สร้างเฉพาะโฟลเดอร์โรงเรียน 1 อันเท่านั้น (ชื่อ "[โรงเรียน] <ชื่อโรงเรียน>")
 * - ย้ายไฟล์ Google Sheet ของโรงเรียนเข้าไปอยู่ในโฟลเดอร์โรงเรียนนั้นทันที!
 * - ห้ามสร้างโฟลเดอร์ย่อยหรือโฟลเดอร์หน้าอื่นๆ อย่างเด็ดขาด!
 */
function handleCreateSchoolSheet(payload) {
  var schoolName = (payload.schoolName || 'โรงเรียนใหม่').trim();
  var schoolCode = payload.schoolCode || '';
  var rootFolderId = payload.folderId || payload.driveFolderId || DEFAULT_DRIVE_FOLDER_ID;
  var sheetTitle = '[ระบบวิชาการ] ' + schoolName + (schoolCode ? ' (' + schoolCode + ')' : '');

  // 1. สร้างหรือดึงโฟลเดอร์ Google Drive ประจำโรงเรียนของ Admin นี้ทันที (1 Admin = 1 โฟลเดอร์โรงเรียนเท่านั้น ไม่มีโฟลเดอร์ย่อย)
  var schoolFolder = null;
  var schoolFolderId = '';
  var schoolFolderUrl = '';
  try {
    schoolFolder = getOrCreateSchoolFolder(schoolName, rootFolderId);
    if (schoolFolder) {
      schoolFolderId = schoolFolder.getId();
      schoolFolderUrl = schoolFolder.getUrl();
    }
  } catch (folderInitErr) {}

  // 2. ตรวจสอบก่อนว่าในตาราง Admins มี Google Sheet ของโรงเรียนนี้อยู่แล้วหรือไม่ เพื่อไม่ให้สร้างซ้ำ
  try {
    var masterCheck = SpreadsheetApp.openById(payload.masterSpreadsheetId || MASTER_SPREADSHEET_ID);
    var existingAdmins = getSheetDataAsObjects(masterCheck, 'Admins');
    var cleanTarget = cleanSchoolName(schoolName);
    for (var k = 0; k < existingAdmins.length; k++) {
      var ea = existingAdmins[k];
      if ((payload.adminId && String(ea.id) === String(payload.adminId)) || (cleanTarget && cleanSchoolName(ea.schoolName) === cleanTarget)) {
        if (isRealSpreadsheetId(ea.googleSheetId)) {
          try {
            var existingSS = SpreadsheetApp.openById(String(ea.googleSheetId).trim());
            // ย้ายไฟล์ Google Sheet เข้าไปไว้ในโฟลเดอร์โรงเรียนด้วยเสมอ (กรณีไฟล์เดิมอยู่หน้าแรกของ My Drive)
            if (schoolFolder) {
              moveFileToFolderSafe(existingSS.getId(), schoolFolder);
            }
            // อัปเดต driveFolderId & driveFolderUrl ให้ Admin หากยังไม่มี
            if (schoolFolderId && (!ea.driveFolderId || ea.driveFolderId !== schoolFolderId)) {
              var adminHeadersExisting = ['id', 'username', 'password', 'fullName', 'schoolName', 'schoolCode', 'affiliation', 'directorName', 'googleSheetId', 'googleSheetUrl', 'driveFolderId', 'driveFolderUrl', 'isSuspended', 'createdAt'];
              var adminsSheetExisting = getOrCreateSheet(masterCheck, 'Admins', adminHeadersExisting);
              ea.driveFolderId = schoolFolderId;
              ea.driveFolderUrl = schoolFolderUrl;
              upsertRowInSheet(adminsSheetExisting, adminHeadersExisting, 'id', ea);
            }
            return {
              status: 'success',
              spreadsheetId: existingSS.getId(),
              spreadsheetUrl: existingSS.getUrl(),
              driveFolderId: schoolFolderId || ea.driveFolderId || '',
              driveFolderUrl: schoolFolderUrl || ea.driveFolderUrl || '',
              schoolName: schoolName,
              message: 'เชื่อมต่อ Google Sheet และโฟลเดอร์ Google Drive ประจำโรงเรียน "' + schoolName + '" สำเร็จ'
            };
          } catch (ignoreErr) {}
        }
      }
    }
  } catch (eCheck) {}

  var newSS = SpreadsheetApp.create(sheetTitle);
  var newId = newSS.getId();
  var newUrl = newSS.getUrl();

  // 3. ย้ายไฟล์ Google Sheet ไปไว้ในโฟลเดอร์ประจำโรงเรียนบน Google Drive (ใช้ file.moveTo สำหรับ V8)
  try {
    if (!schoolFolder) {
      schoolFolder = getOrCreateSchoolFolder(schoolName, rootFolderId);
    }
    if (schoolFolder) {
      schoolFolderId = schoolFolder.getId();
      schoolFolderUrl = schoolFolder.getUrl();
      moveFileToFolderSafe(newId, schoolFolder);
    }
  } catch (folderErr) {}

  // สร้างแท็บตารางหลักใน Google Sheet ของโรงเรียน (แท็บอื่นๆ จะถูกสร้างอัตโนมัติผ่าน getOrCreateSheet เมื่อมีการบันทึกข้อมูล เพื่อความรวดเร็วสูงสุด)
  var defaultSheets = [
    { name: 'Settings', headers: ['schoolName', 'schoolCode', 'affiliation', 'address', 'phone', 'email', 'directorName', 'academicYear', 'semester', 'logoUrl', 'driveLogoUrl', 'updatedAt'] },
    { name: 'Students', headers: ['id', 'rollNumber', 'studentCode', 'prefix', 'firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'age', 'religion', 'gradeLevel', 'room', 'address', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'guardianName', 'guardianPhone', 'dailyAllowance', 'photoUrl', 'status', 'fullDataJson'] },
    { name: 'Personnel', headers: ['id', 'personnelCode', 'prefix', 'firstName', 'lastName', 'gender', 'birthDate', 'age', 'position', 'academicStanding', 'department', 'assignedClass', 'education', 'major', 'phone', 'email', 'photoUrl', 'status'] },
    { name: 'Subjects', headers: ['id', 'code', 'name', 'gradeLevel', 'credits', 'hoursPerYear', 'subjectGroup', 'semester', 'academicYear', 'teacherId', 'teacherName', 'scoreRatio', 'assignmentItemsJson'] },
    { name: 'Grades', headers: ['id', 'studentId', 'subjectId', 'semester', 'academicYear', 'assignmentScoresJson', 'collectedScore', 'midtermScore', 'finalScore', 'totalScore', 'grade'] },
    { name: 'Attendance', headers: ['id', 'date', 'studentId', 'status', 'note', 'semester', 'academicYear'] },
    { name: 'Tasks', headers: ['id', 'title', 'description', 'type', 'priority', 'dueDate', 'isCompleted', 'isManualCompleted', 'createdBy', 'assignedTo', 'attachmentUrl', 'submissionsCount', 'submissionsJson'] },
    { name: 'Documents', headers: ['id', 'docNumber', 'title', 'docType', 'category', 'date', 'fileUrl', 'fileName', 'fileSize', 'uploadedBy', 'driveFileId'] },
    { name: 'Members', headers: ['id', 'username', 'password', 'prefix', 'fullName', 'firstName', 'lastName', 'role', 'gradeLevel', 'position', 'learningGroup', 'schoolId', 'schoolName', 'isSuspended', 'avatarUrl'] },
    { name: 'LeaveRequests', headers: ['id', 'teacherName', 'leaveType', 'startDate', 'endDate', 'reason', 'contactAddress', 'mobilePhone', 'directorName', 'personnelOfficer', 'status', 'createdAt', 'priorSickDays', 'priorPersonalDays', 'priorMaternityDays'] },
    { name: 'DriveFiles', headers: ['id', 'category', 'fileName', 'mimeType', 'fileSize', 'driveFileId', 'driveViewUrl', 'driveDownloadUrl', 'uploadedBy', 'uploadedAt'] }
  ];

  defaultSheets.forEach(function(def) {
    getOrCreateSheet(newSS, def.name, def.headers);
  });

  // ลบ Sheet1 เริ่มต้นออก
  var sheet1 = newSS.getSheetByName('Sheet1') || newSS.getSheetByName('แผ่นงาน1');
  if (sheet1 && newSS.getSheets().length > 1) {
    try {
      newSS.deleteSheet(sheet1);
    } catch (e) {}
  }

  // บันทึกค่าเริ่มต้นของโรงเรียนลงในแท็บ Settings ของไฟล์โรงเรียนใหม่ทันที
  try {
    var settingsSheet = getOrCreateSheet(newSS, 'Settings', defaultSheets[0].headers);
    settingsSheet.appendRow([
      schoolName,
      schoolCode,
      payload.affiliation || 'สพป.',
      '',
      '',
      '',
      payload.directorName || '',
      '2569',
      '1',
      '',
      '',
      new Date().toISOString()
    ]);
  } catch (eSettings) {}

  // บันทึกข้อมูล Admin พร้อมทั้งลิงก์ Google Sheet และโฟลเดอร์ Google Drive ของโรงเรียนนี้ลงใน Master Spreadsheet ('Admins' sheet)
  try {
    var masterId = payload.masterSpreadsheetId || MASTER_SPREADSHEET_ID;
    if (masterId) {
      var masterSS = SpreadsheetApp.openById(masterId);
      var adminHeaders = ['id', 'username', 'password', 'fullName', 'schoolName', 'schoolCode', 'affiliation', 'directorName', 'googleSheetId', 'googleSheetUrl', 'driveFolderId', 'driveFolderUrl', 'isSuspended', 'createdAt'];
      var adminsSheet = getOrCreateSheet(masterSS, 'Admins', adminHeaders);
      ensureSheetHeaders(adminsSheet, adminHeaders);
      var adminRecord = {
        id: payload.adminId || ('admin-' + new Date().getTime()),
        username: payload.username || '',
        password: payload.password || '123456',
        fullName: payload.fullName || ('ผู้ดูแลระบบ ' + schoolName),
        schoolName: schoolName,
        schoolCode: schoolCode,
        affiliation: payload.affiliation || 'สพป.',
        directorName: payload.directorName || '',
        googleSheetId: newId,
        googleSheetUrl: newUrl,
        driveFolderId: schoolFolderId,
        driveFolderUrl: schoolFolderUrl,
        isSuspended: Boolean(payload.isSuspended),
        createdAt: new Date().toISOString().split('T')[0]
      };
      upsertRowInSheet(adminsSheet, adminHeaders, 'id', adminRecord);
    }
  } catch (masterErr) {}

  return {
    status: 'success',
    spreadsheetId: newId,
    spreadsheetUrl: newUrl,
    driveFolderId: schoolFolderId,
    driveFolderUrl: schoolFolderUrl,
    schoolName: schoolName,
    message: 'สร้างไฟล์ Google Sheet และโฟลเดอร์ Google Drive ประจำโรงเรียน "' + schoolName + '" สำเร็จเรียบร้อยแล้ว'
  };
}

/**
 * ลบไฟล์ Google Sheet และโฟลเดอร์ Google Drive ของโรงเรียนเมื่อ Developer สั่งลบ ID Admin (โรงเรียน)
 */
function handleDeleteSchoolSheet(payload) {
  var schoolSpreadsheetId = payload.schoolSpreadsheetId || payload.googleSheetId || '';
  var schoolDriveFolderId = payload.schoolDriveFolderId || '';
  var adminId = payload.adminId || payload.id || '';
  var schoolName = payload.schoolName || '';
  var masterId = payload.masterSpreadsheetId || MASTER_SPREADSHEET_ID;
  var trashedSheet = false;
  var trashedFolder = false;

  if (isRealSpreadsheetId(schoolSpreadsheetId) && schoolSpreadsheetId !== masterId) {
    try {
      var file = DriveApp.getFileById(schoolSpreadsheetId);
      file.setTrashed(true);
      trashedSheet = true;
    } catch (err) {}
  }

  if (isRealDriveFolderId(schoolDriveFolderId) && schoolDriveFolderId !== DEFAULT_DRIVE_FOLDER_ID) {
    try {
      DriveApp.getFolderById(schoolDriveFolderId).setTrashed(true);
      trashedFolder = true;
    } catch (fErr) {}
  }

  if (masterId) {
    try {
      var masterSS = SpreadsheetApp.openById(masterId);
      var adminsSheet = masterSS.getSheetByName('Admins');
      if (adminsSheet && adminsSheet.getLastRow() > 1) {
        var data = adminsSheet.getDataRange().getValues();
        var headers = data[0].map(function(h) { return String(h).trim(); });
        var idIdx = headers.indexOf('id');
        var sheetIdIdx = headers.indexOf('googleSheetId');
        var folderIdIdx = headers.indexOf('driveFolderId');
        var schoolNameIdx = headers.indexOf('schoolName');

        for (var i = data.length - 1; i >= 1; i--) {
          var rowId = idIdx >= 0 ? String(data[i][idIdx]) : '';
          var rowSheetId = sheetIdIdx >= 0 ? String(data[i][sheetIdIdx]) : '';
          var rowFolderId = folderIdIdx >= 0 ? String(data[i][folderIdIdx]) : '';
          var rowSchoolName = schoolNameIdx >= 0 ? String(data[i][schoolNameIdx]) : '';

          if (
            (adminId && rowId === String(adminId)) ||
            (schoolSpreadsheetId && rowSheetId === String(schoolSpreadsheetId)) ||
            (schoolName && rowSchoolName === String(schoolName))
          ) {
            if (!trashedSheet && isRealSpreadsheetId(rowSheetId) && rowSheetId !== masterId) {
              try {
                DriveApp.getFileById(rowSheetId).setTrashed(true);
                trashedSheet = true;
              } catch (e2) {}
            }
            if (!trashedFolder && isRealDriveFolderId(rowFolderId) && rowFolderId !== DEFAULT_DRIVE_FOLDER_ID) {
              try {
                DriveApp.getFolderById(rowFolderId).setTrashed(true);
                trashedFolder = true;
              } catch (e3) {}
            }
            adminsSheet.deleteRow(i + 1);
          }
        }
      }

      // ลบสมาชิกของโรงเรียนนี้ออกจาก Master Members sheet
      var membersSheet = masterSS.getSheetByName('Members');
      if (membersSheet && membersSheet.getLastRow() > 1 && (adminId || schoolName)) {
        var mData = membersSheet.getDataRange().getValues();
        var mHeaders = mData[0].map(function(h) { return String(h).trim(); });
        var mSchoolIdIdx = mHeaders.indexOf('schoolId');
        var mSchoolNameIdx = mHeaders.indexOf('schoolName');

        for (var j = mData.length - 1; j >= 1; j--) {
          var mSchoolId = mSchoolIdIdx >= 0 ? String(mData[j][mSchoolIdIdx]) : '';
          var mSchoolName = mSchoolNameIdx >= 0 ? String(mData[j][mSchoolNameIdx]) : '';
          if ((adminId && mSchoolId === String(adminId)) || (schoolName && mSchoolName === String(schoolName))) {
            membersSheet.deleteRow(j + 1);
          }
        }
      }

      // ลบคีย์ __<adminId> ใน RealtimeCloudKV
      var kvSheet = masterSS.getSheetByName('RealtimeCloudKV');
      if (kvSheet && kvSheet.getLastRow() > 1 && adminId) {
        var kvData = kvSheet.getDataRange().getValues();
        var suffix = '__' + String(adminId);
        for (var k = kvData.length - 1; k >= 1; k--) {
          var kvKey = String(kvData[k][0] || '');
          if (kvKey.indexOf(suffix) !== -1) {
            kvSheet.deleteRow(k + 1);
          }
        }
      }
    } catch (masterErr) {}
  }

  return {
    status: 'success',
    trashedSchoolSheet: trashedSheet,
    trashedSchoolFolder: trashedFolder,
    adminId: adminId,
    message: 'ลบข้อมูล Admin โรงเรียน "' + (schoolName || adminId) + '" และย้ายไฟล์ Google Sheet / โฟลเดอร์ไปถังขยะเรียบร้อยแล้ว'
  };
}

/**
 * ระงับ / ยกเลิกการระงับสิทธิ์ใช้งานชั่วคราวของ Admin โรงเรียน (รวมถึงสมาชิกในสังกัด)
 */
function handleToggleSuspendAdmin(payload) {
  var adminId = payload.adminId || payload.id || '';
  var isSuspended = Boolean(payload.isSuspended);
  var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var headers = ['id', 'username', 'password', 'fullName', 'schoolName', 'schoolCode', 'affiliation', 'directorName', 'googleSheetId', 'googleSheetUrl', 'driveFolderId', 'driveFolderUrl', 'isSuspended', 'createdAt'];
  var sheet = getOrCreateSheet(masterSS, 'Admins', headers);
  ensureSheetHeaders(sheet, headers);

  if (payload.admin && typeof payload.admin === 'object') {
    var rec = payload.admin;
    rec.isSuspended = isSuspended;
    upsertRowInSheet(sheet, headers, 'id', rec);
  } else if (adminId) {
    var data = sheet.getDataRange().getValues();
    var sheetHeaders = data[0].map(function(h) { return String(h).trim(); });
    var suspIdx = sheetHeaders.indexOf('isSuspended');
    if (suspIdx < 0) {
      suspIdx = sheetHeaders.length;
      sheet.getRange(1, suspIdx + 1).setValue('isSuspended');
    }
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(adminId)) {
        sheet.getRange(i + 1, suspIdx + 1).setValue(isSuspended ? 'TRUE' : 'FALSE');
        break;
      }
    }
  }

  return {
    status: 'success',
    adminId: adminId,
    isSuspended: isSuspended,
    message: isSuspended
      ? 'ระงับการใช้งาน Admin และสมาชิกในสังกัดชั่วคราวเรียบร้อยแล้ว'
      : 'ยกเลิกการระงับการใช้งาน Admin และสมาชิกในสังกัดเรียบร้อยแล้ว'
  };
}

function handleToggleSuspendMember(payload) {
  var memberId = payload.memberId || payload.id || '';
  var isSuspended = Boolean(payload.isSuspended);
  var ss = getTargetSpreadsheet(payload);
  var headers = ['id', 'username', 'password', 'prefix', 'fullName', 'firstName', 'lastName', 'role', 'gradeLevel', 'position', 'learningGroup', 'schoolId', 'schoolName', 'isSuspended', 'avatarUrl'];
  var sheet = getOrCreateSheet(ss, 'Members', headers);

  if (payload.member && typeof payload.member === 'object') {
    var rec = payload.member;
    rec.isSuspended = isSuspended;
    upsertRowInSheet(sheet, headers, 'id', rec);
  }
  return {
    status: 'success',
    memberId: memberId,
    isSuspended: isSuspended
  };
}

/**
 * ============================================================================
 * SECTION B: ระบบจัดการโฟลเดอร์ Google Drive ประจำโรงเรียน และ Zero-Duplicate Engine
 * ข้อบังคับ Version 5.0:
 * - 1 Admin = 1 โฟลเดอร์โรงเรียนเท่านั้น (ไม่มีโฟลเดอร์ย่อยใดๆ ทั้งสิ้น)
 * - ทุกการอัปโหลดไฟล์ในเว็บ เข้าโฟลเดอร์โรงเรียนนี้โดยตรง
 * - อัปโหลดจริง 1 ไฟล์ = อยู่ใน Google Drive 1 ไฟล์ตามจริง (ห้ามทำซ้ำ)
 * - เมื่อหน้าเว็ปลบรายการ/ไฟล์ ให้ลบไฟล์ใน Google Drive ด้วยอัตโนมัติ
 * - **ห้ามลบโฟลเดอร์โรงเรียนเด็ดขาด!**
 * ============================================================================
 */

function getOrCreateSchoolFolder(schoolName, rootFolderId) {
  var targetRootId = rootFolderId || DEFAULT_DRIVE_FOLDER_ID;
  var rootFolder;
  try {
    rootFolder = targetRootId ? DriveApp.getFolderById(targetRootId) : DriveApp.getRootFolder();
  } catch (e) {
    rootFolder = DriveApp.getRootFolder();
  }

  var cleanName = (schoolName || 'โรงเรียนอนุบาลเทศบาลดอนวิทยา').trim();
  var schoolFolderName = '[โรงเรียน] ' + cleanName;
  var iter = rootFolder.getFoldersByName(schoolFolderName);
  while (iter.hasNext()) {
    var f = iter.next();
    if (!f.isTrashed()) {
      return f;
    }
  }
  return rootFolder.createFolder(schoolFolderName);
}

/**
 * ค้นหาหรือเปิดโฟลเดอร์ Google Drive ประจำโรงเรียนของ Admin (1 Admin = 1 โฟลเดอร์โรงเรียน)
 */
function resolveSchoolDriveFolder(payload) {
  var p = payload || {};
  var rootFolderId = p.driveFolderId || p.folderId || DEFAULT_DRIVE_FOLDER_ID;
  var explicitSchoolFolderId = p.schoolDriveFolderId || '';
  var schoolId = p.schoolId || p.adminId || (p.member && p.member.schoolId) || '';
  var schoolName = p.schoolName || (p.schoolInfo && p.schoolInfo.schoolName) || (p.member && p.member.schoolName) || '';

  // 1. หากส่งรหัสโฟลเดอร์โรงเรียน (schoolDriveFolderId) มาโดยตรงและเปิดได้ ให้ใช้ทันที
  if (isRealDriveFolderId(explicitSchoolFolderId) && explicitSchoolFolderId !== rootFolderId && explicitSchoolFolderId !== DEFAULT_DRIVE_FOLDER_ID) {
    try {
      var directFolder = DriveApp.getFolderById(explicitSchoolFolderId.trim());
      if (directFolder && !directFolder.isTrashed()) {
        return directFolder;
      }
    } catch (directErr) {}
  }

  // 2. ค้นหาข้อมูล Admin ของโรงเรียนนี้จากตาราง Admins ใน Master Spreadsheet
  var matchedAdmin = null;
  var masterSS = null;
  try {
    masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var adminsData = getSheetDataAsObjects(masterSS, 'Admins');
    var targetCleanName = cleanSchoolName(schoolName);

    for (var i = 0; i < adminsData.length; i++) {
      var adm = adminsData[i];
      if (schoolId && String(adm.id) === String(schoolId)) {
        matchedAdmin = adm;
        break;
      }
      if (targetCleanName && cleanSchoolName(adm.schoolName) === targetCleanName) {
        matchedAdmin = adm;
        break;
      }
    }

    // หาก Admin มี driveFolderId บันทึกไว้อยู่แล้ว และยังไม่ถูกลบ ให้ใช้โฟลเดอร์นั้นทันที
    if (matchedAdmin && isRealDriveFolderId(matchedAdmin.driveFolderId) && matchedAdmin.driveFolderId !== DEFAULT_DRIVE_FOLDER_ID) {
      try {
        var savedFolder = DriveApp.getFolderById(String(matchedAdmin.driveFolderId).trim());
        if (savedFolder && !savedFolder.isTrashed()) {
          var expectedName = '[โรงเรียน] ' + String(matchedAdmin.schoolName || schoolName).trim();
          if (matchedAdmin.schoolName && savedFolder.getName() !== expectedName) {
            try { savedFolder.setName(expectedName); } catch (rnErr) {}
          }
          // ย้ายไฟล์ Google Sheet ของโรงเรียนเข้ามาไว้ในโฟลเดอร์โรงเรียนด้วยเสมอ
          if (isRealSpreadsheetId(matchedAdmin.googleSheetId)) {
            moveFileToFolderSafe(matchedAdmin.googleSheetId, savedFolder);
          }
          return savedFolder;
        }
      } catch (savedErr) {}
    }
  } catch (lookupErr) {}

  // 3. สร้างหรือเปิดโฟลเดอร์ตามชื่อโรงเรียนของ Admin นั้นๆ
  var resolvedSchoolName = (matchedAdmin && matchedAdmin.schoolName)
    ? matchedAdmin.schoolName
    : (schoolName || 'โรงเรียนอนุบาลเทศบาลดอนวิทยา');
  var schoolFolder = getOrCreateSchoolFolder(resolvedSchoolName, rootFolderId);

  // 4. บันทึก driveFolderId และ driveFolderUrl กลับลงในตาราง Admins เพื่อผูก 1 Admin = 1 โฟลเดอร์ถาวร และสร้าง/ย้าย Google Sheet เข้าโฟลเดอร์โรงเรียน
  if (matchedAdmin && masterSS && schoolFolder) {
    try {
      var adminHeaders = ['id', 'username', 'password', 'fullName', 'schoolName', 'schoolCode', 'affiliation', 'directorName', 'googleSheetId', 'googleSheetUrl', 'driveFolderId', 'driveFolderUrl', 'isSuspended', 'createdAt'];
      var adminsSheet = getOrCreateSheet(masterSS, 'Admins', adminHeaders);
      ensureSheetHeaders(adminsSheet, adminHeaders);
      matchedAdmin.driveFolderId = schoolFolder.getId();
      matchedAdmin.driveFolderUrl = schoolFolder.getUrl();
      if (isRealSpreadsheetId(matchedAdmin.googleSheetId)) {
        moveFileToFolderSafe(matchedAdmin.googleSheetId, schoolFolder);
      } else {
        var sheetTitleAuto = '[ระบบวิชาการ] ' + resolvedSchoolName + (matchedAdmin.schoolCode ? ' (' + matchedAdmin.schoolCode + ')' : '');
        var autoSS = SpreadsheetApp.create(sheetTitleAuto);
        matchedAdmin.googleSheetId = autoSS.getId();
        matchedAdmin.googleSheetUrl = autoSS.getUrl();
        moveFileToFolderSafe(autoSS.getId(), schoolFolder);
      }
      upsertRowInSheet(adminsSheet, adminHeaders, 'id', matchedAdmin);
    } catch (saveFolderErr) {}
  }

  return schoolFolder;
}

function computeBase64Md5Hash(base64Data) {
  try {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, base64Data);
    return digest.map(function(b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  } catch (e) {
    return 'len_' + base64Data.length + '_' + base64Data.substring(0, 24).replace(/[^a-zA-Z0-9]/g, '');
  }
}

/**
 * ดึง Google Drive File ID จาก URL หรือ File ID String
 */
function extractDriveFileId(fileUrlOrId) {
  if (!fileUrlOrId || typeof fileUrlOrId !== 'string') return '';
  var str = fileUrlOrId.trim();
  if (str.indexOf('data:') === 0 || str.indexOf('blob:') === 0) return '';

  // 1. https://lh3.googleusercontent.com/d/FILE_ID
  var m1 = str.match(/lh3\\.googleusercontent\\.com\\/d\\/([a-zA-Z0-9_-]{20,})/);
  if (m1 && m1[1]) return m1[1];

  // 2. https://drive.google.com/file/d/FILE_ID/...
  var m2 = str.match(/drive\\.google\\.com\\/file\\/d\\/([a-zA-Z0-9_-]{20,})/);
  if (m2 && m2[1]) return m2[1];

  // 3. https://drive.google.com/uc?export=download&id=FILE_ID
  var m3 = str.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m3 && m3[1]) return m3[1];

  // 4. https://drive.google.com/open?id=FILE_ID
  var m4 = str.match(/drive\\.google\\.com\\/open\\?id=([a-zA-Z0-9_-]{20,})/);
  if (m4 && m4[1]) return m4[1];

  // 5. File ID เปล่าๆ 25-60 ตัวอักษร
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(str)) {
    return str;
  }

  return '';
}

/**
 * ลบไฟล์ออกจาก Google Drive และแท็บ DriveFiles อัตโนมัติเมื่อมีการลบรายการในเว็บ
 * **ข้อบังคับเด็ดขาด**: ห้ามลบโฟลเดอร์โรงเรียน, root folder หรือ spreadsheet เด็ดขาด!
 */
function deleteDriveFileByUrlOrId(fileUrlOrId, payload) {
  var fileId = extractDriveFileId(fileUrlOrId);
  if (!fileId) return false;

  var p = payload || {};
  var prohibitedIds = [
    MASTER_SPREADSHEET_ID,
    DEFAULT_DRIVE_FOLDER_ID,
    p.spreadsheetId,
    p.schoolSpreadsheetId,
    p.driveFolderId,
    p.schoolDriveFolderId,
    p.folderId
  ].filter(Boolean).map(function(s) { return String(s).trim(); });

  for (var i = 0; i < prohibitedIds.length; i++) {
    if (fileId === prohibitedIds[i]) {
      return false; // ป้องกันการลบโฟลเดอร์โรงเรียนหรือ Spreadsheet เด็ดขาด!
    }
  }

  var trashed = false;
  try {
    var f = DriveApp.getFileById(fileId);
    if (f) {
      // ตรวจสอบเพิ่มเติมว่าเป็น Folder หรือไม่ (ห้ามลบโฟลเดอร์ใดๆ เด็ดขาด)
      var mime = f.getMimeType();
      if (mime === 'application/vnd.google-apps.folder') {
        return false;
      }
      f.setTrashed(true);
      trashed = true;
    }
  } catch (err) {}

  // ลบประวัติอ้างอิงออกจากแท็บ DriveFiles ใน Google Sheet ของโรงเรียน
  try {
    var ss = getTargetSpreadsheet(payload);
    var driveSheet = ss.getSheetByName('DriveFiles');
    if (driveSheet && driveSheet.getLastRow() > 1) {
      var dData = driveSheet.getDataRange().getValues();
      var dHeaders = dData[0].map(function(h) { return String(h).trim(); });
      var fidIdx = dHeaders.indexOf('driveFileId');
      var vUrlIdx = dHeaders.indexOf('driveViewUrl');
      var dlUrlIdx = dHeaders.indexOf('driveDownloadUrl');

      for (var j = dData.length - 1; j >= 1; j--) {
        var rowFid = fidIdx >= 0 ? String(dData[j][fidIdx]) : '';
        var rowVUrl = vUrlIdx >= 0 ? String(dData[j][vUrlIdx]) : '';
        var rowDlUrl = dlUrlIdx >= 0 ? String(dData[j][dlUrlIdx]) : '';
        if (rowFid === fileId || (rowVUrl && rowVUrl.indexOf(fileId) !== -1) || (rowDlUrl && rowDlUrl.indexOf(fileId) !== -1)) {
          driveSheet.deleteRow(j + 1);
        }
      }
    }
  } catch (sheetErr) {}

  return trashed;
}

/**
 * สแกนหาไฟล์ Google Drive ใน Object หรือ Array แล้วลบออกจาก Drive อัตโนมัติ
 */
function scanAndTrashDriveFilesInObject(obj, payload) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(function(item) {
      scanAndTrashDriveFilesInObject(item, payload);
    });
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(function(k) {
      var val = obj[k];
      if (val && typeof val === 'string') {
        var fid = extractDriveFileId(val);
        if (fid) {
          deleteDriveFileByUrlOrId(fid, payload);
        }
      } else if (val && typeof val === 'object') {
        scanAndTrashDriveFilesInObject(val, payload);
      }
    });
  }
}

/**
 * แปลง Base64 Data URL หรือ Base64 String แล้วบันทึกลง Google Drive ในโฟลเดอร์โรงเรียนนั้นๆ โดยตรง
 * พร้อมระบบป้องกันการอัปโหลดไฟล์ซ้ำ 100% (LockService + MD5 Content Hash + ชื่อและขนาดไฟล์)
 */
function saveBase64ToGoogleDrive(base64OrDataUrl, fileName, category, payload) {
  if (!base64OrDataUrl || typeof base64OrDataUrl !== 'string') return null;

  var mimeType = (payload && payload.mimeType) ? payload.mimeType : 'application/octet-stream';
  var base64Data = base64OrDataUrl;

  if (base64OrDataUrl.indexOf('data:') === 0 && base64OrDataUrl.indexOf(';base64,') !== -1) {
    var parts = base64OrDataUrl.split(';base64,');
    mimeType = parts[0].replace('data:', '') || mimeType;
    base64Data = parts[1];
  } else if (base64OrDataUrl.indexOf('http://') === 0 || base64OrDataUrl.indexOf('https://') === 0 || base64OrDataUrl.indexOf('/') === 0) {
    return null;
  }

  if (!base64Data || base64Data.length < 16) return null;

  var ext = '';
  if (mimeType.indexOf('png') !== -1) ext = '.png';
  else if (mimeType.indexOf('jpeg') !== -1 || mimeType.indexOf('jpg') !== -1) ext = '.jpg';
  else if (mimeType.indexOf('webp') !== -1) ext = '.webp';
  else if (mimeType.indexOf('gif') !== -1) ext = '.gif';
  else if (mimeType.indexOf('pdf') !== -1) ext = '.pdf';
  else if (mimeType.indexOf('word') !== -1 || mimeType.indexOf('document') !== -1) ext = '.docx';
  else if (mimeType.indexOf('sheet') !== -1 || mimeType.indexOf('excel') !== -1) ext = '.xlsx';

  var safeName = (fileName || ('file_' + new Date().getTime())).replace(/[\\\\/:*?"<>|]/g, '_');
  if (ext && safeName.toLowerCase().indexOf(ext) === -1 && safeName.indexOf('.') === -1) {
    safeName += ext;
  }

  // ใช้ LockService ป้องกันกรณีคำขอซิงค์ทำงานพร้อมกันแล้วสร้างไฟล์ซ้ำ
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(20000);
  } catch (lockErr) {}

  try {
    // บันทึกไฟล์ลง "โฟลเดอร์โรงเรียน" โดยตรงเท่านั้น (ไม่มีโฟลเดอร์ย่อย)
    var targetFolder = resolveSchoolDriveFolder(payload);
    var ss = getTargetSpreadsheet(payload);
    var driveHeaders = ['id', 'category', 'fileName', 'mimeType', 'fileSize', 'driveFileId', 'driveViewUrl', 'driveDownloadUrl', 'uploadedBy', 'uploadedAt'];
    var driveSheet = getOrCreateSheet(ss, 'DriveFiles', driveHeaders);

    var fileHash = computeBase64Md5Hash(base64Data);
    var hashRowId = 'drv-' + fileHash;
    var isImage = mimeType.indexOf('image/') === 0;

    // 1. ตรวจสอบจากตาราง DriveFiles ของโรงเรียนก่อนว่าเคยอัปโหลดไฟล์เนื้อหา (MD5 Hash) เดียวกันนี้แล้วหรือยัง
    try {
      if (driveSheet.getLastRow() > 1) {
        var existingRows = getSheetDataAsObjects(ss, 'DriveFiles');
        for (var r = 0; r < existingRows.length; r++) {
          var row = existingRows[r];
          if (row && String(row.id) === hashRowId && row.driveFileId) {
            try {
              var existingDriveFile = DriveApp.getFileById(String(row.driveFileId));
              if (existingDriveFile && !existingDriveFile.isTrashed()) {
                var existingId = existingDriveFile.getId();
                var existingDirectUrl = isImage
                  ? ('https://lh3.googleusercontent.com/d/' + existingId)
                  : ('https://drive.google.com/file/d/' + existingId + '/view?usp=sharing');
                return {
                  fileId: existingId,
                  fileName: existingDriveFile.getName(),
                  mimeType: mimeType,
                  fileUrl: existingDirectUrl,
                  viewUrl: existingDriveFile.getUrl(),
                  downloadUrl: 'https://drive.google.com/uc?export=download&id=' + existingId
                };
              }
            } catch (checkFileErr) {}
          }
        }
      }
    } catch (checkSheetErr) {}

    var decoded = Utilities.base64Decode(base64Data);

    // 2. ตรวจสอบในโฟลเดอร์โรงเรียนว่ามีไฟล์ชื่อเดียวกันและขนาดเท่ากันอยู่แล้วหรือไม่
    try {
      var existingIter = targetFolder.getFilesByName(safeName);
      while (existingIter.hasNext()) {
        var f = existingIter.next();
        if (!f.isTrashed() && f.getSize() === decoded.length) {
          var dupId = f.getId();
          var dupDirectUrl = isImage
            ? ('https://lh3.googleusercontent.com/d/' + dupId)
            : ('https://drive.google.com/file/d/' + dupId + '/view?usp=sharing');
          var dupDownloadUrl = 'https://drive.google.com/uc?export=download&id=' + dupId;
          try {
            upsertRowInSheet(driveSheet, driveHeaders, 'id', {
              id: hashRowId,
              category: category || 'ทั่วไป',
              fileName: safeName,
              mimeType: mimeType,
              fileSize: Math.round(decoded.length / 1024) + ' KB',
              driveFileId: dupId,
              driveViewUrl: dupDirectUrl,
              driveDownloadUrl: dupDownloadUrl,
              uploadedBy: (payload && payload.uploadedBy) || '',
              uploadedAt: new Date().toISOString()
            });
          } catch (upLogErr) {}
          return {
            fileId: dupId,
            fileName: safeName,
            mimeType: mimeType,
            fileUrl: dupDirectUrl,
            viewUrl: f.getUrl(),
            downloadUrl: dupDownloadUrl
          };
        }
      }
    } catch (folderCheckErr) {}

    // 3. สร้างไฟล์ใหม่ลงในโฟลเดอร์ประจำโรงเรียนนั้นๆ เพียง 1 ชิ้นเท่านั้น
    var blob = Utilities.newBlob(decoded, mimeType, safeName);
    var driveFile = targetFolder.createFile(blob);

    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}

    var fileId = driveFile.getId();
    var directUrl = isImage
      ? ('https://lh3.googleusercontent.com/d/' + fileId)
      : ('https://drive.google.com/file/d/' + fileId + '/view?usp=sharing');
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;

    // 4. บันทึกประวัติไฟล์ลงในแท็บ DriveFiles ของ Google Sheet โรงเรียน
    try {
      upsertRowInSheet(driveSheet, driveHeaders, 'id', {
        id: hashRowId,
        category: category || 'ทั่วไป',
        fileName: safeName,
        mimeType: mimeType,
        fileSize: Math.round(decoded.length / 1024) + ' KB',
        driveFileId: fileId,
        driveViewUrl: directUrl,
        driveDownloadUrl: downloadUrl,
        uploadedBy: (payload && payload.uploadedBy) || '',
        uploadedAt: new Date().toISOString()
      });
    } catch (logErr) {}

    return {
      fileId: fileId,
      fileName: safeName,
      mimeType: mimeType,
      fileUrl: directUrl,
      viewUrl: driveFile.getUrl(),
      downloadUrl: downloadUrl
    };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (relErr) {}
    }
  }
}

/**
 * Endpoint สำหรับอัปโหลดไฟล์ทุกประเภทลง Google Drive โดยตรง
 */
function handleUploadDriveFile(payload) {
  var base64Input = payload.fileBase64 || payload.fileData || payload.dataUrl || '';
  var fileName = payload.fileName || ('upload_' + new Date().getTime());
  var category = payload.category || 'general';

  var uploaded = saveBase64ToGoogleDrive(base64Input, fileName, category, payload);
  if (!uploaded) {
    return {
      status: 'error',
      message: 'ไม่พบข้อมูลไฟล์ Base64 สำหรับอัปโหลดลง Google Drive'
    };
  }

  return {
    status: 'success',
    fileId: uploaded.fileId,
    fileName: uploaded.fileName,
    fileUrl: uploaded.fileUrl,
    viewUrl: uploaded.viewUrl,
    downloadUrl: uploaded.downloadUrl,
    message: 'อัปโหลดไฟล์ "' + uploaded.fileName + '" ลง Google Drive สำเร็จ'
  };
}

/**
 * ฟังก์ชันสแกนหา Base64 ใน Object แล้วบันทึกลงโฟลเดอร์ Google Drive ของโรงเรียน
 * ป้องกันการอัปโหลดซ้ำ 100% (ส่ง 1 ชิ้น = อัปโหลด 1 ชิ้น)
 */
function processObjectFilesToDrive(obj, defaultCategory, payload) {
  if (!obj || typeof obj !== 'object') return obj;
  var clone = JSON.parse(JSON.stringify(obj));
  var uploadedCache = {};

  // 1. ประมวลผลรายการส่งงานของสมาชิกใน Tasks (submissions array)
  var latestSubmissionDriveUrl = '';
  if (Array.isArray(clone.submissions)) {
    clone.submissions = clone.submissions.map(function(sub) {
      if (sub && typeof sub.fileUrl === 'string' && sub.fileUrl.indexOf('data:') === 0 && sub.fileUrl.indexOf(';base64,') !== -1) {
        try {
          var rawBase64 = sub.fileUrl;
          var upSub = uploadedCache[rawBase64];
          if (!upSub) {
            var subFileName = (sub.memberName ? sub.memberName + '_' : '') + (sub.fileName || 'submission');
            upSub = saveBase64ToGoogleDrive(rawBase64, subFileName, 'งานมอบหมายและการส่งงาน', payload);
            if (upSub) {
              uploadedCache[rawBase64] = upSub;
            }
          }
          if (upSub && upSub.fileUrl) {
            sub.fileUrl = upSub.fileUrl;
            sub.driveFileId = upSub.fileId;
            latestSubmissionDriveUrl = upSub.fileUrl;
          }
        } catch (eSub) {}
      } else if (sub && typeof sub.fileUrl === 'string' && sub.fileUrl.indexOf('http') === 0) {
        latestSubmissionDriveUrl = sub.fileUrl;
      }
      return sub;
    });
  }

  // 2. หาก submittedFileUrl เป็น Base64 และมีใน submissions ที่อัปโหลดแล้ว ให้ใช้ URL เดียวกันทันที
  if (typeof clone.submittedFileUrl === 'string' && clone.submittedFileUrl.indexOf('data:') === 0) {
    if (uploadedCache[clone.submittedFileUrl] && uploadedCache[clone.submittedFileUrl].fileUrl) {
      clone.submittedFileUrl = uploadedCache[clone.submittedFileUrl].fileUrl;
    } else if (latestSubmissionDriveUrl) {
      clone.submittedFileUrl = latestSubmissionDriveUrl;
    }
  }

  var fileFields = [
    { field: 'logoUrl', namePrefix: 'logo_', cat: defaultCategory || 'โลโก้โรงเรียน' },
    { field: 'photoUrl', namePrefix: 'photo_', cat: defaultCategory || 'รูปภาพ' },
    { field: 'avatarUrl', namePrefix: 'avatar_', cat: 'รูปโปรไฟล์' },
    { field: 'attachmentUrl', namePrefix: 'attachment_', cat: 'งานมอบหมายและการส่งงาน' },
    { field: 'submittedFileUrl', namePrefix: 'submission_', cat: 'งานมอบหมายและการส่งงาน' },
    { field: 'fileUrl', namePrefix: 'file_', cat: defaultCategory || 'ศูนย์เอกสาร' },
    { field: 'fileData', namePrefix: 'doc_', cat: defaultCategory || 'ศูนย์เอกสาร' }
  ];

  fileFields.forEach(function(ff) {
    var val = clone[ff.field];
    if (typeof val === 'string' && val.indexOf('data:') === 0 && val.indexOf(';base64,') !== -1) {
      var customName = clone.fileName || clone.submittedFileName || clone.title || clone.schoolName || clone.firstName || clone.fullName || (ff.namePrefix + (clone.id || new Date().getTime()));
      try {
        var up = uploadedCache[val];
        if (!up) {
          up = saveBase64ToGoogleDrive(val, customName, ff.cat, payload);
          if (up) {
            uploadedCache[val] = up;
          }
        }
        if (up && up.fileUrl) {
          clone[ff.field] = up.fileUrl;
          if (ff.field === 'fileData' || ff.field === 'fileUrl') {
            clone.fileUrl = up.fileUrl;
            clone.driveFileId = up.fileId;
            if (clone.fileData) {
              delete clone.fileData;
            }
          }
        }
      } catch (e) {}
    }
  });

  return clone;
}

/**
 * ============================================================================
 * SECTION C: ฟังก์ชันบันทึกและลบข้อมูลแต่ละโมดูลใน Google Sheets & Drive
 * ============================================================================
 */

function handleSaveSchoolInfo(payload) {
  var ss = getTargetSpreadsheet(payload);
  var rawInfo = payload.schoolInfo || {};
  var info = processObjectFilesToDrive(rawInfo, 'โลโก้โรงเรียน', payload);

  var headers = ['schoolName', 'schoolCode', 'affiliation', 'address', 'phone', 'email', 'directorName', 'academicYear', 'semester', 'logoUrl', 'driveLogoUrl', 'updatedAt'];
  var sheet = getOrCreateSheet(ss, 'Settings', headers);

  sheet.clearContents();
  sheet.appendRow(headers);
  sheet.appendRow([
    info.schoolName || '',
    info.schoolCode || '',
    info.affiliation || '',
    info.address || '',
    info.phone || '',
    info.email || '',
    info.directorName || '',
    info.academicYear || '',
    info.semester || '',
    info.logoUrl || '',
    info.logoUrl || '',
    new Date().toISOString()
  ]);

  return { status: 'success', message: 'บันทึกข้อมูลโรงเรียนและโลโก้ลง Google Sheets & Drive สำเร็จ', logoUrl: info.logoUrl, schoolInfo: info };
}

function handleSaveStudent(payload) {
  var ss = getTargetSpreadsheet(payload);
  var s = processObjectFilesToDrive(payload.student || {}, 'รูปภาพนักเรียน', payload);
  var headers = ['id', 'rollNumber', 'studentCode', 'prefix', 'firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'age', 'religion', 'gradeLevel', 'room', 'address', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'guardianName', 'guardianPhone', 'dailyAllowance', 'photoUrl', 'status', 'fullDataJson'];
  var sheet = getOrCreateSheet(ss, 'Students', headers);

  var rowObj = JSON.parse(JSON.stringify(s));
  rowObj.fullDataJson = safeJsonStringify(s);
  upsertRowInSheet(sheet, headers, 'id', rowObj);

  return { status: 'success', message: 'บันทึกข้อมูลนักเรียนสำเร็จ', student: s };
}

function handleSavePersonnel(payload) {
  var ss = getTargetSpreadsheet(payload);
  var p = processObjectFilesToDrive(payload.personnel || {}, 'รูปภาพบุคลากร', payload);
  var headers = ['id', 'personnelCode', 'prefix', 'firstName', 'lastName', 'gender', 'birthDate', 'age', 'position', 'academicStanding', 'department', 'assignedClass', 'education', 'major', 'phone', 'email', 'photoUrl', 'status'];
  var sheet = getOrCreateSheet(ss, 'Personnel', headers);
  upsertRowInSheet(sheet, headers, 'id', p);
  return { status: 'success', message: 'บันทึกข้อมูลบุคลากรสำเร็จ', personnel: p };
}

function handleSaveMember(payload) {
  var ss = getTargetSpreadsheet(payload);
  var m = processObjectFilesToDrive(payload.member || {}, 'รูปโปรไฟล์สมาชิก', payload);
  var headers = ['id', 'username', 'password', 'prefix', 'fullName', 'firstName', 'lastName', 'role', 'gradeLevel', 'position', 'learningGroup', 'schoolId', 'schoolName', 'isSuspended', 'avatarUrl'];
  var sheet = getOrCreateSheet(ss, 'Members', headers);
  upsertRowInSheet(sheet, headers, 'id', m);

  // ซิงค์สมาชิกลงในชีต Members ของ Master Spreadsheet ด้วย
  if (MASTER_SPREADSHEET_ID) {
    try {
      var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
      var masterMembersSheet = getOrCreateSheet(masterSS, 'Members', headers);
      upsertRowInSheet(masterMembersSheet, headers, 'id', m);
    } catch (eMasterMem) {}
  }

  return { status: 'success', message: 'บันทึกข้อมูลผู้ใช้งานสำเร็จ', member: m };
}

function handleSaveDailyTracking(payload) {
  var ss = getTargetSpreadsheet(payload);
  var r = payload.record || {};
  var headers = ['id', 'date', 'studentId', 'milkStatus', 'toothBrushing', 'semester', 'academicYear'];
  var sheet = getOrCreateSheet(ss, 'DailyTracking', headers);
  if (!r.id) {
    r.id = (r.date || '') + '_' + (r.studentId || '');
  }
  upsertRowInSheet(sheet, headers, 'id', r);
  return { status: 'success', message: 'บันทึกการดื่มนม/แปรงฟันสำเร็จ' };
}

function handleSaveSubject(payload) {
  var ss = getTargetSpreadsheet(payload);
  var s = payload.subject || {};
  var headers = ['id', 'code', 'name', 'gradeLevel', 'credits', 'hoursPerYear', 'subjectGroup', 'semester', 'academicYear', 'teacherId', 'teacherName', 'scoreRatio', 'assignmentItemsJson'];
  var sheet = getOrCreateSheet(ss, 'Subjects', headers);
  var rowObj = JSON.parse(JSON.stringify(s));
  rowObj.assignmentItemsJson = safeJsonStringify(s.assignmentItems || []);
  upsertRowInSheet(sheet, headers, 'id', rowObj);
  return { status: 'success', message: 'บันทึกข้อมูลรายวิชาสำเร็จ' };
}

function handleSaveGrades(payload) {
  var ss = getTargetSpreadsheet(payload);
  var grades = Array.isArray(payload.grades) ? payload.grades : (payload.grade ? [payload.grade] : []);
  var headers = ['id', 'studentId', 'subjectId', 'semester', 'academicYear', 'assignmentScoresJson', 'collectedScore', 'midtermScore', 'finalScore', 'totalScore', 'grade'];
  var sheet = getOrCreateSheet(ss, 'Grades', headers);
  grades.forEach(function(g) {
    var rowObj = JSON.parse(JSON.stringify(g));
    if (!rowObj.id) {
      rowObj.id = (g.studentId || '') + '_' + (g.subjectId || '') + '_' + (g.semester || '1') + '_' + (g.academicYear || '2569');
    }
    rowObj.assignmentScoresJson = safeJsonStringify(g.assignmentScores || {});
    upsertRowInSheet(sheet, headers, 'id', rowObj);
  });
  return { status: 'success', message: 'บันทึกผลการเรียนสำเร็จ', count: grades.length };
}

function handleSaveAttendance(payload) {
  var ss = getTargetSpreadsheet(payload);
  var records = Array.isArray(payload.records) ? payload.records : (payload.record ? [payload.record] : []);
  var headers = ['id', 'date', 'studentId', 'status', 'note', 'semester', 'academicYear'];
  var sheet = getOrCreateSheet(ss, 'Attendance', headers);
  records.forEach(function(r) {
    var rowObj = JSON.parse(JSON.stringify(r));
    if (!rowObj.id) {
      rowObj.id = (r.date || '') + '_' + (r.studentId || '');
    }
    upsertRowInSheet(sheet, headers, 'id', rowObj);
  });
  return { status: 'success', message: 'บันทึกเวลาเรียนสำเร็จ', count: records.length };
}

function handleSaveAttendanceConfig(payload) {
  var ss = getTargetSpreadsheet(payload);
  var cfg = payload.config || {};
  var headers = ['id', 'semester', 'academicYear', 'startDate', 'endDate', 'targetDays', 'holidaysJson', 'schoolDaysJson'];
  var sheet = getOrCreateSheet(ss, 'AttendanceConfig', headers);
  var cfgId = (cfg.semester || '1') + '_' + (cfg.academicYear || '2569');
  var rowObj = {
    id: cfgId,
    semester: cfg.semester || '1',
    academicYear: cfg.academicYear || '2569',
    startDate: cfg.startDate || '',
    endDate: cfg.endDate || '',
    targetDays: cfg.targetDays || 0,
    holidaysJson: safeJsonStringify(cfg.holidays || []),
    schoolDaysJson: safeJsonStringify(cfg.schoolDays || [])
  };
  upsertRowInSheet(sheet, headers, 'id', rowObj);
  return { status: 'success', message: 'บันทึกการตั้งค่าเวลาเรียนสำเร็จ' };
}

function handleSaveSavings(payload) {
  var ss = getTargetSpreadsheet(payload);
  var r = payload.record || {};
  var headers = ['id', 'date', 'studentId', 'type', 'amount', 'balanceAfter', 'note', 'recordedBy', 'semester', 'academicYear'];
  var sheet = getOrCreateSheet(ss, 'Savings', headers);
  if (!r.id) {
    r.id = 'sav-' + new Date().getTime();
  }
  upsertRowInSheet(sheet, headers, 'id', r);
  return { status: 'success', message: 'บันทึกรายการออมทรัพย์สำเร็จ' };
}

function handleSetAllSavings(payload) {
  var ss = getTargetSpreadsheet(payload);
  var records = payload.records || [];
  var headers = ['id', 'date', 'studentId', 'type', 'amount', 'balanceAfter', 'note', 'recordedBy', 'semester', 'academicYear'];
  replaceEntireSheetData(ss, 'Savings', headers, records);
  return { status: 'success', message: 'อัปเดตข้อมูลออมทรัพย์ทั้งหมดสำเร็จ' };
}

function handleSaveTask(payload) {
  var ss = getTargetSpreadsheet(payload);
  var t = processObjectFilesToDrive(payload.task || {}, 'งานมอบหมายและการส่งงาน', payload);
  var headers = ['id', 'title', 'description', 'type', 'priority', 'dueDate', 'isCompleted', 'isManualCompleted', 'createdBy', 'assignedTo', 'attachmentUrl', 'submissionsCount', 'submissionsJson'];
  var sheet = getOrCreateSheet(ss, 'Tasks', headers);

  var subs = Array.isArray(t.submissions) ? t.submissions : [];
  var rowObj = JSON.parse(JSON.stringify(t));
  rowObj.submissionsCount = subs.length;
  rowObj.submissionsJson = safeJsonStringify(subs);
  upsertRowInSheet(sheet, headers, 'id', rowObj);

  // บันทึกรายการส่งงานของสมาชิกลงในแท็บ TaskSubmissions ด้วย
  if (subs.length > 0) {
    var subHeaders = ['id', 'taskId', 'taskTitle', 'memberId', 'memberName', 'fileName', 'fileSize', 'fileUrl', 'submittedAt'];
    var subSheet = getOrCreateSheet(ss, 'TaskSubmissions', subHeaders);
    subs.forEach(function(sub) {
      upsertRowInSheet(subSheet, subHeaders, 'id', {
        id: t.id + '__' + sub.memberId,
        taskId: t.id,
        taskTitle: t.title || '',
        memberId: sub.memberId || '',
        memberName: sub.memberName || '',
        fileName: sub.fileName || '',
        fileSize: sub.fileSize || '',
        fileUrl: sub.fileUrl || '',
        submittedAt: sub.submittedAt || new Date().toISOString()
      });
    });
  }

  return {
    status: 'success',
    message: 'บันทึกงานมอบหมายและไฟล์ส่งงานลง Google Sheets & Drive สำเร็จ',
    task: t
  };
}

function handleSaveAllTasks(payload) {
  var ss = getTargetSpreadsheet(payload);
  var tasks = (payload.tasks || []).map(function(t) {
    var processed = processObjectFilesToDrive(t, 'งานมอบหมายและการส่งงาน', payload);
    processed.submissionsCount = Array.isArray(processed.submissions) ? processed.submissions.length : 0;
    processed.submissionsJson = safeJsonStringify(processed.submissions || []);
    return processed;
  });
  var headers = ['id', 'title', 'description', 'type', 'priority', 'dueDate', 'isCompleted', 'isManualCompleted', 'createdBy', 'assignedTo', 'attachmentUrl', 'submissionsCount', 'submissionsJson'];
  replaceEntireSheetData(ss, 'Tasks', headers, tasks);
  return { status: 'success', message: 'จัดเรียงและบันทึกงานมอบหมายทั้งหมดสำเร็จ', tasks: tasks };
}

function handleCompleteTask(payload) {
  var ss = getTargetSpreadsheet(payload);
  var sheet = ss.getSheetByName('Tasks');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีต Tasks' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(payload.id)) {
      sheet.getRange(i + 1, 7).setValue(true);
      sheet.getRange(i + 1, 8).setValue(true);
      return { status: 'success', message: 'อัปเดตสถานะส่งงานสำเร็จ' };
    }
  }
  return { status: 'warning', message: 'ไม่พบรหัสงานที่ระบุ' };
}

/**
 * ลบงานมอบหมาย และลบไฟล์แนบ + ไฟล์ส่งงานทั้งหมดใน Google Drive ออกอัตโนมัติ
 * (ห้ามลบโฟลเดอร์โรงเรียนเด็ดขาด)
 */
function handleDeleteTask(payload) {
  var ss = getTargetSpreadsheet(payload);
  var taskId = payload.id || payload.taskId || '';
  if (!taskId) {
    return { status: 'error', message: 'ไม่พบรหัสงานที่ต้องการลบ' };
  }

  // ลบไฟล์แนบจาก payload โดยตรงถ้าส่งมา
  if (payload.attachmentUrl) {
    deleteDriveFileByUrlOrId(payload.attachmentUrl, payload);
  }
  if (Array.isArray(payload.submissions)) {
    payload.submissions.forEach(function(sub) {
      if (sub && (sub.fileUrl || sub.driveFileId)) {
        deleteDriveFileByUrlOrId(sub.driveFileId || sub.fileUrl, payload);
      }
    });
  }

  // 1. ค้นหาแถวงานในชีต Tasks เพื่อดึง attachmentUrl และ submissionsJson แล้วลบไฟล์ใน Drive
  var sheet = ss.getSheetByName('Tasks');
  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var idIdx = headers.indexOf('id');
    var attIdx = headers.indexOf('attachmentUrl');
    var subIdx = headers.indexOf('submissionsJson');

    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][idIdx >= 0 ? idIdx : 0]) === String(taskId)) {
        var attUrl = attIdx >= 0 ? String(data[i][attIdx] || '') : '';
        if (attUrl) {
          deleteDriveFileByUrlOrId(attUrl, payload);
        }

        var subsStr = subIdx >= 0 ? String(data[i][subIdx] || '') : '';
        if (subsStr) {
          try {
            var subsArr = JSON.parse(subsStr);
            if (Array.isArray(subsArr)) {
              subsArr.forEach(function(sub) {
                if (sub && (sub.fileUrl || sub.driveFileId)) {
                  deleteDriveFileByUrlOrId(sub.driveFileId || sub.fileUrl, payload);
                }
              });
            }
          } catch (eParse) {}
        }

        sheet.deleteRow(i + 1);
      }
    }
  }

  // 2. ลบแถวในชีต TaskSubmissions ของงานนี้ พร้อมลบไฟล์ใน Google Drive
  var subSheet = ss.getSheetByName('TaskSubmissions');
  if (subSheet && subSheet.getLastRow() > 1) {
    var sData = subSheet.getDataRange().getValues();
    var sHeaders = sData[0].map(function(h) { return String(h).trim(); });
    var sTaskIdIdx = sHeaders.indexOf('taskId');
    var sFileUrlIdx = sHeaders.indexOf('fileUrl');

    for (var j = sData.length - 1; j >= 1; j--) {
      if (String(sData[j][sTaskIdIdx >= 0 ? sTaskIdIdx : 1]) === String(taskId)) {
        var subFileUrl = sFileUrlIdx >= 0 ? String(sData[j][sFileUrlIdx] || '') : '';
        if (subFileUrl) {
          deleteDriveFileByUrlOrId(subFileUrl, payload);
        }
        subSheet.deleteRow(j + 1);
      }
    }
  }

  return {
    status: 'success',
    taskId: taskId,
    message: 'ลบงานมอบหมาย และลบไฟล์ทั้งหมดที่เกี่ยวข้องออกจาก Google Drive และ Google Sheets สำเร็จ'
  };
}

function handleUploadDocument(payload) {
  var ss = getTargetSpreadsheet(payload);
  var doc = processObjectFilesToDrive(payload, 'ศูนย์เอกสารและคำสั่ง', payload);
  var headers = ['id', 'docNumber', 'title', 'docType', 'category', 'date', 'fileUrl', 'fileName', 'fileSize', 'uploadedBy', 'driveFileId'];
  var sheet = getOrCreateSheet(ss, 'Documents', headers);

  var docRecord = {
    id: doc.id || ('doc-' + new Date().getTime()),
    docNumber: doc.docNumber || '-',
    title: doc.title || '',
    docType: doc.docType || 'document',
    category: doc.category || 'เอกสารทั่วไป',
    date: doc.date || new Date().toISOString().split('T')[0],
    fileUrl: doc.fileUrl || '#',
    fileName: doc.fileName || '',
    fileSize: doc.fileSize || '',
    uploadedBy: doc.uploadedBy || '',
    driveFileId: doc.driveFileId || ''
  };

  upsertRowInSheet(sheet, headers, 'id', docRecord);
  return {
    status: 'success',
    message: 'อัปโหลดเอกสารเข้าสู่ Google Drive และบันทึกตารางสำเร็จ',
    fileUrl: docRecord.fileUrl,
    driveFileId: docRecord.driveFileId,
    document: docRecord
  };
}

function handleSaveAllDocuments(payload) {
  var ss = getTargetSpreadsheet(payload);
  var docs = (payload.documents || []).map(function(d) {
    return processObjectFilesToDrive(d, 'ศูนย์เอกสารและคำสั่ง', payload);
  });
  var headers = ['id', 'docNumber', 'title', 'docType', 'category', 'date', 'fileUrl', 'fileName', 'fileSize', 'uploadedBy', 'driveFileId'];
  replaceEntireSheetData(ss, 'Documents', headers, docs);
  return { status: 'success', message: 'บันทึกข้อมูลเอกสารทั้งหมดสำเร็จ', documents: docs };
}

/**
 * ลบเอกสารและไฟล์ใน Google Drive ออกอัตโนมัติ (ห้ามลบโฟลเดอร์โรงเรียนเด็ดขาด)
 */
function handleDeleteDocument(payload) {
  var ss = getTargetSpreadsheet(payload);
  var docId = payload.id || payload.docId || '';
  var sheet = ss.getSheetByName('Documents');
  var deletedCount = 0;

  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var idIdx = headers.indexOf('id');
    var driveIdIdx = headers.indexOf('driveFileId');
    var fileUrlIdx = headers.indexOf('fileUrl');

    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][idIdx >= 0 ? idIdx : 0]) === String(docId)) {
        var driveFileId = driveIdIdx >= 0 ? String(data[i][driveIdIdx] || '') : '';
        var fileUrl = fileUrlIdx >= 0 ? String(data[i][fileUrlIdx] || '') : '';

        if (driveFileId) {
          deleteDriveFileByUrlOrId(driveFileId, payload);
        } else if (fileUrl) {
          deleteDriveFileByUrlOrId(fileUrl, payload);
        }

        sheet.deleteRow(i + 1);
        deletedCount++;
      }
    }
  }

  // หากส่ง driveFileId หรือ fileUrl มาใน payload โดยตรงให้ลบด้วย
  if (payload.driveFileId) {
    deleteDriveFileByUrlOrId(payload.driveFileId, payload);
  } else if (payload.fileUrl) {
    deleteDriveFileByUrlOrId(payload.fileUrl, payload);
  }

  return {
    status: 'success',
    deletedRows: deletedCount,
    message: 'ลบเอกสารและไฟล์ออกจาก Google Drive และ Google Sheets สำเร็จ'
  };
}

function handleSaveWebsite(payload) {
  var ss = getTargetSpreadsheet(payload);
  var w = processObjectFilesToDrive(payload.website || {}, 'โลโก้เว็บไซต์แนะนำ', payload);
  var headers = ['id', 'title', 'url', 'category', 'description', 'isOfficial', 'logoUrl'];
  var sheet = getOrCreateSheet(ss, 'Websites', headers);
  upsertRowInSheet(sheet, headers, 'id', w);
  return { status: 'success', message: 'บันทึกเว็บไซต์และโลโก้ลง Google Sheets & Drive สำเร็จ', logoUrl: w.logoUrl, website: w };
}

function handleSaveAllWebsites(payload) {
  var ss = getTargetSpreadsheet(payload);
  var websites = (payload.websites || []).map(function(w) {
    return processObjectFilesToDrive(w, 'โลโก้เว็บไซต์แนะนำ', payload);
  });
  var headers = ['id', 'title', 'url', 'category', 'description', 'isOfficial', 'logoUrl'];
  replaceEntireSheetData(ss, 'Websites', headers, websites);
  return { status: 'success', message: 'บันทึกเว็บไซต์แนะนำทั้งหมดสำเร็จ', websites: websites };
}

function handleSaveCalendarEvent(payload) {
  var ss = getTargetSpreadsheet(payload);
  var ev = payload.event || {};
  var headers = ['id', 'title', 'date', 'type', 'description', 'announcement', 'taskDue', 'taskPriority', 'linkedTaskIdsJson'];
  var sheet = getOrCreateSheet(ss, 'Calendar', headers);
  var rowObj = JSON.parse(JSON.stringify(ev));
  rowObj.linkedTaskIdsJson = safeJsonStringify(ev.linkedTaskIds || []);
  upsertRowInSheet(sheet, headers, 'id', rowObj);
  return { status: 'success', message: 'บันทึกกิจกรรมในปฏิทินวิชาการสำเร็จ' };
}

/**
 * ============================================================================
 * SECTION D: ซิงค์ข้อมูลทุกคีย์ของโรงเรียนอัตโนมัติ (handleSyncTenantKey & handleSyncAll)
 * ============================================================================
 */

function handleSyncTenantKey(payload) {
  var ss = getTargetSpreadsheet(payload);
  var baseKey = String(payload.baseKey || payload.key || '');
  var value = payload.value;

  if (!baseKey) {
    return { status: 'error', message: 'ไม่พบชื่อคีย์ข้อมูล (baseKey)' };
  }

  // 1. บันทึกลงในตารางเฉพาะของแต่ละโมดูลใน Google Sheet ของโรงเรียนให้อ่านง่าย
  try {
    if (baseKey === 'ams_school_info' && value && typeof value === 'object') {
      handleSaveSchoolInfo({ spreadsheetId: ss.getId(), schoolInfo: value, schoolId: payload.schoolId, schoolName: value.schoolName || payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
    } else if (baseKey === 'ams_students' && Array.isArray(value)) {
      var stdHeaders = ['id', 'rollNumber', 'studentCode', 'prefix', 'firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'age', 'religion', 'gradeLevel', 'room', 'address', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'guardianName', 'guardianPhone', 'dailyAllowance', 'photoUrl', 'status', 'fullDataJson'];
      var stdRows = value.map(function(s) {
        var cleanS = processObjectFilesToDrive(s, 'รูปภาพนักเรียน', payload);
        cleanS.fullDataJson = safeJsonStringify(cleanS);
        return cleanS;
      });
      replaceEntireSheetData(ss, 'Students', stdHeaders, stdRows);
    } else if (baseKey === 'ams_personnel' && Array.isArray(value)) {
      var perHeaders = ['id', 'personnelCode', 'prefix', 'firstName', 'lastName', 'gender', 'birthDate', 'age', 'position', 'academicStanding', 'department', 'assignedClass', 'education', 'major', 'phone', 'email', 'photoUrl', 'status'];
      var perRows = value.map(function(p) { return processObjectFilesToDrive(p, 'รูปภาพบุคลากร', payload); });
      replaceEntireSheetData(ss, 'Personnel', perHeaders, perRows);
    } else if (baseKey === 'ams_subjects' && Array.isArray(value)) {
      var subHeaders = ['id', 'code', 'name', 'gradeLevel', 'credits', 'hoursPerYear', 'subjectGroup', 'semester', 'academicYear', 'teacherId', 'teacherName', 'scoreRatio', 'assignmentItemsJson'];
      var subRows = value.map(function(s) {
        var r = JSON.parse(JSON.stringify(s));
        r.assignmentItemsJson = safeJsonStringify(s.assignmentItems || []);
        return r;
      });
      replaceEntireSheetData(ss, 'Subjects', subHeaders, subRows);
    } else if (baseKey === 'ams_grades' && Array.isArray(value)) {
      var grdHeaders = ['id', 'studentId', 'subjectId', 'semester', 'academicYear', 'assignmentScoresJson', 'collectedScore', 'midtermScore', 'finalScore', 'totalScore', 'grade'];
      var grdRows = value.map(function(g) {
        var r = JSON.parse(JSON.stringify(g));
        r.assignmentScoresJson = safeJsonStringify(g.assignmentScores || {});
        return r;
      });
      replaceEntireSheetData(ss, 'Grades', grdHeaders, grdRows);
    } else if (baseKey === 'ams_attendance' && Array.isArray(value)) {
      replaceEntireSheetData(ss, 'Attendance', ['id', 'date', 'studentId', 'status', 'note', 'semester', 'academicYear'], value);
    } else if (baseKey === 'ams_attendance_config' && value && typeof value === 'object') {
      handleSaveAttendanceConfig({ spreadsheetId: ss.getId(), config: value });
    } else if (baseKey === 'ams_savings' && Array.isArray(value)) {
      replaceEntireSheetData(ss, 'Savings', ['id', 'date', 'studentId', 'type', 'amount', 'balanceAfter', 'note', 'recordedBy', 'semester', 'academicYear'], value);
    } else if (baseKey === 'ams_daily_tracking' && Array.isArray(value)) {
      replaceEntireSheetData(ss, 'DailyTracking', ['id', 'date', 'studentId', 'milkStatus', 'toothBrushing', 'semester', 'academicYear'], value);
    } else if (baseKey === 'ams_tasks' && Array.isArray(value)) {
      handleSaveAllTasks({ spreadsheetId: ss.getId(), tasks: value, schoolId: payload.schoolId, schoolName: payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
    } else if (baseKey === 'ams_documents' && Array.isArray(value)) {
      handleSaveAllDocuments({ spreadsheetId: ss.getId(), documents: value, schoolId: payload.schoolId, schoolName: payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
    } else if (baseKey === 'ams_websites' && Array.isArray(value)) {
      handleSaveAllWebsites({ spreadsheetId: ss.getId(), websites: value, schoolId: payload.schoolId, schoolName: payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
    } else if (baseKey === 'ams_calendar' && Array.isArray(value)) {
      var calHeaders = ['id', 'title', 'date', 'type', 'description', 'announcement', 'taskDue', 'taskPriority', 'linkedTaskIdsJson'];
      var calRows = value.map(function(c) {
        var r = JSON.parse(JSON.stringify(c));
        r.linkedTaskIdsJson = safeJsonStringify(c.linkedTaskIds || []);
        return r;
      });
      replaceEntireSheetData(ss, 'Calendar', calHeaders, calRows);
    } else if (baseKey === 'ams_leave_requests_v1' && Array.isArray(value)) {
      var lvHeaders = ['id', 'teacherName', 'leaveType', 'startDate', 'endDate', 'reason', 'contactAddress', 'mobilePhone', 'directorName', 'personnelOfficer', 'status', 'createdAt', 'priorSickDays', 'priorPersonalDays', 'priorMaternityDays'];
      replaceEntireSheetData(ss, 'LeaveRequests', lvHeaders, value);
    } else if (baseKey === 'ams_duty_assignments_v1' && Array.isArray(value)) {
      replaceEntireSheetData(ss, 'DutyAssignments', ['id', 'dayOfWeek', 'teacherNames', 'dutyType', 'location', 'note'], value);
    } else if (baseKey === 'ams_daily_duty_logs_v1' && Array.isArray(value)) {
      var dlHeaders = ['id', 'date', 'dayOfWeek', 'dutyTeachers', 'dutyTimeSlot', 'absentTeachersCount', 'absentTeachersDetail', 'studentsMalePresent', 'studentsFemalePresent', 'incidentMorning', 'incidentNoon', 'incidentAfternoon', 'overallStatus', 'AllowanceNote', 'recorderName', 'createdAt'];
      replaceEntireSheetData(ss, 'DailyDutyLogs', dlHeaders, value);
    } else if (baseKey === 'ams_comment_sessions' && Array.isArray(value)) {
      replaceEntireSheetData(ss, 'CommentSessions', ['id', 'title', 'date', 'academicYear', 'semester', 'createdAt'], value);
    } else if (baseKey === 'ams_behavior_evaluations' && value && typeof value === 'object') {
      var behHeaders = ['id', 'studentId', 'sessionId', 'academicYear', 'semester', 'score', 'level', 'comment', 'evaluatedBy', 'updatedAt', 'fullDataJson'];
      var behRows = Object.keys(value).map(function(k) {
        var item = value[k] || {};
        return {
          id: k,
          studentId: item.studentId || '',
          sessionId: item.sessionId || '',
          academicYear: item.academicYear || '',
          semester: item.semester || '',
          score: item.score || 0,
          level: item.level || '',
          comment: item.comment || '',
          evaluatedBy: item.evaluatedBy || '',
          updatedAt: item.updatedAt || '',
          fullDataJson: safeJsonStringify(item)
        };
      });
      replaceEntireSheetData(ss, 'BehaviorEvaluations', behHeaders, behRows);
    } else if (baseKey === 'ams_phorphor6' && value && typeof value === 'object') {
      var p6Headers = ['id', 'studentId', 'academicYear', 'semester', 'gradeLevel', 'teacherComment', 'directorComment', 'updatedAt', 'fullDataJson'];
      var p6Rows = Object.keys(value).map(function(k) {
        var item = value[k] || {};
        return {
          id: k,
          studentId: item.studentId || '',
          academicYear: item.academicYear || '',
          semester: item.semester || '',
          gradeLevel: item.gradeLevel || '',
          teacherComment: item.teacherComment || '',
          directorComment: item.directorComment || '',
          updatedAt: item.updatedAt || '',
          fullDataJson: safeJsonStringify(item)
        };
      });
      replaceEntireSheetData(ss, 'PhorPhor6', p6Headers, p6Rows);
    } else if (baseKey === 'ams_assessment_3_booklets' && value && typeof value === 'object') {
      var a3Headers = ['id', 'studentId', 'academicYear', 'semester', 'readingScore', 'characteristicsScore', 'competenciesScore', 'activityResult', 'updatedAt', 'fullDataJson'];
      var a3Rows = Object.keys(value).map(function(k) {
        var item = value[k] || {};
        return {
          id: k,
          studentId: item.studentId || '',
          academicYear: item.academicYear || '',
          semester: item.semester || '',
          readingScore: item.readingScore || 0,
          characteristicsScore: item.characteristicsScore || 0,
          competenciesScore: item.competenciesScore || 0,
          activityResult: item.activityResult || '',
          updatedAt: item.updatedAt || '',
          fullDataJson: safeJsonStringify(item)
        };
      });
      replaceEntireSheetData(ss, 'Assessment3Booklets', a3Headers, a3Rows);
    } else if (baseKey === 'ams_reading_writing' && value && typeof value === 'object') {
      var rwHeaders = ['id', 'academicYear', 'semester', 'gradeLevel', 'dataJson', 'updatedAt'];
      var rwRows = Object.keys(value).map(function(k) {
        var item = value[k] || {};
        return {
          id: k,
          academicYear: item.academicYear || '',
          semester: item.semester || '',
          gradeLevel: item.gradeLevel || '',
          dataJson: safeJsonStringify(item),
          updatedAt: item.updatedAt || new Date().toISOString()
        };
      });
      replaceEntireSheetData(ss, 'ReadingWriting', rwHeaders, rwRows);
    } else if (baseKey === 'ams_weight_height' && value && typeof value === 'object') {
      var whHeaders = ['id', 'sessionId', 'academicYear', 'semester', 'studentRecordsJson', 'updatedAt'];
      var whRows = Object.keys(value).map(function(k) {
        var item = value[k] || {};
        return {
          id: k,
          sessionId: item.sessionId || k,
          academicYear: item.academicYear || '',
          semester: item.semester || '',
          studentRecordsJson: safeJsonStringify(item.studentRecords || item),
          updatedAt: item.updatedAt || new Date().toISOString()
        };
      });
      replaceEntireSheetData(ss, 'WeightHeight', whHeaders, whRows);
    } else if (baseKey === 'ams_custom_buttons' && Array.isArray(value)) {
      var btnHeaders = ['id', 'label', 'actionUrl', 'category', 'icon', 'color', 'targetRole', 'openInNewTab', 'order', 'schoolId', 'createdAt', 'updatedAt'];
      replaceEntireSheetData(ss, 'CustomButtons', btnHeaders, value);
    } else if (baseKey === 'ams_custom_pages' && Array.isArray(value)) {
      var pgHeaders = ['id', 'title', 'slug', 'description', 'content', 'externalUrl', 'icon', 'targetRole', 'isVisible', 'order', 'schoolId', 'createdAt', 'updatedAt'];
      replaceEntireSheetData(ss, 'CustomPages', pgHeaders, value);
    }
  } catch (syncErr) {}

  // 2. สำรองข้อมูลลงในตาราง SchoolDataKV ในไฟล์ของโรงเรียน
  try {
    var kvHeaders = ['id', 'updatedAt', 'valueJson', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'];
    var kvSheet = getOrCreateSheet(ss, 'SchoolDataKV', kvHeaders);
    var chunked = buildChunkedKvRow(baseKey, value, payload.updatedAt);
    if (chunked) {
      upsertRowInSheet(kvSheet, kvHeaders, 'id', chunked);
    }
  } catch (eKV) {}

  return {
    status: 'success',
    baseKey: baseKey,
    spreadsheetId: ss.getId(),
    message: 'ซิงค์ข้อมูล ' + baseKey + ' ลงใน Google Sheet โรงเรียนสำเร็จ'
  };
}

function handleSyncAll(payload) {
  var ss = getTargetSpreadsheet(payload);
  var data = payload.data || {};

  if (data.schoolInfo) {
    handleSaveSchoolInfo({ spreadsheetId: ss.getId(), schoolInfo: data.schoolInfo, schoolId: payload.schoolId, schoolName: payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
  }
  if (Array.isArray(data.students)) {
    var stdHeaders = ['id', 'rollNumber', 'studentCode', 'prefix', 'firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'age', 'religion', 'gradeLevel', 'room', 'address', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'guardianName', 'guardianPhone', 'dailyAllowance', 'photoUrl', 'status', 'fullDataJson'];
    var stdRows = data.students.map(function(s) {
      var cleanS = processObjectFilesToDrive(s, 'รูปภาพนักเรียน', payload);
      cleanS.fullDataJson = safeJsonStringify(cleanS);
      return cleanS;
    });
    replaceEntireSheetData(ss, 'Students', stdHeaders, stdRows);
  }
  if (Array.isArray(data.personnel)) {
    var perHeaders = ['id', 'personnelCode', 'prefix', 'firstName', 'lastName', 'gender', 'birthDate', 'age', 'position', 'academicStanding', 'department', 'assignedClass', 'education', 'major', 'phone', 'email', 'photoUrl', 'status'];
    var perRows = data.personnel.map(function(p) { return processObjectFilesToDrive(p, 'รูปภาพบุคลากร', payload); });
    replaceEntireSheetData(ss, 'Personnel', perHeaders, perRows);
  }
  if (Array.isArray(data.dailyTracking)) {
    replaceEntireSheetData(ss, 'DailyTracking', ['id', 'date', 'studentId', 'milkStatus', 'toothBrushing', 'semester', 'academicYear'], data.dailyTracking);
  }
  if (Array.isArray(data.subjects)) {
    var subHeaders = ['id', 'code', 'name', 'gradeLevel', 'credits', 'hoursPerYear', 'subjectGroup', 'semester', 'academicYear', 'teacherId', 'teacherName', 'scoreRatio', 'assignmentItemsJson'];
    var subRows = data.subjects.map(function(s) {
      var r = JSON.parse(JSON.stringify(s));
      r.assignmentItemsJson = safeJsonStringify(s.assignmentItems || []);
      return r;
    });
    replaceEntireSheetData(ss, 'Subjects', subHeaders, subRows);
  }
  if (Array.isArray(data.grades)) {
    var grdHeaders = ['id', 'studentId', 'subjectId', 'semester', 'academicYear', 'assignmentScoresJson', 'collectedScore', 'midtermScore', 'finalScore', 'totalScore', 'grade'];
    var grdRows = data.grades.map(function(g) {
      var r = JSON.parse(JSON.stringify(g));
      r.assignmentScoresJson = safeJsonStringify(g.assignmentScores || {});
      return r;
    });
    replaceEntireSheetData(ss, 'Grades', grdHeaders, grdRows);
  }
  if (Array.isArray(data.attendance)) {
    replaceEntireSheetData(ss, 'Attendance', ['id', 'date', 'studentId', 'status', 'note', 'semester', 'academicYear'], data.attendance);
  }
  if (Array.isArray(data.savings)) {
    replaceEntireSheetData(ss, 'Savings', ['id', 'date', 'studentId', 'type', 'amount', 'balanceAfter', 'note', 'recordedBy', 'semester', 'academicYear'], data.savings);
  }
  if (Array.isArray(data.tasks)) {
    handleSaveAllTasks({ spreadsheetId: ss.getId(), tasks: data.tasks, schoolId: payload.schoolId, schoolName: payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
  }
  if (Array.isArray(data.documents)) {
    handleSaveAllDocuments({ spreadsheetId: ss.getId(), documents: data.documents, schoolId: payload.schoolId, schoolName: payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
  }
  if (Array.isArray(data.websites)) {
    handleSaveAllWebsites({ spreadsheetId: ss.getId(), websites: data.websites, schoolId: payload.schoolId, schoolName: payload.schoolName, schoolDriveFolderId: payload.schoolDriveFolderId, driveFolderId: payload.driveFolderId });
  }
  if (Array.isArray(data.calendar)) {
    var calHeaders = ['id', 'title', 'date', 'type', 'description', 'announcement', 'taskDue', 'taskPriority', 'linkedTaskIdsJson'];
    var calRows = data.calendar.map(function(c) {
      var r = JSON.parse(JSON.stringify(c));
      r.linkedTaskIdsJson = safeJsonStringify(c.linkedTaskIds || []);
      return r;
    });
    replaceEntireSheetData(ss, 'Calendar', calHeaders, calRows);
  }
  if (Array.isArray(data.members)) {
    var memHeaders = ['id', 'username', 'password', 'prefix', 'fullName', 'firstName', 'lastName', 'role', 'gradeLevel', 'position', 'learningGroup', 'schoolId', 'schoolName', 'isSuspended', 'avatarUrl'];
    var memRows = data.members.map(function(m) { return processObjectFilesToDrive(m, 'รูปโปรไฟล์สมาชิก', payload); });
    replaceEntireSheetData(ss, 'Members', memHeaders, memRows);
  }
  if (Array.isArray(data.leaveRequests)) {
    var lvHeaders = ['id', 'teacherName', 'leaveType', 'startDate', 'endDate', 'reason', 'contactAddress', 'mobilePhone', 'directorName', 'personnelOfficer', 'status', 'createdAt', 'priorSickDays', 'priorPersonalDays', 'priorMaternityDays'];
    replaceEntireSheetData(ss, 'LeaveRequests', lvHeaders, data.leaveRequests);
  }
  if (Array.isArray(data.dutyAssignments)) {
    replaceEntireSheetData(ss, 'DutyAssignments', ['id', 'dayOfWeek', 'teacherNames', 'dutyType', 'location', 'note'], data.dutyAssignments);
  }
  if (Array.isArray(data.dailyDutyLogs)) {
    var dlHeaders = ['id', 'date', 'dayOfWeek', 'dutyTeachers', 'dutyTimeSlot', 'absentTeachersCount', 'absentTeachersDetail', 'studentsMalePresent', 'studentsFemalePresent', 'incidentMorning', 'incidentNoon', 'incidentAfternoon', 'overallStatus', 'AllowanceNote', 'recorderName', 'createdAt'];
    replaceEntireSheetData(ss, 'DailyDutyLogs', dlHeaders, data.dailyDutyLogs);
  }
  if (Array.isArray(data.customButtons)) {
    var btnHeaders = ['id', 'label', 'actionUrl', 'category', 'icon', 'color', 'targetRole', 'openInNewTab', 'order', 'schoolId', 'createdAt', 'updatedAt'];
    replaceEntireSheetData(ss, 'CustomButtons', btnHeaders, data.customButtons);
  }
  if (Array.isArray(data.customPages)) {
    var pgHeaders = ['id', 'title', 'slug', 'description', 'content', 'externalUrl', 'icon', 'targetRole', 'isVisible', 'order', 'schoolId', 'createdAt', 'updatedAt'];
    replaceEntireSheetData(ss, 'CustomPages', pgHeaders, data.customPages);
  }

  return {
    status: 'success',
    spreadsheetId: ss.getId(),
    message: 'ซิงค์ฐานข้อมูลทั้งหมดลงใน Google Sheets & Google Drive ประจำโรงเรียนสำเร็จเรียบร้อย!'
  };
}

/**
 * ============================================================================
 * SECTION E: Helper Functions สำหรับจัดการตาราง Google Sheets & Deletion
 * ============================================================================
 */

function safeJsonStringify(obj) {
  try {
    var str = JSON.stringify(obj);
    if (str && str.length > 48000) {
      return str.substring(0, 48000);
    }
    return str || '';
  } catch (e) {
    return '';
  }
}

function buildChunkedKvRow(key, value, updatedAt) {
  try {
    var serialized = JSON.stringify(value);
    if (!serialized || serialized.length > KV_CHUNK_SIZE * KV_MAX_CHUNKS) return null;
    var firstSlice = serialized.slice(0, KV_CHUNK_SIZE);
    var row = {
      id: key,
      updatedAt: updatedAt || new Date().getTime(),
      valueJson: firstSlice ? ('~' + firstSlice) : ''
    };
    for (var i = 1; i < KV_MAX_CHUNKS; i++) {
      var part = serialized.slice(i * KV_CHUNK_SIZE, (i + 1) * KV_CHUNK_SIZE);
      row['c' + i] = part ? ('~' + part) : '';
    }
    return row;
  } catch (e) {
    return null;
  }
}

function handleSaveGenericEntity(sheetName, itemData, keyField, payload) {
  var ss = getTargetSpreadsheet(payload);
  var item = itemData || {};
  var kField = keyField || 'id';
  if (!item[kField]) {
    item[kField] = 'item-' + new Date().getTime();
  }
  var keys = Object.keys(item);
  if (keys.indexOf(kField) === -1) {
    keys.unshift(kField);
  }
  var sheet = getOrCreateSheet(ss, sheetName, keys);
  var existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].filter(Boolean);
  var mergedHeaders = existingHeaders.slice();
  keys.forEach(function(k) {
    if (mergedHeaders.indexOf(k) === -1) {
      mergedHeaders.push(k);
    }
  });
  if (mergedHeaders.length !== existingHeaders.length) {
    sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
  }
  upsertRowInSheet(sheet, mergedHeaders, kField, item);
  return { status: 'success', message: 'บันทึกข้อมูลลงในชีต ' + sheetName + ' สำเร็จ', id: item[kField] };
}

function handleBatchSaveGenericEntities(sheetName, records, keyField, payload) {
  var ss = getTargetSpreadsheet(payload);
  var items = Array.isArray(records) ? records : [];
  if (items.length === 0) {
    return { status: 'success', count: 0 };
  }
  var kField = keyField || 'id';
  var defaultHeaders = ['id', 'updatedAt', 'valueJson', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'];
  var sheet = getOrCreateSheet(ss, sheetName, defaultHeaders);
  var existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].filter(Boolean);
  var mergedHeaders = existingHeaders.slice();

  items.forEach(function(item) {
    if (!item || typeof item !== 'object') return;
    Object.keys(item).forEach(function(k) {
      if (mergedHeaders.indexOf(k) === -1) mergedHeaders.push(k);
    });
  });

  if (mergedHeaders.length !== existingHeaders.length) {
    sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
  }

  items.forEach(function(item) {
    if (!item || typeof item !== 'object') return;
    if (!item[kField]) item[kField] = 'item-' + new Date().getTime();
    upsertRowInSheet(sheet, mergedHeaders, kField, item);
  });

  return { status: 'success', count: items.length };
}

function handleDeleteAcademicYearCascade(academicYear, payload) {
  if (!academicYear) return { status: 'error', message: 'ไม่ได้ระบุปีการศึกษาที่ต้องการลบ' };
  var ss = getTargetSpreadsheet(payload);
  var yearStr = String(academicYear).trim();
  var gregorianStr = String(Number(yearStr) - 543);
  var deletedCount = 0;
  var deletedDriveFilesCount = 0;

  // 1. ลบไฟล์ใน Google Drive ที่ส่งมาจากฝั่งเว็บโดยตรง (ทั้งจาก fileUrls และ driveFileIds)
  if (payload && Array.isArray(payload.fileUrls)) {
    payload.fileUrls.forEach(function(u) {
      if (u && deleteDriveFileByUrlOrId(u, payload)) {
        deletedDriveFilesCount++;
      }
    });
  }
  if (payload && Array.isArray(payload.driveFileIds)) {
    payload.driveFileIds.forEach(function(fid) {
      if (fid && deleteDriveFileByUrlOrId(fid, payload)) {
        deletedDriveFilesCount++;
      }
    });
  }

  var targetSheets = [
    'Subjects',
    'Grades',
    'Attendance',
    'AttendanceConfig',
    'Savings',
    'DailyTracking',
    'Tasks',
    'TaskSubmissions',
    'Documents',
    'Calendar',
    'LeaveRequests',
    'DailyDutyLogs',
    'BehaviorEvaluations',
    'CommentSessions',
    'PhorPhor6',
    'Assessment3Booklets',
    'ReadingWriting',
    'WeightHeight',
    'DriveFiles'
  ];

  function purgeYearFromSpreadsheet(targetSs) {
    if (!targetSs) return;
    targetSheets.forEach(function(sheetName) {
      var sheet = targetSs.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return;
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(function(h) { return String(h).trim(); });
      var yearIdx = headers.indexOf('academicYear');
      var fiscalIdx = headers.indexOf('fiscalYear');
      var dateIdx = headers.indexOf('date');
      var dueDateIdx = headers.indexOf('dueDate');
      var startDateIdx = headers.indexOf('startDate');
      var catIdx = headers.indexOf('category');

      for (var i = data.length - 1; i >= 1; i--) {
        var row = data[i];
        var matchYear =
          (yearIdx >= 0 && String(row[yearIdx]).trim() === yearStr) ||
          (fiscalIdx >= 0 && String(row[fiscalIdx]).trim() === yearStr) ||
          (catIdx >= 0 && String(row[catIdx]).indexOf(yearStr) !== -1);
        var rowDate =
          dateIdx >= 0
            ? String(row[dateIdx])
            : dueDateIdx >= 0
            ? String(row[dueDateIdx])
            : startDateIdx >= 0
            ? String(row[startDateIdx])
            : '';
        var hasExplicitOtherYear =
          yearIdx >= 0 && String(row[yearIdx]).trim() !== '' && String(row[yearIdx]).trim() !== yearStr;
        var matchDate =
          !hasExplicitOtherYear &&
          rowDate &&
          (rowDate.indexOf(yearStr) !== -1 || (!isNaN(Number(yearStr)) && rowDate.indexOf(gregorianStr) !== -1));

        if (matchYear || matchDate) {
          // สแกนลบไฟล์ใน Google Drive ของแถวนี้ทั้งหมด
          for (var c = 0; c < headers.length; c++) {
            var val = row[c];
            if (val && typeof val === 'string') {
              var extractedId = extractDriveFileId(val);
              if (extractedId) {
                if (deleteDriveFileByUrlOrId(extractedId, payload)) {
                  deletedDriveFilesCount++;
                }
              } else if (val.indexOf('{') !== -1 || val.indexOf('[') !== -1) {
                try {
                  scanAndTrashDriveFilesInObject(JSON.parse(val), payload);
                } catch (errJson) {}
              }
            }
          }
          sheet.deleteRow(i + 1);
          deletedCount++;
        }
      }
    });

    // อัปเดตตาราง SchoolDataKV และ RealtimeCloudKV หากมีคีย์ที่เป็นของปีการศึกษานั้น
    ['SchoolDataKV', 'RealtimeCloudKV'].forEach(function(kvSheetName) {
      var kvSheet = targetSs.getSheetByName(kvSheetName);
      if (!kvSheet || kvSheet.getLastRow() <= 1) return;
      var kvData = kvSheet.getDataRange().getValues();
      for (var r = kvData.length - 1; r >= 1; r--) {
        var kId = String(kvData[r][0] || '');
        if (kId.indexOf(yearStr) !== -1) {
          kvSheet.deleteRow(r + 1);
          deletedCount++;
        }
      }
    });
  }

  purgeYearFromSpreadsheet(ss);

  // หากเรียกที่ Master Spreadsheet ให้ตามไปลบใน Google Sheet ของทุกโรงเรียนในตาราง Admins ด้วยอัตโนมัติ
  if (!payload || !payload.skipCascadeSchools) {
    try {
      var adminsSheet = ss.getSheetByName('Admins');
      if (adminsSheet && adminsSheet.getLastRow() > 1) {
        var admData = adminsSheet.getDataRange().getValues();
        var admHeaders = admData[0].map(function(h) { return String(h).trim(); });
        var gSheetIdx = admHeaders.indexOf('googleSheetId');
        if (gSheetIdx >= 0) {
          for (var a = 1; a < admData.length; a++) {
            var schoolSheetId = String(admData[a][gSheetIdx] || '').trim();
            if (schoolSheetId && schoolSheetId.indexOf('sheet_') !== 0 && schoolSheetId !== ss.getId()) {
              try {
                var schoolSs = SpreadsheetApp.openById(schoolSheetId);
                purgeYearFromSpreadsheet(schoolSs);
              } catch (eSchool) {}
            }
          }
        }
      }
    } catch (eCascade) {}
  }

  return {
    status: 'success',
    deletedRows: deletedCount,
    deletedDriveFiles: deletedDriveFilesCount,
    message: 'ลบข้อมูลปีการศึกษา ' + yearStr + ' จำนวน ' + deletedCount + ' แถว และลบไฟล์ใน Google Drive เรียบร้อยแล้ว'
  };
}

function getAllDataFromSheets(payload) {
  var ss = getTargetSpreadsheet(payload);
  return {
    schoolInfo: getSheetDataAsObjects(ss, 'Settings')[0] || null,
    students: getSheetDataAsObjects(ss, 'Students'),
    personnel: getSheetDataAsObjects(ss, 'Personnel'),
    dailyTracking: getSheetDataAsObjects(ss, 'DailyTracking'),
    subjects: getSheetDataAsObjects(ss, 'Subjects'),
    grades: getSheetDataAsObjects(ss, 'Grades'),
    attendance: getSheetDataAsObjects(ss, 'Attendance'),
    savings: getSheetDataAsObjects(ss, 'Savings'),
    tasks: getSheetDataAsObjects(ss, 'Tasks'),
    documents: getSheetDataAsObjects(ss, 'Documents'),
    websites: getSheetDataAsObjects(ss, 'Websites'),
    calendar: getSheetDataAsObjects(ss, 'Calendar'),
    members: getSheetDataAsObjects(ss, 'Members'),
    leaveRequests: getSheetDataAsObjects(ss, 'LeaveRequests'),
    dutyAssignments: getSheetDataAsObjects(ss, 'DutyAssignments'),
    dailyDutyLogs: getSheetDataAsObjects(ss, 'DailyDutyLogs'),
    customButtons: getSheetDataAsObjects(ss, 'CustomButtons'),
    customPages: getSheetDataAsObjects(ss, 'CustomPages')
  };
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
    }
  } else if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f5f9');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureSheetHeaders(sheet, requiredHeaders) {
  if (!sheet || !requiredHeaders || requiredHeaders.length === 0) return;
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); }).filter(Boolean);
  var merged = existing.slice();
  requiredHeaders.forEach(function(h) {
    if (merged.indexOf(h) === -1) {
      merged.push(h);
    }
  });
  if (merged.length !== existing.length) {
    sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  }
}

function getSheetDataAsObjects(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var results = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var val = row[j];
      if ((key === 'assignmentScoresJson' || key === 'assignmentItemsJson' || key === 'submissionsJson' || key === 'fullDataJson') && val) {
        try {
          obj[key.replace('Json', '')] = JSON.parse(val);
        } catch (e) {
          obj[key] = val;
        }
      } else {
        obj[key] = val;
      }
    }
    results.push(obj);
  }
  return results;
}

function upsertRowInSheet(sheet, headers, keyField, recordObj) {
  var lastRow = sheet.getLastRow();
  var keyIndex = headers.indexOf(keyField);
  if (keyIndex === -1) keyIndex = 0;

  var rowValues = headers.map(function(h) {
    var val = recordObj[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return safeJsonStringify(val);
    var strVal = String(val);
    return strVal.length > 49000 ? strVal.substring(0, 49000) : val;
  });

  if (lastRow <= 1) {
    sheet.appendRow(rowValues);
    return;
  }

  var data = sheet.getRange(2, keyIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(recordObj[keyField])) {
      sheet.getRange(i + 2, 1, 1, headers.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

function replaceEntireSheetData(ss, sheetName, headers, recordsArray) {
  var sheet = getOrCreateSheet(ss, sheetName, headers);
  sheet.clearContents();
  sheet.appendRow(headers);
  if (!recordsArray || recordsArray.length === 0) return;

  var matrix = recordsArray.map(function(item) {
    return headers.map(function(h) {
      var val = item[h];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') return safeJsonStringify(val);
      var strVal = String(val);
      return strVal.length > 49000 ? strVal.substring(0, 49000) : val;
    });
  });

  sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
}

/**
 * ลบแถวในชีตตาม ID และสแกนหาไฟล์ Google Drive ในแถวนั้นเพื่อลบออกจาก Drive อัตโนมัติ
 * (ห้ามลบโฟลเดอร์โรงเรียนเด็ดขาด)
 */
function handleDeleteRowById(sheetName, idValue, keyField, payload) {
  var ss = getTargetSpreadsheet(payload);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { status: 'warning', message: 'ไม่พบชีต ' + sheetName + ' หรือไม่มีข้อมูลให้ลบ' };
  }
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var kField = keyField || 'id';
  var colIdx = headers.indexOf(kField);
  if (colIdx === -1) colIdx = 0;

  var deletedCount = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIdx]) === String(idValue)) {
      var row = data[i];

      // สแกนทุกคอลัมน์ในแถวที่กำลังจะลบ หากมีไฟล์ใน Google Drive ให้ลบไฟล์นั้นใน Google Drive ทันที
      // (เช่น รูปภาพนักเรียน photoUrl, รูปบุคลากร, โลโก้เว็บไซต์ logoUrl, avatarUrl ฯลฯ)
      for (var c = 0; c < headers.length; c++) {
        var val = row[c];
        if (val && typeof val === 'string') {
          var extractedId = extractDriveFileId(val);
          if (extractedId) {
            deleteDriveFileByUrlOrId(extractedId, payload);
          } else if (val.indexOf('{') !== -1 || val.indexOf('[') !== -1) {
            try {
              var parsedObj = JSON.parse(val);
              scanAndTrashDriveFilesInObject(parsedObj, payload);
            } catch (errJson) {}
          }
        }
      }

      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  // หาก payload ระบุ photoUrl, logoUrl, avatarUrl, fileUrl มาโดยตรง ให้สั่งลบด้วย
  var directFileFields = ['photoUrl', 'logoUrl', 'avatarUrl', 'fileUrl', 'driveFileId', 'attachmentUrl'];
  if (payload) {
    directFileFields.forEach(function(field) {
      if (payload[field]) {
        deleteDriveFileByUrlOrId(payload[field], payload);
      }
    });
  }

  return {
    status: 'success',
    deletedRows: deletedCount,
    message: 'ลบข้อมูลรหัส ' + idValue + ' จากชีต ' + sheetName + ' พร้อมลบไฟล์ใน Google Drive สำเร็จ'
  };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const SETUP_GUIDE_STEPS = [
  {
    step: 1,
    title: 'สร้างหรือเปิด Google Sheets หลักของระบบ',
    desc: 'ไปที่ Google Sheets (sheets.new) แล้วไปที่เมนู ส่วนขยาย (Extensions) > Apps Script'
  },
  {
    step: 2,
    title: 'วางโค้ด Code.gs (เวอร์ชัน 5.0 1-Admin-1-Folder, Zero-Duplicate & Auto-Deletion Engine)',
    desc: 'ลบโค้ดเก่าในไฟล์ Code.gs ออกทั้งหมด แล้วกดปุ่ม "คัดลอกโค้ด Code.gs" ด้านบนไปวางแทนที่ จากนั้นกดบันทึก (Ctrl+S)'
  },
  {
    step: 3,
    title: 'การทำให้ใช้งานได้ (Deploy as Web App)',
    desc: 'กดปุ่ม "การทำให้ใช้งานได้" (Deploy) > "การทำให้ใช้งานได้รายการใหม่" (New deployment) > เลือกประเภทเป็น "เว็บแอป" (Web app) > ผู้ดำเนินการ: "ฉัน" (Me) > ผู้มีสิทธิ์เข้าถึง: "ทุกคน" (Anyone) > กดปุ่มทำให้ใช้งานได้'
  },
  {
    step: 4,
    title: 'คัดลอก Web App URL มาเชื่อมต่อ',
    desc: 'นำ Web App URL ที่ลงท้ายด้วย /exec มาวางในช่องตั้งค่าด้านซ้าย ระบบจะจัดเก็บข้อมูลลง Google Sheets แยกตามโรงเรียน และจัดเก็บไฟล์ทุกประเภทลงโฟลเดอร์โรงเรียนของ Admin ใน Google Drive พร้อมลบไฟล์อัตโนมัติเมื่อมีการลบในเว็บ'
  }
];
