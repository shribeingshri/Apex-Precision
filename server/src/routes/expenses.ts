import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { ExpenseCategory, ExpenseApprovalStatus, PaymentMethod } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const expensesRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const ExpenseCreateSchema = z.object({
  title: z.string().min(3),
  vendor: z.string().min(2),
  date: z.string(),
  category: z.nativeEnum(ExpenseCategory).default(ExpenseCategory.RAW_MATERIALS),
  amount: z.number().positive(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  reference: z.string().optional(),
  projectId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  receiptUrl: z.string().optional(),
});

expensesRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, approvalStatus, projectId } = req.query;
    const where: any = {};

    if (category && typeof category === 'string' && category !== 'ALL') {
      where.category = category as ExpenseCategory;
    }

    if (approvalStatus && typeof approvalStatus === 'string' && approvalStatus !== 'ALL') {
      where.approvalStatus = approvalStatus as ExpenseApprovalStatus;
    }

    if (projectId && typeof projectId === 'string') {
      where.projectId = projectId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { date: 'desc' },
    });

    res.json(expenses);
  } catch (err: any) {
    res.status(500).json({ error: 'EXPENSE_FETCH_ERROR', message: err.message });
  }
});

expensesRouter.post('/', authenticateToken, requirePermission('MANAGE_EXPENSES'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = ExpenseCreateSchema.parse(req.body);
    const count = await prisma.expense.count();
    const expenseNumber = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const expense = await prisma.expense.create({
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
        recordedById: req.user!.id,
        approvalStatus: ExpenseApprovalStatus.PENDING,
        notes: data.notes,
        receiptUrl: data.receiptUrl,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'RECORD_EXPENSE',
      entity: 'Expense',
      entityId: expense.id,
      details: `Logged expense ${expense.expenseNumber} for INR ${expense.amount} (${expense.vendor})`,
      ipAddress: req.ip,
    });

    res.status(201).json(expense);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'EXPENSE_CREATE_ERROR', message: err.message });
  }
});

expensesRouter.post('/:id/approval', authenticateToken, requirePermission('APPROVE_EXPENSES'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be APPROVED or REJECTED.' });
      return;
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        approvalStatus: status as ExpenseApprovalStatus,
        approvedById: req.user!.id,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'EXPENSE_APPROVAL',
      entity: 'Expense',
      entityId: updated.id,
      details: `Expense ${updated.expenseNumber} was ${status} by ${req.user!.fullName}`,
      ipAddress: req.ip,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'EXPENSE_APPROVAL_ERROR', message: err.message });
  }
});
