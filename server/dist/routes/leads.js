"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.leadsRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const LeadCreateSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(2),
    contactPerson: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(7),
    address: zod_1.z.string().optional(),
    industry: zod_1.z.string().optional(),
    productRequirement: zod_1.z.string().min(2),
    expectedQty: zod_1.z.number().int().positive(),
    estimatedValue: zod_1.z.number().nonnegative(),
    leadSource: zod_1.z.string().optional(),
    assignedEmployeeId: zod_1.z.string().optional(),
    followUpDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(client_1.LeadStatus).optional(),
});
exports.leadsRouter.get('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_LEADS'), async (req, res) => {
    try {
        const { status, search } = req.query;
        const where = {};
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { companyName: { contains: search, mode: 'insensitive' } },
                { contactPerson: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { leadCode: { contains: search, mode: 'insensitive' } },
            ];
        }
        const leads = await db_1.prisma.lead.findMany({
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
    }
    catch (err) {
        res.status(500).json({ error: 'LEADS_ERROR', message: err.message });
    }
});
exports.leadsRouter.get('/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_LEADS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const lead = await db_1.prisma.lead.findUnique({
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
    }
    catch (err) {
        res.status(500).json({ error: 'LEAD_FETCH_ERROR', message: err.message });
    }
});
exports.leadsRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_LEADS'), async (req, res) => {
    try {
        const data = LeadCreateSchema.parse(req.body);
        const count = await db_1.prisma.lead.count();
        const leadCode = `LEAD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const newLead = await db_1.prisma.lead.create({
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
                status: data.status || client_1.LeadStatus.NEW,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_LEAD',
            entity: 'Lead',
            entityId: newLead.id,
            details: `Created new lead ${newLead.leadCode} for ${newLead.companyName}`,
            ipAddress: req.ip,
        });
        res.status(201).json(newLead);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'LEAD_CREATE_ERROR', message: err.message });
    }
});
exports.leadsRouter.put('/:id', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_LEADS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const data = LeadCreateSchema.partial().parse(req.body);
        const updated = await db_1.prisma.lead.update({
            where: { id },
            data: {
                ...data,
                followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'UPDATE_LEAD',
            entity: 'Lead',
            entityId: updated.id,
            details: `Updated lead ${updated.leadCode} (${updated.status})`,
            ipAddress: req.ip,
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'LEAD_UPDATE_ERROR', message: err.message });
    }
});
exports.leadsRouter.post('/:id/convert', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_CLIENTS'), async (req, res) => {
    try {
        const id = getParamId(req);
        const lead = await db_1.prisma.lead.findUnique({
            where: { id },
        });
        if (!lead) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Lead not found.' });
            return;
        }
        if (lead.status === client_1.LeadStatus.CONVERTED || lead.convertedClientId) {
            res.status(400).json({
                error: 'ALREADY_CONVERTED',
                message: 'This lead has already been converted into a client.',
            });
            return;
        }
        const clientCount = await db_1.prisma.client.count();
        const clientCode = `CLI-${1000 + clientCount + 1}`;
        const result = await db_1.prisma.$transaction(async (tx) => {
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
                    status: client_1.LeadStatus.CONVERTED,
                    convertedClientId: client.id,
                },
            });
            return { client, updatedLead };
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
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
    }
    catch (err) {
        res.status(500).json({ error: 'CONVERSION_ERROR', message: err.message });
    }
});
