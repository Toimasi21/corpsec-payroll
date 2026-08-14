'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  X,
  FileText,
  Paperclip,
  Download,
  Calendar,
  User,
  Shield,
  MapPin,
  Building,
  Check,
} from 'lucide-react';
import { LeaveRequestData, LeaveTypeData } from '@/types';

export default function LeaveRequestsExplorerPage() {
  const [requests, setRequests] = useState<LeaveRequestData[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeData[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1, pageSize: 20 });

  // Detail Modal / Drawer State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Fetch lookups
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [tRes, dRes, bRes] = await Promise.all([
          fetch('/api/leave/types?status=ACTIVE'),
          fetch('/api/departments?status=ACTIVE'),
          fetch('/api/branches?status=ACTIVE'),
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
      } catch (err) {
        console.error('Error loading lookups:', err);
      }
    };
    fetchLookups();
  }, []);

  // Fetch Requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (search) params.set('search', search);
      if (selectedType) params.set('leaveTypeId', selectedType);
      if (selectedStatus) params.set('status', selectedStatus);
      if (selectedDept) params.set('departmentId', selectedDept);
      if (selectedBranch) params.set('branchId', selectedBranch);

      const res = await fetch(`/api/leave/requests?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRequests(data.data || []);
          if (data.meta) setMeta(data.meta);
        }
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page, search, selectedType, selectedStatus, selectedDept, selectedBranch]);

  // Open detail
  const handleViewDetail = async (reqId: string) => {
    setDetailLoading(true);
    setSelectedRequest(null);
    try {
      const res = await fetch(`/api/leave/requests/${reqId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSelectedRequest(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading request detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle Cancel Request
  const handleConfirmCancel = async () => {
    if (!selectedRequest || !cancelReason.trim()) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/leave/requests/${selectedRequest.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCancelError(data.error?.message || 'Failed to cancel leave request.');
      } else {
        setShowCancelModal(false);
        setCancelReason('');
        handleViewDetail(selectedRequest.id);
        fetchRequests();
      }
    } catch (err: any) {
      setCancelError(err.message || 'An error occurred.');
    } finally {
      setCancelling(false);
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leave Applications Explorer</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Audit, inspect, filter, and track employee leave requests across all operating stations.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leave" className="btn btn-secondary text-sm">
            Leave Center
          </Link>
          <Link href="/leave/approvals" className="btn btn-primary text-sm flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span>Approvals Desk</span>
          </Link>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee, request #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Leave Type Filter */}
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

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
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
              <option value="">All Regional Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Request #</th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Branch / Dept</th>
                <th className="py-3.5 px-4">Leave Type</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-center">Days</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading leave requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No leave requests match your search criteria.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {req.requestNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{req.employee?.fullName}</div>
                      <div className="text-[11px] text-slate-400">{req.employee?.employeeNumber}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <div>{req.employee?.department?.name || '—'}</div>
                      <div className="text-[11px] text-slate-400">{req.employee?.branch?.name || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {new Date(req.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} -{' '}
                      {new Date(req.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white">
                      {req.durationDays}d
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(req.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleViewDetail(req.id)}
                        className="btn btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page {meta.page} of {meta.totalPages} ({meta.total} records total)
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="btn btn-secondary py-1 px-3 text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
                className="btn btn-secondary py-1 px-3 text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Drawer Modal */}
      {(selectedRequest || detailLoading) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
            {detailLoading ? (
              <div className="py-16 text-center text-slate-400">Loading leave application details...</div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {selectedRequest.requestNumber}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Leave Application Dossier
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Employee Profile Header */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {selectedRequest.employee?.fullName?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedRequest.employee?.fullName}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {selectedRequest.employee?.employeeNumber} • {selectedRequest.employee?.jobTitle}
                      </p>
                    </div>
                  </div>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Leave Type</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedRequest.leaveType?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Duration</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedRequest.durationDays} Day(s) {selectedRequest.isHalfDay && '(Half Day)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Leave Year</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{selectedRequest.leaveYear}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Start Date</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {new Date(selectedRequest.startDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">End Date</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {new Date(selectedRequest.endDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Reliever / Stand-in</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedRequest.reliever?.fullName || 'None designated'}
                    </span>
                  </div>
                </div>

                {/* Reason */}
                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-400 block font-semibold mb-1">Reason for Leave:</span>
                  <p className="text-slate-700 dark:text-slate-300">{selectedRequest.reason}</p>
                </div>

                {/* Entitlement Balance Status */}
                {selectedRequest.currentEntitlement && (
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900 text-xs">
                    <span className="font-semibold text-blue-900 dark:text-blue-300 block mb-1">
                      Current Leave Balance Status ({selectedRequest.leaveYear})
                    </span>
                    <div className="grid grid-cols-4 gap-2 text-center mt-2">
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Entitled</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedRequest.currentEntitlement.entitledDays}d
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Used</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedRequest.currentEntitlement.usedDays}d
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Pending</span>
                        <span className="font-bold text-amber-600">
                          {selectedRequest.currentEntitlement.pendingDays}d
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Available</span>
                        <span className="font-bold text-emerald-600">
                          {selectedRequest.currentEntitlement.availableBalance}d
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review / Cancellation Audit */}
                {selectedRequest.reviewedBy && (
                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900 text-xs">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300">
                      Approval / Review Audit:
                    </span>
                    <p className="text-emerald-800 dark:text-emerald-400 mt-1">
                      Reviewed by {selectedRequest.reviewedBy.firstName} {selectedRequest.reviewedBy.lastName} on{' '}
                      {new Date(selectedRequest.reviewedAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {selectedRequest.reviewerComments && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                        Comments: &quot;{selectedRequest.reviewerComments}&quot;
                      </p>
                    )}
                  </div>
                )}

                {selectedRequest.cancelledBy && (
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold block">Cancellation Record:</span>
                    <p>
                      Cancelled on{' '}
                      {new Date(selectedRequest.cancelledAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="italic text-[11px] mt-0.5">Reason: &quot;{selectedRequest.cancellationReason}&quot;</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    {!['CANCELLED', 'REJECTED'].includes(selectedRequest.status) && (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="btn btn-danger py-1.5 px-3 text-xs"
                      >
                        Cancel Leave Request
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="btn btn-secondary text-xs"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              <span>Confirm Leave Cancellation</span>
            </h3>
            <p className="text-xs text-slate-500">
              Cancelling this leave request will restore <b>{selectedRequest?.durationDays} day(s)</b> back to the
              employee&apos;s available balance and revert any synchronized attendance duty records.
            </p>

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {cancelError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cancellation Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="btn btn-secondary text-xs"
              >
                Keep Request
              </button>
              <button
                type="button"
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleConfirmCancel}
                className="btn btn-danger text-xs"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
