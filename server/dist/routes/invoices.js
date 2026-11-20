"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const decimal_js_1 = require("decimal.js");
const audit_1 = require("../utils/audit");
exports.invoicesRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const InvoiceItemSchema = zod_1.z.object({
    description: zod_1.z.string().min(2),
    quantity: zod_1.z.number().int().positive(),
    unitPrice: zod_1.z.number().positive(),
});
const InvoiceCreateSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid().optional().nullable(),
    invoiceDate: zod_1.z.string(),
    dueDate: zod_1.z.string(),
    items: zod_1.z.array(InvoiceItemSchema).min(1, 'Invoice must have at least one line item'),
    discount: zod_1.z.number().nonnegative().default(0),
    taxRate: zod_1.z.number().nonnegative().default(18),
    paymentTerms: zod_1.z.string().default('Net 30 Days'),
    notes: zod_1.z.string().optional(),
});
exports.invoicesRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { clientId, projectId, status } = req.query;
        const where = {};
        if (clientId && typeof clientId === 'string')
            where.clientId = clientId;
        if (projectId && typeof projectId === 'string')
            where.projectId = projectId;
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        const invoices = await db_1.prisma.invoice.findMany({
            where,
            include: {
                client: { select: { id: true, clientCode: true, companyName: true, email: true } },
                project: { select: { id: true, projectCode: true, name: true } },
                items: true,
            },
            orderBy: { invoiceDate: 'desc' },
        });
        res.json(invoices);
    }
    catch (err) {
        res.status(500).json({ error: 'INVOICE_FETCH_ERROR', message: err.message });
    }
});
exports.invoicesRouter.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = getParamId(req);
        const invoice = await db_1.prisma.invoice.findUnique({
            where: { id },
            include: {
                client: true,
                project: true,
                items: true,
                payments: {
                    orderBy: { paymentDate: 'desc' },
                },
            },
        });
        if (!invoice) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found.' });
            return;
        }
        res.json(invoice);
    }
    catch (err) {
        res.status(500).json({ error: 'INVOICE_DETAIL_ERROR', message: err.message });
    }
});
exports.invoicesRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_INVOICES'), async (req, res) => {
    try {
        const data = InvoiceCreateSchema.parse(req.body);
        let subtotal = new decimal_js_1.Decimal(0);
        const calculatedItems = data.items.map((item) => {
            const lineTotal = new decimal_js_1.Decimal(item.quantity).times(new decimal_js_1.Decimal(item.unitPrice));
            subtotal = subtotal.plus(lineTotal);
            return {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: lineTotal.toFixed(2),
            };
        });
        const discount = new decimal_js_1.Decimal(data.discount);
        const taxableAmount = decimal_js_1.Decimal.max(0, subtotal.minus(discount));
        const taxRate = new decimal_js_1.Decimal(data.taxRate);
        const taxAmount = taxableAmount.times(taxRate.dividedBy(100));
        const totalAmount = taxableAmount.plus(taxAmount);
        const count = await db_1.prisma.invoice.count();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const invoice = await db_1.prisma.$transaction(async (tx) => {
            const created = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    clientId: data.clientId,
                    projectId: data.projectId,
                    invoiceDate: new Date(data.invoiceDate),
                    dueDate: new Date(data.dueDate),
                    subtotal: subtotal.toFixed(2),
                    discount: discount.toFixed(2),
                    taxRate: taxRate.toFixed(2),
                    taxAmount: taxAmount.toFixed(2),
                    totalAmount: totalAmount.toFixed(2),
                    amountReceived: '0.00',
                    outstandingBalance: totalAmount.toFixed(2),
                    paymentTerms: data.paymentTerms,
                    status: 'ISSUED',
                    notes: data.notes,
                    items: {
                        create: calculatedItems.map((item) => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            lineTotal: item.lineTotal,
                        })),
                    },
                },
            });
            return created;
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'GENERATE_INVOICE',
            entity: 'Invoice',
            entityId: invoice.id,
            details: `Generated invoice ${invoice.invoiceNumber} for amount INR ${totalAmount.toFixed(2)} (Subtotal: ${subtotal.toFixed(2)}, Tax: ${taxAmount.toFixed(2)})`,
            ipAddress: req.ip,
        });
        res.status(201).json(invoice);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'INVOICE_CREATE_ERROR', message: err.message });
    }
});
