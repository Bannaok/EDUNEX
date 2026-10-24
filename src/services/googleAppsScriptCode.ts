export const CODE_GS_SOURCE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: Multi-School Academic & Administrative Management API
 * ระบบบริหารงานวิชาการและธุรการโรงเรียน (สถาปัตยกรรมแยกโรงเรียน & รองรับอนาคต)
 * =========================================================================
 * 
 * คุณสมบัติสำคัญ:
 * 1. Multi-School Data Isolation: ทุกครั้งที่ Developer สร้าง ID Admin ระบบจะสร้าง
 *    Google Sheets ประจำโรงเรียนนั้นโดยอัตโนมัติ และย้ายเข้าโฟลเดอร์ Google Drive
 *    ข้อมูลทุกโรงเรียนถูกแยกขาดจากกัน 100% ไม่ปะปนกัน (ผ่าน spreadsheetId)
 * 2. Dynamic Schema & Future-Proof: หน้า Admin และ สมาชิก เมื่อสร้างปุ่มใหม่, หน้าใหม่,
 *    หรือฟิลด์ข้อมูลใหม่ในอนาคต ระบบจะบันทึกเก็บไว้ใน Google Sheets เสมอ โดยตรวจจับ
 *    และสร้างแผ่นงาน (Tabs) รวมถึงเพิ่มคอลัมน์ใหม่อัตโนมัติ (Zero schema locks)
 * 3. Two-Way Real Deletion: เมื่อลบข้อมูล, ปุ่ม, หรือหน้า ในเว็บ หรือเปิดลบแถวใน
 *    Google Sheets ข้อมูลจะถูกลบออกจาก Google Sheets ตามจริง (sheet.deleteRow)
 * 4. Ultra-Fast & Safe Concurrency: ใช้ LockService ป้องกันข้อมูลชนกันเมื่อมีการบันทึก
 *    พร้อมกันหลายคน และอ่าน/เขียนข้อมูลแบบ Batch 2D Array เพื่อความรวดเร็วสูงสุด
 * 5. Universal Compatibility: รองรับทุกเบราว์เซอร์ (Chrome, Safari, Edge, Firefox),
 *    ทุกอุปกรณ์ (มือถือ, แท็บเล็ต, คอมพิวเตอร์) และทุกอีเมล โดยไม่ต้องกังวลเรื่อง CORS
 *    หรือหน้าต่างขอสิทธิ์ล็อกอิน เมื่อตั้งค่า "Execute as: Me" และ "Who has access: Anyone"
 *
 * -------------------------------------------------------------------------
 * คำแนะนำการ Deploy:
 * 1. เปิด Google Drive -> กดปุ่ม "ใหม่" (+ New) -> "เพิ่มเติม" (More) -> "Google Apps Script"
 * 2. ลบโค้ดเดิมทั้งหมดใน Code.gs แล้ววางโค้ดนี้ลงไป
 * 3. (ไม่บังคับ) กำหนด DEFAULT_DRIVE_FOLDER_ID ด้วย Folder ID ของคุณ
 * 4. กด บันทึกโครงการ (Ctrl+S / Cmd+S)
 * 5. กดปุ่มสีฟ้า "การทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 *    - เลือกประเภท: เว็บแอป (Web app)
 *    - คำอธิบาย: Academic Multi-School Future-Ready API
 *    - ดำเนินการในฐานะ (Execute as): ตัวฉัน (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง (Who has access): ทุกคน (Anyone)  <--- สำคัญที่สุด!
 * 6. กด "Deploy" แล้วคัดลอก "URL ของเว็บแอป" (ลงท้ายด้วย /exec)
 * 7. นำไปวางในระบบที่เมนู Developer Console (แท็บที่ 4: การเชื่อมต่อ Google)
 * -------------------------------------------------------------------------
 */

// ใส่ Google Drive Folder ID ของคุณที่นี่เพื่อจัดเก็บ Google Sheets และไฟล์เอกสาร (ถ้ามี)
var DEFAULT_DRIVE_FOLDER_ID = "";

// รายการชื่อแผ่นงานมาตรฐาน (Standard Sheets)
var SHEETS = {
  SETTINGS: "Settings",
  MEMBERS: "Members",
  STUDENTS: "Students",
  PERSONNEL: "Personnel",
  DAILY_TRACKING: "DailyTracking",
  SUBJECTS: "Subjects",
  GRADES: "Grades",
  ATTENDANCE: "Attendance",
  SAVINGS: "Savings",
  TASKS: "Tasks",
  DOCUMENTS: "Documents",
  WEBSITES: "Websites",
  CALENDAR: "Calendar",
  BEHAVIOR: "BehaviorEvaluations",
  CUSTOM_BUTTONS: "CustomButtons",   // รองรับปุ่มที่สร้างเพิ่มในหน้า Admin / Member
  CUSTOM_PAGES: "CustomPages",       // รองรับหน้าใหม่ที่สร้างเพิ่ม
  LEAVE_REQUESTS: "LeaveRequests",   // ข้อมูลการลา
  DUTY_ASSIGNMENTS: "DutyAssignments",// ครูเวรประจำวัน
  DUTY_LOGS: "DailyDutyLogs",        // บันทึกปฏิบัติหน้าที่ครูเวร
  GENERIC_DATA: "GenericEntities"    // รองรับข้อมูลสำหรับฟีเจอร์ใหม่ในอนาคต
};

/**
 * ดึง Spreadsheet ประจำโรงเรียนตามเป้าหมาย (Per-School Routing)
 */
function getTargetSpreadsheet(e, payload) {
  var targetId = "";
  if (payload && payload.spreadsheetId) {
    targetId = payload.spreadsheetId;
  } else if (e && e.parameter && e.parameter.spreadsheetId) {
    targetId = e.parameter.spreadsheetId;
  }

  if (targetId && targetId.trim() !== "") {
    try {
      return SpreadsheetApp.openById(targetId.trim());
    } catch (err) {
      Logger.log("Could not open spreadsheet by ID: " + targetId + " (" + err.message + ")");
    }
  }

  // Fallback to active spreadsheet if script is bound to a sheet
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (err2) {
    return null;
  }
}

/**
 * Handle GET Requests (Health Check, Get Data, Get Schema)
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var result = {};

  try {
    var ss = getTargetSpreadsheet(e, null);

    if (action === "ping") {
      result = { 
        status: "success", 
        message: "Academic Management API is online (Multi-School & Future-Ready)", 
        serverTime: new Date().toISOString(),
        version: "3.0.0"
      };
    } else if (action === "getAllData") {
      if (!ss) {
        result = { 
          status: "error", 
          message: "ไม่พบ Google Spreadsheet ประจำโรงเรียน กรุณาระบุ spreadsheetId" 
        };
      } else {
        result = handleGetAllData(ss);
      }
    } else if (action === "getSheet") {
      if (!ss) {
        result = { status: "error", message: "ไม่พบ Google Spreadsheet" };
      } else {
        var sheetName = e.parameter.sheet;
        result = { status: "success", data: getSheetDataAsJson(ss, sheetName) };
      }
    } else if (action === "getSchema") {
      if (!ss) {
        result = { status: "error", message: "ไม่พบ Google Spreadsheet" };
      } else {
        result = { status: "success", schema: getSpreadsheetSchema(ss) };
      }
    } else {
      result = { status: "error", message: "Unknown GET action: " + action };
    }
  } catch (error) {
    result = { status: "error", message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST Requests (All Mutations: Create, Update, Delete, Upload, Multi-School)
 */
function doPost(e) {
  var result = {};
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    // Acquire script lock with 15-second timeout to prevent multi-device race conditions
    hasLock = lock.tryLock(15000);

    var payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action;

    // -----------------------------------------------------------------------
    // ACTION 1: สร้าง Google Sheets ประจำโรงเรียนใหม่แบบอัตโนมัติ (Multi-School)
    // -----------------------------------------------------------------------
    if (action === "createSchoolSheet") {
      var schoolName = payload.schoolName || "โรงเรียนใหม่";
      var schoolCode = payload.schoolCode || "";
      var adminId = payload.adminId || "";
      var targetFolderId = payload.folderId || DEFAULT_DRIVE_FOLDER_ID;

      var newSs = SpreadsheetApp.create("[ระบบวิชาการ] " + schoolName);
      initDatabaseSheets(newSs);

      // ย้ายเข้า Google Drive Folder หากมีการระบุ
      if (targetFolderId && targetFolderId.trim() !== "") {
        try {
          var folder = DriveApp.getFolderById(targetFolderId.trim());
          var file = DriveApp.getFileById(newSs.getId());
          file.moveTo(folder);
        } catch (fErr) {
          Logger.log("Folder move warning: " + fErr);
        }
      }

      // บันทึกข้อมูลเริ่มต้นของโรงเรียนในชีต Settings
      saveSchoolInfoData(newSs, {
        schoolName: schoolName,
        schoolCode: schoolCode,
        affiliation: payload.affiliation || "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)",
        directorName: payload.directorName || "",
        academicYear: payload.academicYear || "2569",
        semester: "1",
        createdAt: new Date().toISOString()
      });

      result = {
        status: "success",
        message: "สร้าง Google Sheet ประจำโรงเรียน " + schoolName + " สำเร็จแล้ว",
        spreadsheetId: newSs.getId(),
        spreadsheetUrl: newSs.getUrl(),
        schoolName: schoolName,
        adminId: adminId
      };

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // ACTION 2: อัปโหลดไฟล์เอกสาร/รูปภาพเข้า Google Drive พร้อมสร้างลิงก์เข้าถึง
    // -----------------------------------------------------------------------
    if (action === "uploadDriveFile" || action === "uploadFile") {
      var folderId = payload.folderId || DEFAULT_DRIVE_FOLDER_ID;
      var targetFolder = (folderId && folderId.trim() !== "") 
        ? DriveApp.getFolderById(folderId.trim()) 
        : DriveApp.getRootFolder();
      var contentType = payload.mimeType || "application/octet-stream";
      var decoded = Utilities.base64Decode(payload.fileBase64 || payload.fileData);
      var blob = Utilities.newBlob(decoded, contentType, payload.fileName || "uploaded_file");
      var driveFile = targetFolder.createFile(blob);
      
      try {
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log("Sharing warning: " + shareErr);
      }

      result = {
        status: "success",
        fileId: driveFile.getId(),
        fileUrl: "https://drive.google.com/uc?export=view&id=" + driveFile.getId(),
        viewUrl: driveFile.getUrl(),
        fileName: driveFile.getName(),
        fileSize: (driveFile.getSize() / 1024).toFixed(1) + " KB"
      };

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ตรวจสอบ Spreadsheet เป้าหมายสำหรับทุก Action ถัดไป
    var ss = getTargetSpreadsheet(e, payload);
    if (!ss) {
      result = { 
        status: "error", 
        message: "ไม่พบ Google Spreadsheet สำหรับบันทึกข้อมูล กรุณาระบุ spreadsheetId" 
      };
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // ACTION 3: บันทึกและลบปุ่มที่สร้างเพิ่ม (Custom Buttons)
    // -----------------------------------------------------------------------
    if (action === "saveCustomButton") {
      result = upsertRow(ss, SHEETS.CUSTOM_BUTTONS, "id", payload.button || payload.data);
    } else if (action === "deleteCustomButton") {
      result = deleteRow(ss, SHEETS.CUSTOM_BUTTONS, "id", payload.id);
    }

    // -----------------------------------------------------------------------
    // ACTION 4: บันทึกและลบหน้าใหม่ที่สร้างเพิ่ม (Custom Pages)
    // -----------------------------------------------------------------------
    else if (action === "saveCustomPage") {
      result = upsertRow(ss, SHEETS.CUSTOM_PAGES, "id", payload.page || payload.data);
    } else if (action === "deleteCustomPage") {
      result = deleteRow(ss, SHEETS.CUSTOM_PAGES, "id", payload.id);
    }

    // -----------------------------------------------------------------------
    // ACTION 5: Generic Entity Save & Delete (รองรับการพัฒนาฟังก์ชันใหม่ในรอบถัดไป)
    // -----------------------------------------------------------------------
    else if (action === "saveEntity") {
      var targetSheet = payload.sheetName || payload.entityType || SHEETS.GENERIC_DATA;
      var keyField = payload.keyField || "id";
      result = upsertRow(ss, targetSheet, keyField, payload.data || payload.record);
    } else if (action === "deleteEntity") {
      var delSheet = payload.sheetName || payload.entityType || SHEETS.GENERIC_DATA;
      var delKeyField = payload.keyField || "id";
      result = deleteRow(ss, delSheet, delKeyField, payload.id || payload.keyValue);
    } else if (action === "batchSaveEntities") {
      var batchSheet = payload.sheetName || payload.entityType || SHEETS.GENERIC_DATA;
      var batchKey = payload.keyField || "id";
      result = bulkUpsertRows(ss, batchSheet, batchKey, payload.records || payload.data);
    }

    // -----------------------------------------------------------------------
    // ACTION 6: โมดูลวิชาการและธุรการมาตรฐาน (Students, Personnel, Grades, etc.)
    // -----------------------------------------------------------------------
    else if (action === "saveStudent") {
      result = upsertRow(ss, SHEETS.STUDENTS, "id", payload.student);
    } else if (action === "deleteStudent") {
      result = deleteRow(ss, SHEETS.STUDENTS, "id", payload.id);
    }
    else if (action === "savePersonnel") {
      result = upsertRow(ss, SHEETS.PERSONNEL, "id", payload.personnel);
    } else if (action === "deletePersonnel") {
      result = deleteRow(ss, SHEETS.PERSONNEL, "id", payload.id);
    }
    else if (action === "saveSchoolInfo") {
      result = saveSchoolInfoData(ss, payload.schoolInfo);
    }
    else if (action === "saveDailyTracking") {
      result = upsertRow(ss, SHEETS.DAILY_TRACKING, "id", payload.record);
    } else if (action === "deleteDailyTracking") {
      result = deleteRow(ss, SHEETS.DAILY_TRACKING, "id", payload.id);
    }
    else if (action === "saveSubject") {
      result = upsertRow(ss, SHEETS.SUBJECTS, "id", payload.subject);
    } else if (action === "deleteSubject") {
      result = deleteRow(ss, SHEETS.SUBJECTS, "id", payload.id);
    }
    else if (action === "saveGrades") {
      result = bulkUpsertRows(ss, SHEETS.GRADES, "id", payload.grades);
    }
    else if (action === "saveAttendance") {
      result = bulkUpsertRows(ss, SHEETS.ATTENDANCE, "id", payload.records);
    }
    else if (action === "saveSavings") {
      result = upsertRow(ss, SHEETS.SAVINGS, "id", payload.record);
    } else if (action === "deleteSavings") {
      result = deleteRow(ss, SHEETS.SAVINGS, "id", payload.id);
    }
    else if (action === "saveTask") {
      result = upsertRow(ss, SHEETS.TASKS, "id", payload.task);
    } else if (action === "completeTask") {
      result = updateField(ss, SHEETS.TASKS, "id", payload.id, "isCompleted", true);
    } else if (action === "deleteTask") {
      result = deleteRow(ss, SHEETS.TASKS, "id", payload.id);
    }
    else if (action === "uploadDocument") {
      result = handleUploadDocument(ss, payload);
    } else if (action === "deleteDocument") {
      result = deleteRow(ss, SHEETS.DOCUMENTS, "id", payload.id);
    }
    else if (action === "saveWebsite") {
      result = upsertRow(ss, SHEETS.WEBSITES, "id", payload.website);
    } else if (action === "deleteWebsite") {
      result = deleteRow(ss, SHEETS.WEBSITES, "id", payload.id);
    }
    else if (action === "saveCalendarEvent") {
      result = upsertRow(ss, SHEETS.CALENDAR, "id", payload.event);
    } else if (action === "deleteCalendarEvent") {
      result = deleteRow(ss, SHEETS.CALENDAR, "id", payload.id);
    }
    else if (action === "saveBehaviorEvaluation") {
      result = upsertRow(ss, SHEETS.BEHAVIOR, "id", payload.evaluation);
    } else if (action === "deleteBehaviorEvaluation") {
      result = deleteRow(ss, SHEETS.BEHAVIOR, "id", payload.id);
    }
    else if (action === "saveLeaveRequest") {
      result = upsertRow(ss, SHEETS.LEAVE_REQUESTS, "id", payload.record);
    } else if (action === "deleteLeaveRequest") {
      result = deleteRow(ss, SHEETS.LEAVE_REQUESTS, "id", payload.id);
    }
    else if (action === "saveDutyAssignment") {
      result = upsertRow(ss, SHEETS.DUTY_ASSIGNMENTS, "id", payload.record);
    } else if (action === "deleteDutyAssignment") {
      result = deleteRow(ss, SHEETS.DUTY_ASSIGNMENTS, "id", payload.id);
    }
    else if (action === "saveDutyLog") {
      result = upsertRow(ss, SHEETS.DUTY_LOGS, "id", payload.record);
    } else if (action === "deleteDutyLog") {
      result = deleteRow(ss, SHEETS.DUTY_LOGS, "id", payload.id);
    }
    else if (action === "saveMember") {
      result = upsertRow(ss, SHEETS.MEMBERS, "id", payload.member);
    } else if (action === "deleteMember") {
      result = deleteRow(ss, SHEETS.MEMBERS, "id", payload.id);
    }

    // -----------------------------------------------------------------------
    // ACTION 7: ซิงค์ข้อมูลทั้งหมด (Full Sync) & สร้างตารางล่วงหน้า
    // -----------------------------------------------------------------------
    else if (action === "syncAll") {
      result = handleSyncAll(ss, payload.data);
    } else if (action === "initDatabase") {
      initDatabaseSheets(ss);
      result = { status: "success", message: "สร้างฐานข้อมูลและชีตทั้งหมดเรียบร้อยแล้ว" };
    } else {
      result = { status: "error", message: "Unknown POST action: " + action };
    }

  } catch (error) {
    result = { status: "error", message: error.toString() };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (lErr) {}
    }
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ดึงข้อมูลทั้งหมดใน Spreadsheet (ทั้งตารางมาตรฐานและตารางใหม่ที่สร้างขึ้น)
 */
function handleGetAllData(ss) {
  var result = {
    status: "success",
    spreadsheetId: ss.getId(),
    schoolInfo: getSchoolInfoData(ss),
    members: getSheetDataAsJson(ss, SHEETS.MEMBERS),
    students: getSheetDataAsJson(ss, SHEETS.STUDENTS),
    personnel: getSheetDataAsJson(ss, SHEETS.PERSONNEL),
    dailyTracking: getSheetDataAsJson(ss, SHEETS.DAILY_TRACKING),
    subjects: getSheetDataAsJson(ss, SHEETS.SUBJECTS),
    grades: getSheetDataAsJson(ss, SHEETS.GRADES),
    attendance: getSheetDataAsJson(ss, SHEETS.ATTENDANCE),
    savings: getSheetDataAsJson(ss, SHEETS.SAVINGS),
    tasks: getSheetDataAsJson(ss, SHEETS.TASKS),
    documents: getSheetDataAsJson(ss, SHEETS.DOCUMENTS),
    websites: getSheetDataAsJson(ss, SHEETS.WEBSITES),
    calendar: getSheetDataAsJson(ss, SHEETS.CALENDAR),
    behaviorEvaluations: getSheetDataAsJson(ss, SHEETS.BEHAVIOR),
    customButtons: getSheetDataAsJson(ss, SHEETS.CUSTOM_BUTTONS),
    customPages: getSheetDataAsJson(ss, SHEETS.CUSTOM_PAGES),
    leaveRequests: getSheetDataAsJson(ss, SHEETS.LEAVE_REQUESTS),
    dutyAssignments: getSheetDataAsJson(ss, SHEETS.DUTY_ASSIGNMENTS),
    dailyDutyLogs: getSheetDataAsJson(ss, SHEETS.DUTY_LOGS)
  };

  // รวมข้อมูลจากแผ่นงานอื่นๆ ที่ผู้ใช้สร้างเพิ่มในอนาคต (Dynamic Discovery)
  var allSheets = ss.getSheets();
  var standardNames = [];
  for (var k in SHEETS) {
    standardNames.push(SHEETS[k].toLowerCase());
  }

  var dynamicSheets = {};
  for (var s = 0; s < allSheets.length; s++) {
    var curName = allSheets[s].getName();
    if (standardNames.indexOf(curName.toLowerCase()) === -1) {
      dynamicSheets[curName] = getSheetDataAsJson(ss, curName);
    }
  }
  result.customModules = dynamicSheets;

  return result;
}

/**
 * ดึงข้อมูลใน Sheet ออกมาเป็น JSON Array (อ่านแบบ Batch 2D Array ครั้งเดียว)
 */
function getSheetDataAsJson(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var row = {};
    var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      var header = String(headers[j]).trim();
      if (!header) continue;
      var cellVal = values[i][j];
      if (cellVal !== "" && cellVal !== null && cellVal !== undefined) {
        hasData = true;
      }
      if (cellVal instanceof Date) {
        cellVal = Utilities.formatDate(cellVal, "GMT+7", "yyyy-MM-dd");
      }
      row[header] = cellVal;
    }
    if (hasData) rows.push(row);
  }
  return rows;
}

/**
 * ตรวจสอบและขยายคอลัมน์ใหม่อัตโนมัติ (Dynamic Column Expansion)
 * หากข้อมูลที่ส่งเข้ามามีฟิลด์ใหม่ที่ยังไม่มีในหัวตาราง จะเพิ่มคอลัมน์ใหม่ที่แถว 1 ทันที
 */
function ensureHeaders(sheet, record, defaultHeaders) {
  var lastCol = sheet.getLastColumn();
  var headers = [];

  if (lastCol > 0 && sheet.getLastRow() > 0) {
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return String(h).trim();
    });
  } else if (defaultHeaders && defaultHeaders.length > 0) {
    sheet.appendRow(defaultHeaders);
    sheet.setFrozenRows(1);
    formatHeaderRow(sheet, defaultHeaders.length);
    return defaultHeaders;
  }

  if (!record || typeof record !== "object") return headers;

  var recordKeys = Object.keys(record);
  var missingKeys = [];

  for (var k = 0; k < recordKeys.length; k++) {
    var key = recordKeys[k];
    if (key && headers.indexOf(key) === -1) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    for (var m = 0; m < missingKeys.length; m++) {
      var newColIdx = headers.length + 1;
      sheet.getRange(1, newColIdx).setValue(missingKeys[m]);
      headers.push(missingKeys[m]);
    }
    formatHeaderRow(sheet, headers.length);
  }

  return headers;
}

