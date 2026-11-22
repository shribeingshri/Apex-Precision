"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
const audit_1 = require("../utils/audit");
exports.paymentsRouter = (0, express_1.Router)();
const PaymentRecordSchema = zod_1.z.object({
    paymentType: zod_1.z.enum(['INVOICE_PAYMENT', 'ADVANCE_PAYMENT']).default('INVOICE_PAYMENT'),
    invoiceId: zod_1.z.string().uuid().optional().nullable(),
    clientId: zod_1.z.string().uuid().optional(),
    amount: zod_1.z.number().positive('Payment amount must be greater than zero'),
    tdsAmount: zod_1.z.number().min(0, 'TDS cannot be negative').default(0),
    bankCharges: zod_1.z.number().min(0, 'Bank charges cannot be negative').default(0),
    lateFee: zod_1.z.number().min(0, 'Late fee cannot be negative').default(0),
    earlyDiscount: zod_1.z.number().min(0, 'Early discount cannot be negative').default(0),
    paymentDate: zod_1.z.string(),
    paymentMethod: zod_1.z.nativeEnum(client_1.PaymentMethod).default(client_1.PaymentMethod.BANK_TRANSFER),
    transactionReference: zod_1.z.string().min(3, 'Transaction reference must be at least 3 characters'),
    bankName: zod_1.z.string().optional(),
    instrumentDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
const ReversePaymentSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5, 'A clear reversal reason is required (min 5 characters)'),
});
exports.paymentsRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { clientId, invoiceId, status } = req.query;
        const where = {};
        if (clientId && typeof clientId === 'string')
            where.clientId = clientId;
        if (invoiceId && typeof invoiceId === 'string')
            where.invoiceId = invoiceId;
        if (status && typeof status === 'string')
            where.status = status;
        const payments = await db_1.prisma.payment.findMany({
            where,
            include: {
                client: { select: { id: true, clientCode: true, companyName: true, gstin: true } },
                invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, outstandingBalance: true } },
            },
            orderBy: { paymentDate: 'desc' },
        });
        res.json(payments);
    }
    catch (err) {
        res.status(500).json({ error: 'PAYMENTS_FETCH_ERROR', message: err.message });
    }
});
exports.paymentsRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('RECORD_PAYMENTS'), async (req, res) => {
    try {
        const data = PaymentRecordSchema.parse(req.body);
        // 1. Idempotency Check: Prevent duplicate payment recordings
        if (data.idempotencyKey) {
            const existing = await db_1.prisma.payment.findUnique({
                where: { idempotencyKey: data.idempotencyKey },
            });
            if (existing) {
                res.status(409).json({
                    error: 'DUPLICATE_PAYMENT',
                    message: 'This payment transaction has already been processed (Idempotency matched).',
                    payment: existing,
                });
                return;
            }
        }
        const paymentAmount = new decimal_js_1.Decimal(data.amount);
        const tds = new decimal_js_1.Decimal(data.tdsAmount || 0);
        const bankCharges = new decimal_js_1.Decimal(data.bankCharges || 0);
        const lateFee = new decimal_js_1.Decimal(data.lateFee || 0);
        const earlyDiscount = new decimal_js_1.Decimal(data.earlyDiscount || 0);
        // Net Cash actually hitting bank = Applied Amount - TDS - Early Discount + Late Fee - Bank Charges
        const netCash = decimal_js_1.Decimal.max(new decimal_js_1.Decimal(0), paymentAmount.minus(tds).minus(earlyDiscount).plus(lateFee).minus(bankCharges));
        const count = await db_1.prisma.payment.count();
        const paymentNumber = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        // 2. Handle Advance / Unallocated Payment
        if (data.paymentType === 'ADVANCE_PAYMENT' || !data.invoiceId) {
            if (!data.clientId) {
                res.status(400).json({
                    error: 'CLIENT_REQUIRED',
                    message: 'Client selection is required for advance payments.',
                });
                return;
            }
            const client = await db_1.prisma.client.findUnique({ where: { id: data.clientId } });
            if (!client) {
                res.status(404).json({ error: 'CLIENT_NOT_FOUND', message: 'Selected client not found.' });
                return;
            }
            const payment = await db_1.prisma.payment.create({
                data: {
                    paymentNumber,
                    paymentType: 'ADVANCE_PAYMENT',
                    clientId: client.id,
                    paymentDate: new Date(data.paymentDate),
                    amount: paymentAmount.toFixed(2),
                    tdsAmount: tds.toFixed(2),
                    bankCharges: bankCharges.toFixed(2),
                    lateFee: lateFee.toFixed(2),
                    earlyDiscount: earlyDiscount.toFixed(2),
                    netCashReceived: netCash.toFixed(2),
                    paymentMethod: data.paymentMethod,
                    transactionReference: data.transactionReference,
                    bankName: data.bankName,
                    instrumentDate: data.instrumentDate ? new Date(data.instrumentDate) : null,
                    status: client_1.PaymentStatus.COMPLETED,
                    notes: data.notes,
                    idempotencyKey: data.idempotencyKey,
                },
            });
            await (0, audit_1.logActivity)({
                userId: req.user.id,
                userName: req.user.fullName,
                action: 'RECORD_ADVANCE_PAYMENT',
                entity: 'Payment',
                entityId: payment.id,
                details: `Recorded advance payment of INR ${paymentAmount.toFixed(2)} (Net Cash: INR ${netCash.toFixed(2)}) for client ${client.companyName}`,
                ipAddress: req.ip,
            });
            res.status(201).json({ payment, updatedInvoice: null });
            return;
        }
        // 3. Handle Invoice Payment
        const invoice = await db_1.prisma.invoice.findUnique({
            where: { id: data.invoiceId },
        });
        if (!invoice) {
            res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Target invoice not found.' });
            return;
        }
        if (invoice.status === 'PAID') {
            res.status(400).json({
                error: 'INVOICE_ALREADY_PAID',
                message: 'This invoice has already been fully paid.',
            });
            return;
        }
        if (invoice.status === 'CANCELLED') {
            res.status(400).json({
                error: 'INVOICE_CANCELLED',
                message: 'Cannot record payments against a cancelled invoice.',
            });
            return;
        }
        const currentReceived = new decimal_js_1.Decimal(invoice.amountReceived.toString());
        const currentOutstanding = new decimal_js_1.Decimal(invoice.outstandingBalance.toString());
        // Validation: Applied invoice settlement must not exceed current outstanding balance
        if (paymentAmount.greaterThan(currentOutstanding)) {
            res.status(400).json({
                error: 'EXCESS_PAYMENT_AMOUNT',
                message: `Payment amount (${paymentAmount.toFixed(2)}) exceeds current outstanding invoice balance of ${currentOutstanding.toFixed(2)}.`,
            });
            return;
        }
        const newAmountReceived = currentReceived.plus(paymentAmount);
        const newOutstanding = currentOutstanding.minus(paymentAmount);
        const newStatus = newOutstanding.isZero() ? 'PAID' : 'PARTIALLY_PAID';
        // 4. Atomic Multi-record Transaction
        const result = await db_1.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    paymentNumber,
                    paymentType: 'INVOICE_PAYMENT',
                    clientId: invoice.clientId,
                    invoiceId: invoice.id,
                    projectId: invoice.projectId,
                    paymentDate: new Date(data.paymentDate),
                    amount: paymentAmount.toFixed(2),
                    tdsAmount: tds.toFixed(2),
                    bankCharges: bankCharges.toFixed(2),
                    lateFee: lateFee.toFixed(2),
                    earlyDiscount: earlyDiscount.toFixed(2),
                    netCashReceived: netCash.toFixed(2),
                    paymentMethod: data.paymentMethod,
                    transactionReference: data.transactionReference,
                    bankName: data.bankName,
                    instrumentDate: data.instrumentDate ? new Date(data.instrumentDate) : null,
                    status: client_1.PaymentStatus.COMPLETED,
                    notes: data.notes,
                    idempotencyKey: data.idempotencyKey,
                    allocations: {
                        create: {
                            invoiceId: invoice.id,
                            amount: paymentAmount.toFixed(2),
                        },
                    },
                },
            });
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    amountReceived: newAmountReceived.toFixed(2),
                    outstandingBalance: newOutstanding.toFixed(2),
                    status: newStatus,
                },
            });
            return { payment, updatedInvoice };
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'RECORD_PAYMENT',
            entity: 'Payment',
            entityId: result.payment.id,
            details: `Recorded payment ${paymentNumber} of INR ${paymentAmount.toFixed(2)} (TDS: ${tds.toFixed(2)}, Fees: ${bankCharges.toFixed(2)}, Late Fee: ${lateFee.toFixed(2)}, Discount: ${earlyDiscount.toFixed(2)}) for invoice ${invoice.invoiceNumber}. New outstanding: INR ${newOutstanding.toFixed(2)}`,
            ipAddress: req.ip,
        });
        res.status(201).json(result);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Invalid payment payload', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'PAYMENT_RECORD_ERROR', message: err.message });
    }
});
exports.paymentsRouter.post('/:id/reverse', auth_1.authenticateToken, (0, auth_1.requirePermission)('RECORD_PAYMENTS'), async (req, res) => {
    try {
        const { reason } = ReversePaymentSchema.parse(req.body);
        const payment = await db_1.prisma.payment.findUnique({ where: { id: String(req.params.id) } });
        if (!payment) {
            res.status(404).json({ error: 'PAYMENT_NOT_FOUND', message: 'Payment record not found.' });
            return;
        }
        if (payment.status === 'REVERSED') {
            res.status(400).json({ error: 'ALREADY_REVERSED', message: 'This payment has already been reversed.' });
            return;
        }
        const result = await db_1.prisma.$transaction(async (tx) => {
            const reversedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: client_1.PaymentStatus.REVERSED,
                    reversalReason: reason,
                    reversedAt: new Date(),
                },
            });
            let updatedInvoice = null;
            if (payment.invoiceId) {
                const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
                if (invoice) {
                    const payAmt = new decimal_js_1.Decimal(payment.amount.toString());
                    const newReceived = decimal_js_1.Decimal.max(new decimal_js_1.Decimal(0), new decimal_js_1.Decimal(invoice.amountReceived.toString()).minus(payAmt));
                    const newOutstanding = new decimal_js_1.Decimal(invoice.totalAmount.toString()).minus(newReceived);
                    const newStatus = newReceived.isZero() ? 'ISSUED' : 'PARTIALLY_PAID';
                    updatedInvoice = await tx.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            amountReceived: newReceived.toFixed(2),
                            outstandingBalance: newOutstanding.toFixed(2),
                            status: newStatus,
                        },
                    });
                }
            }
            return { payment: reversedPayment, updatedInvoice };
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'REVERSE_PAYMENT',
            entity: 'Payment',
            entityId: payment.id,
            details: `Reversed payment ${payment.paymentNumber} (INR ${payment.amount}). Reason: ${reason}`,
            ipAddress: req.ip,
        });
        res.json(result);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: err.errors[0]?.message, details: err.errors });
            return;
        }
        res.status(500).json({ error: 'PAYMENT_REVERSE_ERROR', message: err.message });
    }
});
