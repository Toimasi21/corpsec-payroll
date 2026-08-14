import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { leaveRequestCreateSchema } from '@/lib/validation';
import { calculateLeaveDuration, detectLeaveConflict, validateLeaveBalance } from '@/lib/leave-calculator';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(['leave.view']);
    const { searchParams } = new URL(req.url);

    const employeeId = searchParams.get('employeeId');
    const leaveTypeId = searchParams.get('leaveTypeId');
    const status = searchParams.get('status');
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const departmentId = searchParams.get('departmentId');
    const branchId = searchParams.get('branchId');
    const stationId = searchParams.get('stationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));

    const where: any = {};

    if (employeeId) where.employeeId = employeeId;
    if (leaveTypeId) where.leaveTypeId = leaveTypeId;
    if (status) where.status = status;
    if (year) where.leaveYear = year;
    if (departmentId) where.employee = { ...where.employee, departmentId };
    if (branchId) where.employee = { ...where.employee, branchId };
    if (stationId) where.employee = { ...where.employee, stationId };

    if (startDate && endDate) {
      where.OR = [
        {
          startDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
        {
          endDate: { gte: new Date(startDate), lte: new Date(endDate) },
        },
      ];
    } else if (startDate) {
      where.startDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.endDate = { lte: new Date(endDate) };
    }

    if (search) {
      where.OR = [
        { requestNumber: { contains: search } },
        { reason: { contains: search } },
        { employee: { fullName: { contains: search } } },
        { employee: { employeeNumber: { contains: search } } },
      ];
    }

    const [total, requests] = await Promise.all([
      db.leaveRequest.count({ where }),
      db.leaveRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
            select: { id: true, code: true, name: true, isPaid: true, color: true },
          },
          reliever: {
            select: { id: true, fullName: true, employeeNumber: true },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          cancelledBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: {
            select: { documents: true },
          },
        },
      }),
    ]);

    return successResponse(requests, undefined, 200, {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Fetch leave requests error:', error);
    return errorResponse('Failed to fetch leave requests.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['leave.create']);
    const body = await req.json();

    const parsed = leaveRequestCreateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const {
      employeeId,
      leaveTypeId,
      leaveYear,
      startDate: startStr,
      endDate: endStr,
      isHalfDay,
      halfDaySession,
      reason,
      contactPhone,
      contactAddress,
      emergencyContact,
      relieverEmployeeId,
    } = parsed.data;

    const start = new Date(startStr);
    const end = new Date(endStr);
    if (end < start) {
      return errorResponse('End date cannot be earlier than start date.', 400);
    }

    // 1. Fetch employee & leave type with policies
    const [employee, leaveType] = await Promise.all([
      db.employee.findUnique({
        where: { id: employeeId, deletedAt: null, isArchived: false },
        include: {
          shiftAssignments: {
            where: { status: 'ACTIVE' },
            include: { shift: true, workSchedule: true },
          },
        },
      }),
      db.leaveType.findUnique({
        where: { id: leaveTypeId, deletedAt: null, status: 'ACTIVE' },
        include: {
          policies: { where: { status: 'ACTIVE', deletedAt: null }, take: 1 },
        },
      }),
    ]);

    if (!employee) return errorResponse('Employee record not found or inactive.', 404);
    if (!leaveType) return errorResponse('Leave type not found or inactive.', 404);

    // Gender suitability check
    if (leaveType.genderApplicability === 'MALE' && employee.gender !== 'MALE') {
      return errorResponse(`Leave type '${leaveType.name}' is only applicable to male employees.`, 400);
    }
    if (leaveType.genderApplicability === 'FEMALE' && employee.gender !== 'FEMALE') {
      return errorResponse(`Leave type '${leaveType.name}' is only applicable to female employees.`, 400);
    }

    // 2. Fetch gazetted holidays
    const holidays = await db.publicHoliday.findMany({
      where: {
        date: { gte: new Date(start.getFullYear(), 0, 1), lte: new Date(end.getFullYear(), 11, 31) },
        isActive: true,
      },
      select: { date: true },
    });

    const policy = leaveType.policies[0];
    const excludeWeekends = policy ? policy.excludeWeekends : true;
    const excludeHolidays = policy ? policy.excludeHolidays : true;

    // 3. Calculate duration
    const durationRes = calculateLeaveDuration(start, end, {
      excludeWeekends,
      excludeHolidays,
      holidays: holidays.map((h) => h.date),
      isHalfDay,
    });

    const durationDays = durationRes.durationDays;
    if (durationDays <= 0) {
      return errorResponse('Calculated leave duration is 0 days (all requested dates are off-days or public holidays).', 400);
    }

    // 4. Check for overlapping leave requests
    const existingRequests = await db.leaveRequest.findMany({
      where: {
        employeeId,
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
    if (conflict.hasConflict) {
      return errorResponse(
        `Leave conflict detected! Existing request ${conflict.conflictingRequest?.requestNumber || ''} (${
          conflict.conflictingRequest?.status
        }) covers overlapping dates.`,
        409
      );
    }

    // 5. Balance Validation against LeaveEntitlement
    let entitlement = await db.leaveEntitlement.findUnique({
      where: {
        employeeId_leaveTypeId_leaveYear: {
          employeeId,
          leaveTypeId,
          leaveYear,
        },
      },
    });

    if (!entitlement) {
      // Auto initialize entitlement if missing
      entitlement = await db.leaveEntitlement.create({
        data: {
          employeeId,
          leaveTypeId,
          policyId: policy?.id || null,
          leaveYear,
          openingBalance: 0,
          entitledDays: policy?.entitledDays ?? leaveType.defaultDays,
          availableBalance: policy?.entitledDays ?? leaveType.defaultDays,
        },
      });
    }

    const allowAdvance = policy?.allowAdvanceLeave ?? false;
    const maxAdvance = policy?.maxAdvanceDays ?? 0;

    const balanceCheck = validateLeaveBalance(entitlement.availableBalance, durationDays, allowAdvance, maxAdvance);
    if (!balanceCheck.isValid) {
      return errorResponse(balanceCheck.message || 'Insufficient leave balance.', 400);
    }

    // 6. Generate Request Number
    const count = await db.leaveRequest.count({ where: { leaveYear } });
    const requestNumber = `LR-${leaveYear}-${String(count + 1).padStart(4, '0')}`;

    // 7. Atomic transaction: create request + update pendingDays and available balance
    const [createdRequest] = await db.$transaction([
      db.leaveRequest.create({
        data: {
          requestNumber,
          employeeId,
          leaveTypeId,
          leaveYear,
          startDate: start,
          endDate: end,
          durationDays,
          isHalfDay,
          halfDaySession: isHalfDay ? halfDaySession : null,
          reason,
          contactPhone,
          contactAddress,
          emergencyContact,
          relieverEmployeeId: relieverEmployeeId || null,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, fullName: true, employeeNumber: true } },
          leaveType: true,
          reliever: { select: { id: true, fullName: true, employeeNumber: true } },
        },
      }),
      db.leaveEntitlement.update({
        where: { id: entitlement.id },
        data: {
          pendingDays: entitlement.pendingDays + durationDays,
          availableBalance: entitlement.availableBalance - durationDays,
        },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'SUBMIT_LEAVE_REQUEST',
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: createdRequest.id,
      newValue: {
        requestNumber,
        employeeName: employee.fullName,
        durationDays,
        startDate: startStr,
        endDate: endStr,
      },
    });

    return successResponse(
      createdRequest,
      `Leave request ${requestNumber} for ${durationDays} day(s) submitted successfully.`,
      201
    );
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Submit leave request error:', error);
    return errorResponse('Failed to submit leave request.');
  }
}
