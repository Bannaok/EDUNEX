/**
 * ============================================================================
 * ระบบบริหารจัดการงานวิชาการและธุรการโรงเรียน (School Management System)
 * Google Apps Script Backend (Code.gs) - Version 4.0 (Full Multi-School & Drive Engine)
 * ============================================================================
 * คุณสมบัติหลัก (Version 4.0):
 * 1. แยกไฟล์ Google Sheets ตามโรงเรียน (Multi-School Isolation) โดยอัตโนมัติ 100%:
 *    - ทุกข้อมูลที่ สมาชิก (Member) และ ผู้ดูแลระบบ (Admin) กรอกในเว็บไซต์
 *      จะถูกจัดเก็บลงใน Google Sheets ประจำโรงเรียนนั้นๆ โดยอัตโนมัติครบทุกโมดูล
 *    - รองรับทั้งข้อมูลนักเรียน, บุคลากร, ตั้งค่าโรงเรียน, วิชาเรียน, เกรด/คะแนน,
 *      เวลาเรียน, วันเปิด-ปิดภาคเรียน, ออมทรัพย์, สุขภาพประจำวัน, งานมอบหมาย,
 *      รายการส่งงานของสมาชิก (TaskSubmissions), ศูนย์เอกสาร/คำสั่ง, เว็บไซต์แนะนำ,
 *      ปฏิทินวิชาการ, ระบบการลา, ตารางครูเวร, บันทึกปฏิบัติหน้าที่ครูเวร,
 *      ปพ.6, แบบประเมิน 3 เล่ม, อ่านคิดวิเคราะห์, น้ำหนักส่วนสูง และข้อมูลทุกส่วนในเว็บ
 * 2. จัดเก็บไฟล์อัปโหลดทุกประเภทลง Google Drive แยกตามโรงเรียนและหมวดหมู่อัตโนมัติ:
 *    - ไฟล์ส่งงานและไฟล์แนบใน "หน้ามอบหมาย" -> โฟลเดอร์ 1_งานมอบหมายและการส่งงาน
 *    - ไฟล์เอกสารและหนังสือคำสั่งใน "หน้าศูนย์เอกสาร" -> โฟลเดอร์ 2_ศูนย์เอกสารและคำสั่ง
 *    - โลโก้โรงเรียนและรูปโปรไฟล์ใน "หน้าตั้งค่า" -> โฟลเดอร์ 3_โลโก้โรงเรียนและตั้งค่า
 *    - โลโก้เว็บไซต์ใน "หน้า Website" -> โฟลเดอร์ 4_โลโก้เว็บไซต์แนะนำ
 *    - รูปนักเรียนและบุคลากรใน "หน้าข้อมูล/อื่นๆ" -> โฟลเดอร์ 5_รูปภาพนักเรียนและบุคลากร
 * 3. รองรับการระงับสิทธิ์ใช้งานชั่วคราวของ Admin โรงเรียน (isSuspended):
 *    - บันทึกสถานะ isSuspended ลงในชีต Admins และซิงค์สถานะแบบเรียลไทม์
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
        message: 'เชื่อมต่อ Google Apps Script (v4.0 Full Multi-School & Drive Auto-Storage) สำเร็จ!',
        timestamp: new Date().toISOString(),
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

      // --- อัปโหลดไฟล์ทุกประเภทลง Google Drive แยกตามโรงเรียนและหมวดหมู่ ---
      case 'uploadDriveFile':
        result = handleUploadDriveFile(payload);
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

      // --- นักเรียน (Students) พร้อมอัปโหลดรูปนักเรียนลง Google Drive ---
      case 'saveStudent':
        result = handleSaveStudent(payload);
        break;
      case 'deleteStudent':
        result = handleDeleteRowById('Students', payload.id, 'id', payload);
        break;

      // --- บุคลากร (Personnel) พร้อมอัปโหลดรูปบุคลากรลง Google Drive ---
      case 'savePersonnel':
        result = handleSavePersonnel(payload);
        break;
      case 'deletePersonnel':
        result = handleDeleteRowById('Personnel', payload.id, 'id', payload);
        break;

      // --- สมาชิกผู้ใช้งาน (Members) พร้อมอัปโหลดรูปโปรไฟล์ลง Google Drive ---
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

      // --- มอบหมายงาน & แจ้งให้ทราบ (Tasks & TaskSubmissions) พร้อมเก็บไฟล์ส่งงานใน Drive ---
      case 'saveTask':
        result = handleSaveTask(payload);
        break;
      case 'completeTask':
        result = handleCompleteTask(payload);
        break;
      case 'deleteTask':
        result = handleDeleteRowById('Tasks', payload.id, 'id', payload);
        break;
      case 'saveAllTasks':
        result = handleSaveAllTasks(payload);
        break;

      // --- ศูนย์เอกสารและหนังสือคำสั่ง (Documents & Google Drive) ---
      case 'uploadDocument':
        result = handleUploadDocument(payload);
        break;
      case 'deleteDocument':
        result = handleDeleteDocument(payload);
        break;
      case 'saveAllDocuments':
        result = handleSaveAllDocuments(payload);
        break;

      // --- เว็บไซต์แนะนำ (Websites) พร้อมเก็บโลโก้เว็บไซต์ใน Google Drive ---
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
  return String(name).replace(/^โรงเรียน/, '').replace(/\s+/g, '').trim().toLowerCase();
}

/**
 * ค้นหาหรือสร้าง Google Spreadsheet ประจำโรงเรียนโดยอัตโนมัติ
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
    schoolName = payloadOrId.schoolName || (payloadOrId.schoolInfo && payloadOrId.schoolInfo.schoolName) || '';
    if (payloadOrId.sheetName === 'Admins' || payloadOrId.sheetName === 'RealtimeCloudKV') {
      forceMaster = true;
    }
  }

  // 1. หากบังคับใช้ Master Spreadsheet (เช่น ตาราง Admins หรือ RealtimeCloudKV กลาง)
  if (forceMaster && (!isRealSpreadsheetId(spreadsheetId) || spreadsheetId === MASTER_SPREADSHEET_ID)) {
    return SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  }

  // 2. หากส่งรหัส Google Sheet จริงของโรงเรียนมา ให้เปิดใช้งานทันที
  if (isRealSpreadsheetId(spreadsheetId)) {
    try {
      return SpreadsheetApp.openById(spreadsheetId.trim());
    } catch (e) {
      // หากรหัสเปิดไม่ได้ ให้ค้นหาจากชื่อโรงเรียนหรือ schoolId ต่อด้านล่าง
    }
  }

  // 3. ค้นหารหัส Google Sheet ของโรงเรียนจากตาราง Admins ใน Master Spreadsheet
  if (schoolId || schoolName) {
    try {
      var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
      var adminsData = getSheetDataAsObjects(masterSS, 'Admins');
      var targetCleanName = cleanSchoolName(schoolName);
      var matchedAdmin = null;

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

      if (matchedAdmin && isRealSpreadsheetId(matchedAdmin.googleSheetId)) {
        try {
          return SpreadsheetApp.openById(String(matchedAdmin.googleSheetId).trim());
        } catch (openErr) {
          // หากไฟล์ถูกลบไปแล้ว ให้สร้างใหม่ด้านล่าง
        }
      }

      // หากโรงเรียนนี้ยังไม่มี Google Sheet จริง ให้สร้างให้อัตโนมัติทันที!
      var resolvedName = (matchedAdmin && matchedAdmin.schoolName) ? matchedAdmin.schoolName : schoolName;
      if (resolvedName && String(schoolId) !== 'admin-school-01') {
        var created = handleCreateSchoolSheet({
          schoolName: resolvedName,
          schoolCode: (matchedAdmin && matchedAdmin.schoolCode) || '',
          adminId: (matchedAdmin && matchedAdmin.id) || schoolId || ('admin-' + new Date().getTime()),
          username: (matchedAdmin && matchedAdmin.username) || '',
          password: (matchedAdmin && matchedAdmin.password) || '',
          fullName: (matchedAdmin && matchedAdmin.fullName) || '',
          affiliation: (matchedAdmin && matchedAdmin.affiliation) || '',
          directorName: (matchedAdmin && matchedAdmin.directorName) || ''
        });
        if (created && created.status === 'success' && isRealSpreadsheetId(created.spreadsheetId)) {
          return SpreadsheetApp.openById(created.spreadsheetId);
        }
      }
    } catch (lookupErr) {
      // fallback to master
    }
  }

  // 4. Fallback ไปที่ Master Spreadsheet
  try {
    if (MASTER_SPREADSHEET_ID) {
      return SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    }
  } catch (err2) {}

  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * สร้าง Google Sheet ใหม่แยกเฉพาะโรงเรียน พร้อมโฟลเดอร์ Google Drive ประจำโรงเรียน
 */