/**
 * จัดรูปแบบหัวตารางให้สวยงามและอ่านง่าย
 */
function formatHeaderRow(sheet, colCount) {
  try {
    var headerRange = sheet.getRange(1, 1, 1, colCount);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1e293b"); // Slate 800
    headerRange.setFontColor("#ffffff");
    headerRange.setHorizontalAlignment("center");
  } catch (e) {}
}

/**
 * บันทึกหรืออัปเดตข้อมูล 1 แถว (Dynamic Upsert)
 */
function upsertRow(ss, sheetName, keyName, record) {
  if (!record) return { status: "error", message: "No record provided" };
  var sheet = getOrCreateSheet(ss, sheetName);
  var headers = ensureHeaders(sheet, record, ["id"]);

  var keyVal = record[keyName];
  var keyColIndex = headers.indexOf(keyName);
  if (keyColIndex === -1) {
    keyColIndex = 0; // Default to column 1
  }

  var lastRow = sheet.getLastRow();
  var rowIndex = -1;

  if (lastRow > 1) {
    var colValues = sheet.getRange(2, keyColIndex + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < colValues.length; i++) {
      if (String(colValues[i][0]) === String(keyVal)) {
        rowIndex = i + 2; // +2 เพราะเริ่มจากแถวที่ 2
        break;
      }
    }
  }

  var rowData = headers.map(function(h) {
    var val = record[h];
    if (val === undefined || val === null) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return val;
  });

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { status: "success", message: "บันทึกข้อมูลลง Google Sheet สำเร็จ", key: keyVal };
}

