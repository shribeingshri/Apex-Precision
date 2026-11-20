"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payrollRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
const audit_1 = require("../utils/audit");
exports.payrollRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const PayrollCreateSchema = zod_1.z.object({
    employeeId: zod_1.z.string().uuid(),
    payrollPeriod: zod_1.z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
    basicSalary: zod_1.z.number().positive(),
    allowances: zod_1.z.number().nonnegative().default(0),
    bonus: zod_1.z.number().nonnegative().default(0),
    overtime: zod_1.z.number().nonnegative().default(0),
    deductions: zod_1.z.number().nonnegative().default(0),
    paymentMethod: zod_1.z.nativeEnum(client_1.PaymentMethod).default(client_1.PaymentMethod.BANK_TRANSFER),
    remarks: zod_1.z.string().optional(),
});
exports.payrollRouter.get('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('VIEW_PAYROLL'), async (req, res) => {
    try {
        const { period, employeeId } = req.query;
        const where = {};
        if (period && typeof period === 'string')
            where.payrollPeriod = period;
        if (employeeId && typeof employeeId === 'string')
            where.employeeId = employeeId;
        const records = await db_1.prisma.payrollRecord.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        designation: true,
                        department: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ payrollPeriod: 'desc' }, { employee: { name: 'asc' } }],
        });
        res.json(records);
    }
    catch (err) {
        res.status(500).json({ error: 'PAYROLL_FETCH_ERROR', message: err.message });
    }
});
exports.payrollRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_PAYROLL'), async (req, res) => {
    try {
        const data = PayrollCreateSchema.parse(req.body);
        const basic = new decimal_js_1.Decimal(data.basicSalary);
        const allowances = new decimal_js_1.Decimal(data.allowances);
        const bonus = new decimal_js_1.Decimal(data.bonus);
        const overtime = new decimal_js_1.Decimal(data.overtime);
        const deductions = new decimal_js_1.Decimal(data.deductions);
        const netSalary = basic.plus(allowances).plus(bonus).plus(overtime).minus(deductions);
        if (netSalary.isNegative()) {
            res.status(400).json({
                error: 'INVALID_NET_SALARY',
                message: 'Deductions cannot exceed total gross earnings.',
            });
            return;
        }
        const existing = await db_1.prisma.payrollRecord.findUnique({
            where: {
                employeeId_payrollPeriod: {
                    employeeId: data.employeeId,
                    payrollPeriod: data.payrollPeriod,
                },
            },
        });
        if (existing) {
            res.status(400).json({
                error: 'DUPLICATE_PAYROLL',
                message: `Payroll for this employee for period ${data.payrollPeriod} has already been generated.`,
            });
            return;
        }
        const count = await db_1.prisma.payrollRecord.count();
        const payrollNumber = `PAYROLL-${data.payrollPeriod}-${String(count + 1).padStart(3, '0')}`;
        const record = await db_1.prisma.payrollRecord.create({
            data: {
                payrollNumber,
                employeeId: data.employeeId,
                payrollPeriod: data.payrollPeriod,
                basicSalary: basic.toFixed(2),
                allowances: allowances.toFixed(2),
                bonus: bonus.toFixed(2),
                overtime: overtime.toFixed(2),
                deductions: deductions.toFixed(2),
                netSalary: netSalary.toFixed(2),
                paymentMethod: data.paymentMethod,
                status: client_1.PayrollStatus.DRAFT,
                remarks: data.remarks,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_PAYROLL',
            entity: 'PayrollRecord',
            entityId: record.id,
            details: `Generated payroll ${record.payrollNumber} for Net Salary INR ${netSalary.toFixed(2)}`,
            ipAddress: req.ip,
        });
        res.status(201).json(record);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'PAYROLL_CREATE_ERROR', message: err.message });
    }
});
exports.payrollRouter.post('/:id/disburse', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_PAYROLL'), async (req, res) => {
    try {
        const id = getParamId(req);
        const updated = await db_1.prisma.payrollRecord.update({
            where: { id },
            data: {
                status: client_1.PayrollStatus.PAID,
                paymentDate: new Date(),
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'DISBURSE_PAYROLL',
            entity: 'PayrollRecord',
            entityId: updated.id,
            details: `Disbursed salary for payroll record ${updated.payrollNumber}`,
            ipAddress: req.ip,
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'PAYROLL_DISBURSE_ERROR', message: err.message });
    }
});