function handleCreateSchoolSheet(payload) {
  var schoolName = payload.schoolName || 'โรงเรียนใหม่';
  var schoolCode = payload.schoolCode || '';
  var folderId = payload.folderId || payload.driveFolderId || DEFAULT_DRIVE_FOLDER_ID;
  var sheetTitle = '[ระบบวิชาการ] ' + schoolName + (schoolCode ? ' (' + schoolCode + ')' : '');

  // ตรวจสอบก่อนว่าในตาราง Admins มี Google Sheet ของโรงเรียนนี้อยู่แล้วหรือไม่ เพื่อไม่ให้สร้างซ้ำ
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
            return {
              status: 'success',
              spreadsheetId: existingSS.getId(),
              spreadsheetUrl: existingSS.getUrl(),
              schoolName: schoolName,
              message: 'เชื่อมต่อ Google Sheet ประจำโรงเรียน "' + schoolName + '" ที่มีอยู่แล้วสำเร็จ'
            };
          } catch (ignoreErr) {}
        }
      }
    }
  } catch (eCheck) {}

  var newSS = SpreadsheetApp.create(sheetTitle);
  var newId = newSS.getId();
  var newUrl = newSS.getUrl();

  // ย้ายไฟล์ Google Sheet ไปไว้ในโฟลเดอร์ประจำโรงเรียนบน Google Drive
  try {
    var schoolFolder = getOrCreateSchoolFolder(schoolName, folderId);
    if (schoolFolder) {
      var file = DriveApp.getFileById(newId);
      schoolFolder.addFile(file);
      try {
        DriveApp.getRootFolder().removeFile(file);
      } catch (rmErr) {}
    }
  } catch (folderErr) {}

  // สร้างแท็บตารางมาตรฐานครบทุกโมดูลใน Google Sheet ของโรงเรียน
  var defaultSheets = [
    { name: 'Settings', headers: ['schoolName', 'schoolCode', 'affiliation', 'address', 'phone', 'email', 'directorName', 'academicYear', 'semester', 'logoUrl', 'driveLogoUrl', 'updatedAt'] },
    { name: 'Students', headers: ['id', 'rollNumber', 'studentCode', 'prefix', 'firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'age', 'religion', 'gradeLevel', 'room', 'address', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'guardianName', 'guardianPhone', 'dailyAllowance', 'photoUrl', 'status', 'fullDataJson'] },
    { name: 'Personnel', headers: ['id', 'personnelCode', 'prefix', 'firstName', 'lastName', 'gender', 'birthDate', 'age', 'position', 'academicStanding', 'department', 'assignedClass', 'education', 'major', 'phone', 'email', 'photoUrl', 'status'] },
    { name: 'Subjects', headers: ['id', 'code', 'name', 'gradeLevel', 'credits', 'hoursPerYear', 'subjectGroup', 'semester', 'academicYear', 'teacherId', 'teacherName', 'scoreRatio', 'assignmentItemsJson'] },
    { name: 'Grades', headers: ['id', 'studentId', 'subjectId', 'semester', 'academicYear', 'assignmentScoresJson', 'collectedScore', 'midtermScore', 'finalScore', 'totalScore', 'grade'] },
    { name: 'Attendance', headers: ['id', 'date', 'studentId', 'status', 'note', 'semester', 'academicYear'] },
    { name: 'AttendanceConfig', headers: ['id', 'semester', 'academicYear', 'startDate', 'endDate', 'targetDays', 'holidaysJson', 'schoolDaysJson'] },
    { name: 'Savings', headers: ['id', 'date', 'studentId', 'type', 'amount', 'balanceAfter', 'note', 'recordedBy', 'semester', 'academicYear'] },
    { name: 'DailyTracking', headers: ['id', 'date', 'studentId', 'milkStatus', 'toothBrushing', 'semester', 'academicYear'] },
    { name: 'Tasks', headers: ['id', 'title', 'description', 'type', 'priority', 'dueDate', 'isCompleted', 'isManualCompleted', 'createdBy', 'assignedTo', 'attachmentUrl', 'submissionsCount', 'submissionsJson'] },
    { name: 'TaskSubmissions', headers: ['id', 'taskId', 'taskTitle', 'memberId', 'memberName', 'fileName', 'fileSize', 'fileUrl', 'submittedAt'] },
    { name: 'Documents', headers: ['id', 'docNumber', 'title', 'docType', 'category', 'date', 'fileUrl', 'fileName', 'fileSize', 'uploadedBy', 'driveFileId'] },
    { name: 'Websites', headers: ['id', 'title', 'url', 'category', 'description', 'isOfficial', 'logoUrl'] },
    { name: 'Calendar', headers: ['id', 'title', 'date', 'type', 'description', 'announcement', 'taskDue', 'taskPriority', 'linkedTaskIdsJson'] },
    { name: 'Members', headers: ['id', 'username', 'password', 'prefix', 'fullName', 'firstName', 'lastName', 'role', 'gradeLevel', 'position', 'learningGroup', 'schoolId', 'schoolName', 'isSuspended', 'avatarUrl'] },
    { name: 'LeaveRequests', headers: ['id', 'teacherName', 'leaveType', 'startDate', 'endDate', 'reason', 'contactAddress', 'mobilePhone', 'directorName', 'personnelOfficer', 'status', 'createdAt', 'priorSickDays', 'priorPersonalDays', 'priorMaternityDays'] },
    { name: 'DutyAssignments', headers: ['id', 'dayOfWeek', 'teacherNames', 'dutyType', 'location', 'note'] },
    { name: 'DailyDutyLogs', headers: ['id', 'date', 'dayOfWeek', 'dutyTeachers', 'dutyTimeSlot', 'absentTeachersCount', 'absentTeachersDetail', 'studentsMalePresent', 'studentsFemalePresent', 'incidentMorning', 'incidentNoon', 'incidentAfternoon', 'overallStatus', 'AllowanceNote', 'recorderName', 'createdAt'] },
    { name: 'BehaviorEvaluations', headers: ['id', 'studentId', 'sessionId', 'academicYear', 'semester', 'score', 'level', 'comment', 'evaluatedBy', 'updatedAt', 'fullDataJson'] },
    { name: 'CommentSessions', headers: ['id', 'title', 'date', 'academicYear', 'semester', 'createdAt'] },
    { name: 'PhorPhor6', headers: ['id', 'studentId', 'academicYear', 'semester', 'gradeLevel', 'teacherComment', 'directorComment', 'updatedAt', 'fullDataJson'] },
    { name: 'Assessment3Booklets', headers: ['id', 'studentId', 'academicYear', 'semester', 'readingScore', 'characteristicsScore', 'competenciesScore', 'activityResult', 'updatedAt', 'fullDataJson'] },
    { name: 'ReadingWriting', headers: ['id', 'academicYear', 'semester', 'gradeLevel', 'dataJson', 'updatedAt'] },
    { name: 'WeightHeight', headers: ['id', 'sessionId', 'academicYear', 'semester', 'studentRecordsJson', 'updatedAt'] },
    { name: 'CustomButtons', headers: ['id', 'label', 'actionUrl', 'category', 'icon', 'color', 'targetRole', 'openInNewTab', 'order', 'schoolId', 'createdAt', 'updatedAt'] },
    { name: 'CustomPages', headers: ['id', 'title', 'slug', 'description', 'content', 'externalUrl', 'icon', 'targetRole', 'isVisible', 'order', 'schoolId', 'createdAt', 'updatedAt'] },
    { name: 'DriveFiles', headers: ['id', 'category', 'fileName', 'mimeType', 'fileSize', 'driveFileId', 'driveViewUrl', 'driveDownloadUrl', 'uploadedBy', 'uploadedAt'] },
    { name: 'SchoolDataKV', headers: ['id', 'updatedAt', 'valueJson', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'] }
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

  // บันทึกข้อมูล Admin และลิงก์ Google Sheet ของโรงเรียนนี้ลงใน Master Spreadsheet ('Admins' sheet)
  try {
    var masterId = payload.masterSpreadsheetId || MASTER_SPREADSHEET_ID;
    if (masterId) {
      var masterSS = SpreadsheetApp.openById(masterId);
      var adminHeaders = ['id', 'username', 'password', 'fullName', 'schoolName', 'schoolCode', 'affiliation', 'directorName', 'googleSheetId', 'googleSheetUrl', 'isSuspended', 'createdAt'];
      var adminsSheet = getOrCreateSheet(masterSS, 'Admins', adminHeaders);
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
    schoolName: schoolName,
    message: 'สร้างไฟล์ Google Sheet และโฟลเดอร์ Google Drive ประจำโรงเรียน "' + schoolName + '" สำเร็จเรียบร้อยแล้ว'
  };
}

/**
 * ลบไฟล์ Google Sheet ของโรงเรียนเมื่อ Developer ลบ ID Admin (โรงเรียน)
 */
function handleDeleteSchoolSheet(payload) {
  var schoolSpreadsheetId = payload.schoolSpreadsheetId || payload.googleSheetId || '';
  var adminId = payload.adminId || payload.id || '';
  var schoolName = payload.schoolName || '';
  var masterId = payload.masterSpreadsheetId || MASTER_SPREADSHEET_ID;
  var trashedSheet = false;

  if (isRealSpreadsheetId(schoolSpreadsheetId) && schoolSpreadsheetId !== masterId) {
    try {
      var file = DriveApp.getFileById(schoolSpreadsheetId);
      file.setTrashed(true);
      trashedSheet = true;
    } catch (err) {}
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
        var schoolNameIdx = headers.indexOf('schoolName');

        for (var i = data.length - 1; i >= 1; i--) {
          var rowId = idIdx >= 0 ? String(data[i][idIdx]) : '';
          var rowSheetId = sheetIdIdx >= 0 ? String(data[i][sheetIdIdx]) : '';
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
    adminId: adminId,
    message: 'ลบข้อมูล Admin โรงเรียน "' + (schoolName || adminId) + '" และย้ายไฟล์ Google Sheet ไปถังขยะเรียบร้อยแล้ว'
  };
}

/**
 * ระงับ / ยกเลิกการระงับสิทธิ์ใช้งานชั่วคราวของ Admin โรงเรียน (รวมถึงสมาชิกในสังกัด)
 */
function handleToggleSuspendAdmin(payload) {
  var adminId = payload.adminId || payload.id || '';
  var isSuspended = Boolean(payload.isSuspended);
  var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var headers = ['id', 'username', 'password', 'fullName', 'schoolName', 'schoolCode', 'affiliation', 'directorName', 'googleSheetId', 'googleSheetUrl', 'isSuspended', 'createdAt'];
  var sheet = getOrCreateSheet(masterSS, 'Admins', headers);

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
 * SECTION B: ระบบจัดการไฟล์อัปโหลดลง Google Drive แยกตามโรงเรียนและหมวดหมู่
 * ============================================================================
 */

function getCategoryFolderName(category) {
  var cat = String(category || '').toLowerCase();
  if (cat.indexOf('assignment') !== -1 || cat.indexOf('submission') !== -1 || cat.indexOf('task') !== -1 || cat.indexOf('มอบหมาย') !== -1 || cat.indexOf('ส่งงาน') !== -1) {
    return '1_งานมอบหมายและการส่งงาน';
  }
  if (cat.indexOf('document') !== -1 || cat.indexOf('order') !== -1 || cat.indexOf('เอกสาร') !== -1 || cat.indexOf('คำสั่ง') !== -1) {
    return '2_ศูนย์เอกสารและคำสั่ง';
  }
  if (cat.indexOf('school_logo') !== -1 || cat.indexOf('setting') !== -1 || cat.indexOf('avatar') !== -1 || cat.indexOf('โลโก้โรงเรียน') !== -1 || cat.indexOf('ตั้งค่า') !== -1) {
    return '3_โลโก้โรงเรียนและตั้งค่า';
  }
  if (cat.indexOf('website') !== -1 || cat.indexOf('เว็บไซต์') !== -1) {
    return '4_โลโก้เว็บไซต์แนะนำ';
  }
  if (cat.indexOf('student') !== -1 || cat.indexOf('personnel') !== -1 || cat.indexOf('photo') !== -1 || cat.indexOf('นักเรียน') !== -1 || cat.indexOf('บุคลากร') !== -1) {
    return '5_รูปภาพนักเรียนและบุคลากร';
  }
  return '6_ไฟล์อื่นๆ';
}

function getOrCreateSubfolder(parentFolder, folderName) {
  var iter = parentFolder.getFoldersByName(folderName);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(folderName);
}

function getOrCreateSchoolFolder(schoolName, rootFolderId) {
  var targetRootId = rootFolderId || DEFAULT_DRIVE_FOLDER_ID;
  var rootFolder;
  try {
    rootFolder = targetRootId ? DriveApp.getFolderById(targetRootId) : DriveApp.getRootFolder();
  } catch (e) {
    rootFolder = DriveApp.getRootFolder();
  }

  var cleanName = (schoolName || 'โรงเรียนทั่วไป').trim();
  var schoolFolderName = '[โรงเรียน] ' + cleanName;
  return getOrCreateSubfolder(rootFolder, schoolFolderName);
}

function getSchoolCategoryDriveFolder(schoolName, category, rootFolderId) {
  var schoolFolder = getOrCreateSchoolFolder(schoolName, rootFolderId);
  var subName = getCategoryFolderName(category);
  return getOrCreateSubfolder(schoolFolder, subName);
}

/**
 * แปลง Base64 Data URL หรือ Base64 String แล้วบันทึกลง Google Drive ทันที
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
    // เป็น URL ปกติอยู่แล้ว ไม่ต้องแปลงซ้ำ
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

  var safeName = (fileName || ('file_' + new Date().getTime())).replace(/[\\/:*?"<>|]/g, '_');
  if (ext && safeName.toLowerCase().indexOf(ext) === -1 && safeName.indexOf('.') === -1) {
    safeName += ext;
  }

  var schoolName = (payload && (payload.schoolName || (payload.schoolInfo && payload.schoolInfo.schoolName))) || 'โรงเรียนทั่วไป';
  var rootFolderId = (payload && (payload.driveFolderId || payload.folderId)) || DEFAULT_DRIVE_FOLDER_ID;
  var targetFolder = getSchoolCategoryDriveFolder(schoolName, category, rootFolderId);

  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, mimeType, safeName);
  var driveFile = targetFolder.createFile(blob);

  try {
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {}

  var fileId = driveFile.getId();
  var isImage = mimeType.indexOf('image/') === 0;
  var directUrl = isImage
    ? ('https://lh3.googleusercontent.com/d/' + fileId)
    : ('https://drive.google.com/file/d/' + fileId + '/view?usp=sharing');
  var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;

  // บันทึกประวัติไฟล์ลงในแท็บ DriveFiles ของ Google Sheet โรงเรียน
  try {
    var ss = getTargetSpreadsheet(payload);
    var driveHeaders = ['id', 'category', 'fileName', 'mimeType', 'fileSize', 'driveFileId', 'driveViewUrl', 'driveDownloadUrl', 'uploadedBy', 'uploadedAt'];
    var driveSheet = getOrCreateSheet(ss, 'DriveFiles', driveHeaders);
    upsertRowInSheet(driveSheet, driveHeaders, 'id', {
      id: 'drv-' + fileId,
      category: getCategoryFolderName(category),
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
 *ฟังก์ชันอัตโนมัติ: สแกนหา Base64 (รูปภาพ/เอกสาร/ไฟล์ส่งงาน) ใน Object แล้วบันทึกลง Google Drive
 * พร้อมแทนที่ค่าด้วยลิงก์ Google Drive เพื่อไม่ให้เกินลิมิต 50,000 ตัวอักษรต่อเซลล์ของ Google Sheets
 */
function processObjectFilesToDrive(obj, defaultCategory, payload) {
  if (!obj || typeof obj !== 'object') return obj;
  var clone = JSON.parse(JSON.stringify(obj));

  var fileFields = [
    { field: 'logoUrl', namePrefix: 'logo_', cat: defaultCategory || 'school_logo' },
    { field: 'photoUrl', namePrefix: 'photo_', cat: defaultCategory || 'student_photo' },
    { field: 'avatarUrl', namePrefix: 'avatar_', cat: 'school_logo' },
    { field: 'attachmentUrl', namePrefix: 'attachment_', cat: 'assignment' },
    { field: 'submittedFileUrl', namePrefix: 'submission_', cat: 'assignment' },
    { field: 'fileUrl', namePrefix: 'file_', cat: defaultCategory || 'document' },
    { field: 'fileData', namePrefix: 'doc_', cat: defaultCategory || 'document' }
  ];

  fileFields.forEach(function(ff) {
    var val = clone[ff.field];
    if (typeof val === 'string' && val.indexOf('data:') === 0 && val.indexOf(';base64,') !== -1) {
      var customName = clone.fileName || clone.submittedFileName || clone.title || clone.schoolName || clone.firstName || clone.fullName || (ff.namePrefix + (clone.id || new Date().getTime()));
      try {
        var up = saveBase64ToGoogleDrive(val, customName, ff.cat, payload);
        if (up && up.fileUrl) {
          clone[ff.field] = up.fileUrl;
          if (ff.field === 'fileData') {
            clone.fileUrl = up.fileUrl;
            clone.driveFileId = up.fileId;
          }
        }
      } catch (e) {}
    }
  });

  // ตรวจสอบรายการส่งงานของสมาชิกใน Tasks (submissions array)
  if (Array.isArray(clone.submissions)) {
    clone.submissions = clone.submissions.map(function(sub) {
      if (sub && typeof sub.fileUrl === 'string' && sub.fileUrl.indexOf('data:') === 0 && sub.fileUrl.indexOf(';base64,') !== -1) {
        try {
          var subFileName = (sub.memberName ? sub.memberName + '_' : '') + (sub.fileName || 'submission');
          var upSub = saveBase64ToGoogleDrive(sub.fileUrl, subFileName, 'assignment', payload);
          if (upSub && upSub.fileUrl) {
            sub.fileUrl = upSub.fileUrl;
            sub.driveFileId = upSub.fileId;
          }
        } catch (eSub) {}
      }
      return sub;
    });
  }

  return clone;
}

/**
 * ============================================================================
 * SECTION C: ฟังก์ชันบันทึกข้อมูลแต่ละโมดูลลง Google Sheets ประจำโรงเรียน
 * ============================================================================
 */

function handleSaveSchoolInfo(payload) {
  var ss = getTargetSpreadsheet(payload);
  var rawInfo = payload.schoolInfo || {};
  var info = processObjectFilesToDrive(rawInfo, 'school_logo', payload);

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

  return { status: 'success', message: 'บันทึกข้อมูลโรงเรียนและโลโก้ลง Google Sheets & Drive สำเร็จ', logoUrl: info.logoUrl };
}

function handleSaveStudent(payload) {
  var ss = getTargetSpreadsheet(payload);
  var s = processObjectFilesToDrive(payload.student || {}, 'student_photo', payload);
  var headers = ['id', 'rollNumber', 'studentCode', 'prefix', 'firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'age', 'religion', 'gradeLevel', 'room', 'address', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'guardianName', 'guardianPhone', 'dailyAllowance', 'photoUrl', 'status', 'fullDataJson'];
  var sheet = getOrCreateSheet(ss, 'Students', headers);
  s.fullDataJson = safeJsonStringify(s);
  upsertRowInSheet(sheet, headers, 'id', s);
  return { status: 'success', message: 'บันทึกข้อมูลนักเรียนลง Google Sheets สำเร็จ', studentId: s.id, photoUrl: s.photoUrl };
}

function handleSavePersonnel(payload) {
  var ss = getTargetSpreadsheet(payload);
  var p = processObjectFilesToDrive(payload.personnel || {}, 'personnel_photo', payload);
  var headers = ['id', 'personnelCode', 'prefix', 'firstName', 'lastName', 'gender', 'birthDate', 'age', 'position', 'academicStanding', 'department', 'assignedClass', 'education', 'major', 'phone', 'email', 'photoUrl', 'status'];
  var sheet = getOrCreateSheet(ss, 'Personnel', headers);
  upsertRowInSheet(sheet, headers, 'id', p);
  return { status: 'success', message: 'บันทึกข้อมูลบุคลากรลง Google Sheets สำเร็จ', personnelId: p.id, photoUrl: p.photoUrl };
}

function handleSaveMember(payload) {
  var ss = getTargetSpreadsheet(payload);
  var m = processObjectFilesToDrive(payload.member || {}, 'school_logo', payload);
  var headers = ['id', 'username', 'password', 'prefix', 'fullName', 'firstName', 'lastName', 'role', 'gradeLevel', 'position', 'learningGroup', 'schoolId', 'schoolName', 'isSuspended', 'avatarUrl'];
  var sheet = getOrCreateSheet(ss, 'Members', headers);
  upsertRowInSheet(sheet, headers, 'id', m);
  return { status: 'success', message: 'บันทึกข้อมูลสมาชิกลง Google Sheets สำเร็จ', memberId: m.id };
}

function handleSaveDailyTracking(payload) {
  var ss = getTargetSpreadsheet(payload);
  var r = payload.record || {};
  var headers = ['id', 'date', 'studentId', 'milkStatus', 'toothBrushing', 'semester', 'academicYear'];
  var sheet = getOrCreateSheet(ss, 'DailyTracking', headers);
  upsertRowInSheet(sheet, headers, 'id', r);
  return { status: 'success', message: 'บันทึกการดื่มนมและแปรงฟันสำเร็จ' };
}

function handleSaveSubject(payload) {
  var ss = getTargetSpreadsheet(payload);
  var sub = payload.subject || {};
  var headers = ['id', 'code', 'name', 'gradeLevel', 'credits', 'hoursPerYear', 'subjectGroup', 'semester', 'academicYear', 'teacherId', 'teacherName', 'scoreRatio', 'assignmentItemsJson'];
  var sheet = getOrCreateSheet(ss, 'Subjects', headers);
  var rowObj = JSON.parse(JSON.stringify(sub));
  rowObj.assignmentItemsJson = safeJsonStringify(sub.assignmentItems || []);
  upsertRowInSheet(sheet, headers, 'id', rowObj);
  return { status: 'success', message: 'บันทึกรายวิชาลง Google Sheets สำเร็จ' };
}

function handleSaveGrades(payload) {
  var ss = getTargetSpreadsheet(payload);
  var grades = payload.grades || [];
  var headers = ['id', 'studentId', 'subjectId', 'semester', 'academicYear', 'assignmentScoresJson', 'collectedScore', 'midtermScore', 'finalScore', 'totalScore', 'grade'];
  var sheet = getOrCreateSheet(ss, 'Grades', headers);
  grades.forEach(function(g) {
    var rowObj = JSON.parse(JSON.stringify(g));
    rowObj.assignmentScoresJson = safeJsonStringify(g.assignmentScores || {});
    upsertRowInSheet(sheet, headers, 'id', rowObj);
  });
  return { status: 'success', message: 'บันทึกคะแนนและเกรดจำนวน ' + grades.length + ' รายการสำเร็จ' };
}

function handleSaveAttendance(payload) {
  var ss = getTargetSpreadsheet(payload);
  var records = payload.records || [];
  var headers = ['id', 'date', 'studentId', 'status', 'note', 'semester', 'academicYear'];
  var sheet = getOrCreateSheet(ss, 'Attendance', headers);
  records.forEach(function(r) {
    upsertRowInSheet(sheet, headers, 'id', r);
  });
  return { status: 'success', message: 'บันทึกเวลาเรียนจำนวน ' + records.length + ' รายการสำเร็จ' };
}

function handleSaveAttendanceConfig(payload) {
  var ss = getTargetSpreadsheet(payload);
  var cfg = payload.config || payload.data || {};
  var headers = ['id', 'semester', 'academicYear', 'startDate', 'endDate', 'targetDays', 'holidaysJson', 'schoolDaysJson'];
  var sheet = getOrCreateSheet(ss, 'AttendanceConfig', headers);
  var rowObj = {
    id: (cfg.semester || '1') + '_' + (cfg.academicYear || '2569'),
    semester: cfg.semester || '1',
    academicYear: cfg.academicYear || '2569',
    startDate: cfg.startDate || '',
    endDate: cfg.endDate || '',
    targetDays: cfg.targetDays || 0,
    holidaysJson: safeJsonStringify(cfg.holidays || []),
    schoolDaysJson: safeJsonStringify(cfg.schoolDays || [])
  };
  upsertRowInSheet(sheet, headers, 'id', rowObj);
  return { status: 'success', message: 'บันทึกตั้งค่าวันเปิด-ปิดภาคเรียนสำเร็จ' };
}

function handleSaveSavings(payload) {
  var ss = getTargetSpreadsheet(payload);
  var r = payload.record || {};
  var headers = ['id', 'date', 'studentId', 'type', 'amount', 'balanceAfter', 'note', 'recordedBy', 'semester', 'academicYear'];
  var sheet = getOrCreateSheet(ss, 'Savings', headers);
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
  var t = processObjectFilesToDrive(payload.task || {}, 'assignment', payload);
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

  return { status: 'success', message: 'บันทึกงานมอบหมายและไฟล์ส่งงานลง Google Sheets & Drive สำเร็จ' };
}

function handleSaveAllTasks(payload) {
  var ss = getTargetSpreadsheet(payload);
  var tasks = (payload.tasks || []).map(function(t) {
    var processed = processObjectFilesToDrive(t, 'assignment', payload);
    processed.submissionsCount = Array.isArray(processed.submissions) ? processed.submissions.length : 0;
    processed.submissionsJson = safeJsonStringify(processed.submissions || []);
    return processed;
  });
  var headers = ['id', 'title', 'description', 'type', 'priority', 'dueDate', 'isCompleted', 'isManualCompleted', 'createdBy', 'assignedTo', 'attachmentUrl', 'submissionsCount', 'submissionsJson'];
  replaceEntireSheetData(ss, 'Tasks', headers, tasks);
  return { status: 'success', message: 'จัดเรียงและบันทึกงานมอบหมายทั้งหมดสำเร็จ' };
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

function handleUploadDocument(payload) {
  var ss = getTargetSpreadsheet(payload);
  var doc = processObjectFilesToDrive(payload, 'document', payload);
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
    driveFileId: docRecord.driveFileId
  };
}

function handleSaveAllDocuments(payload) {
  var ss = getTargetSpreadsheet(payload);
  var docs = (payload.documents || []).map(function(d) {
    return processObjectFilesToDrive(d, 'document', payload);
  });
  var headers = ['id', 'docNumber', 'title', 'docType', 'category', 'date', 'fileUrl', 'fileName', 'fileSize', 'uploadedBy', 'driveFileId'];
  replaceEntireSheetData(ss, 'Documents', headers, docs);
  return { status: 'success', message: 'บันทึกข้อมูลเอกสารทั้งหมดสำเร็จ' };
}

function handleDeleteDocument(payload) {
  var ss = getTargetSpreadsheet(payload);
  var sheet = ss.getSheetByName('Documents');
  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var driveIdIdx = headers.indexOf('driveFileId');
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(payload.id)) {
        var driveFileId = driveIdIdx >= 0 ? String(data[i][driveIdIdx] || '') : '';
        if (driveFileId) {
          try {
            DriveApp.getFileById(driveFileId).setTrashed(true);
          } catch (e) {}
        }
        sheet.deleteRow(i + 1);
      }
    }
  }
  return { status: 'success', message: 'ลบเอกสารออกจากระบบและ Google Sheets สำเร็จ' };
}

function handleSaveWebsite(payload) {
  var ss = getTargetSpreadsheet(payload);
  var w = processObjectFilesToDrive(payload.website || {}, 'website_logo', payload);
  var headers = ['id', 'title', 'url', 'category', 'description', 'isOfficial', 'logoUrl'];
  var sheet = getOrCreateSheet(ss, 'Websites', headers);
  upsertRowInSheet(sheet, headers, 'id', w);
  return { status: 'success', message: 'บันทึกเว็บไซต์และโลโก้ลง Google Sheets & Drive สำเร็จ', logoUrl: w.logoUrl };
}

function handleSaveAllWebsites(payload) {
  var ss = getTargetSpreadsheet(payload);
  var websites = (payload.websites || []).map(function(w) {
    return processObjectFilesToDrive(w, 'website_logo', payload);
  });
  var headers = ['id', 'title', 'url', 'category', 'description', 'isOfficial', 'logoUrl'];
  replaceEntireSheetData(ss, 'Websites', headers, websites);
  return { status: 'success', message: 'บันทึกเว็บไซต์แนะนำทั้งหมดสำเร็จ' };
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
      handleSaveSchoolInfo({ spreadsheetId: ss.getId(), schoolInfo: value, schoolName: value.schoolName });
    } else if (baseKey === 'ams_students' && Array.isArray(value)) {
      var stdHeaders = ['id', 'rollNumber', 'studentCode', 'prefix', 'firstName', 'lastName', 'nickname', 'gender', 'birthDate', 'age', 'religion', 'gradeLevel', 'room', 'address', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'guardianName', 'guardianPhone', 'dailyAllowance', 'photoUrl', 'status', 'fullDataJson'];
      var stdRows = value.map(function(s) {
        var cleanS = processObjectFilesToDrive(s, 'student_photo', payload);
        cleanS.fullDataJson = safeJsonStringify(cleanS);
        return cleanS;
      });
      replaceEntireSheetData(ss, 'Students', stdHeaders, stdRows);
    } else if (baseKey === 'ams_personnel' && Array.isArray(value)) {
      var perHeaders = ['id', 'personnelCode', 'prefix', 'firstName', 'lastName', 'gender', 'birthDate', 'age', 'position', 'academicStanding', 'department', 'assignedClass', 'education', 'major', 'phone', 'email', 'photoUrl', 'status'];
      var perRows = value.map(function(p) { return processObjectFilesToDrive(p, 'personnel_photo', payload); });
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
      handleSaveAllTasks({ spreadsheetId: ss.getId(), tasks: value, schoolName: payload.schoolName });
    } else if (baseKey === 'ams_documents' && Array.isArray(value)) {
      handleSaveAllDocuments({ spreadsheetId: ss.getId(), documents: value, schoolName: payload.schoolName });
    } else if (baseKey === 'ams_websites' && Array.isArray(value)) {
      handleSaveAllWebsites({ spreadsheetId: ss.getId(), websites: value, schoolName: payload.schoolName });
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
          score: item.score || '',
          level: item.level || '',
          comment: item.comment || '',
          evaluatedBy: item.evaluatedBy || '',
          updatedAt: item.updatedAt || new Date().toISOString(),
          fullDataJson: safeJsonStringify(item)
        };
      });
      replaceEntireSheetData(ss, 'BehaviorEvaluations', behHeaders, behRows);
    } else if (baseKey.indexOf('pp6_') === 0 && value && typeof value === 'object') {
      var pp6Headers = ['id', 'studentId', 'academicYear', 'semester', 'gradeLevel', 'teacherComment', 'directorComment', 'updatedAt', 'fullDataJson'];
      var pp6Sheet = getOrCreateSheet(ss, 'PhorPhor6', pp6Headers);
      upsertRowInSheet(pp6Sheet, pp6Headers, 'id', {
        id: baseKey,
        studentId: value.studentId || '',
        academicYear: value.academicYear || '',
        semester: value.semester || '',
        gradeLevel: value.gradeLevel || '',
        teacherComment: value.teacherComment || '',
        directorComment: value.directorComment || '',
        updatedAt: new Date().toISOString(),
        fullDataJson: safeJsonStringify(value)
      });
    } else if (baseKey === 'ams_assessment_3_booklets_v2' && value && typeof value === 'object') {
      var b3Headers = ['id', 'studentId', 'academicYear', 'semester', 'readingScore', 'characteristicsScore', 'competenciesScore', 'activityResult', 'updatedAt', 'fullDataJson'];
      var b3Rows = Object.keys(value).map(function(k) {
        var item = value[k] || {};
        return {
          id: k,
          studentId: item.studentId || k,
          academicYear: item.academicYear || '',
          semester: item.semester || '',
          readingScore: item.readingScore || '',
          characteristicsScore: item.characteristicsScore || '',
          competenciesScore: item.competenciesScore || '',
          activityResult: item.activityResult || '',
          updatedAt: new Date().toISOString(),
          fullDataJson: safeJsonStringify(item)
        };
      });
      replaceEntireSheetData(ss, 'Assessment3Booklets', b3Headers, b3Rows);
    }
  } catch (structuredErr) {}

  // 2. บันทึก Snapshot ลงในแท็บ SchoolDataKV ของไฟล์โรงเรียนด้วยเสมอ เพื่อเก็บข้อมูลครบ 100% ทุกฟิลด์
  try {
    var kvRow = buildChunkedKvRow(baseKey, value, payload.updatedAt || new Date().getTime());
    if (kvRow) {
      var kvHeaders = ['id', 'updatedAt', 'valueJson', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'];
      var kvSheet = getOrCreateSheet(ss, 'SchoolDataKV', kvHeaders);
      upsertRowInSheet(kvSheet, kvHeaders, 'id', kvRow);
    }
  } catch (kvErr) {}

  return {
    status: 'success',
    spreadsheetId: ss.getId(),
    baseKey: baseKey,
    message: 'ซิงค์ข้อมูล ' + baseKey + ' ลง Google Sheet ประจำโรงเรียนสำเร็จ'
  };
}

function handleSyncAll(payload) {
  var ss = getTargetSpreadsheet(payload);
  var allData = payload.data || {};

  if (allData.schoolInfo) handleSaveSchoolInfo({ spreadsheetId: ss.getId(), schoolInfo: allData.schoolInfo, schoolName: allData.schoolInfo.schoolName });
  if (allData.students) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_students', value: allData.students, schoolName: allData.schoolInfo && allData.schoolInfo.schoolName });
  if (allData.personnel) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_personnel', value: allData.personnel, schoolName: allData.schoolInfo && allData.schoolInfo.schoolName });
  if (allData.subjects) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_subjects', value: allData.subjects });
  if (allData.grades) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_grades', value: allData.grades });
  if (allData.attendance) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_attendance', value: allData.attendance });
  if (allData.savings) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_savings', value: allData.savings });
  if (allData.dailyTracking) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_daily_tracking', value: allData.dailyTracking });
  if (allData.tasks) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_tasks', value: allData.tasks, schoolName: allData.schoolInfo && allData.schoolInfo.schoolName });
  if (allData.documents) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_documents', value: allData.documents, schoolName: allData.schoolInfo && allData.schoolInfo.schoolName });
  if (allData.websites) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_websites', value: allData.websites, schoolName: allData.schoolInfo && allData.schoolInfo.schoolName });
  if (allData.calendar) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_calendar', value: allData.calendar });
  if (allData.leaveRequests) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_leave_requests_v1', value: allData.leaveRequests });
  if (allData.dutyAssignments) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_duty_assignments_v1', value: allData.dutyAssignments });
  if (allData.dailyDutyLogs) handleSyncTenantKey({ spreadsheetId: ss.getId(), baseKey: 'ams_daily_duty_logs_v1', value: allData.dailyDutyLogs });
  if (allData.customButtons) replaceEntireSheetData(ss, 'CustomButtons', ['id', 'label', 'actionUrl', 'category', 'icon', 'color', 'targetRole', 'openInNewTab', 'order', 'schoolId', 'createdAt', 'updatedAt'], allData.customButtons);
  if (allData.customPages) replaceEntireSheetData(ss, 'CustomPages', ['id', 'title', 'slug', 'description', 'content', 'externalUrl', 'icon', 'targetRole', 'isVisible', 'order', 'schoolId', 'createdAt', 'updatedAt'], allData.customPages);

  return {
    status: 'success',
    spreadsheetId: ss.getId(),
    message: 'ซิงค์ฐานข้อมูลทั้งหมดลงใน Google Sheets & Google Drive ประจำโรงเรียนสำเร็จเรียบร้อย!'
  };
}

/**
 * ============================================================================
 * SECTION E: Helper Functions สำหรับจัดการตาราง Google Sheets
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
  var targetSheets = ['Subjects', 'Grades', 'Attendance', 'Savings', 'DailyTracking', 'Tasks', 'Documents', 'LeaveRequests', 'DailyDutyLogs'];
  var deletedCount = 0;

  targetSheets.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return;
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var yearIdx = headers.indexOf('academicYear');
    var dateIdx = headers.indexOf('date');
    var dueDateIdx = headers.indexOf('dueDate');

    for (var i = data.length - 1; i >= 1; i--) {
      var matchYear = (yearIdx >= 0 && String(data[i][yearIdx]) === yearStr);
      var rowDate = dateIdx >= 0 ? String(data[i][dateIdx]) : (dueDateIdx >= 0 ? String(data[i][dueDateIdx]) : '');
      var matchDate = rowDate && (rowDate.indexOf(yearStr) !== -1 || rowDate.indexOf(gregorianStr) !== -1);
      if (matchYear || matchDate) {
        sheet.deleteRow(i + 1);
        deletedCount++;
      }
    }
  });

  return { status: 'success', message: 'ลบข้อมูลปีการศึกษา ' + yearStr + ' จำนวน ' + deletedCount + ' แถวเรียบร้อยแล้ว' };
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
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  return { status: 'success', deletedRows: deletedCount, message: 'ลบข้อมูลรหัส ' + idValue + ' จากชีต ' + sheetName + ' สำเร็จ' };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