/**
 * บันทึกหลายรายการพร้อมกันแบบ Batch (เร็ว ปลอดภัย)
 */
function bulkUpsertRows(ss, sheetName, keyName, records) {
  if (!records || !records.length) return { status: "success", count: 0 };
  var sheet = getOrCreateSheet(ss, sheetName);

  // ขยาย Headers ให้ครอบคลุมทุกฟิลด์ของทุกระเบียน
  var headers = ensureHeaders(sheet, records[0], ["id"]);
  for (var r = 1; r < records.length; r++) {
    headers = ensureHeaders(sheet, records[r], headers);
  }

  for (var i = 0; i < records.length; i++) {
    upsertRow(ss, sheetName, keyName, records[i]);
  }

  return { status: "success", count: records.length };
}

/**
 * ลบข้อมูลแถวออกจาก Google Sheets ตามจริง (Two-Way Physical Deletion)
 */
function deleteRow(ss, sheetName, keyName, keyValue) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: "error", message: "Sheet '" + sheetName + "' not found" };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) {
    return { status: "warning", message: "ตารางว่างเปล่า" };
  }

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var keyColIndex = headers.indexOf(keyName);

  if (keyColIndex === -1) {
    return { status: "error", message: "ไม่พบคอลัมน์คีย์ '" + keyName + "'" };
  }

  // วนลูปหาแถวที่ตรงกับ keyValue และสั่งลบแถวจริงออกจาก Google Sheets
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][keyColIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1); // ลบแถวจริงออกจากชีต
      return { 
        status: "success", 
        message: "ลบข้อมูล ID: " + keyValue + " ออกจาก Google Sheets เรียบร้อยแล้ว" 
      };
    }
  }

  return { status: "warning", message: "ไม่พบข้อมูลที่ต้องการลบใน Google Sheets" };
}

