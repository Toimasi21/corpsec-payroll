import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { apiBadRequest, apiError, apiSuccess } from '@/lib/response';
import { AttendanceImportService } from '@/lib/attendance/AttendanceImportService';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('attendance.import');
    if ('errorResponse' in auth) return auth.errorResponse;

    const body = await req.json();
    const { rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return apiBadRequest('rows array is required and must not be empty');
    }

    const result = await AttendanceImportService.executeImport(rows, auth.session.userId);
    return apiSuccess(result);
  } catch (error: any) {
    console.error('Error in attendance import execute:', error);
    return apiError(error.message || 'Failed to execute attendance import');
  }
}
