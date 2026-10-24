/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: Academic Management System (ระบบบริหารวิชาการและธุรการ)
 * =========================================================================
 * 
 * วิธีการติดตั้ง:
 * 1. เปิด Google Sheets ใหม่ที่ต้องการใช้เป็นฐานข้อมูล
 * 2. ไปที่เมนู ส่วนขยาย (Extensions) -> Apps Script
 * 3. ลบโค้ดเดิมออกทั้งหมด แล้ววางโค้ดไฟล์นี้ลงไป
 * 4. กำหนด DRIVE_FOLDER_ID ด้วย ID ของโฟลเดอร์ Google Drive สำหรับจัดเก็บไฟล์
 * 5. กด บันทึกโครงการ (Save Project)
 * 6. กดปุ่ม "การทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้รายการใหม่" (New Deployment)
 * 7. เลือกประเภทเป็น "เว็บแอป" (Web app)
 *    - คำอธิบาย: Academic Management System Web API
 *    - ดำเนินการในฐานะ: ตัวฉัน (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)  <-- สำคัญมาก! เพื่อให้เว็บเข้าถึงได้
 * 8. กด "ทำให้ใช้งานได้" (Deploy) และคัดลอก "URL ของเว็บแอป" (Web App URL)
 * 9. นำ URL และ Drive Folder ID ไปใส่ในหน้า การตั้งค่า (Settings) ของระบบ
 */

// กำหนด ID ของ Google Drive Folder สำหรับเก็บไฟล์เอกสารและรูปภาพ
// สามารถแก้ไขตรงนี้ หรือส่งผ่าน parameter ตอนเรียก API ได้
var DEFAULT_DRIVE_FOLDER_ID = ""; // ใส่ Google Drive Folder ID ของคุณที่นี่

// รายชื่อแผ่นงาน (Sheets) ในฐานข้อมูล
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
  CALENDAR: "Calendar"
};

