import {
  Student,
  Personnel,
  SchoolInfo,
  DailyTracking,
  Subject,
  GradeRecord,
  AttendanceRecord,
  AttendanceDayConfig,
  SavingsRecord,
  TaskItem,
  DocumentItem,
  RecommendedWebsite,
  CalendarEvent,
  MemberAccount,
  GoogleConfig,
  UserSession,
  SchoolAdminAccount,
  CommentSession,
  StudentBehaviorEvaluation
} from '../types';
import { D1Service } from './d1Service';

import {
  INITIAL_SCHOOL_INFO,
  INITIAL_MEMBERS,
  INITIAL_ADMINS,
  INITIAL_STUDENTS,
  INITIAL_PERSONNEL,
  INITIAL_DAILY_TRACKING,
  INITIAL_SUBJECTS,
  INITIAL_GRADES,
  INITIAL_ATTENDANCE_CONFIG,
  INITIAL_ATTENDANCE,
  INITIAL_SAVINGS,
  INITIAL_TASKS,
  INITIAL_DOCUMENTS,
  INITIAL_WEBSITES,
  INITIAL_CALENDAR_EVENTS
} from './initialData';

const KEYS = {
  SESSION: 'ams_session',
  GOOGLE_CONFIG: 'ams_google_config',
  SCHOOL_INFO: 'ams_school_info',
  ADMINS: 'ams_school_admins',
  MEMBERS: 'ams_members',
  STUDENTS: 'ams_students',
  PERSONNEL: 'ams_personnel',
  DAILY_TRACKING: 'ams_daily_tracking',
  SUBJECTS: 'ams_subjects',
  GRADES: 'ams_grades',
  ATTENDANCE_CONFIG: 'ams_attendance_config',
  ATTENDANCE: 'ams_attendance',
  SAVINGS: 'ams_savings',
  TASKS: 'ams_tasks',
  DOCUMENTS: 'ams_documents',
  WEBSITES: 'ams_websites',
  CALENDAR: 'ams_calendar',
  ACADEMIC_YEARS: 'ams_academic_years',
  LOCKED_SEMESTERS: 'ams_locked_semesters',
  ATTENDANCE_CONFIGS_BY_TERM: 'ams_attendance_configs_by_term',
  COMMENT_SESSIONS: 'ams_comment_sessions',
  BEHAVIOR_EVALUATIONS: 'ams_behavior_evaluations'
};


function getLocal<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    if (!val) return fallback;
    return JSON.parse(val) as T;
  } catch (err) {
    console.error('Failed to parse from localStorage key:', key, err);
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to save to localStorage key:', key, err);
  }
}

