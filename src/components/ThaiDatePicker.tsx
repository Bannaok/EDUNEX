import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

export interface ThaiDatePickerProps {
  value?: string; // Standard ISO 'YYYY-MM-DD'
  defaultValue?: string; // Standard ISO 'YYYY-MM-DD'
  onChange?: (dateIso: string) => void;
  name?: string; // For HTML form submission (e.g. FormData)
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  minYearBE?: number; // e.g. 2480 (ค.ศ. 1937)
  maxYearBE?: number; // e.g. 2580 (ค.ศ. 2037)
  id?: string;
}

// Convert ISO string 'YYYY-MM-DD' to day, month(0-11), yearBE
export const parseIsoToBE = (isoStr?: string) => {
  if (!isoStr) return null;
  const parts = isoStr.split('T')[0].split('-');
  if (parts.length < 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

  const yearBE = y > 2400 ? y : y + 543;
  const yearCE = y > 2400 ? y - 543 : y;
  return { day: d, month: m, yearBE, yearCE };
};

// Convert day, month(0-11), yearBE to standard ISO 'YYYY-MM-DD'
export const formatBEToIso = (day: number, month: number, yearBE: number): string => {
  const yearCE = yearBE > 2400 ? yearBE - 543 : yearBE;
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yearCE}-${mm}-${dd}`;
};

// Format ISO string to display in Thai Buddhist Era e.g. "15/06/2569"
export const formatIsoToThaiDisplay = (isoStr?: string, format: 'numeric' | 'short' | 'full' = 'short'): string => {
  const parsed = parseIsoToBE(isoStr);
  if (!parsed) return '';
  const { day, month, yearBE } = parsed;
  if (format === 'numeric') {
    return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${yearBE}`;
  }
  if (format === 'full') {
    return `${day} ${THAI_MONTHS_FULL[month]} พ.ศ. ${yearBE}`;
  }
  return `${day} ${THAI_MONTHS_SHORT[month]} ${yearBE}`;
};

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value: propValue,
  defaultValue,
  onChange,
  name,
  required = false,
  disabled = false,
  placeholder = 'เลือกวันที่ (พ.ศ.)',
  className = '',
  align = 'left',
  minYearBE = 2480,
  maxYearBE = 2580,
  id
}) => {
  const [internalValue, setInternalValue] = useState<string>(() => propValue !== undefined ? propValue : (defaultValue || ''));
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync internal value if prop changes
  useEffect(() => {
    if (propValue !== undefined) {
      setInternalValue(propValue);
    }
  }, [propValue]);

  const parsedCurrent = useMemo(() => parseIsoToBE(internalValue), [internalValue]);

  // Calendar View State (Month 0-11, Year in Buddhist Era พ.ศ.)
  const now = new Date();
  const todayBE = now.getFullYear() + 543;
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const todayIso = formatBEToIso(todayDay, todayMonth, todayBE);

  const [viewMonth, setViewMonth] = useState<number>(() => parsedCurrent ? parsedCurrent.month : todayMonth);
  const [viewYearBE, setViewYearBE] = useState<number>(() => parsedCurrent ? parsedCurrent.yearBE : todayBE);

  // When opening calendar, refocus to the currently selected date's month and year
  useEffect(() => {
    if (isOpen) {
      if (parsedCurrent) {
        setViewMonth(parsedCurrent.month);
        setViewYearBE(parsedCurrent.yearBE);
      } else {
        setViewMonth(todayMonth);
        setViewYearBE(todayBE);
      }
    }
  }, [isOpen]);

  // Close on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const viewYearCE = viewYearBE - 543;

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYearBE(prev => Math.max(minYearBE, prev - 1));
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYearBE(prev => Math.min(maxYearBE, prev + 1));
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDate = (d: number, m: number, yBE: number) => {
    const isoStr = formatBEToIso(d, m, yBE);
    if (propValue === undefined) {
      setInternalValue(isoStr);
    }
    onChange?.(isoStr);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (propValue === undefined) {
      setInternalValue('');
    }
    onChange?.('');
  };

  const handleQuickToday = () => {
    handleSelectDate(todayDay, todayMonth, todayBE);
  };

  // Generate Year options in Buddhist Era
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYearBE; y >= minYearBE; y--) {
      list.push(y);
    }
    return list;
  }, [minYearBE, maxYearBE]);

  // Calculate days in the view month
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYearCE, viewMonth, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(viewYearCE, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYearCE, viewMonth, 0).getDate();

    interface DayCell {
      day: number;
      month: number;
      yearBE: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isoStr: string;
    }

    const cells: DayCell[] = [];

    // Leading days from previous month
    const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYearBE = viewMonth === 0 ? viewYearBE - 1 : viewYearBE;
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const iso = formatBEToIso(d, prevMonthIdx, prevYearBE);
      cells.push({
        day: d,
        month: prevMonthIdx,
        yearBE: prevYearBE,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isSelected: iso === internalValue,
        isoStr: iso
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const iso = formatBEToIso(d, viewMonth, viewYearBE);
      cells.push({
        day: d,
        month: viewMonth,
        yearBE: viewYearBE,
        isCurrentMonth: true,
        isToday: iso === todayIso,
        isSelected: iso === internalValue,
        isoStr: iso
      });
    }

    // Trailing days from next month to fill grid (up to 35 or 42 cells)
    const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYearBE = viewMonth === 11 ? viewYearBE + 1 : viewYearBE;
    const remainingCells = 42 - cells.length >= 7 ? 42 - cells.length : 35 - cells.length;
    const finalRemaining = remainingCells > 0 ? remainingCells : (42 - cells.length);

    for (let d = 1; d <= finalRemaining; d++) {
      const iso = formatBEToIso(d, nextMonthIdx, nextYearBE);
      cells.push({
        day: d,
        month: nextMonthIdx,
        yearBE: nextYearBE,
        isCurrentMonth: false,
        isToday: iso === todayIso,
        isSelected: iso === internalValue,
        isoStr: iso
      });
    }

    return cells;
  }, [viewYearCE, viewMonth, viewYearBE, internalValue, todayIso]);

  // Display text formatted in Thai Buddhist Era
  const displayValue = useMemo(() => {
    if (!internalValue) return '';
    return formatIsoToThaiDisplay(internalValue, 'short');
  }, [internalValue]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden input for HTML form submissions (FormData) */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={internalValue}
          required={required}
        />
      )}

      {/* Input Display Button */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(prev => !prev);
          }
        }}
        className={`flex items-center justify-between w-full text-xs px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer select-none ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-100 bg-white'
            : 'border-slate-200 hover:border-slate-300 bg-white'
        } ${className}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar className={`w-3.5 h-3.5 shrink-0 ${internalValue ? 'text-blue-600' : 'text-slate-400'}`} />
          {internalValue ? (
            <div className="flex items-center gap-1 truncate">
              <span className="font-semibold text-slate-800 text-[11px] sm:text-xs">{displayValue}</span>
              <span className="text-[9px] bg-blue-50 text-blue-600 px-1 py-0.2 rounded font-bold border border-blue-100">
                พ.ศ.
              </span>
            </div>
          ) : (
            <span className="text-slate-400 truncate text-[11px] sm:text-xs">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {internalValue && !disabled && !required && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
              title="ล้างค่าวันที่"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[9px] text-slate-400 font-medium px-1 bg-slate-50 rounded border border-slate-100">
            พ.ศ.
          </span>
        </div>
      </div>

      {/* Global Backdrop Overlay for smooth outside click closing */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9990] bg-black/10 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Popover Calendar (Buddhist Era - Compact Size) */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute z-[9999] mt-1 ${
            align === 'right' ? 'right-0 sm:right-0 sm:left-auto' : 'left-0'
          } w-64 sm:w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5 text-slate-800 animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Header Controls: Month & Year (พ.ศ.) & Close Button */}
          <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 active:scale-95 transition-transform"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 flex-1 justify-center">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-[11px] font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {THAI_MONTHS_FULL.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown (พ.ศ.) */}
              <select
                value={viewYearBE}
                onChange={(e) => setViewYearBE(Number(e.target.value))}
                className="text-[11px] font-bold text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>
                    พ.ศ. {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 active:scale-95 transition-transform"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Quick Top Right Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 ml-0.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="ปิดปฏิทิน"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1 text-[10px] font-bold">
            {THAI_DAYS_SHORT.map((dayName, idx) => (
              <div
                key={dayName}
                className={`py-0.5 ${idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-purple-600' : 'text-slate-500'}`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {calendarDays.map((cell, idx) => {
              const isSunday = idx % 7 === 0;

              let btnStyle = 'text-slate-700 hover:bg-slate-100';
              if (!cell.isCurrentMonth) {
                btnStyle = 'text-slate-300 hover:bg-slate-50 hover:text-slate-400';
              } else if (cell.isSelected) {
                btnStyle = 'bg-blue-600 text-white font-bold shadow-xs shadow-blue-200 hover:bg-blue-700';
              } else if (cell.isToday) {
                btnStyle = 'border border-blue-500 text-blue-700 font-bold bg-blue-50/50 hover:bg-blue-100/50';
              } else if (isSunday) {
                btnStyle = 'text-rose-600 hover:bg-rose-50';
              }

              return (
                <button
                  key={`${cell.isoStr}-${idx}`}
                  type="button"
                  onClick={() => handleSelectDate(cell.day, cell.month, cell.yearBE)}
                  className={`h-7 w-full rounded-md text-[11px] font-medium flex items-center justify-center transition-all ${btnStyle}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Bottom Bar: Today quick button & Clear/Close button */}
          <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-slate-100 text-[11px]">
            <button
              type="button"
              onClick={handleQuickToday}
              className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors"
            >
              <Clock className="w-3 h-3" />
              <span>วันนี้ ({todayDay} {THAI_MONTHS_SHORT[todayMonth]} {todayBE})</span>
            </button>

            <div className="flex items-center gap-1.5">
              {!required && internalValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-medium text-slate-400 hover:text-rose-600 px-1.5 py-0.5 rounded transition-colors"
                >
                  ล้างค่า
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-bold text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