/**
 * จัดการ HTTP GET Requests
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  var result = {};

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "ping") {
      result = { status: "success", message: "Academic Management API is online", timestamp: new Date() };
    } else if (action === "getAllData") {
      result = {
        status: "success",
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
        calendar: getSheetDataAsJson(ss, SHEETS.CALENDAR)
      };
    } else if (action === "getSheet") {
      var sheetName = e.parameter.sheet;
      result = { status: "success", data: getSheetDataAsJson(ss, sheetName) };
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
 * จัดการ HTTP POST Requests (CRUD, File Upload, Auth)
 */
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // เริ่มต้นระบบและสร้างโครงสร้างฐานข้อมูลเริ่มต้น
    if (action === "initDatabase") {
      initDatabaseSheets(ss);
      result = { status: "success", message: "สร้างฐานข้อมูลและตารางเรียบร้อยแล้ว" };
    } 
    // ตรวจสอบการเข้าสู่ระบบ
    else if (action === "login") {
      result = handleLogin(ss, payload.username, payload.password);
    } 
    // บันทึก/อัปเดตข้อมูลนักเรียน
    else if (action === "saveStudent") {
      result = upsertRow(ss, SHEETS.STUDENTS, "id", payload.student);
    } else if (action === "deleteStudent") {
      result = deleteRow(ss, SHEETS.STUDENTS, "id", payload.id);
    }
    // บุคลากร
    else if (action === "savePersonnel") {
      result = upsertRow(ss, SHEETS.PERSONNEL, "id", payload.personnel);
    } else if (action === "deletePersonnel") {
      result = deleteRow(ss, SHEETS.PERSONNEL, "id", payload.id);
    }
    // ข้อมูลโรงเรียน
    else if (action === "saveSchoolInfo") {
      result = saveSchoolInfoData(ss, payload.schoolInfo);
    }
    // สุขภาพประจำวัน (น้ำหนัก/ส่วนสูง, นม, แปรงฟัน)
    else if (action === "saveDailyTracking") {
      result = upsertRow(ss, SHEETS.DAILY_TRACKING, "id", payload.record);
    }
    // รายวิชา
    else if (action === "saveSubject") {
      result = upsertRow(ss, SHEETS.SUBJECTS, "id", payload.subject);
    } else if (action === "deleteSubject") {
      result = deleteRow(ss, SHEETS.SUBJECTS, "id", payload.id);
    }
    // คะแนนและผลการเรียน
    else if (action === "saveGrades") {
      result = bulkUpsertRows(ss, SHEETS.GRADES, "id", payload.grades);
    }
    // เวลาเรียน
    else if (action === "saveAttendance") {
      result = bulkUpsertRows(ss, SHEETS.ATTENDANCE, "id", payload.records);
    }
    // เงินฝากออมทรัพย์
    else if (action === "saveSavings") {
      result = upsertRow(ss, SHEETS.SAVINGS, "id", payload.record);
    }
    // มอบหมายงาน
    else if (action === "saveTask") {
      result = upsertRow(ss, SHEETS.TASKS, "id", payload.task);
    } else if (action === "completeTask") {
      result = updateField(ss, SHEETS.TASKS, "id", payload.id, "isCompleted", true);
    } else if (action === "deleteTask") {
      result = deleteRow(ss, SHEETS.TASKS, "id", payload.id);
    }
    // เอกสารและอัปโหลด Google Drive
    else if (action === "uploadDocument") {
      result = handleUploadDocument(ss, payload);
    } else if (action === "deleteDocument") {
      result = deleteRow(ss, SHEETS.DOCUMENTS, "id", payload.id);
    }
    // เว็บไซต์แนะนำ
    else if (action === "saveWebsite") {
      result = upsertRow(ss, SHEETS.WEBSITES, "id", payload.website);
    } else if (action === "deleteWebsite") {
      result = deleteRow(ss, SHEETS.WEBSITES, "id", payload.id);
    }
    // ปฏิทินกิจกรรม
    else if (action === "saveCalendarEvent") {
      result = upsertRow(ss, SHEETS.CALENDAR, "id", payload.event);
    } else if (action === "deleteCalendarEvent") {
      result = deleteRow(ss, SHEETS.CALENDAR, "id", payload.id);
    }
    // จัดการสมาชิก (Admin เท่านั้น)
    else if (action === "saveMember") {
      result = upsertRow(ss, SHEETS.MEMBERS, "id", payload.member);
    } else if (action === "deleteMember") {
      result = deleteRow(ss, SHEETS.MEMBERS, "id", payload.id);
    }
    // ซิงค์ข้อมูลทั้งหมดจากหน้าเว็บ
    else if (action === "syncAll") {
      result = handleSyncAll(ss, payload.data);
    } else {
      result = { status: "error", message: "Unknown POST action: " + action };
    }
  } catch (error) {
    result = { status: "error", message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ฟังก์ชันสร้างโฟลเดอร์ Google Drive แบบไดนามิกตามรูปแบบ [ActivityName]_[YYYY-MM-DD]
 * และอัปโหลดไฟล์/รูปภาพ
 */
function handleUploadDocument(ss, payload) {
  var parentFolderId = payload.driveFolderId || DEFAULT_DRIVE_FOLDER_ID;
  var parentFolder;

  if (parentFolderId) {
    try {
      parentFolder = DriveApp.getFolderById(parentFolderId);
    } catch (e) {
      parentFolder = DriveApp.getRootFolder();
    }
  } else {
    parentFolder = DriveApp.getRootFolder();
  }

  var activityName = payload.activityName || "GeneralActivity";
  var dateStr = payload.date || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  // รูปแบบโฟลเดอร์ [ActivityName]_[YYYY-MM-DD] ตามข้อกำหนด
  var subFolderName = activityName + "_" + dateStr;

  var subFolder;
  var folderIter = parentFolder.getFoldersByName(subFolderName);
  if (folderIter.hasNext()) {
    subFolder = folderIter.next();
  } else {
    subFolder = parentFolder.createFolder(subFolderName);
  }

  var fileUrl = payload.fileUrl || "";
  var fileSize = payload.fileSize || "";

  // กรณีมีไฟล์ Base64 แนบมาเพื่ออัปโหลด
  if (payload.fileData && payload.fileName) {
    var contentType = payload.mimeType || "application/octet-stream";
    var decoded = Utilities.base64Decode(payload.fileData);
    var blob = Utilities.newBlob(decoded, contentType, payload.fileName);
    var driveFile = subFolder.createFile(blob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Direct link URL
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
 * ดึงข้อมูลใน Sheet ออกมาเป็น Array of JSON Objects
 */
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
      // จัดการ Date objects
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
 * ดึงข้อมูลการตั้งค่าโรงเรียน
 */
function getSchoolInfoData(ss) {
  var sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
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
  var sheet = getOrCreateSheet(ss, SHEETS.SETTINGS);
  sheet.clear();
  var rows = [];
  for (var key in info) {
    if (info.hasOwnProperty(key)) {
      rows.push([key, typeof info[key] === "object" ? JSON.stringify(info[key]) : info[key]]);
    }
  }
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  }
  return { status: "success", message: "บันทึกข้อมูลโรงเรียนสำเร็จ" };
}

/**
 * เพิ่มหรืออัปเดตแถวข้อมูลตาม Key
 */
function upsertRow(ss, sheetName, keyName, dataObj) {
  var sheet = getOrCreateSheet(ss, sheetName);
  var values = sheet.getDataRange().getValues();
  
  if (values.length === 0 || values[0].length === 0 || values[0][0] === "") {
    var headers = Object.keys(dataObj);
    sheet.appendRow(headers);
    var firstRow = headers.map(function(k) { return dataObj[k] || ""; });
    sheet.appendRow(firstRow);
    return { status: "success", action: "inserted" };
  }

  var headers = values[0];
  var keyColIndex = headers.indexOf(keyName);

  // ตรวจสอบและเพิ่มคอลัมน์ใหม่หาก object มี attribute เพิ่มเติม
  for (var k in dataObj) {
    if (headers.indexOf(k) === -1) {
      headers.push(k);
      sheet.getRange(1, headers.length).setValue(k);
    }
  }

  var targetRowIndex = -1;
  var searchKeyVal = dataObj[keyName];

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][keyColIndex]) === String(searchKeyVal)) {
      targetRowIndex = i + 1;
      break;
    }
  }

  var rowValues = headers.map(function(h) {
    var v = dataObj[h];
    return (v !== undefined && v !== null) ? v : "";
  });

  if (targetRowIndex > 0) {
    sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([rowValues]);
    return { status: "success", action: "updated" };
  } else {
    sheet.appendRow(rowValues);
    return { status: "success", action: "inserted" };
  }
}

