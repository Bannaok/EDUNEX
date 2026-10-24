import React, { useState, useMemo } from 'react';
import { 
  Student, 
  Personnel, 
  SchoolInfo, 
  GradeRecord, 
  GradeLevel, 
  Subject 
} from '../types';
import { 
  CHARACTERISTICS_GROUPS, 
  CharacteristicGroup, 
  StudentAssessmentRecord,
  ReadingWritingStructureConfig,
  AssessmentTableConfig
} from './Assessment3Booklets';
import { 
  X, 
  Download, 
  FileText, 
  CheckCircle2, 
  BookOpen, 
  Award, 
  Users, 
  Check, 
  UserCheck
} from 'lucide-react';

interface ThreeReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  grade: GradeLevel;
  selectedYear: string;
  selectedSemester: string;
  students: Student[];
  personnel: Personnel[];
  schoolInfo: SchoolInfo;
  grades: GradeRecord[];
  subjects: Subject[];
  selectedAdvisorId: string;
  setSelectedAdvisorId: (id: string) => void;
  selectedAcademicHeadId: string;
  setSelectedAcademicHeadId: (id: string) => void;
  directorDisplayName: string;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg: string) => void;
}

const DEFAULT_RW_CONFIG: ReadingWritingStructureConfig = {
  mainTitle: '1. การอ่าน คิดวิเคราะห์ และเขียน',
  tables: [
    {
      id: 'table-reading',
      title: 'การอ่าน',
      indicators: [
        { id: 'r1', name: '1.1 จับใจความสำคัญ', maxScore: 10 },
        { id: 'r2', name: '1.2 ตีความ/แปลความ', maxScore: 10 },
        { id: 'r3', name: '1.3 ประเมินค่าสิ่งที่อ่าน', maxScore: 10 }
      ]
    },
    {
      id: 'table-thinking',
      title: 'คิดวิเคราะห์',
      indicators: [
        { id: 't1', name: '2.1 จำแนกข้อเท็จจริง', maxScore: 10 },
        { id: 't2', name: '2.2 เหตุและผล', maxScore: 15 },
        { id: 't3', name: '2.3 สรุปความคิดรวบยอด', maxScore: 15 }
      ]
    },
    {
      id: 'table-writing',
      title: 'การเขียน',
      indicators: [
        { id: 'w1', name: '3.1 เขียนถ่ายทอดความคิด', maxScore: 15 },
        { id: 'w2', name: '3.2 เรียบเรียงภาษาถูกต้อง', maxScore: 15 },
        { id: 'w3', name: '3.3 ความคิดสร้างสรรค์', maxScore: 10 }
      ]
    }
  ]
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

const getLevelBadgeText = (level: number) => {
  switch (level) {
    case 3: return 'ดีเยี่ยม';
    case 2: return 'ดี';
    case 1: return 'ผ่าน';
    default: return 'ไม่ผ่าน';
  }
};

export const ThreeReportsModal: React.FC<ThreeReportsModalProps> = ({
  isOpen,
  onClose,
  grade,
  selectedYear,
  selectedSemester,
  students,
  personnel,
  schoolInfo,
  grades,
  selectedAdvisorId,
  setSelectedAdvisorId,
  selectedAcademicHeadId,
  setSelectedAcademicHeadId,
  directorDisplayName,
  onShowToast
}) => {
  if (!isOpen) return null;

  // 3 Primary Tabs
  const [activeTab, setActiveTab] = useState<'readingWriting' | 'characteristics' | 'competencies'>('readingWriting');

  // Sub-navigation for Tab 1: Reading & Writing
  // 'all' = render all 4 A4 pages continuously; or specific single page
  const [rwSubPage, setRwSubPage] = useState<'all' | 'reading' | 'thinking' | 'writing' | 'summary'>('all');

  // Sub-navigation for Tab 2: Characteristics
  // 'overview' = 8 core items summary for all students; 'individual' = 8 items with all sub-indicators for a selected student
  const [charSubView, setCharSubView] = useState<'overview' | 'individual'>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Filter students for this grade
  const classStudents = useMemo(() => {
    return [...students.filter(s => s.gradeLevel === grade)].sort((a, b) => {
      if (a.rollNumber !== undefined && b.rollNumber !== undefined) {
        return a.rollNumber - b.rollNumber;
      }
      return (a.studentCode || '').localeCompare(b.studentCode || '');
    });
  }, [students, grade]);

  // Set default student if individual view selected
  React.useEffect(() => {
    if (classStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(classStudents[0].id);
    }
  }, [classStudents, selectedStudentId]);

  // Load Reading/Writing Structure Configuration
  const rwConfig = useMemo<ReadingWritingStructureConfig>(() => {
    try {
      const saved = localStorage.getItem('ams_reading_writing_config_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_RW_CONFIG;
  }, []);

  // Load Assessment 3 Booklets data from storage
  const assessmentData = useMemo<Record<string, StudentAssessmentRecord>>(() => {
    try {
      const saved = localStorage.getItem('ams_assessment_3_booklets_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {};
  }, []);

  // Thresholds for Reading/Writing scoring
  const thresholds = useMemo(() => {
    try {
      const saved = localStorage.getItem('ams_assessment_thresholds_v3');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return {
      reading: { excellent: 24, good: 21, passing: 18, maxScore: 30 },
      thinking: { excellent: 24, good: 21, passing: 18, maxScore: 40 },
      writing: { excellent: 32, good: 28, passing: 24, maxScore: 40 }
    };
  }, []);

  // Helper calculating level for reading/thinking/writing
  const getTableScoreLevel = (score: number, type: 'reading' | 'thinking' | 'writing'): number => {
    const th = thresholds[type] || thresholds.reading;
    if (score >= th.excellent) return 3;
    if (score >= th.good) return 2;
    if (score >= th.passing) return 1;
    return 0;
  };

  // Helper getting student assessment record
  const getStudentAssessment = (student: Student): StudentAssessmentRecord => {
    const key = `${student.id}_${grade}_${selectedSemester}_${selectedYear}`;
    const existing = assessmentData[key];
    if (existing) return existing;

    // Fallback: Check if score exists in grades
    const gRec = grades.find(g => 
      g.studentId === student.id && 
      (g.semester === selectedSemester || !g.semester) &&
      (g.academicYear === selectedYear || !g.academicYear)
    );

    const defaultLevel = gRec?.readingWritingScore !== undefined ? gRec.readingWritingScore : 3;
    const charLevel = gRec?.desiredCharacteristicsScore !== undefined ? gRec.desiredCharacteristicsScore : 3;
    const compLevel = gRec?.competencyScore !== undefined ? gRec.competencyScore : 3;

    return {
      studentId: student.id,
      studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
      rollNumber: student.rollNumber,
      gradeLevel: grade,
      semester: selectedSemester as '1' | '2',
      academicYear: selectedYear,
      indicatorScores: {
        r1: defaultLevel >= 3 ? 9 : (defaultLevel === 2 ? 8 : 6),
        r2: defaultLevel >= 3 ? 9 : (defaultLevel === 2 ? 7 : 6),
        r3: defaultLevel >= 3 ? 9 : (defaultLevel === 2 ? 7 : 6),
        t1: defaultLevel >= 3 ? 9 : (defaultLevel === 2 ? 8 : 6),
        t2: defaultLevel >= 3 ? 14 : (defaultLevel === 2 ? 11 : 9),
        t3: defaultLevel >= 3 ? 14 : (defaultLevel === 2 ? 11 : 9),
        w1: defaultLevel >= 3 ? 14 : (defaultLevel === 2 ? 11 : 9),
        w2: defaultLevel >= 3 ? 14 : (defaultLevel === 2 ? 11 : 9),
        w3: defaultLevel >= 3 ? 9 : (defaultLevel === 2 ? 8 : 6),
      },
      characteristics: {
        item1: charLevel,
        item2: charLevel,
        item3: charLevel,
        item4: charLevel,
        item5: charLevel,
        item6: charLevel,
        item7: charLevel,
        item8: charLevel,
        overallLevel: charLevel,
        subScores: {
          '1.1': charLevel, '1.2': charLevel, '1.3': charLevel, '1.4': charLevel, '1.5': charLevel,
          '2.1': charLevel, '2.2': charLevel, '2.3': charLevel,
          '3.1': charLevel, '3.2': charLevel, '3.3': charLevel,
          '4.1': charLevel, '4.2': charLevel, '4.3': charLevel, '4.4': charLevel,
          '5.1': charLevel, '5.2': charLevel, '5.3': charLevel,
          '6.1': charLevel, '6.2': charLevel,
          '7.1': charLevel, '7.2': charLevel,
          '8.1': charLevel, '8.2': charLevel, '8.3': charLevel, '8.4': charLevel
        }
      },
      competency: {
        comp1: compLevel,
        comp2: compLevel,
        comp3: compLevel,
        comp4: compLevel,
        comp5: compLevel,
        overallLevel: compLevel
      }
    };
  };

  // Helper calculating student's score for a specific table
  const getStudentTableScore = (rec: StudentAssessmentRecord, table: AssessmentTableConfig): number => {
    if (!rec || !rec.indicatorScores) return 0;
    return table.indicators.reduce((sum, ind) => sum + (Number(rec.indicatorScores[ind.id]) || 0), 0);
  };

  const getStudentTableType = (tbl: AssessmentTableConfig): 'reading' | 'thinking' | 'writing' => {
    const t = (tbl.title || '').toLowerCase();
    if (tbl.id.includes('reading') || t.includes('อ่าน')) return 'reading';
    if (tbl.id.includes('writing') || t.includes('เขียน')) return 'writing';
    return 'thinking';
  };

  // Selected personnel details
  const selectedAdvisor = useMemo(() => {
    if (selectedAdvisorId) {
      return personnel.find(p => p.id === selectedAdvisorId) || null;
    }
    return personnel.find(p => p.advisorGrade === grade) || null;
  }, [personnel, selectedAdvisorId, grade]);

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

  const handlePrint = () => {
    window.print();
  };

  // Tables for Reading/Writing
  const readingTable = rwConfig.tables.find(t => t.id.includes('reading') || t.title.includes('อ่าน')) || rwConfig.tables[0];
  const thinkingTable = rwConfig.tables.find(t => t.id.includes('thinking') || t.title.includes('คิด')) || rwConfig.tables[1];
  const writingTable = rwConfig.tables.find(t => t.id.includes('writing') || t.title.includes('เขียน')) || rwConfig.tables[2];

  // Selected student for individual evaluation
  const targetIndividualStudent = useMemo(() => {
    return classStudents.find(s => s.id === selectedStudentId) || classStudents[0] || null;
  }, [classStudents, selectedStudentId]);

  // Signatures Component for A4 Pages
  const renderSignatures = () => (
    <div className="mt-6 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-[10px]">
      <div className="space-y-0.5">
        <p className="text-slate-600">ลงชื่อ ..................................................</p>
        <p className="font-bold text-slate-800">
          ({selectedAdvisor ? `${selectedAdvisor.prefix || ''}${selectedAdvisor.firstName || ''} ${selectedAdvisor.lastName || ''}`.trim() : '................................................'})
        </p>
        <p className="text-slate-500 text-[9px]">ครูประจำชั้น / ผู้ประเมิน</p>
      </div>

      <div className="space-y-0.5">
        <p className="text-slate-600">ลงชื่อ ..................................................</p>
        <p className="font-bold text-slate-800">
          ({selectedAcademicHead ? `${selectedAcademicHead.prefix || ''}${selectedAcademicHead.firstName || ''} ${selectedAcademicHead.lastName || ''}`.trim() : '................................................'})
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
  );

  // 3-Line Header Component for A4 Pages
  const renderA4Header = (title: string, subDetail?: string) => (
    <div className="border-b-2 border-slate-800 pb-2 mb-3 text-center">
      <h1 className="text-sm font-bold text-slate-900 tracking-tight">
        {title}
      </h1>
      <div className="text-[11px] font-semibold text-slate-800 mt-0.5">
        โรงเรียน{schoolInfo.schoolName || '...................................................'} {schoolInfo.affiliation ? `สังกัด${schoolInfo.affiliation}` : ''}
      </div>
      <div className="text-[11px] font-bold text-slate-800 mt-0.5">
        ปีการศึกษา {selectedYear} | ภาคเรียนที่ {selectedSemester} | {getGradeCleanName(grade)} {subDetail ? `| ${subDetail}` : ''}
      </div>
    </div>
  );

  // Render a Single Reading/Writing Table (Reading, Thinking, or Writing)
  const renderSingleRWTableSheet = (table: AssessmentTableConfig, tableIndex: number, pageNum: number) => {
    const tableType = getStudentTableType(table);
    const maxScore = table.indicators.reduce((sum, ind) => sum + (ind.maxScore || 0), 0);

    return (
      <div 
        key={table.id}
        className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
        style={{ width: '210mm' }}
      >
        {renderA4Header(`แบบประเมินการอ่าน คิดวิเคราะห์ และเขียน (ตารางที่ ${tableIndex}: ${table.title})`, `คะแนนเต็ม ${maxScore} คะแนน`)}

        <div className="overflow-x-auto border border-slate-300 rounded-sm">
          <table className="w-full text-left text-[10px] border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 text-center w-6 shrink-0 font-mono text-[9px]">
                  ที่
                </th>
                <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 text-center w-16 shrink-0 font-mono text-[9px]">
                  รหัสประจำตัว
                </th>
                <th rowSpan={2} className="py-1 px-2 border-r border-slate-300 w-40 shrink-0 truncate text-[10px]">
                  ชื่อ - นามสกุล
                </th>

                {/* Indicator Columns */}
                {table.indicators.map((ind) => (
                  <th key={ind.id} className="py-1 px-1 border-r border-slate-300 text-center bg-teal-50/70 text-slate-900">
                    <div className="font-bold text-[9.5px] truncate max-w-[120px] mx-auto text-teal-950">
                      {ind.name}
                    </div>
                    <div className="text-[8px] font-mono text-teal-700 font-normal mt-0.5">
                      (เต็ม {ind.maxScore})
                    </div>
                  </th>
                ))}

                <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 text-center w-12 bg-teal-100/70 text-teal-950 font-bold">
                  รวม ({maxScore})
                </th>
                <th rowSpan={2} className="py-1 px-1 text-center w-16 bg-slate-100 text-slate-800 font-bold">
                  ระดับคุณภาพ
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-800">
              {classStudents.map((s, idx) => {
                const rec = getStudentAssessment(s);
                const tableScore = getStudentTableScore(rec, table);
                const level = getTableScoreLevel(tableScore, tableType);

                return (
                  <tr key={s.id} className="hover:bg-slate-50 leading-tight">
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                      {s.rollNumber || idx + 1}
                    </td>
                    <td className="py-1 px-1 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                      {s.studentCode || '-'}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900 truncate max-w-[140px] text-[10px]">
                      {s.prefix}{s.firstName} {s.lastName}
                    </td>

                    {/* Indicator Scores */}
                    {table.indicators.map((ind) => {
                      const sc = rec.indicatorScores?.[ind.id];
                      return (
                        <td key={ind.id} className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[9.5px] tabular-nums text-slate-700">
                          {sc !== undefined && sc !== null ? sc : '-'}
                        </td>
                      );
                    })}

                    <td className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[9.5px] tabular-nums font-bold bg-teal-50/40 text-teal-950">
                      {tableScore}
                    </td>
                    <td className="py-1 px-1 text-center text-[9px] font-bold">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                        level === 3 ? 'bg-emerald-100 text-emerald-800' :
                        level === 2 ? 'bg-sky-100 text-sky-800' :
                        level === 1 ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {getLevelBadgeText(level)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 text-[9px]">
                <td colSpan={3} className="py-1 px-2 border-r border-slate-300 text-right font-bold">
                  คะแนนเฉลี่ย:
                </td>
                {table.indicators.map((ind) => {
                  let total = 0, count = 0;
                  classStudents.forEach(s => {
                    const sc = getStudentAssessment(s).indicatorScores?.[ind.id];
                    if (sc !== undefined && sc !== null) { total += Number(sc); count++; }
                  });
                  return (
                    <td key={ind.id} className="py-1 px-1 border-r border-slate-300 text-center font-mono font-medium text-slate-700">
                      {count > 0 ? (total / count).toFixed(1) : '-'}
                    </td>
                  );
                })}
                <td className="py-1 px-1 border-r border-slate-300 text-center font-mono font-bold bg-teal-100/60 text-teal-950">
                  {(() => {
                    let total = 0, count = 0;
                    classStudents.forEach(s => {
                      total += getStudentTableScore(getStudentAssessment(s), table);
                      count++;
                    });
                    return count > 0 ? (total / count).toFixed(1) : '-';
                  })()}
                </td>
                <td className="py-1 px-1 text-center text-[9px] text-slate-600">
                  รวม {classStudents.length} คน
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {renderSignatures()}

        <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-teal-400 text-center text-[10px] font-bold text-teal-700 no-print flex items-center justify-center gap-2 bg-teal-50/60 py-1 rounded">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          <span>--- สิ้นสุดความยาวกระดาษ A4 แผ่นที่ {pageNum} (297 mm) ---</span>
        </div>
      </div>
    );
  };

  // Render Reading/Writing Summary Sheet (สรุปปริมาณและคุณภาพ)
  const renderRWSummarySheet = (pageNum: number) => {
    const rMax = readingTable.indicators.reduce((sum, ind) => sum + (ind.maxScore || 0), 0);
    const tMax = thinkingTable.indicators.reduce((sum, ind) => sum + (ind.maxScore || 0), 0);
    const wMax = writingTable.indicators.reduce((sum, ind) => sum + (ind.maxScore || 0), 0);
    const totalMax = rMax + tMax + wMax;

    return (
      <div 
        className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
        style={{ width: '210mm' }}
      >
        {renderA4Header('แบบสรุปผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน', 'สรุปผลเชิงปริมาณและคุณภาพ')}

        <div className="overflow-x-auto border border-slate-300 rounded-sm">
          <table className="w-full text-left text-[10px] border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th rowSpan={2} className="py-1.5 px-1 border-r border-slate-300 text-center w-7 shrink-0 font-mono text-[9px]">
                  ที่
                </th>
                <th rowSpan={2} className="py-1.5 px-1 border-r border-slate-300 text-center w-16 shrink-0 font-mono text-[9px]">
                  รหัสประจำตัว
                </th>
                <th rowSpan={2} className="py-1.5 px-2 border-r border-slate-300 w-40 shrink-0 truncate text-[10px]">
                  ชื่อ - นามสกุล
                </th>

                {/* Column การอ่าน */}
                <th colSpan={2} className="py-1 px-1 border-r border-slate-300 text-center bg-teal-50/80 text-teal-950 font-bold">
                  การอ่าน ({rMax})
                </th>

                {/* Column คิดวิเคราะห์ */}
                <th colSpan={2} className="py-1 px-1 border-r border-slate-300 text-center bg-sky-50/80 text-sky-950 font-bold">
                  คิดวิเคราะห์ ({tMax})
                </th>

                {/* Column การเขียน */}
                <th colSpan={2} className="py-1 px-1 border-r border-slate-300 text-center bg-indigo-50/80 text-indigo-950 font-bold">
                  การเขียน ({wMax})
                </th>

                {/* Column รวม */}
                <th colSpan={2} className="py-1 px-1 border-r border-slate-300 text-center bg-emerald-50/80 text-emerald-950 font-bold">
                  รวม ({totalMax})
                </th>

                <th rowSpan={2} className="py-1.5 px-1 text-center w-16 bg-slate-100 text-slate-900 font-bold">
                  สรุปผล
                </th>
              </tr>

              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300 text-[8.5px]">
                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-12">ปริมาณ</th>
                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-14">คุณภาพ</th>

                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-12">ปริมาณ</th>
                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-14">คุณภาพ</th>

                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-12">ปริมาณ</th>
                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-14">คุณภาพ</th>

                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-12 bg-emerald-50/50">ปริมาณ</th>
                <th className="py-1 px-0.5 border-r border-slate-300 text-center w-14 bg-emerald-50/50">คุณภาพ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-800">
              {classStudents.map((s, idx) => {
                const rec = getStudentAssessment(s);
                const rScore = getStudentTableScore(rec, readingTable);
                const tScore = getStudentTableScore(rec, thinkingTable);
                const wScore = getStudentTableScore(rec, writingTable);
                const sumScore = rScore + tScore + wScore;

                const lR = getTableScoreLevel(rScore, 'reading');
                const lT = getTableScoreLevel(tScore, 'thinking');
                const lW = getTableScoreLevel(wScore, 'writing');
                const overallLevel = Math.min(3, Math.max(0, Math.round((lR + lT + lW) / 3)));

                return (
                  <tr key={s.id} className="hover:bg-slate-50 leading-tight">
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                      {s.rollNumber || idx + 1}
                    </td>
                    <td className="py-1 px-1 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                      {s.studentCode || '-'}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900 truncate max-w-[140px] text-[10px]">
                      {s.prefix}{s.firstName} {s.lastName}
                    </td>

                    {/* การอ่าน */}
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums">{rScore}</td>
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center text-[8.5px] font-bold">{getLevelBadgeText(lR)}</td>

                    {/* คิดวิเคราะห์ */}
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums">{tScore}</td>
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center text-[8.5px] font-bold">{getLevelBadgeText(lT)}</td>

                    {/* การเขียน */}
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums">{wScore}</td>
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center text-[8.5px] font-bold">{getLevelBadgeText(lW)}</td>

                    {/* รวม */}
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-bold bg-emerald-50/40">{sumScore}</td>
                    <td className="py-1 px-0.5 border-r border-slate-200 text-center text-[8.5px] font-bold bg-emerald-50/40">{getLevelBadgeText(overallLevel)}</td>

                    {/* Overall Badge */}
                    <td className="py-1 px-1 text-center font-bold text-[9px]">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                        overallLevel === 3 ? 'bg-emerald-100 text-emerald-800' :
                        overallLevel === 2 ? 'bg-sky-100 text-sky-800' :
                        overallLevel === 1 ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {getLevelBadgeText(overallLevel)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {renderSignatures()}

        <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-teal-400 text-center text-[10px] font-bold text-teal-700 no-print flex items-center justify-center gap-2 bg-teal-50/60 py-1 rounded">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          <span>--- สิ้นสุดความยาวกระดาษ A4 แผ่นที่ {pageNum} (297 mm) ---</span>
        </div>
      </div>
    );
  };

  // Render Tab 2: Characteristics Overview Sheet (สรุปข้อหลักทั้ง 8 ข้อ)
  const renderCharacteristicsOverviewSheet = () => (
    <div 
      className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
      style={{ width: '210mm' }}
    >
      {renderA4Header('แบบสรุปผลการประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ', 'สรุปผลรายบุคคลทั้งห้องเรียน')}

      <div className="overflow-x-auto border border-slate-300 rounded-sm">
        <table className="w-full text-left text-[10px] border-collapse min-w-[680px]">
          <thead>
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

              {/* 8 Core Characteristics - Equal Width & Wrapping Full Titles */}
              {CHARACTERISTICS_GROUPS.map((grp) => (
                <th key={grp.id} className="py-1 px-0.5 border-r border-slate-300 text-center w-[9%] bg-amber-50/70 text-amber-950 font-bold" title={grp.title}>
                  <div className="text-[9px] font-bold border-b border-amber-200 pb-0.5 mb-0.5 text-amber-900">ข้อ {grp.number}</div>
                  <div className="text-[8px] font-semibold leading-tight whitespace-normal break-words text-amber-950">
                    {grp.title.replace(/^\d+\)\s*/, '')}
                  </div>
                </th>
              ))}

              <th rowSpan={2} className="py-1 px-1 text-center w-16 bg-amber-100/70 text-amber-950 font-bold">
                สรุปผล
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-800">
            {classStudents.map((s, idx) => {
              const rec = getStudentAssessment(s);
              const char = rec.characteristics || ({} as any);

              // Calculate overall level as average or min of the 8 items
              const itemScores = [
                char.item1 || 0, char.item2 || 0, char.item3 || 0, char.item4 || 0,
                char.item5 || 0, char.item6 || 0, char.item7 || 0, char.item8 || 0
              ];
              const avgChar = Math.round(itemScores.reduce((a, b) => a + b, 0) / 8);
              const overall = char.overallLevel !== undefined ? char.overallLevel : avgChar;

              return (
                <tr key={s.id} className="hover:bg-slate-50 leading-tight">
                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                    {s.rollNumber || idx + 1}
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                    {s.studentCode || '-'}
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900 truncate max-w-[130px] text-[10px]">
                    {s.prefix}{s.firstName} {s.lastName}
                  </td>

                  {/* 8 Items */}
                  {CHARACTERISTICS_GROUPS.map((grp) => {
                    const score = (char as any)[grp.itemKey] !== undefined ? (char as any)[grp.itemKey] : 3;
                    return (
                      <td key={grp.id} className="py-1 px-0.5 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-semibold">
                        {score}
                      </td>
                    );
                  })}

                  <td className="py-1 px-1 text-center text-[9px] font-bold">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                      overall === 3 ? 'bg-emerald-100 text-emerald-800' :
                      overall === 2 ? 'bg-sky-100 text-sky-800' :
                      overall === 1 ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {getLevelBadgeText(overall)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {renderSignatures()}

      <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-amber-400 text-center text-[10px] font-bold text-amber-700 no-print flex items-center justify-center gap-2 bg-amber-50/60 py-1 rounded">
        <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
        <span>--- สิ้นสุดความยาวกระดาษ A4 หน้าที่ 1 (297 mm) ---</span>
      </div>
    </div>
  );

  // Render Tab 2: Characteristics Individual Student Detailed Sheet (8 ข้อและข้อย่อยทั้งหมด)
  const renderCharacteristicsIndividualSheet = () => {
    if (!targetIndividualStudent) {
      return (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl">
          ไม่พบข้อมูลนักเรียน
        </div>
      );
    }

    const rec = getStudentAssessment(targetIndividualStudent);
    const subScores = rec.characteristics?.subScores || {};

    return (
      <div 
        className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
        style={{ width: '210mm' }}
      >
        {renderA4Header('แบบประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ (รายบุคคล)')}

        {/* Student Info Bar: Strictly Single Line, No wrapping, No Grade Level, No Roll/Code */}
        <div className="mb-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] flex items-center justify-between gap-2 overflow-hidden">
          <div className="font-bold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5">
            <span className="text-slate-600 font-semibold">ชื่อ - นามสกุล:</span>
            <span className="text-slate-900 font-bold text-xs">{targetIndividualStudent.prefix}{targetIndividualStudent.firstName} {targetIndividualStudent.lastName}</span>
          </div>
        </div>

        {/* 8 Characteristics & All Sub-indicators Table */}
        <div className="overflow-x-auto border border-slate-300 rounded-sm">
          <table className="w-full text-left text-[9.5px] border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="py-1 px-2 border-r border-slate-300 text-left">
                  คุณลักษณะและตัวชี้วัด (8 คุณลักษณะอันพึงประสงค์)
                </th>
                <th className="py-1 px-1 border-r border-slate-300 text-center w-12">ดีเยี่ยม (3)</th>
                <th className="py-1 px-1 border-r border-slate-300 text-center w-12">ดี (2)</th>
                <th className="py-1 px-1 border-r border-slate-300 text-center w-12">ผ่าน (1)</th>
                <th className="py-1 px-1 text-center w-12">ไม่ผ่าน (0)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-800">
              {CHARACTERISTICS_GROUPS.map((grp) => {
                const itemScore = (rec.characteristics as any)?.[grp.itemKey] !== undefined ? (rec.characteristics as any)?.[grp.itemKey] : 3;

                return (
                  <React.Fragment key={grp.id}>
                    {/* Header Row for each Main Item */}
                    <tr className="bg-amber-50/70 font-bold text-amber-950">
                      <td className="py-0.5 px-2 border-r border-slate-200 text-[9.5px]">
                        {grp.title}
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 text-center font-mono">
                        {itemScore === 3 ? '✓' : ''}
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 text-center font-mono">
                        {itemScore === 2 ? '✓' : ''}
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 text-center font-mono">
                        {itemScore === 1 ? '✓' : ''}
                      </td>
                      <td className="py-0.5 px-1 text-center font-mono">
                        {itemScore === 0 ? '✓' : ''}
                      </td>
                    </tr>

                    {/* Sub-indicators for this item */}
                    {grp.indicators.map((ind) => {
                      const subSc = subScores[ind.id] !== undefined ? subScores[ind.id] : itemScore;
                      return (
                        <tr key={ind.id} className="hover:bg-slate-50 text-[8.5px] text-slate-700">
                          <td className="py-0.5 px-3 border-r border-slate-200 pl-6">
                            {ind.text}
                          </td>
                          <td className="py-0.5 px-1 border-r border-slate-200 text-center font-mono text-emerald-700 font-bold">
                            {subSc === 3 ? '✓' : ''}
                          </td>
                          <td className="py-0.5 px-1 border-r border-slate-200 text-center font-mono text-sky-700 font-bold">
                            {subSc === 2 ? '✓' : ''}
                          </td>
                          <td className="py-0.5 px-1 border-r border-slate-200 text-center font-mono text-amber-700 font-bold">
                            {subSc === 1 ? '✓' : ''}
                          </td>
                          <td className="py-0.5 px-1 text-center font-mono text-rose-700 font-bold">
                            {subSc === 0 ? '✓' : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {renderSignatures()}

        <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-amber-400 text-center text-[10px] font-bold text-amber-700 no-print flex items-center justify-center gap-2 bg-amber-50/60 py-1 rounded">
          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
          <span>--- สิ้นสุดความยาวกระดาษ A4 หน้าที่ 1 (297 mm) ---</span>
        </div>
      </div>
    );
  };

  // Render Tab 3: Competencies Sheet (สมรรถนะสำคัญ 5 ด้าน ตามตารางปกติ)
  const renderCompetenciesSheet = () => (
    <div 
      className="a4-portrait-paper bg-white border border-slate-300 shadow-xl rounded-sm p-4 sm:p-5 max-w-[210mm] min-h-[297mm] mx-auto text-slate-900 relative transition-all"
      style={{ width: '210mm' }}
    >
      {renderA4Header('แบบรายงานการประเมินสมรรถนะสำคัญของผู้เรียน 5 ด้าน', 'สรุปผลรายบุคคลทั้งห้องเรียน')}

      <div className="overflow-x-auto border border-slate-300 rounded-sm">
        <table className="w-full text-left text-[10px] border-collapse min-w-[680px]">
          <thead>
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

              {/* 5 Competencies */}
              <th className="py-1 px-1 border-r border-slate-300 text-center w-16 bg-blue-50/70 text-blue-950 font-bold">
                1. การสื่อสาร
              </th>
              <th className="py-1 px-1 border-r border-slate-300 text-center w-16 bg-blue-50/70 text-blue-950 font-bold">
                2. การคิด
              </th>
              <th className="py-1 px-1 border-r border-slate-300 text-center w-16 bg-blue-50/70 text-blue-950 font-bold">
                3. แก้ปัญหา
              </th>
              <th className="py-1 px-1 border-r border-slate-300 text-center w-16 bg-blue-50/70 text-blue-950 font-bold">
                4. ทักษะชีวิต
              </th>
              <th className="py-1 px-1 border-r border-slate-300 text-center w-16 bg-blue-50/70 text-blue-950 font-bold">
                5. เทคโนโลยี
              </th>

              <th rowSpan={2} className="py-1 px-1 text-center w-16 bg-blue-100/70 text-blue-950 font-bold">
                สรุปผล
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-800">
            {classStudents.map((s, idx) => {
              const rec = getStudentAssessment(s);
              const comp = rec.competency || ({} as any);

              const c1 = comp.comp1 !== undefined ? comp.comp1 : 3;
              const c2 = comp.comp2 !== undefined ? comp.comp2 : 3;
              const c3 = comp.comp3 !== undefined ? comp.comp3 : 3;
              const c4 = comp.comp4 !== undefined ? comp.comp4 : 3;
              const c5 = comp.comp5 !== undefined ? comp.comp5 : 3;
              const avg = Math.round((c1 + c2 + c3 + c4 + c5) / 5);
              const overall = comp.overallLevel !== undefined ? comp.overallLevel : avg;

              return (
                <tr key={s.id} className="hover:bg-slate-50 leading-tight">
                  <td className="py-1 px-0.5 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                    {s.rollNumber || idx + 1}
                  </td>
                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono tabular-nums text-slate-600 text-[9px]">
                    {s.studentCode || '-'}
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900 truncate max-w-[130px] text-[10px]">
                    {s.prefix}{s.firstName} {s.lastName}
                  </td>

                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-semibold">{c1}</td>
                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-semibold">{c2}</td>
                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-semibold">{c3}</td>
                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-semibold">{c4}</td>
                  <td className="py-1 px-1 border-r border-slate-200 text-center font-mono text-[9px] tabular-nums font-semibold">{c5}</td>

                  <td className="py-1 px-1 text-center text-[9px] font-bold">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                      overall === 3 ? 'bg-emerald-100 text-emerald-800' :
                      overall === 2 ? 'bg-sky-100 text-sky-800' :
                      overall === 1 ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {getLevelBadgeText(overall)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {renderSignatures()}

      <div className="a4-page-limit-line mt-6 pt-2 border-t-2 border-dashed border-blue-400 text-center text-[10px] font-bold text-blue-700 no-print flex items-center justify-center gap-2 bg-blue-50/60 py-1 rounded">
        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
        <span>--- สิ้นสุดความยาวกระดาษ A4 หน้าที่ 1 (297 mm) ---</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto a4-modal-overlay">
      <div className="bg-slate-100 rounded-2xl w-full max-w-[980px] max-h-[96vh] flex flex-col shadow-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150 my-auto a4-modal-content">
        
        {/* Top Header Bar (No-Print) */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
              <FileText className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>(3) รายงานผลการประเมิน {getGradeCleanName(grade)}</span>
                <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold border border-teal-200">
                  พรีวิว A4 แนวตั้ง
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                ปีการศึกษา {selectedYear} | ภาคเรียนที่ {selectedSemester} | นักเรียน {classStudents.length} คน
              </p>
            </div>
          </div>

          {/* 3 Main Tabs Selection */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('readingWriting')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'readingWriting'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              การอ่านคิดวิเคราะห์เขียน
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('characteristics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'characteristics'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              คุณลักษณะอันพึงประสงค์
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('competencies')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'competencies'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              สมรรถนะสำคัญ
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer ml-1"
              title="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-bar Controls (No-Print) */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tab 1: Reading/Writing Sub-page selector */}
            {activeTab === 'readingWriting' && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">หน้าเอกสาร:</span>
                <select
                  value={rwSubPage}
                  onChange={(e) => setRwSubPage(e.target.value as any)}
                  className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="all">แสดงทั้งหมด 4 หน้า A4 (ต่อเนื่อง)</option>
                  <option value="reading">1) การอ่าน (ตารางที่ 1)</option>
                  <option value="thinking">2) คิดวิเคราะห์ (ตารางที่ 2)</option>
                  <option value="writing">3) การเขียน (ตารางที่ 3)</option>
                  <option value="summary">4) สรุปปริมาณกับคุณภาพ</option>
                </select>
              </div>
            )}

            {/* Tab 2: Characteristics Mode & Student selector */}
            {activeTab === 'characteristics' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">รูปแบบรายงาน:</span>
                  <select
                    value={charSubView}
                    onChange={(e) => setCharSubView(e.target.value as any)}
                    className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="overview">สรุปข้อหลักทั้ง 8 ข้อ (ทุกคน)</option>
                    <option value="individual">ผลการประเมิน 8 ข้อและข้อย่อย (รายบุคคล)</option>
                  </select>
                </div>

                {charSubView === 'individual' && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">เลือกนักเรียน:</span>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="text-xs px-2.5 py-1 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20 max-w-[200px] truncate"
                    >
                      {classStudents.map(s => (
                        <option key={s.id} value={s.id}>
                          เลขที่ {s.rollNumber || '-'} {s.prefix}{s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Teacher and Academic Head Selectors */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">ครูประจำชั้น:</span>
                <select
                  value={selectedAdvisorId}
                  onChange={(e) => setSelectedAdvisorId(e.target.value)}
                  className="text-xs px-2 py-0.5 rounded-lg border border-slate-200 bg-white font-medium max-w-[150px] truncate"
                >
                  <option value="">-- อัตโนมัติ --</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.prefix}{p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-500">ฝ่ายวิชาการ:</span>
                <select
                  value={selectedAcademicHeadId}
                  onChange={(e) => setSelectedAcademicHeadId(e.target.value)}
                  className="text-xs px-2 py-0.5 rounded-lg border border-slate-200 bg-white font-medium max-w-[150px] truncate"
                >
                  <option value="">-- อัตโนมัติ --</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.prefix}{p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            <span>ผอ.: </span>
            <strong className="text-slate-800 font-bold">{directorDisplayName}</strong>
          </div>
        </div>

        {/* Modal Body: A4 Paper Preview Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-8 bg-slate-200/70 flex-1">
          {classStudents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8 space-y-2 max-w-[210mm] mx-auto">
              <Users className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                ยังไม่มีข้อมูลนักเรียนในชั้น {getGradeCleanName(grade)}
              </p>
              <p className="text-xs text-slate-400">
                กรุณาเพิ่มข้อมูลนักเรียนในระบบก่อนพิมพ์แบบรายงาน
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: การอ่าน คิดวิเคราะห์ และเขียน */}
              {activeTab === 'readingWriting' && (
                <>
                  {(rwSubPage === 'all' || rwSubPage === 'reading') && renderSingleRWTableSheet(readingTable, 1, 1)}
                  {(rwSubPage === 'all' || rwSubPage === 'thinking') && renderSingleRWTableSheet(thinkingTable, 2, 2)}
                  {(rwSubPage === 'all' || rwSubPage === 'writing') && renderSingleRWTableSheet(writingTable, 3, 3)}
                  {(rwSubPage === 'all' || rwSubPage === 'summary') && renderRWSummarySheet(4)}
                </>
              )}

              {/* TAB 2: คุณลักษณะอันพึงประสงค์ */}
              {activeTab === 'characteristics' && (
                <>
                  {charSubView === 'overview' && renderCharacteristicsOverviewSheet()}
                  {charSubView === 'individual' && renderCharacteristicsIndividualSheet()}
                </>
              )}

              {/* TAB 3: สมรรถนะสำคัญ */}
              {activeTab === 'competencies' && renderCompetenciesSheet()}
            </>
          )}
        </div>

        {/* Modal Footer (No-Print) */}
        <div className="px-4 py-3 bg-white border-t border-slate-200 rounded-b-2xl flex items-center justify-between gap-3 shrink-0 no-print">
          <span className="text-xs text-slate-500">
            พร้อมสำหรับการดาวน์โหลดเอกสาร PDF รูปแบบ A4 แนวตั้ง
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
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
};
