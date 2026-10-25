import React, { useState } from 'react';
import { NavTab } from './Navigation';
import { 
  Home, 
  CalendarCheck, 
  Users, 
  Award, 
  Menu, 
  X,
  Activity,
  ClipboardList,
  FileText,
  Globe,
  BarChart3,
  Settings
} from 'lucide-react';
import { UserSession } from '../types';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingTasksCount: number;
  user?: UserSession;
  onOpenSettings: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  pendingTasksCount,
  user,
  onOpenSettings
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const mainMobileTabs: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'dashboard',
      label: 'หน้าแรก',
      icon: <Home className="w-5 h-5" />,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined
    },
    {
      id: 'attendance_savings',
      label: 'เวลาเรียน',
      icon: <CalendarCheck className="w-5 h-5" />
    },
    {
      id: 'data_others',
      label: 'ครูเวร/ข้อมูล',
      icon: <Users className="w-5 h-5" />
    },
    {
      id: 'grading',
      label: 'ผลการเรียน',
      icon: <Award className="w-5 h-5" />
    }
  ];

  const allMenuItems: { id: NavTab; label: string; subLabel: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'หน้าหลัก', subLabel: 'ปฏิทินและภาพรวม', icon: <Home className="w-5 h-5 text-indigo-600" /> },
    { id: 'classroom', label: 'ธุรการชั้นเรียน', subLabel: 'บันทึกสุขภาพและกิจกรรม', icon: <Activity className="w-5 h-5 text-blue-600" /> },
    { id: 'data_others', label: 'ข้อมูล/อื่นๆ & ครูเวร', subLabel: 'นักเรียน บุคลากร ครูเวร 100 วัน', icon: <Users className="w-5 h-5 text-cyan-600" /> },
    { id: 'grading', label: 'ระบบบันทึกคะแนน', subLabel: 'เกรดเฉลี่ยและ ปพ.5', icon: <Award className="w-5 h-5 text-amber-600" /> },
    { id: 'attendance_savings', label: 'เช็กชื่อ & เงินฝาก', subLabel: 'ปฏิทิน 100 วันและออมทรัพย์', icon: <CalendarCheck className="w-5 h-5 text-emerald-600" /> },
    { id: 'assignments', label: 'ติดตามภาระงาน', subLabel: 'การส่งงานและเวรประจำวัน', icon: <ClipboardList className="w-5 h-5 text-purple-600" /> },
    { id: 'documents', label: 'คลังเอกสาร', subLabel: 'แบบฟอร์มวิชาการ Google Drive', icon: <FileText className="w-5 h-5 text-rose-600" /> },
    { id: 'websites', label: 'เว็บไซต์แนะนำ', subLabel: 'ลิงก์และฐานข้อมูลเพื่อการศึกษา', icon: <Globe className="w-5 h-5 text-teal-600" /> },
    { id: 'reports', label: 'รายงานสรุปผล', subLabel: 'สถิติและกราฟวิเคราะห์', icon: <BarChart3 className="w-5 h-5 text-orange-600" /> }
  ];

  return (
    <>
      {/* Mobile Fixed Bottom Navigation Bar (md:hidden) */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-14 items-center px-1">
          {mainMobileTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onSelectTab(tab.id);
                  setIsMoreMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center h-full relative transition-all active:scale-95 cursor-pointer ${
                  isActive ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge && (
                    <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 truncate max-w-[64px]">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-6 h-1 rounded-full bg-blue-700" />
                )}
              </button>
            );
          })}

          {/* More Menu Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(prev => !prev)}
            className={`flex flex-col items-center justify-center h-full relative transition-all active:scale-95 cursor-pointer ${
              isMoreMenuOpen ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {isMoreMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-[10px] mt-0.5 truncate max-w-[64px]">
              {isMoreMenuOpen ? 'ปิด' : 'เมนูอื่น'}
            </span>
          </button>
        </div>
      </nav>

      {/* Slide-up Menu Drawer for all modules */}
      {isMoreMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-t-3xl shadow-2xl p-4 sm:p-5 max-h-[82vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200 pb-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header of Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs">
                  <img src="/nexus-logo.png" alt="NEXUS" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">เมนูการทำงานทั้งหมด</h3>
                  <p className="text-[10px] text-slate-500">ระบบบริหารจัดการงานวิชาการและธุรการ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>


            {/* All Modules List */}
            <div className="grid grid-cols-1 gap-1.5">
              {allMenuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-blue-50 border border-blue-200 text-blue-900 font-bold' 
                        : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white border border-slate-200 shrink-0 shadow-2xs">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">{item.subLabel}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Settings button if permitted */}
            {user?.role !== 'developer' && (
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-white border border-slate-200 shrink-0">
                  <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold">ตั้งค่าระบบและบัญชีผู้ใช้</p>
                  <p className="text-[10px] text-slate-500">จัดการข้อมูลสถานศึกษาและรหัสผ่าน</p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
