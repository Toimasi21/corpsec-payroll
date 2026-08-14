import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { leaveTypeSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(['leave.view']);

    const leaveType = await db.leaveType.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        policies: { where: { deletedAt: null } },
        _count: {
          select: { requests: true, entitlements: true },
        },
      },
    });

    if (!leaveType) {
      return errorResponse('Leave type not found.', 404);
    }

    return successResponse(leaveType);
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Fetch leave type details error:', error);
    return errorResponse('Failed to fetch leave type details.');
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['leave.manage_types']);
    const body = await req.json();

    const parsed = leaveTypeSchema.partial().safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const existing = await db.leaveType.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      return errorResponse('Leave type not found.', 404);
    }

    // Check code collision if code is being updated
    if (parsed.data.code && parsed.data.code !== existing.code) {
      const codeCheck = await db.leaveType.findUnique({
        where: { code: parsed.data.code },
      });
      if (codeCheck && codeCheck.id !== existing.id) {
        return errorResponse(`Leave type with code '${parsed.data.code}' already exists.`, 409);
      }
    }

    const updated = await db.leaveType.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'UPDATE_LEAVE_TYPE',
      module: 'LEAVE',
      entityType: 'LeaveType',
      entityId: updated.id,
      previousValue: existing,
      newValue: updated,
    });

    return successResponse(updated, 'Leave type updated successfully.');
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Update leave type error:', error);
    return errorResponse('Failed to update leave type.');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['leave.manage_types']);

    const existing = await db.leaveType.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        _count: {
          select: { requests: true, entitlements: true },
        },
      },
    });

    if (!existing) {
      return errorResponse('Leave type not found.', 404);
    }

    // Soft delete / deactivate
    const deactivated = await db.leaveType.update({
      where: { id: params.id },
      data: {
        status: 'INACTIVE',
        deletedAt: new Date(),
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'DEACTIVATE_LEAVE_TYPE',
      module: 'LEAVE',
      entityType: 'LeaveType',
      entityId: deactivated.id,
      previousValue: existing,
      newValue: deactivated,
    });

    return successResponse(deactivated, 'Leave type deactivated successfully.');
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Deactivate leave type error:', error);
    return errorResponse('Failed to deactivate leave type.');
  }
}
