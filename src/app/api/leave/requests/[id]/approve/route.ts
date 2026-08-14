import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { leaveApprovalActionSchema } from '@/lib/validation';
import { syncApprovedLeaveWithAttendance } from '@/lib/leave-attendance-sync';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['leave.approve']);
    const body = await req.json().catch(() => ({}));

    const parsed = leaveApprovalActionSchema.safeParse(body);
    const comments = parsed.success ? parsed.data.comments : null;

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: true,
        leaveType: true,
      },
    });

    if (!leaveRequest) {
      return errorResponse('Leave request not found.', 404);
    }

    if (leaveRequest.status === 'APPROVED') {
      return errorResponse('This leave request has already been approved.', 400);
    }
    if (['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(leaveRequest.status)) {
      return errorResponse(`Cannot approve a leave request with status '${leaveRequest.status}'.`, 400);
    }

    // Anti-Self Approval Check: employee email/id vs session user
    if (leaveRequest.employee.email && leaveRequest.employee.email.toLowerCase() === session.user.email.toLowerCase()) {
      const isSuperAdmin = session.roles.includes('super_admin');
      if (!isSuperAdmin) {
        return errorResponse('Self-approval violation: You cannot approve your own leave request.', 403);
      }
    }

    // Atomic transaction: update request + move entitlement pendingDays -> usedDays
    const [approvedRequest] = await db.$transaction([
      db.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewerComments: comments || 'Approved by HR/Supervisor',
        },
        include: {
          employee: { select: { id: true, fullName: true, employeeNumber: true } },
          leaveType: true,
        },
      }),
      db.leaveEntitlement.update({
        where: {
          employeeId_leaveTypeId_leaveYear: {
            employeeId: leaveRequest.employeeId,
            leaveTypeId: leaveRequest.leaveTypeId,
            leaveYear: leaveRequest.leaveYear,
          },
        },
        data: {
          pendingDays: { decrement: leaveRequest.durationDays },
          usedDays: { increment: leaveRequest.durationDays },
        },
      }),
    ]);

    // Synchronize Approved Leave with Attendance Module
    const attendanceRecordsCreated = await syncApprovedLeaveWithAttendance(params.id);

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'APPROVE_LEAVE_REQUEST',
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: approvedRequest.id,
      newValue: {
        requestNumber: approvedRequest.requestNumber,
        employeeName: approvedRequest.employee.fullName,
        durationDays: approvedRequest.durationDays,
        attendanceDaysSynced: attendanceRecordsCreated,
        comments,
      },
    });

    return successResponse(
      {
        request: approvedRequest,
        attendanceDaysSynced: attendanceRecordsCreated,
      },
      `Leave request ${approvedRequest.requestNumber} approved successfully. ${attendanceRecordsCreated} attendance duty record(s) synchronized.`
    );
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Approve leave request error:', error);
    return errorResponse('Failed to approve leave request.');
  }
}
