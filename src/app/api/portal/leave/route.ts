import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveSessionEmployee } from '@/lib/portal/PortalAuth';
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/response';
import { calculateLeaveDuration, detectLeaveConflict, validateLeaveBalance } from '@/lib/leave-calculator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authContext = await resolveSessionEmployee();
    if ('errorResponse' in authContext) {
      return authContext.errorResponse;
    }

    const { employee } = authContext;
    const currentYear = new Date().getFullYear();

    const [entitlements, leaveRequests, leaveTypes] = await Promise.all([
      db.leaveEntitlement.findMany({
        where: {
          employeeId: employee.id,
          leaveYear: currentYear,
          status: 'ACTIVE',
        },
        include: {
          leaveType: true,
        },
      }),
      db.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
        },
        orderBy: {
          submittedAt: 'desc',
        },
        include: {
          leaveType: true,
          reviewedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      db.leaveType.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      }),
    ]);

    return apiSuccess({
      entitlements,
      requests: leaveRequests,
      leaveTypes,
    });
  } catch (error: any) {
    console.error('Error fetching employee leave data:', error);
    return apiError(error.message || 'Failed to load employee leave records');
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await resolveSessionEmployee();
    if ('errorResponse' in authContext) {
      return authContext.errorResponse;
    }

    const { employee, session } = authContext;
    const body = await request.json();

    const {
      leaveTypeId,
      startDate: startStr,
      endDate: endStr,
      isHalfDay = false,
      halfDaySession = 'FULL_DAY',
      reason,
      contactPhone,
      contactAddress,
      relieverEmployeeId,
    } = body;

    if (!leaveTypeId || !startStr || !endStr) {
      return apiBadRequest('Please provide leave type, start date, and end date.');
    }

    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return apiBadRequest('Invalid start or end date format.');
    }

    if (end < start) {
      return apiBadRequest('End date cannot be earlier than start date.');
    }

    // 1. Fetch leave type & active policy
    const leaveType = await db.leaveType.findUnique({
      where: { id: leaveTypeId, deletedAt: null, status: 'ACTIVE' },
      include: {
        policies: { where: { status: 'ACTIVE', deletedAt: null }, take: 1 },
      },
    });

    if (!leaveType) {
      return apiNotFound('Leave type not found or inactive.');
    }

    // Gender suitability check
    if (leaveType.genderApplicability === 'MALE' && employee.gender !== 'MALE') {
      return apiBadRequest(`Leave type '${leaveType.name}' is only applicable to male employees.`);
    }
    if (leaveType.genderApplicability === 'FEMALE' && employee.gender !== 'FEMALE') {
      return apiBadRequest(`Leave type '${leaveType.name}' is only applicable to female employees.`);
    }

    // 2. Fetch gazetted holidays
    const holidays = await db.publicHoliday.findMany({
      where: {
        date: {
          gte: new Date(start.getFullYear(), 0, 1),
          lte: new Date(end.getFullYear(), 11, 31),
        },
        isActive: true,
      },
      select: { date: true },
    });

    const activePolicy = leaveType.policies[0];
    const excludeWeekends = activePolicy ? activePolicy.excludeWeekends : true;
    const excludeHolidays = activePolicy ? activePolicy.excludeHolidays : true;

    // 3. Calculate leave duration
    const duration = calculateLeaveDuration(start, end, {
      isHalfDay,
      excludeWeekends,
      excludeHolidays,
      holidays: holidays.map((h) => h.date),
    });

    if (duration.durationDays <= 0) {
      return apiBadRequest('Calculated leave duration is 0 working days (dates fall entirely on non-working days or holidays).');
    }

    // 4. Overlap / Conflict check
    const existingRequests = await db.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
      },
      select: {
        id: true,
        requestNumber: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    const conflict = detectLeaveConflict(existingRequests, start, end);
    if (conflict.hasConflict && conflict.conflictingRequest) {
      return apiBadRequest(
        `Date conflict detected: ${conflict.conflictingRequest.requestNumber || 'An existing application'} is already ${conflict.conflictingRequest.status}.`
      );
    }

    // 5. Balance check
    const leaveYear = start.getFullYear();
    const entitlement = await db.leaveEntitlement.findFirst({
      where: {
        employeeId: employee.id,
        leaveTypeId,
        leaveYear,
        status: 'ACTIVE',
      },
    });

    const availableBalance = entitlement ? entitlement.availableBalance : 0;
    const balanceCheck = validateLeaveBalance(availableBalance, duration.durationDays);

    if (!balanceCheck.isValid) {
      return apiBadRequest(
        balanceCheck.message ||
        `Insufficient leave balance. You requested ${duration.durationDays} days, but only ${availableBalance} days are available.`
      );
    }

    // 6. Generate Request Number
    const count = await db.leaveRequest.count({
      where: {
        leaveYear,
      },
    });
    const requestNumber = `LR-${leaveYear}-${String(count + 1).padStart(5, '0')}`;

    // 7. Create Leave Request
    const leaveRequest = await db.leaveRequest.create({
      data: {
        requestNumber,
        employeeId: employee.id,
        leaveTypeId,
        leaveYear,
        startDate: start,
        endDate: end,
        durationDays: duration.durationDays,
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : null,
        reason: reason?.trim() || 'Leave Application',
        contactPhone: contactPhone || employee.primaryPhone,
        contactAddress: contactAddress || employee.physicalAddress,
        relieverEmployeeId: relieverEmployeeId || null,
        status: 'SUBMITTED',
      },
      include: {
        leaveType: true,
      },
    });

    // Notify HR Admins / Managers
    const hrUsers = await db.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              name: { in: ['super_admin', 'hr_admin', 'hr_manager'] },
            },
          },
        },
      },
      select: { id: true },
    });

    if (hrUsers.length > 0) {
      await db.systemNotification.createMany({
        data: hrUsers.map((u) => ({
          userId: u.id,
          title: `New Leave Application: ${requestNumber}`,
          message: `${employee.fullName} applied for ${duration.durationDays} days of ${leaveType.name} (${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}).`,
          type: 'info',
          link: '/leave/approvals',
        })),
      });
    }

    return apiSuccess(
      leaveRequest,
      `Leave application ${requestNumber} submitted successfully for ${duration.durationDays} days.`
    );
  } catch (error: any) {
    console.error('Error submitting leave application:', error);
    return apiError(error.message || 'Failed to submit leave application');
  }
}
