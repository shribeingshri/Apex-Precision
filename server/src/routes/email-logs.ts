import { Router, Request, Response } from 'express';
import { prisma } from '../utils/db';
import { authenticateToken } from '../middleware/auth';
import { EmailStatus } from '@prisma/client';

export const emailLogsRouter = Router();

emailLogsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, clientId, projectId } = req.query;
    const where: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as EmailStatus;
    }
    if (clientId && typeof clientId === 'string') where.clientId = clientId;
    if (projectId && typeof projectId === 'string') where.projectId = projectId;

    const logs = await prisma.emailLog.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        project: { select: { id: true, projectCode: true, name: true } },
        delivery: { select: { id: true, deliveryNumber: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'EMAIL_LOGS_ERROR', message: err.message });
  }
});