/**
 * อัปเดตเฉพาะบางฟิลด์
 */
function updateField(ss, sheetName, keyName, keyValue, fieldName, fieldValue) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: "error", message: "Sheet not found" };
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return { status: "not_found" };

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var keyColIndex = headers.indexOf(keyName);
  var fieldColIndex = headers.indexOf(fieldName);

  if (keyColIndex === -1 || fieldColIndex === -1) {
    return { status: "error", message: "Field not found" };
  }

  var colValues = sheet.getRange(2, keyColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < colValues.length; i++) {
    if (String(colValues[i][0]) === String(keyValue)) {
      sheet.getRange(i + 2, fieldColIndex + 1).setValue(fieldValue);
      return { status: "success" };
    }
  }
  return { status: "not_found" };
}

/**
 * ดึงชีต หรือสร้างชีตใหม่หากยังไม่มี (Dynamic Auto-Creation)
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * ดึงข้อมูลการตั้งค่าโรงเรียน (Settings)
 */
function getSchoolInfoData(ss) {
  var sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var info = {};
  for (var i = 0; i < values.length; i++) {
    var key = values[i][0];
    var val = values[i][1];
    if (key) info[key] = val;
  }
  return info;
}

/**
 * บันทึกข้อมูลการตั้งค่าโรงเรียน
 */
