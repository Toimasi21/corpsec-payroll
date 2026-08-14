import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/permissions';
import { apiBadRequest, apiError, apiSuccess } from '@/lib/response';
import { AttendanceImportService } from '@/lib/attendance/AttendanceImportService';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('attendance.import');
    if ('errorResponse' in auth) return auth.errorResponse;

    const body = await req.json();
    const { csvContent } = body;

    if (!csvContent || typeof csvContent !== 'string') {
      return apiBadRequest('csvContent string is required');
    }

    const preview = await AttendanceImportService.validateAndPreview(csvContent);
    return apiSuccess(preview);
  } catch (error: any) {
    console.error('Error in attendance import preview:', error);
    return apiError(error.message || 'Failed to preview CSV');
  }
}
