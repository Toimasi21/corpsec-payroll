import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { shiftSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(['attendance.view', 'shift.view']);
    const { searchParams } = new URL(req.url);

    const shiftType = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = { deletedAt: null };
    if (shiftType) where.shiftType = shiftType;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const shifts = await db.shift.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            employeeShiftAssignments: { where: { status: 'ACTIVE' } },
            attendanceRecords: true,
          },
        },
      },
    });

    return successResponse(shifts);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch shifts', error.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['shift.create', 'attendance.create']);
    const body = await req.json();

    const parsed = shiftSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || 'Validation error', 400);
    }

    const data = parsed.data;

    // Check code uniqueness
    const existing = await db.shift.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return errorResponse(`A shift with code ${data.code} already exists`, 400);
    }

    const newShift = await db.shift.create({
      data: {
        code: data.code,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        shiftType: data.shiftType,
        isOvernight: data.isOvernight,
        gracePeriodMinutes: data.gracePeriodMinutes,
        breakDurationMinutes: data.breakDurationMinutes,
        isBreakPaid: data.isBreakPaid,
        breakStartTime: data.breakStartTime || null,
        breakEndTime: data.breakEndTime || null,
        status: data.status,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'CREATE',
      module: 'SHIFTS',
      entityType: 'Shift',
      entityId: newShift.id,
      newValue: JSON.stringify(newShift),
    });

    return successResponse(newShift, 'Shift created successfully', 201);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to create shift', error.status || 500);
  }
}
