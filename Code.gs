/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: Multi-School Academic Management System
 * ระบบบริหารวิชาการและธุรการ (รองรับหลายโรงเรียน & สร้าง Google Sheets อัตโนมัติ)
 * =========================================================================
 * 
 * คุณสมบัติเด่น:
 * 1. Multi-School Automation: เมื่อ Developer สร้าง ID Admin โรงเรียน ระบบจะสร้าง
 *    Google Sheets ประจำโรงเรียนนั้นโดยอัตโนมัติ และย้ายเข้าโฟลเดอร์ Google Drive
 * 2. Dedicated Data Storage: ข้อมูลนักเรียน คะแนน เวลาเรียน ธุรการ จะถูกบันทึกแยกตาม
 *    Google Sheets ของแต่ละโรงเรียน (Admin) ไม่ปะปนกัน
 * 3. Two-Way Sync & Delete: เพิ่ม ลบ หรือแก้ไขข้อมูลใดๆ ในเว็บ จะซิงค์และลบออกจาก
 *    Google Sheets ตามจริงทันที
 * 4. Google Drive Cloud Storage: อัปโหลดเอกสาร คำสั่ง หรือไฟล์รูปภาพเข้า Google Drive
 *    และสร้างลิงก์ดาวน์โหลดแบบแชร์สาธารณะให้อัตโนมัติ
 *
 * วิธีการติดตั้ง:
 * 1. เปิด Google Drive -> กดปุ่ม "ใหม่" (+ New) -> เพิ่มเติม (More) -> Google Apps Script
 * 2. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้ลงไป
 * 3. กำหนด DEFAULT_DRIVE_FOLDER_ID ด้านล่างด้วย ID โฟลเดอร์ Google Drive ของคุณ
 * 4. กด บันทึกโครงการ (Save Project)
 * 5. กดปุ่ม "การทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 *    - ประเภท: เว็บแอป (Web app)
 *    - คำอธิบาย: Academic Management Multi-School API
 *    - ดำเนินการในฐานะ: ตัวฉัน (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)  <-- สำคัญมาก!
 * 6. กด Deploy และคัดลอก "URL ของเว็บแอป" (Web App URL)
 * 7. นำ Web App URL ไปใส่ในหน้า Developer Console ของระบบ
 */

