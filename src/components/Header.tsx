import React from 'react';
import { SchoolInfo, UserSession, GoogleConfig } from '../types';
import { 
  GraduationCap, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  LogOut, 
  UserCheck, 
  ShieldCheck, 
  Sparkles,
  RefreshCw,
  Settings,
  Terminal
} from 'lucide-react';

interface HeaderProps {
  schoolInfo: SchoolInfo;
  user: UserSession;
  googleConfig: GoogleConfig;
  studentsCount?: number;
  personnelCount?: number;
  attendanceRate?: number;
  onOpenSettings: () => void;
  onLogout: () => void;
  onSyncAll: () => void;
  isSyncing: boolean;
  onReturnToDevConsole?: () => void;
  isInspectingSchool?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  schoolInfo,
  user,
  googleConfig,
  studentsCount = 0,
  personnelCount = 0,
  attendanceRate = 100,
  onOpenSettings,
  onLogout,
  onSyncAll,
  isSyncing,
  onReturnToDevConsole,
  isInspectingSchool = false
}) => {
  return (
    <header className="bg-gradient-to-r from-[#11244e] via-[#173b75] to-[#1e293b] text-white shadow-md border-b border-blue-900/60">
      {/* Top micro bar: Google Sheets status if connected */}
      {googleConfig.isConnected && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 border-b border-white/10 flex flex-wrap items-center justify-end text-xs text-indigo-100/90 gap-2">
          <div className="flex items-center gap-3">
            {/* Sync Button */}
            <button
              onClick={onSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1 text-[11px] text-indigo-200 hover:text-white transition-colors cursor-pointer"
              title="ซิงค์ข้อมูลกับ Google Sheets"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>ซิงค์ชีต</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Branding & User bar */}
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-white/30 p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            <img
              src={schoolInfo.logoUrl || '/nexus-logo.png'}
              alt={schoolInfo.schoolName || 'School Logo'}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/nexus-logo.png';
              }}
            />
          </div>

          <div>
            <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-white leading-tight">
              {schoolInfo.schoolName ? (schoolInfo.schoolName.startsWith('โรงเรียน') ? schoolInfo.schoolName : `โรงเรียน${schoolInfo.schoolName}`) : 'โรงเรียนบ้านนาออก'}
            </h1>

            {/* Small stats in blue header: Only นักเรียนทั้งหมด, ครูและบุคลากร, มาเรียนวันนี้ */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-indigo-200 mt-0.5 font-normal">
              <span>นักเรียนทั้งหมด <strong className="text-white font-bold tabular-nums">{studentsCount}</strong> คน</span>
              <span className="text-indigo-400/60" aria-hidden="true">·</span>
              <span>ครูและบุคลากร <strong className="text-white font-bold tabular-nums">{personnelCount}</strong> ท่าน</span>
              <span className="text-indigo-400/60" aria-hidden="true">·</span>
              <span>มาเรียนวันนี้ <strong className="text-emerald-300 font-bold tabular-nums">{attendanceRate}%</strong></span>
            </div>
          </div>
        </div>

        {/* User Session, Settings & Logout */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* If Developer is inspecting a school, show quick return button */}
          {user.role === 'developer' && isInspectingSchool && onReturnToDevConsole && (
            <button
              onClick={onReturnToDevConsole}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-purple-400/40"
              title="กลับสู่หน้าต่างผู้พัฒนา"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>กลับสู่ Developer Console</span>
            </button>
          )}

          {/* Clean User Display Badge (read-only, not a switcher) */}
          <div 
            className="flex items-center gap-2.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl backdrop-blur-xs select-none"
            title={`เข้าสู่ระบบในฐานะ: ${user.fullName}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
              user.role === 'developer'
                ? 'bg-purple-600/90 text-white shadow-xs ring-1 ring-purple-400/50'
                : user.role === 'admin'
                  ? 'bg-rose-500/80 text-white shadow-xs'
                  : 'bg-emerald-500/80 text-white shadow-xs'
            }`}>
              {user.role === 'developer' ? (
                <Terminal className="w-4 h-4" />
              ) : user.role === 'admin' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </div>

            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white leading-none">
                  {user.fullName}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  user.role === 'developer'
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30'
                    : user.role === 'admin'
                      ? 'bg-rose-500/30 text-rose-200'
                      : 'bg-emerald-500/30 text-emerald-200'
                }`}>
                  {user.role === 'developer' ? 'ผู้พัฒนาระบบ' : user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'สมาชิก'}
                </span>
              </div>
              <p className="text-[11px] text-indigo-200/80 leading-none mt-1">
                {user.role === 'developer' 
                  ? 'Level 1: Developer'
                  : (user.position || (user.role === 'admin' ? 'Level 2: ผู้ดูแลโรงเรียน' : 'ครูผู้สอน'))}
                {user.assignedGrade && ` • ชั้น ${user.assignedGrade}`}
              </p>
            </div>
          </div>


          {/* Settings icon button located at top right near logout (only for Admin and Member) */}
          {user.role !== 'developer' && (
            <button
              onClick={onOpenSettings}
              className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white rounded-xl transition-all shadow-xs shrink-0 flex items-center justify-center group cursor-pointer"
              title="ตั้งค่าระบบ"
            >
              <Settings className="w-4 h-4 text-indigo-100 group-hover:rotate-45 transition-transform" />
            </button>
          )}

          {/* Dedicated Logout button for production */}
          <button
            onClick={onLogout}
            className="px-3 py-2 bg-rose-500/20 hover:bg-rose-600 active:scale-95 border border-rose-400/30 text-rose-200 hover:text-white rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