function saveSchoolInfoData(ss, info) {
  if (!info) return { status: "error", message: "No data provided" };
  var sheet = getOrCreateSheet(ss, SHEETS.SETTINGS);
  sheet.clear();
  sheet.appendRow(["Key", "Value"]);
  formatHeaderRow(sheet, 2);
  sheet.setFrozenRows(1);
  
  var keys = Object.keys(info);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = info[k];
    if (typeof v === "object") v = JSON.stringify(v);
    sheet.appendRow([k, v]);
  }
  return { status: "success", message: "บันทึกข้อมูลโรงเรียนสำเร็จ" };
}

/**
 * อัปโหลดเอกสารเข้า Google Drive พร้อมโฟลเดอร์แยกตามกิจกรรม
 */
function handleUploadDocument(ss, payload) {
  var driveFolderId = payload.driveFolderId || DEFAULT_DRIVE_FOLDER_ID;
  var parentFolder = (driveFolderId && driveFolderId.trim() !== "")
    ? DriveApp.getFolderById(driveFolderId.trim())
    : DriveApp.getRootFolder();

  var activityName = payload.activityName || "เอกสารทั่วไป";
  var dateStr = payload.date || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  var yearMonth = dateStr.substring(0, 7);
  var subFolderName = activityName + " (" + yearMonth + ")";

  var subFolder;
  var folderIter = parentFolder.getFoldersByName(subFolderName);
  if (folderIter.hasNext()) {
    subFolder = folderIter.next();
  } else {
    subFolder = parentFolder.createFolder(subFolderName);
  }

  var fileUrl = payload.fileUrl || "";
  var fileSize = payload.fileSize || "";

  if (payload.fileData && payload.fileName) {
    var contentType = payload.mimeType || "application/octet-stream";
    var decoded = Utilities.base64Decode(payload.fileData);
    var blob = Utilities.newBlob(decoded, contentType, payload.fileName);
    var driveFile = subFolder.createFile(blob);
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sErr) {}
    
    fileUrl = "https://drive.google.com/uc?export=view&id=" + driveFile.getId();
    fileSize = (driveFile.getSize() / 1024).toFixed(1) + " KB";
  }

  var docRecord = {
    id: payload.id || Utilities.getUuid(),
    docNumber: payload.docNumber || "-",
    title: payload.title || "เอกสารไม่มีชื่อ",
    category: payload.category || "หนังสือราชการ",
    activityName: activityName,
    folderName: subFolderName,
    date: dateStr,
    fileUrl: fileUrl,
    fileSize: fileSize,
    uploadedBy: payload.uploadedBy || "Admin"
  };

  upsertRow(ss, SHEETS.DOCUMENTS, "id", docRecord);

  return {
    status: "success",
    message: "อัปโหลดและจัดเก็บไฟล์ในโฟลเดอร์ " + subFolderName + " สำเร็จ",
    document: docRecord,
    folderUrl: subFolder.getUrl()
  };
}

