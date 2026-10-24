import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, ExternalLink, ImageOff } from 'lucide-react';

interface LightboxProps {
  isOpen: boolean;
  imageUrl: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxProps> = ({
  isOpen,
  imageUrl,
  title,
  subtitle,
  onClose
}) => {
  const [hasError, setHasError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.75));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Top action toolbar */}
      <div className="absolute top-4 inset-x-4 md:inset-x-8 flex items-center justify-between text-white z-10">
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-white drop-shadow">{title}</h3>
          {subtitle && <p className="text-xs text-slate-300 drop-shadow">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
            title="ย่อขนาด"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums px-1 text-slate-200">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
            title="ขยายขนาด"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
            title="เปิดในแท็บใหม่"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-rose-500/80 rounded-full transition-colors text-white ml-2"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative max-w-4xl max-h-[80vh] w-full flex items-center justify-center p-2">
        {hasError ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-700 rounded-2xl text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <ImageOff className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-white mb-1">ไม่สามารถโหลดรูปภาพได้</p>
            <p className="text-xs text-slate-400 mb-4">ลิงก์อาจหมดอายุ หรือการตั้งค่าความเป็นส่วนตัวของไฟล์ไม่อนุญาต</p>
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              ลองเปิดจาก Google Drive โดยตรง
            </a>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={title}
            onError={() => setHasError(true)}
            style={{ transform: `scale(${zoomLevel})` }}
            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl transition-transform duration-200"
          />
        )}
      </div>
    </div>
  );
};
