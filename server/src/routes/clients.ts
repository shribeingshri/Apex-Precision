import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { ClientStatus } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const clientsRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const ClientSchema = z.object({
  companyName: z.string().min(2),
  contactPerson: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().min(5),
  gstin: z.string().optional(),
  industry: z.string().optional(),
  accountManagerId: z.string().optional(),
  status: z.nativeEnum(ClientStatus).optional(),
});

clientsRouter.get('/', authenticateToken, requirePermission('MANAGE_CLIENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, includeArchived } = req.query;
    const where: any = {};

    if (includeArchived !== 'true') {
      where.isArchived = false;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { clientCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        accountManager: {
          select: { id: true, name: true, employeeCode: true },
        },
        _count: {
          select: {
            projects: true,
            invoices: true,
            deliveries: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: 'CLIENTS_FETCH_ERROR', message: err.message });
  }
});

clientsRouter.get('/:id', authenticateToken, requirePermission('MANAGE_CLIENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        accountManager: true,
        contacts: true,
        projects: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { deliveries: true, productionRecords: true },
            },
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        deliveries: {
          orderBy: { dispatchDate: 'desc' },
        },
        retainers: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found.' });
      return;
    }

    let totalInvoiced = 0;
    let totalReceived = 0;
    let outstandingBalance = 0;

    (client.invoices as any[]).forEach((inv) => {
      if (inv.status !== 'CANCELLED') {
        totalInvoiced += Number(inv.totalAmount);
        totalReceived += Number(inv.amountReceived);
        outstandingBalance += Number(inv.outstandingBalance);
      }
    });

    res.json({
      ...client,
      financialSummary: {
        totalInvoiced,
        totalReceived,
        outstandingBalance,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'CLIENT_DETAIL_ERROR', message: err.message });
  }
});

clientsRouter.post('/', authenticateToken, requirePermission('MANAGE_CLIENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = ClientSchema.parse(req.body);
    const count = await prisma.client.count();
    const clientCode = `CLI-${1000 + count + 1}`;

    const newClient = await prisma.client.create({
      data: {
        clientCode,
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        address: data.address,
        gstin: data.gstin,
        industry: data.industry,
        accountManagerId: data.accountManagerId,
        status: data.status || ClientStatus.ACTIVE,
        contacts: {
          create: {
            name: data.contactPerson,
            email: data.email,
            phone: data.phone,
            isPrimary: true,
          },
        },
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CREATE_CLIENT',
      entity: 'Client',
      entityId: newClient.id,
      details: `Created new client ${newClient.clientCode} (${newClient.companyName})`,
      ipAddress: req.ip,
    });

    res.status(201).json(newClient);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'CLIENT_CREATE_ERROR', message: err.message });
  }
});

clientsRouter.put('/:id', authenticateToken, requirePermission('MANAGE_CLIENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const data = ClientSchema.partial().parse(req.body);

    const updated = await prisma.client.update({
      where: { id },
      data,
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'UPDATE_CLIENT',
      entity: 'Client',
      entityId: updated.id,
      details: `Updated client ${updated.clientCode} (${updated.companyName})`,
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'CLIENT_UPDATE_ERROR', message: err.message });
  }
});

clientsRouter.post('/:id/archive', authenticateToken, requirePermission('MANAGE_CLIENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const updated = await prisma.client.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'ARCHIVE_CLIENT',
      entity: 'Client',
      entityId: updated.id,
      details: `Archived client ${updated.clientCode} (${updated.companyName}). All historical orders preserved.`,
      ipAddress: req.ip,
    });

    res.json({ message: 'Client archived safely without removing historical records.', client: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'ARCHIVE_ERROR', message: err.message });
  }
});

clientsRouter.post('/:id/restore', authenticateToken, requirePermission('MANAGE_CLIENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const updated = await prisma.client.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'RESTORE_CLIENT',
      entity: 'Client',
      entityId: updated.id,
      details: `Restored archived client ${updated.clientCode}`,
      ipAddress: req.ip,
    });

    res.json({ message: 'Client restored successfully.', client: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'RESTORE_ERROR', message: err.message });
  }
});
