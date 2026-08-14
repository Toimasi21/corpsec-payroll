import { db } from '@/lib/db';
import { evaluateAttendance, ShiftInfo } from '@/lib/attendance-calculator';
import { createAuditLog } from '@/lib/audit';

export interface AttendanceImportRowPreview {
  rowIndex: number;
  employeeNumber: string;
  employeeName?: string;
  dateStr: string;
  clockInStr?: string;
  clockOutStr?: string;
  source?: string;
  isValid: boolean;
  errors: string[];
}

export interface AttendanceImportPreviewResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: AttendanceImportRowPreview[];
}

export class AttendanceImportService {
  /**
   * Validates CSV text line by line against employee records, dates, and clock integrity.
   */
  public static async validateAndPreview(csvContent: string): Promise<AttendanceImportPreviewResult> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new Error('The uploaded CSV file is empty.');
    }

    const header = lines[0].toLowerCase();
    const isHeaderRow = header.includes('employee') || header.includes('date') || header.includes('clock');
    const dataLines = isHeaderRow ? lines.slice(1) : lines;

    const employees = await db.employee.findMany({
      where: { deletedAt: null },
      select: { id: true, employeeNumber: true, fullName: true, employmentStatus: true },
    });

    const empMap = new Map(employees.map((e) => [e.employeeNumber.toUpperCase(), e]));

    const previewRows: AttendanceImportRowPreview[] = [];
    let validCount = 0;
    let errorCount = 0;

    for (let idx = 0; idx < dataLines.length; idx++) {
      const line = dataLines[idx];
      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));

      // Expected columns: EmployeeNumber, Date (YYYY-MM-DD), ClockIn (HH:mm or ISO), ClockOut (HH:mm or ISO), Source (optional)
      const empNo = cols[0]?.toUpperCase() || '';
      const dateStr = cols[1] || '';
      const clockInStr = cols[2] || '';
      const clockOutStr = cols[3] || '';
      const source = cols[4] || 'IMPORT';

      const rowErrors: string[] = [];

      if (!empNo) rowErrors.push('Missing Employee Number');
      if (!dateStr) rowErrors.push('Missing Attendance Date');

      const emp = empMap.get(empNo);
      if (!emp) {
        rowErrors.push(`Employee "${empNo}" does not exist in database.`);
      } else if (emp.employmentStatus !== 'ACTIVE' && emp.employmentStatus !== 'ON_PROBATION') {
        rowErrors.push(`Employee "${empNo}" is currently ${emp.employmentStatus}.`);
      }

      // Validate Date
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        rowErrors.push(`Invalid date format "${dateStr}". Use YYYY-MM-DD.`);
      }

      // Validate Clock times if provided
      if (clockInStr && clockOutStr) {
        let fullClockIn: Date | null = null;
        let fullClockOut: Date | null = null;

        if (clockInStr.includes(':') && !clockInStr.includes('T')) {
          const [h, m] = clockInStr.split(':').map((v) => parseInt(v, 10));
          fullClockIn = new Date(parsedDate);
          fullClockIn.setHours(h, m, 0, 0);
        } else {
          fullClockIn = new Date(clockInStr);
        }

        if (clockOutStr.includes(':') && !clockOutStr.includes('T')) {
          const [h, m] = clockOutStr.split(':').map((v) => parseInt(v, 10));
          fullClockOut = new Date(parsedDate);
          fullClockOut.setHours(h, m, 0, 0);
        } else {
          fullClockOut = new Date(clockOutStr);
        }

        if (fullClockIn && fullClockOut && fullClockOut.getTime() < fullClockIn.getTime()) {
          rowErrors.push('Clock-out time cannot be earlier than clock-in time on the same date.');
        }
      }

      const isValid = rowErrors.length === 0;
      if (isValid) validCount++;
      else errorCount++;

      previewRows.push({
        rowIndex: idx + 1,
        employeeNumber: empNo,
        employeeName: emp?.fullName || 'Unknown',
        dateStr,
        clockInStr,
        clockOutStr,
        source,
        isValid,
        errors: rowErrors,
      });
    }

    return {
      totalRows: dataLines.length,
      validCount,
      errorCount,
      rows: previewRows,
    };
  }

  /**
   * Executes transactional batch import of validated attendance rows.
   */
  public static async executeImport(rows: AttendanceImportRowPreview[], importedById: string) {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      throw new Error('No valid attendance rows found to import.');
    }

    const employees = await db.employee.findMany({
      where: {
        employeeNumber: { in: validRows.map((r) => r.employeeNumber) },
      },
      include: {
        shiftAssignments: {
          where: { status: 'ACTIVE' },
          include: { shift: true },
          take: 1,
        },
      },
    });

    const empMap = new Map(employees.map((e) => [e.employeeNumber.toUpperCase(), e]));

    let importedCount = 0;

    await db.$transaction(async (tx) => {
      for (const row of validRows) {
        const emp = empMap.get(row.employeeNumber.toUpperCase());
        if (!emp) continue;

        const workDate = new Date(row.dateStr);
        workDate.setHours(0, 0, 0, 0);

        let clockInDate: Date | null = null;
        let clockOutDate: Date | null = null;

        if (row.clockInStr) {
          if (row.clockInStr.includes(':') && !row.clockInStr.includes('T')) {
            const [h, m] = row.clockInStr.split(':').map((v) => parseInt(v, 10));
            clockInDate = new Date(workDate);
            clockInDate.setHours(h, m, 0, 0);
          } else {
            clockInDate = new Date(row.clockInStr);
          }
        }

        if (row.clockOutStr) {
          if (row.clockOutStr.includes(':') && !row.clockOutStr.includes('T')) {
            const [h, m] = row.clockOutStr.split(':').map((v) => parseInt(v, 10));
            clockOutDate = new Date(workDate);
            clockOutDate.setHours(h, m, 0, 0);
          } else {
            clockOutDate = new Date(row.clockOutStr);
          }
        }

        const activeShift = emp.shiftAssignments[0]?.shift || null;
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
          actualClockIn: clockInDate,
          actualClockOut: clockOutDate,
        });

        await tx.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId: emp.id,
              date: workDate,
            },
          },
          update: {
            scheduledShiftId: activeShift?.id,
            scheduledStartTime: activeShift?.startTime,
            scheduledEndTime: activeShift?.endTime,
            actualClockIn: clockInDate,
            actualClockOut: clockOutDate,
            workedMinutes: evaluation.workedMinutes,
            lateMinutes: evaluation.lateMinutes,
            earlyDepartureMinutes: evaluation.earlyDepartureMinutes,
            overtimeMinutes: evaluation.overtimeMinutes,
            attendanceStatus: evaluation.attendanceStatus,
            source: row.source || 'IMPORT',
          },
          create: {
            employeeId: emp.id,
            date: workDate,
            scheduledShiftId: activeShift?.id,
            scheduledStartTime: activeShift?.startTime,
            scheduledEndTime: activeShift?.endTime,
            actualClockIn: clockInDate,
            actualClockOut: clockOutDate,
            workedMinutes: evaluation.workedMinutes,
            lateMinutes: evaluation.lateMinutes,
            earlyDepartureMinutes: evaluation.earlyDepartureMinutes,
            overtimeMinutes: evaluation.overtimeMinutes,
            attendanceStatus: evaluation.attendanceStatus,
            source: row.source || 'IMPORT',
          },
        });

        importedCount++;
      }
    });

    await createAuditLog({
      userId: importedById,
      action: 'BULK_ATTENDANCE_IMPORT',
      module: 'ATTENDANCE',
      newValue: { importedCount },
    });

    return { importedCount };
  }
}
