'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { LeaveTypeData, LeavePolicyData } from '@/types';

export default function LeaveTypesAndPoliciesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeData[]>([]);
  const [policies, setPolicies] = useState<LeavePolicyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'TYPES' | 'POLICIES'>('TYPES');

  // Leave Type Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState({
    id: '',
    code: '',
    name: '',
    description: '',
    isPaid: true,
    defaultDays: 21,
    maxDays: 30,
    requiresApproval: true,
    requiresDocument: false,
    requiresMedicalCert: false,
    genderApplicability: 'ALL',
    color: '#2563eb',
  });
  const [submittingType, setSubmittingType] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  // Leave Policy Modal
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    id: '',
    leaveTypeId: '',
    policyName: '',
    policyCode: '',
    entitledDays: 21,
    accrualMethod: 'ANNUAL_ALLOCATION',
    accrualFrequency: 'YEARLY',
    allowCarryForward: true,
    maxCarryForwardDays: 5,
    carryForwardExpiryMonths: 3,
    minServiceDays: 90,
    prorationRule: 'PRORATED_BY_MONTH',
    excludeWeekends: true,
    excludeHolidays: true,
    allowAdvanceLeave: false,
    maxAdvanceDays: 0,
  });
  const [submittingPolicy, setSubmittingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([
        fetch('/api/leave/types'),
        fetch('/api/leave/policies'),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        if (d.success) setLeaveTypes(d.data || []);
      }
      if (pRes.ok) {
        const d = await pRes.json();
        if (d.success) setPolicies(d.data || []);
      }
    } catch (err) {
      console.error('Error loading leave types & policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingType(true);
    setTypeError(null);

    const isEdit = Boolean(typeForm.id);
    const endpoint = isEdit ? `/api/leave/types/${typeForm.id}` : '/api/leave/types';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTypeError(data.error?.message || 'Failed to save leave type.');
      } else {
        setShowTypeModal(false);
        fetchData();
      }
    } catch (err: any) {
      setTypeError(err.message || 'An error occurred.');
    } finally {
      setSubmittingType(false);
    }
  };

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPolicy(true);
    setPolicyError(null);

    const isEdit = Boolean(policyForm.id);
    const endpoint = isEdit ? `/api/leave/policies/${policyForm.id}` : '/api/leave/policies';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPolicyError(data.error?.message || 'Failed to save leave policy.');
      } else {
        setShowPolicyModal(false);
        fetchData();
      }
    } catch (err: any) {
      setPolicyError(err.message || 'An error occurred.');
    } finally {
      setSubmittingPolicy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leave Types & Policy Configuration</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Define corporate and statutory leave categories, accrual frequencies, carry-forward caps, and eligibility rules.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'TYPES' ? (
            <button
              onClick={() => {
                setTypeForm({
                  id: '',
                  code: '',
                  name: '',
                  description: '',
                  isPaid: true,
                  defaultDays: 21,
                  maxDays: 30,
                  requiresApproval: true,
                  requiresDocument: false,
                  requiresMedicalCert: false,
                  genderApplicability: 'ALL',
                  color: '#2563eb',
                });
                setShowTypeModal(true);
              }}
              className="btn btn-primary text-sm flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Create Leave Type</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setPolicyForm({
                  id: '',
                  leaveTypeId: leaveTypes[0]?.id || '',
                  policyName: '',
                  policyCode: '',
                  entitledDays: 21,
                  accrualMethod: 'ANNUAL_ALLOCATION',
                  accrualFrequency: 'YEARLY',
                  allowCarryForward: true,
                  maxCarryForwardDays: 5,
                  carryForwardExpiryMonths: 3,
                  minServiceDays: 90,
                  prorationRule: 'PRORATED_BY_MONTH',
                  excludeWeekends: true,
                  excludeHolidays: true,
                  allowAdvanceLeave: false,
                  maxAdvanceDays: 0,
                });
                setShowPolicyModal(true);
              }}
              className="btn btn-primary text-sm flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Leave Policy</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('TYPES')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'TYPES'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          <span>Leave Types ({leaveTypes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('POLICIES')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'POLICIES'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Accrual & Carry-Forward Policies ({policies.length})</span>
        </button>
      </div>

      {/* Content View */}
      {activeTab === 'TYPES' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400">Loading leave types...</div>
          ) : (
            leaveTypes.map((type) => (
              <div
                key={type.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-blue-300 dark:hover:border-blue-800 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: type.color || '#2563eb' }}
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{type.name}</h3>
                      <span className="font-mono text-[11px] text-slate-400">{type.code}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      type.isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {type.isPaid ? 'Paid Leave' : 'Unpaid'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                  {type.description || 'Standard corporate leave classification.'}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Default Allowance</span>
                    <span className="font-bold text-slate-900 dark:text-white">{type.defaultDays} Days / Year</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Applicability</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {type.genderApplicability === 'ALL' ? 'All Genders' : `${type.genderApplicability} Only`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    {type.requiresDocument ? 'Supporting Doc Required' : 'No Attachment Required'}
                  </span>
                  <button
                    onClick={() => {
                      setTypeForm({
                        id: type.id,
                        code: type.code,
                        name: type.name,
                        description: type.description || '',
                        isPaid: type.isPaid,
                        defaultDays: type.defaultDays,
                        maxDays: type.maxDays || 30,
                        requiresApproval: type.requiresApproval,
                        requiresDocument: type.requiresDocument,
                        requiresMedicalCert: type.requiresMedicalCert,
                        genderApplicability: type.genderApplicability,
                        color: type.color || '#2563eb',
                      });
                      setShowTypeModal(true);
                    }}
                    className="btn btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Policy Code / Name</th>
                  <th className="py-3.5 px-4">Leave Type</th>
                  <th className="py-3.5 px-3 text-center">Entitled Days</th>
                  <th className="py-3.5 px-3 text-center">Accrual Method</th>
                  <th className="py-3.5 px-3 text-center">Carry Forward</th>
                  <th className="py-3.5 px-3 text-center">Proration</th>
                  <th className="py-3.5 px-3 text-center">Exclusions</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No policies configured yet.
                    </td>
                  </tr>
                ) : (
                  policies.map((pol) => (
                    <tr key={pol.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{pol.policyName}</div>
                        <div className="font-mono text-[11px] text-slate-400">{pol.policyCode}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {pol.leaveType?.name || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                        {pol.entitledDays}d
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-600 dark:text-slate-300">
                        {pol.accrualMethod.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {pol.allowCarryForward ? (
                          <span className="text-emerald-600 font-semibold">Max {pol.maxCarryForwardDays}d</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-600 dark:text-slate-300">
                        {pol.prorationRule.replace('PRORATED_BY_', '')}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-600 dark:text-slate-300 text-[11px]">
                        {pol.excludeWeekends && 'Weekends, '}
                        {pol.excludeHolidays && 'Holidays'}
                        {!pol.excludeWeekends && !pol.excludeHolidays && 'Calendar Days'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setPolicyForm({
                              id: pol.id,
                              leaveTypeId: pol.leaveTypeId,
                              policyName: pol.policyName,
                              policyCode: pol.policyCode,
                              entitledDays: pol.entitledDays,
                              accrualMethod: pol.accrualMethod,
                              accrualFrequency: pol.accrualFrequency,
                              allowCarryForward: pol.allowCarryForward,
                              maxCarryForwardDays: pol.maxCarryForwardDays,
                              carryForwardExpiryMonths: pol.carryForwardExpiryMonths,
                              minServiceDays: pol.minServiceDays,
                              prorationRule: pol.prorationRule,
                              excludeWeekends: pol.excludeWeekends,
                              excludeHolidays: pol.excludeHolidays,
                              allowAdvanceLeave: pol.allowAdvanceLeave,
                              maxAdvanceDays: pol.maxAdvanceDays,
                            });
                            setShowPolicyModal(true);
                          }}
                          className="btn btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {typeForm.id ? 'Edit Leave Type' : 'Create Leave Type'}
              </h3>
              <button
                onClick={() => setShowTypeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {typeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {typeError}
              </div>
            )}

            <form onSubmit={handleTypeSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LT-CASUAL"
                    value={typeForm.code}
                    onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Casual Leave"
                    value={typeForm.name}
                    onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of leave coverage..."
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={typeForm.defaultDays}
                    onChange={(e) => setTypeForm({ ...typeForm, defaultDays: parseInt(e.target.value, 10) || 0 })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender Rule
                  </label>
                  <select
                    value={typeForm.genderApplicability}
                    onChange={(e) => setTypeForm({ ...typeForm, genderApplicability: e.target.value as any })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="ALL">All Genders</option>
                    <option value="FEMALE">Female Only</option>
                    <option value="MALE">Male Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Color Accent
                  </label>
                  <input
                    type="color"
                    value={typeForm.color}
                    onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                    className="w-full h-10 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.isPaid}
                    onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Paid Leave</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.requiresDocument}
                    onChange={(e) => setTypeForm({ ...typeForm, requiresDocument: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Require Supporting Doc</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingType}
                  className="btn btn-primary text-xs"
                >
                  {submittingType ? 'Saving...' : 'Save Leave Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {policyForm.id ? 'Edit Leave Policy' : 'Create Leave Policy'}
              </h3>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {policyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {policyError}
              </div>
            )}

            <form onSubmit={handlePolicySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Associated Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={policyForm.leaveTypeId}
                  onChange={(e) => setPolicyForm({ ...policyForm, leaveTypeId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Select Type --</option>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Policy Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. POL-ANN-STD"
                    value={policyForm.policyCode}
                    onChange={(e) => setPolicyForm({ ...policyForm, policyCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Policy Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard Annual Leave"
                    value={policyForm.policyName}
                    onChange={(e) => setPolicyForm({ ...policyForm, policyName: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Entitled Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={policyForm.entitledDays}
                    onChange={(e) => setPolicyForm({ ...policyForm, entitledDays: parseInt(e.target.value, 10) || 0 })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Accrual Method
                  </label>
                  <select
                    value={policyForm.accrualMethod}
                    onChange={(e) => setPolicyForm({ ...policyForm, accrualMethod: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="ANNUAL_ALLOCATION">Annual Upfront</option>
                    <option value="MONTHLY_ACCRUAL">Monthly Accrual</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Proration Rule
                  </label>
                  <select
                    value={policyForm.prorationRule}
                    onChange={(e) => setPolicyForm({ ...policyForm, prorationRule: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="PRORATED_BY_MONTH">By Month</option>
                    <option value="PRORATED_BY_DAY">By Day</option>
                    <option value="NONE">No Proration</option>
                  </select>
                </div>
              </div>

              {/* Carry Forward Options */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.allowCarryForward}
                    onChange={(e) => setPolicyForm({ ...policyForm, allowCarryForward: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Allow Year-End Carry Forward</span>
                </label>

                {policyForm.allowCarryForward && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Max Carry Forward Days</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={policyForm.maxCarryForwardDays}
                        onChange={(e) =>
                          setPolicyForm({ ...policyForm, maxCarryForwardDays: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Expiry Period (Months)</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={policyForm.carryForwardExpiryMonths}
                        onChange={(e) =>
                          setPolicyForm({ ...policyForm, carryForwardExpiryMonths: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Exclusions */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.excludeWeekends}
                    onChange={(e) => setPolicyForm({ ...policyForm, excludeWeekends: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Exclude Weekends</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.excludeHolidays}
                    onChange={(e) => setPolicyForm({ ...policyForm, excludeHolidays: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Exclude Public Holidays</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPolicy}
                  className="btn btn-primary text-xs"
                >
                  {submittingPolicy ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
