import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['leave.view']);
    const { searchParams } = new URL(req.url);

    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined;
    const departmentId = searchParams.get('departmentId');
    const branchId = searchParams.get('branchId');
    const stationId = searchParams.get('stationId');

    let startDate: Date;
    let endDate: Date;

    if (month && month >= 1 && month <= 12) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    const where: any = {
      status: { in: ['APPROVED', 'SUBMITTED', 'UNDER_REVIEW'] },
      OR: [
        { startDate: { gte: startDate, lte: endDate } },
        { endDate: { gte: startDate, lte: endDate } },
        { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: endDate } }] },
      ],
    };

    if (departmentId) where.employee = { ...where.employee, departmentId };
    if (branchId) where.employee = { ...where.employee, branchId };
    if (stationId) where.employee = { ...where.employee, stationId };

    const [requests, holidays, totalActiveStaff] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        orderBy: { startDate: 'asc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              fullName: true,
              department: { select: { name: true, code: true } },
              branch: { select: { name: true, code: true } },
              station: { select: { name: true, code: true } },
              position: { select: { title: true, code: true } },
            },
          },
          leaveType: {
            select: { id: true, name: true, code: true, color: true, isPaid: true },
          },
        },
      }),
      db.publicHoliday.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          isActive: true,
        },
        orderBy: { date: 'asc' },
      }),
      db.employee.count({
        where: { deletedAt: null, isArchived: false, employmentStatus: 'ACTIVE' },
      }),
    ]);

    // Format calendar events
    const events = requests.map((req) => ({
      id: req.id,
      requestNumber: req.requestNumber,
      employeeId: req.employee.id,
      employeeName: req.employee.fullName,
      employeeNumber: req.employee.employeeNumber,
      department: req.employee.department?.name || 'Unassigned',
      branch: req.employee.branch?.name || 'Unassigned',
      station: req.employee.station?.name || 'Unassigned',
      position: req.employee.position?.title || 'Security Personnel',
      leaveTypeName: req.leaveType.name,
      leaveTypeCode: req.leaveType.code,
      color: req.leaveType.color || '#2563eb',
      startDate: req.startDate.toISOString().split('T')[0],
      endDate: req.endDate.toISOString().split('T')[0],
      durationDays: req.durationDays,
      isHalfDay: req.isHalfDay,
      halfDaySession: req.halfDaySession,
      status: req.status,
      reason: req.reason,
    }));

    return successResponse({
      period: {
        year,
        month: month || 'Full Year',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      totalActiveStaff,
      totalLeaveEvents: events.length,
      events,
      holidays: holidays.map((h) => ({
        id: h.id,
        name: h.name,
        date: h.date.toISOString().split('T')[0],
        description: h.description,
      })),
    });
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Fetch leave calendar error:', error);
    return errorResponse('Failed to fetch leave calendar.');
  }
}
