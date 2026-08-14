import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, errorResponse, successResponse } from '@/lib/auth-helpers';
import { leaveTypeSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['leave.view']);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const isPaid = searchParams.get('isPaid');
    const search = searchParams.get('search');

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (isPaid !== null && isPaid !== undefined && isPaid !== '') {
      where.isPaid = isPaid === 'true';
    }
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const leaveTypes = await db.leaveType.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        policies: {
          where: { deletedAt: null },
        },
        _count: {
          select: {
            requests: true,
            entitlements: true,
          },
        },
      },
    });

    return successResponse(leaveTypes);
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Fetch leave types error:', error);
    return errorResponse('Failed to fetch leave types.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['leave.manage_types']);
    const body = await req.json();

    const parsed = leaveTypeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    // Check code uniqueness
    const existing = await db.leaveType.findUnique({
      where: { code: parsed.data.code },
    });
    if (existing && !existing.deletedAt) {
      return errorResponse(`Leave type with code '${parsed.data.code}' already exists.`, 409);
    }

    const leaveType = await db.leaveType.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isPaid: parsed.data.isPaid,
        defaultDays: parsed.data.defaultDays,
        maxDays: parsed.data.maxDays || null,
        requiresApproval: parsed.data.requiresApproval,
        requiresDocument: parsed.data.requiresDocument,
        requiresMedicalCert: parsed.data.requiresMedicalCert,
        genderApplicability: parsed.data.genderApplicability,
        color: parsed.data.color,
        status: parsed.data.status,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'CREATE_LEAVE_TYPE',
      module: 'LEAVE',
      entityType: 'LeaveType',
      entityId: leaveType.id,
      newValue: leaveType,
    });

    return successResponse(leaveType, 'Leave type created successfully.', 201);
  } catch (error: any) {
    if (error.status) return errorResponse(error.message, error.status);
    console.error('Create leave type error:', error);
    return errorResponse('Failed to create leave type.');
  }
}
