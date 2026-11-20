"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.clientsRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const ClientSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(2),
    contactPerson: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(7),
    address: zod_1.z.string().min(5),
    gstin: zod_1.z.string().optional(),
    industry: zod_1.z.string().optional(),
    accountManagerId: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(client_1.ClientStatus).optional(),
});
exports.clientsRouter.get('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_CLIENTS'), async (req, res) => {
    try {
        const { search, includeArchived } = req.query;
        const where = {};
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
        const clients = await db_1.prisma.client.findMany({
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
    }
    catch (err) {
        res.status(500).json({ error: 'CLIENTS_FETCH_ERROR', message: err.message });
    }
});
exports.clientsRouter.get('/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_CLIENTS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const client = await db_1.prisma.client.findUnique({
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
        client.invoices.forEach((inv) => {
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
    }
    catch (err) {
        res.status(500).json({ error: 'CLIENT_DETAIL_ERROR', message: err.message });
    }
});
exports.clientsRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_CLIENTS'), async (req, res) => {
    try {
        const data = ClientSchema.parse(req.body);
        const count = await db_1.prisma.client.count();
        const clientCode = `CLI-${1000 + count + 1}`;
        const newClient = await db_1.prisma.client.create({
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
                status: data.status || client_1.ClientStatus.ACTIVE,
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
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_CLIENT',
            entity: 'Client',
            entityId: newClient.id,
            details: `Created new client ${newClient.clientCode} (${newClient.companyName})`,
            ipAddress: req.ip,
        });
        res.status(201).json(newClient);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'CLIENT_CREATE_ERROR', message: err.message });
    }
});
exports.clientsRouter.put('/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_CLIENTS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const data = ClientSchema.partial().parse(req.body);
        const updated = await db_1.prisma.client.update({
            where: { id },
            data,
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'UPDATE_CLIENT',
            entity: 'Client',
            entityId: updated.id,
            details: `Updated client ${updated.clientCode} (${updated.companyName})`,
            ipAddress: req.ip,
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'CLIENT_UPDATE_ERROR', message: err.message });
    }
});
exports.clientsRouter.post('/:id/archive', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_CLIENTS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const updated = await db_1.prisma.client.update({
            where: { id },
            data: {
                isArchived: true,
                archivedAt: new Date(),
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'ARCHIVE_CLIENT',
            entity: 'Client',
            entityId: updated.id,
            details: `Archived client ${updated.clientCode} (${updated.companyName}). All historical orders preserved.`,
            ipAddress: req.ip,
        });
        res.json({ message: 'Client archived safely without removing historical records.', client: updated });
    }
    catch (err) {
        res.status(500).json({ error: 'ARCHIVE_ERROR', message: err.message });
    }
});
exports.clientsRouter.post('/:id/restore', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_CLIENTS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const updated = await db_1.prisma.client.update({
            where: { id },
            data: {
                isArchived: false,
                archivedAt: null,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'RESTORE_CLIENT',
            entity: 'Client',
            entityId: updated.id,
            details: `Restored archived client ${updated.clientCode}`,
            ipAddress: req.ip,
        });
        res.json({ message: 'Client restored successfully.', client: updated });
    }
    catch (err) {
        res.status(500).json({ error: 'RESTORE_ERROR', message: err.message });
    }
});
