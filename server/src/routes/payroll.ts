import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { PayrollStatus, PaymentMethod } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { logActivity } from '../utils/audit';

export const payrollRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const PayrollCreateSchema = z.object({
  employeeId: z.string().uuid(),
  payrollPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
  basicSalary: z.number().positive(),
  allowances: z.number().nonnegative().default(0),
  bonus: z.number().nonnegative().default(0),
  overtime: z.number().nonnegative().default(0),
  deductions: z.number().nonnegative().default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  remarks: z.string().optional(),
});

payrollRouter.get('/', authenticateToken, requirePermission('VIEW_PAYROLL'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { period, employeeId } = req.query;
    const where: any = {};

    if (period && typeof period === 'string') where.payrollPeriod = period;
    if (employeeId && typeof employeeId === 'string') where.employeeId = employeeId;

    const records = await prisma.payrollRecord.findMany({
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
  } catch (err: any) {
    res.status(500).json({ error: 'PAYROLL_FETCH_ERROR', message: err.message });
  }
});

payrollRouter.post('/', authenticateToken, requirePermission('MANAGE_PAYROLL'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = PayrollCreateSchema.parse(req.body);

    const basic = new Decimal(data.basicSalary);
    const allowances = new Decimal(data.allowances);
    const bonus = new Decimal(data.bonus);
    const overtime = new Decimal(data.overtime);
    const deductions = new Decimal(data.deductions);

    const netSalary = basic.plus(allowances).plus(bonus).plus(overtime).minus(deductions);
    if (netSalary.isNegative()) {
      res.status(400).json({
        error: 'INVALID_NET_SALARY',
        message: 'Deductions cannot exceed total gross earnings.',
      });
      return;
    }

    const existing = await prisma.payrollRecord.findUnique({
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

    const count = await prisma.payrollRecord.count();
    const payrollNumber = `PAYROLL-${data.payrollPeriod}-${String(count + 1).padStart(3, '0')}`;

    const record = await prisma.payrollRecord.create({
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
        status: PayrollStatus.DRAFT,
        remarks: data.remarks,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CREATE_PAYROLL',
      entity: 'PayrollRecord',
      entityId: record.id,
      details: `Generated payroll ${record.payrollNumber} for Net Salary INR ${netSalary.toFixed(2)}`,
      ipAddress: req.ip,
    });

    res.status(201).json(record);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'PAYROLL_CREATE_ERROR', message: err.message });
  }
});

payrollRouter.post('/:id/disburse', authenticateToken, requirePermission('MANAGE_PAYROLL'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const updated = await prisma.payrollRecord.update({
      where: { id },
      data: {
        status: PayrollStatus.PAID,
        paymentDate: new Date(),
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'DISBURSE_PAYROLL',
      entity: 'PayrollRecord',
      entityId: updated.id,
      details: `Disbursed salary for payroll record ${updated.payrollNumber}`,
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'PAYROLL_DISBURSE_ERROR', message: err.message });
  }
});
