import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { workScheduleSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['attendance.view', 'schedule.view']);
    const { searchParams } = new URL(req.url);

    const patternType = searchParams.get('patternType');
    const search = searchParams.get('search');

    const where: any = { deletedAt: null };
    if (patternType) where.patternType = patternType;
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const schedules = await db.workSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            employeeShiftAssignments: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    return successResponse(schedules);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch work schedules', error.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['schedule.create', 'attendance.create']);
    const body = await req.json();

    const parsed = workScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || 'Validation error', 400);
    }

    const data = parsed.data;

    const existing = await db.workSchedule.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return errorResponse(`Work schedule with code ${data.code} already exists`, 400);
    }

    const newSchedule = await db.workSchedule.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || null,
        patternType: data.patternType,
        cycleDays: data.cycleDays,
        scheduleConfig: data.scheduleConfig || null,
        isActive: data.isActive,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'CREATE',
      module: 'SCHEDULES',
      entityType: 'WorkSchedule',
      entityId: newSchedule.id,
      newValue: JSON.stringify(newSchedule),
    });

    return successResponse(newSchedule, 'Work schedule created successfully', 201);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to create schedule', error.status || 500);
  }
}
