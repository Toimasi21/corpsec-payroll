import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/permissions';
import { apiBadRequest, apiError, apiSuccess } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('attendance.reports.view');
    if ('errorResponse' in auth) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDateStr = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const departmentId = searchParams.get('departmentId');
    const stationId = searchParams.get('stationId');
    const exportFormat = searchParams.get('export'); // 'csv' or null

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const empFilter: any = {
      deletedAt: null,
      isArchived: false,
      ...(departmentId && departmentId !== 'ALL' ? { departmentId } : {}),
      ...(stationId && stationId !== 'ALL' ? { stationId } : {}),
    };

    const employees = await db.employee.findMany({
      where: empFilter,
      include: {
        department: true,
        station: true,
        attendanceRecords: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    const summary = employees.map((emp) => {
      const records = emp.attendanceRecords;
      const scheduledDays = records.length;
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let earlyDepartures = 0;
      let leaveDays = 0;
      let totalOvertimeMinutes = 0;
      let totalWorkedMinutes = 0;

      for (const r of records) {
        if (r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'PRESENT_WITH_OVERTIME') presentDays++;
        else if (r.attendanceStatus === 'ABSENT') absentDays++;
        else if (r.attendanceStatus === 'LATE') {
          presentDays++;
          lateDays++;
        } else if (r.attendanceStatus === 'ON_LEAVE' || r.attendanceStatus === 'SICK_LEAVE') leaveDays++;

        if (r.earlyDepartureMinutes > 0) earlyDepartures++;
        totalOvertimeMinutes += r.overtimeMinutes || 0;
        totalWorkedMinutes += r.workedMinutes || 0;
      }

      const attendanceRate = scheduledDays > 0 ? Math.round((presentDays / scheduledDays) * 100) : 100;

      return {
        employeeId: emp.id,
        employeeNumber: emp.employeeNumber,
        employeeName: emp.fullName,
        department: emp.department?.name || 'Unassigned',
        station: emp.station?.name || 'Unassigned',
        daysScheduled: scheduledDays,
        daysPresent: presentDays,
        daysAbsent: absentDays,
        lateDays,
        earlyDepartures,
        leaveDays,
        overtimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
        workedHours: Math.round((totalWorkedMinutes / 60) * 10) / 10,
        attendanceRate,
      };
    });

    if (exportFormat === 'csv') {
      const csvHeader = 'EmployeeNumber,EmployeeName,Department,Station,DaysScheduled,DaysPresent,DaysAbsent,LateDays,EarlyDepartures,LeaveDays,OvertimeHours,WorkedHours,AttendanceRate\n';
      const csvRows = summary
        .map(
          (s) =>
            `"${s.employeeNumber}","${s.employeeName}","${s.department}","${s.station}",${s.daysScheduled},${s.daysPresent},${s.daysAbsent},${s.lateDays},${s.earlyDepartures},${s.leaveDays},${s.overtimeHours},${s.workedHours},${s.attendanceRate}%`
        )
        .join('\n');

      return new NextResponse(csvHeader + csvRows, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-report-${startDateStr}-to-${endDateStr}.csv"`,
        },
      });
    }

    return apiSuccess({
      period: { startDate: startDateStr, endDate: endDateStr },
      totalEmployees: summary.length,
      summary,
    });
  } catch (error: any) {
    console.error('Error in attendance reports:', error);
    return apiError(error.message || 'Failed to generate attendance report');
  }
}