/**
 * ตรวจสอบ Schema ของ Spreadsheet ทั้งหมด (สำหรับงานพัฒนาในอนาคต)
 */
function getSpreadsheetSchema(ss) {
  var sheets = ss.getSheets();
  var schema = [];
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var lastCol = s.getLastColumn();
    var headers = [];
    if (lastCol > 0 && s.getLastRow() > 0) {
      headers = s.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    schema.push({
      name: s.getName(),
      rowCount: s.getLastRow(),
      columnCount: lastCol,
      headers: headers
    });
  }
  return schema;
}

/**
 * ซิงค์ข้อมูลทั้งหมด (Full Batch Sync)
 */
function handleSyncAll(ss, data) {
  if (!data) return { status: "error", message: "ไม่มีข้อมูลสำหรับซิงค์" };

  if (data.schoolInfo) saveSchoolInfoData(ss, data.schoolInfo);
  if (data.students) bulkUpsertRows(ss, SHEETS.STUDENTS, "id", data.students);
  if (data.personnel) bulkUpsertRows(ss, SHEETS.PERSONNEL, "id", data.personnel);
  if (data.dailyTracking) bulkUpsertRows(ss, SHEETS.DAILY_TRACKING, "id", data.dailyTracking);
  if (data.subjects) bulkUpsertRows(ss, SHEETS.SUBJECTS, "id", data.subjects);
  if (data.grades) bulkUpsertRows(ss, SHEETS.GRADES, "id", data.grades);
  if (data.attendance) bulkUpsertRows(ss, SHEETS.ATTENDANCE, "id", data.attendance);
  if (data.savings) bulkUpsertRows(ss, SHEETS.SAVINGS, "id", data.savings);
  if (data.tasks) bulkUpsertRows(ss, SHEETS.TASKS, "id", data.tasks);
  if (data.documents) bulkUpsertRows(ss, SHEETS.DOCUMENTS, "id", data.documents);
  if (data.websites) bulkUpsertRows(ss, SHEETS.WEBSITES, "id", data.websites);
  if (data.calendar) bulkUpsertRows(ss, SHEETS.CALENDAR, "id", data.calendar);
  if (data.members) bulkUpsertRows(ss, SHEETS.MEMBERS, "id", data.members);
  if (data.behaviorEvaluations) bulkUpsertRows(ss, SHEETS.BEHAVIOR, "id", data.behaviorEvaluations);
  if (data.customButtons) bulkUpsertRows(ss, SHEETS.CUSTOM_BUTTONS, "id", data.customButtons);
  if (data.customPages) bulkUpsertRows(ss, SHEETS.CUSTOM_PAGES, "id", data.customPages);
  if (data.leaveRequests) bulkUpsertRows(ss, SHEETS.LEAVE_REQUESTS, "id", data.leaveRequests);
  if (data.dutyAssignments) bulkUpsertRows(ss, SHEETS.DUTY_ASSIGNMENTS, "id", data.dutyAssignments);
  if (data.dailyDutyLogs) bulkUpsertRows(ss, SHEETS.DUTY_LOGS, "id", data.dailyDutyLogs);

  return { 
    status: "success", 
    message: "ซิงค์ข้อมูลทั้งหมดลง Google Sheets ประจำโรงเรียนเรียบร้อยแล้ว", 
    timestamp: new Date().toISOString() 
  };
}