var DEFAULT_DRIVE_FOLDER_ID = ""; // ใส่ Google Drive Folder ID ของคุณที่นี่ (ไม่บังคับ)

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
  BEHAVIOR: "BehaviorEvaluations"
};

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
      Logger.log("Could not open spreadsheet by ID: " + targetId + ", falling back to active");
    }
  }

  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (err2) {
    return null;
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var result = {};

  try {
    var ss = getTargetSpreadsheet(e, null);

    if (action === "ping") {
      result = { 
        status: "success", 
        message: "Academic Management API is online (Multi-School & Cloudflare D1 Ready)", 
        timestamp: new Date() 
      };
    } else if (action === "getAllData") {
      if (!ss) {
        result = { status: "error", message: "ไม่พบ Google Spreadsheet หรือยังไม่ได้ระบุ spreadsheetId" };
      } else {
        result = {
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
          behaviorEvaluations: getSheetDataAsJson(ss, SHEETS.BEHAVIOR)
        };
      }
    } else if (action === "getSheet") {
      if (!ss) {
        result = { status: "error", message: "ไม่พบ Google Spreadsheet" };
      } else {
        var sheetName = e.parameter.sheet;
        result = { status: "success", data: getSheetDataAsJson(ss, sheetName) };
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

function doPost(e) {
  var result = {};
  try {
    var payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action;

    // 1. ACTION: Create a new dedicated Google Sheet for a newly created School Admin
    if (action === "createSchoolSheet") {
      var schoolName = payload.schoolName || "โรงเรียนใหม่";
      var schoolCode = payload.schoolCode || "";
      var adminId = payload.adminId || "";
      var targetFolderId = payload.folderId || DEFAULT_DRIVE_FOLDER_ID;

      var newSs = SpreadsheetApp.create("[ระบบวิชาการ] " + schoolName);
      initDatabaseSheets(newSs);

      // Move to Google Drive Folder if provided
      if (targetFolderId && targetFolderId.trim() !== "") {
        try {
          var folder = DriveApp.getFolderById(targetFolderId.trim());
          var file = DriveApp.getFileById(newSs.getId());
          file.moveTo(folder);
        } catch (fErr) {
          Logger.log("Folder move warning: " + fErr);
        }
      }

      // Prepopulate School Info in Settings sheet
      saveSchoolInfoData(newSs, {
        schoolName: schoolName,
        schoolCode: schoolCode,
        affiliation: payload.affiliation || "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)",
        academicYear: payload.academicYear || "2569",
        semester: "1"
      });

      result = {
        status: "success",
        message: "สร้าง Google Sheet ประจำโรงเรียน " + schoolName + " เรียบร้อยแล้ว",
        spreadsheetId: newSs.getId(),
        spreadsheetUrl: newSs.getUrl(),
        schoolName: schoolName,
        adminId: adminId
      };

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. ACTION: Upload any file directly to Google Drive Folder
    if (action === "uploadDriveFile" || action === "uploadFile") {
      var folderId = payload.folderId || DEFAULT_DRIVE_FOLDER_ID;
      var targetFolder = (folderId && folderId.trim() !== "") ? DriveApp.getFolderById(folderId.trim()) : DriveApp.getRootFolder();
      var contentType = payload.mimeType || "application/octet-stream";
      var decoded = Utilities.base64Decode(payload.fileBase64 || payload.fileData);
      var blob = Utilities.newBlob(decoded, contentType, payload.fileName || "uploaded_file");
      var driveFile = targetFolder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

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

    var ss = getTargetSpreadsheet(e, payload);
    if (!ss) {
      result = { status: "error", message: "ไม่พบ Google Spreadsheet หรือยังไม่ได้ระบุ spreadsheetId สำหรับโรงเรียนนี้" };
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "initDatabase") {
      initDatabaseSheets(ss);
      result = { status: "success", message: "สร้างฐานข้อมูลและตารางเรียบร้อยแล้ว" };
    } 
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
    else if (action === "syncAll") {
      result = handleSyncAll(ss, payload.data);
    }
    else {
      result = { status: "error", message: "Unknown POST action: " + action };
    }
  } catch (error) {
    result = { status: "error", message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleUploadDocument(ss, payload) {
  var driveFolderId = payload.driveFolderId || DEFAULT_DRIVE_FOLDER_ID;
  if (!driveFolderId) {
    return { status: "error", message: "ไม่ได้ระบุ Google Drive Folder ID" };
  }

  var parentFolder = DriveApp.getFolderById(driveFolderId);
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
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
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

function getSheetDataAsJson(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  var headers = values[0];
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var row = {};
    var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var cellVal = values[i][j];
      if (cellVal !== "") hasData = true;
      if (cellVal instanceof Date) {
        cellVal = Utilities.formatDate(cellVal, "GMT+7", "yyyy-MM-dd");
      }
      row[header] = cellVal;
    }
    if (hasData) rows.push(row);
  }
  return rows;
}

function getSchoolInfoData(ss) {
  var sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  var info = {};
  for (var i = 1; i < values.length; i++) {
    var key = values[i][0];
    var val = values[i][1];
    if (key) info[key] = val;
  }
  return info;
}

function saveSchoolInfoData(ss, info) {
  if (!info) return { status: "error", message: "No data provided" };
  var sheet = getOrCreateSheet(ss, SHEETS.SETTINGS);
  sheet.clear();
  sheet.appendRow(["Key", "Value"]);
  
  var keys = Object.keys(info);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = info[k];
    if (typeof v === "object") v = JSON.stringify(v);
    sheet.appendRow([k, v]);
  }
  return { status: "success", message: "บันทึกข้อมูลโรงเรียนสำเร็จ" };
}

function upsertRow(ss, sheetName, keyName, record) {
  if (!record) return { status: "error", message: "No record provided" };
  var sheet = getOrCreateSheet(ss, sheetName);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];

  var keyVal = record[keyName];
  var rowIndex = -1;
  var keyColIndex = headers.indexOf(keyName);

  if (keyColIndex !== -1) {
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][keyColIndex]) === String(keyVal)) {
        rowIndex = i + 1;
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

  return { status: "success", message: "บันทึกข้อมูลสำเร็จ" };
}

function bulkUpsertRows(ss, sheetName, keyName, records) {
  if (!records || !records.length) return { status: "success", count: 0 };
  for (var i = 0; i < records.length; i++) {
    upsertRow(ss, sheetName, keyName, records[i]);
  }
  return { status: "success", count: records.length };
}

function deleteRow(ss, sheetName, keyName, keyValue) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: "error", message: "Sheet not found" };
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var keyColIndex = headers.indexOf(keyName);

  if (keyColIndex === -1) return { status: "error", message: "Key column not found" };

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][keyColIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "ลบข้อมูลออกจาก Google Sheets สำเร็จ" };
    }
  }
  return { status: "warning", message: "ไม่พบข้อมูลที่ต้องการลบใน Google Sheets" };
}

