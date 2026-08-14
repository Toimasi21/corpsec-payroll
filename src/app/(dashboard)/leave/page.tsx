'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Users,
  ShieldCheck,
  TrendingUp,
  FileText,
  Calendar,
  Layers,
  Search,
  Filter,
  Check,
  X,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { LeaveStatsData, LeaveRequestData, LeaveTypeData } from '@/types';

export default function LeaveDashboardPage() {
  const [stats, setStats] = useState<LeaveStatsData | null>(null);
  const [recentRequests, setRecentRequests] = useState<LeaveRequestData[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeData[]>([]);
  const [loading, setLoading] = useState(true);

  // New Request Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string; employeeNumber: string; gender: string }>>([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDaySession: 'MORNING',
    reason: '',
    contactPhone: '',
    relieverEmployeeId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, reqsRes, typesRes, empRes] = await Promise.all([
        fetch('/api/leave/stats'),
        fetch('/api/leave/requests?pageSize=7'),
        fetch('/api/leave/types?status=ACTIVE'),
        fetch('/api/employees?pageSize=100&status=ACTIVE'),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        if (d.success) setStats(d.data);
      }
      if (reqsRes.ok) {
        const d = await reqsRes.json();
        if (d.success) setRecentRequests(d.data || []);
      }
      if (typesRes.ok) {
        const d = await typesRes.json();
        if (d.success) setLeaveTypes(d.data || []);
      }
      if (empRes.ok) {
        const d = await empRes.json();
        if (d.success) setEmployees(d.data || []);
      }
    } catch (err) {
      console.error('Error loading leave dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          leaveYear: new Date(formData.startDate || new Date()).getFullYear(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setApplyError(data.error?.message || 'Failed to submit leave request.');
      } else {
        setApplySuccess(data.message || 'Leave request submitted successfully!');
        setTimeout(() => {
          setShowApplyModal(false);
          setApplySuccess(null);
          setFormData({
            employeeId: '',
            leaveTypeId: '',
            startDate: '',
            endDate: '',
            isHalfDay: false,
            halfDaySession: 'MORNING',
            reason: '',
            contactPhone: '',
            relieverEmployeeId: '',
          });
          fetchData();
        }, 1200);
      }
    } catch (err: any) {
      setApplyError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge badge-success">Approved</span>;
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return <span className="badge badge-warning">Pending Review</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">Rejected</span>;
      case 'CANCELLED':
        return <span className="badge badge-secondary">Cancelled</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leave Management Center</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Track entitlements, manage applications, process supervisor approvals, and audit duty availability.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/leave/calendar"
            className="btn btn-secondary flex items-center gap-2 text-sm"
          >
            <Calendar className="h-4 w-4" />
            <span>Staff Calendar</span>
          </Link>
          <button
            onClick={() => setShowApplyModal(true)}
            className="btn btn-primary flex items-center gap-2 text-sm shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* On Leave Today */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">On Leave Today</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.onLeaveToday || 0}
            </span>
            <span className="text-xs text-slate-500">staff off-duty</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-blue-600 dark:text-blue-400 font-medium">
            <Link href="/leave/calendar" className="hover:underline flex items-center gap-1">
              View availability matrix <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Approvals</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.pendingApprovals || 0}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Action required</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-amber-600 dark:text-amber-400 font-medium">
            <Link href="/leave/approvals" className="hover:underline flex items-center gap-1">
              Open approvals desk <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Upcoming Approved Leaves */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming Leaves</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.upcomingLeaves || 0}
            </span>
            <span className="text-xs text-slate-500">in next 30 days</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <Link href="/leave/requests?status=APPROVED" className="hover:underline flex items-center gap-1">
              View scheduled leaves <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Carried Forward Days */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Carried Forward</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : stats?.expiringCarryForward || 0}
            </span>
            <span className="text-xs text-slate-500">total days</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-purple-600 dark:text-purple-400 font-medium">
            <Link href="/leave/balances" className="hover:underline flex items-center gap-1">
              Check leave balances <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/leave/requests"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5" />
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="mt-3 font-semibold text-slate-900 dark:text-white text-sm">Leave Requests</h3>
          <p className="text-xs text-slate-500 mt-0.5">Explore full applications log</p>
        </Link>

        <Link
          href="/leave/approvals"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="mt-3 font-semibold text-slate-900 dark:text-white text-sm">Approvals Desk</h3>
          <p className="text-xs text-slate-500 mt-0.5">Supervisor review queue</p>
        </Link>

        <Link
          href="/leave/balances"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="mt-3 font-semibold text-slate-900 dark:text-white text-sm">Balances Matrix</h3>
          <p className="text-xs text-slate-500 mt-0.5">Entitlements & adjustments</p>
        </Link>

        <Link
          href="/leave/types"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CalendarDays className="h-5 w-5" />
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="mt-3 font-semibold text-slate-900 dark:text-white text-sm">Types & Policies</h3>
          <p className="text-xs text-slate-500 mt-0.5">Accrual & entitlement setup</p>
        </Link>
      </div>

      {/* Main Content Grid: Recent Requests + Configured Leave Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Leave Requests Table (2 Columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Leave Requests</h2>
              <p className="text-xs text-slate-500">Latest employee leave applications and status updates</p>
            </div>
            <Link
              href="/leave/requests"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-center">Days</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading leave applications...
                    </td>
                  </tr>
                ) : recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No leave requests recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        <Link href={`/leave/requests?id=${req.id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                          {req.requestNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">{req.employee?.fullName}</div>
                        <div className="text-[11px] text-slate-400">{req.employee?.employeeNumber}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{
                            backgroundColor: `${req.leaveType?.color || '#2563eb'}15`,
                            color: req.leaveType?.color || '#2563eb',
                          }}
                        >
                          {req.leaveType?.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {new Date(req.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} -{' '}
                        {new Date(req.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-900 dark:text-white">
                        {req.durationDays}d
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configured Leave Types Quick Matrix (1 Column) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Leave Policies</h2>
              <p className="text-xs text-slate-500">Statutory & corporate leave types</p>
            </div>
            <Link
              href="/leave/types"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Configure
            </Link>
          </div>

          <div className="space-y-2.5">
            {leaveTypes.map((type) => (
              <div
                key={type.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: type.color || '#2563eb' }}
                  />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">{type.name}</h4>
                    <p className="text-[11px] text-slate-400">
                      {type.isPaid ? 'Paid' : 'Unpaid'} • {type.genderApplicability === 'ALL' ? 'All Staff' : `${type.genderApplicability} Only`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{type.defaultDays}</span>
                  <span className="text-[10px] text-slate-400 block">days/yr</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
            <p className="font-semibold">Kenya Employment Act Compliant</p>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
              Includes statutory 21 days annual leave, 3 months maternity, 2 weeks paternity, and certified medical sick leave.
            </p>
          </div>
        </div>
      </div>

      {/* Apply for Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <span>Submit Leave Application</span>
              </h3>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {applyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{applyError}</span>
              </div>
            )}
            {applySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{applySuccess}</span>
              </div>
            )}

            <form onSubmit={handleApplySubmit} className="space-y-3.5">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.leaveTypeId}
                  onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Select Leave Type --</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.defaultDays} days default)
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Half Day Option */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isHalfDay}
                    onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Half Day Request (0.5 Day)</span>
                </label>

                {formData.isHalfDay && (
                  <select
                    value={formData.halfDaySession}
                    onChange={(e) => setFormData({ ...formData, halfDaySession: e.target.value })}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <option value="MORNING">Morning Session</option>
                    <option value="AFTERNOON">Afternoon Session</option>
                  </select>
                )}
              </div>

              {/* Reliever Employee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Reliever / Stand-in Guard
                </label>
                <select
                  value={formData.relieverEmployeeId}
                  onChange={(e) => setFormData({ ...formData, relieverEmployeeId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Select Reliever (Optional) --</option>
                  {employees
                    .filter((e) => e.id !== formData.employeeId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeNumber})
                      </option>
                    ))}
                </select>
              </div>

              {/* Contact Phone on Leave */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Emergency Phone Contact during Leave
                </label>
                <input
                  type="text"
                  placeholder="+254 7XX XXX XXX"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Leave <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Provide context for this leave application..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
