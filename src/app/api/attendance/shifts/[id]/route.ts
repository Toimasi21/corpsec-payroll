import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { shiftSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(['attendance.view', 'shift.view']);
    const shift = await db.shift.findUnique({
      where: { id: params.id },
      include: {
        employeeShiftAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: {
                id: true,
                employeeNumber: true,
                fullName: true,
                jobTitle: true,
                department: { select: { name: true } },
                station: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!shift || shift.deletedAt) {
      return errorResponse('Shift not found', 404);
    }

    return successResponse(shift);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch shift details', error.status || 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['shift.edit', 'attendance.edit']);
    const body = await req.json();

    const existing = await db.shift.findUnique({
      where: { id: params.id },
    });
    if (!existing || existing.deletedAt) {
      return errorResponse('Shift not found', 404);
    }

    const partialSchema = shiftSchema.partial();
    const parsed = partialSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || 'Validation error', 400);
    }

    const data = parsed.data;

    if (data.code && data.code !== existing.code) {
      const codeTaken = await db.shift.findUnique({ where: { code: data.code } });
      if (codeTaken) {
        return errorResponse(`Shift code ${data.code} is already in use`, 400);
      }
    }

    const updated = await db.shift.update({
      where: { id: params.id },
      data: {
        ...(data.code && { code: data.code }),
        ...(data.name && { name: data.name }),
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.endTime && { endTime: data.endTime }),
        ...(data.shiftType && { shiftType: data.shiftType }),
        ...(typeof data.isOvernight === 'boolean' && { isOvernight: data.isOvernight }),
        ...(typeof data.gracePeriodMinutes === 'number' && { gracePeriodMinutes: data.gracePeriodMinutes }),
        ...(typeof data.breakDurationMinutes === 'number' && { breakDurationMinutes: data.breakDurationMinutes }),
        ...(typeof data.isBreakPaid === 'boolean' && { isBreakPaid: data.isBreakPaid }),
        ...(data.breakStartTime !== undefined && { breakStartTime: data.breakStartTime || null }),
        ...(data.breakEndTime !== undefined && { breakEndTime: data.breakEndTime || null }),
        ...(data.status && { status: data.status }),
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'UPDATE',
      module: 'SHIFTS',
      entityType: 'Shift',
      entityId: params.id,
      previousValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
    });

    return successResponse(updated, 'Shift updated successfully');
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to update shift', error.status || 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['shift.archive', 'attendance.delete']);

    const existing = await db.shift.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            employeeShiftAssignments: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!existing || existing.deletedAt) {
      return errorResponse('Shift not found', 404);
    }

    if (existing._count.employeeShiftAssignments > 0) {
      return errorResponse(
        `Cannot deactivate shift because ${existing._count.employeeShiftAssignments} active employees are currently assigned to it. Reassign employees first.`,
        400
      );
    }

    const updated = await db.shift.update({
      where: { id: params.id },
      data: { status: 'INACTIVE', deletedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'ARCHIVE',
      module: 'SHIFTS',
      entityType: 'Shift',
      entityId: params.id,
    });

    return successResponse(updated, 'Shift deactivated successfully');
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to deactivate shift', error.status || 500);
  }
}
