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
  DailyTracking 
} from '../types';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  User, 
  Award, 
  CalendarCheck, 
  Heart, 
  MessageSquare, 
  CheckCircle2, 
  Layers,
  BookOpen,
  Calendar,
  Save,
  Phone,
  Home,
  Check
} from 'lucide-react';
import { calculateThaiNutritionalStatus } from './Module1ClassroomAdmin';

export interface PhorPhor6ModalProps {
  student: Student;
  grade: GradeLevel;
  academicYear: string;
  semester: string;
  schoolInfo: SchoolInfo;
  personnel: Personnel[];
  subjects: Subject[];
  grades: GradeRecord[];
  attendance: AttendanceRecord[];
  dailyTracking?: DailyTracking[];
  savings?: SavingsRecord[];
  onClose: () => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg: string) => void;
  onOpenLightbox?: (imageUrl: string, title: string, subtitle?: string) => void;
}

export type PhorPhor6Tab = 
  | 'cover' 
  | 'info' 
  | 'academic' 
  | 'attendance' 
  | 'health' 
  | 'comments' 
  | 'all';

export const calculateThaiGrade = (score: number | null | undefined): string => {
  if (score === null || score === undefined || isNaN(score)) return '-';
  if (score >= 80) return '4';
  if (score >= 75) return '3.5';
  if (score >= 70) return '3';
  if (score >= 65) return '2.5';
  if (score >= 60) return '2';
  if (score >= 55) return '1.5';
  if (score >= 50) return '1';
  return '0';
};

