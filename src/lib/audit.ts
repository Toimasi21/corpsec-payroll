import { db } from './db';
import { headers } from 'next/headers';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'tokenhash',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'confirmPassword',
  'oldPassword',
  'newPassword',
]);

/**
 * Recursively scrub sensitive keys from an object before recording to audit logs.
 */
function sanitizeForAudit(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeForAudit);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED_SECRET]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeForAudit(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export interface CreateAuditLogParams {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record an audit log entry in the database.
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    let clientIp = params.ipAddress;
    let clientUa = params.userAgent;

    if (!clientIp || !clientUa) {
      try {
        const headerList = headers();
        if (!clientIp) {
          clientIp =
            headerList.get('x-forwarded-for')?.split(',')[0].trim() ||
            headerList.get('x-real-ip') ||
            '127.0.0.1';
        }
        if (!clientUa) {
          clientUa = headerList.get('user-agent') || 'Unknown User Agent';
        }
      } catch (err) {
        // Headers might not be available in background/cron contexts
        clientIp = clientIp || '127.0.0.1';
        clientUa = clientUa || 'System Process';
      }
    }

    const prevJson = params.previousValue
      ? JSON.stringify(sanitizeForAudit(params.previousValue))
      : null;
    const newJson = params.newValue
      ? JSON.stringify(sanitizeForAudit(params.newValue))
      : null;

    await db.auditLog.create({
      data: {
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        action: params.action.toUpperCase(),
        module: params.module.toUpperCase(),
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        previousValue: prevJson,
        newValue: newJson,
        ipAddress: clientIp,
        userAgent: clientUa,
      },
    });
  } catch (error) {
    // Audit logging failure should not crash the main operation, but must be logged to stderr
    console.error('CRITICAL: Failed to write audit log:', error);
  }
}

export const logAudit = createAuditLog;

