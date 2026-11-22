"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.expensesRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const ExpenseCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    vendor: zod_1.z.string().min(2),
    date: zod_1.z.string(),
    category: zod_1.z.nativeEnum(client_1.ExpenseCategory).default(client_1.ExpenseCategory.RAW_MATERIALS),
    amount: zod_1.z.number().positive(),
    paymentMethod: zod_1.z.nativeEnum(client_1.PaymentMethod).default(client_1.PaymentMethod.BANK_TRANSFER),
    reference: zod_1.z.string().optional(),
    projectId: zod_1.z.string().uuid().optional().nullable(),
    notes: zod_1.z.string().optional(),
    receiptUrl: zod_1.z.string().optional(),
});
exports.expensesRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { category, approvalStatus, projectId } = req.query;
        const where = {};
        if (category && typeof category === 'string' && category !== 'ALL') {
            where.category = category;
        }
        if (approvalStatus && typeof approvalStatus === 'string' && approvalStatus !== 'ALL') {
            where.approvalStatus = approvalStatus;
        }
        if (projectId && typeof projectId === 'string') {
            where.projectId = projectId;
        }
        const expenses = await db_1.prisma.expense.findMany({
            where,
            include: {
                project: { select: { id: true, projectCode: true, name: true } },
                approvedBy: { select: { id: true, fullName: true } },
            },
            orderBy: { date: 'desc' },
        });
        res.json(expenses);
    }
    catch (err) {
        res.status(500).json({ error: 'EXPENSE_FETCH_ERROR', message: err.message });
    }
});
exports.expensesRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_EXPENSES'), async (req, res) => {
    try {
        const data = ExpenseCreateSchema.parse(req.body);
        const count = await db_1.prisma.expense.count();
        const expenseNumber = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const expense = await db_1.prisma.expense.create({
            data: {
                expenseNumber,
                title: data.title,
                vendor: data.vendor,
                date: new Date(data.date),
                category: data.category,
                amount: data.amount,
                paymentMethod: data.paymentMethod,
                reference: data.reference,
                projectId: data.projectId,
                recordedById: req.user.id,
                approvalStatus: client_1.ExpenseApprovalStatus.PENDING,
                notes: data.notes,
                receiptUrl: data.receiptUrl,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'RECORD_EXPENSE',
            entity: 'Expense',
            entityId: expense.id,
            details: `Logged expense ${expense.expenseNumber} for INR ${expense.amount} (${expense.vendor})`,
            ipAddress: req.ip,
        });
        res.status(201).json(expense);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'EXPENSE_CREATE_ERROR', message: err.message });
    }
});
async function handleExpenseApproval(req, res) {
    try {
        const id = getParamId(req);
        const status = req.body.status || req.body.approvalStatus;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be APPROVED or REJECTED.' });
            return;
        }
        const updated = await db_1.prisma.expense.update({
            where: { id },
            data: {
                approvalStatus: status,
                approvedById: req.user.id,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'EXPENSE_APPROVAL',
            entity: 'Expense',
            entityId: updated.id,
            details: `Expense ${updated.expenseNumber} was ${status} by ${req.user.fullName}`,
            ipAddress: req.ip,
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'EXPENSE_APPROVAL_ERROR', message: err.message });
    }
}
exports.expensesRouter.post('/:id/approval', auth_1.authenticateToken, (0, auth_1.requirePermission)('APPROVE_EXPENSES'), handleExpenseApproval);
exports.expensesRouter.patch('/:id/approval', auth_1.authenticateToken, (0, auth_1.requirePermission)('APPROVE_EXPENSES'), handleExpenseApproval);
