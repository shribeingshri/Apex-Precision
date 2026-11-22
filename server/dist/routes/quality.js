"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualityRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.qualityRouter = (0, express_1.Router)();
const QualityInspectionSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    productionRecordId: zod_1.z.string().uuid().optional().nullable(),
    inspectedQty: zod_1.z.number().int().positive('Inspected quantity must be positive'),
    approvedQty: zod_1.z.number().int().nonnegative('Approved quantity cannot be negative'),
    rejectedQty: zod_1.z.number().int().nonnegative('Rejected quantity cannot be negative'),
    reworkQty: zod_1.z.number().int().nonnegative('Rework quantity cannot be negative'),
    inspectionDate: zod_1.z.string(),
    inspectorId: zod_1.z.string().optional(),
    defectCategory: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(client_1.InspectionStatus).default(client_1.InspectionStatus.PASSED),
});
exports.qualityRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId, status } = req.query;
        const where = {};
        if (projectId && typeof projectId === 'string') {
            where.projectId = projectId;
        }
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        const inspections = await db_1.prisma.qualityInspection.findMany({
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
    }
    catch (err) {
        res.status(500).json({ error: 'QC_FETCH_ERROR', message: err.message });
    }
});
exports.qualityRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('RECORD_QUALITY'), async (req, res) => {
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
        const project = await db_1.prisma.project.findUnique({
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
        const count = await db_1.prisma.qualityInspection.count();
        const inspectionNumber = `QC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const inspection = await db_1.prisma.$transaction(async (tx) => {
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
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'RECORD_QUALITY_INSPECTION',
            entity: 'QualityInspection',
            entityId: inspection.id,
            details: `QC Inspection ${inspection.inspectionNumber}: ${inspection.approvedQty} Approved, ${inspection.rejectedQty} Rejected, ${inspection.reworkQty} Rework out of ${inspection.inspectedQty} inspected`,
            ipAddress: req.ip,
        });
        res.status(201).json(inspection);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'QC_CREATE_ERROR', message: err.message });
    }
});
