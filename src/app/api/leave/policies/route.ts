import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { leavePolicySchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['leave.view']);
    const { searchParams } = new URL(req.url);

    const leaveTypeId = searchParams.get('leaveTypeId');
    const status = searchParams.get('status');

    const where: any = { deletedAt: null };
    if (leaveTypeId) where.leaveTypeId = leaveTypeId;
    if (status) where.status = status;

    const policies = await db.leavePolicy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        leaveType: {
          select: { id: true, code: true, name: true, color: true },
        },
      },
    });

    return successResponse(policies);
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Fetch leave policies error:', error);
    return errorResponse('Failed to fetch leave policies.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['leave.manage_policies']);
    const body = await req.json();

    const parsed = leavePolicySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const existingCode = await db.leavePolicy.findUnique({
      where: { policyCode: parsed.data.policyCode },
    });
    if (existingCode && !existingCode.deletedAt) {
      return errorResponse(`Policy with code '${parsed.data.policyCode}' already exists.`, 409);
    }

    const policy = await db.leavePolicy.create({
      data: {
        leaveTypeId: parsed.data.leaveTypeId,
        policyName: parsed.data.policyName,
        policyCode: parsed.data.policyCode,
        entitledDays: parsed.data.entitledDays,
        accrualMethod: parsed.data.accrualMethod,
        accrualFrequency: parsed.data.accrualFrequency,
        allowCarryForward: parsed.data.allowCarryForward,
        maxCarryForwardDays: parsed.data.maxCarryForwardDays,
        carryForwardExpiryMonths: parsed.data.carryForwardExpiryMonths,
        minServiceDays: parsed.data.minServiceDays,
        prorationRule: parsed.data.prorationRule,
        excludeWeekends: parsed.data.excludeWeekends,
        excludeHolidays: parsed.data.excludeHolidays,
        allowAdvanceLeave: parsed.data.allowAdvanceLeave,
        maxAdvanceDays: parsed.data.maxAdvanceDays,
        effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : new Date(),
        status: parsed.data.status,
      },
      include: {
        leaveType: true,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'CREATE_LEAVE_POLICY',
      module: 'LEAVE',
      entityType: 'LeavePolicy',
      entityId: policy.id,
      newValue: policy,
    });

    return successResponse(policy, 'Leave policy created successfully.', 201);
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Create leave policy error:', error);
    return errorResponse('Failed to create leave policy.');
  }
}
