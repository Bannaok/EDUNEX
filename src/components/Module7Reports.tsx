import React, { useState, useMemo } from 'react';
import { 
  Student, 
  Personnel, 
  SchoolInfo, 
  Subject, 
  GradeRecord, 
  AttendanceRecord, 
  SavingsRecord, 
  GradeLevel,
  UserSession,
  SchoolDayItem,
  DailyTracking
} from '../types';
import { 
  ArrowLeft,
  ChevronRight,
  Search,
  Printer,
  Eye,
  X,
  ClipboardCheck,
  UserCheck,
  Users,
  Download,
  CalendarCheck,
  Building2,
  FileText,
  CheckCircle2,
  Award,
  BookOpen
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { ThreeReportsModal } from './ThreeReportsModal';
import { get100SchoolDaysForTerm } from './Module1ClassroomAdmin';
import { PhorPhor6Modal, calculateThaiGrade } from './PhorPhor6Modal';

interface Module7Props {
  user: UserSession;
  students: Student[];
  personnel: Personnel[];
  schoolInfo: SchoolInfo;
  subjects: Subject[];
  grades: GradeRecord[];
  attendance: AttendanceRecord[];
  savings: SavingsRecord[];
  dailyTracking?: DailyTracking[];
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg: string) => void;
  onOpenLightbox?: (imageUrl: string, title: string, subtitle?: string) => void;
}

const PRIMARY_GRADES: GradeLevel[] = [
  'อ.1', 'อ.2', 'อ.3',
  'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'
];

const SECONDARY_GRADES: GradeLevel[] = [
  'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'
];

const THAI_MONTH_NAMES: Record<number, string> = {
  1: 'มกราคม',
  2: 'กุมภาพันธ์',
  3: 'มีนาคม',
  4: 'เมษายน',
  5: 'พฤษภาคม',
  6: 'มิถุนายน',
  7: 'กรกฎาคม',
  8: 'สิงหาคม',
  9: 'กันยายน',
  10: 'ตุลาคม',
  11: 'พฤศจิกายน',
  12: 'ธันวาคม'
};

const THAI_DAY_SHORT: Record<number, string> = {
  0: 'อา.',
  1: 'จ.',
  2: 'อ.',
  3: 'พ.',
  4: 'พฤ.',
  5: 'ศ.',
  6: 'ส.'
};

const THAI_DAY_FULL: Record<number, string> = {
  0: 'อาทิตย์',
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  6: 'เสาร์'
};

const getGradeFullName = (g: GradeLevel): string => {
  switch (g) {
    case 'อ.1': return 'ชั้นอนุบาลปีที่ 1 (อ.1)';
    case 'อ.2': return 'ชั้นอนุบาลปีที่ 2 (อ.2)';
    case 'อ.3': return 'ชั้นอนุบาลปีที่ 3 (อ.3)';
    case 'ป.1': return 'ชั้นประถมศึกษาปีที่ 1 (ป.1)';
    case 'ป.2': return 'ชั้นประถมศึกษาปีที่ 2 (ป.2)';
    case 'ป.3': return 'ชั้นประถมศึกษาปีที่ 3 (ป.3)';
    case 'ป.4': return 'ชั้นประถมศึกษาปีที่ 4 (ป.4)';
    case 'ป.5': return 'ชั้นประถมศึกษาปีที่ 5 (ป.5)';
    case 'ป.6': return 'ชั้นประถมศึกษาปีที่ 6 (ป.6)';
    case 'ม.1': return 'ชั้นมัธยมศึกษาปีที่ 1 (ม.1)';
    case 'ม.2': return 'ชั้นมัธยมศึกษาปีที่ 2 (ม.2)';
    case 'ม.3': return 'ชั้นมัธยมศึกษาปีที่ 3 (ม.3)';
    case 'ม.4': return 'ชั้นมัธยมศึกษาปีที่ 4 (ม.4)';
    case 'ม.5': return 'ชั้นมัธยมศึกษาปีที่ 5 (ม.5)';
    case 'ม.6': return 'ชั้นมัธยมศึกษาปีที่ 6 (ม.6)';
    default: return `ชั้น ${g}`;
  }
};

const getGradeCleanName = (g: GradeLevel | null): string => {
  if (!g) return '';
  switch (g) {
    case 'อ.1': return 'ชั้นอนุบาลปีที่ 1';
    case 'อ.2': return 'ชั้นอนุบาลปีที่ 2';
    case 'อ.3': return 'ชั้นอนุบาลปีที่ 3';
    case 'ป.1': return 'ชั้นประถมศึกษาปีที่ 1';
    case 'ป.2': return 'ชั้นประถมศึกษาปีที่ 2';
    case 'ป.3': return 'ชั้นประถมศึกษาปีที่ 3';
    case 'ป.4': return 'ชั้นประถมศึกษาปีที่ 4';
    case 'ป.5': return 'ชั้นประถมศึกษาปีที่ 5';
    case 'ป.6': return 'ชั้นประถมศึกษาปีที่ 6';
    case 'ม.1': return 'ชั้นมัธยมศึกษาปีที่ 1';
    case 'ม.2': return 'ชั้นมัธยมศึกษาปีที่ 2';
    case 'ม.3': return 'ชั้นมัธยมศึกษาปีที่ 3';
    case 'ม.4': return 'ชั้นมัธยมศึกษาปีที่ 4';
    case 'ม.5': return 'ชั้นมัธยมศึกษาปีที่ 5';
    case 'ม.6': return 'ชั้นมัธยมศึกษาปีที่ 6';
    default: return `ชั้น ${g}`;
  }
};

// Helper: Convert academic year string (e.g. 2569) to AD year number (e.g. 2026)
const getAdYear = (yearStr: string): number => {
  const num = parseInt((yearStr || '').trim(), 10);
  if (isNaN(num)) return 2026;
  return num > 2400 ? num - 543 : num;
};

export interface FullMonthDayItem {
  date: string;          // "YYYY-MM-DD"
  dayNum: number;        // 1..31
  dayOfWeekNum: number;  // 0..6 (0=Sun, 6=Sat)
  dayOfWeekName: string; // "อาทิตย์", "จันทร์", ...
  shortDayName: string;  // "อา.", "จ.", ...
  isSaturday: boolean;
  isSunday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;    // true if weekend OR custom holiday
  holidayLabel: 'วันเสาร์' | 'วันอาทิตย์' | 'วันหยุด' | null;
  note?: string;
}

export interface FullMonthGroup {
  monthKey: string;      // "YYYY-MM"
  monthNum: number;      // 1..12
  yearCE: number;
  yearBE: number;
  monthName: string;
  days: FullMonthDayItem[];
  schoolDaysCount: number; // Count of non-holiday school days
}

