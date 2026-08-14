import { db } from '@/lib/db';
import { evaluateAttendance, ShiftInfo, validateShiftAssignment } from '@/lib/attendance-calculator';
import { createAuditLog } from '@/lib/audit';

export interface ClockInput {
  employeeId: string;
  eventType: 'CLOCK_IN' | 'CLOCK_OUT';
  source?: string; // WEB, MOBILE, ADMIN, IMPORT, API
  ipAddress?: string | null;
  deviceInfo?: string | null;
  notes?: string | null;
  createdById?: string | null;
  customDate?: Date; // For manual admin entries only
}

export interface OvertimeReviewInput {
  overtimeId: string;
  action: 'APPROVE' | 'REJECT';
  reviewerUserId: string;
  comments?: string;
  approvedHours?: number;
}

export interface CorrectionReviewInput {
  adjustmentId: string;
  action: 'APPROVE' | 'REJECT';
  reviewerUserId: string;
  comments?: string;
}

export class AttendanceService {
  /**
   * Authoritative Clock Event Processor.
   * Strictly uses server time (or admin custom date for manual corrections) to prevent client clock tampering.
   */
  public static async processClockEvent(input: ClockInput) {
    const { employeeId, eventType, source = 'WEB', ipAddress, deviceInfo, notes, createdById, customDate } = input;

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        station: true,
        shiftAssignments: {
          where: { status: 'ACTIVE' },
          include: { shift: true, workSchedule: true },
          take: 1,
        },
      },
    });

    if (!employee || employee.deletedAt || employee.isArchived) {
      throw new Error('Active employee record not found.');
    }

    // Authoritative Server Time
    const serverTimestamp = customDate ? new Date(customDate) : new Date();
    const workDate = new Date(serverTimestamp);
    workDate.setHours(0, 0, 0, 0);

    const activeShift = employee.shiftAssignments[0]?.shift || null;

    // Check existing attendance record for today
    let attendanceRecord = await db.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: workDate,
        },
      },
      include: {
        scheduledShift: true,
      },
    });

    if (attendanceRecord && attendanceRecord.approvalStatus === 'LOCKED') {
      throw new Error('Attendance for this date is sealed/locked for finalized payroll and cannot be modified.');
    }

    let actualClockIn = attendanceRecord?.actualClockIn || null;
    let actualClockOut = attendanceRecord?.actualClockOut || null;

    // State machine & Anti-tampering validations
    if (eventType === 'CLOCK_IN') {
      if (actualClockIn && !actualClockOut) {
        const inTimeStr = actualClockIn.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        throw new Error(`Double Clock-In blocked: Employee is already clocked in today at ${inTimeStr}.`);
      }
      actualClockIn = serverTimestamp;
    } else if (eventType === 'CLOCK_OUT') {
      if (!actualClockIn) {
        throw new Error('Invalid Sequence: Cannot clock out before clocking in.');
      }
      if (actualClockOut) {
        const outTimeStr = actualClockOut.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        throw new Error(`Double Clock-Out blocked: Employee has already clocked out today at ${outTimeStr}.`);
      }
      if (serverTimestamp.getTime() < actualClockIn.getTime()) {
        throw new Error('Clock-out timestamp cannot precede clock-in timestamp.');
      }
      actualClockOut = serverTimestamp;
    }

    // Evaluate attendance metrics
    const shiftInfo: ShiftInfo | null = activeShift
      ? {
          startTime: activeShift.startTime,
          endTime: activeShift.endTime,
          isOvernight: activeShift.isOvernight,
          gracePeriodMinutes: activeShift.gracePeriodMinutes,
          breakDurationMinutes: activeShift.breakDurationMinutes,
          isBreakPaid: activeShift.isBreakPaid,
        }
      : null;

    const evaluation = evaluateAttendance({
      workDate,
      shift: shiftInfo,
      actualClockIn,
      actualClockOut,
      existingStatus: attendanceRecord?.attendanceStatus,
    });

    // Upsert the authoritative attendance record
    const updatedRecord = await db.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: workDate,
        },
      },
      update: {
        scheduledShiftId: activeShift?.id || attendanceRecord?.scheduledShiftId,
        scheduledStartTime: activeShift?.startTime || attendanceRecord?.scheduledStartTime,
        scheduledEndTime: activeShift?.endTime || attendanceRecord?.scheduledEndTime,
        actualClockIn,
        actualClockOut,
        workedMinutes: evaluation.workedMinutes,
        lateMinutes: evaluation.lateMinutes,
        earlyDepartureMinutes: evaluation.earlyDepartureMinutes,
        overtimeMinutes: evaluation.overtimeMinutes,
        attendanceStatus: evaluation.attendanceStatus,
        source,
        notes: notes || attendanceRecord?.notes,
      },
      create: {
        employeeId: employee.id,
        date: workDate,
        scheduledShiftId: activeShift?.id,
        scheduledStartTime: activeShift?.startTime,
        scheduledEndTime: activeShift?.endTime,
        actualClockIn,
        actualClockOut,
        workedMinutes: evaluation.workedMinutes,
        lateMinutes: evaluation.lateMinutes,
        earlyDepartureMinutes: evaluation.earlyDepartureMinutes,
        overtimeMinutes: evaluation.overtimeMinutes,
        attendanceStatus: evaluation.attendanceStatus,
        source,
        notes,
      },
      include: {
        employee: true,
        scheduledShift: true,
      },
    });

    // Record immutable clock event in audit stream
    const event = await db.attendanceEvent.create({
      data: {
        attendanceRecordId: updatedRecord.id,
        employeeId: employee.id,
        eventType,
        timestamp: serverTimestamp,
        source,
        ipAddress: ipAddress || null,
        deviceInfo: deviceInfo || null,
        notes: notes || null,
        createdById: createdById || null,
      },
    });

    // If overtime is detected, create/update OvertimeRecord in 'DETECTED' or 'PENDING' status
    if (evaluation.overtimeMinutes > 0) {
      await db.overtimeRecord.upsert({
        where: { id: `ot_${updatedRecord.id}` },
        update: {
          overtimeMinutes: evaluation.overtimeMinutes,
          overtimeHours: evaluation.overtimeHours,
          actualHours: evaluation.workedHours,
          scheduledHours: Math.round((evaluation.scheduledMinutes / 60) * 100) / 100,
        },
        create: {
          id: `ot_${updatedRecord.id}`,
          employeeId: employee.id,
          attendanceRecordId: updatedRecord.id,
          date: workDate,
          scheduledHours: Math.round((evaluation.scheduledMinutes / 60) * 100) / 100,
          actualHours: evaluation.workedHours,
          overtimeMinutes: evaluation.overtimeMinutes,
          overtimeHours: evaluation.overtimeHours,
          reason: 'Automated Shift Extension Detection',
          approvalStatus: 'PENDING',
        },
      });
    }

    return {
      attendanceRecord: updatedRecord,
      event,
      evaluation,
    };
  }

  /**
   * Retrieves daily attendance board records with comprehensive filters.
   */
  public static async getDailyAttendance(params: {
    date?: string | Date;
    departmentId?: string;
    stationId?: string;
    shiftId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { departmentId, stationId, shiftId, status, search, page = 1, pageSize = 50 } = params;

    const targetDate = params.date ? new Date(params.date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const endOfDate = new Date(targetDate);
    endOfDate.setHours(23, 59, 59, 999);

    const whereClause: any = {
      date: { gte: targetDate, lte: endOfDate },
      employee: {
        deletedAt: null,
        isArchived: false,
        ...(departmentId && departmentId !== 'ALL' ? { departmentId } : {}),
        ...(stationId && stationId !== 'ALL' ? { stationId } : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search } },
                { employeeNumber: { contains: search } },
                { nationalId: { contains: search } },
              ],
            }
          : {}),
      },
      ...(shiftId && shiftId !== 'ALL' ? { scheduledShiftId: shiftId } : {}),
      ...(status && status !== 'ALL' ? { attendanceStatus: status } : {}),
    };

    const [total, records] = await Promise.all([
      db.attendanceRecord.count({ where: whereClause }),
      db.attendanceRecord.findMany({
        where: whereClause,
        include: {
          employee: {
            include: {
              department: true,
              station: true,
            },
          },
          scheduledShift: true,
          overtimeRecords: true,
        },
        orderBy: { employee: { employeeNumber: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      date: targetDate.toISOString().split('T')[0],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      records: records.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeNumber: r.employee.employeeNumber,
        employeeName: r.employee.fullName,
        department: r.employee.department?.name || 'Unassigned',
        station: r.employee.station?.name || 'Unassigned',
        shiftName: r.scheduledShift?.name || 'Standard Shift',
        scheduledStart: r.scheduledStartTime || r.scheduledShift?.startTime || '08:00',
        scheduledEnd: r.scheduledEndTime || r.scheduledShift?.endTime || '17:00',
        clockIn: r.actualClockIn ? r.actualClockIn.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null,
        clockOut: r.actualClockOut ? r.actualClockOut.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null,
        workedHours: Math.round((r.workedMinutes / 60) * 100) / 100,
        attendanceStatus: r.attendanceStatus,
        lateMinutes: r.lateMinutes,
        earlyDepartureMinutes: r.earlyDepartureMinutes,
        overtimeMinutes: r.overtimeMinutes,
        overtimeHours: Math.round((r.overtimeMinutes / 60) * 100) / 100,
        source: r.source,
        approvalStatus: r.approvalStatus,
        notes: r.notes,
      })),
    };
  }

  /**
   * Retrieves Command Center Attendance Metrics & Analytics.
   */
  public static async getAttendanceStats(branchId?: string, stationId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const empFilter: any = { deletedAt: null, isArchived: false, employmentStatus: 'ACTIVE' };
    if (branchId && branchId !== 'ALL') empFilter.branchId = branchId;
    if (stationId && stationId !== 'ALL') empFilter.stationId = stationId;

    const [totalEmployeesExpected, todayRecords, monthlyRecords, pendingOvertimeCount] = await Promise.all([
      db.employee.count({ where: empFilter }),
      db.attendanceRecord.findMany({
        where: {
          date: { gte: today, lte: endOfToday },
          ...(branchId || stationId ? { employee: { ...empFilter } } : {}),
        },
        select: {
          attendanceStatus: true,
          lateMinutes: true,
          overtimeMinutes: true,
          workedMinutes: true,
        },
      }),
      db.attendanceRecord.findMany({
        where: {
          date: { gte: firstOfMonth, lte: lastOfMonth },
          ...(branchId || stationId ? { employee: { ...empFilter } } : {}),
        },
        select: {
          attendanceStatus: true,
          lateMinutes: true,
          overtimeMinutes: true,
          workedMinutes: true,
        },
      }),
      db.overtimeRecord.count({
        where: {
          approvalStatus: 'PENDING',
          ...(branchId || stationId ? { employee: { ...empFilter } } : {}),
        },
      }),
    ]);

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let onLeaveCount = 0;
    let offDutyCount = 0;
    let missingClockOutCount = 0;
    let overtimeEmployeesCount = 0;
    let totalOvertimeMinutes = 0;

    for (const r of todayRecords) {
      if (r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'PRESENT_WITH_OVERTIME') {
        presentCount++;
      } else if (r.attendanceStatus === 'ABSENT') {
        absentCount++;
      } else if (r.attendanceStatus === 'LATE') {
        presentCount++;
        lateCount++;
      } else if (r.attendanceStatus === 'ON_LEAVE' || r.attendanceStatus === 'SICK_LEAVE') {
        onLeaveCount++;
      } else if (r.attendanceStatus === 'OFF_DAY' || r.attendanceStatus === 'REST_DAY') {
        offDutyCount++;
      } else if (r.attendanceStatus === 'MISSING_CLOCK_OUT') {
        presentCount++;
        missingClockOutCount++;
      }

      if (r.overtimeMinutes > 0) {
        overtimeEmployeesCount++;
        totalOvertimeMinutes += r.overtimeMinutes;
      }
    }

    const unrecordedCount = Math.max(0, totalEmployeesExpected - todayRecords.length);
    if (unrecordedCount > 0 && todayRecords.length === 0) {
      // If day just started and no clocks logged yet
      absentCount = 0;
    }

    const totalActiveLogged = presentCount + absentCount + lateCount;
    const attendanceRate = totalEmployeesExpected > 0 ? Math.round((presentCount / totalEmployeesExpected) * 100) : 0;
    const lateRate = presentCount > 0 ? Math.round((lateCount / presentCount) * 100) : 0;
    const absenceRate = totalEmployeesExpected > 0 ? Math.round((absentCount / totalEmployeesExpected) * 100) : 0;

    return {
      kpis: {
        expectedToday: totalEmployeesExpected,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        onLeave: onLeaveCount,
        offDuty: offDutyCount,
        missingClockOut: missingClockOutCount,
        overtimeEmployees: overtimeEmployeesCount,
        pendingOvertimeApprovals: pendingOvertimeCount,
      },
      rates: {
        attendanceRate,
        lateRate,
        absenceRate,
        totalOvertimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
      },
    };
  }

  /**
   * Scans and marks unscheduled/unclocked employees as ABSENT at cutoff time.
   */
  public static async detectAndRecordAbsences(dateInput?: Date) {
    const targetDate = dateInput ? new Date(dateInput) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const activeEmployees = await db.employee.findMany({
      where: {
        employmentStatus: 'ACTIVE',
        deletedAt: null,
        isArchived: false,
      },
      include: {
        leaveRequests: {
          where: {
            status: 'APPROVED',
            startDate: { lte: targetDate },
            endDate: { gte: targetDate },
          },
        },
        shiftAssignments: {
          where: { status: 'ACTIVE' },
          include: { shift: true },
        },
      },
    });

    const isHoliday = await db.publicHoliday.findFirst({
      where: { date: targetDate, isActive: true },
    });

    let absencesMarked = 0;

    for (const emp of activeEmployees) {
      // Skip if on approved leave
      if (emp.leaveRequests.length > 0) continue;

      // Skip if gazetted public holiday
      if (isHoliday) continue;

      const existingRecord = await db.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: emp.id,
            date: targetDate,
          },
        },
      });

      // If no attendance record exists at all for the work day
      if (!existingRecord) {
        await db.attendanceRecord.create({
          data: {
            employeeId: emp.id,
            date: targetDate,
            scheduledShiftId: emp.shiftAssignments[0]?.shiftId || null,
            attendanceStatus: 'ABSENT',
            workedMinutes: 0,
            lateMinutes: 0,
            earlyDepartureMinutes: 0,
            overtimeMinutes: 0,
            source: 'SYSTEM_CRON',
            notes: 'Automated absence detection at end of shift',
          },
        });
        absencesMarked++;
      }
    }

    return { targetDate: targetDate.toISOString().split('T')[0], absencesMarked };
  }

  /**
   * Reviews and authorizes an Overtime Record for payroll linkage.
   */
  public static async reviewOvertime(input: OvertimeReviewInput) {
    const { overtimeId, action, reviewerUserId, comments, approvedHours } = input;

    const record = await db.overtimeRecord.findUnique({
      where: { id: overtimeId },
      include: { employee: true, attendanceRecord: true },
    });

    if (!record) throw new Error('Overtime record not found.');

    const updated = await db.overtimeRecord.update({
      where: { id: overtimeId },
      data: {
        approvalStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvedById: reviewerUserId,
        approvedAt: new Date(),
        comments: comments || (action === 'APPROVE' ? 'Approved for monthly payroll disbursement' : 'Rejected by supervisor'),
        overtimeHours: approvedHours !== undefined ? approvedHours : record.overtimeHours,
      },
    });

    await createAuditLog({
      userId: reviewerUserId,
      action: `OVERTIME_${action}`,
      module: 'OVERTIME',
      entityType: 'OvertimeRecord',
      entityId: overtimeId,
      newValue: { status: updated.approvalStatus, hours: updated.overtimeHours, comments },
    });

    return updated;
  }

  /**
   * Reviews and applies an Attendance Adjustment / Correction.
   */
  public static async reviewCorrection(input: CorrectionReviewInput) {
    const { adjustmentId, action, reviewerUserId, comments } = input;

    const adjustment = await db.attendanceAdjustment.findUnique({
      where: { id: adjustmentId },
      include: { attendanceRecord: true, employee: true },
    });

    if (!adjustment) throw new Error('Attendance adjustment request not found.');

    if (action === 'APPROVE') {
      const updateData: any = {};
      if (adjustment.fieldChanged === 'CLOCK_IN' && adjustment.newValue) {
        updateData.actualClockIn = new Date(adjustment.newValue);
      } else if (adjustment.fieldChanged === 'CLOCK_OUT' && adjustment.newValue) {
        updateData.actualClockOut = new Date(adjustment.newValue);
      } else if (adjustment.fieldChanged === 'STATUS' && adjustment.newValue) {
        updateData.attendanceStatus = adjustment.newValue;
      }

      // Re-evaluate if clock was adjusted
      if (updateData.actualClockIn || updateData.actualClockOut) {
        const effectiveClockIn = updateData.actualClockIn || adjustment.attendanceRecord.actualClockIn;
        const effectiveClockOut = updateData.actualClockOut || adjustment.attendanceRecord.actualClockOut;
        
        const evaluation = evaluateAttendance({
          workDate: adjustment.attendanceRecord.date,
          actualClockIn: effectiveClockIn,
          actualClockOut: effectiveClockOut,
        });

        updateData.workedMinutes = evaluation.workedMinutes;
        updateData.lateMinutes = evaluation.lateMinutes;
        updateData.earlyDepartureMinutes = evaluation.earlyDepartureMinutes;
        updateData.overtimeMinutes = evaluation.overtimeMinutes;
        updateData.attendanceStatus = evaluation.attendanceStatus;
      }

      await db.attendanceRecord.update({
        where: { id: adjustment.attendanceRecordId },
        data: updateData,
      });

      await db.attendanceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'APPLIED',
          approvedById: reviewerUserId,
        },
      });
    } else {
      await db.attendanceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'REJECTED',
          approvedById: reviewerUserId,
        },
      });
    }

    await createAuditLog({
      userId: reviewerUserId,
      action: `ATTENDANCE_CORRECTION_${action}`,
      module: 'ATTENDANCE',
      entityType: 'AttendanceAdjustment',
      entityId: adjustmentId,
      newValue: { status: action === 'APPROVE' ? 'APPLIED' : 'REJECTED', comments },
    });

    return { success: true };
  }

  /**
   * Seals and locks attendance records for a finalized payroll run.
   */
  public static async lockAttendanceForPayroll(payrollRunId: string, startDate: Date, endDate: Date, lockedByUserId: string) {
    const count = await db.attendanceRecord.updateMany({
      where: {
        date: { gte: startDate, lte: endDate },
        approvalStatus: { not: 'LOCKED' },
      },
      data: {
        approvalStatus: 'LOCKED',
        lockedById: lockedByUserId,
        lockedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: lockedByUserId,
      action: 'LOCK_ATTENDANCE_FOR_PAYROLL',
      module: 'PAYROLL',
      entityType: 'PayrollRun',
      entityId: payrollRunId,
      newValue: { lockedRecordsCount: count.count, period: { start: startDate, end: endDate } },
    });

    return count;
  }
}
