import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { DeliveryStatus } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const deliveryRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const DeliveryCreateSchema = z.object({
  projectId: z.string().uuid(),
  deliveryQty: z.number().int().positive('Delivery quantity must be positive'),
  deliveryAddress: z.string().min(5),
  dispatchDate: z.string(),
  expectedArrivalDate: z.string(),
  transportReference: z.string().optional(),
  vehicleDetails: z.string().optional(),
  assignedPersonnelId: z.string().optional(),
  status: z.nativeEnum(DeliveryStatus).default(DeliveryStatus.PLANNED),
  notes: z.string().optional(),
});

deliveryRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, status, clientId } = req.query;
    const where: any = {};

    if (projectId && typeof projectId === 'string') where.projectId = projectId;
    if (clientId && typeof clientId === 'string') where.clientId = clientId;
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as DeliveryStatus;
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        project: { select: { id: true, projectCode: true, name: true, orderedQty: true } },
        client: { select: { id: true, clientCode: true, companyName: true } },
        assignedPersonnel: { select: { id: true, name: true } },
      },
      orderBy: { dispatchDate: 'desc' },
    });

    res.json(deliveries);
  } catch (err: any) {
    res.status(500).json({ error: 'DELIVERY_FETCH_ERROR', message: err.message });
  }
});

deliveryRouter.post('/', authenticateToken, requirePermission('MANAGE_DELIVERY'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = DeliveryCreateSchema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      include: {
        inspections: { select: { approvedQty: true } },
        deliveries: { select: { deliveryQty: true, status: true } },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
      return;
    }

    const totalApproved = project.inspections.reduce((sum, i) => sum + i.approvedQty, 0);
    const existingActiveDeliveries = project.deliveries
      .filter((d) => d.status !== 'CANCELLED')
      .reduce((sum, d) => sum + d.deliveryQty, 0);

    const availableApprovedToDeliver = Math.max(0, totalApproved - existingActiveDeliveries);

    if (data.deliveryQty > availableApprovedToDeliver) {
      res.status(400).json({
        error: 'INSUFFICIENT_APPROVED_UNITS',
        message: `Cannot schedule dispatch of ${data.deliveryQty} units. Only ${availableApprovedToDeliver} quality-approved units are currently available for dispatch (Total Approved: ${totalApproved}, Already Dispatched/Allocated: ${existingActiveDeliveries}).`,
      });
      return;
    }

    const totalWithNew = existingActiveDeliveries + data.deliveryQty;
    if (totalWithNew > project.orderedQty) {
      res.status(400).json({
        error: 'ORDER_LIMIT_EXCEEDED',
        message: `Total active deliveries (${totalWithNew}) would exceed the total ordered quantity (${project.orderedQty}).`,
      });
      return;
    }

    const count = await prisma.delivery.count();
    const deliveryNumber = `DEL-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({
        data: {
          deliveryNumber,
          projectId: data.projectId,
          clientId: project.clientId,
          product: project.productName,
          deliveryQty: data.deliveryQty,
          deliveryAddress: data.deliveryAddress,
          dispatchDate: new Date(data.dispatchDate),
          expectedArrivalDate: new Date(data.expectedArrivalDate),
          transportReference: data.transportReference,
          vehicleDetails: data.vehicleDetails,
          assignedPersonnelId: data.assignedPersonnelId,
          status: data.status,
          notes: data.notes,
        },
      });

      if (project.status !== 'COMPLETED') {
        const remainingQty = project.orderedQty - totalWithNew;
        await tx.project.update({
          where: { id: project.id },
          data: {
            status: remainingQty === 0 ? 'COMPLETED' : 'PARTIALLY_DELIVERED',
          },
        });
      }

      await tx.emailLog.create({
        data: {
          recipient: project.clientId,
          sender: 'notifications@mfgerp.internal',
          subject: `Consignment Dispatch Advice: ${created.deliveryNumber}`,
          messagePreview: `Consignment of ${created.deliveryQty} units of ${created.product} scheduled for dispatch to ${created.deliveryAddress}`,
          clientId: project.clientId,
          projectId: project.id,
          deliveryId: created.id,
          category: 'DELIVERY_DISPATCH',
          status: 'SIMULATED',
          providerResponse: 'SIMULATED: Dispatch advice logged successfully.',
        },
      });

      return created;
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'SCHEDULE_DELIVERY',
      entity: 'Delivery',
      entityId: delivery.id,
      details: `Scheduled delivery ${delivery.deliveryNumber}: ${delivery.deliveryQty} units to ${delivery.deliveryAddress}`,
      ipAddress: req.ip,
    });

    res.status(201).json(delivery);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'DELIVERY_CREATE_ERROR', message: err.message });
  }
});

deliveryRouter.put('/:id/status', authenticateToken, requirePermission('MANAGE_DELIVERY'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const { status, proofOfDeliveryUrl, actualDeliveryDate } = req.body;

    const delivery = await prisma.delivery.update({
      where: { id },
      data: {
        status,
        proofOfDeliveryUrl,
        actualDeliveryDate: actualDeliveryDate ? new Date(actualDeliveryDate) : (status === 'DELIVERED' ? new Date() : undefined),
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'UPDATE_DELIVERY_STATUS',
      entity: 'Delivery',
      entityId: delivery.id,
      details: `Updated delivery ${delivery.deliveryNumber} status to ${delivery.status}`,
      ipAddress: req.ip,
    });

    res.json(delivery);
  } catch (err: any) {
    res.status(500).json({ error: 'DELIVERY_STATUS_ERROR', message: err.message });
  }
});
