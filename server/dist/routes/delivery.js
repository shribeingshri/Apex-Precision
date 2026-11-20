"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.deliveryRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const DeliveryCreateSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    deliveryQty: zod_1.z.number().int().positive('Delivery quantity must be positive'),
    deliveryAddress: zod_1.z.string().min(5),
    dispatchDate: zod_1.z.string(),
    expectedArrivalDate: zod_1.z.string(),
    transportReference: zod_1.z.string().optional(),
    vehicleDetails: zod_1.z.string().optional(),
    assignedPersonnelId: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(client_1.DeliveryStatus).default(client_1.DeliveryStatus.PLANNED),
    notes: zod_1.z.string().optional(),
});
exports.deliveryRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId, status, clientId } = req.query;
        const where = {};
        if (projectId && typeof projectId === 'string')
            where.projectId = projectId;
        if (clientId && typeof clientId === 'string')
            where.clientId = clientId;
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        const deliveries = await db_1.prisma.delivery.findMany({
            where,
            include: {
                project: { select: { id: true, projectCode: true, name: true, orderedQty: true } },
                client: { select: { id: true, clientCode: true, companyName: true } },
                assignedPersonnel: { select: { id: true, name: true } },
            },
            orderBy: { dispatchDate: 'desc' },
        });
        res.json(deliveries);
    }
    catch (err) {
        res.status(500).json({ error: 'DELIVERY_FETCH_ERROR', message: err.message });
    }
});
exports.deliveryRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_DELIVERY'), async (req, res) => {
    try {
        const data = DeliveryCreateSchema.parse(req.body);
        const project = await db_1.prisma.project.findUnique({
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
        const count = await db_1.prisma.delivery.count();
        const deliveryNumber = `DEL-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const delivery = await db_1.prisma.$transaction(async (tx) => {
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
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'SCHEDULE_DELIVERY',
            entity: 'Delivery',
            entityId: delivery.id,
            details: `Scheduled delivery ${delivery.deliveryNumber}: ${delivery.deliveryQty} units to ${delivery.deliveryAddress}`,
            ipAddress: req.ip,
        });
        res.status(201).json(delivery);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'DELIVERY_CREATE_ERROR', message: err.message });
    }
});
exports.deliveryRouter.put('/:id/status', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_DELIVERY'), async (req, res) => {
    try {
        const id = getParamId(req);
        const { status, proofOfDeliveryUrl, actualDeliveryDate } = req.body;
        const delivery = await db_1.prisma.delivery.update({
            where: { id },
            data: {
                status,
                proofOfDeliveryUrl,
                actualDeliveryDate: actualDeliveryDate ? new Date(actualDeliveryDate) : (status === 'DELIVERED' ? new Date() : undefined),
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'UPDATE_DELIVERY_STATUS',
            entity: 'Delivery',
            entityId: delivery.id,
            details: `Updated delivery ${delivery.deliveryNumber} status to ${delivery.status}`,
            ipAddress: req.ip,
        });
        res.json(delivery);
    }
    catch (err) {
        res.status(500).json({ error: 'DELIVERY_STATUS_ERROR', message: err.message });
    }
});