export const StorageService = {
  // Session & Auth
  getSession(): UserSession {
    const defaultAdmin: UserSession = {
      id: 'admin-01',
      username: 'Admin',
      fullName: 'ผู้ดูแลระบบโรงเรียน (Administrator)',
      role: 'admin',
      position: 'ผู้ดูแลระบบวิชาการ',
      schoolId: 'admin-school-01',
      schoolName: 'โรงเรียนอนุบาลเทศบาลดอนวิทยา'
    };
    return getLocal<UserSession>(KEYS.SESSION, defaultAdmin);
  },

  setSession(session: UserSession | null): void {
    if (session) {
      setLocal(KEYS.SESSION, session);
    } else {
      localStorage.removeItem(KEYS.SESSION);
    }
  },

  // School Admins (Level 2: Multiple Admins for Multi-Schools)
  getAdmins(): SchoolAdminAccount[] {
    return getLocal<SchoolAdminAccount[]>(KEYS.ADMINS, INITIAL_ADMINS);
  },

  saveAdmin(admin: SchoolAdminAccount): SchoolAdminAccount[] {
    const list = this.getAdmins();
    const idx = list.findIndex(a => a.id === admin.id || a.username.toLowerCase() === admin.username.toLowerCase());
    let updated: SchoolAdminAccount[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...list[idx], ...admin };
    } else {
      updated = [admin, ...list];
    }
    setLocal(KEYS.ADMINS, updated);
    D1Service.saveAdmin(admin).catch(() => {});
    return updated;
  },

  deleteAdmin(id: string): SchoolAdminAccount[] {
    const updated = this.getAdmins().filter(a => a.id !== id);
    setLocal(KEYS.ADMINS, updated);
    D1Service.deleteAdmin(id).catch(() => {});
    return updated;
  },

  authenticate(username: string, password: string): { success: boolean; user?: UserSession; message: string } {
    const trimmedUser = username.trim();

    // 1. Level 1: Developer Account (ID: Airfan | Password: 456789)
    if (trimmedUser.toLowerCase() === 'airfan' && password === '456789') {
      const devUser: UserSession = {
        id: 'dev-01',
        username: 'Airfan',
        fullName: 'Airfan (Developer)',
        role: 'developer',
        position: 'ผู้พัฒนาระบบสูงสุด (System Developer)'
      };
      this.setSession(devUser);
      return { 
        success: true, 
        user: devUser, 
        message: 'เข้าสู่ระบบในฐานะ Developer (Airfan) ระดับที่ 1 สำเร็จ' 
      };
    }

    // 2. Level 2: School Admins List
    const admins = this.getAdmins();
    const foundAdmin = admins.find(a => 
      a.username.toLowerCase() === trimmedUser.toLowerCase() && 
      (a.password === password || (!a.password && password === '123456'))
    );
    if (foundAdmin) {
      if (foundAdmin.isSuspended) {
        return { success: false, message: 'บัญชีผู้ดูแลโรงเรียนนี้ถูกระงับการใช้งาน กรุณาติดต่อ Developer' };
      }
      const adminUser: UserSession = {
        id: foundAdmin.id,
        username: foundAdmin.username,
        fullName: foundAdmin.fullName,
        role: 'admin',
        position: 'ผู้ดูแลระบบโรงเรียน',
        schoolId: foundAdmin.id,
        schoolName: foundAdmin.schoolName
      };
      this.setSession(adminUser);
      return { 
        success: true, 
        user: adminUser, 
        message: `ยินดีต้อนรับผู้ดูแลระบบ ${foundAdmin.schoolName} (${foundAdmin.fullName})` 
      };
    }

    // Default legacy Admin fallback
    if (trimmedUser.toLowerCase() === 'admin' && password === '123456') {
      const adminUser: UserSession = {
        id: 'admin-01',
        username: 'Admin',
        fullName: 'ผู้ดูแลระบบโรงเรียน (Administrator)',
        role: 'admin',
        position: 'ผู้ดูแลระบบโรงเรียน',
        schoolId: 'admin-school-01',
        schoolName: 'โรงเรียนอนุบาลเทศบาลดอนวิทยา'
      };
      this.setSession(adminUser);
      return { success: true, user: adminUser, message: 'เข้าสู่ระบบในฐานะผู้ดูแลระบบ (Admin) สำเร็จ' };
    }

    // 3. Level 3: Members (Teachers / Staff)
    const members = this.getMembers();
    const found = members.find(m => 
      m.username.toLowerCase() === trimmedUser.toLowerCase() && 
      (m.password === password || !m.password)
    );
    if (found) {
      if (found.isSuspended) {
        return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ (Admin) หรือ Developer' };
      }
      const memberUser: UserSession = {
        id: found.id,
        username: found.username,
        prefix: found.prefix,
        fullName: found.fullName,
        firstName: found.firstName,
        lastName: found.lastName,
        role: found.role || 'member',
        assignedGrade: found.gradeLevel,
        position: found.position,
        learningGroup: found.learningGroup,
        avatarUrl: found.avatarUrl,
        schoolId: found.schoolId,
        schoolName: found.schoolName
      };
      this.setSession(memberUser);
      return { 
        success: true, 
        user: memberUser, 
        message: `ยินดีต้อนรับ ${found.fullName} (สมาชิกบุคลากร)` 
      };
    }

    return { 
      success: false, 
      message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Developer: Airfan / 456789 | Admin: Admin / 123456)' 
    };
  },

  // Google Config
  getGoogleConfig(): GoogleConfig {
    return getLocal<GoogleConfig>(KEYS.GOOGLE_CONFIG, {
      webAppUrl: '',
      driveFolderId: '',
      isConnected: false
    });
  },

  setGoogleConfig(config: GoogleConfig): void {
    setLocal(KEYS.GOOGLE_CONFIG, config);
  },

  // School Info
  getSchoolInfo(): SchoolInfo {
    return getLocal<SchoolInfo>(KEYS.SCHOOL_INFO, INITIAL_SCHOOL_INFO);
  },

  setSchoolInfo(info: SchoolInfo): void {
    setLocal(KEYS.SCHOOL_INFO, info);
    this.syncPostToGoogle('saveSchoolInfo', { schoolInfo: info });
  },

  // Members
  getMembers(): MemberAccount[] {
    return getLocal<MemberAccount[]>(KEYS.MEMBERS, INITIAL_MEMBERS);
  },

  saveMember(member: MemberAccount): MemberAccount[] {
    const list = this.getMembers();
    const idx = list.findIndex(m => m.id === member.id);
    let updated: MemberAccount[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = member;
    } else {
      updated = [member, ...list];
    }
    setLocal(KEYS.MEMBERS, updated);
    D1Service.saveMember(member).catch(() => {});
    this.syncPostToGoogle('saveMember', { member });
    return updated;
  },

  deleteMember(id: string): MemberAccount[] {
    const updated = this.getMembers().filter(m => m.id !== id);
    setLocal(KEYS.MEMBERS, updated);
    D1Service.deleteMember(id).catch(() => {});
    this.syncPostToGoogle('deleteMember', { id });
    return updated;
  },

  // Students
  getStudents(): Student[] {
    const list = getLocal<Student[]>(KEYS.STUDENTS, INITIAL_STUDENTS);
    return list.map(s => {
      const initMatch = INITIAL_STUDENTS.find(init => init.id === s.id);
      return {
        ...initMatch,
        ...s,
        nickname: s.nickname || initMatch?.nickname || '',
        chronicDisease: s.chronicDisease || initMatch?.chronicDisease || 'ไม่มี',
        fatherOccupation: s.fatherOccupation || initMatch?.fatherOccupation || '',
        fatherIncome: s.fatherIncome ?? initMatch?.fatherIncome,
        fatherPhone: s.fatherPhone || initMatch?.fatherPhone || '',
        motherOccupation: s.motherOccupation || initMatch?.motherOccupation || '',
        motherIncome: s.motherIncome ?? initMatch?.motherIncome,
        motherPhone: s.motherPhone || initMatch?.motherPhone || '',
        parentsMaritalStatus: s.parentsMaritalStatus || initMatch?.parentsMaritalStatus || 'อยู่ด้วยกัน',
        parentsMaritalStatusOther: s.parentsMaritalStatusOther || initMatch?.parentsMaritalStatusOther || '',
        guardianRelation: s.guardianRelation || initMatch?.guardianRelation || 'บิดา',
        guardianName: s.guardianName || initMatch?.guardianName || s.fatherName || s.motherName || '',
        guardianAge: s.guardianAge ?? initMatch?.guardianAge ?? s.fatherAge ?? s.motherAge,
        guardianOccupation: s.guardianOccupation || initMatch?.guardianOccupation || s.fatherOccupation || s.motherOccupation || s.parentOccupation || '',
        guardianIncome: s.guardianIncome ?? initMatch?.guardianIncome ?? s.fatherIncome ?? s.motherIncome,
        guardianPhone: s.guardianPhone || initMatch?.guardianPhone || s.fatherPhone || s.motherPhone || '',
        guardianAddress: s.guardianAddress || initMatch?.guardianAddress || s.address || '',
        guardianRelationOther: s.guardianRelationOther || initMatch?.guardianRelationOther || '',
        birthOrder: s.birthOrder ?? initMatch?.birthOrder ?? 1,
        totalSiblings: s.totalSiblings ?? initMatch?.totalSiblings ?? 1,
        brothersCount: s.brothersCount ?? initMatch?.brothersCount ?? 0,
        sistersCount: s.sistersCount ?? initMatch?.sistersCount ?? 0,
        hasOlderHalfSiblings: s.hasOlderHalfSiblings ?? initMatch?.hasOlderHalfSiblings ?? false,
        olderHalfSiblingsCount: s.olderHalfSiblingsCount ?? initMatch?.olderHalfSiblingsCount ?? 0,
        hasYoungerHalfSiblings: s.hasYoungerHalfSiblings ?? initMatch?.hasYoungerHalfSiblings ?? false,
        youngerHalfSiblingsCount: s.youngerHalfSiblingsCount ?? initMatch?.youngerHalfSiblingsCount ?? 0,
        hasHalfSiblings: s.hasHalfSiblings ?? initMatch?.hasHalfSiblings ?? false,
        halfSiblingsCount: s.halfSiblingsCount ?? initMatch?.halfSiblingsCount ?? 0,
        studyingSiblingsCount: s.studyingSiblingsCount ?? initMatch?.studyingSiblingsCount ?? 1,
        housingStatus: s.housingStatus || initMatch?.housingStatus || 'บ้านตัวเอง',
        rentAmount: s.rentAmount ?? initMatch?.rentAmount,
        housingStatusOther: s.housingStatusOther || initMatch?.housingStatusOther || '',
        houseType: s.houseType || initMatch?.houseType || 'บ้านชั้นเดียว',
        houseTypeOther: s.houseTypeOther || initMatch?.houseTypeOther || '',
        householdBurden: s.householdBurden || initMatch?.householdBurden || ['ครัวเรือนไม่มีภาระพึ่งพิง'],
        livingWith: s.livingWith || initMatch?.livingWith || 'บิดามารดา',
        livingWithOther: s.livingWithOther || initMatch?.livingWithOther || '',
        travelMethod: s.travelMethod || initMatch?.travelMethod || 'เดินเท้า',
        travelMethodOther: s.travelMethodOther || initMatch?.travelMethodOther || '',
      };
    });
  },

  saveStudent(student: Student): Student[] {
    const list = this.getStudents();
    const idx = list.findIndex(s => s.id === student.id);
    let updated: Student[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = student;
    } else {
      updated = [student, ...list];
    }
    setLocal(KEYS.STUDENTS, updated);
    this.syncPostToGoogle('saveStudent', { student });
    return updated;
  },

  deleteStudent(id: string): Student[] {
    const updated = this.getStudents().filter(s => s.id !== id);
    setLocal(KEYS.STUDENTS, updated);
    this.syncPostToGoogle('deleteStudent', { id });
    return updated;
  },

  // Personnel
  getPersonnel(): Personnel[] {
    return getLocal<Personnel[]>(KEYS.PERSONNEL, INITIAL_PERSONNEL);
  },

  savePersonnel(person: Personnel): Personnel[] {
    const list = this.getPersonnel();
    const idx = list.findIndex(p => p.id === person.id);
    let updated: Personnel[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = person;
    } else {
      updated = [person, ...list];
    }
    setLocal(KEYS.PERSONNEL, updated);
    this.syncPostToGoogle('savePersonnel', { personnel: person });
    return updated;
  },

  deletePersonnel(id: string): Personnel[] {
    const updated = this.getPersonnel().filter(p => p.id !== id);
    setLocal(KEYS.PERSONNEL, updated);
    this.syncPostToGoogle('deletePersonnel', { id });
    return updated;
  },

  // Daily Tracking
  getDailyTracking(): DailyTracking[] {
    return getLocal<DailyTracking[]>(KEYS.DAILY_TRACKING, INITIAL_DAILY_TRACKING);
  },

  saveDailyTracking(record: DailyTracking): DailyTracking[] {
    const list = this.getDailyTracking();
    const idx = list.findIndex(d => d.id === record.id || (d.date === record.date && d.studentId === record.studentId));
    let updated: DailyTracking[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = record;
    } else {
      updated = [record, ...list];
    }
    setLocal(KEYS.DAILY_TRACKING, updated);
    this.syncPostToGoogle('saveDailyTracking', { record });
    return updated;
  },

  // Subjects
  getSubjects(): Subject[] {
    const list = getLocal<Subject[]>(KEYS.SUBJECTS, INITIAL_SUBJECTS);
    let changed = false;

    // 1. Ensure all subjects have an academicYear (default to '2568' if none)
    const normalized: Subject[] = list.map(s => {
      if (!s.academicYear) {
        changed = true;
        return { ...s, academicYear: '2568' };
      }
      return s;
    });

    // 2. Ensure both semester 1 and semester 2 exist for each subject in each academic year
    const existingKeys = new Set(
      normalized.map(s => `${s.academicYear || '2568'}_${s.semester || '1'}_${s.code}_${s.gradeLevel}`)
    );
    const additions: Subject[] = [];

    normalized.forEach(s => {
      const yr = s.academicYear || '2568';
      const sem = s.semester || '1';
      const otherSem: '1' | '2' = sem === '1' ? '2' : '1';
      const otherKey = `${yr}_${otherSem}_${s.code}_${s.gradeLevel}`;

      if (!existingKeys.has(otherKey)) {
        changed = true;
        existingKeys.add(otherKey);
        additions.push({
          ...s,
          id: `${s.id}-sem${otherSem}`,
          semester: otherSem,
          academicYear: yr,
          // Each semester is completely independent: teacher registers per semester
          teacherId: '',
          teacherName: '',
          assignmentItems: s.assignmentItems ? [...s.assignmentItems] : []
        });
      }
    });

    // 3. Ensure academic year 2569 has subjects if 2568 has subjects but 2569 is empty
    const year2569Subs = normalized.filter(s => s.academicYear === '2569');
    if (year2569Subs.length === 0) {
      const year2568Subs = [...normalized, ...additions].filter(s => s.academicYear === '2568');
      if (year2568Subs.length > 0) {
        changed = true;
        year2568Subs.forEach(s => {
          additions.push({
            ...s,
            id: `sub-${s.code}-${s.semester}-2569`,
            academicYear: '2569',
            teacherId: s.teacherId || '',
            teacherName: s.teacherName || '',
            assignmentItems: s.assignmentItems ? [...s.assignmentItems] : []
          });
        });
      }
    }

    if (changed || additions.length > 0) {
      const finalSubs = [...normalized, ...additions];
      setLocal(KEYS.SUBJECTS, finalSubs);
      return finalSubs;
    }

    return normalized;
  },

  saveSubject(subject: Subject): Subject[] {
    const list = this.getSubjects();
    const idx = list.findIndex(s => s.id === subject.id);
    let updated: Subject[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = subject;
    } else {
      updated = [subject, ...list];
    }
    setLocal(KEYS.SUBJECTS, updated);
    this.syncPostToGoogle('saveSubject', { subject });
    return updated;
  },

  deleteSubject(id: string): Subject[] {
    const updated = this.getSubjects().filter(s => s.id !== id);
    setLocal(KEYS.SUBJECTS, updated);
    this.syncPostToGoogle('deleteSubject', { id });
    return updated;
  },

  saveBulkSubjects(newSubs: Subject[]): Subject[] {
    const list = this.getSubjects();
    const map = new Map<string, Subject>();
    list.forEach(s => map.set(s.id, s));
    newSubs.forEach(s => map.set(s.id, s));
    const updated = Array.from(map.values());
    setLocal(KEYS.SUBJECTS, updated);
    return updated;
  },

  // Locked Semesters (Admin can lock semester to prevent members from entering scores in wrong semester)
  getLockedSemesters(): Record<string, boolean> {
    return getLocal<Record<string, boolean>>(KEYS.LOCKED_SEMESTERS, {});
  },

  saveLockedSemesters(locked: Record<string, boolean>): Record<string, boolean> {
    setLocal(KEYS.LOCKED_SEMESTERS, locked);
    return locked;
  },

  isSemesterLocked(academicYear: string, semester: '1' | '2'): boolean {
    const map = this.getLockedSemesters();
    return Boolean(map[`${academicYear}_${semester}`]);
  },

  toggleSemesterLocked(academicYear: string, semester: '1' | '2'): { locked: boolean; allLocked: Record<string, boolean> } {
    const map = { ...this.getLockedSemesters() };
    const key = `${academicYear}_${semester}`;
    const newStatus = !map[key];
    if (newStatus) {
      map[key] = true;
    } else {
      delete map[key];
    }
    this.saveLockedSemesters(map);
    return { locked: newStatus, allLocked: map };
  },

  // Grades
  getGrades(): GradeRecord[] {
    return getLocal<GradeRecord[]>(KEYS.GRADES, INITIAL_GRADES);
  },

  saveGrade(grade: GradeRecord): GradeRecord[] {
    const list = this.getGrades();
    const idx = list.findIndex(g => g.id === grade.id || (g.studentId === grade.studentId && g.subjectId === grade.subjectId && g.semester === grade.semester));
    let updated: GradeRecord[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = grade;
    } else {
      updated = [grade, ...list];
    }
    setLocal(KEYS.GRADES, updated);
    this.syncPostToGoogle('saveGrades', { grades: [grade] });
    return updated;
  },

  saveBulkGrades(grades: GradeRecord[]): GradeRecord[] {
    const current = this.getGrades();
    const map = new Map<string, GradeRecord>();
    current.forEach(g => map.set(`${g.studentId}_${g.subjectId}_${g.semester}`, g));
    grades.forEach(g => map.set(`${g.studentId}_${g.subjectId}_${g.semester}`, g));
    const updated = Array.from(map.values());
    setLocal(KEYS.GRADES, updated);
    this.syncPostToGoogle('saveGrades', { grades });
    return updated;
  },

  // Attendance
  getAttendanceConfig(): AttendanceDayConfig {
    const cfg = getLocal<AttendanceDayConfig>(KEYS.ATTENDANCE_CONFIG, INITIAL_ATTENDANCE_CONFIG);
    if (!cfg.startDate || cfg.startDate === '2026-05-16' || cfg.endDate === '2026-10-10' || cfg.endDate === '2026-10-31') {
      const updated: AttendanceDayConfig = {
        ...cfg,
        startDate: '2026-05-18',
        endDate: '2026-10-07'
      };
      setLocal(KEYS.ATTENDANCE_CONFIG, updated);
      return updated;
    }
    return cfg;
  },

  setAttendanceConfig(config: AttendanceDayConfig): void {
    setLocal(KEYS.ATTENDANCE_CONFIG, config);
  },

  getAttendanceConfigsByTerm(): Record<string, AttendanceDayConfig> {
    const current = getLocal<Record<string, AttendanceDayConfig>>(KEYS.ATTENDANCE_CONFIGS_BY_TERM, {});
    // Seed 1_2569 if not yet present and not explicitly cleared
    const isCleared = localStorage.getItem('ams_cleared_1_2569');
    if (!current['1_2569'] && !isCleared) {
      const base = this.getAttendanceConfig();
      current['1_2569'] = base;
      setLocal(KEYS.ATTENDANCE_CONFIGS_BY_TERM, current);
    }
    return current;
  },

  setAttendanceConfigForTerm(config: AttendanceDayConfig): Record<string, AttendanceDayConfig> {
    const termKey = `${config.semester}_${config.academicYear}`;
    const all = this.getAttendanceConfigsByTerm();
    all[termKey] = config;
    localStorage.removeItem(`ams_cleared_${termKey}`);
    setLocal(KEYS.ATTENDANCE_CONFIGS_BY_TERM, all);
    setLocal(KEYS.ATTENDANCE_CONFIG, config);
    return all;
  },

  deleteAttendanceConfigForTerm(termKey: string): Record<string, AttendanceDayConfig> {
    const all = this.getAttendanceConfigsByTerm();
    if (all[termKey]) {
      all[termKey] = {
        ...all[termKey],
        startDate: '',
        endDate: '',
        targetDays: 0,
        schoolDays: []
      };
    } else {
      const parts = termKey.split('_');
      all[termKey] = {
        semester: (parts[0] || '1') as any,
        academicYear: parts[1] || '2569',
        startDate: '',
        endDate: '',
        targetDays: 0,
        schoolDays: []
      };
    }
    localStorage.setItem(`ams_cleared_${termKey}`, 'true');
    setLocal(KEYS.ATTENDANCE_CONFIGS_BY_TERM, all);
    return all;
  },

  deleteAllAttendanceConfigs(): Record<string, AttendanceDayConfig> {
    const all = this.getAttendanceConfigsByTerm();
    Object.keys(all).forEach(k => {
      all[k] = {
        ...all[k],
        startDate: '',
        endDate: '',
        targetDays: 0,
        schoolDays: []
      };
      localStorage.setItem(`ams_cleared_${k}`, 'true');
    });
    setLocal(KEYS.ATTENDANCE_CONFIGS_BY_TERM, all);
    return all;
  },

  getAttendance(): AttendanceRecord[] {
    if (!localStorage.getItem('ams_attendance_reset_clean_v6')) {
      localStorage.setItem('ams_attendance_reset_clean_v6', 'true');
      setLocal(KEYS.ATTENDANCE, []);
      return [];
    }
    return getLocal<AttendanceRecord[]>(KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
  },

  saveBulkAttendance(records: AttendanceRecord[]): AttendanceRecord[] {
    const current = this.getAttendance();
    const map = new Map<string, AttendanceRecord>();
    current.forEach(r => map.set(`${r.date}_${r.studentId}`, r));
    records.forEach(r => map.set(`${r.date}_${r.studentId}`, r));
    const updated = Array.from(map.values());
    setLocal(KEYS.ATTENDANCE, updated);
    this.syncPostToGoogle('saveAttendance', { records });
    return updated;
  },

  // Savings
  getSavings(): SavingsRecord[] {
    if (!localStorage.getItem('ams_savings_reset_clean_v7')) {
      localStorage.setItem('ams_savings_reset_clean_v7', 'true');
      setLocal(KEYS.SAVINGS, []);
      return [];
    }
    return getLocal<SavingsRecord[]>(KEYS.SAVINGS, INITIAL_SAVINGS);
  },

  calculateStudentBalance(studentId: string, semester?: '1' | '2', academicYear?: string): number {
    const list = this.getSavings().filter(s => {
      if (s.studentId !== studentId) return false;
      if (semester && s.semester && s.semester !== semester) return false;
      if (academicYear && s.academicYear && s.academicYear !== academicYear) return false;
      return true;
    });
    const deposits = list.filter(s => s.type === 'deposit').reduce((sum, r) => sum + r.amount, 0);
    const withdrawals = list.filter(s => s.type === 'withdrawal').reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, deposits - withdrawals);
  },

  saveSavingsRecord(record: Omit<SavingsRecord, 'balanceAfter'>): { record: SavingsRecord; updated: SavingsRecord[] } {
    const list = this.getSavings();
    const recordId = (record as any).id || ('sav-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));

    const existingIdx = list.findIndex(s => s.id === recordId);
    let interimList: SavingsRecord[];
    if (existingIdx >= 0) {
      interimList = [...list];
      interimList[existingIdx] = { ...record, id: recordId, balanceAfter: 0 };
    } else {
      interimList = [{ ...record, id: recordId, balanceAfter: 0 }, ...list];
    }

    // Recalculate true balance for this student in this term
    let runningBal = 0;
    const studentRecords = interimList
      .filter(s => s.studentId === record.studentId &&
        (!record.semester || !s.semester || s.semester === record.semester) &&
        (!record.academicYear || !s.academicYear || s.academicYear === record.academicYear)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    studentRecords.forEach(r => {
      if (r.type === 'deposit') runningBal += r.amount;
      else runningBal -= r.amount;
    });
    const finalBal = Math.max(0, runningBal);

    const fullRecord: SavingsRecord = {
      ...record,
      id: recordId,
      balanceAfter: finalBal
    };

    const updated = interimList.map(s => s.id === recordId ? fullRecord : s);
    setLocal(KEYS.SAVINGS, updated);
    this.syncPostToGoogle('saveSavings', { record: fullRecord });
    return { record: fullRecord, updated };
  },

  deleteSavingsRecord(id: string): SavingsRecord[] {
    const list = this.getSavings();
    const updated = list.filter(s => s.id !== id);
    setLocal(KEYS.SAVINGS, updated);
    this.syncPostToGoogle('deleteSavings', { id });
    return updated;
  },

  setAllSavings(records: SavingsRecord[]): SavingsRecord[] {
    setLocal(KEYS.SAVINGS, records);
    this.syncPostToGoogle('setAllSavings', { records });
    return records;
  },

  // Tasks
  getTasks(): TaskItem[] {
    return getLocal<TaskItem[]>(KEYS.TASKS, INITIAL_TASKS);
  },

  saveTask(task: TaskItem): TaskItem[] {
    const list = this.getTasks();
    const idx = list.findIndex(t => t.id === task.id);
    let updated: TaskItem[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = task;
    } else {
      updated = [task, ...list];
    }
    setLocal(KEYS.TASKS, updated);
    this.syncPostToGoogle('saveTask', { task });
    return updated;
  },

  // Immediately remove or mark completed task
  completeTask(id: string): TaskItem[] {
    const list = this.getTasks();
    // Prompt states: "Tasks disappear immediately once completed/submitted."
    const updated = list.filter(t => t.id !== id);
    setLocal(KEYS.TASKS, updated);
    this.syncPostToGoogle('completeTask', { id });
    return updated;
  },

  deleteTask(id: string): TaskItem[] {
    const updated = this.getTasks().filter(t => t.id !== id);
    setLocal(KEYS.TASKS, updated);
    this.syncPostToGoogle('deleteTask', { id });
    return updated;
  },

  reorderTasks(tasks: TaskItem[]): TaskItem[] {
    setLocal(KEYS.TASKS, tasks);
    this.syncPostToGoogle('saveAllTasks', { tasks });
    return tasks;
  },

  // Documents
  getDocuments(): DocumentItem[] {
    return getLocal<DocumentItem[]>(KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
  },

  saveDocument(doc: DocumentItem): DocumentItem[] {
    const list = this.getDocuments();
    const idx = list.findIndex(d => d.id === doc.id);
    let updated: DocumentItem[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = doc;
    } else {
      updated = [doc, ...list];
    }
    setLocal(KEYS.DOCUMENTS, updated);
    this.syncPostToGoogle('uploadDocument', doc);
    return updated;
  },

  deleteDocument(id: string): DocumentItem[] {
    const updated = this.getDocuments().filter(d => d.id !== id);
    setLocal(KEYS.DOCUMENTS, updated);
    this.syncPostToGoogle('deleteDocument', { id });
    return updated;
  },

  reorderDocuments(docs: DocumentItem[]): DocumentItem[] {
    setLocal(KEYS.DOCUMENTS, docs);
    this.syncPostToGoogle('saveAllDocuments', { documents: docs });
    return docs;
  },

  // Websites
  getWebsites(): RecommendedWebsite[] {
    return getLocal<RecommendedWebsite[]>(KEYS.WEBSITES, INITIAL_WEBSITES);
  },

  saveWebsite(site: RecommendedWebsite): RecommendedWebsite[] {
    const list = this.getWebsites();
    const idx = list.findIndex(w => w.id === site.id);
    let updated: RecommendedWebsite[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = site;
    } else {
      updated = [site, ...list];
    }
    setLocal(KEYS.WEBSITES, updated);
    this.syncPostToGoogle('saveWebsite', { website: site });
    return updated;
  },

  deleteWebsite(id: string): RecommendedWebsite[] {
    const updated = this.getWebsites().filter(w => w.id !== id);
    setLocal(KEYS.WEBSITES, updated);
    this.syncPostToGoogle('deleteWebsite', { id });
    return updated;
  },

  reorderWebsites(newWebsites: RecommendedWebsite[]): RecommendedWebsite[] {
    setLocal(KEYS.WEBSITES, newWebsites);
    this.syncPostToGoogle('saveAllWebsites', { websites: newWebsites });
    return newWebsites;
  },

  // Calendar
  getCalendarEvents(): CalendarEvent[] {
    return getLocal<CalendarEvent[]>(KEYS.CALENDAR, INITIAL_CALENDAR_EVENTS);
  },

  saveCalendarEvent(event: CalendarEvent): CalendarEvent[] {
    const list = this.getCalendarEvents();
    const idx = list.findIndex(c => c.id === event.id);
    let updated: CalendarEvent[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = event;
    } else {
      updated = [event, ...list];
    }
    setLocal(KEYS.CALENDAR, updated);
    this.syncPostToGoogle('saveCalendarEvent', { event });
    return updated;
  },

  deleteCalendarEvent(id: string): CalendarEvent[] {
    const updated = this.getCalendarEvents().filter(c => c.id !== id);
    setLocal(KEYS.CALENDAR, updated);
    this.syncPostToGoogle('deleteCalendarEvent', { id });
    return updated;
  },

  // Academic Years Management (Developer feature: can delete academic year and wipe its data)
  getAcademicYears(): string[] {
    const list = getLocal<string[]>(KEYS.ACADEMIC_YEARS, ['2568', '2569']);
    const schoolInfo = this.getSchoolInfo();
    if (schoolInfo.academicYear && !list.includes(schoolInfo.academicYear)) {
      list.push(schoolInfo.academicYear);
    }
    const subs = this.getSubjects();
    subs.forEach(s => {
      if (s.academicYear && !list.includes(s.academicYear)) {
        list.push(s.academicYear);
      }
    });
    list.sort((a, b) => Number(a) - Number(b));
    return list;
  },

  saveAcademicYears(years: string[]): string[] {
    setLocal(KEYS.ACADEMIC_YEARS, years);
    return years;
  },

  addAcademicYear(year: string): string[] {
    const years = this.getAcademicYears();
    if (!years.includes(year)) {
      const updated = [...years, year].sort((a, b) => Number(a) - Number(b));
      setLocal(KEYS.ACADEMIC_YEARS, updated);
      D1Service.saveYear(year).catch(() => {});
      return updated;
    }
    return years;
  },

  deleteAcademicYear(year: string): {
    years: string[];
    subjects: Subject[];
    deletedGrades: number;
    deletedAttendance: number;
    deletedDailyTracking: number;
    deletedSavings: number;
    deletedSubjects: number;
  } {
    D1Service.deleteYear(year).catch(() => {});
    // 1. Remove year from list
    const currentYears = this.getAcademicYears();
    const updatedYears = currentYears.filter(y => y !== year);
    setLocal(KEYS.ACADEMIC_YEARS, updatedYears.length > 0 ? updatedYears : ['2568']);

    // If current school year was this year, fall back to another available year
    const schoolInfo = this.getSchoolInfo();
    if (schoolInfo.academicYear === year) {
      schoolInfo.academicYear = updatedYears[0] || '2568';
      this.setSchoolInfo(schoolInfo);
    }

    // 2. Wipe grades stored in that academic year
    const grades = this.getGrades();
    const remainingGrades = grades.filter(g => g.academicYear !== year);
    const deletedGrades = grades.length - remainingGrades.length;
    setLocal(KEYS.GRADES, remainingGrades);

    // 3. Wipe attendance stored in that academic year
    const attendance = this.getAttendance();
    const remainingAttendance = attendance.filter(a => a.academicYear !== year);
    const deletedAttendance = attendance.length - remainingAttendance.length;
    setLocal(KEYS.ATTENDANCE, remainingAttendance);

    // 4. Wipe savings stored in that academic year
    const savings = this.getSavings();
    const remainingSavings = savings.filter(s => s.academicYear !== year);
    const deletedSavings = savings.length - remainingSavings.length;
    setLocal(KEYS.SAVINGS, remainingSavings);

    // 5. Wipe subjects stored in that academic year
    const subjects = this.getSubjects();
    const remainingSubjects = subjects.filter(s => s.academicYear !== year);
    const deletedSubjects = subjects.length - remainingSubjects.length;
    setLocal(KEYS.SUBJECTS, remainingSubjects);

    // 6. Wipe daily tracking for that year
    const dailyTracking = this.getDailyTracking();
    const remainingDaily = dailyTracking.filter(d => {
      const dateYear = d.date ? d.date.split('-')[0] : '';
      const bYear = String(Number(dateYear) + 543);
      return bYear !== year && dateYear !== year;
    });
    const deletedDailyTracking = dailyTracking.length - remainingDaily.length;
    setLocal(KEYS.DAILY_TRACKING, remainingDaily);

    return {
      years: updatedYears,
      subjects: remainingSubjects,
      deletedGrades,
      deletedAttendance,
      deletedDailyTracking,
      deletedSavings,
      deletedSubjects
    };
  },

  // Comment Sessions & Behavior Evaluations
  getCommentSessions(): CommentSession[] {
    const defaultSessions: CommentSession[] = [
      {
        id: 'cs-term1',
        title: 'การประเมินผลและพัฒนาการ (ภาคเรียนที่ 1)',
        date: '2026-09-25',
        academicYear: '2569',
        semester: '1',
        createdAt: '2026-05-18T08:00:00.000Z'
      },
      {
        id: 'cs-term2',
        title: 'การประเมินผลและพัฒนาการ (ภาคเรียนที่ 2)',
        date: '2027-02-28',
        academicYear: '2569',
        semester: '2',
        createdAt: '2026-11-01T08:00:00.000Z'
      }
    ];
    return getLocal<CommentSession[]>(KEYS.COMMENT_SESSIONS, defaultSessions);
  },

  saveCommentSession(session: CommentSession): CommentSession[] {
    const list = this.getCommentSessions();
    const idx = list.findIndex(s => s.id === session.id);
    let updated: CommentSession[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = session;
    } else {
      updated = [session, ...list];
    }
    setLocal(KEYS.COMMENT_SESSIONS, updated);
    return updated;
  },

  deleteCommentSession(id: string): CommentSession[] {
    const list = this.getCommentSessions().filter(s => s.id !== id);
    setLocal(KEYS.COMMENT_SESSIONS, list);
    return list;
  },

  getBehaviorEvaluations(): Record<string, StudentBehaviorEvaluation> {
    return getLocal<Record<string, StudentBehaviorEvaluation>>(KEYS.BEHAVIOR_EVALUATIONS, {});
  },

  saveBehaviorEvaluation(evalData: StudentBehaviorEvaluation): Record<string, StudentBehaviorEvaluation> {
    const all = this.getBehaviorEvaluations();
    const key = `${evalData.studentId}_${evalData.sessionId || 'default'}`;
    all[key] = {
      ...evalData,
      updatedAt: new Date().toISOString()
    };
    setLocal(KEYS.BEHAVIOR_EVALUATIONS, all);
    return all;
  },

  saveBulkBehaviorEvaluations(evalList: StudentBehaviorEvaluation[]): Record<string, StudentBehaviorEvaluation> {
    const all = this.getBehaviorEvaluations();
    evalList.forEach(e => {
      const key = `${e.studentId}_${e.sessionId || 'default'}`;
      all[key] = {
        ...e,
        updatedAt: new Date().toISOString()
      };
    });
    setLocal(KEYS.BEHAVIOR_EVALUATIONS, all);
    return all;
  },

  // Reset to initial demo data
  resetAllData(): void {
    localStorage.clear();
    setLocal(KEYS.ADMINS, INITIAL_ADMINS);
    setLocal(KEYS.SCHOOL_INFO, INITIAL_SCHOOL_INFO);
    setLocal(KEYS.MEMBERS, INITIAL_MEMBERS);
    setLocal(KEYS.STUDENTS, INITIAL_STUDENTS);
    setLocal(KEYS.PERSONNEL, INITIAL_PERSONNEL);
    setLocal(KEYS.DAILY_TRACKING, INITIAL_DAILY_TRACKING);
    setLocal(KEYS.SUBJECTS, INITIAL_SUBJECTS);
    setLocal(KEYS.GRADES, INITIAL_GRADES);
    setLocal(KEYS.ATTENDANCE_CONFIG, INITIAL_ATTENDANCE_CONFIG);
    setLocal(KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
    setLocal(KEYS.SAVINGS, INITIAL_SAVINGS);
    setLocal(KEYS.TASKS, INITIAL_TASKS);
    setLocal(KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    setLocal(KEYS.WEBSITES, INITIAL_WEBSITES);
    setLocal(KEYS.CALENDAR, INITIAL_CALENDAR_EVENTS);
    setLocal(KEYS.ACADEMIC_YEARS, ['2568', '2569']);
  },

  // Helper: Retrieve active school Google Sheet ID
  getCurrentSchoolSpreadsheetId(): string | undefined {
    const session = this.getSession();
    if (session && session.schoolId) {
      const admin = this.getAdmins().find(a => a.id === session.schoolId);
      if (admin && admin.googleSheetId) return admin.googleSheetId;
    }
    const schoolInfo = this.getSchoolInfo();
    return schoolInfo.googleSheetId;
  },

  // Automated Google Sheet creation per School Admin
  async createSchoolGoogleSheet(schoolName: string, schoolCode?: string, adminId?: string): Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; message: string }> {
    const config = this.getGoogleConfig();
    if (!config.webAppUrl) {
      return { success: false, message: 'กรุณาตั้งค่า Google Apps Script Web App URL ในหน้า Developer ก่อนสร้าง Google Sheet อัตโนมัติ' };
    }

    try {
      const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createSchoolSheet',
          schoolName,
          schoolCode: schoolCode || '',
          adminId: adminId || '',
          folderId: config.driveFolderId || ''
        })
      });
      const data = await response.json();
      if (data && data.status === 'success') {
        return {
          success: true,
          spreadsheetId: data.spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl,
          message: data.message || `สร้าง Google Sheet ประจำโรงเรียน ${schoolName} เรียบร้อยแล้ว`
        };
      }
      return { success: false, message: data.message || 'ไม่สามารถสร้าง Google Sheet ได้' };
    } catch (err: any) {
      return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Apps Script: ' + err.message };
    }
  },

  // Background Google Apps Script sync with Per-School Spreadsheet Routing
  async syncPostToGoogle(action: string, payload: Record<string, any>): Promise<any> {
    const config = this.getGoogleConfig();
    if (!config.webAppUrl || !config.isConnected) {
      return null;
    }

    const spreadsheetId = payload.spreadsheetId || this.getCurrentSchoolSpreadsheetId();

    try {
      const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids preflight issues in Google Apps Script
        body: JSON.stringify({ action, driveFolderId: config.driveFolderId, spreadsheetId, ...payload })
      });
      return await response.json();
    } catch (err) {
      console.warn('Google Apps Script background sync failed (offline or pending):', err);
      return null;
    }
  },

  async testGoogleConnection(url: string, driveFolderId?: string): Promise<{ success: boolean; message: string }> {
    if (!url) return { success: false, message: 'กรุณากรอก Web App URL ของ Google Apps Script' };
    try {
      const pingUrl = url.includes('?') ? `${url}&action=ping` : `${url}?action=ping`;
      const res = await fetch(pingUrl, { method: 'GET' });
      const data = await res.json();
      if (data && data.status === 'success') {
        const current = this.getGoogleConfig();
        this.setGoogleConfig({
          webAppUrl: url,
          driveFolderId: driveFolderId || current.driveFolderId || '',
          isConnected: true,
          lastSynced: new Date().toISOString()
        });
        return { success: true, message: 'เชื่อมต่อ Google Apps Script สำเร็จแล้ว!' };
      }
      return { success: false, message: 'ตอบกลับแต่สถานะไม่ใช่ success: ' + JSON.stringify(data) };
    } catch (err: any) {
      return { success: false, message: 'ไม่สามารถเชื่อมต่อได้: ' + (err.message || String(err)) };
    }
  },

  async syncAllToGoogle(): Promise<{ success: boolean; message: string }> {
    const config = this.getGoogleConfig();
    if (!config.webAppUrl) {
      return { success: false, message: 'ยังไม่ได้ตั้งค่า Google Apps Script Web App URL' };
    }

    const allData = {
      schoolInfo: this.getSchoolInfo(),
      students: this.getStudents(),
      personnel: this.getPersonnel(),
      dailyTracking: this.getDailyTracking(),
      subjects: this.getSubjects(),
      grades: this.getGrades(),
      attendance: this.getAttendance(),
      savings: this.getSavings(),
      tasks: this.getTasks(),
      documents: this.getDocuments(),
      websites: this.getWebsites(),
      calendar: this.getCalendarEvents(),
      members: this.getMembers()
    };

    try {
      const response = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'syncAll', driveFolderId: config.driveFolderId, data: allData })
      });
      const resJson = await response.json();
      if (resJson.status === 'success') {
        this.setGoogleConfig({
          ...config,
          isConnected: true,
          lastSynced: new Date().toISOString()
        });
        return { success: true, message: 'ซิงค์ข้อมูลทั้งหมดลง Google Sheets สำเร็จเรียบร้อยแล้ว' };
      }
      return { success: false, message: resJson.message || 'ซิงค์ไม่สำเร็จ' };
    } catch (err: any) {
      return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message };
    }
  }
};
