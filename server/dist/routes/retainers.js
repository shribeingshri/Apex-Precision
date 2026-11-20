"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retainersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.retainersRouter = (0, express_1.Router)();
const RetainerSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    scope: zod_1.z.string().min(5),
    contractValue: zod_1.z.number().positive(),
    recurringFee: zod_1.z.number().positive(),
    billingFrequency: zod_1.z.nativeEnum(client_1.BillingFrequency).default(client_1.BillingFrequency.MONTHLY),
    startDate: zod_1.z.string(),
    renewalDate: zod_1.z.string(),
    endDate: zod_1.z.string().optional().nullable(),
    accountManagerId: zod_1.z.string().optional().nullable(),
    estimatedDeliveryCosts: zod_1.z.number().nonnegative().default(0),
    status: zod_1.z.nativeEnum(client_1.RetainerStatus).default(client_1.RetainerStatus.ACTIVE),
    notes: zod_1.z.string().optional(),
});
exports.retainersRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status, clientId } = req.query;
        const where = {};
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        if (clientId && typeof clientId === 'string')
            where.clientId = clientId;
        const retainers = await db_1.prisma.retainer.findMany({
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
    }
    catch (err) {
        res.status(500).json({ error: 'RETAINERS_FETCH_ERROR', message: err.message });
    }
});
exports.retainersRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_RETAINERS'), async (req, res) => {
    try {
        const data = RetainerSchema.parse(req.body);
        const count = await db_1.prisma.retainer.count();
        const retainerCode = `RET-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
        const retainer = await db_1.prisma.retainer.create({
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
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_RETAINER',
            entity: 'Retainer',
            entityId: retainer.id,
            details: `Created retainer ${retainer.retainerCode} (Recurring: INR ${retainer.recurringFee})`,
            ipAddress: req.ip,
        });
        res.status(201).json(retainer);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'RETAINER_CREATE_ERROR', message: err.message });
    }
});
