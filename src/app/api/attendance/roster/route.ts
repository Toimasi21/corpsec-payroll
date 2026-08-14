import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['attendance.view', 'schedule.view']);
    const { searchParams } = new URL(req.url);

    const branchId = searchParams.get('branchId');
    const stationId = searchParams.get('stationId');
    const departmentId = searchParams.get('departmentId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to current week (7 days)
    const startDate = startDateParam ? new Date(startDateParam) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = endDateParam ? new Date(endDateParam) : new Date(startDate);
    if (!endDateParam) {
      endDate.setDate(startDate.getDate() + 6);
    }
    endDate.setHours(23, 59, 59, 999);

    const empWhere: any = { deletedAt: null, isArchived: false };
    if (branchId) empWhere.branchId = branchId;
    if (stationId) empWhere.stationId = stationId;
    if (departmentId) empWhere.departmentId = departmentId;

    const [employees, attendanceRecords, shiftAssignments] = await Promise.all([
      db.employee.findMany({
        where: empWhere,
        select: {
          id: true,
          employeeNumber: true,
          fullName: true,
          jobTitle: true,
          station: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ branch: { name: 'asc' } }, { fullName: 'asc' }],
      }),
      db.attendanceRecord.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          employee: empWhere,
        },
        include: {
          scheduledShift: true,
        },
      }),
      db.employeeShiftAssignment.findMany({
        where: {
          status: 'ACTIVE',
          employee: empWhere,
        },
        include: {
          shift: true,
          workSchedule: true,
        },
      }),
    ]);

    // Build day headers list
    const days: string[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      days.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    const recordsMap = new Map<string, any>();
    for (const r of attendanceRecords) {
      const key = `${r.employeeId}_${r.date.toISOString().split('T')[0]}`;
      recordsMap.set(key, r);
    }

    const assignmentMap = new Map<string, any>();
    for (const a of shiftAssignments) {
      assignmentMap.set(a.employeeId, a);
    }

    // Combine into roster grid
    const roster = employees.map((emp) => {
      const assignment = assignmentMap.get(emp.id);
      const defaultShift = assignment?.shift || null;

      const scheduleDays = days.map((dateStr) => {
        const key = `${emp.id}_${dateStr}`;
        const record = recordsMap.get(key);

        return {
          date: dateStr,
          hasRecord: !!record,
          shift: record?.scheduledShift || defaultShift,
          status: record?.attendanceStatus || (defaultShift ? 'SCHEDULED' : 'OFF'),
          approvalStatus: record?.approvalStatus || 'DRAFT',
          clockIn: record?.actualClockIn || null,
          clockOut: record?.actualClockOut || null,
          workedHours: record ? Math.round((record.workedMinutes / 60) * 10) / 10 : 0,
          lateMinutes: record?.lateMinutes || 0,
          overtimeMinutes: record?.overtimeMinutes || 0,
        };
      });

      return {
        employee: emp,
        assignment,
        defaultShift,
        days: scheduleDays,
      };
    });

    return successResponse({
      startDate: days[0],
      endDate: days[days.length - 1],
      days,
      roster,
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to generate attendance roster', error.status || 500);
  }
}
