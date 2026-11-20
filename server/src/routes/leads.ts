import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { LeadStatus } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const leadsRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const LeadCreateSchema = z.object({
  companyName: z.string().min(2),
  contactPerson: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().optional(),
  industry: z.string().optional(),
  productRequirement: z.string().min(2),
  expectedQty: z.number().int().positive(),
  estimatedValue: z.number().nonnegative(),
  leadSource: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
});

leadsRouter.get('/', authenticateToken, requirePermission('MANAGE_LEADS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;
    const where: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as LeadStatus;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { leadCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedEmployee: {
          select: { id: true, name: true, employeeCode: true },
        },
        convertedClient: {
          select: { id: true, companyName: true, clientCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(leads);
  } catch (err: any) {
    res.status(500).json({ error: 'LEADS_ERROR', message: err.message });
  }
});

leadsRouter.get('/:id', authenticateToken, requirePermission('MANAGE_LEADS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedEmployee: true,
        convertedClient: true,
      },
    });

    if (!lead) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found.' });
      return;
    }

    res.json(lead);
  } catch (err: any) {
    res.status(500).json({ error: 'LEAD_FETCH_ERROR', message: err.message });
  }
});

leadsRouter.post('/', authenticateToken, requirePermission('MANAGE_LEADS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = LeadCreateSchema.parse(req.body);
    const count = await prisma.lead.count();
    const leadCode = `LEAD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const newLead = await prisma.lead.create({
      data: {
        leadCode,
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        address: data.address,
        industry: data.industry,
        productRequirement: data.productRequirement,
        expectedQty: data.expectedQty,
        estimatedValue: data.estimatedValue,
        leadSource: data.leadSource,
        assignedEmployeeId: data.assignedEmployeeId,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        notes: data.notes,
        status: data.status || LeadStatus.NEW,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CREATE_LEAD',
      entity: 'Lead',
      entityId: newLead.id,
      details: `Created new lead ${newLead.leadCode} for ${newLead.companyName}`,
      ipAddress: req.ip,
    });

    res.status(201).json(newLead);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'LEAD_CREATE_ERROR', message: err.message });
  }
});

leadsRouter.put('/:id', authenticateToken, requirePermission('MANAGE_LEADS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const data = LeadCreateSchema.partial().parse(req.body);

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...data,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'UPDATE_LEAD',
      entity: 'Lead',
      entityId: updated.id,
      details: `Updated lead ${updated.leadCode} (${updated.status})`,
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'LEAD_UPDATE_ERROR', message: err.message });
  }
});

leadsRouter.post('/:id/convert', authenticateToken, requirePermission('MANAGE_CLIENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found.' });
      return;
    }

    if (lead.status === LeadStatus.CONVERTED || lead.convertedClientId) {
      res.status(400).json({
        error: 'ALREADY_CONVERTED',
        message: 'This lead has already been converted into a client.',
      });
      return;
    }

    const clientCount = await prisma.client.count();
    const clientCode = `CLI-${1000 + clientCount + 1}`;

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          clientCode,
          companyName: lead.companyName,
          contactPerson: lead.contactPerson,
          email: lead.email,
          phone: lead.phone,
          address: lead.address || 'Address pending verification',
          industry: lead.industry,
          accountManagerId: lead.assignedEmployeeId,
          contacts: {
            create: {
              name: lead.contactPerson,
              email: lead.email,
              phone: lead.phone,
              designation: 'Primary Representative',
              isPrimary: true,
            },
          },
        },
      });

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: LeadStatus.CONVERTED,
          convertedClientId: client.id,
        },
      });

      return { client, updatedLead };
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CONVERT_LEAD',
      entity: 'Client',
      entityId: result.client.id,
      details: `Converted lead ${lead.leadCode} into client ${result.client.clientCode} (${result.client.companyName})`,
      ipAddress: req.ip,
    });

    res.json({
      message: 'Lead converted into client successfully.',
      client: result.client,
      lead: result.updatedLead,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'CONVERSION_ERROR', message: err.message });
  }
});
