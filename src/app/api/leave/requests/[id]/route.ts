import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(['leave.view']);

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            fullName: true,
            gender: true,
            jobTitle: true,
            employmentDate: true,
            department: { select: { name: true, code: true } },
            branch: { select: { name: true, code: true } },
            station: { select: { name: true, code: true } },
            position: { select: { title: true, code: true } },
            supervisor: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        },
        leaveType: true,
        reliever: {
          select: { id: true, fullName: true, employeeNumber: true, jobTitle: true },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        cancelledBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        documents: {
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!leaveRequest) {
      return errorResponse('Leave request not found.', 404);
    }

    // Also fetch current entitlement balance for this employee and leave type
    const entitlement = await db.leaveEntitlement.findUnique({
      where: {
        employeeId_leaveTypeId_leaveYear: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          leaveYear: leaveRequest.leaveYear,
        },
      },
    });

    return successResponse({
      ...leaveRequest,
      currentEntitlement: entitlement,
    });
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Fetch leave request error:', error);
    return errorResponse('Failed to fetch leave request details.');
  }
}