export const Module7Reports: React.FC<Module7Props> = ({
  user,
  students,
  personnel,
  schoolInfo,
  subjects = [],
  grades = [],
  attendance,
  savings = [],
  dailyTracking: propsDailyTracking = [],
  onShowToast,
  onOpenLightbox
}) => {
  const [selectedYear, setSelectedYear] = useState<string>(schoolInfo.academicYear || '2569');
  const [selectedSemester, setSelectedSemester] = useState<string>(schoolInfo.semester || '1');
  const [activeLevel, setActiveLevel] = useState<'primary' | 'secondary'>('primary');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [selectedPhorPhor6Student, setSelectedPhorPhor6Student] = useState<Student | null>(null);
  const [assessmentViewMode, setAssessmentViewMode] = useState<'score' | 'grade'>('score');

  // Synchronize live grades & subjects & dailyTracking from storage or props
  const effectiveGrades = useMemo(() => {
    const localGrades = StorageService.getGrades();
    return (localGrades && localGrades.length > 0) ? localGrades : grades;
  }, [grades]);

  const effectiveSubjects = useMemo(() => {
    const localSubjects = StorageService.getSubjects();
    return (localSubjects && localSubjects.length > 0) ? localSubjects : subjects;
  }, [subjects]);

  const effectiveDailyTracking = useMemo(() => {
    if (propsDailyTracking && propsDailyTracking.length > 0) return propsDailyTracking;
    return StorageService.getDailyTracking();
  }, [propsDailyTracking]);

  // Attendance Pop-up Modal state
  const [attendancePopupGrade, setAttendancePopupGrade] = useState<GradeLevel | null>(null);
  const [popupSelectedMonthKey, setPopupSelectedMonthKey] = useState<string | 'all'>('all');

  // Assessment (วัดผล) Pop-up Modal state
  const [assessmentPopupGrade, setAssessmentPopupGrade] = useState<GradeLevel | null>(null);
  const [assessmentSelectedChunkIndex, setAssessmentSelectedChunkIndex] = useState<number | 'all'>('all');

  // (3)รายงาน Pop-up Modal state (การอ่านคิดวิเคราะห์เขียน, คุณลักษณะอันพึงประสงค์, สมรรถนะสำคัญ)
  const [threeReportsPopupGrade, setThreeReportsPopupGrade] = useState<GradeLevel | null>(null);

  // Milk & Toothbrushing Report Pop-up Modal state (ดื่มนม / แปรงฟัน - ดึงจากหน้าธุรการ)
  const [milkTeethModal, setMilkTeethModal] = useState<{ grade: GradeLevel; type: 'milk' | 'teeth' } | null>(null);
  const [milkTeethSelectedMonthIdx, setMilkTeethSelectedMonthIdx] = useState<number>(0);

  // Selected personnel for popup signatures (shared across attendance, assessment, 3-reports, and milk/teeth modals)
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>('');
  const [selectedAcademicHeadId, setSelectedAcademicHeadId] = useState<string>('');

  // Auto-detect personnel when popup grade changes
  React.useEffect(() => {
    const targetGrade = attendancePopupGrade || assessmentPopupGrade || threeReportsPopupGrade || milkTeethModal?.grade;
    if (targetGrade) {
      // 1. Homeroom Teacher
      const advisor = personnel.find(p => p.advisorGrade === targetGrade);
      setSelectedAdvisorId(advisor ? advisor.id : '');

      // 2. Academic Head
      const academic = personnel.find(p => 
        p.department === 'วิชาการ' || 
        (p.position && p.position.includes('วิชาการ')) ||
        (p.personnelType && p.personnelType.includes('วิชาการ'))
      );
      setSelectedAcademicHeadId(academic ? academic.id : '');
    }
  }, [attendancePopupGrade, assessmentPopupGrade, threeReportsPopupGrade, milkTeethModal, personnel]);

  // 100 School Days for Milk & Teeth (matching Module 1)
  const milkTeethSchoolDaysList = useMemo(() => {
    return get100SchoolDaysForTerm(selectedYear, selectedSemester);
  }, [selectedYear, selectedSemester]);

  const milkTeethMonthGroups = useMemo(() => {
    const thaiFullMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const shortThaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const groups: { [key: string]: { monthKey: string; monthTitle: string; shortMonthLabel: string; days: { date: string; dayNumber: number; label: string }[] } } = {};
    
    milkTeethSchoolDaysList.forEach(dayItem => {
      const [yyyy, mm] = dayItem.date.split('-');
      const mIdx = parseInt(mm, 10) - 1;
      const monthTitle = `เดือน${thaiFullMonths[mIdx] || ''}`;
      const shortMonthLabel = shortThaiMonths[mIdx] || '';
      const monthKey = `${yyyy}-${mm}`;
      
      if (!groups[monthKey]) {
        groups[monthKey] = { monthKey, monthTitle, shortMonthLabel, days: [] };
      }
      groups[monthKey].days.push(dayItem);
    });
    
    return Object.values(groups);
  }, [milkTeethSchoolDaysList]);

  // Signature Personnel Resolution
  const selectedAdvisor = useMemo(() => {
    if (selectedAdvisorId) {
      return personnel.find(p => p.id === selectedAdvisorId) || null;
    }
    return attendancePopupGrade ? personnel.find(p => p.advisorGrade === attendancePopupGrade) || null : null;
  }, [personnel, selectedAdvisorId, attendancePopupGrade]);

  const selectedAcademicHead = useMemo(() => {
    if (selectedAcademicHeadId) {
      return personnel.find(p => p.id === selectedAcademicHeadId) || null;
    }
    return personnel.find(p => 
      p.department === 'วิชาการ' || 
      (p.position && p.position.includes('วิชาการ')) ||
      (p.personnelType && p.personnelType.includes('วิชาการ'))
    ) || null;
  }, [personnel, selectedAcademicHeadId]);

  const directorPersonnel = useMemo(() => {
    return personnel.find(p => 
      (p.position && (p.position.includes('ผู้อำนวยการ') || p.position.includes('ผอ.'))) ||
      (p.personnelType && p.personnelType.includes('ผู้อำนวยการ'))
    ) || null;
  }, [personnel]);

  const directorDisplayName = useMemo(() => {
    if (directorPersonnel) {
      return `${directorPersonnel.prefix || ''}${directorPersonnel.firstName || ''} ${directorPersonnel.lastName || ''}`.trim();
    }
    return schoolInfo.directorName || '................................................';
  }, [directorPersonnel, schoolInfo.directorName]);

  // Helper to extract unique subject teacher names for a 5-subject chunk
  const getSubjectTeacherName = (chunk: Subject[], personnelList: Personnel[], defaultAdvisor: Personnel | null): string => {
    const teacherNamesSet = new Set<string>();

    chunk.forEach(subj => {
      if (subj.teacherId) {
        const p = personnelList.find(item => item.id === subj.teacherId);
        if (p) {
          teacherNamesSet.add(`${p.prefix || ''}${p.firstName || ''} ${p.lastName || ''}`.trim());
        }
      }
      if (subj.teacherName && subj.teacherName.trim()) {
        const trimmed = subj.teacherName.trim();
        const matched = personnelList.find(p => `${p.firstName} ${p.lastName}` === trimmed || `${p.prefix}${p.firstName} ${p.lastName}` === trimmed);
        if (matched) {
          teacherNamesSet.add(`${matched.prefix || ''}${matched.firstName || ''} ${matched.lastName || ''}`.trim());
        } else {
          teacherNamesSet.add(trimmed);
        }
      }
    });

    const names = Array.from(teacherNamesSet).filter(Boolean);
    if (names.length > 0) {
      return names.join(', ');
    }

    if (defaultAdvisor) {
      return `${defaultAdvisor.prefix || ''}${defaultAdvisor.firstName || ''} ${defaultAdvisor.lastName || ''}`.trim();
    }

    return '................................................';
  };

  const currentGradeList = activeLevel === 'primary' ? PRIMARY_GRADES : SECONDARY_GRADES;

  // Filter students for selected grade in main roster view
  const gradeStudents = useMemo(() => {
    return selectedGrade 
      ? students.filter(s => s.gradeLevel === selectedGrade)
      : [];
  }, [students, selectedGrade]);

  // Advisor teacher assigned to selected grade
  const classAdvisor = useMemo(() => {
    if (!selectedGrade) return null;
    return personnel.find(p => p.advisorGrade === selectedGrade) || null;
  }, [personnel, selectedGrade]);

  // Filter students for popup grade
  const popupGradeStudents = useMemo(() => {
    return attendancePopupGrade
      ? students.filter(s => s.gradeLevel === attendancePopupGrade)
      : [];
  }, [students, attendancePopupGrade]);

  // Advisor teacher for popup grade
  const popupClassAdvisor = useMemo(() => {
    if (!attendancePopupGrade) return null;
    return personnel.find(p => p.advisorGrade === attendancePopupGrade) || null;
  }, [personnel, attendancePopupGrade]);

  // Filter students for assessment popup grade (sorted by rollNumber)
  const assessmentGradeStudents = useMemo(() => {
    return assessmentPopupGrade
      ? students
          .filter(s => s.gradeLevel === assessmentPopupGrade)
          .sort((a, b) => (a.rollNumber || 999) - (b.rollNumber || 999))
      : [];
  }, [students, assessmentPopupGrade]);

  // Filter subjects for assessment popup grade
  const assessmentGradeSubjects = useMemo(() => {
    if (!assessmentPopupGrade) return [];
    // 1. Try matching grade, semester, and academic year
    let list = effectiveSubjects.filter(s => 
      s.gradeLevel === assessmentPopupGrade && 
      (s.semester === selectedSemester || !s.semester) &&
      (s.academicYear === selectedYear || !s.academicYear)
    );
    // 2. If empty, try matching grade and semester
    if (list.length === 0) {
      list = effectiveSubjects.filter(s => 
        s.gradeLevel === assessmentPopupGrade && 
        (s.semester === selectedSemester || !s.semester)
      );
    }
    // 3. If still empty, match grade only
    if (list.length === 0) {
      list = effectiveSubjects.filter(s => s.gradeLevel === assessmentPopupGrade);
    }
    return list;
  }, [effectiveSubjects, assessmentPopupGrade, selectedSemester, selectedYear]);

  // Chunk subjects into sets of 5 (5 วิชา ต่อ 1 แผ่น A4 แนวตั้ง)
  const assessmentSubjectChunks = useMemo(() => {
    if (assessmentGradeSubjects.length === 0) return [];
    const chunks: Subject[][] = [];
    for (let i = 0; i < assessmentGradeSubjects.length; i += 5) {
      chunks.push(assessmentGradeSubjects.slice(i, i + 5));
    }
    return chunks;
  }, [assessmentGradeSubjects]);

  // Active chunks to display in popup
  const activeAssessmentChunks = useMemo(() => {
    if (assessmentSelectedChunkIndex === 'all') {
      return assessmentSubjectChunks;
    }
    const idx = Number(assessmentSelectedChunkIndex);
    if (!isNaN(idx) && assessmentSubjectChunks[idx]) {
      return [assessmentSubjectChunks[idx]];
    }
    return assessmentSubjectChunks;
  }, [assessmentSubjectChunks, assessmentSelectedChunkIndex]);

  // Helper to get scores for student & subject
  const getStudentScores = (studentId: string, subject: Subject) => {
    const rec = effectiveGrades.find(g => 
      g.studentId === studentId && 
      (g.subjectId === subject.id || (subject.code && g.subjectCode === subject.code)) &&
      (g.semester === selectedSemester || !g.semester) &&
      (g.academicYear === selectedYear || !g.academicYear)
    );
    return {
      coursework: rec?.courseworkScore !== undefined && rec.courseworkScore !== null ? rec.courseworkScore : '-',
      exam: rec?.examScore !== undefined && rec.examScore !== null ? rec.examScore : '-',
      total: rec?.totalScore !== undefined && rec.totalScore !== null ? rec.totalScore : '-',
      numCoursework: typeof rec?.courseworkScore === 'number' ? rec.courseworkScore : null,
      numExam: typeof rec?.examScore === 'number' ? rec.examScore : null,
      numTotal: typeof rec?.totalScore === 'number' ? rec.totalScore : null
    };
  };

  // Rule: Can show "เกรด" button
  // For Primary (ประถม อ.1-ป.6): ONLY in Semester 2 (เฉพาะ"เทอม2" เทอม1จะไม่ได้แสดงสำหรับประถมเพราะต้องรวมภาคเรียนที่1)
  // For Secondary (มัธยม ม.1-ม.6): In BOTH Semester 1 and 2 (ในส่วนมัธยมให้มีปุ่มเกรดทั้งเทอม1 และเทอม2)
  const isAssessmentPrimary = assessmentPopupGrade ? PRIMARY_GRADES.includes(assessmentPopupGrade) : false;
  const canShowGradeButton = assessmentPopupGrade 
    ? (isAssessmentPrimary ? selectedSemester === '2' : true)
    : false;

  // Helper to get student's score for grade computation
  const getStudentGradeScore = (studentId: string, subject: Subject): number | null => {
    if (isAssessmentPrimary && selectedSemester === '2') {
      const recSem1 = effectiveGrades.find(g => 
        g.studentId === studentId && 
        (g.subjectId === subject.id || (subject.code && g.subjectCode === subject.code)) &&
        g.semester === '1' &&
        (g.academicYear === selectedYear || !g.academicYear)
      );
      const recSem2 = effectiveGrades.find(g => 
        g.studentId === studentId && 
        (g.subjectId === subject.id || (subject.code && g.subjectCode === subject.code)) &&
        g.semester === '2' &&
        (g.academicYear === selectedYear || !g.academicYear)
      );
      const s1 = typeof recSem1?.totalScore === 'number' ? recSem1.totalScore : null;
      const s2 = typeof recSem2?.totalScore === 'number' ? recSem2.totalScore : null;
      if (s1 !== null && s2 !== null) {
        return Math.round((s1 + s2) / 2);
      }
      if (s2 !== null) return s2;
      if (s1 !== null) return s1;
      const current = getStudentScores(studentId, subject);
      return current.numTotal;
    }
    const current = getStudentScores(studentId, subject);
    return current.numTotal;
  };

  // Search filter for students
  const filteredStudents = useMemo(() => {
    return gradeStudents.filter(s => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const fullName = `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      const code = (s.studentCode || '').toLowerCase();
      const nickname = (s.nickname || '').toLowerCase();
      return fullName.includes(term) || code.includes(term) || nickname.includes(term);
    });
  }, [gradeStudents, searchTerm]);

  // Generate ALL CALENDAR DAYS of every month in the semester
  const monthGroups: FullMonthGroup[] = useMemo(() => {
    const yearCE = getAdYear(selectedYear);
    const termKey = `${selectedSemester}_${selectedYear}`;

    const configsByTerm = StorageService.getAttendanceConfigsByTerm();
    const termCfg = configsByTerm[termKey];
    const holidayMap = new Map<string, { isHoliday: boolean; note?: string }>();

    if (termCfg?.schoolDays && termCfg.schoolDays.length > 0) {
      termCfg.schoolDays.forEach(d => {
        holidayMap.set(d.date, { isHoliday: d.isHoliday, note: d.note });
      });
    } else {
      const singleCfg = StorageService.getAttendanceConfig();
      if (singleCfg?.academicYear === selectedYear && singleCfg?.semester === selectedSemester && singleCfg.schoolDays) {
        singleCfg.schoolDays.forEach(d => {
          holidayMap.set(d.date, { isHoliday: d.isHoliday, note: d.note });
        });
      }
    }

    let monthsTarget: { yearCE: number; monthNum: number }[] = [];
    if (selectedSemester === '1') {
      monthsTarget = [
        { yearCE, monthNum: 5 },
        { yearCE, monthNum: 6 },
        { yearCE, monthNum: 7 },
        { yearCE, monthNum: 8 },
        { yearCE, monthNum: 9 },
        { yearCE, monthNum: 10 },
      ];
    } else {
      monthsTarget = [
        { yearCE, monthNum: 11 },
        { yearCE, monthNum: 12 },
        { yearCE: yearCE + 1, monthNum: 1 },
        { yearCE: yearCE + 1, monthNum: 2 },
        { yearCE: yearCE + 1, monthNum: 3 },
      ];
    }

    return monthsTarget.map(mTarget => {
      const mNum = mTarget.monthNum;
      const yCE = mTarget.yearCE;
      const yBE = yCE + 543;
      const monthName = THAI_MONTH_NAMES[mNum] || `เดือนที่ ${mNum}`;
      const monthKey = `${yCE}-${String(mNum).padStart(2, '0')}`;

      const daysInMonth = new Date(yCE, mNum, 0).getDate();
      const days: FullMonthDayItem[] = [];
      let schoolDaysCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(mNum).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${yCE}-${mm}-${dd}`;
        const dt = new Date(yCE, mNum - 1, d);
        const dayOfWeekNum = dt.getDay();
        const dayOfWeekName = THAI_DAY_FULL[dayOfWeekNum] || '';
        const shortDayName = THAI_DAY_SHORT[dayOfWeekNum] || '';

        const isSaturday = dayOfWeekNum === 6;
        const isSunday = dayOfWeekNum === 0;
        const isWeekend = isSaturday || isSunday;

        const cfg = holidayMap.get(dateStr);
        const isCustomHoliday = cfg ? cfg.isHoliday : false;
        const isHoliday = isWeekend || isCustomHoliday;

        let holidayLabel: 'วันเสาร์' | 'วันอาทิตย์' | 'วันหยุด' | null = null;
        if (isSaturday) {
          holidayLabel = 'วันเสาร์';
        } else if (isSunday) {
          holidayLabel = 'วันอาทิตย์';
        } else if (isHoliday) {
          holidayLabel = 'วันหยุด';
        } else {
          schoolDaysCount++;
        }

        days.push({
          date: dateStr,
          dayNum: d,
          dayOfWeekNum,
          dayOfWeekName,
          shortDayName,
          isSaturday,
          isSunday,
          isWeekend,
          isHoliday,
          holidayLabel,
          note: cfg?.note
        });
      }

      return {
        monthKey,
        monthNum: mNum,
        yearCE: yCE,
        yearBE: yBE,
        monthName,
        days,
        schoolDaysCount
      };
    });
  }, [selectedYear, selectedSemester]);

  // Total active school days in this term
  const activeSchoolDaysTotal = useMemo(() => {
    return monthGroups.reduce((acc, g) => acc + g.schoolDaysCount, 0);
  }, [monthGroups]);

  // Map attendance by studentId and date string
  const attendanceMap = useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | 'leave' | 'sick'>();
    attendance.forEach(rec => {
      if (rec.studentId && rec.date) {
        if (rec.academicYear && rec.academicYear !== selectedYear) return;
        if (rec.semester && rec.semester !== selectedSemester) return;
        map.set(`${rec.studentId}_${rec.date}`, rec.status);
      }
    });
    return map;
  }, [attendance, selectedYear, selectedSemester]);

  // Print function (A4 Portrait print)
  const handlePrintPDF = () => {
    window.print();
  };

  // Download CSV for Pop-up Grade
  const handleDownloadPopupCSV = () => {
    if (!attendancePopupGrade || popupGradeStudents.length === 0) {
      onShowToast('warning', 'ไม่มีข้อมูล', 'ไม่มีรายชื่อนักเรียนสำหรับดาวน์โหลด');
      return;
    }

    try {
      let csvContent = '\uFEFF';
      csvContent += `แบบบันทึกเวลาเรียนและสถิติการมาเรียน,โรงเรียน${schoolInfo.schoolName || ''}\n`;
      csvContent += `ระดับชั้น ${getGradeFullName(attendancePopupGrade)},ภาคเรียนที่ ${selectedSemester},ปีการศึกษา ${selectedYear}\n`;
      csvContent += `ครูประจำชั้น: ${popupClassAdvisor ? `${popupClassAdvisor.prefix}${popupClassAdvisor.firstName} ${popupClassAdvisor.lastName}` : '-'}\n\n`;

      const targetGroups = popupSelectedMonthKey === 'all' 
        ? monthGroups 
        : monthGroups.filter(g => g.monthKey === popupSelectedMonthKey);

      targetGroups.forEach(group => {
        csvContent += `========================================================================\n`;
        csvContent += `ประจำเดือน ${group.monthName} พ.ศ. ${group.yearBE} (จำนวนวันเรียน: ${group.schoolDaysCount} วัน)\n`;
        csvContent += `========================================================================\n`;

        const dateHeaders = group.days.map(d => {
          return `"${d.dayNum} (${d.shortDayName})"`;
        }).join(',');

        csvContent += `เลขที่,รหัสประจำตัว,ชื่อ - นามสกุล,${dateHeaders},มา (วัน),ขาด (วัน),ลา (วัน),ป่วย (วัน),% มาเรียน\n`;

        popupGradeStudents.forEach((s, idx) => {
          let pCount = 0;
          let aCount = 0;
          let lCount = 0;
          let sCount = 0;

          const dateCols = group.days.map(d => {
            if (d.isHoliday) {
              return `"${d.holidayLabel || 'วันหยุด'}"`;
            }
            const status = attendanceMap.get(`${s.id}_${d.date}`);
            if (status === 'present') { pCount++; return '✓'; }
            if (status === 'absent') { aCount++; return 'ข'; }
            if (status === 'leave') { lCount++; return 'ล'; }
            if (status === 'sick') { sCount++; return 'ป'; }
            return '-';
          }).join(',');

          const totalDays = group.schoolDaysCount;
          const pct = totalDays > 0 ? ((pCount / totalDays) * 100).toFixed(1) + '%' : '0%';

          csvContent += `${s.rollNumber || idx + 1},"${s.studentCode || ''}","${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}",${dateCols},${pCount},${aCount},${lCount},${sCount},${pct}\n`;
        });

        csvContent += '\n\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ใบเช็กเวลาเรียน_A4_${attendancePopupGrade}_เทอม${selectedSemester}_ปี${selectedYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onShowToast('success', 'ดาวน์โหลดสำเร็จ', 'ส่งออกข้อมูลเวลาเรียนเรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      onShowToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถดาวน์โหลดไฟล์ได้');
    }
  };

  // Active month groups for pop-up preview
  const popupActiveMonthGroups = useMemo(() => {
    if (popupSelectedMonthKey === 'all') return monthGroups;
    return monthGroups.filter(g => g.monthKey === popupSelectedMonthKey);
  }, [monthGroups, popupSelectedMonthKey]);

  return (
    <div className="space-y-4">
      {/* CSS Styles for True A4 Portrait Print Preview */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 5mm 5mm 5mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, header, nav, sidebar, footer {
            display: none !important;
          }
          .a4-modal-overlay {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .a4-modal-content {
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .a4-portrait-paper {
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 0 !important;
            padding: 5mm 5mm !important;
            margin: 0 auto 0 auto !important;
            width: 100% !important;
            max-width: 210mm !important;
          }
          .a4-portrait-paper:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .a4-page-limit-line {
            display: none !important;
          }
        }
      `}</style>

      {/* 
        Single Row Top Control Bar:
        ปีการศึกษา, ภาคเรียน, และ ประถม/มัธยม (ชิดกัน) อยู่บนบรรทัดเดียวกัน
      */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        
        {/* Left Side: Back button if grade selected, or icon title */}
        <div className="flex items-center gap-2">
          {selectedGrade ? (
            <button
              type="button"
              onClick={() => {
                setSelectedGrade(null);
                setSearchTerm('');
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-600" />
              <span>ย้อนกลับ</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Users className="w-4 h-4 text-purple-600" />
              <span>ระดับชั้นเรียน</span>
            </div>
          )}

          {selectedGrade && (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full font-bold">
                {selectedGrade}
              </span>
              <span className="text-xs font-medium text-slate-500 hidden sm:inline">
                ({getGradeFullName(selectedGrade)})
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Academic Year, Semester, and Adjacent Primary/Secondary Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* ปีการศึกษา */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              ปีการศึกษา:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="2569">2569</option>
              <option value="2568">2568</option>
              <option value="2567">2567</option>
              <option value="2566">2566</option>
            </select>
          </div>

          {/* ภาคเรียน */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              ภาคเรียน:
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
            </select>
          </div>

          {/* ประถม & มัธยม ชิดกันเลย */}
          <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveLevel('primary');
                if (selectedGrade && SECONDARY_GRADES.includes(selectedGrade)) {
                  setSelectedGrade(null);
                  setSearchTerm('');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeLevel === 'primary'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ประถม
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveLevel('secondary');
                if (selectedGrade && PRIMARY_GRADES.includes(selectedGrade)) {
                  setSelectedGrade(null);
                  setSearchTerm('');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeLevel === 'secondary'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              มัธยม
            </button>
          </div>
        </div>

      </div>

      {/* 
        VIEW 1: Grade Selection List
        แสดงแบบรายการยาวชิดสุดเลยตามความเหมาะสม
        มีปุ่ม "เช็กชื่อ" บนแต่ละชั้นเพื่อเปิด Pop-up Modal A4 แนวตั้ง
      */}
      {!selectedGrade ? (
        <div className="space-y-2">
          {currentGradeList.map((g) => {
            return (
              <div
                key={g}
                className="w-full bg-white hover:bg-purple-50/40 p-3 sm:p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 transition-all shadow-xs flex items-center justify-between gap-3 group"
              >
                {/* Clickable Grade Item to go directly to student roster */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGrade(g);
                    setSearchTerm('');
                  }}
                  className="flex items-center gap-3.5 cursor-pointer flex-1 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                    {g}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                      {getGradeFullName(g)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      คลิกเพื่อดูตารางรายชื่อนักเรียน
                    </div>
                  </div>
                </button>

                {/* Right Action: Dedicated "(3)รายงาน", "วัดผล", "เช็กชื่อ", "ดื่มนม", and "แปรงฟัน" Buttons -> Opens Pop-up Modals */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Dedicated "(3)รายงาน" Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreeReportsPopupGrade(g);
                    }}
                    className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="เปิด Pop-up รายงานประเมิน 3 เล่ม (การอ่านคิดวิเคราะห์เขียน, คุณลักษณะอันพึงประสงค์, สมรรถนะสำคัญ)"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>(3)รายงาน</span>
                  </button>

                  {/* Dedicated "วัดผล" Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssessmentPopupGrade(g);
                      setAssessmentSelectedChunkIndex(0);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="เปิด Pop-up ตารางคะแนนวัดผลกระดาษ A4 แนวตั้ง (5 วิชาต่อแผ่น)"
                  >
                    <Award className="w-4 h-4" />
                    <span>วัดผล</span>
                  </button>

                  {/* Dedicated "เช็กชื่อ" Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttendancePopupGrade(g);
                      setPopupSelectedMonthKey('all');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="เปิด Pop-up ตารางเช็กชื่อกระดาษ A4 แนวตั้ง (แสดงครบทุกวันรวมเสาร์-อาทิตย์สีแดง)"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>เช็กชื่อ</span>
                  </button>

                  {/* Dedicated "ดื่มนม" Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMilkTeethModal({ grade: g, type: 'milk' });
                      setMilkTeethSelectedMonthIdx(0);
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="เปิด Pop-up รายงานสรุปการดื่มนมโรงเรียน ขนาด A4 แนวตั้ง (ดึงจากหน้าธุรการ)"
                  >
                    <span>🥛</span>
                    <span>ดื่มนม</span>
                  </button>

                  {/* Dedicated "แปรงฟัน" Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMilkTeethModal({ grade: g, type: 'teeth' });
                      setMilkTeethSelectedMonthIdx(0);
                    }}
                    className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="เปิด Pop-up รายงานสรุปการแปรงฟันหลังอาหาร ขนาด A4 แนวตั้ง (ดึงจากหน้าธุรการ)"
                  >
                    <span>🪥</span>
                    <span>แปรงฟัน</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGrade(g);
                      setSearchTerm('');
                    }}
                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-purple-600 rounded-lg transition-colors cursor-pointer"
                    title="ดูรายชื่อนักเรียน"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 
          VIEW 2: Individual Class View (ตารางชื่อนักเรียนโดยตรง ไม่แสดงตารางเช็กชื่อข้างในอีกต่อไป!)
        */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header with Grade Title & Clean Action Buttons (No search box, No A4 text) */}
            <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-slate-800">
                  {selectedGrade ? getGradeFullName(selectedGrade).replace(/^ชั้น\s*/, '') : ''}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  รวม {gradeStudents.length} คน
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* (3)รายงาน Pop-up Button */}
                <button
                  type="button"
                  onClick={() => {
                    setThreeReportsPopupGrade(selectedGrade);
                  }}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="เปิดรายงานประเมิน 3 เล่ม (การอ่านคิดวิเคราะห์เขียน, คุณลักษณะอันพึงประสงค์, สมรรถนะสำคัญ)"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>(3)รายงาน</span>
                </button>

                {/* Assessment (วัดผล) Pop-up Button */}
                <button
                  type="button"
                  onClick={() => {
                    setAssessmentPopupGrade(selectedGrade);
                    setAssessmentSelectedChunkIndex(0);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="เปิดตารางคะแนนวัดผล"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>วัดผล</span>
                </button>

                {/* Check Name Pop-up Button */}
                <button
                  type="button"
                  onClick={() => {
                    setAttendancePopupGrade(selectedGrade);
                    setPopupSelectedMonthKey('all');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="เปิดตารางเช็กชื่อเวลาเรียน"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>เช็กชื่อ</span>
                </button>

                {/* ดื่มนม Pop-up Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMilkTeethModal({ grade: selectedGrade, type: 'milk' });
                    setMilkTeethSelectedMonthIdx(0);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="เปิดรายงานสรุปการดื่มนมโรงเรียน"
                >
                  <span>🥛</span>
                  <span>ดื่มนม</span>
                </button>

                {/* แปรงฟัน Pop-up Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMilkTeethModal({ grade: selectedGrade, type: 'teeth' });
                    setMilkTeethSelectedMonthIdx(0);
                  }}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="เปิดรายงานสรุปการแปรงฟันหลังอาหาร"
                >
                  <span>🪥</span>
                  <span>แปรงฟัน</span>
                </button>
              </div>
            </div>

            {/* Student Roster Table */}
            {gradeStudents.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">
                  ยังไม่มีข้อมูลนักเรียนใน{selectedGrade ? getGradeFullName(selectedGrade) : ''}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center w-14">เลขที่</th>
                      <th className="py-3 px-3 text-center w-16">รูปถ่าย</th>
                      <th className="py-3 px-3 text-center w-28">รหัสประจำตัว</th>
                      <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                      <th className="py-3 px-3 text-center w-28 no-print">ปพ.6</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredStudents.map((s, idx) => {
                      const roll = s.rollNumber || idx + 1;

                      return (
                        <tr 
                          key={s.id} 
                          className="hover:bg-purple-50/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 tabular-nums font-bold">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-bold text-xs border border-purple-200">
                              {roll}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div
                              onClick={() => {
                                if (s.photoUrl && onOpenLightbox) {
                                  onOpenLightbox(
                                    s.photoUrl,
                                    `${s.prefix}${s.firstName} ${s.lastName}`,
                                    `เลขที่ ${roll} • ${s.studentCode ? `รหัส ${s.studentCode} • ` : ''}${getGradeCleanName(s.gradeLevel)}`
                                  );
                                }
                              }}
                              className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden mx-auto flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all shadow-2xs"
                              title={s.photoUrl ? "คลิกเพื่อดูรูปภาพขนาดใหญ่" : "รูปถ่ายนักเรียน"}
                            >
                              {s.photoUrl ? (
                                <img
                                  src={s.photoUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-xs font-bold text-slate-400">
                                  {s.firstName?.[0] || 'น'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-600 tabular-nums">
                            {s.studentCode ? (
                              <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200">
                                #{s.studentCode}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-slate-800">
                                {s.prefix}{s.firstName} {s.lastName}
                              </span>
                              {s.nickname && (
                                <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  {s.nickname}
                                </span>
                              )}
                            </div>
                            {s.chronicDisease && s.chronicDisease !== 'ไม่มี' && (
                              <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                                โรคประจำตัว: {s.chronicDisease}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center no-print">
                            <button
                              type="button"
                              onClick={() => setSelectedPhorPhor6Student(s)}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto active:scale-95 cursor-pointer"
                              title="เปิดสมุดรายงานประจำตัวนักเรียน (ปพ.6)"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>ปพ.6</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        POP-UP MODAL: True A4 Portrait Attendance Sheet Preview & PDF Download
        ========================================================================
        เมื่อกดคำว่า "เช็กชื่อ" จะแสดง pop-up หน้ากระดาษ A4 แนวตั้งที่เป็นหน้าจริง
        แสดงวันทั้งหมดในเดือนนั้นๆ (เสาร์, อาทิตย์, และ วันหยุด แสดงคำว่า วันเสาร์ / วันอาทิตย์ / วันหยุด เพียง 1 คำตรงกลางคอลัมน์ ใช้ rowspan)
      */}
      {attendancePopupGrade && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto a4-modal-overlay">
          <div className="bg-slate-100 rounded-2xl w-full max-w-[980px] max-h-[96vh] flex flex-col shadow-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150 my-auto a4-modal-content">
            
            {/* Modal Header Controls (No-Print) */}
            <div className="px-4 py-3 bg-white border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>ตารางเช็กเวลาเรียน {getGradeCleanName(attendancePopupGrade)}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                      พรีวิว A4 แนวตั้ง
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ภาคเรียนที่ {selectedSemester}/{selectedYear} | นักเรียน {popupGradeStudents.length} คน | รวมวันเรียน {activeSchoolDaysTotal} วัน
                  </p>
                </div>
              </div>

              {/* Action Buttons & Month Selector */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Select Month */}
                <select
                  value={popupSelectedMonthKey}
                  onChange={(e) => setPopupSelectedMonthKey(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">แสดงทุกเดือน ({monthGroups.length} เดือน)</option>
                  {monthGroups.map(m => (
                    <option key={m.monthKey} value={m.monthKey}>
                      เดือน {m.monthName} ({m.days.length} วัน)
                    </option>
                  ))}
                </select>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setAttendancePopupGrade(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Personnel Signature Selectors Bar (No-Print) */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Select Homeroom Teacher */}
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 whitespace-nowrap">ครูประจำชั้น:</span>
                  <select
                    value={selectedAdvisorId}
                    onChange={(e) => setSelectedAdvisorId(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[210px] truncate"
                  >
                    <option value="">-- ให้ระบุเองในกระดาษ --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.prefix}{p.firstName} {p.lastName} {p.advisorGrade ? `(${p.advisorGrade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Academic Head */}
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 whitespace-nowrap">ฝ่ายวิชาการ:</span>
                  <select
                    value={selectedAcademicHeadId}
                    onChange={(e) => setSelectedAcademicHeadId(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[210px] truncate"
                  >
                    <option value="">-- ให้ระบุเองในกระดาษ --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.prefix}{p.firstName} {p.lastName} {p.position ? `(${p.position})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <span>ผู้อำนวยการ:</span>
                <strong className="text-slate-800 font-bold">{directorDisplayName}</strong>
              </div>
            </div>

            {/* Modal Body: Interactive A4 Portrait Paper Preview Scroll Container */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-8 bg-slate-200/70 flex-1">
              
              {/* Informational Banner (Screen only) */}
              <div className="max-w-[210mm] mx-auto bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 flex flex-wrap items-center justify-between gap-2 no-print shadow-2xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>พรีวิวขนาด A4 แนวตั้งจริง (210mm × 297mm):</strong> วันเสาร์ อาทิตย์ และวันหยุด แสดงข้อความกลางคอลัมน์เพียง 1 คำ (ไม่ซ้ำทุกแถว)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold shrink-0 flex-wrap">
                  <span className="text-emerald-700">✓ = มา</span>
                  <span className="text-rose-700">ข = ขาด</span>
                  <span className="text-amber-700">ล = ลากิจ</span>
                  <span className="text-blue-700">ป = ป่วย</span>
                </div>
              </div>

              {popupGradeStudents.length === 0 ? (
                <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-2 max-w-[210mm] mx-auto">
                  <Users className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    ยังไม่มีข้อมูลนักเรียนในชั้น {attendancePopupGrade}
                  </p>
                  <p className="text-xs text-slate-400">
                    กรุณาเพิ่มข้อมูลนักเรียนในระบบก่อนพิมพ์แบบบันทึกเวลาเรียน
                  </p>
                </div>
              ) : popupActiveMonthGroups.length === 0 ? (
                <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-2 max-w-[210mm] mx-auto">
                  <CalendarCheck className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    ไม่พบข้อมูลเดือนในภาคเรียนนี้
                  </p>
                  <p className="text-xs text-slate-400">
                    กรุณาตรวจสอบการเลือกภาคเรียนและปีการศึกษา
                  </p>
                </div>
              ) : (
                popupActiveMonthGroups.map((group, groupIdx) => {
                  return (
                    <div 
                      key={group.monthKey}
                      className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
                      style={{ width: '210mm' }}
                    >
                      {/* A4 Sheet Header - Exactly 3 Lines */}
                      <div className="border-b-2 border-slate-800 pb-2 mb-3 text-center">
                        {/* Line 1: สถิติการมาเรียน */}
                        <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                          สถิติการมาเรียน
                        </h1>

                        {/* Line 2: ชื่อโรงเรียน และสังกัดสำนักงาน (ฟอนต์เล็ก ห้ามเกินไปบรรทัดที่ 3) */}
                        <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                          โรงเรียน{schoolInfo.schoolName || '...................................................'} {schoolInfo.affiliation ? `สังกัด${schoolInfo.affiliation}` : ''}
                        </div>

                        {/* Line 3: เดือน, ปีการศึกษา, ภาคเรียน, ชั้น (เอาออกคำในวงเล็บ เช่น (ป.1)) */}
                        <div className="text-[11px] font-bold text-slate-800 mt-0.5">
                          เดือน {group.monthName} {group.yearBE} | ปีการศึกษา {selectedYear} | ภาคเรียนที่ {selectedSemester} | {getGradeCleanName(attendancePopupGrade)}
                        </div>
                      </div>

                      {/* Compact A4 Portrait Matrix Table showing ALL calendar days */}
                      <div className="overflow-x-auto border border-slate-300 rounded-sm">
                        <table className="w-full text-left text-[10px] border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                              <th className="py-1 px-0.5 border-r border-slate-300 text-center w-5 shrink-0 font-mono text-[9px]">
                                ที่
                              </th>
                              <th className="py-1 px-1 border-r border-slate-300 w-28 shrink-0 truncate text-[10px]">
                                ชื่อ - นามสกุล
                              </th>

                              {/* ALL Calendar Days of this Month (1 to 28..31) */}
                              {group.days.map((dayItem) => {
                                const isRedDay = dayItem.isHoliday;
                                return (
                                  <th 
                                    key={dayItem.date} 
                                    className={`py-0.5 px-0 border-r border-slate-300 text-center font-mono w-[17px] text-[9px] ${
                                      isRedDay ? 'bg-rose-100/90 text-rose-800' : 'bg-slate-100 text-slate-800'
                                    }`}
                                    title={`${dayItem.dayOfWeekName} ที่ ${dayItem.dayNum} ${group.monthName}${dayItem.holidayLabel ? ` (${dayItem.holidayLabel})` : ''}`}
                                  >
                                    <div className={`font-bold leading-none ${isRedDay ? 'text-rose-800' : 'text-slate-900'}`}>
                                      {dayItem.dayNum}
                                    </div>
                                    <div className={`text-[8px] font-sans leading-none mt-0.5 ${isRedDay ? 'text-rose-700 font-bold' : 'text-slate-500 font-normal'}`}>
                                      {dayItem.shortDayName}
                                    </div>
                                  </th>
                                );
                              })}

                              {/* Monthly Summary Columns */}
                              <th className="py-1 px-0.5 border-r border-slate-300 text-center w-5 bg-emerald-50 text-emerald-800 font-mono text-[9px]">
                                มา
                              </th>
                              <th className="py-1 px-0.5 border-r border-slate-300 text-center w-5 bg-rose-50 text-rose-800 font-mono text-[9px]">
                                ขาด
                              </th>
                              <th className="py-1 px-0.5 border-r border-slate-300 text-center w-5 bg-amber-50 text-amber-800 font-mono text-[9px]">
                                ลา
                              </th>
                              <th className="py-1 px-0.5 border-r border-slate-300 text-center w-5 bg-blue-50 text-blue-800 font-mono text-[9px]">
                                ป่วย
                              </th>
                              <th className="py-1 px-1 text-center w-8 bg-slate-100 text-slate-800 font-mono text-[9px]" title="รวมวันทำการ">
                                รวม
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-800">
                            {popupGradeStudents.map((s, sIdx) => {
                              let presentCount = 0;
                              let absentCount = 0;
                              let leaveCount = 0;
                              let sickCount = 0;

                              const isFirstRow = sIdx === 0;
                              const rowSpanCount = popupGradeStudents.length;

                              return (
                                <tr key={s.id} className="hover:bg-slate-50 leading-tight">
                                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                                    {s.rollNumber || sIdx + 1}
                                  </td>
                                  <td className="py-1 px-1 border-r border-slate-200 font-medium text-slate-900 truncate max-w-[120px] text-[10px]">
                                    {s.prefix}{s.firstName} {s.lastName}
                                  </td>

                                  {/* Daily status cells for all days of the month */}
                                  {group.days.map((dayItem) => {
                                    if (dayItem.isHoliday) {
                                      // If it's a holiday column, only render the <td> with rowspan on the FIRST student row!
                                      // On subsequent rows, omit this <td> so HTML table layout remains pristine.
                                      if (isFirstRow) {
                                        return (
                                          <td 
                                            key={dayItem.date} 
                                            rowSpan={rowSpanCount}
                                            className="bg-rose-50/90 border-r border-slate-200 text-center p-0 align-middle"
                                            title={`${dayItem.dayNum} ${group.monthName}: ${dayItem.holidayLabel}`}
                                          >
                                            <div className="flex items-center justify-center h-full min-h-[40px]">
                                              <span className="[writing-mode:vertical-lr] rotate-180 text-[9px] font-bold text-rose-700 tracking-wider whitespace-nowrap select-none">
                                                {dayItem.holidayLabel}
                                              </span>
                                            </div>
                                          </td>
                                        );
                                      } else {
                                        return null;
                                      }
                                    }

                                    // Normal school day -> Attendance symbol
                                    const status = attendanceMap.get(`${s.id}_${dayItem.date}`);
                                    let symbol = '-';
                                    let cellClass = 'text-slate-300';

                                    if (status === 'present') {
                                      symbol = '✓';
                                      cellClass = 'text-emerald-700 font-bold';
                                      presentCount++;
                                    } else if (status === 'absent') {
                                      symbol = 'ข';
                                      cellClass = 'text-rose-700 font-bold';
                                      absentCount++;
                                    } else if (status === 'leave') {
                                      symbol = 'ล';
                                      cellClass = 'text-amber-700 font-bold';
                                      leaveCount++;
                                    } else if (status === 'sick') {
                                      symbol = 'ป';
                                      cellClass = 'text-blue-700 font-bold';
                                      sickCount++;
                                    }

                                    return (
                                      <td 
                                        key={dayItem.date} 
                                        className={`py-0.5 px-0 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums ${cellClass}`}
                                      >
                                        {symbol}
                                      </td>
                                    );
                                  })}

                                  {/* Student totals for month */}
                                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-bold font-mono text-emerald-800 bg-emerald-50/40 text-[9px]">
                                    {presentCount}
                                  </td>
                                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-bold font-mono text-rose-800 bg-rose-50/40 text-[9px]">
                                    {absentCount}
                                  </td>
                                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-bold font-mono text-amber-800 bg-amber-50/40 text-[9px]">
                                    {leaveCount}
                                  </td>
                                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-bold font-mono text-blue-800 bg-blue-50/40 text-[9px]">
                                    {sickCount}
                                  </td>
                                  <td className="py-1 px-0.5 text-center font-bold font-mono text-slate-700 bg-slate-50/70 text-[9px]">
                                    {group.schoolDaysCount}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>

                          {/* Footer totals row */}
                          <tfoot>
                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
                              <td colSpan={2} className="py-1 px-1 border-r border-slate-300 text-right text-[9px]">
                                รวมมาเรียน (คน):
                              </td>
                              {group.days.map((dayItem) => {
                                if (dayItem.isHoliday) {
                                  return (
                                    <td key={dayItem.date} className="py-0.5 px-0 border-r border-slate-300 bg-rose-100/50 text-center text-rose-700 text-[8px]">
                                      -
                                    </td>
                                  );
                                }
                                let dayPresent = 0;
                                popupGradeStudents.forEach(s => {
                                  if (attendanceMap.get(`${s.id}_${dayItem.date}`) === 'present') {
                                    dayPresent++;
                                  }
                                });
                                return (
                                  <td key={dayItem.date} className="py-0.5 px-0 border-r border-slate-300 text-center font-mono text-[9px] text-emerald-800">
                                    {dayPresent}
                                  </td>
                                );
                              })}
                              <td colSpan={5} className="py-1 px-1 text-center text-[9px] text-slate-600">
                                รวม {popupGradeStudents.length} คน
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Signatures */}
                      <div className="mt-6 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="space-y-0.5">
                          <p className="text-slate-600">ลงชื่อ ..................................................</p>
                          <p className="font-bold text-slate-800">
                            ({selectedAdvisor ? `${selectedAdvisor.prefix}${selectedAdvisor.firstName} ${selectedAdvisor.lastName}` : '................................................'})
                          </p>
                          <p className="text-slate-500 text-[9px]">ครูประจำชั้น / ผู้บันทึก</p>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-slate-600">ลงชื่อ ..................................................</p>
                          <p className="font-bold text-slate-800">
                            ({selectedAcademicHead ? `${selectedAcademicHead.prefix}${selectedAcademicHead.firstName} ${selectedAcademicHead.lastName}` : '................................................'})
                          </p>
                          <p className="text-slate-500 text-[9px]">หัวหน้าฝ่ายวิชาการ / ผู้ตรวจ</p>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-slate-600">ลงชื่อ ..................................................</p>
                          <p className="font-bold text-slate-800">
                            ({directorDisplayName})
                          </p>
                          <p className="text-slate-500 text-[9px]">ผู้อำนวยการโรงเรียน</p>
                        </div>
                      </div>

                      {/* Visual A4 Page Boundary Line Indicator (On screen only) */}
                      <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-purple-400 text-center text-[10px] font-bold text-purple-700 no-print flex items-center justify-center gap-2 bg-purple-50/60 py-1 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>--- สิ้นสุดความยาวกระดาษ A4 หน้าที่ {groupIdx + 1} (297 mm) ---</span>
                      </div>
                    </div>
                  );
                })
              )}

            </div>

            {/* Modal Footer (No-Print) */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 rounded-b-2xl flex items-center justify-between gap-3 shrink-0 no-print">
              <span className="text-xs text-slate-500">
                พร้อมสำหรับการดาวน์โหลดเอกสาร PDF (ขนาด A4 แนวตั้ง)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAttendancePopupGrade(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  title="ดาวน์โหลด PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 
        ========================================================================
        POP-UP MODAL: True A4 Portrait Assessment (วัดผล) Sheet Preview & PDF Download
        ========================================================================
        เมื่อกดคำว่า "วัดผล" จะแสดง pop-up หน้ากระดาษ A4 แนวตั้งที่เป็นจริง
        แสดง 5 วิชา ต่อ 1 หน้ากระดาษ A4 แนวตั้ง (แบ่งเป็นชุดๆ หากมีมากกว่า 5 วิชา)
        ในตารางประกอบด้วย:
          - คะแนนระหว่างภาค (courseworkScore)
          - คะแนนสอบ (examScore)
          - คะแนนรวม (totalScore)
        โดยดึงข้อมูลคะแนนเชื่อมโยงโดยตรงจากหน้างานวัดผล (Module 2)
      */}
      {assessmentPopupGrade && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto a4-modal-overlay">
          <div className="bg-slate-100 rounded-2xl w-full max-w-[980px] max-h-[96vh] flex flex-col shadow-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150 my-auto a4-modal-content">
            
            {/* Modal Header Controls (No-Print) */}
            <div className="px-4 py-3 bg-white border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
                  <Award className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>ตาราง{assessmentViewMode === 'grade' && canShowGradeButton ? 'ระดับผลการเรียน (เกรด)' : 'คะแนนวัดผล'} {getGradeCleanName(assessmentPopupGrade)}</span>
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                      {assessmentViewMode === 'grade' && canShowGradeButton 
                        ? 'พรีวิวระดับผลการเรียน (เกรดทุกรายวิชา)' 
                        : 'พรีวิว A4 แนวตั้ง (5 วิชา/แผ่น)'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ภาคเรียนที่ {selectedSemester}/{selectedYear} | นักเรียน {assessmentGradeStudents.length} คน | รายวิชาทั้งหมด {assessmentGradeSubjects.length} วิชา
                  </p>
                </div>
              </div>

              {/* Action Buttons: 2 Buttons (คะแนน และ เกรด) + Close */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 2 Buttons: คะแนน vs เกรด */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAssessmentViewMode('score')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      assessmentViewMode === 'score'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>คะแนน</span>
                  </button>

                  {canShowGradeButton && (
                    <button
                      type="button"
                      onClick={() => setAssessmentViewMode('grade')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        assessmentViewMode === 'grade'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>เกรด</span>
                    </button>
                  )}
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setAssessmentPopupGrade(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Personnel Signature Selectors Bar (No-Print) */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Select Academic Head */}
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 whitespace-nowrap">ฝ่ายวิชาการ:</span>
                  <select
                    value={selectedAcademicHeadId}
                    onChange={(e) => setSelectedAcademicHeadId(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[210px] truncate"
                  >
                    <option value="">-- ให้ระบุเองในกระดาษ --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.prefix}{p.firstName} {p.lastName} {p.position ? `(${p.position})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <span>ผู้อำนวยการ:</span>
                <strong className="text-slate-800 font-bold">{directorDisplayName}</strong>
              </div>
            </div>

            {/* Modal Body: Interactive A4 Portrait Paper Preview Scroll Container */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-8 bg-slate-200/70 flex-1">
              
              {/* Informational Banner (Screen only) */}
              <div className="max-w-[210mm] mx-auto bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-2 no-print shadow-2xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    {assessmentViewMode === 'grade' && canShowGradeButton ? (
                      <span><strong>พรีวิวระดับผลการเรียน (เกรด):</strong> แสดงเกรด (1, 1.5, 2, 2.5, 3, 3.5, 4) ครบทุกรายวิชาในตารางเดียว {isAssessmentPrimary ? '(สรุปผลรวมภาคเรียนที่ 1 และ 2 สำหรับระดับประถม)' : ''}</span>
                    ) : (
                      <span><strong>พรีวิวขนาด A4 แนวตั้งจริง (210mm × 297mm):</strong> แสดงต่อเนื่องทุกแผ่น (5 วิชา ต่อ 1 แผ่น) พร้อมคะแนนระหว่างภาค, คะแนนสอบ, และคะแนนรวม</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-700 shrink-0">
                  <span>{assessmentViewMode === 'grade' && canShowGradeButton ? 'คิดเกรดอัตโนมัติจากหน้าคะแนน' : 'เชื่อมโยงข้อมูลจากงานวัดผล'}</span>
                </div>
              </div>

              {assessmentGradeStudents.length === 0 ? (
                <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-2 max-w-[210mm] mx-auto">
                  <Users className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    ยังไม่มีข้อมูลนักเรียนในชั้น {getGradeCleanName(assessmentPopupGrade)}
                  </p>
                  <p className="text-xs text-slate-400">
                    กรุณาเพิ่มข้อมูลนักเรียนในระบบก่อนพิมพ์แบบรายงานผลการเรียน
                  </p>
                </div>
              ) : assessmentGradeSubjects.length === 0 ? (
                <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-2 max-w-[210mm] mx-auto">
                  <BookOpen className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    ยังไม่มีข้อมูลรายวิชาในชั้น {getGradeCleanName(assessmentPopupGrade)} ในภาคเรียนนี้
                  </p>
                  <p className="text-xs text-slate-400">
                    กรุณาเพิ่มโครงสร้างรายวิชาและบันทึกคะแนนในเมนูงานวัดผล (Module 2)
                  </p>
                </div>
              ) : assessmentViewMode === 'grade' && canShowGradeButton ? (
                /* GRADE VIEW: ALL SUBJECTS IN A SINGLE TABLE WITH CALCULATED 1, 1.5, 2, 2.5, 3, 3.5, 4 */
                <div 
                  className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
                  style={{ width: '210mm' }}
                >
                  {/* A4 Sheet Header */}
                  <div className="border-b-2 border-slate-800 pb-2 mb-3 text-center">
                    <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                      แบบรายงานระดับผลการเรียน (เกรด)
                    </h1>
                    <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                      โรงเรียน{schoolInfo.schoolName || '...................................................'} {schoolInfo.affiliation ? `สังกัด${schoolInfo.affiliation}` : ''}
                    </div>
                    <div className="text-[11px] font-bold text-slate-800 mt-0.5">
                      ปีการศึกษา {selectedYear} | ภาคเรียนที่ {selectedSemester} | {getGradeCleanName(assessmentPopupGrade)} {isAssessmentPrimary ? '(สรุปผลรวมตลอดปีการศึกษา)' : ''}
                    </div>
                  </div>

                  {/* All Subjects Table */}
                  <div className="overflow-x-auto border border-slate-300 rounded-sm">
                    <table className="w-full text-left text-[10px] border-collapse min-w-[680px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-center">
                          <th className="py-2 px-1 border-r border-slate-300 w-8 shrink-0 font-mono text-[9px]">
                            ที่
                          </th>
                          <th className="py-2 px-1 border-r border-slate-300 w-20 shrink-0 font-mono text-[9px]">
                            รหัสประจำตัว
                          </th>
                          <th className="py-2 px-2 border-r border-slate-300 w-36 shrink-0 text-left text-[10px]">
                            ชื่อ - นามสกุล
                          </th>
                          {assessmentGradeSubjects.map((subj) => (
                            <th 
                              key={subj.id}
                              className="py-1.5 px-1 border-r border-slate-300 text-center bg-indigo-50/70 text-slate-900 font-semibold"
                            >
                              <div className="font-bold text-[9px] truncate max-w-[85px] mx-auto text-indigo-950">
                                {subj.code || subj.name}
                              </div>
                              <div className="text-[7.5px] font-mono text-indigo-700 font-normal">
                                {subj.name !== subj.code ? subj.name.slice(0, 8) : ''}
                              </div>
                            </th>
                          ))}
                          <th className="py-2 px-1.5 border-slate-300 text-center w-14 bg-purple-100 text-purple-950 font-black text-[9.5px]">
                            GPA
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {assessmentGradeStudents.map((s, sIdx) => {
                          let totalPoints = 0;
                          let totalCredits = 0;

                          const subjGradeCols = assessmentGradeSubjects.map((subj) => {
                            const rawScore = getStudentGradeScore(s.id, subj);
                            const gradeStr = calculateThaiGrade(rawScore);
                            const weight = subj.hoursPerWeek ? subj.hoursPerWeek / 2 : 1;

                            let pt: number | null = null;
                            if (gradeStr === '4') pt = 4.0;
                            else if (gradeStr === '3.5') pt = 3.5;
                            else if (gradeStr === '3') pt = 3.0;
                            else if (gradeStr === '2.5') pt = 2.5;
                            else if (gradeStr === '2') pt = 2.0;
                            else if (gradeStr === '1.5') pt = 1.5;
                            else if (gradeStr === '1') pt = 1.0;
                            else if (gradeStr === '0') pt = 0.0;

                            if (pt !== null) {
                              totalPoints += pt * weight;
                              totalCredits += weight;
                            }

                            return (
                              <td 
                                key={subj.id}
                                className="py-1 px-1 border-r border-slate-200 text-center font-bold text-[9.5px]"
                              >
                                <span className={`inline-block px-1.5 py-0.2 rounded font-mono ${
                                  gradeStr === '4' ? 'bg-emerald-100 text-emerald-800 font-black' :
                                  gradeStr === '3.5' || gradeStr === '3' ? 'bg-blue-100 text-blue-800 font-bold' :
                                  gradeStr === '2.5' || gradeStr === '2' ? 'bg-amber-100 text-amber-800 font-semibold' :
                                  gradeStr === '1.5' || gradeStr === '1' ? 'bg-orange-100 text-orange-800 font-semibold' :
                                  gradeStr === '0' ? 'bg-rose-100 text-rose-800 font-bold' :
                                  'text-slate-400'
                                }`}>
                                  {gradeStr}
                                </span>
                              </td>
                            );
                          });

                          const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '-';

                          return (
                            <tr key={s.id} className="hover:bg-slate-50 leading-tight">
                              <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                                {s.rollNumber || sIdx + 1}
                              </td>
                              <td className="py-1 px-1 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                                {s.studentCode || '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900 truncate max-w-[140px] text-[10px]">
                                {s.prefix}{s.firstName} {s.lastName}
                              </td>
                              {subjGradeCols}
                              <td className="py-1 px-1 text-center font-mono font-black text-purple-950 bg-purple-50/70 text-[10px]">
                                {gpa}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* Footer */}
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-[9px]">
                          <td colSpan={3} className="py-1.5 px-2 border-r border-slate-300 text-right font-bold">
                            เกรดเฉลี่ยรายวิชา:
                          </td>
                          {assessmentGradeSubjects.map((subj) => {
                            let totalPts = 0;
                            let countPts = 0;
                            assessmentGradeStudents.forEach(s => {
                              const rawScore = getStudentGradeScore(s.id, subj);
                              const gStr = calculateThaiGrade(rawScore);
                              let pt: number | null = null;
                              if (gStr === '4') pt = 4.0;
                              else if (gStr === '3.5') pt = 3.5;
                              else if (gStr === '3') pt = 3.0;
                              else if (gStr === '2.5') pt = 2.5;
                              else if (gStr === '2') pt = 2.0;
                              else if (gStr === '1.5') pt = 1.5;
                              else if (gStr === '1') pt = 1.0;
                              else if (gStr === '0') pt = 0.0;
                              if (pt !== null) { totalPts += pt; countPts++; }
                            });
                            const avgPt = countPts > 0 ? (totalPts / countPts).toFixed(2) : '-';
                            return (
                              <td key={subj.id} className="py-1 px-0.5 border-r border-slate-300 text-center font-mono text-[9px] text-indigo-950 font-bold">
                                {avgPt}
                              </td>
                            );
                          })}
                          <td className="py-1 px-1 text-center font-mono text-[9px] text-purple-900 font-black">
                            {assessmentGradeStudents.length} คน
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Signatures */}
                  <div className="mt-6 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="space-y-0.5">
                      <p className="text-slate-600">ลงชื่อ ..................................................</p>
                      <p className="font-bold text-slate-800">
                        ({selectedAdvisor ? `${selectedAdvisor.prefix}${selectedAdvisor.firstName} ${selectedAdvisor.lastName}` : '................................................'})
                      </p>
                      <p className="text-slate-500 text-[9px]">ครูประจำชั้น</p>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-slate-600">ลงชื่อ ..................................................</p>
                      <p className="font-bold text-slate-800">
                        ({selectedAcademicHead ? `${selectedAcademicHead.prefix}${selectedAcademicHead.firstName} ${selectedAcademicHead.lastName}` : '................................................'})
                      </p>
                      <p className="text-slate-500 text-[9px]">หัวหน้าฝ่ายวิชาการ / ผู้ตรวจ</p>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-slate-600">ลงชื่อ ..................................................</p>
                      <p className="font-bold text-slate-800">
                        ({directorPersonnel?.position || directorDisplayName})
                      </p>
                      <p className="text-slate-500 text-[9px]">ผู้อำนวยการโรงเรียน</p>
                    </div>
                  </div>

                  {/* Visual A4 Page Boundary Line Indicator (On screen only) */}
                  <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-indigo-400 text-center text-[10px] font-bold text-indigo-700 no-print flex items-center justify-center gap-2 bg-indigo-50/60 py-1 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>--- สิ้นสุดความยาวกระดาษ A4 รายงานระดับผลการเรียน (เกรด) ---</span>
                  </div>
                </div>
              ) : (
                assessmentSubjectChunks.map((chunk, chunkIdx) => {
                  return (
                    <div 
                      key={chunkIdx}
                      className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
                      style={{ width: '210mm' }}
                    >
                      {/* A4 Sheet Header - Exactly 3 Lines */}
                      <div className="border-b-2 border-slate-800 pb-2 mb-3 text-center">
                        {/* Line 1: แบบรายงานผลการเรียนและการประเมินผลการเรียน */}
                        <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                          แบบรายงานผลการเรียนและคะแนนการวัดผล
                        </h1>

                        {/* Line 2: ชื่อโรงเรียน และสังกัดสำนักงาน (ฟอนต์เล็ก ห้ามเกินไปบรรทัดที่ 3) */}
                        <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
                          โรงเรียน{schoolInfo.schoolName || '...................................................'} {schoolInfo.affiliation ? `สังกัด${schoolInfo.affiliation}` : ''}
                        </div>

                        {/* Line 3: เดือน, ปีการศึกษา, ภาคเรียน, ชั้น */}
                        <div className="text-[11px] font-bold text-slate-800 mt-0.5">
                          ปีการศึกษา {selectedYear} | ภาคเรียนที่ {selectedSemester} | {getGradeCleanName(assessmentPopupGrade)}
                        </div>
                      </div>

                      {/* Compact A4 Portrait Matrix Table showing 5 Subjects per Sheet */}
                      <div className="overflow-x-auto border border-slate-300 rounded-sm">
                        <table className="w-full text-left text-[10px] border-collapse min-w-[680px]">
                          <thead>
                            {/* Row 1: Fixed Headers and 5 Subject Group Headers */}
                            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                              <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 text-center w-6 shrink-0 font-mono text-[9px]">
                                ที่
                              </th>
                              <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 text-center w-16 shrink-0 font-mono text-[9px]">
                                รหัสประจำตัว
                              </th>
                              <th rowSpan={2} className="py-1 px-2 border-r border-slate-300 w-36 shrink-0 truncate text-[10px]">
                                ชื่อ - นามสกุล
                              </th>

                              {/* Up to 5 Subjects */}
                              {chunk.map((subj) => (
                                <th 
                                  key={subj.id} 
                                  colSpan={3} 
                                  className="py-1 px-1 border-r border-slate-300 text-center bg-indigo-50/70 text-slate-900"
                                >
                                  <div className="font-bold text-[9.5px] truncate max-w-[110px] mx-auto text-indigo-950">
                                    {subj.code ? `${subj.code} ` : ''}{subj.name}
                                  </div>
                                  <div className="text-[8px] font-mono text-indigo-700 font-normal mt-0.5">
                                    อัตราส่วน ({subj.courseworkScore || 70}:{subj.examScore || 30})
                                  </div>
                                </th>
                              ))}
                            </tr>

                            {/* Row 2: Sub-columns for each subject (ระหว่างภาค, สอบ, รวม) */}
                            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300 text-[8.5px]">
                              {chunk.map((subj) => (
                                <React.Fragment key={subj.id}>
                                  <th className="py-1 px-0.5 border-r border-slate-300 text-center w-11 bg-slate-50 text-slate-700 font-medium">
                                    ระหว่างภาค
                                  </th>
                                  <th className="py-1 px-0.5 border-r border-slate-300 text-center w-9 bg-slate-50 text-slate-700 font-medium">
                                    สอบ
                                  </th>
                                  <th className="py-1 px-0.5 border-r border-slate-300 text-center w-9 bg-indigo-100/70 text-indigo-900 font-bold">
                                    รวม
                                  </th>
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-200 text-slate-800">
                            {assessmentGradeStudents.map((s, sIdx) => {
                              return (
                                <tr key={s.id} className="hover:bg-slate-50 leading-tight">
                                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                                    {s.rollNumber || sIdx + 1}
                                  </td>
                                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                                    {s.studentCode || '-'}
                                  </td>
                                  <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900 truncate max-w-[130px] text-[10px]">
                                    {s.prefix}{s.firstName} {s.lastName}
                                  </td>

                                  {/* Subject Score Columns */}
                                  {chunk.map((subj) => {
                                    const scores = getStudentScores(s.id, subj);
                                    return (
                                      <React.Fragment key={subj.id}>
                                        <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums text-slate-700">
                                          {scores.coursework}
                                        </td>
                                        <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums text-slate-700">
                                          {scores.exam}
                                        </td>
                                        <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-bold bg-indigo-50/40 text-indigo-950">
                                          {scores.total}
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>

                          {/* Footer with Class Average */}
                          <tfoot>
                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-[9px]">
                              <td colSpan={3} className="py-1 px-2 border-r border-slate-300 text-right font-bold">
                                คะแนนเฉลี่ย:
                              </td>
                              {chunk.map((subj) => {
                                let totalCw = 0, countCw = 0;
                                let totalEx = 0, countEx = 0;
                                let totalTt = 0, countTt = 0;

                                assessmentGradeStudents.forEach(s => {
                                  const sc = getStudentScores(s.id, subj);
                                  if (sc.numCoursework !== null) { totalCw += sc.numCoursework; countCw++; }
                                  if (sc.numExam !== null) { totalEx += sc.numExam; countEx++; }
                                  if (sc.numTotal !== null) { totalTt += sc.numTotal; countTt++; }
                                });

                                const avgCw = countCw > 0 ? (totalCw / countCw).toFixed(1) : '-';
                                const avgEx = countEx > 0 ? (totalEx / countEx).toFixed(1) : '-';
                                const avgTt = countTt > 0 ? (totalTt / countTt).toFixed(1) : '-';

                                return (
                                  <React.Fragment key={subj.id}>
                                    <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono font-medium text-slate-700">
                                      {avgCw}
                                    </td>
                                    <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono font-medium text-slate-700">
                                      {avgEx}
                                    </td>
                                    <td className="py-1 px-0.5 border-r border-slate-300 text-center font-mono font-bold bg-indigo-100/60 text-indigo-950">
                                      {avgTt}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Signatures */}
                      <div className="mt-6 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="space-y-0.5">
                          <p className="text-slate-600">ลงชื่อ ..................................................</p>
                          <p className="font-bold text-slate-800">
                            ({getSubjectTeacherName(chunk, personnel, selectedAdvisor)})
                          </p>
                          <p className="text-slate-500 text-[9px]">ครูผู้สอน</p>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-slate-600">ลงชื่อ ..................................................</p>
                          <p className="font-bold text-slate-800">
                            ({selectedAcademicHead ? `${selectedAcademicHead.prefix}${selectedAcademicHead.firstName} ${selectedAcademicHead.lastName}` : '................................................'})
                          </p>
                          <p className="text-slate-500 text-[9px]">หัวหน้าฝ่ายวิชาการ / ผู้ตรวจ</p>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-slate-600">ลงชื่อ ..................................................</p>
                          <p className="font-bold text-slate-800">
                            ({directorPersonnel?.position || directorDisplayName})
                          </p>
                          <p className="text-slate-500 text-[9px]">ผู้อำนวยการโรงเรียน</p>
                        </div>
                      </div>

                      {/* Visual A4 Page Boundary Line Indicator (On screen only) */}
                      <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-indigo-400 text-center text-[10px] font-bold text-indigo-700 no-print flex items-center justify-center gap-2 bg-indigo-50/60 py-1 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>--- สิ้นสุดความยาวกระดาษ A4 หน้าที่ {chunkIdx + 1} (297 mm) ---</span>
                      </div>
                    </div>
                  );
                })
              )}

            </div>

            {/* Modal Footer (No-Print) */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 rounded-b-2xl flex items-center justify-between gap-3 shrink-0 no-print">
              <span className="text-xs text-slate-500">
                พร้อมสำหรับการดาวน์โหลดเอกสาร PDF (ขนาด A4 แนวตั้ง 5 วิชาต่อแผ่น)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssessmentPopupGrade(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  title="ดาวน์โหลด PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 
        ========================================================================
        POP-UP MODAL: (3)รายงาน - 3 Assessment Booklets (A4 Portrait & PDF Download)
        1) การอ่าน คิดวิเคราะห์ และเขียน (4 แผ่น/ส่วน: การอ่าน, คิดวิเคราะห์, เขียน, สรุปปริมาณ-คุณภาพ)
        2) คุณลักษณะอันพึงประสงค์ (สรุป 8 ข้อหลักทั้งห้อง หรือ รายบุคคลครบทุกข้อย่อย)
        3) สมรรถนะสำคัญ 5 ด้าน
        ========================================================================
      */}
      {threeReportsPopupGrade && (
        <ThreeReportsModal
          isOpen={!!threeReportsPopupGrade}
          onClose={() => setThreeReportsPopupGrade(null)}
          grade={threeReportsPopupGrade}
          selectedYear={selectedYear}
          selectedSemester={selectedSemester}
          students={students}
          personnel={personnel}
          schoolInfo={schoolInfo}
          grades={effectiveGrades}
          subjects={subjects}
          selectedAdvisorId={selectedAdvisorId}
          setSelectedAdvisorId={setSelectedAdvisorId}
          selectedAcademicHeadId={selectedAcademicHeadId}
          setSelectedAcademicHeadId={setSelectedAcademicHeadId}
          directorDisplayName={directorDisplayName}
          onShowToast={onShowToast}
        />
      )}

      {/* 
        ========================================================================
        POP-UP MODAL: Milk & Teeth Reports (True A4 Portrait & PDF Download)
        (ดึงจากหน้าธุรการตรงดาวน์โหลด ให้เหมือนหน้าธุรการตรงดาวน์โหลดเลย)
        1) แบบบันทึกสรุปการดื่มนมโรงเรียน
        2) แบบบันทึกสรุปการแปรงฟันหลังอาหาร
        ========================================================================
      */}
      {milkTeethModal && (() => {
        const activeMonthGroup = milkTeethMonthGroups[milkTeethSelectedMonthIdx] || milkTeethMonthGroups[0];
        const monthDays = activeMonthGroup ? activeMonthGroup.days : [];
        const targetGrade = milkTeethModal.grade;
        const reportType = milkTeethModal.type;

        const targetStudents = students
          .filter(s => s.gradeLevel === targetGrade)
          .sort((a, b) => {
            if (a.rollNumber !== undefined && b.rollNumber !== undefined) return a.rollNumber - b.rollNumber;
            return (a.studentCode || '').localeCompare(b.studentCode || '');
          });

        const advisor = selectedAdvisor || personnel.find(p => p.advisorGrade === targetGrade);
        const advisorDisplayName = advisor ? `${advisor.prefix || ''}${advisor.firstName || ''} ${advisor.lastName || ''}`.trim() : '...........................................................';

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto a4-modal-overlay">
            <div className="bg-slate-100 rounded-2xl w-full max-w-[980px] max-h-[96vh] flex flex-col shadow-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150 my-auto a4-modal-content">
              
              {/* Modal Control Header (Hidden on print) */}
              <div className="px-4 py-3 bg-white border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                    reportType === 'milk' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                  }`}>
                    {reportType === 'milk' ? '🥛' : '🪥'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>ตัวอย่างรายงาน A4 ({reportType === 'milk' ? 'การดื่มนมโรงเรียน' : 'การแปรงฟันหลังอาหาร'})</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                        reportType === 'milk' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-sky-100 text-sky-800 border-sky-200'
                      }`}>
                        {getGradeCleanName(targetGrade)}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      แสดงข้อมูล 1 เดือนต่อ 1 หน้ากระดาษ A4 แนวตั้ง (ตามวันเรียน 100 วันที่กำหนด) | นักเรียน {targetStudents.length} คน
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Action Download / Print Button */}
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                      onShowToast('info', 'กำลังดาวน์โหลด / พิมพ์ PDF 🖨️', `บันทึก/พิมพ์รายงาน ${reportType === 'milk' ? 'การดื่มนม' : 'การแปรงฟัน'} ประจำ${activeMonthGroup?.monthTitle || ''}`);
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="ดาวน์โหลด PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลด</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMilkTeethModal(null)}
                    className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
                    title="ปิด"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Personnel Signature Selectors Bar (No-Print) */}
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Select Homeroom Teacher */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700 whitespace-nowrap">ครูประจำชั้น:</span>
                    <select
                      value={selectedAdvisorId}
                      onChange={(e) => setSelectedAdvisorId(e.target.value)}
                      className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20 max-w-[210px] truncate"
                    >
                      <option value="">-- อัตโนมัติ (ครูประจำชั้นของห้อง) --</option>
                      {personnel.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.prefix}{p.firstName} {p.lastName} {p.advisorGrade ? `(${p.advisorGrade})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <span>ผู้อำนวยการ:</span>
                  <strong className="text-slate-800 font-bold">{directorDisplayName}</strong>
                </div>
              </div>

              {/* Modal Body: A4 Paper Preview Container (Render all months continuously) */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-8 bg-slate-200/70 flex-1">
                {milkTeethMonthGroups.map((group, groupIdx) => {
                  const monthDays = group.days;

                  return (
                    <div 
                      key={group.monthKey}
                      id={`milk-teeth-pdf-sheet-${group.monthKey}`} 
                      className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-6 sm:p-8 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
                      style={{ width: '210mm' }}
                    >
                      {/* Header */}
                      <div className="text-center space-y-1 pb-3 border-b-2 border-slate-800">
                        <h2 className="text-base sm:text-lg font-black text-slate-900">
                          {schoolInfo?.schoolName || 'โรงเรียนวัดผลประเมินพัฒนาการ'}
                        </h2>
                        <h3 className="text-sm font-bold text-slate-800">
                          {reportType === 'milk' ? 'แบบบันทึกสรุปการดื่มนมโรงเรียน' : 'แบบบันทึกสรุปการแปรงฟันหลังอาหาร'}
                        </h3>
                        <p className="text-xs font-semibold text-slate-600">
                          {group.monthTitle} • ภาคเรียนที่ {selectedSemester} ปีการศึกษา {selectedYear} • ระดับชั้น {getGradeCleanName(targetGrade)}
                        </p>
                      </div>

                      {/* Matrix Table */}
                      <div className="overflow-x-auto mt-4">
                        <table className="w-full text-left text-[11px] border-collapse border border-slate-400">
                          <thead>
                            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
                              <th className="py-2 px-1.5 text-center border-r border-slate-400 w-9">เลขที่</th>
                              <th className="py-2 px-2 border-r border-slate-400 min-w-[130px]">ชื่อ - นามสกุล</th>
                              {monthDays.map((dayItem) => {
                                const dateNum = dayItem.date.split('-')[2] || '';
                                return (
                                  <th key={dayItem.date} className="py-2 px-1 text-center border-r border-slate-400 font-mono text-[10px] min-w-[22px]" title={dayItem.label}>
                                    {dateNum}
                                  </th>
                                );
                              })}
                              <th className="py-2 px-1.5 text-center w-12 font-bold">สรุป</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-300">
                            {targetStudents.length === 0 ? (
                              <tr>
                                <td colSpan={monthDays.length + 3} className="py-8 text-center text-slate-400 font-medium">
                                  ไม่พบรายชื่อนักเรียนในชั้น {targetGrade}
                                </td>
                              </tr>
                            ) : (
                              targetStudents.map((st, idx) => {
                                let checkedCount = 0;

                                return (
                                  <tr key={st.id} className="even:bg-slate-50/50">
                                    <td className="py-1.5 px-1 text-center border-r border-slate-300 font-mono font-semibold">
                                      {st.rollNumber ?? (idx + 1)}
                                    </td>
                                    <td className="py-1.5 px-2 border-r border-slate-300 font-semibold whitespace-nowrap">
                                      {st.prefix}{st.firstName} {st.lastName}
                                    </td>
                                    {monthDays.map((dayItem) => {
                                      const rec = effectiveDailyTracking.find(d => d.date === dayItem.date && d.studentId === st.id);
                                      const milkStatus = rec?.milkStatus;
                                      const toothStatus = rec?.toothBrushStatus;

                                      let symbol = '-';
                                      let symbolClass = 'text-slate-400 font-semibold text-xs';

                                      if (reportType === 'milk') {
                                        if (milkStatus === 'แพ้นม') {
                                          symbol = 'พ';
                                          symbolClass = 'text-amber-600 font-black text-xs';
                                          checkedCount++;
                                        } else if (milkStatus === 'ดื่มครบ') {
                                          symbol = '✓';
                                          symbolClass = 'text-emerald-700 font-extrabold text-xs';
                                          checkedCount++;
                                        } else {
                                          symbol = '✕';
                                          symbolClass = 'text-rose-600 font-bold text-xs';
                                        }
                                      } else {
                                        if (toothStatus === 'แปรงฟันแล้ว') {
                                          symbol = '✓';
                                          symbolClass = 'text-emerald-700 font-extrabold text-xs';
                                          checkedCount++;
                                        } else {
                                          symbol = '✕';
                                          symbolClass = 'text-rose-600 font-bold text-xs';
                                        }
                                      }

                                      return (
                                        <td key={dayItem.date} className="py-1.5 px-1 text-center border-r border-slate-300 font-bold">
                                          <span className={symbolClass}>{symbol}</span>
                                        </td>
                                      );
                                    })}
                                    <td className="py-1.5 px-1 text-center font-bold text-slate-900 font-mono">
                                      {checkedCount}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Official Signatures Section (Matching Module1ClassroomAdmin) */}
                      <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-slate-800 print:pt-6">
                        <div className="space-y-8">
                          <div>
                            ลงชื่อ ...........................................................
                            <div className="mt-1 font-semibold">( {advisor ? `${advisor.prefix || ''}${advisor.firstName || ''} ${advisor.lastName || ''}`.trim() : '...........................................................'} )</div>
                            <div className="text-slate-500 mt-0.5">ครูประจำชั้น / ครูผู้บันทึก</div>
                          </div>
                        </div>
                        <div className="space-y-8">
                          <div>
                            ลงชื่อ ...........................................................
                            <div className="mt-1 font-semibold">( {directorPersonnel?.position || directorDisplayName} )</div>
                            <div className="text-slate-500 mt-0.5">ผู้อำนวยการโรงเรียน</div>
                          </div>
                        </div>
                      </div>

                      {/* Visual Page Break line indicator for screen */}
                      <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-sky-400 text-center text-[10px] font-bold text-sky-700 no-print flex items-center justify-center gap-2 bg-sky-50/60 py-1 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                        <span>--- สิ้นสุดความยาวกระดาษ A4 หน้าที่ {groupIdx + 1} ({group.monthTitle}) (297 mm) ---</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer (No-Print) */}
              <div className="px-4 py-3 bg-white border-t border-slate-200 rounded-b-2xl flex items-center justify-between gap-3 shrink-0 no-print">
                <span className="text-xs text-slate-500">
                  พร้อมสำหรับการดาวน์โหลดเอกสาร PDF (ขนาด A4 แนวตั้ง 1 เดือนต่อ 1 แผ่น)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMilkTeethModal(null)}
                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                      onShowToast('info', 'กำลังดาวน์โหลด / พิมพ์ PDF 🖨️', `บันทึก/พิมพ์รายงาน ${reportType === 'milk' ? 'การดื่มนม' : 'การแปรงฟัน'} ประจำ${activeMonthGroup?.monthTitle || ''}`);
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="ดาวน์โหลด PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลด</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Modal: View Full Student Details (เมื่อกดไอคอนตา) */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                  {viewingStudent.gradeLevel}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {viewingStudent.prefix}{viewingStudent.firstName} {viewingStudent.lastName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    รหัสประจำตัว: {viewingStudent.studentCode || '-'} | เลขที่: {viewingStudent.rollNumber || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content: All Details */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Photo & Basic Bio */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b border-slate-100">
                {viewingStudent.photoUrl ? (
                  <img
                    src={viewingStudent.photoUrl}
                    alt="รูปนักเรียน"
                    className="w-24 h-28 object-cover rounded-xl border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="w-24 h-28 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <Users className="w-8 h-8" />
                    <span className="text-[10px] mt-1">ไม่มีรูปถ่าย</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1 w-full">
                  <div>
                    <span className="text-slate-400 block">ชื่อเล่น:</span>
                    <span className="font-semibold text-slate-700">{viewingStudent.nickname || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">เพศ:</span>
                    <span className="font-semibold text-slate-700">{viewingStudent.gender || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">วันเกิด:</span>
                    <span className="font-semibold text-slate-700">{viewingStudent.birthDate || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">อายุ:</span>
                    <span className="font-semibold text-slate-700">
                      {viewingStudent.age !== undefined && viewingStudent.age !== null ? `${viewingStudent.age} ปี` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">โรคประจำตัว:</span>
                    <span className="font-semibold text-slate-700">{viewingStudent.chronicDisease || 'ไม่มี'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">เงินมา รร/วัน:</span>
                    <span className="font-semibold text-emerald-600">
                      {viewingStudent.dailyAllowance !== undefined && viewingStudent.dailyAllowance !== null ? `${viewingStudent.dailyAllowance} บาท` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Family & Guardian Information */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 text-xs flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>ข้อมูลครอบครัวและผู้ปกครอง</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block">ชื่อบิดา:</span>
                    <span className="font-semibold text-slate-700">{viewingStudent.fatherName || '-'}</span>
                    {viewingStudent.fatherOccupation && (
                      <span className="text-slate-500 text-[11px] block">อาชีพ: {viewingStudent.fatherOccupation}</span>
                    )}
                    {viewingStudent.fatherPhone && (
                      <span className="text-slate-500 text-[11px] block">โทร: {viewingStudent.fatherPhone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block">ชื่อมารดา:</span>
                    <span className="font-semibold text-slate-700">{viewingStudent.motherName || '-'}</span>
                    {viewingStudent.motherOccupation && (
                      <span className="text-slate-500 text-[11px] block">อาชีพ: {viewingStudent.motherOccupation}</span>
                    )}
                    {viewingStudent.motherPhone && (
                      <span className="text-slate-500 text-[11px] block">โทร: {viewingStudent.motherPhone}</span>
                    )}
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-400 block">ผู้ปกครองหลัก (ความสัมพันธ์: {viewingStudent.guardianRelation || 'บิดา/มารดา'}):</span>
                    <span className="font-semibold text-slate-800">
                      {viewingStudent.guardianName || viewingStudent.fatherName || viewingStudent.motherName || '-'}
                    </span>
                    {viewingStudent.guardianPhone && (
                      <span className="text-slate-600 text-[11px] block font-mono">
                        เบอร์ติดต่อ: {viewingStudent.guardianPhone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Address & Living condition */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 text-xs flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                  <span>ที่อยู่และการเดินทาง</span>
                </h4>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div>
                    <span className="text-slate-400 block">ที่อยู่ตามทะเบียน/ปัจจุบัน:</span>
                    <span className="font-medium text-slate-700">{viewingStudent.address || viewingStudent.guardianAddress || '-'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-400 block">การเดินทางมา รร:</span>
                      <span className="font-medium text-slate-700">{viewingStudent.travelMethod || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">สถานะที่อยู่อาศัย:</span>
                      <span className="font-medium text-slate-700">{viewingStudent.housingStatus || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        POP-UP MODAL: PhorPhor 6 (ปพ.6) Report Booklet
        ========================================================================
      */}
      {selectedPhorPhor6Student && (
        <PhorPhor6Modal
          student={selectedPhorPhor6Student}
          grade={selectedGrade || selectedPhorPhor6Student.gradeLevel}
          academicYear={selectedYear}
          semester={selectedSemester}
          schoolInfo={schoolInfo}
          personnel={personnel}
          subjects={effectiveSubjects}
          grades={effectiveGrades}
          attendance={attendance}
          dailyTracking={effectiveDailyTracking}
          savings={savings}
          onClose={() => setSelectedPhorPhor6Student(null)}
          onShowToast={onShowToast}
          onOpenLightbox={onOpenLightbox}
        />
      )}

    </div>
  );
};
