import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { attendanceCorrectionSchema } from '@/lib/validation';
import { evaluateAttendance, ShiftInfo } from '@/lib/attendance-calculator';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['attendance.view', 'attendance.correct']);
    const { searchParams } = new URL(req.url);

    const employeeId = searchParams.get('employeeId');
    const attendanceRecordId = searchParams.get('recordId');

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (attendanceRecordId) where.attendanceRecordId = attendanceRecordId;

    const adjustments = await db.attendanceAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            fullName: true,
            jobTitle: true,
            station: { select: { name: true } },
          },
        },
        attendanceRecord: {
          select: {
            date: true,
            approvalStatus: true,
            attendanceStatus: true,
          },
        },
        correctedBy: { select: { firstName: true, lastName: true, email: true } },
        approvedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return successResponse(adjustments);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch attendance corrections', error.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['attendance.correct']);
    const body = await req.json();

    const parsed = attendanceCorrectionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || 'Validation error', 400);
    }

    const { attendanceRecordId, fieldChanged, newValue, reason } = parsed.data;

    const record = await db.attendanceRecord.findUnique({
      where: { id: attendanceRecordId },
      include: { scheduledShift: true },
    });

    if (!record) {
      return errorResponse('Attendance record not found', 404);
    }

    let originalValue = '';
    const updateData: any = {};

    if (fieldChanged === 'CLOCK_IN') {
      originalValue = record.actualClockIn ? record.actualClockIn.toISOString() : 'NULL';
      const newDate = new Date(newValue);
      updateData.actualClockIn = newDate;
    } else if (fieldChanged === 'CLOCK_OUT') {
      originalValue = record.actualClockOut ? record.actualClockOut.toISOString() : 'NULL';
      const newDate = new Date(newValue);
      updateData.actualClockOut = newDate;
    } else if (fieldChanged === 'STATUS') {
      originalValue = record.attendanceStatus;
      updateData.attendanceStatus = newValue;
    } else if (fieldChanged === 'WORKED_MINUTES') {
      originalValue = `${record.workedMinutes}`;
      updateData.workedMinutes = parseInt(newValue, 10);
    } else if (fieldChanged === 'OVERTIME') {
      originalValue = `${record.overtimeMinutes}`;
      updateData.overtimeMinutes = parseInt(newValue, 10);
    }

    // Atomic transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create Adjustment Record (Audit Trail)
      const adjustment = await tx.attendanceAdjustment.create({
        data: {
          attendanceRecordId: record.id,
          employeeId: record.employeeId,
          fieldChanged,
          originalValue,
          newValue,
          reason,
          correctedById: session.user.id,
          approvedById: session.user.id,
          status: 'APPLIED',
        },
      });

      // 2. Re-evaluate metrics if clock times were adjusted
      if (fieldChanged === 'CLOCK_IN' || fieldChanged === 'CLOCK_OUT') {
        const shift = record.scheduledShift;
        const shiftInfo: ShiftInfo | null = shift
          ? {
              startTime: record.scheduledStartTime || shift.startTime,
              endTime: record.scheduledEndTime || shift.endTime,
              isOvernight: shift.isOvernight,
              gracePeriodMinutes: shift.gracePeriodMinutes,
              breakDurationMinutes: record.breakDurationMinutes,
              isBreakPaid: shift.isBreakPaid,
            }
          : null;

        const evalResult = evaluateAttendance({
          workDate: record.date,
          shift: shiftInfo,
          actualClockIn: updateData.actualClockIn !== undefined ? updateData.actualClockIn : record.actualClockIn,
          actualClockOut: updateData.actualClockOut !== undefined ? updateData.actualClockOut : record.actualClockOut,
          customBreakMinutes: record.breakDurationMinutes,
        });

        updateData.workedMinutes = evalResult.workedMinutes;
        updateData.lateMinutes = evalResult.lateMinutes;
        updateData.earlyDepartureMinutes = evalResult.earlyDepartureMinutes;
        updateData.overtimeMinutes = evalResult.overtimeMinutes;
        updateData.attendanceStatus = evalResult.attendanceStatus;
      }

      // 3. Update Attendance Record
      const updatedRecord = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: updateData,
      });

      // 4. Record Employee History
      await tx.employeeHistory.create({
        data: {
          employeeId: record.employeeId,
          changeType: 'ATTENDANCE_ADJUSTMENT',
          description: `Attendance on ${record.date.toISOString().split('T')[0]} corrected (${fieldChanged}: ${originalValue} -> ${newValue}). Reason: ${reason}`,
          previousValue: JSON.stringify({ field: fieldChanged, value: originalValue }),
          newValue: JSON.stringify({ field: fieldChanged, value: newValue }),
          performedById: session.user.id,
        },
      });

      return { adjustment, updatedRecord };
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'CORRECT_ATTENDANCE',
      module: 'ATTENDANCE',
      entityType: 'AttendanceAdjustment',
      entityId: result.adjustment.id,
      previousValue: JSON.stringify({ field: fieldChanged, value: originalValue }),
      newValue: JSON.stringify({ field: fieldChanged, value: newValue, reason }),
    });

    return successResponse(result, 'Attendance correction applied successfully', 201);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to submit attendance correction', error.status || 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(['attendance.correct', 'attendance.approve']);
    const body = await req.json();
    const { adjustmentId, action, comments } = body;

    if (!adjustmentId || !action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return errorResponse('Valid adjustmentId and action (APPROVE or REJECT) are required', 400);
    }

    const { AttendanceService } = await import('@/lib/attendance/AttendanceService');
    const result = await AttendanceService.reviewCorrection({
      adjustmentId,
      action,
      reviewerUserId: session.user.id,
      comments,
    });

    return successResponse(result, `Attendance correction ${action === 'APPROVE' ? 'approved and applied' : 'rejected'}`);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to review attendance correction', error.status || 500);
  }
}

