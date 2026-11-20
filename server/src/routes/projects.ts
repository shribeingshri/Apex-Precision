import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { ProjectPriority, ProjectStatus } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const projectsRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const ProjectCreateSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(2),
  productName: z.string().min(2),
  productDescription: z.string().optional(),
  specifications: z.string().optional(),
  orderedQty: z.number().int().positive(),
  uom: z.string().default('PCS'),
  unitSellingPrice: z.number().positive(),
  estimatedValue: z.number().positive(),
  projectManagerId: z.string().optional(),
  startDate: z.string(),
  expectedCompletionDate: z.string(),
  priority: z.nativeEnum(ProjectPriority).default(ProjectPriority.MEDIUM),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
  notes: z.string().optional(),
  assignedEmployeeIds: z.array(z.string()).optional(),
});

projectsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, clientId, search, includeArchived } = req.query;
    const where: any = {};

    if (includeArchived !== 'true') {
      where.isArchived = false;
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as ProjectStatus;
    }

    if (clientId && typeof clientId === 'string') {
      where.clientId = clientId;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { projectCode: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, clientCode: true, companyName: true } },
        projectManager: { select: { id: true, name: true, employeeCode: true } },
        productionRecords: { select: { producedQty: true } },
        inspections: { select: { approvedQty: true, rejectedQty: true } },
        deliveries: { select: { deliveryQty: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = projects.map((p) => {
      const producedQty = p.productionRecords.reduce((sum, r) => sum + r.producedQty, 0);
      const approvedQty = p.inspections.reduce((sum, r) => sum + r.approvedQty, 0);
      const deliveredQty = p.deliveries
        .filter((d) => d.status === 'DELIVERED')
        .reduce((sum, r) => sum + r.deliveryQty, 0);

      const productionProgress = Math.min(100, Math.round((producedQty / p.orderedQty) * 100));
      const deliveryProgress = Math.min(100, Math.round((deliveredQty / p.orderedQty) * 100));
      const remainingDeliveryQty = Math.max(0, p.orderedQty - deliveredQty);

      return {
        ...p,
        stats: {
          producedQty,
          approvedQty,
          deliveredQty,
          remainingDeliveryQty,
          productionProgress,
          deliveryProgress,
        },
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'PROJECTS_FETCH_ERROR', message: err.message });
  }
});

projectsRouter.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        projectManager: true,
        assignments: {
          include: {
            employee: {
              select: { id: true, employeeCode: true, name: true, designation: true },
            },
          },
        },
        productionRecords: {
          include: {
            assignedEmployee: { select: { id: true, name: true } },
          },
          orderBy: { productionDate: 'desc' },
        },
        inspections: {
          include: {
            inspector: { select: { id: true, name: true } },
          },
          orderBy: { inspectionDate: 'desc' },
        },
        deliveries: {
          include: {
            assignedPersonnel: { select: { id: true, name: true } },
          },
          orderBy: { dispatchDate: 'desc' },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        expenses: {
          orderBy: { date: 'desc' },
        },
        tasks: {
          include: {
            assignedEmployee: { select: { id: true, name: true } },
          },
          orderBy: { deadline: 'asc' },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
      return;
    }

    const prodRecords: any[] = project.productionRecords || [];
    const inspections: any[] = project.inspections || [];
    const deliveries: any[] = project.deliveries || [];
    const invoices: any[] = project.invoices || [];
    const payments: any[] = project.payments || [];
    const expenses: any[] = project.expenses || [];

    const producedQty = prodRecords.reduce((sum: number, r: any) => sum + r.producedQty, 0);
    const inspectedQty = inspections.reduce((sum: number, r: any) => sum + r.inspectedQty, 0);
    const approvedQty = inspections.reduce((sum: number, r: any) => sum + r.approvedQty, 0);
    const rejectedQty = inspections.reduce((sum: number, r: any) => sum + r.rejectedQty, 0);
    const reworkQty = inspections.reduce((sum: number, r: any) => sum + r.reworkQty, 0);

    const activeDeliveredQty = deliveries
      .filter((d: any) => d.status !== 'CANCELLED')
      .reduce((sum: number, r: any) => sum + r.deliveryQty, 0);

    const completedDeliveredQty = deliveries
      .filter((d: any) => d.status === 'DELIVERED')
      .reduce((sum: number, r: any) => sum + r.deliveryQty, 0);

    const remainingDeliveryQty = Math.max(0, project.orderedQty - completedDeliveredQty);
    const availableForDelivery = Math.max(0, approvedQty - activeDeliveredQty);

    const totalInvoiced = invoices
      .filter((i: any) => i.status !== 'CANCELLED')
      .reduce((sum: number, i: any) => sum + Number(i.totalAmount), 0);

    const totalCollected = payments
      .filter((p: any) => p.status === 'COMPLETED')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const totalRecordedCost = expenses
      .filter((e: any) => e.approvalStatus === 'APPROVED')
      .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

    res.json({
      ...project,
      summary: {
        producedQty,
        inspectedQty,
        approvedQty,
        rejectedQty,
        reworkQty,
        activeDeliveredQty,
        completedDeliveredQty,
        remainingDeliveryQty,
        availableForDelivery,
        totalInvoiced,
        totalCollected,
        totalRecordedCost,
        productionProgress: Math.min(100, Math.round((producedQty / project.orderedQty) * 100)),
        deliveryProgress: Math.min(100, Math.round((completedDeliveredQty / project.orderedQty) * 100)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'PROJECT_FETCH_ERROR', message: err.message });
  }
});

projectsRouter.post('/', authenticateToken, requirePermission('MANAGE_PROJECTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = ProjectCreateSchema.parse(req.body);
    const count = await prisma.project.count();
    const projectCode = `PRJ-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const newProject = await prisma.project.create({
      data: {
        projectCode,
        clientId: data.clientId,
        name: data.name,
        productName: data.productName,
        productDescription: data.productDescription,
        specifications: data.specifications,
        orderedQty: data.orderedQty,
        uom: data.uom,
        unitSellingPrice: data.unitSellingPrice,
        estimatedValue: data.estimatedValue,
        projectManagerId: data.projectManagerId,
        startDate: new Date(data.startDate),
        expectedCompletionDate: new Date(data.expectedCompletionDate),
        priority: data.priority,
        status: data.status,
        notes: data.notes,
        assignments: data.assignedEmployeeIds && data.assignedEmployeeIds.length > 0
          ? {
              create: data.assignedEmployeeIds.map((empId) => ({
                employeeId: empId,
                roleInProject: 'Project Contributor',
              })),
            }
          : undefined,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CREATE_PROJECT',
      entity: 'Project',
      entityId: newProject.id,
      details: `Created project ${newProject.projectCode}: ${newProject.name} (${newProject.orderedQty} units)`,
      ipAddress: req.ip,
    });

    res.status(201).json(newProject);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'PROJECT_CREATE_ERROR', message: err.message });
  }
});

projectsRouter.put('/:id', authenticateToken, requirePermission('MANAGE_PROJECTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const data = ProjectCreateSchema.partial().parse(req.body);

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : undefined,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'UPDATE_PROJECT',
      entity: 'Project',
      entityId: updated.id,
      details: `Updated project ${updated.projectCode} (Status: ${updated.status})`,
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'PROJECT_UPDATE_ERROR', message: err.message });
  }
});