function updateField(ss, sheetName, keyName, keyValue, fieldName, fieldValue) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: "error", message: "Sheet not found" };
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var keyColIndex = headers.indexOf(keyName);
  var fieldColIndex = headers.indexOf(fieldName);

  if (keyColIndex === -1 || fieldColIndex === -1) {
    return { status: "error", message: "Field not found" };
  }

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][keyColIndex]) === String(keyValue)) {
      sheet.getRange(i + 1, fieldColIndex + 1).setValue(fieldValue);
      return { status: "success" };
    }
  }
  return { status: "not_found" };
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function handleSyncAll(ss, data) {
  if (!data) return { status: "error", message: "ไม่มีข้อมูล" };
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

  return { status: "success", message: "ซิงค์ข้อมูลทั้งหมดลง Google Sheets ประจำโรงเรียนเรียบร้อยแล้ว", timestamp: new Date() };
}

function initDatabaseSheets(ss) {
  var defs = [
    { name: SHEETS.MEMBERS, headers: ["id", "username", "password", "fullName", "role", "gradeLevel", "position"] },
    { name: SHEETS.STUDENTS, headers: ["id", "studentCode", "prefix", "firstName", "lastName", "gender", "birthDate", "age", "gradeLevel", "room", "fatherName", "motherName", "parentOccupation", "dailyAllowance", "address", "photoUrl", "status"] },
    { name: SHEETS.PERSONNEL, headers: ["id", "prefix", "firstName", "lastName", "position", "birthDate", "employmentDate", "retirementDate", "major", "degree", "phone", "email", "avatarUrl"] },
    { name: SHEETS.DAILY_TRACKING, headers: ["id", "date", "studentId", "studentName", "gradeLevel", "weight", "height", "bmi", "bmiStatus", "milkStatus", "toothBrushStatus"] },
    { name: SHEETS.SUBJECTS, headers: ["id", "code", "name", "gradeLevel", "hoursPerWeek", "semester", "totalScore", "courseworkScore", "examScore", "teacherId", "teacherName"] },
    { name: SHEETS.GRADES, headers: ["id", "studentId", "studentName", "gradeLevel", "subjectId", "subjectCode", "subjectName", "semester", "academicYear", "courseworkScore", "examScore", "totalScore", "gradeGpa", "readingWritingScore", "desiredCharacteristicsScore", "competencyScore"] },
    { name: SHEETS.ATTENDANCE, headers: ["id", "date", "studentId", "studentName", "gradeLevel", "status", "note"] },
    { name: SHEETS.SAVINGS, headers: ["id", "date", "studentId", "studentName", "gradeLevel", "type", "amount", "balanceAfter", "notes"] },
    { name: SHEETS.TASKS, headers: ["id", "title", "description", "assignedTo", "priority", "dueDate", "isCompleted", "completedAt", "createdBy", "attachmentUrl"] },
    { name: SHEETS.DOCUMENTS, headers: ["id", "docNumber", "title", "category", "activityName", "folderName", "date", "fileUrl", "fileSize", "uploadedBy"] },
    { name: SHEETS.WEBSITES, headers: ["id", "title", "url", "category", "description", "logoUrl"] },
    { name: SHEETS.CALENDAR, headers: ["id", "title", "description", "date", "endDate", "type", "color", "announcement", "taskDue"] },
    { name: SHEETS.BEHAVIOR, headers: ["id", "studentId", "academicYear", "semester", "date", "learning", "attention", "responsibility", "freeTimeUsage", "relationships", "emotionalControl", "habitsPersonality", "health", "teacherComment", "updatedAt"] }
  ];

  for (var i = 0; i < defs.length; i++) {
    var def = defs[i];
    var sheet = getOrCreateSheet(ss, def.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
      sheet.setFrozenRows(1);
    }
  }

  // Remove default "Sheet1" if exists
  var sheet1 = ss.getSheetByName("Sheet1") || ss.getSheetByName("แผ่นงาน1");
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch (e) {}
  }
}
