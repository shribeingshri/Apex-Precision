import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { InspectionStatus } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const qualityRouter = Router();

const QualityInspectionSchema = z.object({
  projectId: z.string().uuid(),
  productionRecordId: z.string().uuid().optional().nullable(),
  inspectedQty: z.number().int().positive('Inspected quantity must be positive'),
  approvedQty: z.number().int().nonnegative('Approved quantity cannot be negative'),
  rejectedQty: z.number().int().nonnegative('Rejected quantity cannot be negative'),
  reworkQty: z.number().int().nonnegative('Rework quantity cannot be negative'),
  inspectionDate: z.string(),
  inspectorId: z.string().optional(),
  defectCategory: z.string().optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(InspectionStatus).default(InspectionStatus.PASSED),
});

qualityRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, status } = req.query;
    const where: any = {};

    if (projectId && typeof projectId === 'string') {
      where.projectId = projectId;
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as InspectionStatus;
    }

    const inspections = await prisma.qualityInspection.findMany({
      where,
      include: {
        project: {
          select: { id: true, projectCode: true, name: true, productName: true },
        },
        productionRecord: {
          select: { id: true, batchNumber: true, producedQty: true },
        },
        inspector: {
          select: { id: true, name: true, employeeCode: true },
        },
      },
      orderBy: { inspectionDate: 'desc' },
    });

    res.json(inspections);
  } catch (err: any) {
    res.status(500).json({ error: 'QC_FETCH_ERROR', message: err.message });
  }
});

qualityRouter.post('/', authenticateToken, requirePermission('RECORD_QUALITY'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = QualityInspectionSchema.parse(req.body);

    // CRITICAL BUSINESS VALIDATION:
    // Inspected quantity MUST strictly equal approved + rejected + rework
    const sumComponents = data.approvedQty + data.rejectedQty + data.reworkQty;
    if (sumComponents !== data.inspectedQty) {
      res.status(400).json({
        error: 'QC_RECONCILIATION_FAILED',
        message: `Inspected quantity (${data.inspectedQty}) does not match breakdown sum: Approved (${data.approvedQty}) + Rejected (${data.rejectedQty}) + Rework (${data.reworkQty}) = ${sumComponents}. Every inspected item must be fully accounted for.`,
      });
      return;
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      include: {
        productionRecords: { select: { producedQty: true } },
        inspections: { select: { inspectedQty: true } },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
      return;
    }

    // Verify inspected quantity doesn't exceed total produced quantity available
    const totalProduced = project.productionRecords.reduce((sum, r) => sum + r.producedQty, 0);
    const previouslyInspected = project.inspections.reduce((sum, r) => sum + r.inspectedQty, 0);
    const availableToInspect = Math.max(0, totalProduced - previouslyInspected);

    if (data.inspectedQty > availableToInspect) {
      res.status(400).json({
        error: 'INSPECTION_LIMIT_EXCEEDED',
        message: `Inspected quantity (${data.inspectedQty}) exceeds remaining uninspected produced quantity (${availableToInspect}). Total Produced: ${totalProduced}, Previously Inspected: ${previouslyInspected}.`,
      });
      return;
    }

    const count = await prisma.qualityInspection.count();
    const inspectionNumber = `QC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const inspection = await prisma.$transaction(async (tx) => {
      const created = await tx.qualityInspection.create({
        data: {
          inspectionNumber,
          projectId: data.projectId,
          productionRecordId: data.productionRecordId,
          inspectedQty: data.inspectedQty,
          approvedQty: data.approvedQty,
          rejectedQty: data.rejectedQty,
          reworkQty: data.reworkQty,
          inspectionDate: new Date(data.inspectionDate),
          inspectorId: data.inspectorId,
          defectCategory: data.defectCategory,
          notes: data.notes,
          status: data.status,
        },
      });

      // Update project status to QUALITY_INSPECTION or READY_FOR_DELIVERY
      if (data.approvedQty > 0 && project.status === 'IN_PRODUCTION') {
        await tx.project.update({
          where: { id: project.id },
          data: { status: 'READY_FOR_DELIVERY' },
        });
      }

      return created;
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'RECORD_QUALITY_INSPECTION',
      entity: 'QualityInspection',
      entityId: inspection.id,
      details: `QC Inspection ${inspection.inspectionNumber}: ${inspection.approvedQty} Approved, ${inspection.rejectedQty} Rejected, ${inspection.reworkQty} Rework out of ${inspection.inspectedQty} inspected`,
      ipAddress: req.ip,
    });

    res.status(201).json(inspection);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'QC_CREATE_ERROR', message: err.message });
  }
});

