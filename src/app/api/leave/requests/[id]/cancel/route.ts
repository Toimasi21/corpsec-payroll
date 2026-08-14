import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { revertCancelledLeaveAttendance } from '@/lib/leave-attendance-sync';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['leave.cancel']);
    const body = await req.json().catch(() => ({}));

    const reason = body.reason || body.cancellationReason;
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return errorResponse('A valid cancellation justification reason of at least 3 characters is required.', 400);
    }

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: params.id },
      include: { employee: true },
    });

    if (!leaveRequest) {
      return errorResponse('Leave request not found.', 404);
    }

    if (['CANCELLED', 'REJECTED', 'WITHDRAWN'].includes(leaveRequest.status)) {
      return errorResponse(`Cannot cancel a leave request with status '${leaveRequest.status}'.`, 400);
    }

    const wasApproved = leaveRequest.status === 'APPROVED';

    // 1. Transaction: update request + restore entitlement balances
    const entitlementUpdateData: any = {};
    if (wasApproved) {
      entitlementUpdateData.usedDays = { decrement: leaveRequest.durationDays };
      entitlementUpdateData.availableBalance = { increment: leaveRequest.durationDays };
    } else {
      entitlementUpdateData.pendingDays = { decrement: leaveRequest.durationDays };
      entitlementUpdateData.availableBalance = { increment: leaveRequest.durationDays };
    }

    const [cancelledRequest] = await db.$transaction([
      db.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          cancelledById: session.user.id,
          cancelledAt: new Date(),
          cancellationReason: reason.trim(),
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
        data: entitlementUpdateData,
      }),
    ]);

    // 2. If it was approved, revert attendance records
    let attendanceReverted = 0;
    if (wasApproved) {
      attendanceReverted = await revertCancelledLeaveAttendance(params.id);
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'CANCEL_LEAVE_REQUEST',
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: cancelledRequest.id,
      newValue: {
        requestNumber: cancelledRequest.requestNumber,
        employeeName: cancelledRequest.employee.fullName,
        durationDays: cancelledRequest.durationDays,
        reason: reason.trim(),
        attendanceReverted,
      },
    });

    return successResponse(
      {
        request: cancelledRequest,
        attendanceReverted,
      },
      `Leave request ${cancelledRequest.requestNumber} cancelled. ${cancelledRequest.durationDays} day(s) restored to employee balance.${
        wasApproved ? ` ${attendanceReverted} attendance record(s) reverted.` : ''
      }`
    );
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Cancel leave request error:', error);
    return errorResponse('Failed to cancel leave request.');
  }
}