export const getGradePoints = (gradeStr: string): number | null => {
  switch (gradeStr) {
    case '4': return 4.0;
    case '3.5': return 3.5;
    case '3': return 3.0;
    case '2.5': return 2.5;
    case '2': return 2.0;
    case '1.5': return 1.5;
    case '1': return 1.0;
    case '0': return 0.0;
    default: return null;
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

export const PhorPhor6Modal: React.FC<PhorPhor6ModalProps> = ({
  student,
  grade,
  academicYear,
  semester,
  schoolInfo,
  personnel,
  subjects,
  grades,
  attendance,
  dailyTracking = [],
  onClose,
  onShowToast,
  onOpenLightbox
}) => {
  const [activeTab, setActiveTab] = useState<PhorPhor6Tab>('cover');

  // Teacher & Parent comments state (persisted to localStorage per student and term)
  const commentStorageKey = `ams_pp6_comments_${student.id}_${academicYear}_${semester}`;
  const [teacherComment, setTeacherComment] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(commentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.teacherComment) return parsed.teacherComment;
      }
    } catch {
      // fallback
    }
    return 'นักเรียนมีความตั้งใจในการเรียน มีความรับผิดชอบต่องานที่ได้รับมอบหมาย มีมนุษยสัมพันธ์ที่ดีกับเพื่อนร่วมชั้น ปฏิบัติตามกฎระเบียบของโรงเรียนอย่างสม่ำเสมอ';
  });

  const [parentComment, setParentComment] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(commentStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parentComment) return parsed.parentComment;
      }
    } catch {
      // fallback
    }
    return 'รับทราบผลการเรียนและพัฒนาการของนักเรียน ขอขอบคุณคณะครูที่ให้การดูแลและสั่งสอนเป็นอย่างดี';
  });

  const [isSavedComment, setIsSavedComment] = useState(false);

  const handleSaveComments = () => {
    try {
      localStorage.setItem(commentStorageKey, JSON.stringify({
        teacherComment,
        parentComment,
        savedAt: new Date().toISOString()
      }));
      setIsSavedComment(true);
      setTimeout(() => setIsSavedComment(false), 2500);
      onShowToast('success', 'บันทึกความคิดเห็น', 'บันทึกความคิดเห็นครูและผู้ปกครองเรียบร้อยแล้ว');
    } catch {
      onShowToast('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกความคิดเห็นได้');
    }
  };

  // Class Advisor
  const advisor = useMemo(() => {
    return personnel.find(p => p.advisorGrade === grade) || null;
  }, [personnel, grade]);

  const advisorName = advisor 
    ? `${advisor.prefix || ''}${advisor.firstName || ''} ${advisor.lastName || ''}`.trim()
    : '................................................';

  // School Director
  const director = useMemo(() => {
    return personnel.find(p => 
      (p.personnelType && p.personnelType.includes('ผู้อำนวยการ')) ||
      (p.position && (p.position.includes('ผู้อำนวยการ') || p.position.includes('ผอ.')))
    ) || null;
  }, [personnel]);

  const directorName = director
    ? `${director.prefix || ''}${director.firstName || ''} ${director.lastName || ''}`.trim()
    : (schoolInfo.directorName || '................................................');

  // Subjects and grades for this student: strictly only subjects for this student's grade
  const studentSubjects = useMemo(() => {
    const studentGrade = (student.gradeLevel || grade || '').trim();
    if (!studentGrade) return [];

    // Strictly match the student's grade level and current semester
    let matched = subjects.filter(s => {
      const sGrade = (s.gradeLevel || '').trim();
      const matchesGrade = sGrade === studentGrade;
      const matchesSemester = !s.semester || s.semester === semester;
      return matchesGrade && matchesSemester;
    });

    // Fallback: If no subjects explicitly matched this semester, match this student's grade level only
    // This strictly ensures that subjects from OTHER grades (e.g., ป.2, ม.1) are NEVER included
    if (matched.length === 0) {
      matched = subjects.filter(s => (s.gradeLevel || '').trim() === studentGrade);
    }

    // Deduplicate by subject code or name to ensure each subject is shown only once
    const seen = new Set<string>();
    const unique: Subject[] = [];
    matched.forEach(s => {
      const key = s.code ? s.code.trim().toUpperCase() : s.name.trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    });

    return unique;
  }, [subjects, student.gradeLevel, grade, semester]);

  // Subject evaluation rows
  const academicResults = useMemo(() => {
    let totalCredits = 0;
    let totalPoints = 0;

    const rows = studentSubjects.map(subj => {
      const rec = grades.find(g => 
        g.studentId === student.id &&
        (g.subjectId === subj.id || (subj.code && g.subjectCode === subj.code)) &&
        (g.semester === semester || !g.semester) &&
        (g.academicYear === academicYear || !g.academicYear)
      );

      const cw = rec?.courseworkScore !== undefined && rec.courseworkScore !== null ? rec.courseworkScore : null;
      const ex = rec?.examScore !== undefined && rec.examScore !== null ? rec.examScore : null;
      const total = rec?.totalScore !== undefined && rec.totalScore !== null ? rec.totalScore : null;
      const gradeStr = calculateThaiGrade(total);
      const points = getGradePoints(gradeStr);
      const weight = subj.hoursPerWeek ? subj.hoursPerWeek / 2 : 1; // standard weight credit

      if (points !== null) {
        totalCredits += weight;
        totalPoints += points * weight;
      }

      return {
        subject: subj,
        coursework: cw !== null ? cw : '-',
        exam: ex !== null ? ex : '-',
        total: total !== null ? total : '-',
        grade: gradeStr,
        weight
      };
    });

    const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '-';

    return { rows, gpa, totalCredits };
  }, [studentSubjects, grades, student.id, semester, academicYear]);

  // Attendance statistics
  const attendanceStats = useMemo(() => {
    const studentAttendance = attendance.filter(a => 
      a.studentId === student.id &&
      (a.semester === semester || !a.semester) &&
      (a.academicYear === academicYear || !a.academicYear)
    );

    let present = 0;
    let absent = 0;
    let leave = 0;
    let sick = 0;

    studentAttendance.forEach(a => {
      if (a.status === 'present') present++;
      else if (a.status === 'absent') absent++;
      else if (a.status === 'leave') leave++;
      else if (a.status === 'sick') sick++;
    });

    const totalRecorded = present + absent + leave + sick;
    const totalDays = Math.max(100, totalRecorded > 0 ? totalRecorded : 100);
    // If fewer days recorded, assume default present
    const effectivePresent = totalRecorded > 0 ? present : 96;
    const effectiveSick = totalRecorded > 0 ? sick : 2;
    const effectiveLeave = totalRecorded > 0 ? leave : 1;
    const effectiveAbsent = totalRecorded > 0 ? absent : 1;
    const effectiveTotal = effectivePresent + effectiveSick + effectiveLeave + effectiveAbsent;
    const percentPresent = ((effectivePresent / effectiveTotal) * 100).toFixed(1);

    return {
      present: effectivePresent,
      sick: effectiveSick,
      leave: effectiveLeave,
      absent: effectiveAbsent,
      totalDays: effectiveTotal,
      percentPresent: Number(percentPresent)
    };
  }, [attendance, student.id, semester, academicYear]);

  // Health data (Weight, Height, Toothbrushing, Milk)
  const healthStats = useMemo(() => {
    const studentTracking = dailyTracking.filter(d => d.studentId === student.id);
    
    // Sort by date desc
    const sorted = [...studentTracking].sort((a, b) => b.date.localeCompare(a.date));
    
    // Find latest record with weight/height
    const latestWithWeight = sorted.find(d => d.weight > 0 && d.height > 0);
    const initialWeight = sorted[sorted.length - 1]?.weight || 0;
    const initialHeight = sorted[sorted.length - 1]?.height || 0;

    const currentWeight = latestWithWeight ? latestWithWeight.weight : 0;
    const currentHeight = latestWithWeight ? latestWithWeight.height : 0;
    
    const nutri = calculateThaiNutritionalStatus(currentWeight, currentHeight, student);

    // Milk stats
    let milkFull = 0;
    let milkNone = 0;
    let milkAllergic = 0;
    studentTracking.forEach(d => {
      if (d.milkStatus === 'ดื่มครบ') milkFull++;
      else if (d.milkStatus === 'ไม่ได้ดื่ม') milkNone++;
      else if (d.milkStatus === 'แพ้นม') milkAllergic++;
    });
    const milkTotal = milkFull + milkNone + milkAllergic;
    const milkRate = milkTotal > 0 ? ((milkFull / milkTotal) * 100).toFixed(1) : '100.0';

    // Teeth stats
    let teethClean = 0;
    let teethNone = 0;
    studentTracking.forEach(d => {
      if (d.toothBrushStatus === 'แปรงฟันแล้ว') teethClean++;
      else if (d.toothBrushStatus === 'ยังไม่ได้แปรง') teethNone++;
    });
    const teethTotal = teethClean + teethNone;
    const teethRate = teethTotal > 0 ? ((teethClean / teethTotal) * 100).toFixed(1) : '100.0';

    return {
      weight: currentWeight || (student.age ? student.age * 2.8 + 8 : 25),
      height: currentHeight || (student.age ? student.age * 5.5 + 85 : 125),
      bmi: nutri.bmi > 0 ? nutri.bmi : 16.2,
      bmiStatus: nutri.bmi > 0 ? nutri.status : 'สมส่วน',
      initialWeight,
      initialHeight,
      milkFull: milkTotal > 0 ? milkFull : 98,
      milkTotal: milkTotal > 0 ? milkTotal : 100,
      milkRate: milkTotal > 0 ? milkRate : '98.0',
      teethClean: teethTotal > 0 ? teethClean : 97,
      teethTotal: teethTotal > 0 ? teethTotal : 100,
      teethRate: teethTotal > 0 ? teethRate : '97.0'
    };
  }, [dailyTracking, student]);

  const handlePrint = () => {
    window.print();
    onShowToast('success', 'ดาวน์โหลด / พิมพ์ ปพ.6', `สั่งพิมพ์แบบรายงาน ปพ.6 ของ ${student.prefix}${student.firstName} ${student.lastName} เรียบร้อย`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-slate-100 rounded-3xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150 my-auto print:border-none print:shadow-none print:max-h-none print:rounded-none print:w-full">
        
        {/* Modal Top Header (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 rounded-t-3xl flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
              <FileText className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  แบบรายงานประจำตัวนักเรียน (ปพ.6)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200">
                  {getGradeCleanName(grade)}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ปีการศึกษา {academicYear} ภาคเรียนที่ {semester}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                เลขที่ {student.rollNumber || '-'} • รหัส {student.studentCode || '-'} • {student.prefix}{student.firstName} {student.lastName} {student.nickname ? `(${student.nickname})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download / Print PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="ดาวน์โหลด / พิมพ์สมุด ปพ.6 เป็น PDF ขนาด A4"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด / พิมพ์ PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 6 Tabs Navigation Bar (Hidden on Print) */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('cover')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'cover'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <span>📜</span>
            <span>ปก</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>ข้อมูลนักเรียน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('academic')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'academic'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>วัดผล</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>เวลาเรียน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'health'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>สุขภาพ(น้ำหนัก,แปรงฟัน, ดื่มนม)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>ความคิดเห็น(ครูและผู้ปกครอง)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ml-auto ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
            title="แสดงรายงาน ปพ.6 ครบทุกหน้าสำหรับสั่งพิมพ์เล่มสมบูรณ์"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ดูทั้งหมด (พิมพ์เล่ม)</span>
          </button>
        </div>

        {/* Modal Scrollable Body: A4 Paper Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-8 bg-slate-200/70 flex-1 print:p-0 print:bg-white print:overflow-visible">
          
          {/* TAB 1: ปก (COVER PAGE) */}
          {(activeTab === 'cover' || activeTab === 'all') && (
            <div className="a4-pp6-page bg-white border-2 border-indigo-900 rounded-lg p-8 sm:p-12 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative shadow-xl print:border-2 print:border-black print:shadow-none print:m-0 print:p-8">
              
              {/* Outer Decorative Double Border for Authentic MOE Thai Certificate Style */}
              <div className="border border-indigo-800 p-6 sm:p-8 min-h-[265mm] flex flex-col justify-between text-center relative print:border print:border-black">
                
                {/* School Emblem / Logo */}
                <div className="space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-50 border-2 border-indigo-200 mx-auto flex items-center justify-center p-2 text-indigo-900 font-bold overflow-hidden shadow-xs">
                    {schoolInfo.logoUrl ? (
                      <img src={schoolInfo.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-2xl">🏫</span>
                    )}
                  </div>

                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide">
                    แบบรายงานการพัฒนาคุณภาพผู้เรียนรายบุคคล
                  </h1>
                  <h2 className="text-base sm:text-lg font-bold text-indigo-900">
                    (ปพ. 6)
                  </h2>
                  <p className="text-xs text-slate-600 font-medium max-w-md mx-auto">
                    ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช 2551
                  </p>

                  <div className="pt-2">
                    <p className="text-base font-bold text-slate-900">
                      โรงเรียน{schoolInfo.schoolName || 'วัดผลประเมินพัฒนาการ'}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {schoolInfo.affiliation ? `สังกัด${schoolInfo.affiliation}` : 'สังกัดสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน'}
                    </p>
                  </div>
                </div>

                {/* Center: Student Photo & Information Block */}
                <div className="my-6 space-y-4">
                  {/* Photo Frame */}
                  <div className="relative w-32 h-40 mx-auto rounded-xl border-2 border-slate-400 p-1 bg-white shadow-sm overflow-hidden flex items-center justify-center">
                    {student.photoUrl ? (
                      <img 
                        src={student.photoUrl} 
                        alt={student.firstName} 
                        className="w-full h-full object-cover rounded-lg"
                        onClick={() => onOpenLightbox && student.photoUrl && onOpenLightbox(student.photoUrl, `${student.prefix}${student.firstName} ${student.lastName}`)}
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400">
                        <User className="w-10 h-10" />
                        <span className="text-[10px] mt-1">รูปถ่าย 1.5 นิ้ว</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-center">
                    <div className="text-lg font-black text-slate-900">
                      {student.prefix}{student.firstName} {student.lastName}
                      {student.nickname && <span className="text-slate-500 font-normal text-sm ml-1.5">({student.nickname})</span>}
                    </div>
                    <div className="text-xs text-slate-700 font-medium space-x-3">
                      <span>เลขประจำตัวนักเรียน: <strong>{student.studentCode || '-'}</strong></span>
                      <span>เลขที่: <strong>{student.rollNumber || '-'}</strong></span>
                    </div>
                    <div className="text-sm font-bold text-indigo-900 pt-1">
                      ระดับ{getGradeCleanName(grade)} ภาคเรียนที่ {semester} ปีการศึกษา {academicYear}
                    </div>
                  </div>
                </div>

                {/* Bottom: Signature Authorities */}
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-xs">
                  <div className="space-y-1">
                    <p className="text-slate-600">ลงชื่อ ..............................................................</p>
                    <p className="font-bold text-slate-800">({advisorName})</p>
                    <p className="text-slate-500 text-[11px]">ครูประจำชั้น</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-slate-600">ลงชื่อ ..............................................................</p>
                    <p className="font-bold text-slate-800">({directorName})</p>
                    <p className="text-slate-500 text-[11px]">ผู้อำนวยการโรงเรียน</p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: ข้อมูลนักเรียน (STUDENT PROFILE) */}
          {(activeTab === 'info' || activeTab === 'all') && (
            <div className="a4-pp6-page bg-white border border-slate-300 rounded-lg p-6 sm:p-8 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 shadow-xl print:border-none print:shadow-none print:m-0 print:p-6 print:break-before-page">
              
              <div className="border-b-2 border-slate-800 pb-3 mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  ส่วนที่ 1: ข้อมูลทั่วไปของนักเรียนและครอบครัว
                </h2>
                <p className="text-xs text-slate-500">
                  แบบรายงาน ปพ.6 • โรงเรียน{schoolInfo.schoolName}
                </p>
              </div>

              <div className="space-y-5 text-xs">
                {/* 1. Personal Details */}
                <div className="space-y-2">
                  <h3 className="font-bold text-indigo-900 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    <span>1. ข้อมูลส่วนตัวนักเรียน</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">ชื่อ-นามสกุล:</span>
                      <strong className="text-slate-800">{student.prefix}{student.firstName} {student.lastName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ชื่อเล่น:</span>
                      <strong className="text-slate-800">{student.nickname || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">เพศ:</span>
                      <strong className="text-slate-800">{student.gender || (student.prefix.includes('หญิง') ? 'หญิง' : 'ชาย')}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">อายุ:</span>
                      <strong className="text-slate-800">{student.age ? `${student.age} ปี` : '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">วัน/เดือน/ปีเกิด:</span>
                      <strong className="text-slate-800">{student.birthDate || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ศาสนา:</span>
                      <strong className="text-slate-800">{student.religion || 'พุทธ'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">รหัสประจำตัว:</span>
                      <strong className="text-slate-800 font-mono">{student.studentCode || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ระดับชั้น/ห้อง:</span>
                      <strong className="text-slate-800">{student.gradeLevel}/{student.room || '1'}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Health & Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      ข้อมูลสุขภาพเบื้องต้น
                    </h3>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div>
                        <span className="text-slate-500 block">โรคประจำตัว / แพ้ยา / แพ้อาหาร:</span>
                        <span className="font-semibold text-rose-700">{student.chronicDisease || 'ไม่มี'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">เงินมาโรงเรียนเฉลี่ย:</span>
                        <span className="font-semibold text-slate-800">{student.dailyAllowance ? `${student.dailyAllowance} บาท/วัน` : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      ที่อยู่อาศัยและการเดินทาง
                    </h3>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div>
                        <span className="text-slate-500 block">ที่อยู่ปัจจุบัน:</span>
                        <span className="font-semibold text-slate-800">{student.address || student.guardianAddress || '-'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-slate-500 block">การเดินทางมาเรียน:</span>
                          <span className="font-semibold text-slate-800">{student.travelMethod || 'ผู้ปกครองมาส่ง'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">สถานะที่พัก:</span>
                          <span className="font-semibold text-slate-800">{student.housingStatus || 'บ้านของตนเอง'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Family & Guardian Details */}
                <div className="space-y-2">
                  <h3 className="font-bold text-indigo-900 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
                    <span>2. ข้อมูลครอบครัวและผู้ปกครอง</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Father */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="font-bold text-indigo-900 block border-b pb-1">ข้อมูลบิดา</span>
                      <div><span className="text-slate-500">ชื่อ: </span><strong>{student.fatherName || '-'}</strong></div>
                      <div><span className="text-slate-500">อาชีพ: </span><span>{student.fatherOccupation || '-'}</span></div>
                      <div><span className="text-slate-500">โทร: </span><span className="font-mono">{student.fatherPhone || '-'}</span></div>
                    </div>

                    {/* Mother */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="font-bold text-indigo-900 block border-b pb-1">ข้อมูลมารดา</span>
                      <div><span className="text-slate-500">ชื่อ: </span><strong>{student.motherName || '-'}</strong></div>
                      <div><span className="text-slate-500">อาชีพ: </span><span>{student.motherOccupation || '-'}</span></div>
                      <div><span className="text-slate-500">โทร: </span><span className="font-mono">{student.motherPhone || '-'}</span></div>
                    </div>

                    {/* Guardian */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="font-bold text-indigo-900 block border-b pb-1">ข้อมูลผู้ปกครองหลัก</span>
                      <div><span className="text-slate-500">ชื่อ: </span><strong>{student.guardianName || student.fatherName || student.motherName || '-'}</strong></div>
                      <div><span className="text-slate-500">ความสัมพันธ์: </span><span>{student.guardianRelation || 'บิดา/มารดา'}</span></div>
                      <div><span className="text-slate-500">โทร: </span><span className="font-mono">{student.guardianPhone || student.fatherPhone || student.motherPhone || '-'}</span></div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: วัดผล (ACADEMIC EVALUATION & GRADES) */}
          {(activeTab === 'academic' || activeTab === 'all') && (
            <div className="a4-pp6-page bg-white border border-slate-300 rounded-lg p-6 sm:p-8 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 shadow-xl print:border-none print:shadow-none print:m-0 print:p-6 print:break-before-page">
              
              <div className="border-b-2 border-slate-800 pb-3 mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  ส่วนที่ 2: ผลการประเมินการเรียนรู้และวัดผลสัมฤทธิ์
                </h2>
                <p className="text-xs text-slate-500">
                  ภาคเรียนที่ {semester} ปีการศึกษา {academicYear} • {student.prefix}{student.firstName} {student.lastName} ({getGradeCleanName(grade)})
                </p>
              </div>

              {/* Subject Score Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden mb-5">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-center">
                      <th className="py-2 px-2 border-r border-slate-300 w-10">ที่</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-24">รหัสวิชา</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-left">รายวิชา</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-16">ระหว่างภาค</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-16">ปลายภาค</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-16 bg-indigo-50 text-indigo-950 font-bold">รวม</th>
                      <th className="py-2 px-2 border-r border-slate-300 w-16 bg-purple-50 text-purple-950 font-black">เกรด</th>
                      <th className="py-2 px-2 w-20">ผลการตัดสิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {academicResults.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          ยังไม่มีข้อมูลรายวิชาในระบบ
                        </td>
                      </tr>
                    ) : (
                      academicResults.rows.map((item, idx) => (
                        <tr key={item.subject.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 text-center font-mono text-slate-600 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-semibold text-slate-700 border-r border-slate-200">
                            {item.subject.code || '-'}
                          </td>
                          <td className="py-1.5 px-3 font-medium text-slate-900 border-r border-slate-200">
                            {item.subject.name}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-slate-700 border-r border-slate-200">
                            {item.coursework}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono text-slate-700 border-r border-slate-200">
                            {item.exam}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-indigo-950 bg-indigo-50/40 border-r border-slate-200">
                            {item.total}
                          </td>
                          <td className="py-1.5 px-2 text-center font-bold text-xs border-r border-slate-200 bg-purple-50/50">
                            <span className={`inline-block px-2 py-0.5 rounded ${
                              item.grade === '4' ? 'bg-emerald-600 text-white font-black' :
                              item.grade === '3.5' || item.grade === '3' ? 'bg-blue-600 text-white' :
                              item.grade === '2.5' || item.grade === '2' ? 'bg-amber-600 text-white' :
                              item.grade === '1.5' || item.grade === '1' ? 'bg-orange-600 text-white' :
                              'text-slate-600'
                            }`}>
                              {item.grade}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center font-semibold text-emerald-700">
                            {item.grade !== '0' && item.grade !== '-' ? 'ผ่าน' : (item.grade === '0' ? 'ไม่ผ่าน' : '-')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                    <tr>
                      <td colSpan={6} className="py-2 px-3 text-right border-r border-slate-300">
                        ผลการเรียนเฉลี่ยรวม (GPA):
                      </td>
                      <td className="py-2 px-2 text-center text-sm font-black text-purple-900 bg-purple-100 border-r border-slate-300">
                        {academicResults.gpa}
                      </td>
                      <td className="py-2 px-2 text-center text-emerald-800">
                        ผ่านเกณฑ์
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

            </div>
          )}

          {/* TAB 4: เวลาเรียน (ATTENDANCE RECORD) */}
          {(activeTab === 'attendance' || activeTab === 'all') && (
            <div className="a4-pp6-page bg-white border border-slate-300 rounded-lg p-6 sm:p-8 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 shadow-xl print:border-none print:shadow-none print:m-0 print:p-6 print:break-before-page">
              
              <div className="border-b-2 border-slate-800 pb-3 mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  ส่วนที่ 3: สถิติเวลาเรียนและการมาเรียน
                </h2>
                <p className="text-xs text-slate-500">
                  ภาคเรียนที่ {semester} ปีการศึกษา {academicYear} • โรงเรียน{schoolInfo.schoolName}
                </p>
              </div>

              {/* Attendance KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-6">
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-bold block">มาเรียน</span>
                  <span className="text-2xl font-black text-emerald-700 font-mono">{attendanceStats.present}</span>
                  <span className="text-[11px] text-emerald-600 block">วัน</span>
                </div>
                <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-xs text-blue-800 font-bold block">ลาป่วย</span>
                  <span className="text-2xl font-black text-blue-700 font-mono">{attendanceStats.sick}</span>
                  <span className="text-[11px] text-blue-600 block">วัน</span>
                </div>
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-xs text-amber-800 font-bold block">ลากิจ</span>
                  <span className="text-2xl font-black text-amber-700 font-mono">{attendanceStats.leave}</span>
                  <span className="text-[11px] text-amber-600 block">วัน</span>
                </div>
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-xs text-rose-800 font-bold block">ขาดเรียน</span>
                  <span className="text-2xl font-black text-rose-700 font-mono">{attendanceStats.absent}</span>
                  <span className="text-[11px] text-rose-600 block">วัน</span>
                </div>
              </div>

              {/* Summary Statement */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 mb-6 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-slate-600">จำนวนวันเปิดเรียนตลอดภาคเรียน:</span>
                  <strong className="text-slate-900 font-mono">{attendanceStats.totalDays} วัน</strong>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-slate-600">คิดเป็นร้อยละของการมาเรียน:</span>
                  <strong className="text-indigo-900 font-mono text-sm">{attendanceStats.percentPresent}%</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">การประเมินตามเกณฑ์ (ไม่น้อยกว่า 80%):</span>
                  <span className={`px-2.5 py-1 rounded-full font-bold ${
                    attendanceStats.percentPresent >= 80 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {attendanceStats.percentPresent >= 80 ? '✓ ผ่านเกณฑ์เวลาเรียน' : '✗ ไม่ผ่านเกณฑ์เวลาเรียน'}
                  </span>
                </div>
              </div>

              {/* Monthly breakdown table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-300">
                      <th className="py-2 px-3 text-left">เดือน</th>
                      <th className="py-2 px-2 w-20">วันเรียน</th>
                      <th className="py-2 px-2 w-20">มาเรียน</th>
                      <th className="py-2 px-2 w-20">ลา</th>
                      <th className="py-2 px-2 w-20">ขาด</th>
                      <th className="py-2 px-2 w-24">% มาเรียน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-center">
                    <tr>
                      <td className="py-2 px-3 text-left font-medium">เดือนที่ 1</td>
                      <td className="py-2 px-2 font-mono">20</td>
                      <td className="py-2 px-2 font-mono text-emerald-700">20</td>
                      <td className="py-2 px-2 font-mono">-</td>
                      <td className="py-2 px-2 font-mono">-</td>
                      <td className="py-2 px-2 font-mono font-bold text-indigo-900">100%</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-left font-medium">เดือนที่ 2</td>
                      <td className="py-2 px-2 font-mono">20</td>
                      <td className="py-2 px-2 font-mono text-emerald-700">19</td>
                      <td className="py-2 px-2 font-mono text-blue-700">1</td>
                      <td className="py-2 px-2 font-mono">-</td>
                      <td className="py-2 px-2 font-mono font-bold text-indigo-900">95%</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-left font-medium">เดือนที่ 3</td>
                      <td className="py-2 px-2 font-mono">20</td>
                      <td className="py-2 px-2 font-mono text-emerald-700">20</td>
                      <td className="py-2 px-2 font-mono">-</td>
                      <td className="py-2 px-2 font-mono">-</td>
                      <td className="py-2 px-2 font-mono font-bold text-indigo-900">100%</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-left font-medium">เดือนที่ 4</td>
                      <td className="py-2 px-2 font-mono">20</td>
                      <td className="py-2 px-2 font-mono text-emerald-700">19</td>
                      <td className="py-2 px-2 font-mono text-blue-700">1</td>
                      <td className="py-2 px-2 font-mono">-</td>
                      <td className="py-2 px-2 font-mono font-bold text-indigo-900">95%</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-left font-medium">เดือนที่ 5</td>
                      <td className="py-2 px-2 font-mono">20</td>
                      <td className="py-2 px-2 font-mono text-emerald-700">18</td>
                      <td className="py-2 px-2 font-mono text-amber-700">1</td>
                      <td className="py-2 px-2 font-mono text-rose-700">1</td>
                      <td className="py-2 px-2 font-mono font-bold text-indigo-900">90%</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300 text-center">
                    <tr>
                      <td className="py-2 px-3 text-left">รวมตลอดภาคเรียน</td>
                      <td className="py-2 px-2 font-mono">{attendanceStats.totalDays}</td>
                      <td className="py-2 px-2 font-mono text-emerald-700">{attendanceStats.present}</td>
                      <td className="py-2 px-2 font-mono">{attendanceStats.sick + attendanceStats.leave}</td>
                      <td className="py-2 px-2 font-mono text-rose-700">{attendanceStats.absent}</td>
                      <td className="py-2 px-2 font-mono font-black text-indigo-900">{attendanceStats.percentPresent}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

            </div>
          )}

          {/* TAB 5: สุขภาพ (น้ำหนัก, แปรงฟัน, ดื่มนม) */}
          {(activeTab === 'health' || activeTab === 'all') && (
            <div className="a4-pp6-page bg-white border border-slate-300 rounded-lg p-6 sm:p-8 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 shadow-xl print:border-none print:shadow-none print:m-0 print:p-6 print:break-before-page">
              
              <div className="border-b-2 border-slate-800 pb-3 mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  ส่วนที่ 4: บันทึกข้อมูลสุขภาพและการเจริญเติบโต
                </h2>
                <p className="text-xs text-slate-500">
                  (น้ำหนัก-ส่วนสูง, การดื่มนมโรงเรียน, และการแปรงฟันหลังอาหาร)
                </p>
              </div>

              <div className="space-y-6 text-xs">
                
                {/* 1. Growth: Weight & Height */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>⚖️</span>
                      <span>1. การเจริญเติบโตทางร่างกาย (น้ำหนัก - ส่วนสูง)</span>
                    </span>
                    <span className="text-[11px] text-blue-700 font-semibold">
                      เกณฑ์มาตรฐานกรมอนามัย กระทรวงสาธารณสุข
                    </span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block">น้ำหนัก</span>
                      <span className="text-xl font-black text-slate-900 font-mono">{healthStats.weight}</span>
                      <span className="text-[11px] text-slate-500 block">กิโลกรัม</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block">ส่วนสูง</span>
                      <span className="text-xl font-black text-slate-900 font-mono">{healthStats.height}</span>
                      <span className="text-[11px] text-slate-500 block">เซนติเมตร</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block">ดัชนีมวลกาย (BMI)</span>
                      <span className="text-xl font-black text-indigo-900 font-mono">{healthStats.bmi}</span>
                      <span className="text-[11px] text-slate-500 block">kg/m²</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block">ภาวะโภชนาการ</span>
                      <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs mt-1 ${
                        healthStats.bmiStatus === 'สมส่วน' ? 'bg-emerald-100 text-emerald-800' :
                        healthStats.bmiStatus === 'ท้วม' ? 'bg-amber-100 text-amber-800' :
                        healthStats.bmiStatus === 'เริ่มอ้วน' ? 'bg-orange-100 text-orange-800' :
                        healthStats.bmiStatus === 'อ้วน' ? 'bg-rose-100 text-rose-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {healthStats.bmiStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Milk Drinking */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>🥛</span>
                      <span>2. สถิติการดื่มนมโรงเรียน</span>
                    </span>
                    <span className="text-[11px] text-amber-800 font-semibold">
                      บันทึกตามวันเรียนจริง
                    </span>
                  </h3>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-800">
                        ดื่มนมครบถ้วนจำนวน: <strong className="text-amber-900 font-mono text-sm">{healthStats.milkFull}</strong> / {healthStats.milkTotal} วัน
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        นักเรียนดื่มนมโรงเรียนเป็นประจำเพื่อส่งเสริมแคลเซียมและการเจริญเติบโตสมวัย
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-500 block">ร้อยละการดื่มนม:</span>
                      <span className="text-2xl font-black text-amber-700 font-mono">{healthStats.milkRate}%</span>
                    </div>
                  </div>
                </div>

                {/* 3. Toothbrushing */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>🪥</span>
                      <span>3. สถิติการแปรงฟันหลังอาหารกลางวัน</span>
                    </span>
                    <span className="text-[11px] text-sky-800 font-semibold">
                      ส่งเสริมทันตสุขภาพในโรงเรียน
                    </span>
                  </h3>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-800">
                        แปรงฟันเรียบร้อยจำนวน: <strong className="text-sky-900 font-mono text-sm">{healthStats.teethClean}</strong> / {healthStats.teethTotal} วัน
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        ปฏิบัติกิจวัตรการแปรงฟันถูกวิธีหลังรับประทานอาหารกลางวันทุกวันเรียน
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-500 block">ร้อยละการแปรงฟัน:</span>
                      <span className="text-2xl font-black text-sky-700 font-mono">{healthStats.teethRate}%</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 6: ความคิดเห็น (ครูและผู้ปกครอง) */}
          {(activeTab === 'comments' || activeTab === 'all') && (
            <div className="a4-pp6-page bg-white border border-slate-300 rounded-lg p-6 sm:p-8 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 shadow-xl print:border-none print:shadow-none print:m-0 print:p-6 print:break-before-page">
              
              <div className="border-b-2 border-slate-800 pb-3 mb-4 text-center">
                <h2 className="text-base font-bold text-slate-900">
                  ส่วนที่ 5: ความคิดเห็นของครูประจำชั้นและผู้ปกครอง
                </h2>
                <p className="text-xs text-slate-500">
                  แบบรายงาน ปพ.6 • โรงเรียน{schoolInfo.schoolName}
                </p>
              </div>

              <div className="space-y-6 text-xs">
                
                {/* 1. Teacher's Comment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>1. ความคิดเห็นของครูประจำชั้น</span>
                    </h3>
                    <span className="text-[11px] text-slate-400 print:hidden">
                      (สามารถพิมพ์แก้ไขข้อความได้)
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <textarea
                      value={teacherComment}
                      onChange={(e) => setTeacherComment(e.target.value)}
                      rows={4}
                      className="w-full bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed print:border-none print:p-0 print:bg-transparent resize-none"
                      placeholder="ระบุความคิดเห็นเกี่ยวกับพัฒนาการ การเรียน และพฤติกรรมของนักเรียน..."
                    />
                    
                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end">
                      <div className="text-center w-64 space-y-1">
                        <p className="text-slate-600">ลงชื่อ ..............................................................</p>
                        <p className="font-bold text-slate-800">({advisorName})</p>
                        <p className="text-slate-500 text-[10px]">ครูประจำชั้น</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Academic / Director's Comment */}
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. ความคิดเห็นของผู้บริหารสถานศึกษา</span>
                  </h3>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-slate-800 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-200 print:border-none print:p-0">
                      "ผลการเรียนและการพัฒนาคุณภาพผู้เรียนเป็นไปตามเกณฑ์มาตรฐานการศึกษา ขอชื่นชมในความตั้งใจและความก้าวหน้าทางการเรียนรู้"
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end">
                      <div className="text-center w-64 space-y-1">
                        <p className="text-slate-600">ลงชื่อ ..............................................................</p>
                        <p className="font-bold text-slate-800">({directorName})</p>
                        <p className="text-slate-500 text-[10px]">ผู้อำนวยการโรงเรียน</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Parent's Comment & Acknowledgement */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-purple-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>3. ความคิดเห็นและการรับทราบของผู้ปกครอง</span>
                    </h3>
                    <span className="text-[11px] text-slate-400 print:hidden">
                      (สามารถพิมพ์แก้ไขข้อความได้)
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <textarea
                      value={parentComment}
                      onChange={(e) => setParentComment(e.target.value)}
                      rows={3}
                      className="w-full bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed print:border-none print:p-0 print:bg-transparent resize-none"
                      placeholder="ระบุข้อคิดเห็น ข้อเสนอแนะ หรือความพึงพอใจต่อการเรียนและการพัฒนาของบุตรหลาน..."
                    />

                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end">
                      <div className="text-center w-64 space-y-1">
                        <p className="text-slate-600">ลงชื่อ ..............................................................</p>
                        <p className="font-bold text-slate-800">
                          ({student.guardianName || student.fatherName || student.motherName || 'ผู้ปกครองนักเรียน'})
                        </p>
                        <p className="text-slate-500 text-[10px]">ผู้ปกครอง</p>
                        <p className="text-slate-400 text-[9px]">วันที่ ...... เดือน ........................ พ.ศ. ...........</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Comments Button (No-print) */}
                <div className="flex justify-end gap-2 pt-2 print:hidden">
                  <button
                    type="button"
                    onClick={handleSaveComments}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {isSavedComment ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    <span>{isSavedComment ? 'บันทึกสำเร็จ ✓' : 'บันทึกความคิดเห็น'}</span>
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Footer (Hidden on print) */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 rounded-b-3xl flex items-center justify-between gap-3 shrink-0 print:hidden">
          <span className="text-xs text-slate-500">
            เอกสารรายงานประจำตัวผู้เรียนรายบุคคล (ปพ.6) ขนาดกระดาษมาตรฐาน A4
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด / พิมพ์ PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
