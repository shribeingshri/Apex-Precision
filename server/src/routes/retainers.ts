import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { RetainerStatus, BillingFrequency } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const retainersRouter = Router();

const RetainerSchema = z.object({
  clientId: z.string().uuid(),
  scope: z.string().min(5),
  contractValue: z.number().positive(),
  recurringFee: z.number().positive(),
  billingFrequency: z.nativeEnum(BillingFrequency).default(BillingFrequency.MONTHLY),
  startDate: z.string(),
  renewalDate: z.string(),
  endDate: z.string().optional().nullable(),
  accountManagerId: z.string().optional().nullable(),
  estimatedDeliveryCosts: z.number().nonnegative().default(0),
  status: z.nativeEnum(RetainerStatus).default(RetainerStatus.ACTIVE),
  notes: z.string().optional(),
});

retainersRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, clientId } = req.query;
    const where: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as RetainerStatus;
    }
    if (clientId && typeof clientId === 'string') where.clientId = clientId;

    const retainers = await prisma.retainer.findMany({
      where,
      include: {
        client: { select: { id: true, clientCode: true, companyName: true } },
        accountManager: { select: { id: true, name: true, employeeCode: true } },
      },
      orderBy: { renewalDate: 'asc' },
    });

    // Calculate estimated profit and profit margin
    const enriched = retainers.map((r) => {
      const contractVal = Number(r.contractValue);
      const estCosts = Number(r.estimatedDeliveryCosts);
      const estimatedProfit = Math.max(0, contractVal - estCosts);
      const estimatedMargin = contractVal > 0 ? Math.round((estimatedProfit / contractVal) * 100) : 0;

      return {
        ...r,
        estimatedProfit,
        estimatedMargin,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'RETAINERS_FETCH_ERROR', message: err.message });
  }
});

retainersRouter.post('/', authenticateToken, requirePermission('MANAGE_RETAINERS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = RetainerSchema.parse(req.body);
    const count = await prisma.retainer.count();
    const retainerCode = `RET-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const retainer = await prisma.retainer.create({
      data: {
        retainerCode,
        clientId: data.clientId,
        scope: data.scope,
        contractValue: data.contractValue,
        recurringFee: data.recurringFee,
        billingFrequency: data.billingFrequency,
        startDate: new Date(data.startDate),
        renewalDate: new Date(data.renewalDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        accountManagerId: data.accountManagerId,
        estimatedDeliveryCosts: data.estimatedDeliveryCosts,
        status: data.status,
        notes: data.notes,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CREATE_RETAINER',
      entity: 'Retainer',
      entityId: retainer.id,
      details: `Created retainer ${retainer.retainerCode} (Recurring: INR ${retainer.recurringFee})`,
      ipAddress: req.ip,
    });

    res.status(201).json(retainer);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'RETAINER_CREATE_ERROR', message: err.message });
  }
});

