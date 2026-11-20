import { Router, Request, Response } from 'express';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';

export const activityRouter = Router();

// Append-only chronological activity stream
activityRouter.get('/', authenticateToken, requirePermission('VIEW_ACTIVITY_LOGS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { entity, action, limit } = req.query;
    const where: any = {};

    if (entity && typeof entity === 'string' && entity !== 'ALL') {
      where.entity = entity;
    }
    if (action && typeof action === 'string' && action !== 'ALL') {
      where.action = action;
    }

    const take = limit ? Math.min(100, Number(limit)) : 50;

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'ACTIVITY_LOGS_ERROR', message: err.message });
  }
});