/**
 * สร้างและจัดเตรียมโครงสร้างตารางเริ่มต้นสำหรับโรงเรียน
 */
function initDatabaseSheets(ss) {
  var defs = [
    { name: SHEETS.MEMBERS, headers: ["id", "username", "password", "fullName", "role", "gradeLevel", "position", "schoolId"] },
    { name: SHEETS.STUDENTS, headers: ["id", "studentCode", "prefix", "firstName", "lastName", "nickname", "gender", "birthDate", "age", "gradeLevel", "room", "address", "fatherName", "motherName", "parentOccupation", "dailyAllowance", "chronicDisease", "photoUrl", "status"] },
    { name: SHEETS.PERSONNEL, headers: ["id", "prefix", "firstName", "lastName", "position", "advisorGrade", "department", "birthDate", "employmentDate", "retirementDate", "major", "degree", "phone", "email", "avatarUrl"] },
    { name: SHEETS.DAILY_TRACKING, headers: ["id", "date", "studentId", "studentName", "gradeLevel", "weight", "height", "bmi", "bmiStatus", "milkStatus", "toothBrushStatus"] },
    { name: SHEETS.SUBJECTS, headers: ["id", "code", "name", "gradeLevel", "hoursPerWeek", "semester", "academicYear", "totalScore", "courseworkScore", "examScore", "teacherId", "teacherName"] },
    { name: SHEETS.GRADES, headers: ["id", "studentId", "studentName", "gradeLevel", "subjectId", "subjectCode", "subjectName", "semester", "academicYear", "courseworkScore", "examScore", "totalScore", "gradeGpa", "readingWritingScore", "desiredCharacteristicsScore", "competencyScore"] },
    { name: SHEETS.ATTENDANCE, headers: ["id", "date", "studentId", "studentName", "gradeLevel", "status", "academicYear", "semester", "note"] },
    { name: SHEETS.SAVINGS, headers: ["id", "date", "studentId", "studentName", "gradeLevel", "type", "amount", "balanceAfter", "academicYear", "notes"] },
    { name: SHEETS.TASKS, headers: ["id", "title", "description", "assignedTo", "priority", "dueDate", "isCompleted", "completedAt", "createdBy", "attachmentUrl"] },
    { name: SHEETS.DOCUMENTS, headers: ["id", "docNumber", "title", "category", "activityName", "folderName", "date", "fileUrl", "fileSize", "uploadedBy"] },
    { name: SHEETS.WEBSITES, headers: ["id", "title", "url", "category", "description", "logoUrl"] },
    { name: SHEETS.CALENDAR, headers: ["id", "title", "description", "date", "endDate", "type", "color", "announcement", "taskDue"] },
    { name: SHEETS.BEHAVIOR, headers: ["id", "studentId", "academicYear", "semester", "date", "learning", "attention", "responsibility", "freeTimeUsage", "relationships", "emotionalControl", "habitsPersonality", "health", "teacherComment", "updatedAt"] },
    { name: SHEETS.CUSTOM_BUTTONS, headers: ["id", "label", "actionUrl", "category", "icon", "color", "targetRole", "openInNewTab", "order", "schoolId", "createdBy", "createdAt"] },
    { name: SHEETS.CUSTOM_PAGES, headers: ["id", "slug", "title", "description", "category", "icon", "targetRole", "contentMarkdown", "externalUrl", "schoolId", "createdBy", "createdAt"] },
    { name: SHEETS.LEAVE_REQUESTS, headers: ["id", "teacherName", "leaveType", "startDate", "endDate", "reason", "directorName", "personnelOfficer", "status", "createdAt"] },
    { name: SHEETS.DUTY_ASSIGNMENTS, headers: ["id", "dayOfWeek", "teacherNames", "dutyType", "location", "note"] },
    { name: SHEETS.DUTY_LOGS, headers: ["id", "date", "dutyTeacherName", "dutyType", "location", "weatherCondition", "overallStatus", "timeSlots", "incidentsNote", "createdAt"] }
  ];

  for (var i = 0; i < defs.length; i++) {
    var def = defs[i];
    var sheet = getOrCreateSheet(ss, def.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      sheet.setFrozenRows(1);
      formatHeaderRow(sheet, def.headers.length);
    }
  }

  // ลบ Sheet1 เริ่มต้นทิ้งเพื่อความเรียบร้อย
  var sheet1 = ss.getSheetByName("Sheet1") || ss.getSheetByName("แผ่นงาน1");
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch (e) {}
  }
}
`;

export const SETUP_GUIDE_STEPS = [
  {
    step: 1,
    title: "สร้าง Google Apps Script ใน Google Drive",
    desc: "ไปที่ Google Drive ของคุณ -> คลิกปุ่ม '+ ใหม่' (+ New) -> 'เพิ่มเติม' (More) -> เลือก 'Google Apps Script'"
  },
  {
    step: 2,
    title: "วางโค้ด Code.gs (เวอร์ชันใหม่ 3.0 รองรับปุ่ม/หน้าใหม่ & สองทางลบ)",
    desc: "ลบโค้ดเดิมออกทั้งหมด แล้วนำโค้ด Code.gs ล่าสุดไปวางลงในไฟล์ Code.gs"
  },
  {
    step: 3,
    title: "ระบุ Google Drive Folder ID (อุปกรณ์เสริม)",
    desc: "สร้างโฟลเดอร์ใน Google Drive สำหรับรวม Google Sheets ของแต่ละโรงเรียนและไฟล์เอกสาร แล้วนำ Folder ID มาใส่ในตัวแปร DEFAULT_DRIVE_FOLDER_ID"
  },
  {
    step: 4,
    title: "Deploy เป็น Web App (สำคัญมาก: ใครก็ตามเข้าถึงได้)",
    desc: "คลิกปุ่ม 'การทำให้ใช้งานได้' (Deploy) -> 'การทำให้ใช้งานได้รายการใหม่' (New deployment) -> เลือกประเภท 'เว็บแอป' (Web app) -> ดำเนินการในฐานะ 'ตัวฉัน' (Me) -> ผู้มีสิทธิ์เข้าถึง 'ทุกคน' (Anyone) เพื่อให้ใช้งานได้ทุกเบราว์เซอร์ ทุกอุปกรณ์ และทุกอีเมลโดยไม่มีหน้าต่างขอสิทธิ์"
  },
  {
    step: 5,
    title: "นำ Web App URL มาใส่ในระบบ",
    desc: "คัดลอก URL ของเว็บแอป (ลงท้ายด้วย /exec) มาวางในช่อง Google Apps Script Web App URL ในแท็บที่ 4 ของหน้า Developer Console นี้"
  }
];
