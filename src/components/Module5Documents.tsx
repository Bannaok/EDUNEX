import React, { useState, useRef } from 'react';
import { DocumentItem, UserSession, GoogleConfig } from '../types';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Search, 
  Edit, 
  Clock, 
  GripVertical,
  X,
  FileCheck,
  File,
  FileSpreadsheet,
  Plus,
  Eye
} from 'lucide-react';

interface Module5Props {
  user: UserSession;
  documents: DocumentItem[];
  googleConfig?: GoogleConfig;
  onSaveDocument: (doc: DocumentItem) => void;
  onDeleteDocument: (id: string) => void;
  onReorderDocuments?: (docs: DocumentItem[]) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg: string) => void;
}

export const Module5Documents: React.FC<Module5Props> = ({
  user,
  documents,
  onSaveDocument,
  onDeleteDocument,
  onReorderDocuments,
  onShowToast
}) => {
  // 2 Tabs: 1) ศูนย์เอกสาร 2) หนังสือคำสั่ง
  const [activeTab, setActiveTab] = useState<'documents' | 'orders'>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);

  // Pop-up modal state for viewing full document title on mobile
  const [selectedDocDetailModal, setSelectedDocDetailModal] = useState<DocumentItem | null>(null);

  // Confirmation modal state for deleting documents
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocumentItem | null>(null);

  // Modal form states
  const [modalTargetType, setModalTargetType] = useState<'document' | 'order'>('document');
  const [docNumber, setDocNumber] = useState('');
  const [title, setTitle] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileData, setFileData] = useState<string>('');

  // Drag and drop state for Admin reordering
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // File input ref for real file upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Format date string to Thai พ.ศ. format (e.g. 2026-09-10 -> 10-09-2569)
  const formatThaiDocDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        const thaiYear = year > 2400 ? year : year + 543;
        return `${day}-${month}-${thaiYear}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Helper: check if a doc is an order (หนังสือคำสั่ง)
  const isOrderDoc = (d: DocumentItem) => {
    return d.docType === 'order' || d.category === 'คำสั่งโรงเรียน';
  };

  // Filter and sort documents for active tab
  const currentDocs = documents.filter(d => {
    const isOrder = isOrderDoc(d);
    return activeTab === 'orders' ? isOrder : !isOrder;
  });

  const filteredDocs = currentDocs.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      (d.title || '').toLowerCase().includes(q) ||
      (d.docNumber || '').toLowerCase().includes(q) ||
      (d.fileName || '').toLowerCase().includes(q)
    );
  });

  // Open modal
  const handleOpenModal = (doc?: DocumentItem) => {
    if (doc) {
      setEditingDoc(doc);
      setModalTargetType(isOrderDoc(doc) ? 'order' : 'document');
      setDocNumber(doc.docNumber || '');
      setTitle(doc.title || '');
      setDocDate(doc.date || new Date().toISOString().split('T')[0]);
      setFileUrl(doc.fileUrl || '');
      setFileName(doc.fileName || '');
      setFileSize(doc.fileSize || '');
      setFileData(doc.fileData || '');
    } else {
      setEditingDoc(null);
      setModalTargetType(activeTab === 'orders' ? 'order' : 'document');
      setDocNumber('');
      setTitle('');
      // วันที่จะเป็นปัจจุบัน
      setDocDate(new Date().toISOString().split('T')[0]);
      setFileUrl('');
      setFileName('');
      setFileSize('');
      setFileData('');
    }
    setIsUploadModalOpen(true);
  };

  // Process selected file (both click-to-upload and drag-and-drop)
  // เขียนชื่อเรื่องอัตโนมัติตามชื่อไฟล์ที่อัปโหลด ทั้งหน้าศูนย์เอกสารและหนังสือคำสั่ง
  const processSelectedFile = (file: File) => {
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      onShowToast('warning', 'ไฟล์มีขนาดใหญ่เกินไป', 'กรุณาเลือกไฟล์ขนาดไม่เกิน 20MB');
      return;
    }

    // Format size
    const sizeStr = file.size < 1024 * 1024 
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    setFileName(file.name);
    setFileSize(sizeStr);

    // 2. เมื่อกดอัปโหลดไฟล์ ตรงช่องชื่อเรื่องจะเขียนชื่อไฟล์อัตโนมัติ ตามชื่อไฟล์ที่อัปโหลด เป็นทั้งหน้าศูนย์เอกสาร และหน้าหนังสือคำสั่ง
    const cleanName = file.name.lastIndexOf('.') > 0 
      ? file.name.substring(0, file.name.lastIndexOf('.')) 
      : file.name;
    const autoTitle = cleanName.trim() || file.name;
    setTitle(autoTitle);

    // กรณีหน้าหนังสือคำสั่ง ถ้ามีคำว่า คำสั่ง หรือ เลขที่คำสั่ง ในชื่อไฟล์ ให้ช่วยกรอกเลขที่คำสั่งให้อัตโนมัติด้วย
    if (!docNumber) {
      const matchOrder = autoTitle.match(/(คำสั่ง(?:โรงเรียน)?(?:ที่)?\s*[\d/-]+)/i) || autoTitle.match(/([\d]+[/][\d]+)/);
      if (matchOrder) {
        setDocNumber(matchOrder[1].trim());
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFileData(base64);
      setFileUrl(base64);
      onShowToast('success', 'เลือกไฟล์แล้ว', `เขียนชื่อเรื่องอัตโนมัติ: "${autoTitle}"`);
    };
    reader.readAsDataURL(file);
  };

  // Real file upload handler for all file types
  const handleRealFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    e.target.value = '';
  };

  // Save document
  const handleSaveDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role !== 'admin') {
      onShowToast('warning', 'ไม่มีสิทธิ์', 'เฉพาะ Admin เท่านั้นที่สามารถอัปโหลดหรือแก้ไขเอกสาร');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onShowToast('warning', 'กรอกข้อมูลไม่ครบ', 'กรุณาระบุชื่อเรื่อง / ชื่อเอกสาร');
      return;
    }

    const newDoc: DocumentItem = {
      id: editingDoc ? editingDoc.id : 'doc-' + Date.now(),
      docNumber: docNumber.trim() || '-',
      title: trimmedTitle,
      docType: modalTargetType,
      category: modalTargetType === 'order' ? 'คำสั่งโรงเรียน' : 'เอกสารทั่วไป',
      date: docDate || new Date().toISOString().split('T')[0],
      fileUrl: fileUrl || fileData || '#',
      fileName: fileName.trim() || trimmedTitle,
      fileSize: fileSize || '1.0 MB',
      fileData: fileData || undefined,
      uploadedBy: user.fullName
    };

    onSaveDocument(newDoc);
    setIsUploadModalOpen(false);
    onShowToast('success', 'บันทึกสำเร็จ', `บันทึก "${newDoc.title}" เรียบร้อยแล้ว`);
  };

  // Reordering handler
  const handleReorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = documents.findIndex(d => d.id === fromId);
    const toIndex = documents.findIndex(d => d.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...documents];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    if (onReorderDocuments) {
      onReorderDocuments(next);
    }
    onShowToast('info', 'จัดลำดับแล้ว', `ย้าย "${moved.title}" เรียบร้อย`);
  };

  // Touch drag for mobile Admin
  const handleTouchStart = (id: string) => {
    if (user.role !== 'admin') return;
    touchTimerRef.current = setTimeout(() => {
      setDraggedId(id);
    }, 250);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (user.role !== 'admin' || !draggedId) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = targetEl?.closest('[data-doc-id]');
    if (rowEl) {
      const id = rowEl.getAttribute('data-doc-id');
      if (id && id !== dragOverId) {
        setDragOverId(id);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      handleReorder(draggedId, dragOverId);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  // Preview document in new window
  const handlePreviewDoc = (doc: DocumentItem) => {
    if (doc.fileData) {
      const win = window.open();
      if (win) {
        win.document.write(
          `<html><head><title>ตัวอย่างไฟล์: ${doc.title}</title></head><body style="margin:0;padding:0;background:#1e293b;"><iframe src="${doc.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100vh;" allowfullscreen></iframe></body></html>`
        );
      }
    } else if (doc.fileUrl && doc.fileUrl !== '#') {
      window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      onShowToast('info', 'ไม่มีไฟล์เอกสาร', 'เอกสารนี้ยังไม่ได้แนบไฟล์');
    }
  };

  // Download document
  const handleDownloadDoc = (doc: DocumentItem) => {
    if (doc.fileData) {
      const link = document.createElement('a');
      link.href = doc.fileData;
      link.download = doc.fileName || `${doc.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onShowToast('success', 'ดาวน์โหลดสำเร็จ', `ดาวน์โหลด "${doc.fileName || doc.title}" เรียบร้อย`);
    } else if (doc.fileUrl && doc.fileUrl !== '#') {
      const link = document.createElement('a');
      link.href = doc.fileUrl;
      link.download = doc.fileName || `${doc.title}.pdf`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      onShowToast('info', 'ไม่มีไฟล์เอกสาร', 'เอกสารนี้ยังไม่ได้แนบไฟล์');
    }
  };

  // Get file icon based on name
  const renderFileIcon = (fileName?: string) => {
    const ext = fileName ? fileName.split('.').pop()?.toLowerCase() : '';
    if (ext === 'pdf') {
      return (
        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center shrink-0 font-bold text-[10px]">
          PDF
        </div>
      );
    }
    if (ext === 'doc' || ext === 'docx') {
      return (
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0 font-bold text-[10px]">
          DOC
        </div>
      );
    }
    if (ext === 'xls' || ext === 'xlsx') {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 font-bold text-[10px]">
          XLS
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/80 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header: ศูนย์เอกสาร / หนังสือคำสั่ง อยู่ด้านบน แถบสีเขียวอ่อนเพื่อแยกออกกับเมนูอื่นๆ และบรรทัดอื่นๆ */}
      <div className="space-y-3 pb-3 border-b border-slate-200">
        {/* แถบศูนย์เอกสาร / หนังสือคำสั่ง เป็นแถบสีเขียวอ่อน */}
        <div className="bg-emerald-100/90 p-1.5 sm:p-2 rounded-2xl border border-emerald-300/90 shadow-xs flex items-center gap-1.5 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-900 hover:bg-emerald-100/70'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>ศูนย์เอกสาร</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              activeTab === 'documents' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {documents.filter(d => !isOrderDoc(d)).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-900 hover:bg-emerald-100/70'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>หนังสือคำสั่ง</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              activeTab === 'orders' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {documents.filter(d => isOrderDoc(d)).length}
            </span>
          </button>
        </div>

        {/* ช่องค้นหาและปุ่ม + อยู่ด้านล่างฝั่งซ้าย */}
        <div className="flex items-center gap-2">
          {/* ช่องค้นหาขนาดกะทัดรัด */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเอกสาร..."
              className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-48"
            />
          </div>

          {/* ปุ่มอัปโหลดเอกสารใหม่ เป็นไอคอน "+" สำหรับ Admin */}
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="w-8 h-8 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer shrink-0"
              title="อัปโหลดเอกสารใหม่ (+)"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* รายการเอกสาร: แสดงเป็นรายการเล็กลงมาตามวันเวลา ล่าสุดจะอยู่ข้างบน และกดค้างเลื่อนขึ้น-ลงได้ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-xs">
            <File className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">ยังไม่มีเอกสารในส่วนนี้</p>
          </div>
        ) : (
          filteredDocs.map((doc, index) => {
            const isDragging = draggedId === doc.id;
            const isOver = dragOverId === doc.id;

            return (
              <div
                key={doc.id}
                data-doc-id={doc.id}
                draggable={user.role === 'admin'}
                onDragStart={(e) => {
                  if (user.role !== 'admin') return;
                  setDraggedId(doc.id);
                  e.dataTransfer.setData('text/plain', doc.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (user.role !== 'admin') return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverId !== doc.id) {
                    setDragOverId(doc.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverId === doc.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedId) {
                    handleReorder(draggedId, doc.id);
                  }
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onTouchStart={() => handleTouchStart(doc.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={`p-3 sm:py-3 sm:px-4 flex items-center justify-between gap-2.5 sm:gap-3 hover:bg-slate-50/80 transition-all ${
                  isDragging ? 'opacity-30 bg-emerald-50/50' : ''
                } ${
                  isOver ? 'border-t-2 border-emerald-500 bg-emerald-50/30' : ''
                }`}
              >
                {/* ด้านซ้าย: ลำดับ, ไอคอน และข้อมูลเอกสาร */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Grip Icon สำหรับ Admin กดค้างเพื่อเลื่อนขึ้น-ลง */}
                  {user.role === 'admin' && (
                    <div 
                      className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 shrink-0 select-none"
                      title="กดค้างเพื่อเลื่อนขึ้น-ลง"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

                  {/* เลขลำดับรายการ (1., 2., 3. ...) */}
                  <span className="w-6 sm:w-7 text-center text-xs sm:text-sm font-bold text-emerald-800 font-mono shrink-0">
                    {index + 1}.
                  </span>

                  {/* Icon ไฟล์ */}
                  {renderFileIcon(doc.fileName)}

                  {/* ข้อมูลชื่อและเลขที่เอกสาร */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-mono font-medium flex items-center gap-1 whitespace-nowrap shrink-0">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="whitespace-nowrap">{formatThaiDocDate(doc.date)}</span>
                      </span>
                    </div>

                    <h4 
                      onClick={() => setSelectedDocDetailModal(doc)}
                      className="text-[12px] sm:text-sm font-semibold text-slate-800 truncate leading-snug hover:text-teal-700 cursor-pointer transition-colors mt-0.5"
                      title="กดเพื่อดูชื่อเรื่องเต็ม"
                    >
                      {doc.title}
                    </h4>

                    {doc.fileName && (
                      <p 
                        onClick={() => setSelectedDocDetailModal(doc)}
                        className="text-[10px] text-slate-400 truncate mt-0.5 cursor-pointer hover:text-slate-600"
                      >
                        {doc.fileName} • {doc.fileSize || '1.0 MB'}
                      </p>
                    )}
                  </div>
                </div>

                {/* ด้านขวา: ปุ่มไอคอนตา (ดูตัวอย่าง), ปุ่มไอคอนดาวน์โหลด และปุ่มจัดการสำหรับ Admin */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* ปุ่มไอคอนตา: ดูตัวอย่างไฟล์ */}
                  <button
                    type="button"
                    onClick={() => handlePreviewDoc(doc)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="ดูตัวอย่างไฟล์"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* ปุ่มไอคอนดาวน์โหลด: ดาวน์โหลดไฟล์ */}
                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(doc)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                    title="ดาวน์โหลดไฟล์"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {user.role !== 'developer' && (
                    <>
                      {user.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleOpenModal(doc)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="แก้ไขเอกสาร"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteDoc(doc)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="ลบเอกสาร"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: อัปโหลดเอกสารใหม่ (สามารถกดเลือกด้านบนว่าจะอัปโหลดหน้าไหน, เอาออกชื่อกิจกรรม, อัปโหลดไฟล์ได้จริงทุกประเภท, วันที่เป็นปัจจุบัน) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingDoc ? 'แก้ไขเอกสาร' : 'อัปโหลดเอกสารใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ปุ่มแบ่งหน้าด้านบนว่าจะอัปโหลดเข้าส่วนไหน (ศูนย์เอกสาร หรือ หนังสือคำสั่ง) */}
            <div className="p-1 bg-emerald-50 rounded-2xl flex items-center gap-1 border border-emerald-200/80">
              <button
                type="button"
                onClick={() => setModalTargetType('document')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTargetType === 'document'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-900 hover:bg-emerald-100/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>1) ศูนย์เอกสาร</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTargetType('order')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTargetType === 'order'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-900 hover:bg-emerald-100/60'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>2) หนังสือคำสั่ง</span>
              </button>
            </div>

            <form onSubmit={handleSaveDocSubmit} className="space-y-3.5">
              {/* อัปโหลดไฟล์ได้จริงทุกประเภท */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไฟล์เอกสาร (อัปโหลดไฟล์ได้จริงทุกประเภท) *
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleRealFileUpload}
                  className="hidden"
                />

                {fileName ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {renderFileIcon(fileName)}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate" title={fileName}>
                          {fileName}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-mono">
                          {fileSize || '1.0 MB'} • เขียนชื่อเรื่องอัตโนมัติแล้ว
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 shadow-2xs cursor-pointer"
                      >
                        เปลี่ยนไฟล์
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        processSelectedFile(file);
                      }
                    }}
                    className="p-5 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl bg-emerald-50/40 hover:bg-emerald-50/70 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 group-hover:border-emerald-300 flex items-center justify-center text-emerald-500 group-hover:text-emerald-600 shadow-2xs transition-colors">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                        คลิกหรือลากไฟล์เอกสารมาวางที่นี่
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        ระบบจะเขียนชื่อเรื่องให้อัตโนมัติตามชื่อไฟล์ (รองรับ PDF, Word, Excel ฯลฯ)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* เลขที่คำสั่ง (เฉพาะหนังสือคำสั่ง และห้ามบังคับ) */}
              {modalTargetType === 'order' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขที่คำสั่ง (ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="เช่น คำสั่งที่ 12/2569"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              )}

              {/* ชื่อเรื่อง / ชื่อเอกสาร */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อเรื่อง / ชื่อเอกสาร *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น มอบหมายหน้าที่ครูเวรประจำวัน"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * จะเขียนชื่อไฟล์ให้อัตโนมัติเมื่อเลือกไฟล์ หรือสามารถแก้ไขเพิ่มเติมได้
                </p>
              </div>

              {/* วันที่เอกสาร: เป็นปัจจุบันโดยอัตโนมัติ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  วันที่เอกสาร *
                </label>
                <input
                  type="date"
                  required
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>

              {/* ปุ่มบันทึก */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  บันทึกเอกสาร
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Pop-up Modal: แสดงชื่อเรื่องเต็มๆ และตัวอย่างไฟล์/ดาวน์โหลด */}
      {selectedDocDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col space-y-4 p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md font-mono">
                    {isOrderDoc(selectedDocDetailModal) ? 'หนังสือคำสั่ง' : 'ศูนย์เอกสาร'}
                  </span>
                  <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatThaiDocDate(selectedDocDetailModal.date)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocDetailModal(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Title Full Display */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                ชื่อเรื่องเต็ม
              </label>
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-800 break-words leading-relaxed max-h-52 overflow-y-auto">
                {selectedDocDetailModal.title}
              </div>
            </div>

            {/* File Info */}
            {selectedDocDetailModal.fileName && (
              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between font-mono">
                <span className="truncate pr-2">{selectedDocDetailModal.fileName}</span>
                <span className="shrink-0 text-slate-400">{selectedDocDetailModal.fileSize || '1.0 MB'}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handlePreviewDoc(selectedDocDetailModal);
                    setSelectedDocDetailModal(null);
                  }}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  <Eye className="w-4 h-4" />
                  <span>ดูตัวอย่างไฟล์</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleDownloadDoc(selectedDocDetailModal);
                  }}
                  className="py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4 text-teal-600" />
                  <span>ดาวน์โหลด</span>
                </button>
              </div>

              {user.role !== 'developer' && (
                <div className={`grid ${user.role === 'admin' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  {user.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenModal(selectedDocDetailModal);
                        setSelectedDocDetailModal(null);
                      }}
                      className="py-2.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4 text-emerald-600" />
                      <span>แก้ไขเอกสาร</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteDoc(selectedDocDetailModal);
                    }}
                    className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>ลบเอกสาร</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedDocDetailModal(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ยืนยันการลบเอกสาร (ถามยืนยันทุกครั้งเมื่อกดลบ) */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">
                {isOrderDoc(confirmDeleteDoc) ? 'ยืนยันการลบหนังสือคำสั่ง' : 'ยืนยันการลบเอกสาร'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed break-words">
                คุณต้องการลบ <span className="font-bold text-slate-800">"{confirmDeleteDoc.title}"</span> ใช่หรือไม่?
              </p>
              <p className="text-[11px] text-rose-600 font-medium">
                เมื่อลบแล้วจะไม่สามารถกู้คืนเอกสารนี้ได้
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDocument(confirmDeleteDoc.id);
                  if (selectedDocDetailModal?.id === confirmDeleteDoc.id) {
                    setSelectedDocDetailModal(null);
                  }
                  onShowToast(
                    'info',
                    'ลบสำเร็จ',
                    `ลบ "${confirmDeleteDoc.title}" ออกจากระบบเรียบร้อยแล้ว`
                  );
                  setConfirmDeleteDoc(null);
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
