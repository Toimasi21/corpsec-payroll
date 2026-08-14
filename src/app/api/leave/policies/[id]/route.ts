import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { leavePolicySchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth(['leave.view']);

    const policy = await db.leavePolicy.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        leaveType: true,
      },
    });

    if (!policy) {
      return errorResponse('Leave policy not found.', 404);
    }

    return successResponse(policy);
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Fetch leave policy error:', error);
    return errorResponse('Failed to fetch leave policy.');
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['leave.manage_policies']);
    const body = await req.json();

    const parsed = leavePolicySchema.partial().safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const existing = await db.leavePolicy.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      return errorResponse('Leave policy not found.', 404);
    }

    const updated = await db.leavePolicy.update({
      where: { id: params.id },
      data: parsed.data,
      include: { leaveType: true },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'UPDATE_LEAVE_POLICY',
      module: 'LEAVE',
      entityType: 'LeavePolicy',
      entityId: updated.id,
      previousValue: existing,
      newValue: updated,
    });

    return successResponse(updated, 'Leave policy updated successfully.');
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Update leave policy error:', error);
    return errorResponse('Failed to update leave policy.');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(['leave.manage_policies']);

    const existing = await db.leavePolicy.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      return errorResponse('Leave policy not found.', 404);
    }

    const deactivated = await db.leavePolicy.update({
      where: { id: params.id },
      data: {
        status: 'INACTIVE',
        deletedAt: new Date(),
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'DEACTIVATE_LEAVE_POLICY',
      module: 'LEAVE',
      entityType: 'LeavePolicy',
      entityId: deactivated.id,
      previousValue: existing,
      newValue: deactivated,
    });

    return successResponse(deactivated, 'Leave policy deactivated successfully.');
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Deactivate leave policy error:', error);
    return errorResponse('Failed to deactivate leave policy.');
  }
}
