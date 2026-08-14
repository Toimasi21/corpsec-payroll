'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  AlertCircle,
  Calendar,
  Layers,
  ChevronRight,
  Eye,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { LeaveRequestData } from '@/types';

export default function LeaveApprovalsPage() {
  const [requests, setRequests] = useState<LeaveRequestData[]>([]);
  const [loading, setLoading] = useState(true);

  // Action Dialog State
  const [activeActionReq, setActiveActionReq] = useState<LeaveRequestData | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leave/requests?status=SUBMITTED&pageSize=50');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRequests(data.data || []);
        }
      }
    } catch (err) {
      console.error('Error loading pending leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const openActionModal = (req: LeaveRequestData, type: 'APPROVE' | 'REJECT') => {
    setActiveActionReq(req);
    setActionType(type);
    setComments('');
    setActionError(null);
    setActionSuccess(null);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActionReq) return;

    if (actionType === 'REJECT' && (!comments || comments.trim().length < 3)) {
      setActionError('A clear justification comment of at least 3 characters is mandatory when rejecting.');
      return;
    }

    setProcessing(true);
    setActionError(null);

    const endpoint = `/api/leave/requests/${activeActionReq.id}/${actionType.toLowerCase()}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.error?.message || `Failed to ${actionType.toLowerCase()} leave request.`);
      } else {
        setActionSuccess(data.message || `Leave request successfully ${actionType.toLowerCase()}d.`);
        setTimeout(() => {
          setActiveActionReq(null);
          setActionSuccess(null);
          fetchPendingRequests();
        }, 1000);
      }
    } catch (err: any) {
      setActionError(err.message || 'An unexpected error occurred.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Supervisor & HR Approvals Desk</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review pending leave applications, verify station guard coverage, and approve duty off-time.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leave/calendar" className="btn btn-secondary text-sm flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>Check Availability Matrix</span>
          </Link>
          <button
            onClick={fetchPendingRequests}
            className="btn btn-secondary text-sm"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Overview Banner */}
      <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <span>
            <b>{requests.length} Application(s)</b> currently awaiting supervisor and HR review. Approved leaves
            automatically synchronize with the live attendance rosters.
          </span>
        </div>
      </div>

      {/* Pending Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            Loading pending approvals queue...
          </div>
        ) : requests.length === 0 ? (
          <div className="col-span-full py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">All Caught Up!</h3>
            <p className="text-xs text-slate-500">There are no pending leave requests requiring review right now.</p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all space-y-4"
            >
              {/* Top Row: Request # + Employee */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 font-bold flex items-center justify-center text-sm">
                    {req.employee?.fullName?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{req.employee?.fullName}</h3>
                    <p className="text-[11px] text-slate-400">
                      {req.employee?.employeeNumber} • {req.employee?.department?.name || 'Guarding'}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {req.requestNumber}
                </span>
              </div>

              {/* Leave Info Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Leave Type:</span>
                  <span
                    className="font-semibold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${req.leaveType?.color || '#2563eb'}15`,
                      color: req.leaveType?.color || '#2563eb',
                    }}
                  >
                    {req.leaveType?.name}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Period:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {new Date(req.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} -{' '}
                    {new Date(req.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {req.durationDays} Working Day(s) {req.isHalfDay && '(Half Day)'}
                  </span>
                </div>

                {req.reliever && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-slate-500">Relief Guard:</span>
                    <span className="font-medium text-slate-900 dark:text-white">{req.reliever.fullName}</span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 italic">
                &quot;{req.reason}&quot;
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Applied {new Date(req.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openActionModal(req, 'REJECT')}
                    className="btn btn-danger py-1.5 px-3 text-xs flex items-center gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => openActionModal(req, 'APPROVE')}
                    className="btn btn-success py-1.5 px-3.5 text-xs flex items-center gap-1 shadow-sm"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Decision Action Modal */}
      {activeActionReq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3
                className={`text-base font-bold flex items-center gap-2 ${
                  actionType === 'APPROVE' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {actionType === 'APPROVE' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Approve Leave Application</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5" />
                    <span>Reject Leave Application</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveActionReq(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs">
                {actionSuccess}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
              <div className="font-semibold text-slate-900 dark:text-white">
                {activeActionReq.employee?.fullName} ({activeActionReq.requestNumber})
              </div>
              <div className="text-slate-500">
                {activeActionReq.leaveType?.name} • {activeActionReq.durationDays} day(s) from{' '}
                {new Date(activeActionReq.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </div>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {actionType === 'APPROVE' ? 'Reviewer / Supervisor Notes (Optional)' : 'Mandatory Rejection Reason'}{' '}
                  {actionType === 'REJECT' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  required={actionType === 'REJECT'}
                  rows={3}
                  placeholder={
                    actionType === 'APPROVE'
                      ? 'e.g. Guard relief confirmed, approved by Operations Commander...'
                      : 'Provide clear justification for rejection...'
                  }
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveActionReq(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`btn text-xs ${
                    actionType === 'APPROVE' ? 'btn-success' : 'btn-danger'
                  }`}
                >
                  {processing
                    ? 'Processing...'
                    : actionType === 'APPROVE'
                    ? 'Confirm & Synchronize Roster'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
