import React, { useState } from 'react';
import { UserSession, MemberAccount } from '../types';
import { ShieldCheck, UserCheck, KeyRound, LogIn, X, Check } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  currentUser: UserSession;
  members: MemberAccount[];
  onLogin: (username: string, password: string) => { success: boolean; message: string };
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  currentUser,
  members,
  onLogin,
  onClose
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = onLogin(username, password);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleQuickLogin = (uname: string, pass: string) => {
    setErrorMsg('');
    const res = onLogin(uname, pass);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">เข้าสู่ระบบ (Sign In)</h3>
              <p className="text-xs text-slate-500">เลือกบัญชีผู้ดูแลระบบ (Admin) หรือสมาชิกครู (Member)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Demo Switcher Buttons - 3 Levels */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            เลือกระดับสิทธิ์เข้าสู่ระบบด่วน (3 Levels):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Level 1: Developer */}
            <button
              type="button"
              onClick={() => handleQuickLogin('Airfan', '456789')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                currentUser.role === 'developer'
                  ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  Level 1 Developer
                </span>
                {currentUser.role === 'developer' && (
                  <Check className="w-3.5 h-3.5 text-purple-600" />
                )}
              </div>
              <p className="text-xs text-slate-800 font-bold mt-1">Airfan</p>
              <p className="text-[10px] text-slate-500">Pass: 456789</p>
              <p className="text-[9px] text-purple-600/90 mt-1 leading-tight font-medium">
                สร้าง ID Admin, สมาชิก, ลบปีการศึกษา
              </p>
            </button>

            {/* Level 2: School Admin */}
            <button
              type="button"
              onClick={() => handleQuickLogin('Admin', '123456')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                currentUser.role === 'admin'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Level 2 Admin
                </span>
                {currentUser.role === 'admin' && (
                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                )}
              </div>
              <p className="text-xs text-slate-800 font-bold mt-1">Admin (โรงเรียน)</p>
              <p className="text-[10px] text-slate-500">Pass: 123456</p>
              <p className="text-[9px] text-indigo-600/90 mt-1 leading-tight font-medium">
                จัดการโรงเรียน (ไม่มีสิทธิ์สร้างสมาชิก)
              </p>
            </button>

            {/* Level 3: Member */}
            <button
              type="button"
              onClick={() => handleQuickLogin('krusomsri', '123')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                currentUser.role === 'member'
                  ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Level 3 Member
                </span>
                {currentUser.role === 'member' && (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </div>
              <p className="text-xs text-slate-800 font-bold mt-1">ครูสมศรี (ป.1)</p>
              <p className="text-[10px] text-slate-500">Pass: 123</p>
              <p className="text-[9px] text-emerald-600/90 mt-1 leading-tight font-medium">
                บุคลากรกรอกข้อมูลผลการเรียน/เวลาเรียน
              </p>
            </button>
          </div>
        </div>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="bg-white px-2 text-slate-400">หรือระบุบัญชีผู้ใช้</span>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อผู้ใช้ (Username / ID)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="เช่น Admin หรือ รหัสสมาชิกครู"
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รหัสผ่าน (Password)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>เข้าสู่ระบบ</span>
          </button>
        </form>
      </div>
    </div>
  );
};
