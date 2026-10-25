import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, X, Share, PlusSquare, CheckCircle } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'menu';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If already running inside standalone PWA app, hide install prompts
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // General instructions for browser
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {/* Variant: Header Button */}
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold shadow-sm transition-all transform active:scale-95 cursor-pointer border border-amber-400/30 animate-pulse"
          title="ติดตั้งแอป NEXUS บนมือถือหรือเดสก์ท็อป"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ติดตั้งแอป</span>
          <span className="sm:hidden">แอป</span>
        </button>
      )}

      {/* Variant: Mobile Floating Banner */}
      {variant === 'banner' && (
        <div className="fixed bottom-16 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-blue-200 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 shadow-xs flex items-center justify-center p-1">
              <img src="/nexus-logo.png" alt="NEXUS" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                <span>ติดตั้งแอป NEXUS</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700">App</span>
              </h4>
              <p className="text-[11px] text-slate-500 truncate">
                ติดตั้งบนหน้าจอมือถือ ใช้งานสะดวก เร็วกว่า
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>ติดตั้ง</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              title="ปิด"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Variant: Menu Button */}
      {variant === 'menu' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-amber-600" />
          <span>ติดตั้งแอป NEXUS บนอุปกรณ์</span>
        </button>
      )}

      {/* MODAL: iOS Safari / Browser Installation Guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs">
                  <img src="/nexus-logo.png" alt="NEXUS" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ติดตั้งแอป NEXUS</h3>
                  <p className="text-[11px] text-slate-500">สำหรับ iPhone, iPad และสมาร์ตโฟน</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-900">กดปุ่มแชร์ (Share)</p>
                  <p className="text-slate-500 mt-0.5 flex items-center gap-1">
                    แตะที่ไอคอน <Share className="w-3.5 h-3.5 text-blue-600 inline" /> บนแถบเมนู Safari หรือเบราว์เซอร์
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-900">เพิ่มไปยังหน้าจอโฮม</p>
                  <p className="text-slate-500 mt-0.5 flex items-center gap-1">
                    เลื่อนลงและเลือก <strong className="text-slate-800">"เพิ่มไปยังหน้าจอโฮม"</strong> (<PlusSquare className="w-3.5 h-3.5 text-blue-600 inline" /> Add to Home Screen)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900">
                <div className="w-7 h-7 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold">เสร็จสิ้น!</p>
                  <p className="text-emerald-700 mt-0.5">
                    ไอคอนแอป <strong className="font-black text-emerald-900">NEXUS</strong> จะปรากฏบนหน้าจอหลัก เปิดใช้งานได้เสมือนแอปพลิเคชันจริง
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </>
  );
};
