import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveSessionEmployee } from '@/lib/portal/PortalAuth';
import { apiSuccess, apiError } from '@/lib/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authContext = await resolveSessionEmployee();
    if ('errorResponse' in authContext) {
      return authContext.errorResponse;
    }

    const { employee } = authContext;
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const records = await db.attendanceRecord.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        scheduledShift: true,
      },
    });

    let daysPresent = 0;
    let daysAbsent = 0;
    let daysLate = 0;
    let totalWorkedHours = 0;
    let totalOvertimeHours = 0;

    const formattedRecords = records.map((r) => {
      const workedHours = r.workedMinutes ? Math.round((r.workedMinutes / 60) * 10) / 10 : 0;
      const overtimeHours = r.overtimeMinutes ? Math.round((r.overtimeMinutes / 60) * 10) / 10 : 0;

      if (r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'ON_DUTY' || r.attendanceStatus === 'PRESENT_WITH_OVERTIME') {
        daysPresent++;
      } else if (r.attendanceStatus === 'ABSENT') {
        daysAbsent++;
      } else if (r.attendanceStatus === 'LATE') {
        daysPresent++;
        daysLate++;
      }

      totalWorkedHours += workedHours;
      totalOvertimeHours += overtimeHours;

      return {
        id: r.id,
        date: r.date,
        status: r.attendanceStatus,
        clockInTime: r.actualClockIn,
        clockOutTime: r.actualClockOut,
        totalHours: workedHours,
        overtimeHours,
        shift: r.scheduledShift,
        approvalStatus: r.approvalStatus,
      };
    });

    return apiSuccess({
      records: formattedRecords,
      summary: {
        month,
        year,
        daysPresent,
        daysAbsent,
        daysLate,
        totalWorkedHours: Math.round(totalWorkedHours * 10) / 10,
        totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      },
    });
  } catch (error: any) {
    console.error('Error fetching employee attendance:', error);
    return apiError(error.message || 'Failed to load employee attendance records');
  }
}
