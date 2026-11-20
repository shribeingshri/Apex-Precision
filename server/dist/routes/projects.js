"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.projectsRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const ProjectCreateSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(2),
    productName: zod_1.z.string().min(2),
    productDescription: zod_1.z.string().optional(),
    specifications: zod_1.z.string().optional(),
    orderedQty: zod_1.z.number().int().positive(),
    uom: zod_1.z.string().default('PCS'),
    unitSellingPrice: zod_1.z.number().positive(),
    estimatedValue: zod_1.z.number().positive(),
    projectManagerId: zod_1.z.string().optional(),
    startDate: zod_1.z.string(),
    expectedCompletionDate: zod_1.z.string(),
    priority: zod_1.z.nativeEnum(client_1.ProjectPriority).default(client_1.ProjectPriority.MEDIUM),
    status: zod_1.z.nativeEnum(client_1.ProjectStatus).default(client_1.ProjectStatus.PLANNING),
    notes: zod_1.z.string().optional(),
    assignedEmployeeIds: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.projectsRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status, clientId, search, includeArchived } = req.query;
        const where = {};
        if (includeArchived !== 'true') {
            where.isArchived = false;
        }
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
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
        const projects = await db_1.prisma.project.findMany({
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
    }
    catch (err) {
        res.status(500).json({ error: 'PROJECTS_FETCH_ERROR', message: err.message });
    }
});
exports.projectsRouter.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = getParamId(req);
        const project = await db_1.prisma.project.findUnique({
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
        const prodRecords = project.productionRecords || [];
        const inspections = project.inspections || [];
        const deliveries = project.deliveries || [];
        const invoices = project.invoices || [];
        const payments = project.payments || [];
        const expenses = project.expenses || [];
        const producedQty = prodRecords.reduce((sum, r) => sum + r.producedQty, 0);
        const inspectedQty = inspections.reduce((sum, r) => sum + r.inspectedQty, 0);
        const approvedQty = inspections.reduce((sum, r) => sum + r.approvedQty, 0);
        const rejectedQty = inspections.reduce((sum, r) => sum + r.rejectedQty, 0);
        const reworkQty = inspections.reduce((sum, r) => sum + r.reworkQty, 0);
        const activeDeliveredQty = deliveries
            .filter((d) => d.status !== 'CANCELLED')
            .reduce((sum, r) => sum + r.deliveryQty, 0);
        const completedDeliveredQty = deliveries
            .filter((d) => d.status === 'DELIVERED')
            .reduce((sum, r) => sum + r.deliveryQty, 0);
        const remainingDeliveryQty = Math.max(0, project.orderedQty - completedDeliveredQty);
        const availableForDelivery = Math.max(0, approvedQty - activeDeliveredQty);
        const totalInvoiced = invoices
            .filter((i) => i.status !== 'CANCELLED')
            .reduce((sum, i) => sum + Number(i.totalAmount), 0);
        const totalCollected = payments
            .filter((p) => p.status === 'COMPLETED')
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const totalRecordedCost = expenses
            .filter((e) => e.approvalStatus === 'APPROVED')
            .reduce((sum, e) => sum + Number(e.amount), 0);
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
    }
    catch (err) {
        res.status(500).json({ error: 'PROJECT_FETCH_ERROR', message: err.message });
    }
});
exports.projectsRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_PROJECTS'), async (req, res) => {
    try {
        const data = ProjectCreateSchema.parse(req.body);
        const count = await db_1.prisma.project.count();
        const projectCode = `PRJ-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
        const newProject = await db_1.prisma.project.create({
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
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_PROJECT',
            entity: 'Project',
            entityId: newProject.id,
            details: `Created project ${newProject.projectCode}: ${newProject.name} (${newProject.orderedQty} units)`,
            ipAddress: req.ip,
        });
        res.status(201).json(newProject);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'PROJECT_CREATE_ERROR', message: err.message });
    }
});
exports.projectsRouter.put('/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_PROJECTS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const data = ProjectCreateSchema.partial().parse(req.body);
        const updated = await db_1.prisma.project.update({
            where: { id },
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : undefined,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'UPDATE_PROJECT',
            entity: 'Project',
            entityId: updated.id,
            details: `Updated project ${updated.projectCode} (Status: ${updated.status})`,
            ipAddress: req.ip,
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'PROJECT_UPDATE_ERROR', message: err.message });
    }
});
