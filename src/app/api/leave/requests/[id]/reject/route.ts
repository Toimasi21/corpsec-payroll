import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['leave.reject']);
    const body = await req.json().catch(() => ({}));

    const comments = body.comments || body.reason;
    if (!comments || typeof comments !== 'string' || comments.trim().length < 3) {
      return errorResponse('A clear rejection reason of at least 3 characters is required.', 400);
    }

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: params.id },
      include: { employee: true },
    });

    if (!leaveRequest) {
      return errorResponse('Leave request not found.', 404);
    }

    if (leaveRequest.status === 'REJECTED') {
      return errorResponse('This leave request has already been rejected.', 400);
    }
    if (['APPROVED', 'CANCELLED', 'WITHDRAWN'].includes(leaveRequest.status)) {
      return errorResponse(`Cannot reject a leave request with status '${leaveRequest.status}'.`, 400);
    }

    // Atomic transaction: update request + release pending days back to available balance
    const [rejectedRequest] = await db.$transaction([
      db.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          rejectionReason: comments.trim(),
          reviewerComments: comments.trim(),
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
          availableBalance: { increment: leaveRequest.durationDays },
        },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'REJECT_LEAVE_REQUEST',
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: rejectedRequest.id,
      newValue: {
        requestNumber: rejectedRequest.requestNumber,
        employeeName: rejectedRequest.employee.fullName,
        durationDays: rejectedRequest.durationDays,
        rejectionReason: comments.trim(),
      },
    });

    return successResponse(
      rejectedRequest,
      `Leave request ${rejectedRequest.requestNumber} rejected. ${rejectedRequest.durationDays} day(s) restored to employee balance.`
    );
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Reject leave request error:', error);
    return errorResponse('Failed to reject leave request.');
  }
}