/**
 * บันทึกหลายแถวพร้อมกัน
 */
function bulkUpsertRows(ss, sheetName, keyName, dataArray) {
  if (!dataArray || dataArray.length === 0) return { status: "success", count: 0 };
  for (var i = 0; i < dataArray.length; i++) {
    upsertRow(ss, sheetName, keyName, dataArray[i]);
  }
  return { status: "success", count: dataArray.length };
}

/**
 * ลบแถว
 */
function deleteRow(ss, sheetName, keyName, keyValue) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: "error", message: "ไม่พบ Sheet " + sheetName };
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var keyColIndex = headers.indexOf(keyName);
  if (keyColIndex === -1) return { status: "error", message: "ไม่พบคีย์ " + keyName };

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][keyColIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "ลบข้อมูลสำเร็จ" };
    }
  }
  return { status: "warning", message: "ไม่พบข้อมูลที่ต้องการลบ" };
}

/**
 * แก้ไขค่าในเซลล์เดียว
 */
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

/**
 * สร้างหรือดึง Sheet
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * ตรวจสอบล็อกอิน
 */
function handleLogin(ss, username, password) {
  // ตรวจสอบ Default Admin
  if (username === "Admin" && password === "123456") {
    return {
      status: "success",
      user: {
        id: "admin-01",
        username: "Admin",
        fullName: "ผู้ดูแลระบบโรงเรียน (Administrator)",
        role: "admin",
        position: "ผู้ดูแลระบบ"
      }
    };
  }

  // ตรวจสอบจากฐานข้อมูล Members
  var members = getSheetDataAsJson(ss, SHEETS.MEMBERS);
  for (var i = 0; i < members.length; i++) {
    var m = members[i];
    if (String(m.username).toLowerCase() === String(username).toLowerCase() && String(m.password) === String(password)) {
      return {
        status: "success",
        user: {
          id: m.id,
          username: m.username,
          fullName: m.fullName,
          role: m.role || "member",
          gradeLevel: m.gradeLevel || "",
          position: m.position || "ครูผู้สอน"
        }
      };
    }
  }

  return { status: "error", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
}

/**
 * ซิงค์ข้อมูลทั้งหมดจากเครื่องไคลเอนต์ลงชีต
 */
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

  return { status: "success", message: "ซิงค์ข้อมูลทั้งหมดลง Google Sheets เรียบร้อยแล้ว", timestamp: new Date() };
}

/**
 * ฟังก์ชันสร้าง Header ของตารางทั้งหมดใน Google Sheets อัตโนมัติ
 */
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
    { name: SHEETS.WEBSITES, headers: ["id", "title", "url", "logoUrl", "category", "description", "isOfficial"] },
    { name: SHEETS.CALENDAR, headers: ["id", "title", "description", "date", "endDate", "type", "color"] }
  ];

  defs.forEach(function(d) {
    var sh = getOrCreateSheet(ss, d.name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(d.headers);
      sh.getRange(1, 1, 1, d.headers.length).setFontWeight("bold").setBackground("#EEF2FF");
    }
  });

  // สร้าง Default Member
  var memSheet = getOrCreateSheet(ss, SHEETS.MEMBERS);
  if (memSheet.getLastRow() <= 1) {
    memSheet.appendRow(["mem-01", "teacher01", "123456", "ครูสมศรี ใจดี", "member", "ป.1", "ครูประจำชั้น ป.1"]);
    memSheet.appendRow(["mem-02", "teacher02", "123456", "ครูมานะ ขยันเรียน", "member", "ป.2", "ครูประจำชั้น ป.2"]);
  }
}
