import React, { useState, useRef } from 'react';
import { 
  SchoolInfo, 
  MemberAccount, 
  UserSession,
  GradeLevel
} from '../types';
import { StorageService } from '../services/storage';
import { 
  Settings, 
  Building2, 
  Check, 
  Plus, 
  X, 
  Upload, 
  UserCheck, 
  Lock 
} from 'lucide-react';

interface SettingsProps {
  user: UserSession;
  schoolInfo: SchoolInfo;
  members: MemberAccount[];
  onClose: () => void;
  onSaveSchoolInfo: (info: SchoolInfo) => void;
  onSaveMember: (member: MemberAccount) => void;
  onDeleteMember?: (id: string) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg: string) => void;
  onSaveUserSession?: (user: UserSession) => void;
}

export const SettingsView: React.FC<SettingsProps> = ({
  user,
  schoolInfo,
  members,
  onClose,
  onSaveSchoolInfo,
  onSaveMember,
  onDeleteMember,
  onShowToast,
  onSaveUserSession
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'school'>(user.role === 'admin' ? 'school' : 'profile');

  // Profile Form States (Requirement 10.2)
  const [userPrefix, setUserPrefix] = useState<string>(user.prefix || 'ครู');
  const [userFirstName, setUserFirstName] = useState<string>(
    user.firstName || user.fullName.split(' ')[0] || ''
  );
  const [userLastName, setUserLastName] = useState<string>(
    user.lastName || user.fullName.split(' ').slice(1).join(' ') || ''
  );
  const [userGradeLevel, setUserGradeLevel] = useState<string>(
    (user.assignedGrade as string) || 'ป.1'
  );
  const [userLearningGroup, setUserLearningGroup] = useState<string>(
    user.learningGroup || 'กลุ่มสาระการเรียนรู้ภาษาไทย'
  );
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>(
    user.avatarUrl || ''
  );
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // School Logo state
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string>(schoolInfo.logoUrl || '');
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Academic Years state & Add Year Modal state
  const [academicYears, setAcademicYears] = useState<string[]>(() => StorageService.getAcademicYears());
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(schoolInfo.academicYear || '2569');
  const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');

  const handleAddNewAcademicYear = () => {
    const trimmed = newYearInput.trim();
    if (!trimmed) {
      onShowToast('warning', 'กรอกปีการศึกษา', 'กรุณากรอกปีการศึกษา (เช่น 2570)');
      return;
    }
    const updated = StorageService.addAcademicYear(trimmed);
    setAcademicYears(updated);
    setSelectedAcademicYear(trimmed);
    setIsAddYearModalOpen(false);
    setNewYearInput('');
    onShowToast('success', 'เพิ่มปีการศึกษาสำเร็จ', `เพิ่มปีการศึกษา ${trimmed} เข้าสู่ระบบเรียบร้อยแล้ว`);
  };

  // Handle Logo Image File Change
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('warning', 'ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setSchoolLogoUrl(dataUrl);
          onShowToast('info', 'เลือกรูปโลโก้สำเร็จ', 'กดบันทึกข้อมูลโรงเรียนด้านล่างเพื่อจัดเก็บตราสัญลักษณ์ลง Google Drive');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle User Avatar File Change (Requirement 10.2)
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('warning', 'ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setUserAvatarUrl(dataUrl);
          onShowToast('info', 'เลือกรูปโปรไฟล์สำเร็จ', 'กดบันทึกข้อมูลส่วนตัวด้านล่างเพื่อจัดเก็บรูปโปรไฟล์ลง Google Drive');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Save Profile Form (Requirement 10.2)
  const handleSaveProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const full = `${userPrefix} ${userFirstName} ${userLastName}`.trim();

    const updatedUser: UserSession = {
      ...user,
      prefix: userPrefix,
      firstName: userFirstName,
      lastName: userLastName,
      fullName: full || user.fullName,
      assignedGrade: userGradeLevel === 'ไม่ได้เป็นครูประจำชั้น' ? undefined : userGradeLevel,
      learningGroup: userLearningGroup,
      avatarUrl: userAvatarUrl
    };

    if (onSaveUserSession) {
      onSaveUserSession(updatedUser);
    } else {
      StorageService.setSession(updatedUser);
    }

    // Also update member list record if match
    const foundMem = members.find(m => m.id === user.id || m.username.toLowerCase() === user.username.toLowerCase());
    if (foundMem) {
      onSaveMember({
        ...foundMem,
        prefix: userPrefix,
        firstName: userFirstName,
        lastName: userLastName,
        fullName: full || foundMem.fullName,
        gradeLevel: (userGradeLevel === 'ไม่ได้เป็นครูประจำชั้น' ? undefined : userGradeLevel) as GradeLevel,
        learningGroup: userLearningGroup,
        avatarUrl: userAvatarUrl
      });
    }

    onShowToast('success', 'บันทึกข้อมูลส่วนตัวสำเร็จ 🎉', 'อัปเดตข้อมูลส่วนตัว รูปโปรไฟล์ และกลุ่มสาระการเรียนรู้เรียบร้อยแล้ว');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-indigo-400 flex items-center justify-center border border-slate-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">ตั้งค่าระบบ (System Settings)</h2>
              <p className="text-xs text-slate-400">
                จัดการฐานข้อมูล Google Sheets, บัญชีสมาชิก และข้อมูลโปรไฟล์ส่วนตัว
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="ปิดหน้าต่างตั้งค่า"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Tabs Bar */}
        <div className="bg-slate-100/80 px-6 py-2 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {user.role !== 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>โปรไฟล์ & ข้อมูลส่วนตัว</span>
            </button>
          )}

          {/* Member management removed from Admin settings (Developer only) */}

          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('school')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'school'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>ตั้งค่าโรงเรียน</span>
            </button>
          )}

          {/* Google Sheets tab removed (Developer only) */}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 0: PERSONAL PROFILE SETTINGS (Requirement 10.2) */}
          {user.role !== 'admin' && activeTab === 'profile' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs max-w-2xl mx-auto space-y-5">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    <span>ตั้งค่าโปรไฟล์และข้อมูลส่วนตัว</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    อัปโหลดรูปประจำตัว กำหนดคำนำหน้า ชื่อ-สกุล ชั้นประจำชั้น และกลุ่มสาระการเรียนรู้
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${
                  user.role === 'developer'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {user.role === 'developer' ? 'ผู้พัฒนาระบบ (Developer)' : 'ครูผู้สอน / สมาชิก'}
                </span>
              </div>

              <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
                {/* 1. Avatar Image Upload */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    รูปประจำตัว / รูปโปรไฟล์ (อัปโหลดจากอุปกรณ์) *
                  </label>

                  <input
                    type="file"
                    ref={avatarFileInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />

                  <div className="flex items-center gap-4 pt-1">
                    <div
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-indigo-300 hover:border-indigo-500 overflow-hidden flex items-center justify-center cursor-pointer transition-all shrink-0 shadow-2xs group relative"
                      title="คลิกเพื่อเลือกไฟล์รูปภาพโปรไฟล์"
                    >
                      {userAvatarUrl ? (
                        <>
                          <img
                            src={userAvatarUrl}
                            alt="Profile Avatar"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                            เปลี่ยนรูป
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-indigo-400 p-2 text-center">
                          <Upload className="w-5 h-5 mb-1" />
                          <span className="text-[10px] font-bold text-indigo-600">อัปโหลดรูป</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => avatarFileInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{userAvatarUrl ? 'เปลี่ยนรูปภาพโปรไฟล์' : 'เลือกไฟล์รูปภาพโปรไฟล์'}</span>
                        </button>

                        {userAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => setUserAvatarUrl('')}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                          >
                            ลบรูป
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        รองรับไฟล์ JPG, PNG, WebP
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Prefix & Names */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      คำนำหน้า *
                    </label>
                    <select
                      value={userPrefix}
                      onChange={(e) => setUserPrefix(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer"
                    >
                      <option value="นาย">นาย</option>
                      <option value="นาง">นาง</option>
                      <option value="นางสาว">นางสาว</option>
                      <option value="ดร.">ดร.</option>
                      <option value="ครู">ครู</option>
                      <option value="ว่าที่ ร.ต.">ว่าที่ ร.ต.</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อจริง *
                    </label>
                    <input
                      type="text"
                      required
                      value={userFirstName}
                      onChange={(e) => setUserFirstName(e.target.value)}
                      placeholder="ชื่อ"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      นามสกุล *
                    </label>
                    <input
                      type="text"
                      required
                      value={userLastName}
                      onChange={(e) => setUserLastName(e.target.value)}
                      placeholder="นามสกุล"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>
                </div>

                {/* 3. Grade & Learning Group */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ครูประจำชั้นระดับชั้น *
                    </label>
                    <select
                      value={userGradeLevel}
                      onChange={(e) => setUserGradeLevel(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer"
                    >
                      <option value="อ.1">ชั้นอนุบาล 1 (อ.1)</option>
                      <option value="อ.2">ชั้นอนุบาล 2 (อ.2)</option>
                      <option value="อ.3">ชั้นอนุบาล 3 (อ.3)</option>
                      <option value="ป.1">ชั้นประถมศึกษาปีที่ 1 (ป.1)</option>
                      <option value="ป.2">ชั้นประถมศึกษาปีที่ 2 (ป.2)</option>
                      <option value="ป.3">ชั้นประถมศึกษาปีที่ 3 (ป.3)</option>
                      <option value="ป.4">ชั้นประถมศึกษาปีที่ 4 (ป.4)</option>
                      <option value="ป.5">ชั้นประถมศึกษาปีที่ 5 (ป.5)</option>
                      <option value="ป.6">ชั้นประถมศึกษาปีที่ 6 (ป.6)</option>
                      <option value="ม.1">ชั้นมัธยมศึกษาปีที่ 1 (ม.1)</option>
                      <option value="ม.2">ชั้นมัธยมศึกษาปีที่ 2 (ม.2)</option>
                      <option value="ม.3">ชั้นมัธยมศึกษาปีที่ 3 (ม.3)</option>
                      <option value="ม.4">ชั้นมัธยมศึกษาปีที่ 4 (ม.4)</option>
                      <option value="ม.5">ชั้นมัธยมศึกษาปีที่ 5 (ม.5)</option>
                      <option value="ม.6">ชั้นมัธยมศึกษาปีที่ 6 (ม.6)</option>
                      <option value="ไม่ได้เป็นครูประจำชั้น">ไม่ได้เป็นครูประจำชั้น</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      กลุ่มสาระการเรียนรู้ *
                    </label>
                    <select
                      value={userLearningGroup}
                      onChange={(e) => setUserLearningGroup(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white cursor-pointer"
                    >
                      <option value="กลุ่มสาระการเรียนรู้ภาษาไทย">กลุ่มสาระการเรียนรู้ภาษาไทย</option>
                      <option value="กลุ่มสาระการเรียนรู้คณิตศาสตร์">กลุ่มสาระการเรียนรู้คณิตศาสตร์</option>
                      <option value="กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี">กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี</option>
                      <option value="กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม">กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม</option>
                      <option value="กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา">กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา</option>
                      <option value="กลุ่มสาระการเรียนรู้ศิลปะ">กลุ่มสาระการเรียนรู้ศิลปะ</option>
                      <option value="กลุ่มสาระการเรียนรู้การงานอาชีพ">กลุ่มสาระการเรียนรู้การงานอาชีพ</option>
                      <option value="กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ">กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ</option>
                      <option value="งานบริหารวิชาการ / ธุรการโรงเรียน">งานบริหารวิชาการ / ธุรการโรงเรียน</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>บันทึกข้อมูลส่วนตัว</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Google Sheets tab content removed (Developer only) */}

          {/* Member management tab removed (Developer only) */}

          {/* TAB 3: SCHOOL SETTINGS */}
          {user.role === 'admin' && activeTab === 'school' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs max-w-2xl mx-auto space-y-5">

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  const updated: SchoolInfo = {
                    ...schoolInfo,
                    schoolName: fd.get('schoolName') as string,
                    schoolCode: fd.get('schoolCode') as string,
                    affiliation: fd.get('affiliation') as string,
                    logoUrl: schoolLogoUrl,
                    academicYear: fd.get('academicYear') as string,
                    semester: fd.get('semester') as string
                  };
                  onSaveSchoolInfo(updated);
                  onShowToast('success', 'บันทึกสำเร็จ', 'อัปเดตข้อมูลโรงเรียนและตราสัญลักษณ์เรียบร้อยแล้ว');
                }}
                className="space-y-4"
              >
                {/* School Emblem / Logo File Upload Picker */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    ตราสัญลักษณ์ / โลโก้โรงเรียน (อัปโหลดรูปภาพจากอุปกรณ์)
                  </label>

                  <input
                    type="file"
                    ref={logoFileInputRef}
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />

                  <div className="flex items-center gap-4 pt-1">
                    <div
                      onClick={() => logoFileInputRef.current?.click()}
                      className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-slate-300 hover:border-emerald-500 overflow-hidden flex items-center justify-center cursor-pointer transition-all shrink-0 shadow-2xs group relative"
                      title="คลิกเพื่อเลือกไฟล์ตราสัญลักษณ์โรงเรียน"
                    >
                      {schoolLogoUrl ? (
                        <>
                          <img
                            src={schoolLogoUrl}
                            alt="School Logo"
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                            เปลี่ยนรูป
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                          <Upload className="w-5 h-5 text-emerald-600 mb-1" />
                          <span className="text-[10px] font-semibold text-slate-600">อัปโหลดตราสัญลักษณ์</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{schoolLogoUrl ? 'เปลี่ยนไฟล์รูปภาพตราสัญลักษณ์' : 'เลือกไฟล์รูปภาพจากอุปกรณ์'}</span>
                        </button>

                        {schoolLogoUrl && (
                          <button
                            type="button"
                            onClick={() => setSchoolLogoUrl('')}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                          >
                            ลบรูป
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        รองรับไฟล์ JPG, PNG, WebP (ระบบจะบีบอัดภาพให้อัตโนมัติ เพื่อนำไปแสดงในหัวกระดาษและรายงาน)
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อโรงเรียน *
                  </label>
                  <input
                    type="text"
                    name="schoolName"
                    required
                    defaultValue={schoolInfo.schoolName}
                    placeholder="เช่น บ้านนาออก"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                  />

                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      รหัสสถานศึกษา
                    </label>
                    <input
                      type="text"
                      name="schoolCode"
                      defaultValue={schoolInfo.schoolCode}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      สังกัดหน่วยงาน
                    </label>
                    <input
                      type="text"
                      name="affiliation"
                      defaultValue={schoolInfo.affiliation}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-indigo-950">
                        ปีการศึกษาหลักของระบบ *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextYr = String(Math.max(...academicYears.map(Number), 2568) + 1);
                          setNewYearInput(nextYr);
                          setIsAddYearModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title="คลิกเพื่อเพิ่มปีการศึกษาใหม่"
                      >
                        <Plus className="w-3 h-3" />
                        <span>เพิ่มปีการศึกษา</span>
                      </button>
                    </div>

                    <select
                      name="academicYear"
                      value={selectedAcademicYear}
                      onChange={(e) => setSelectedAcademicYear(e.target.value)}
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-950 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {academicYears.map(yr => (
                        <option key={yr} value={yr}>ปีการศึกษา {yr}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-indigo-950 mb-1">
                      ภาคเรียนหลักของระบบ *
                    </label>
                    <select
                      name="semester"
                      defaultValue={schoolInfo.semester}
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-950 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="1">ภาคเรียนที่ 1</option>
                      <option value="2">ภาคเรียนที่ 2</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 text-[11px] text-indigo-900 bg-white/80 p-2.5 rounded-xl border border-indigo-100 flex items-start gap-2">
                    <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>ล็อกการแสดงผลของสมาชิก (ครูประจำชั้น):</strong> ปีการศึกษาและภาคเรียนนี้จะถูกใช้เป็นค่าหลักในทุกระบบ (เวลาเรียน, งานวัดผล, ธุรการ, ปฏิทินวิชาการ) ทำให้สมาชิกแสดงข้อมูลตรงกันและไม่สามารถกดเปลี่ยนเองได้
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer active:scale-95"
                  >
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* MODAL: Admin Add Academic Year */}
      {isAddYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>เพิ่มปีการศึกษาใหม่</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ปีการศึกษา (พ.ศ.) *
                </label>
                <input
                  type="text"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                  placeholder="เช่น 2570"
                  autoFocus
                  className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                เมื่อเพิ่มแล้ว ปีการศึกษานี้จะปรากฏในตัวเลือกของทั้งระบบ และสามารถเลือกเป็นปีการศึกษาหลักได้
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleAddNewAcademicYear}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>เพิ่มปีการศึกษา</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
