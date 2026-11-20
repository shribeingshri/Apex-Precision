"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../utils/audit");
exports.productionRouter = (0, express_1.Router)();
const ProductionRecordSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    product: zod_1.z.string().min(2),
    plannedQty: zod_1.z.number().int().positive('Planned quantity must be greater than zero'),
    producedQty: zod_1.z.number().int().positive('Produced quantity must be positive'),
    productionDate: zod_1.z.string(),
    shift: zod_1.z.string().optional(),
    machineLine: zod_1.z.string().optional(),
    assignedEmployeeId: zod_1.z.string().optional(),
    materialCost: zod_1.z.number().nonnegative().default(0),
    labourCost: zod_1.z.number().nonnegative().default(0),
    otherCost: zod_1.z.number().nonnegative().default(0),
    notes: zod_1.z.string().optional(),
});
exports.productionRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        const where = {};
        if (projectId && typeof projectId === 'string') {
            where.projectId = projectId;
        }
        const records = await db_1.prisma.productionRecord.findMany({
            where,
            include: {
                project: {
                    select: { id: true, projectCode: true, name: true, orderedQty: true },
                },
                assignedEmployee: {
                    select: { id: true, name: true, employeeCode: true },
                },
                inspections: true,
            },
            orderBy: { productionDate: 'desc' },
        });
        res.json(records);
    }
    catch (err) {
        res.status(500).json({ error: 'PRODUCTION_FETCH_ERROR', message: err.message });
    }
});
exports.productionRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('RECORD_PRODUCTION'), async (req, res) => {
    try {
        const data = ProductionRecordSchema.parse(req.body);
        // Business Validation 1: Verify project exists and is active
        const project = await db_1.prisma.project.findUnique({
            where: { id: data.projectId },
            include: {
                productionRecords: { select: { producedQty: true } },
            },
        });
        if (!project) {
            res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
            return;
        }
        if (['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(project.status)) {
            res.status(400).json({
                error: 'PROJECT_INACTIVE',
                message: `Cannot record production for project in status: ${project.status}`,
            });
            return;
        }
        // Business Validation 2: Check cumulative produced vs order limits (warn if > 110% over-production)
        const existingProduced = project.productionRecords.reduce((sum, r) => sum + r.producedQty, 0);
        const newTotalProduced = existingProduced + data.producedQty;
        const maxAllowedLimit = Math.round(project.orderedQty * 1.15); // Standard 15% allowance for setup/spares
        if (newTotalProduced > maxAllowedLimit) {
            res.status(400).json({
                error: 'OVERPRODUCTION_EXCEEDED',
                message: `Total produced quantity (${newTotalProduced}) exceeds allowable order threshold of 115% (${maxAllowedLimit} units). Authorized manager sign-off required.`,
            });
            return;
        }
        const count = await db_1.prisma.productionRecord.count();
        const batchNumber = `PRD-BATCH-${String(count + 1).padStart(4, '0')}`;
        const record = await db_1.prisma.$transaction(async (tx) => {
            const created = await tx.productionRecord.create({
                data: {
                    batchNumber,
                    projectId: data.projectId,
                    product: data.product,
                    plannedQty: data.plannedQty,
                    producedQty: data.producedQty,
                    productionDate: new Date(data.productionDate),
                    shift: data.shift,
                    machineLine: data.machineLine,
                    assignedEmployeeId: data.assignedEmployeeId,
                    materialCost: data.materialCost,
                    labourCost: data.labourCost,
                    otherCost: data.otherCost,
                    notes: data.notes,
                },
            });
            // Update project status to IN_PRODUCTION if it was PLANNING or APPROVED
            if (['PLANNING', 'APPROVED'].includes(project.status)) {
                await tx.project.update({
                    where: { id: project.id },
                    data: { status: 'IN_PRODUCTION' },
                });
            }
            return created;
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'RECORD_PRODUCTION',
            entity: 'ProductionRecord',
            entityId: record.id,
            details: `Logged batch ${record.batchNumber}: ${record.producedQty} units produced on ${record.machineLine || 'Line'}`,
            ipAddress: req.ip,
        });
        res.status(201).json(record);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'PRODUCTION_CREATE_ERROR', message: err.message });
    }
});
