'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Search,
  Filter,
  Plus,
  Sliders,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  User,
  Sparkles,
} from 'lucide-react';
import { LeaveEntitlementData, LeaveTypeData } from '@/types';

export default function LeaveBalancesPage() {
  const [entitlements, setEntitlements] = useState<LeaveEntitlementData[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeData[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState({
    employeeId: '',
    leaveTypeId: '',
    leaveYear: new Date().getFullYear(),
    adjustmentType: 'ADDITION',
    adjustmentDays: 1,
    reason: '',
  });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  // Initialize Batch Entitlements Modal
  const [showInitModal, setShowInitModal] = useState(false);
  const [initYear, setInitYear] = useState(new Date().getFullYear());
  const [initializing, setInitializing] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);

  // Lookups
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [tRes, dRes, bRes, eRes] = await Promise.all([
          fetch('/api/leave/types?status=ACTIVE'),
          fetch('/api/departments?status=ACTIVE'),
          fetch('/api/branches?status=ACTIVE'),
          fetch('/api/employees?pageSize=100&status=ACTIVE'),
        ]);
        if (tRes.ok) {
          const d = await tRes.json();
          if (d.success) setLeaveTypes(d.data || []);
        }
        if (dRes.ok) {
          const d = await dRes.json();
          if (d.success) setDepartments(d.data || []);
        }
        if (bRes.ok) {
          const d = await bRes.json();
          if (d.success) setBranches(d.data || []);
        }
        if (eRes.ok) {
          const d = await eRes.json();
          if (d.success) setEmployees(d.data || []);
        }
      } catch (err) {
        console.error('Error loading lookups:', err);
      }
    };
    fetchLookups();
  }, []);

  const fetchEntitlements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('year', String(year));
      if (search) params.set('search', search);
      if (selectedType) params.set('leaveTypeId', selectedType);
      if (selectedDept) params.set('departmentId', selectedDept);
      if (selectedBranch) params.set('branchId', selectedBranch);

      const res = await fetch(`/api/leave/entitlements?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEntitlements(data.data || []);
        }
      }
    } catch (err) {
      console.error('Error loading entitlements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntitlements();
  }, [year, search, selectedType, selectedDept, selectedBranch]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjusting(true);
    setAdjustError(null);
    setAdjustSuccess(null);

    const adjustmentNumber =
      adjustData.adjustmentType === 'DEDUCTION' || adjustData.adjustmentType === 'CARRY_FORWARD_EXPIRY'
        ? -Math.abs(Number(adjustData.adjustmentDays))
        : Math.abs(Number(adjustData.adjustmentDays));

    try {
      const res = await fetch('/api/leave/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adjustData,
          adjustmentDays: adjustmentNumber,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAdjustError(data.error?.message || 'Failed to apply balance adjustment.');
      } else {
        setAdjustSuccess(data.message || 'Balance adjustment applied successfully!');
        setTimeout(() => {
          setShowAdjustModal(false);
          setAdjustSuccess(null);
          setAdjustData({
            employeeId: '',
            leaveTypeId: '',
            leaveYear: year,
            adjustmentType: 'ADDITION',
            adjustmentDays: 1,
            reason: '',
          });
          fetchEntitlements();
        }, 1000);
      }
    } catch (err: any) {
      setAdjustError(err.message || 'An unexpected error occurred.');
    } finally {
      setAdjusting(false);
    }
  };

  const handleInitializeEntitlements = async () => {
    setInitializing(true);
    setInitMessage(null);
    try {
      const res = await fetch('/api/leave/entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveYear: initYear }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInitMessage(data.message);
        setTimeout(() => {
          setShowInitModal(false);
          setInitMessage(null);
          setYear(initYear);
          fetchEntitlements();
        }, 1200);
      } else {
        setInitMessage(data.error?.message || 'Failed to initialize entitlements.');
      }
    } catch (err: any) {
      setInitMessage(err.message || 'Error occurred.');
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leave Balances & Entitlements Matrix</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Inspect opening balances, statutory allocations, carry-forwards, used days, and perform audited balance adjustments.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInitModal(true)}
            className="btn btn-secondary text-sm flex items-center gap-1.5"
          >
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span>Initialize Year</span>
          </button>
          <button
            onClick={() => setShowAdjustModal(true)}
            className="btn btn-primary text-sm flex items-center gap-1.5 shadow-sm"
          >
            <Sliders className="h-4 w-4" />
            <span>Manual Adjustment</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Year */}
          <div>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
            >
              <option value="2025">Leave Year 2025</option>
              <option value="2026">Leave Year 2026</option>
              <option value="2027">Leave Year 2027</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Leave Type */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="">All Leave Types</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
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
      </div>

      {/* Balances Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Leave Type</th>
                <th className="py-3.5 px-3 text-center">Opening</th>
                <th className="py-3.5 px-3 text-center">Entitled</th>
                <th className="py-3.5 px-3 text-center">Carry Fwd</th>
                <th className="py-3.5 px-3 text-center">Adjustments</th>
                <th className="py-3.5 px-3 text-center">Used</th>
                <th className="py-3.5 px-3 text-center">Pending</th>
                <th className="py-3.5 px-4 text-center bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300 font-bold">
                  Available Balance
                </th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Loading leave balance matrix...
                  </td>
                </tr>
              ) : entitlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No leave entitlements found for year {year}. Click &quot;Initialize Year&quot; to setup entitlements.
                  </td>
                </tr>
              ) : (
                entitlements.map((ent) => (
                  <tr key={ent.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{ent.employee?.fullName}</div>
                      <div className="text-[11px] text-slate-400">
                        {ent.employee?.employeeNumber} • {ent.employee?.department?.name || 'Guarding'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{
                          backgroundColor: `${ent.leaveType?.color || '#2563eb'}15`,
                          color: ent.leaveType?.color || '#2563eb',
                        }}
                      >
                        {ent.leaveType?.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-600 dark:text-slate-300">{ent.openingBalance}d</td>
                    <td className="py-3.5 px-3 text-center text-slate-600 dark:text-slate-300">{ent.entitledDays}d</td>
                    <td className="py-3.5 px-3 text-center text-slate-600 dark:text-slate-300">{ent.carriedForwardDays}d</td>
                    <td className="py-3.5 px-3 text-center">
                      {ent.adjustmentDays !== 0 ? (
                        <span className={`font-semibold ${ent.adjustmentDays > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {ent.adjustmentDays > 0 ? `+${ent.adjustmentDays}` : ent.adjustmentDays}d
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center font-medium text-slate-900 dark:text-white">{ent.usedDays}d</td>
                    <td className="py-3.5 px-3 text-center">
                      {ent.pendingDays > 0 ? (
                        <span className="font-semibold text-amber-600">{ent.pendingDays}d</span>
                      ) : (
                        <span className="text-slate-400">0d</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center bg-purple-50/30 dark:bg-purple-950/10 font-bold text-sm text-purple-700 dark:text-purple-400">
                      {ent.availableBalance}d
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setAdjustData({
                            employeeId: ent.employeeId,
                            leaveTypeId: ent.leaveTypeId,
                            leaveYear: ent.leaveYear,
                            adjustmentType: 'ADDITION',
                            adjustmentDays: 1,
                            reason: '',
                          });
                          setShowAdjustModal(true);
                        }}
                        className="btn btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                      >
                        <Sliders className="h-3 w-3" />
                        <span>Adjust</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Balance Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-purple-600" />
                <span>Manual Leave Balance Adjustment</span>
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {adjustError}
              </div>
            )}
            {adjustSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs">
                {adjustSuccess}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5">
              {/* Employee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={adjustData.employeeId}
                  onChange={(e) => setAdjustData({ ...adjustData, employeeId: e.target.value })}
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

              {/* Leave Type & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Leave Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={adjustData.leaveTypeId}
                    onChange={(e) => setAdjustData({ ...adjustData, leaveTypeId: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Select Type --</option>
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Leave Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adjustData.leaveYear}
                    onChange={(e) => setAdjustData({ ...adjustData, leaveYear: parseInt(e.target.value, 10) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              {/* Adjustment Type & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Action Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adjustData.adjustmentType}
                    onChange={(e) => setAdjustData({ ...adjustData, adjustmentType: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="ADDITION">+ Credit Days (Addition)</option>
                    <option value="DEDUCTION">- Debit Days (Deduction)</option>
                    <option value="CARRY_FORWARD">+ Approved Carry Forward</option>
                    <option value="CARRY_FORWARD_EXPIRY">- Expired Carry Forward</option>
                    <option value="CORRECTION">Manual Balance Correction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Number of Days <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={adjustData.adjustmentDays}
                    onChange={(e) => setAdjustData({ ...adjustData, adjustmentDays: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason & Audit Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Approved prior year carry-forward, contractual compensation days..."
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="btn btn-primary text-xs"
                >
                  {adjusting ? 'Applying...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Initialize Batch Entitlements Modal */}
      {showInitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span>Initialize Leave Year Entitlements</span>
            </h3>
            <p className="text-xs text-slate-500">
              This will automatically compute statutory and policy entitlements for all active employees for the
              selected leave year. Employees who joined mid-year will be automatically prorated based on their employment
              start date.
            </p>

            {initMessage && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs">
                {initMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Leave Year
              </label>
              <select
                value={initYear}
                onChange={(e) => setInitYear(parseInt(e.target.value, 10))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
              >
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowInitModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={initializing}
                onClick={handleInitializeEntitlements}
                className="btn btn-primary text-xs"
              >
                {initializing ? 'Calculating...' : 'Run Initialization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
