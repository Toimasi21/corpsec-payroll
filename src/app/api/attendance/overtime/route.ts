import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { overtimeRecordSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['attendance.view', 'overtime.view']);
    const { searchParams } = new URL(req.url);

    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (status && status !== 'ALL') where.approvalStatus = status;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const ed = new Date(endDate);
        ed.setHours(23, 59, 59, 999);
        where.date.lte = ed;
      }
    }

    const records = await db.overtimeRecord.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            fullName: true,
            jobTitle: true,
            station: { select: { name: true } },
            department: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
        requestedBy: { select: { firstName: true, lastName: true, email: true } },
        approvedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return successResponse(records);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch overtime records', error.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['overtime.create', 'attendance.create']);
    const body = await req.json();

    const parsed = overtimeRecordSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || 'Validation error', 400);
    }

    const data = parsed.data;

    const employee = await db.employee.findUnique({
      where: { id: data.employeeId },
    });
    if (!employee || employee.deletedAt) {
      return errorResponse('Employee not found', 404);
    }

    const recordDate = new Date(data.date);
    recordDate.setHours(0, 0, 0, 0);

    const overtimeMins = Math.round(data.overtimeHours * 60);

    const overtimeRecord = await db.overtimeRecord.create({
      data: {
        employeeId: data.employeeId,
        attendanceRecordId: data.attendanceRecordId || null,
        date: recordDate,
        scheduledHours: data.scheduledHours,
        actualHours: data.actualHours,
        overtimeMinutes: overtimeMins,
        overtimeHours: data.overtimeHours,
        reason: data.reason,
        comments: data.comments || null,
        requestedById: session.user.id,
        approvalStatus: 'PENDING',
      },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'REQUEST_OVERTIME',
      module: 'OVERTIME',
      entityType: 'OvertimeRecord',
      entityId: overtimeRecord.id,
      newValue: JSON.stringify(overtimeRecord),
    });

    return successResponse(overtimeRecord, 'Overtime claim submitted for HR approval', 201);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to submit overtime claim', error.status || 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(['overtime.approve', 'attendance.approve']);
    const body = await req.json();
    const { overtimeId, action, comments, approvedHours } = body;

    if (!overtimeId || !action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return errorResponse('Valid overtimeId and action (APPROVE or REJECT) are required', 400);
    }

    const { AttendanceService } = await import('@/lib/attendance/AttendanceService');
    const updated = await AttendanceService.reviewOvertime({
      overtimeId,
      action,
      reviewerUserId: session.user.id,
      comments,
      approvedHours: approvedHours !== undefined ? Number(approvedHours) : undefined,
    });

    return successResponse(updated, `Overtime claim ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to review overtime claim', error.status || 500);
  }
}

