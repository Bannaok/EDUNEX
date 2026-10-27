import React, { useState, useMemo } from 'react';
import { Student, SchoolInfo, GradeLevel } from '../types';
import { 
  Printer, 
  Download, 
  X, 
  CreditCard, 
  GraduationCap, 
  Phone, 
  Calendar, 
  User, 
  QrCode,
  ShieldCheck,
  Check
} from 'lucide-react';

interface StudentCardBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  schoolInfo: SchoolInfo;
  initialSide?: 'front' | 'back';
  initialGrade?: string;
  onShowToast?: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg: string) => void;
}

const CARDS_PER_A4_PAGE = 8; // 2 columns x 4 rows fits standard CR80 (85.6mm x 54mm) on A4 Portrait

export const StudentCardBatchModal: React.FC<StudentCardBatchModalProps> = ({
  isOpen,
  onClose,
  students,
  schoolInfo,
  initialSide = 'front',
  initialGrade = 'all',
  onShowToast
}) => {
  const [cardSide, setCardSide] = useState<'front' | 'back'>(initialSide);
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade);

  // Sync initial side or grade if props change
  React.useEffect(() => {
    if (isOpen) {
      setCardSide(initialSide);
      if (initialGrade && initialGrade !== 'ประถม' && initialGrade !== 'มัธยม') {
        setSelectedGrade(initialGrade);
      } else {
        setSelectedGrade('all');
      }
    }
  }, [isOpen, initialSide, initialGrade]);

  // Available grade levels present in the school's students
  const availableGrades = useMemo(() => {
    const gradeOrder: GradeLevel[] = [
      'อ.1', 'อ.2', 'อ.3',
      'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
      'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'
    ];
    const unique = Array.from(new Set(students.map(s => s.gradeLevel))).filter(Boolean);
    return gradeOrder.filter(g => unique.includes(g));
  }, [students]);

  // Filter students based on selected grade
  const targetStudents = useMemo(() => {
    const list = selectedGrade === 'all'
      ? students
      : students.filter(s => s.gradeLevel === selectedGrade);

    return [...list].sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) {
        return a.gradeLevel.localeCompare(b.gradeLevel);
      }
      if (a.rollNumber !== undefined && b.rollNumber !== undefined) {
        return a.rollNumber - b.rollNumber;
      }
      if (a.rollNumber !== undefined) return -1;
      if (b.rollNumber !== undefined) return 1;
      return (a.studentCode || '').localeCompare(b.studentCode || '');
    });
  }, [students, selectedGrade]);

  // Chunk students into pages of 8 cards
  const studentPages = useMemo(() => {
    const pages: Student[][] = [];
    for (let i = 0; i < targetStudents.length; i += CARDS_PER_A4_PAGE) {
      pages.push(targetStudents.slice(i, i + CARDS_PER_A4_PAGE));
    }
    return pages;
  }, [targetStudents]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
    if (onShowToast) {
      onShowToast(
        'success',
        'เตรียมพิมพ์ / บันทึก PDF',
        `พร้อมพิมพ์บัตรนักเรียน (${cardSide === 'front' ? 'หน้าบัตร' : 'หลังบัตร'}) ขนาด 85.6 × 54 มม. บนกระดาษ A4 แนวตั้ง`
      );
    }
  };

  // Helper date formatter
  const formatThaiBirthDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const shortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const thaiYear = y > 2400 ? y : y + 543;
        return `${d} ${shortMonths[m] || ''} ${thaiYear}`;
      }
    } catch {}
    return dateStr;
  };

  const academicYear = schoolInfo.academicYear || '2569';
  const nextYear = String(parseInt(academicYear, 10) + 1);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden">
      {/* Print Specific CSS Styles injected for pixel-perfect A4 printing */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .student-card-a4-page {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 11mm 13.5mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            display: grid !important;
            grid-template-columns: repeat(2, 85.6mm) !important;
            grid-template-rows: repeat(4, 54mm) !important;
            column-gap: 8.5mm !important;
            row-gap: 6.5mm !important;
            justify-content: center !important;
            align-content: center !important;
          }
          .student-card-a4-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .student-card-item {
            width: 85.6mm !important;
            height: 54mm !important;
            min-width: 85.6mm !important;
            max-width: 85.6mm !important;
            min-height: 54mm !important;
            max-height: 54mm !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* MODAL HEADER TOOLBAR (no-print) */}
      <div className="no-print bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 shadow-xs z-10 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>พิมพ์บัตรนักเรียน (85.6 × 54 มม.)</span>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                กระดาษ A4 แนวตั้ง ({targetStudents.length} คน • {studentPages.length} หน้า)
              </span>
            </h3>
          </div>
        </div>

        {/* Controls: Card Side Toggle + Grade Level Selector + Print Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Side Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setCardSide('front')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                cardSide === 'front'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>หน้าบัตร</span>
            </button>
            <button
              type="button"
              onClick={() => setCardSide('back')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                cardSide === 'back'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>หลังบัตร</span>
            </button>
          </div>

          {/* Grade Selector */}
          <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">ระดับชั้น:</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="bg-transparent text-xs font-bold text-blue-900 outline-none cursor-pointer py-0.5"
            >
              <option value="all">ทุกระดับชั้น ({students.length} คน)</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>
                  ชั้น {g} ({students.filter(s => s.gradeLevel === g).length} คน)
                </option>
              ))}
            </select>
          </div>

          {/* Print/Download Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="พิมพ์หรือดาวน์โหลดเป็นไฟล์ PDF บนกระดาษ A4 แนวตั้ง"
          >
            <Printer className="w-4 h-4" />
            <Download className="w-4 h-4" />
            <span>พิมพ์ / ดาวน์โหลด PDF</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PREVIEW CONTAINER (Scrollable on screen, 100% clean on print) */}
      <div className="flex-1 overflow-auto bg-slate-300/80 p-4 sm:p-8 flex flex-col items-center">
        {targetStudents.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center max-w-md w-full shadow-lg border border-slate-200 my-auto">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">ไม่มีข้อมูลนักเรียนในชั้นที่เลือก</p>
            <p className="text-xs text-slate-500 mt-1">กรุณาเลือกระดับชั้นที่มีข้อมูลนักเรียน</p>
          </div>
        ) : (
          studentPages.map((pageStudents, pageIdx) => (
            <div
              key={`a4-page-${pageIdx}`}
              className="student-card-a4-page bg-white shadow-2xl mb-8 border border-slate-300/80 grid grid-cols-2 justify-center items-center relative"
              style={{
                width: '210mm',
                minHeight: '297mm',
                maxHeight: '297mm',
                height: '297mm',
                padding: '11mm 13.5mm',
                columnGap: '8.5mm',
                rowGap: '6.5mm',
                boxSizing: 'border-box'
              }}
            >
              {/* Page Number indicator for screen view */}
              <div className="no-print absolute top-2 right-4 text-[10px] text-slate-400 font-mono font-medium">
                หน้า A4 ที่ {pageIdx + 1} / {studentPages.length} ({cardSide === 'front' ? 'หน้าบัตร' : 'หลังบัตร'})
              </div>

              {pageStudents.map((student) => {
                const rollDisplay = student.rollNumber !== undefined ? student.rollNumber : '-';
                const codeDisplay = student.studentCode || '-';
                const idCardDisplay = student.idCard || student.citizenId || '-';
                const emergencyPhone = student.guardianPhone || student.fatherPhone || student.motherPhone || schoolInfo.phone || '-';

                return (
                  <div
                    key={student.id}
                    className="student-card-item rounded-[3mm] border border-slate-300 relative overflow-hidden bg-white shadow-2xs select-none"
                    style={{
                      width: '85.6mm',
                      height: '54mm',
                      minWidth: '85.6mm',
                      maxWidth: '85.6mm',
                      minHeight: '54mm',
                      maxHeight: '54mm',
                      boxSizing: 'border-box'
                    }}
                  >
                    {cardSide === 'front' ? (
                      /* ===================== FRONT OF CARD (หน้าบัตร 85.6 x 54 mm) ===================== */
                      <div className="w-full h-full flex flex-col justify-between bg-white relative">
                        {/* Decorative Top Background Header */}
                        <div className="h-[12.5mm] bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-2 py-1 flex items-center justify-between relative overflow-hidden shrink-0">
                          {/* Subtle background crest accent */}
                          <div className="absolute -right-3 -bottom-3 w-14 h-14 rounded-full bg-white/5 pointer-events-none" />

                          {/* Logo + School Title */}
                          <div className="flex items-center gap-1.5 z-10 min-w-0">
                            {schoolInfo.logoUrl ? (
                              <img
                                src={schoolInfo.logoUrl}
                                alt="Logo"
                                className="w-[8mm] h-[8mm] object-contain rounded-full bg-white/10 p-0.5 shrink-0"
                              />
                            ) : (
                              <div className="w-[8mm] h-[8mm] rounded-full bg-amber-400 text-blue-950 font-black text-[9px] flex items-center justify-center shrink-0 shadow-xs">
                                รร
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="text-[9px] font-black text-amber-300 leading-tight truncate tracking-tight">
                                {schoolInfo.schoolName || 'โรงเรียนวัดผลประเมินพัฒนาการ'}
                              </h4>
                              <p className="text-[6.5px] text-blue-100 font-medium leading-none mt-0.5 truncate">
                                บัตรประจำตัวนักเรียน • STUDENT CARD
                              </p>
                            </div>
                          </div>

                          {/* Academic Year Badge */}
                          <div className="z-10 bg-amber-400/90 text-blue-950 text-[6.5px] font-extrabold px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap shrink-0">
                            ปีการศึกษา {academicYear}
                          </div>
                        </div>

                        {/* Thin Gold accent stripe */}
                        <div className="h-[1mm] bg-amber-400 shrink-0" />

                        {/* Card Body */}
                        <div className="flex-1 px-2.5 py-1.5 flex items-center gap-2.5 min-w-0">
                          {/* Left Column: Photo & Student Code */}
                          <div className="w-[22mm] flex flex-col items-center shrink-0">
                            <div className="w-[21mm] h-[26.5mm] rounded-[2mm] border border-blue-300 bg-slate-50 overflow-hidden flex items-center justify-center shadow-2xs">
                              {student.photoUrl ? (
                                <img
                                  src={student.photoUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
                                  <User className="w-7 h-7 text-slate-300" />
                                  <span className="text-[6px] text-slate-400 font-bold mt-0.5">ไม่มีรูปถ่าย</span>
                                </div>
                              )}
                            </div>
                            <div className="text-[6.5px] font-bold font-mono text-blue-950 text-center mt-1 bg-blue-50 px-1 py-0.2 rounded border border-blue-200 w-full truncate">
                              ID: {codeDisplay}
                            </div>
                          </div>

                          {/* Right Column: Particulars & Official Seal */}
                          <div className="flex-1 flex flex-col justify-between h-full min-w-0 py-0.5">
                            {/* Student Name */}
                            <div className="border-b border-slate-200/80 pb-1">
                              <h3 className="text-[10px] font-black text-slate-900 leading-tight truncate">
                                {student.prefix}{student.firstName} {student.lastName}
                              </h3>
                              {student.nickname && (
                                <p className="text-[7px] text-slate-500 font-medium leading-none mt-0.5">
                                  ชื่อเล่น: {student.nickname}
                                </p>
                              )}
                            </div>

                            {/* Particulars grid */}
                            <div className="space-y-0.5 text-[7px] text-slate-700 py-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-medium">เลขประชาชน:</span>
                                <span className="font-mono font-bold text-slate-900 truncate">{idCardDisplay}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 font-medium">ระดับชั้น:</span>
                                  <span className="font-bold text-blue-900">
                                    ชั้น {student.gradeLevel}{student.room ? `/${student.room}` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 pr-1">
                                  <span className="text-slate-400 font-medium">เลขที่:</span>
                                  <span className="font-bold text-slate-900">{rollDisplay}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[6.5px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400">วันเกิด:</span>
                                  <span className="font-medium text-slate-800">{formatThaiBirthDate(student.birthDate)}</span>
                                </div>
                                {student.bloodGroup && (
                                  <div className="flex items-center gap-0.5 pr-1">
                                    <span className="text-slate-400">เลือด:</span>
                                    <span className="font-bold text-rose-700">{student.bloodGroup}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Director Signature verification */}
                            <div className="border-t border-slate-100 pt-0.5 flex items-center justify-between">
                              <div className="text-[5.5px] text-slate-400 font-medium">
                                ออกโดย {schoolInfo.schoolName || 'สถานศึกษา'}
                              </div>
                              <div className="text-right">
                                <p className="text-[6.5px] font-bold text-slate-800 leading-none">
                                  ( {schoolInfo.directorName || 'ผู้อำนวยการโรงเรียน'} )
                                </p>
                                <p className="text-[5.5px] text-slate-500 leading-none mt-0.5">
                                  ผู้อำนวยการสถานศึกษา
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Micro bottom strip */}
                        <div className="h-[2mm] bg-blue-900 flex items-center justify-between px-2 text-[5px] text-blue-200 shrink-0 font-medium">
                          <span>กระทรวงศึกษาธิการ • MINISTRY OF EDUCATION</span>
                          <span className="font-mono">VALID THRU 03/{nextYear}</span>
                        </div>
                      </div>
                    ) : (
                      /* ===================== BACK OF CARD (หลังบัตร 85.6 x 54 mm) ===================== */
                      <div className="w-full h-full flex flex-col justify-between bg-slate-50 relative p-2 text-slate-800">
                        {/* Header School Info */}
                        <div className="border-b border-slate-200 pb-1 text-center">
                          <h4 className="text-[8.5px] font-black text-blue-950 leading-tight">
                            {schoolInfo.schoolName || 'โรงเรียนวัดผลประเมินพัฒนาการ'}
                          </h4>
                          <p className="text-[6px] text-slate-500 leading-tight mt-0.5 truncate">
                            {schoolInfo.address || ''} {schoolInfo.subdistrict ? `ต.${schoolInfo.subdistrict}` : ''} {schoolInfo.district ? `อ.${schoolInfo.district}` : ''} {schoolInfo.province ? `จ.${schoolInfo.province}` : ''} {schoolInfo.postalCode || ''}
                          </p>
                          <p className="text-[6px] text-slate-500 leading-tight">
                            โทรศัพท์: {schoolInfo.phone || '-'} {schoolInfo.affiliation ? `• สังกัด ${schoolInfo.affiliation}` : ''}
                          </p>
                        </div>

                        {/* Card Rules / Regulations */}
                        <div className="py-1 px-1 bg-white rounded border border-slate-200 text-[6px] text-slate-700 space-y-0.5 leading-snug">
                          <div className="font-bold text-blue-900 text-[6.5px] mb-0.5">ข้อปฏิบัติในการใช้บัตรประจำตัวนักเรียน:</div>
                          <p>1. บัตรนี้เป็นเอกสารแสดงตนของผู้ถือบัตร และเป็นสมบัติของโรงเรียน</p>
                          <p>2. นักเรียนต้องพกติดตัวตลอดเวลาขณะอยู่ในสถานศึกษา และแสดงเมื่อเจ้าหน้าที่ร้องขอ</p>
                          <p>3. ใช้ในการติดต่อราชการ เข้าห้องสอบ ยืม-คืนหนังสือห้องสมุด และร่วมกิจกรรม</p>
                          <p>4. หากเก็บบัตรนี้ได้ กรุณาส่งคืนสถานศึกษาตามที่อยู่ข้างต้น หรือหย่อนลงตู้ไปรษณีย์</p>
                        </div>

                        {/* Student Details Summary Bar */}
                        <div className="flex items-center justify-between bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200 text-[6.5px]">
                          <div>
                            <span className="text-slate-500">ผู้ถือบัตร: </span>
                            <span className="font-bold text-slate-900">
                              {student.prefix}{student.firstName} {student.lastName} (ชั้น {student.gradeLevel}{student.room ? `/${student.room}` : ''})
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">ฉุกเฉินโทร: </span>
                            <span className="font-bold font-mono text-rose-700">{emergencyPhone}</span>
                          </div>
                        </div>

                        {/* Barcode & Security strip simulation */}
                        <div className="flex items-center justify-between pt-0.5 border-t border-slate-200">
                          {/* Simulated Barcode */}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-[1px] h-3">
                              {Array.from({ length: 38 }).map((_, idx) => (
                                <div
                                  key={idx}
                                  className="h-full bg-slate-900"
                                  style={{
                                    width: idx % 4 === 0 ? '2px' : idx % 3 === 0 ? '1.5px' : '0.8px',
                                    opacity: idx % 5 === 0 ? 0.3 : 1
                                  }}
                                />
                              ))}
                            </div>
                            <span className="text-[5.5px] font-mono text-slate-500">
                              *{codeDisplay}*
                            </span>
                          </div>

                          {/* Validity dates */}
                          <div className="text-right text-[6px] text-slate-600 space-y-0.2">
                            <div>วันออกบัตร: 16 พ.ค. {academicYear}</div>
                            <div className="font-bold text-blue-900">วันหมดอายุ: 31 มี.ค. {nextYear}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
