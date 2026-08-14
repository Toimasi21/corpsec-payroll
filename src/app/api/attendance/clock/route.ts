import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { apiBadRequest, apiError, apiSuccess } from '@/lib/response';
import { AttendanceService } from '@/lib/attendance/AttendanceService';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('attendance.create');
    if ('errorResponse' in auth) return auth.errorResponse;

    const body = await req.json();
    const { employeeId, eventType, source = 'ADMIN', notes, customDate } = body;

    if (!employeeId || !eventType) {
      return apiBadRequest('employeeId and eventType (CLOCK_IN / CLOCK_OUT) are required');
    }

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const deviceInfo = req.headers.get('user-agent') || 'Browser';

    const result = await AttendanceService.processClockEvent({
      employeeId,
      eventType,
      source,
      ipAddress,
      deviceInfo,
      notes,
      createdById: auth.session.userId,
      customDate: customDate ? new Date(customDate) : undefined,
    });

    return apiSuccess(result);
  } catch (error: any) {
    console.error('Error in attendance clock route:', error);
    return apiError(error.message || 'Failed to process clock event');
  }
}
