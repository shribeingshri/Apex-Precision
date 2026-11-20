import { prisma } from './db';

export async function logActivity(params: {
  userId?: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

