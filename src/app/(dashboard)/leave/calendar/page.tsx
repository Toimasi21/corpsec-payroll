'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  ShieldAlert,
  Sparkles,
  Building,
  MapPin,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

export default function LeaveCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [dRes, bRes] = await Promise.all([
          fetch('/api/departments?status=ACTIVE'),
          fetch('/api/branches?status=ACTIVE'),
        ]);
        if (dRes.ok) {
          const d = await dRes.json();
          if (d.success) setDepartments(d.data || []);
        }
        if (bRes.ok) {
          const d = await bRes.json();
          if (d.success) setBranches(d.data || []);
        }
      } catch (err) {
        console.error('Error fetching lookups:', err);
      }
    };
    fetchLookups();
  }, []);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('year', String(year));
      params.set('month', String(month));
      if (selectedDept) params.set('departmentId', selectedDept);
      if (selectedBranch) params.set('branchId', selectedBranch);

      const res = await fetch(`/api/leave/calendar?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCalendarData(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [currentDate, selectedDept, selectedBranch]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar Grid Builder
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun, 6=Sat

  // Format date helper: YYYY-MM-DD
  const formatCellDate = (dayNumber: number) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(dayNumber).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Visual Leave & Availability Calendar</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Track team off-duty periods, Kenya public holidays, and guarding post staffing availability in real-time.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leave/requests" className="btn btn-secondary text-sm">
            Leave Requests
          </Link>
          <Link href="/leave/approvals" className="btn btn-primary text-sm">
            Approvals Desk
          </Link>
        </div>
      </div>

      {/* Calendar Controls & Quick Metrics */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-900 dark:text-white px-3 min-w-[140px] text-center">
              {monthNames[month - 1]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={handleToday} className="btn btn-secondary py-1.5 px-3 text-xs">
            Current Month
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4">
        {/* Day Headers (Sun - Sat) */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 dark:text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7 gap-2 pt-2">
          {/* Leading Empty Cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="min-h-[100px] rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-transparent"
            />
          ))}

          {/* Month Day Cells */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateKey = formatCellDate(dayNum);
            const isToday =
              new Date().toISOString().split('T')[0] === dateKey;

            // Events on this day
            const eventsOnDay =
              calendarData?.events?.filter((ev: any) => {
                return dateKey >= ev.startDate && dateKey <= ev.endDate;
              }) || [];

            // Public Holidays on this day
            const holiday = calendarData?.holidays?.find((h: any) => h.date === dateKey);

            return (
              <div
                key={`day-${dayNum}`}
                className={`min-h-[110px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                  isToday
                    ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-700 shadow-sm'
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {holiday && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                      🇰🇪 {holiday.name}
                    </span>
                  )}
                </div>

                {/* Leave Items Stack */}
                <div className="space-y-1 my-1 overflow-y-auto max-h-[75px]">
                  {eventsOnDay.map((ev: any) => (
                    <Link
                      key={ev.id}
                      href={`/leave/requests?id=${ev.id}`}
                      className="block text-[10px] p-1 rounded font-medium truncate transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: `${ev.color}20`,
                        color: ev.color,
                        borderLeft: `2.5px solid ${ev.color}`,
                      }}
                      title={`${ev.employeeName} - ${ev.leaveTypeName} (${ev.department})`}
                    >
                      <span className="font-semibold">{ev.employeeName.split(' ')[0]}</span> • {ev.leaveTypeName}
                    </Link>
                  ))}
                </div>

                {/* Cell Footer Count */}
                <div className="text-[10px] text-slate-400 text-right">
                  {eventsOnDay.length > 0 && `${eventsOnDay.length} on leave`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
