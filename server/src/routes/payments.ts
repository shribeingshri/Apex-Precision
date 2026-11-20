import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { logActivity } from '../utils/audit';

export const paymentsRouter = Router();

const PaymentRecordSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentDate: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  transactionReference: z.string().min(3),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

paymentsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, invoiceId } = req.query;
    const where: any = {};

    if (clientId && typeof clientId === 'string') where.clientId = clientId;
    if (invoiceId && typeof invoiceId === 'string') where.invoiceId = invoiceId;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        client: { select: { id: true, clientCode: true, companyName: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: 'PAYMENTS_FETCH_ERROR', message: err.message });
  }
});

paymentsRouter.post('/', authenticateToken, requirePermission('RECORD_PAYMENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = PaymentRecordSchema.parse(req.body);

    // 1. Idempotency Check: Prevent duplicate payment recordings
    if (data.idempotencyKey) {
      const existing = await prisma.payment.findUnique({
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

    // 2. Fetch Target Invoice
    const invoice = await prisma.invoice.findUnique({
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

    const currentReceived = new Decimal(invoice.amountReceived.toString());
    const currentOutstanding = new Decimal(invoice.outstandingBalance.toString());
    const paymentAmount = new Decimal(data.amount);

    // 3. Validation: Payment must not exceed current outstanding balance
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

    const count = await prisma.payment.count();
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // 4. Atomic Multi-record Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          projectId: invoice.projectId,
          paymentDate: new Date(data.paymentDate),
          amount: paymentAmount.toFixed(2),
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference,
          status: PaymentStatus.COMPLETED,
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

      // Update invoice atomically
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

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'RECORD_PAYMENT',
      entity: 'Payment',
      entityId: result.payment.id,
      details: `Recorded payment of INR ${paymentAmount.toFixed(2)} for invoice ${invoice.invoiceNumber}. New outstanding: INR ${newOutstanding.toFixed(2)}`,
      ipAddress: req.ip,
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'PAYMENT_RECORD_ERROR', message: err.message });
  }
});

